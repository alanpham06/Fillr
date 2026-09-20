import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clamp } from "../lib/geometry.js";
import {
  PAGE_MARGIN,
  grownTextBox,
  resizedTextBox,
} from "../lib/workspaceTypes.js";

const HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function movedBox(start, box, dx, dy, pageWidth, pageHeight) {
  const maxX = Math.max(PAGE_MARGIN, 1 - PAGE_MARGIN - box.width);
  const maxY = Math.max(PAGE_MARGIN, 1 - PAGE_MARGIN - box.height);
  return {
    x: clamp(start.x + dx / pageWidth, PAGE_MARGIN, maxX),
    y: clamp(start.y + dy / pageHeight, PAGE_MARGIN, maxY),
  };
}

export default function TextBoxLayer({
  boxes,
  selectedId,
  enabled,
  pageWidth,
  pageHeight,
  onSelect,
  onChange,
  onRemove,
  onPlace,
}) {
  const ignorePlace = useRef(false);

  if (pageWidth <= 0 || pageHeight <= 0) {
    return null;
  }

  function handlePlace(event) {
    if (!enabled || event.target !== event.currentTarget) {
      return;
    }
    if (ignorePlace.current) {
      ignorePlace.current = false;
      return;
    }
    const bounds = event.currentTarget.getBoundingClientRect();
    onPlace(
      clamp((event.clientX - bounds.left) / pageWidth, 0, 0.95),
      clamp((event.clientY - bounds.top) / pageHeight, 0, 0.95),
    );
  }

  return (
    <div
      className={`text-layer${enabled ? " is-live" : ""}`}
      onClick={handlePlace}
    >
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
    </div>
  );
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
}) {
  const boxRef = useRef(box);
  const startRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const dragOrigin = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const resizing = useRef(null);
  const inputRef = useRef(null);
  const mirrorRef = useRef(null);
  const [editing, setEditing] = useState(selected && box.text.length === 0);

  boxRef.current = box;

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

  useLayoutEffect(() => {
    const el = mirrorRef.current;
    if (!el || !box.text) {
      return;
    }
    const next = grownTextBox(box, el.offsetWidth + 18, el.offsetHeight + 20, pageWidth, pageHeight);
    if (Math.abs(next.width - box.width) > 0.008 || Math.abs(next.height - box.height) > 0.008) {
      onChange(next);
    }
  }, [box, onChange, pageHeight, pageWidth]);

  function beginMove(event) {
    if (!enabled || event.button > 0) {
      return;
    }
    dragging.current = true;
    startRef.current = {
      x: boxRef.current.x,
      y: boxRef.current.y,
      width: boxRef.current.width,
      height: boxRef.current.height,
    };
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    onSelect();
    setEditing(false);
    inputRef.current?.blur();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function beginResize(handle, event) {
    if (!enabled || event.button > 0) {
      return;
    }
    resizing.current = handle;
    startRef.current = {
      x: boxRef.current.x,
      y: boxRef.current.y,
      width: boxRef.current.width,
      height: boxRef.current.height,
    };
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    onSelect();
    setEditing(false);
    inputRef.current?.blur();
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }

  function movePointer(event) {
    const dx = event.clientX - dragOrigin.current.x;
    const dy = event.clientY - dragOrigin.current.y;
    if (resizing.current) {
      onChange(resizedTextBox(startRef.current, resizing.current, dx, dy, pageWidth, pageHeight));
      return;
    }
    if (!dragging.current) {
      return;
    }
    onChange(movedBox(startRef.current, boxRef.current, dx, dy, pageWidth, pageHeight));
  }

  function endPointer(event) {
    const dx = event.clientX - dragOrigin.current.x;
    const dy = event.clientY - dragOrigin.current.y;
    const wasResize = Boolean(resizing.current);
    const wasDrag = dragging.current;
    resizing.current = null;
    dragging.current = false;
    if (wasResize) {
      return;
    }
    if (wasDrag && Math.abs(dx) < 6 && Math.abs(dy) < 6 && event.currentTarget.dataset.role !== "handle") {
      setEditing(true);
    }
  }

  function handleBoxPointerDown(event) {
    if (!enabled || event.button > 0 || editing) {
      return;
    }
    beginMove(event);
  }

  const left = box.x * pageWidth;
  const top = box.y * pageHeight;
  const width = Math.max(80, box.width * pageWidth);
  const height = Math.max(28, box.height * pageHeight);
  const fontSize = Math.max(12, box.fontSize * pageHeight);
  const maxMeasureWidth = Math.max(80, (1 - PAGE_MARGIN - box.x) * pageWidth - 16);

  return (
    <div
      className={`text-box${selected ? " is-selected" : ""}`}
      style={{ left, top, width, minHeight: height }}
      onPointerDown={handleBoxPointerDown}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onClick={(event) => event.stopPropagation()}
    >
      {enabled && selected ? (
        <div className="text-box-handle-row">
          <div
            className="text-box-handle"
            data-role="handle"
            onPointerDown={beginMove}
            onPointerMove={movePointer}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
          >
            <span>⠿ Move</span>
          </div>
          <button
            type="button"
            className="text-box-remove"
            aria-label="Delete text box"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <div
        ref={mirrorRef}
        className="text-box-mirror"
        aria-hidden
        style={{
          fontSize,
          fontWeight: box.bold ? 700 : 400,
          fontStyle: box.italic ? "italic" : "normal",
          maxWidth: maxMeasureWidth,
          width: box.widthLocked ? width - 16 : "max-content",
        }}
      >
        {box.text || " "}
      </div>
      <textarea
        ref={inputRef}
        className="text-box-input"
        value={box.text}
        placeholder="Type a note…"
        readOnly={!enabled || !selected}
        onChange={(event) => onChange({ text: event.target.value })}
        onFocus={() => {
          onSelect();
          setEditing(true);
        }}
        onBlur={() => setEditing(false)}
        style={{
          color: box.color,
          fontSize,
          fontWeight: box.bold ? 700 : 400,
          fontStyle: box.italic ? "italic" : "normal",
          minHeight: Math.max(28, height - 8),
          pointerEvents: enabled && selected && editing ? "auto" : "none",
        }}
      />
      {enabled && selected
        ? HANDLES.map((handle) => (
            <div
              key={handle}
              className={`text-box-resize text-box-resize-${handle}`}
              onPointerDown={(event) => beginResize(handle, event)}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            />
          ))
        : null}
    </div>
  );
}
