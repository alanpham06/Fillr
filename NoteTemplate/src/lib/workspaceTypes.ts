import { clamp } from './geometry';
import type { Point } from './smoothPath';

export type WorkspaceKind = 'source' | 'template' | 'filled';

export type WorkspaceDoc = {
  kind: WorkspaceKind;
  id: string;
  title: string;
  filename: string;
  pageCount: number;
};

export type StrokeTool = 'pen' | 'highlighter';
export type DrawTool = StrokeTool | 'eraser';

export type WorkspaceStroke = {
  id: string;
  points: Point[];
  color: string;
  width: number;
  tool?: StrokeTool;
  opacity?: number;
};

export type WorkspaceTextBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  widthLocked?: boolean;
};

export type WorkspacePage = {
  strokes: WorkspaceStroke[];
  texts: WorkspaceTextBox[];
};

export type SavedWorkspace = {
  version: 1;
  pages: Record<string, WorkspacePage>;
};

export type EditorMode = 'write' | 'type';
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const INK_COLORS = {
  Black: '#111111',
  Gray: '#6B7280',
  Red: '#E53935',
  Orange: '#FB8C00',
  Yellow: '#F4C430',
  Green: '#43A047',
  Blue: '#1E88E5',
  Purple: '#8E24AA',
  Pink: '#EC407A',
} as const;

export type InkColorName = keyof typeof INK_COLORS;

export const COLOR_ORDER: InkColorName[] = [
  'Black',
  'Gray',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Blue',
  'Purple',
  'Pink',
];

export const DRAW_TOOLS: DrawTool[] = ['pen', 'highlighter', 'eraser'];
export const DRAW_TOOL_LABELS: Record<DrawTool, string> = {
  pen: 'Pen',
  highlighter: 'Highlight',
  eraser: 'Eraser',
};

export const PAGE_HEIGHT_PT = 792;
export const MIN_FONT_PT = 5;
export const MAX_FONT_PT = 64;
export const DEFAULT_FONT_PT = 14;

export const PAGE_WIDTH_PT = 612;
export const STROKE_LIMITS: Record<DrawTool, { min: number; max: number; default: number; step: number }> = {
  pen: { min: 0.5, max: 8, default: 1.25, step: 0.25 },
  highlighter: { min: 4, max: 36, default: 12, step: 1 },
  eraser: { min: 4, max: 40, default: 10, step: 1 },
};
export const HIGHLIGHTER_OPACITY = 0.38;
export const ERASER_RADIUS_PX = 8;
export const DEFAULT_TOOL_SIZES: Record<DrawTool, number> = {
  pen: STROKE_LIMITS.pen.default,
  highlighter: STROKE_LIMITS.highlighter.default,
  eraser: STROKE_LIMITS.eraser.default,
};

export function clampStrokePt(tool: DrawTool, pt: number): number {
  const range = STROKE_LIMITS[tool];
  const value = Number(pt);
  const raw = Number.isFinite(value) ? value : range.default;
  const snapped = Math.round(raw / range.step) * range.step;
  return clamp(Number(snapped.toFixed(2)), range.min, range.max);
}

export function strokePtToNorm(pt: number): number {
  return Math.max(Number(pt) || 0, 0.25) / PAGE_WIDTH_PT;
}

export function strokePtToScreenPx(pt: number, pageWidthPx: number): number {
  return strokePtToNorm(pt) * Math.max(pageWidthPx, 1);
}

export const PAGE_MARGIN = 0.02;
export const MIN_TEXT_WIDTH = 0.16;
export const MAX_TEXT_WIDTH = 1 - PAGE_MARGIN * 2;
export const MIN_TEXT_HEIGHT = 0.045;
export const DEFAULT_TEXT_WIDTH = 0.2;
export const DEFAULT_TEXT_HEIGHT = 0.055;
export const DEFAULT_FONT_SIZE = DEFAULT_FONT_PT / PAGE_HEIGHT_PT;

export function fontSizeToPt(size: number): number {
  return clamp(Math.round((size || DEFAULT_FONT_SIZE) * PAGE_HEIGHT_PT), MIN_FONT_PT, MAX_FONT_PT);
}

export function ptToFontSize(pt: number): number {
  return clamp(Math.round(Number(pt) || DEFAULT_FONT_PT), MIN_FONT_PT, MAX_FONT_PT) / PAGE_HEIGHT_PT;
}

export function emptyPage(): WorkspacePage {
  return { strokes: [], texts: [] };
}

export function pageHasInk(page: WorkspacePage | undefined): boolean {
  if (!page) {
    return false;
  }
  return page.strokes.length > 0 || page.texts.some((box) => box.text.trim().length > 0);
}

export function strokeTool(stroke: WorkspaceStroke): StrokeTool {
  return stroke.tool === 'highlighter' ? 'highlighter' : 'pen';
}

export function strokeOpacity(stroke: WorkspaceStroke): number {
  if (typeof stroke.opacity === 'number') {
    return stroke.opacity;
  }
  return strokeTool(stroke) === 'highlighter' ? HIGHLIGHTER_OPACITY : 1;
}

export function clampTextBox(box: Pick<WorkspaceTextBox, 'x' | 'y' | 'width' | 'height'>): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
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

export function placedTextBox(x: number, y: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return clampTextBox({
    x,
    y,
    width: DEFAULT_TEXT_WIDTH,
    height: DEFAULT_TEXT_HEIGHT,
  });
}

export function grownTextBox(
  box: WorkspaceTextBox,
  contentWidthPx: number,
  contentHeightPx: number,
  pageWidth: number,
  pageHeight: number,
): Pick<WorkspaceTextBox, 'width' | 'height'> {
  const maxW = Math.min(MAX_TEXT_WIDTH, 1 - PAGE_MARGIN - box.x);
  const width = box.widthLocked
    ? clamp(box.width, MIN_TEXT_WIDTH, maxW)
    : clamp(contentWidthPx / Math.max(pageWidth, 1), MIN_TEXT_WIDTH, maxW);
  const maxH = 1 - PAGE_MARGIN - box.y;
  const contentH = clamp(contentHeightPx / Math.max(pageHeight, 1), MIN_TEXT_HEIGHT, maxH);
  const height = box.widthLocked ? Math.min(maxH, Math.max(box.height, contentH)) : contentH;
  return { width, height };
}

export function resizedTextBox(
  start: Pick<WorkspaceTextBox, 'x' | 'y' | 'width' | 'height'>,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  pageWidth: number,
  pageHeight: number,
): Pick<WorkspaceTextBox, 'x' | 'y' | 'width' | 'height' | 'widthLocked'> {
  let { x, y, width, height } = start;
  const ndx = dx / Math.max(pageWidth, 1);
  const ndy = dy / Math.max(pageHeight, 1);

  if (handle.includes('e')) {
    width += ndx;
  }
  if (handle.includes('w')) {
    width -= ndx;
    x += ndx;
  }
  if (handle.includes('s')) {
    height += ndy;
  }
  if (handle.includes('n')) {
    height -= ndy;
    y += ndy;
  }

  if (width < MIN_TEXT_WIDTH) {
    if (handle.includes('w')) {
      x -= MIN_TEXT_WIDTH - width;
    }
    width = MIN_TEXT_WIDTH;
  }
  if (height < MIN_TEXT_HEIGHT) {
    if (handle.includes('n')) {
      y -= MIN_TEXT_HEIGHT - height;
    }
    height = MIN_TEXT_HEIGHT;
  }

  return { ...clampTextBox({ x, y, width, height }), widthLocked: true };
}
