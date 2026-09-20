import { useEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { clamp } from '../lib/geometry';
import {
  PAGE_MARGIN,
  grownTextBox,
  resizedTextBox,
  type ResizeHandle,
  type WorkspaceTextBox,
} from '../lib/workspaceTypes';
import { colors, radii } from '../theme';

const HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type TextBoxLayerProps = {
  boxes: WorkspaceTextBox[];
  selectedId: string | null;
  enabled: boolean;
  pageWidth: number;
  pageHeight: number;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<WorkspaceTextBox>) => void;
  onRemove: (id: string) => void;
  onPlace: (x: number, y: number) => void;
};

export function TextBoxLayer({
  boxes,
  selectedId,
  enabled,
  pageWidth,
  pageHeight,
  onSelect,
  onChange,
  onRemove,
  onPlace,
}: TextBoxLayerProps) {
  const ignorePlace = useRef(false);

  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }

  return (
    <View style={styles.host} pointerEvents={enabled ? 'auto' : 'none'}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={(event) => {
          if (!enabled) {
            return;
          }
          if (ignorePlace.current) {
            ignorePlace.current = false;
            return;
          }
          const { locationX, locationY } = event.nativeEvent;
          onPlace(
            clamp(locationX / pageWidth, 0, 0.95),
            clamp(locationY / pageHeight, 0, 0.95),
          );
        }}
      />
      {boxes.map((box) => (
        <TextBox
          key={box.id}
          box={box}
          selected={box.id === selectedId}
          enabled={enabled}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          onSelect={() => {
            ignorePlace.current = true;
            onSelect(box.id);
          }}
          onChange={(patch) => onChange(box.id, patch)}
          onRemove={() => onRemove(box.id)}
        />
      ))}
    </View>
  );
}

type TextBoxProps = {
  box: WorkspaceTextBox;
  selected: boolean;
  enabled: boolean;
  pageWidth: number;
  pageHeight: number;
  onSelect: () => void;
  onChange: (patch: Partial<WorkspaceTextBox>) => void;
  onRemove: () => void;
};

function movedBox(
  start: { x: number; y: number },
  box: WorkspaceTextBox,
  dx: number,
  dy: number,
  pageWidth: number,
  pageHeight: number,
) {
  const maxX = Math.max(PAGE_MARGIN, 1 - PAGE_MARGIN - box.width);
  const maxY = Math.max(PAGE_MARGIN, 1 - PAGE_MARGIN - box.height);
  return {
    x: clamp(start.x + dx / pageWidth, PAGE_MARGIN, maxX),
    y: clamp(start.y + dy / pageHeight, PAGE_MARGIN, maxY),
  };
}

