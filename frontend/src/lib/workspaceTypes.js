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

export const FONT_SIZES = {
  S: 0.018,
  M: 0.024,
  L: 0.032,
};
export const FONT_SIZE_ORDER = ["S", "M", "L"];

export const PEN_WIDTH_PX = 5;
export const HIGHLIGHTER_WIDTH_PX = 22;
export const HIGHLIGHTER_OPACITY = 0.38;
export const ERASER_RADIUS_PX = 18;

export const PAGE_MARGIN = 0.02;
export const MIN_TEXT_WIDTH = 0.16;
export const MAX_TEXT_WIDTH = 1 - PAGE_MARGIN * 2;
export const MIN_TEXT_HEIGHT = 0.045;
export const DEFAULT_TEXT_WIDTH = 0.2;
export const DEFAULT_TEXT_HEIGHT = 0.055;
export const DEFAULT_FONT_SIZE = FONT_SIZES.M;

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

export function fontSizeName(size) {
  let best = "M";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const name of FONT_SIZE_ORDER) {
    const distance = Math.abs(FONT_SIZES[name] - size);
    if (distance < bestDist) {
      best = name;
      bestDist = distance;
    }
  }
  return best;
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
