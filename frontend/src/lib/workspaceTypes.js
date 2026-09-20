import { clamp } from "./geometry.js";

export const INK_COLORS = {
  Black: "#111111",
  Gray: "#6B7280",
  Red: "#E53935",
  Orange: "#FB8C00",
  Yellow: "#F4C430",
  Green: "#43A047",
  Blue: "#1E88E5",
  Purple: "#8E24AA",
  Pink: "#EC407A",
};

export const COLOR_ORDER = [
  "Black",
  "Gray",
  "Red",
  "Orange",
  "Yellow",
  "Green",
  "Blue",
  "Purple",
  "Pink",
];

export const DRAW_TOOLS = ["pen", "highlighter", "eraser"];
export const DRAW_TOOL_LABELS = {
  pen: "Pen",
  highlighter: "Highlight",
  eraser: "Eraser",
};

export const PAGE_HEIGHT_PT = 792;
export const MIN_FONT_PT = 5;
export const MAX_FONT_PT = 64;
export const DEFAULT_FONT_PT = 14;

export const PAGE_WIDTH_PT = 612;
export const STROKE_LIMITS = {
  pen: { min: 0.5, max: 8, default: 1.25, step: 0.25 },
  highlighter: { min: 4, max: 36, default: 12, step: 1 },
  eraser: { min: 4, max: 40, default: 10, step: 1 },
};
export const HIGHLIGHTER_OPACITY = 0.38;
export const ERASER_RADIUS_PX = 8;
export const DEFAULT_TOOL_SIZES = {
  pen: STROKE_LIMITS.pen.default,
  highlighter: STROKE_LIMITS.highlighter.default,
  eraser: STROKE_LIMITS.eraser.default,
};

export function clampStrokePt(tool, pt) {
  const range = STROKE_LIMITS[tool] || STROKE_LIMITS.pen;
  const value = Number(pt);
  const raw = Number.isFinite(value) ? value : range.default;
  const snapped = Math.round(raw / range.step) * range.step;
  return clamp(Number(snapped.toFixed(2)), range.min, range.max);
}

export function strokePtToNorm(pt) {
  return Math.max(Number(pt) || 0, 0.25) / PAGE_WIDTH_PT;
}

export function strokePtToScreenPx(pt, pageWidthPx) {
  return strokePtToNorm(pt) * Math.max(pageWidthPx, 1);
}

export const PAGE_MARGIN = 0.02;
export const MIN_TEXT_WIDTH = 0.16;
export const MAX_TEXT_WIDTH = 1 - PAGE_MARGIN * 2;
export const MIN_TEXT_HEIGHT = 0.045;
export const DEFAULT_TEXT_WIDTH = 0.2;
export const DEFAULT_TEXT_HEIGHT = 0.055;
export const DEFAULT_FONT_SIZE = DEFAULT_FONT_PT / PAGE_HEIGHT_PT;

export function fontSizeToPt(size) {
  return clamp(Math.round((size || DEFAULT_FONT_SIZE) * PAGE_HEIGHT_PT), MIN_FONT_PT, MAX_FONT_PT);
}

export function ptToFontSize(pt) {
  return clamp(Math.round(Number(pt) || DEFAULT_FONT_PT), MIN_FONT_PT, MAX_FONT_PT) / PAGE_HEIGHT_PT;
}

export function emptyPage() {
  return { strokes: [], texts: [] };
}

export function pageHasInk(page) {
  if (!page) {
    return false;
  }
  return page.strokes.length > 0 || page.texts.some((box) => box.text.trim().length > 0);
}

export function strokeTool(stroke) {
  return stroke.tool === "highlighter" ? "highlighter" : "pen";
}

export function strokeOpacity(stroke) {
  if (typeof stroke.opacity === "number") {
    return stroke.opacity;
  }
  return strokeTool(stroke) === "highlighter" ? HIGHLIGHTER_OPACITY : 1;
}

export function clampTextBox(box) {
  const width = clamp(box.width, MIN_TEXT_WIDTH, MAX_TEXT_WIDTH);
  const height = clamp(box.height, MIN_TEXT_HEIGHT, 1 - PAGE_MARGIN * 2);
  const x = clamp(box.x, PAGE_MARGIN, 1 - PAGE_MARGIN - width);
  const y = clamp(box.y, PAGE_MARGIN, 1 - PAGE_MARGIN - height);
  return {
    x,
    y,
    width: Math.min(width, Math.max(MIN_TEXT_WIDTH, 1 - PAGE_MARGIN - x)),
    height: Math.min(height, Math.max(MIN_TEXT_HEIGHT, 1 - PAGE_MARGIN - y)),
  };
}

export function placedTextBox(x, y) {
  return clampTextBox({
    x,
    y,
    width: DEFAULT_TEXT_WIDTH,
    height: DEFAULT_TEXT_HEIGHT,
  });
}

export function grownTextBox(box, contentWidthPx, contentHeightPx, pageWidth, pageHeight) {
  const maxW = Math.min(MAX_TEXT_WIDTH, 1 - PAGE_MARGIN - box.x);
  const width = box.widthLocked
    ? clamp(box.width, MIN_TEXT_WIDTH, maxW)
    : clamp(contentWidthPx / Math.max(pageWidth, 1), MIN_TEXT_WIDTH, maxW);
  const maxH = 1 - PAGE_MARGIN - box.y;
  const contentH = clamp(contentHeightPx / Math.max(pageHeight, 1), MIN_TEXT_HEIGHT, maxH);
  const height = box.widthLocked ? Math.min(maxH, Math.max(box.height, contentH)) : contentH;
  return { width, height };
}

export function resizedTextBox(start, handle, dx, dy, pageWidth, pageHeight) {
  let { x, y, width, height } = start;
  const ndx = dx / Math.max(pageWidth, 1);
  const ndy = dy / Math.max(pageHeight, 1);

  if (handle.includes("e")) {
    width += ndx;
  }
  if (handle.includes("w")) {
    width -= ndx;
    x += ndx;
  }
  if (handle.includes("s")) {
    height += ndy;
  }
  if (handle.includes("n")) {
    height -= ndy;
    y += ndy;
  }

  if (width < MIN_TEXT_WIDTH) {
    if (handle.includes("w")) {
      x -= MIN_TEXT_WIDTH - width;
    }
    width = MIN_TEXT_WIDTH;
  }
  if (height < MIN_TEXT_HEIGHT) {
    if (handle.includes("n")) {
      y -= MIN_TEXT_HEIGHT - height;
    }
    height = MIN_TEXT_HEIGHT;
  }

  return { ...clampTextBox({ x, y, width, height }), widthLocked: true };
}
