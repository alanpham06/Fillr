import { useCallback, useMemo, useRef, useState } from "react";
import { clamp, polylineHitsPoint } from "../lib/geometry.js";
import { pointsToSvgPath } from "../lib/smoothPath.js";
import {
  ERASER_RADIUS_PX,
  HIGHLIGHTER_OPACITY,
  strokeOpacity,
  strokeTool,
} from "../lib/workspaceTypes.js";

let strokeSeq = 0;
function nextStrokeId() {
  strokeSeq += 1;
  return `stroke-${Date.now()}-${strokeSeq}`;
}

function localPoint(event, bounds) {
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function toNorm(point, width, height) {
  return {
    x: clamp(width > 0 ? point.x / width : 0, -0.05, 1.05),
    y: clamp(height > 0 ? point.y / height : 0, -0.05, 1.05),
  };
}

function toPixel(points, width, height) {
  return points.map((point) => ({ x: point.x * width, y: point.y * height }));
}

function hitsStroke(stroke, point, width, height, eraserRadius) {
  const radius = eraserRadius + (stroke.width * width) / 2;
  return polylineHitsPoint(toPixel(stroke.points, width, height), point.x, point.y, radius);
}

export default function InkOverlay({
  strokes,
  enabled,
  color,
  widthNorm,
  width,
  height,
  tool,
  opacity = 1,
  eraserRadius = ERASER_RADIUS_PX,
  onStrokeComplete,
  onEraseStrokes,
}) {
  const livePointsRef = useRef([]);
  const drawingRef = useRef(false);
  const rafRef = useRef(0);
  const erasedRef = useRef(new Set());
  const strokesRef = useRef(strokes);
  const [livePoints, setLivePoints] = useState(null);
  const size = { width, height };
  strokesRef.current = strokes;

  const eraseAt = useCallback(
    (point) => {
      if (width <= 0 || height <= 0) {
        return;
      }
      const hits = strokesRef.current
        .filter(
          (stroke) =>
            !erasedRef.current.has(stroke.id) &&
            hitsStroke(stroke, point, width, height, eraserRadius),
        )
        .map((stroke) => stroke.id);
      if (hits.length === 0) {
        return;
      }
      hits.forEach((id) => erasedRef.current.add(id));
      onEraseStrokes?.(hits);
    },
    [eraserRadius, height, onEraseStrokes, width],
  );

  const scheduleLiveFrame = useCallback(() => {
    if (rafRef.current) {
      return;
    }
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setLivePoints(livePointsRef.current.slice());
    });
  }, []);

  const finishStroke = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    const pixels = livePointsRef.current;
    livePointsRef.current = [];
    drawingRef.current = false;
    setLivePoints(null);
    if (tool === "eraser" || pixels.length === 0 || width <= 0 || height <= 0) {
      return;
    }
    const nextTool = tool === "highlighter" ? "highlighter" : "pen";
    onStrokeComplete({
      id: nextStrokeId(),
      points: pixels.map((point) => toNorm(point, width, height)),
      color,
      width: widthNorm,
      tool: nextTool,
      opacity: nextTool === "highlighter" ? HIGHLIGHTER_OPACITY : opacity,
    });
  }, [color, height, onStrokeComplete, opacity, tool, width, widthNorm]);

  function handlePointerDown(event) {
    if (!enabled || event.button > 0) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = localPoint(event, bounds);
    drawingRef.current = true;
    erasedRef.current = new Set();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    if (tool === "eraser") {
      livePointsRef.current = [];
      setLivePoints(null);
      eraseAt(point);
      return;
    }
    livePointsRef.current = [point];
    setLivePoints([point]);
  }

  function handlePointerMove(event) {
    if (!drawingRef.current) {
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    const point = localPoint(event, bounds);
    if (tool === "eraser") {
      eraseAt(point);
      return;
    }
    livePointsRef.current.push(point);
    scheduleLiveFrame();
  }

  function handlePointerUp() {
    if (!drawingRef.current) {
      return;
    }
    finishStroke();
  }

  const livePath = useMemo(
    () => (livePoints && livePoints.length > 0 ? pointsToSvgPath(livePoints) : ""),
    [livePoints],
  );
  const liveOpacity = tool === "highlighter" ? HIGHLIGHTER_OPACITY : opacity;

  return (
    <div
      className={`ink-overlay${enabled ? " is-live" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {size.width > 0 && size.height > 0 ? (
        <svg width={size.width} height={size.height} className="ink-svg">
          {strokes.map((stroke) => (
            <path
              key={stroke.id}
              d={pointsToSvgPath(toPixel(stroke.points, size.width, size.height))}
              stroke={stroke.color}
              strokeWidth={stroke.width * size.width}
              strokeOpacity={strokeOpacity(stroke)}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                mixBlendMode: strokeTool(stroke) === "highlighter" ? "multiply" : "normal",
              }}
            />
          ))}
          {livePath ? (
            <path
              d={livePath}
              stroke={color}
              strokeWidth={widthNorm * size.width}
              strokeOpacity={liveOpacity}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                mixBlendMode: tool === "highlighter" ? "multiply" : "normal",
              }}
            />
          ) : null}
        </svg>
      ) : null}
    </div>
  );
}
