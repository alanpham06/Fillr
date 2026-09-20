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
export type FontSizeName = 'S' | 'M' | 'L';
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

export const FONT_SIZES: Record<FontSizeName, number> = {
  S: 0.018,
  M: 0.024,
  L: 0.032,
};
export const FONT_SIZE_ORDER: FontSizeName[] = ['S', 'M', 'L'];

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

export function fontSizeName(size: number): FontSizeName {
  let best: FontSizeName = 'M';
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