function TextBox({
  box,
  selected,
  enabled,
  pageWidth,
  pageHeight,
  onSelect,
  onChange,
  onRemove,
}: TextBoxProps) {
  const boxRef = useRef(box);
  const startRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const onChangeRef = useRef(onChange);
  const onSelectRef = useRef(onSelect);
  const editingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const [editing, setEditing] = useState(selected && box.text.length === 0);

  boxRef.current = box;
  onChangeRef.current = onChange;
  onSelectRef.current = onSelect;
  editingRef.current = editing;

  useEffect(() => {
    if (!selected) {
      setEditing(false);
      return;
    }
    if (enabled && box.text.length === 0) {
      setEditing(true);
    }
  }, [box.text.length, enabled, selected]);

  useEffect(() => {
    if (editing && selected && enabled) {
      inputRef.current?.focus();
    }
  }, [editing, enabled, selected]);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = {
            x: boxRef.current.x,
            y: boxRef.current.y,
            width: boxRef.current.width,
            height: boxRef.current.height,
          };
          onSelectRef.current();
          setEditing(false);
          inputRef.current?.blur();
        },
        onPanResponderMove: (_, gesture) => {
          onChangeRef.current(
            movedBox(startRef.current, boxRef.current, gesture.dx, gesture.dy, pageWidth, pageHeight),
          );
        },
      }),
    [pageHeight, pageWidth],
  );

  const boxDrag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !editingRef.current,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !editingRef.current && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = {
            x: boxRef.current.x,
            y: boxRef.current.y,
            width: boxRef.current.width,
            height: boxRef.current.height,
          };
          onSelectRef.current();
        },
        onPanResponderMove: (_, gesture) => {
          onChangeRef.current(
            movedBox(startRef.current, boxRef.current, gesture.dx, gesture.dy, pageWidth, pageHeight),
          );
        },
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) < 6 && Math.abs(gesture.dy) < 6) {
            setEditing(true);
          }
        },
      }),
    [pageHeight, pageWidth],
  );

  const resizeFor = useMemo(() => {
    const makers = {} as Record<ResizeHandle, ReturnType<typeof PanResponder.create>>;
    for (const handle of HANDLES) {
      makers[handle] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          startRef.current = {
            x: boxRef.current.x,
            y: boxRef.current.y,
            width: boxRef.current.width,
            height: boxRef.current.height,
          };
          onSelectRef.current();
          setEditing(false);
          inputRef.current?.blur();
        },
        onPanResponderMove: (_, gesture) => {
          onChangeRef.current(
            resizedTextBox(startRef.current, handle, gesture.dx, gesture.dy, pageWidth, pageHeight),
          );
        },
      });
    }
    return makers;
  }, [pageHeight, pageWidth]);

  const left = box.x * pageWidth;
  const top = box.y * pageHeight;
  const width = Math.max(80, box.width * pageWidth);
  const height = Math.max(28, box.height * pageHeight);
  const fontSize = Math.max(12, box.fontSize * pageHeight);
  const maxMeasureWidth = Math.max(80, (1 - PAGE_MARGIN - box.x) * pageWidth - 16);

  return (
    <View
      collapsable={false}
      style={[styles.wrap, { left, top, width, height }]}
    >
      {enabled && selected ? (
        <View style={styles.handleRow}>
          <View
            collapsable={false}
            style={styles.handle}
            {...drag.panHandlers}
            accessibilityLabel="Move text box"
          >
            <Text style={styles.handleMark}>⠿ Move</Text>
          </View>
          <Pressable onPress={onRemove} style={styles.remove} accessibilityLabel="Delete text box">
            <Text style={styles.removeLabel}>×</Text>
          </Pressable>
        </View>
      ) : null}
      <View
        collapsable={false}
        {...(enabled ? boxDrag.panHandlers : {})}
        style={[
          styles.box,
          {
            borderColor: selected ? colors.teal : 'transparent',
            minHeight: height,
          },
        ]}
      >
        <Text
          pointerEvents="none"
          style={[
            styles.measure,
            {
              fontSize,
              fontWeight: box.bold ? '700' : '400',
              fontStyle: box.italic ? 'italic' : 'normal',
              maxWidth: maxMeasureWidth,
              width: box.widthLocked ? width - 16 : undefined,
            },
          ]}
          onTextLayout={(event) => {
            if (!box.text) {
              return;
            }
            const lines = event.nativeEvent.lines;
            if (lines.length === 0) {
              return;
            }
            const contentW = Math.max(...lines.map((line) => line.width), 40) + 20;
            const contentH = lines.reduce((sum, line) => sum + line.height, 0) + 16;
            const next = grownTextBox(box, contentW, contentH, pageWidth, pageHeight);
            if (
              Math.abs(next.width - box.width) > 0.008 ||
              Math.abs(next.height - box.height) > 0.008
            ) {
              onChange(next);
            }
          }}
        >
          {box.text.length > 0 ? box.text : ' '}
        </Text>
        <TextInput
          ref={inputRef}
          value={box.text}
          onChangeText={(text) => onChange({ text })}
          onFocus={() => {
            onSelect();
            setEditing(true);
          }}
          onBlur={() => setEditing(false)}
          editable={enabled && selected}
          pointerEvents={enabled && selected && editing ? 'auto' : 'none'}
          multiline
          scrollEnabled={false}
          placeholder="Type a note…"
          placeholderTextColor={colors.muted}
          style={[
            styles.input,
            {
              color: box.color,
              fontSize,
              fontWeight: box.bold ? '700' : '400',
              fontStyle: box.italic ? 'italic' : 'normal',
              minHeight: Math.max(28, height - 8),
            },
          ]}
        />
      </View>
      {enabled && selected
        ? HANDLES.map((handle) => (
            <View
              key={handle}
              collapsable={false}
              style={[styles.resizeHit, handleStyle(handle)]}
              {...resizeFor[handle].panHandlers}
              accessibilityLabel={`Resize ${handle}`}
            >
              <View style={styles.resizeDot} />
            </View>
          ))
        : null}
    </View>
  );
}

function handleStyle(handle: ResizeHandle) {
  const style: Record<string, number | string> = {};
  if (handle.includes('n')) {
    style.top = -10;
  }
  if (handle.includes('s')) {
    style.bottom = -10;
  }
  if (handle.includes('w')) {
    style.left = -10;
  }
  if (handle.includes('e')) {
    style.right = -10;
  }
  if (handle === 'n' || handle === 's') {
    style.left = '50%';
    style.marginLeft = -10;
  }
  if (handle === 'e' || handle === 'w') {
    style.top = '50%';
    style.marginTop = -10;
  }
  return style;
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFill,
    zIndex: 2,
  },
  wrap: {
    position: 'absolute',
  },
  box: {
    backgroundColor: 'rgba(255, 253, 248, 0.86)',
    borderWidth: 1.5,
    borderRadius: radii.button,
  },
  handleRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -36,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(31, 77, 74, 0.92)',
    borderRadius: radii.button,
  },
  handle: {
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
    paddingLeft: 10,
  },
  handleMark: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    textAlignVertical: 'top',
  },
  measure: {
    position: 'absolute',
    opacity: 0,
    left: 8,
    top: 6,
  },
  remove: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeLabel: {
    color: colors.cream,
    fontSize: 20,
    lineHeight: 22,
    fontWeight: '600',
  },
  resizeHit: {
    position: 'absolute',
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  resizeDot: {
    width: 9,
    height: 9,
    borderRadius: 2,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.teal,
  },
});
