import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { clamp, polylineHitsPoint } from '../lib/geometry';
import { type Point, pointsToSvgPath } from '../lib/smoothPath';
import {
  ERASER_RADIUS_PX,
  HIGHLIGHTER_OPACITY,
  strokeOpacity,
  type DrawTool,
  type WorkspaceStroke,
} from '../lib/workspaceTypes';

export type InkOverlayProps = {
  strokes: WorkspaceStroke[];
  enabled: boolean;
  color: string;
  /** Stroke width as a fraction of the overlay width. */
  widthNorm: number;
  tool: DrawTool;
  opacity?: number;
  onStrokeComplete: (stroke: WorkspaceStroke) => void;
  onEraseStrokes?: (ids: string[]) => void;
  onDrawingChange?: (isDrawing: boolean) => void;
};

let strokeSeq = 0;
function nextStrokeId(): string {
  strokeSeq += 1;
  return `stroke-${Date.now()}-${strokeSeq}`;
}

function localPoint(event: GestureResponderEvent): Point {
  const { locationX, locationY } = event.nativeEvent;
  return { x: locationX, y: locationY };
}

function toNorm(point: Point, width: number, height: number): Point {
  return {
    x: clamp(width > 0 ? point.x / width : 0, -0.05, 1.05),
    y: clamp(height > 0 ? point.y / height : 0, -0.05, 1.05),
  };
}

function toPixel(points: readonly Point[], width: number, height: number): Point[] {
  return points.map((point) => ({ x: point.x * width, y: point.y * height }));
}

function hitsStroke(
  stroke: WorkspaceStroke,
  point: Point,
  width: number,
  height: number,
): boolean {
  const radius = ERASER_RADIUS_PX + (stroke.width * width) / 2;
  return polylineHitsPoint(toPixel(stroke.points, width, height), point.x, point.y, radius);
}

const CompletedStroke = memo(function CompletedStroke({
  stroke,
  width,
  height,
}: {
  stroke: WorkspaceStroke;
  width: number;
  height: number;
}) {
  const d = pointsToSvgPath(toPixel(stroke.points, width, height));
  return (
    <Path
      d={d}
      stroke={stroke.color}
      strokeWidth={stroke.width * width}
      strokeOpacity={strokeOpacity(stroke)}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
});

export function InkOverlay({
  strokes,
  enabled,
  color,
  widthNorm,
  tool,
  opacity = 1,
  onStrokeComplete,
  onEraseStrokes,
  onDrawingChange,
}: InkOverlayProps) {
  const [livePoints, setLivePoints] = useState<Point[] | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const livePointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number | null>(null);
  const sizeRef = useRef(size);
  const colorRef = useRef(color);
  const widthRef = useRef(widthNorm);
  const toolRef = useRef(tool);
  const opacityRef = useRef(opacity);
  const strokesRef = useRef(strokes);
  const erasedRef = useRef<Set<string>>(new Set());
  const onStrokeCompleteRef = useRef(onStrokeComplete);
  const onEraseStrokesRef = useRef(onEraseStrokes);
  const onDrawingChangeRef = useRef(onDrawingChange);

  sizeRef.current = size;
  colorRef.current = color;
  widthRef.current = widthNorm;
  toolRef.current = tool;
  opacityRef.current = opacity;
  strokesRef.current = strokes;
  onStrokeCompleteRef.current = onStrokeComplete;
  onEraseStrokesRef.current = onEraseStrokes;
  onDrawingChangeRef.current = onDrawingChange;

  const eraseAt = useCallback((point: Point) => {
    const { width, height } = sizeRef.current;
    if (width <= 0 || height <= 0) {
      return;
    }
    const hits = strokesRef.current
      .filter((stroke) => !erasedRef.current.has(stroke.id) && hitsStroke(stroke, point, width, height))
      .map((stroke) => stroke.id);
    if (hits.length === 0) {
      return;
    }
    hits.forEach((id) => erasedRef.current.add(id));
    onEraseStrokesRef.current?.(hits);
  }, []);

  const scheduleLiveFrame = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      setLivePoints(livePointsRef.current.slice());
    });
  }, []);

  const finishLiveFrame = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event) => {
          const point = localPoint(event);
          erasedRef.current = new Set();
          onDrawingChangeRef.current?.(true);
          if (toolRef.current === 'eraser') {
            livePointsRef.current = [];
            setLivePoints(null);
            eraseAt(point);
            return;
          }
          livePointsRef.current = [point];
          setLivePoints([point]);
        },
        onPanResponderMove: (event) => {
          const point = localPoint(event);
          if (toolRef.current === 'eraser') {
            eraseAt(point);
            return;
          }
          livePointsRef.current.push(point);
          scheduleLiveFrame();
        },
        onPanResponderRelease: () => {
          finishLiveFrame();
          const pixels = livePointsRef.current;
          livePointsRef.current = [];
          setLivePoints(null);
          onDrawingChangeRef.current?.(false);
          if (toolRef.current === 'eraser') {
            return;
          }
          const { width, height } = sizeRef.current;
          if (pixels.length === 0 || width <= 0 || height <= 0) {
            return;
          }
          const nextTool = toolRef.current === 'highlighter' ? 'highlighter' : 'pen';
          onStrokeCompleteRef.current({
            id: nextStrokeId(),
            points: pixels.map((point) => toNorm(point, width, height)),
            color: colorRef.current,
            width: widthRef.current,
            tool: nextTool,
            opacity: nextTool === 'highlighter' ? HIGHLIGHTER_OPACITY : opacityRef.current,
          });
        },
        onPanResponderTerminate: () => {
          finishLiveFrame();
          livePointsRef.current = [];
          setLivePoints(null);
          onDrawingChangeRef.current?.(false);
        },
      }),
    [eraseAt, finishLiveFrame, scheduleLiveFrame],
  );

  const livePath = useMemo(
    () => (livePoints && livePoints.length > 0 ? pointsToSvgPath(livePoints) : ''),
    [livePoints],
  );
  const liveOpacity = tool === 'highlighter' ? HIGHLIGHTER_OPACITY : opacity;

  return (
    <View
      collapsable={false}
      style={styles.host}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
      pointerEvents={enabled ? 'auto' : 'none'}
      {...(enabled ? panResponder.panHandlers : {})}
    >
      {size.width > 0 && size.height > 0 ? (
        <Svg width={size.width} height={size.height} style={styles.svg} pointerEvents="none">
          {strokes.map((stroke) => (
            <CompletedStroke
              key={stroke.id}
              stroke={stroke}
              width={size.width}
              height={size.height}
            />
          ))}
          {livePath ? (
            <Path
              d={livePath}
              stroke={color}
              strokeWidth={widthNorm * size.width}
              strokeOpacity={liveOpacity}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
  svg: {
    flex: 1,
  },
});
