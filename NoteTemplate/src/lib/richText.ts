export type TextStyleFlag = 'bold' | 'italic';

export type StyledRun = {
  text: string;
  bold: boolean;
  italic: boolean;
};

export type TextBoxLike = {
  text?: string;
  runs?: StyledRun[] | null;
  bold?: boolean;
  italic?: boolean;
};

export function normalizeRuns(runs: StyledRun[] | null | undefined): StyledRun[] {
  if (!Array.isArray(runs) || runs.length === 0) {
    return [];
  }
  const merged: StyledRun[] = [];
  for (const run of runs) {
    const text = typeof run?.text === 'string' ? run.text.replace(/\r\n/g, '\n').replace(/\r/g, '\n') : '';
    if (!text) {
      continue;
    }
    const next = {
      text,
      bold: Boolean(run.bold),
      italic: Boolean(run.italic),
    };
    const last = merged[merged.length - 1];
    if (last && last.bold === next.bold && last.italic === next.italic) {
      last.text += next.text;
    } else {
      merged.push(next);
    }
  }
  return merged;
}

export function plainTextFromRuns(runs: StyledRun[] | null | undefined): string {
  return normalizeRuns(runs)
    .map((run) => run.text)
    .join('');
}

export function runsFromBox(box: TextBoxLike | null | undefined): StyledRun[] {
  if (!box) {
    return [];
  }
  if (Array.isArray(box.runs) && box.runs.length > 0) {
    return normalizeRuns(box.runs);
  }
  const text = typeof box.text === 'string' ? box.text : '';
  if (!text) {
    return [];
  }
  return [
    {
      text,
      bold: Boolean(box.bold),
      italic: Boolean(box.italic),
    },
  ];
}

export function styleAt(runs: StyledRun[], index: number): { bold: boolean; italic: boolean } {
  const fallback = { bold: false, italic: false };
  const list = normalizeRuns(runs);
  if (list.length === 0) {
    return fallback;
  }
  let cursor = 0;
  for (const run of list) {
    const next = cursor + run.text.length;
    if (index <= next && (index > cursor || cursor === 0)) {
      return { bold: run.bold, italic: run.italic };
    }
    cursor = next;
  }
  const last = list[list.length - 1];
  return { bold: last.bold, italic: last.italic };
}

function splitRunsAt(runs: StyledRun[], offset: number): [StyledRun[], StyledRun[]] {
  const list = normalizeRuns(runs);
  const clamped = Math.max(0, Math.min(offset, plainTextFromRuns(list).length));
  if (clamped <= 0) {
    return [[], list];
  }
  let cursor = 0;
  for (let index = 0; index < list.length; index += 1) {
    const run = list[index];
    const next = cursor + run.text.length;
    if (clamped < next) {
      const inner = clamped - cursor;
      const left = { ...run, text: run.text.slice(0, inner) };
      const right = { ...run, text: run.text.slice(inner) };
      return [[...list.slice(0, index), left], [right, ...list.slice(index + 1)]];
    }
    if (clamped === next) {
      return [list.slice(0, index + 1), list.slice(index + 1)];
    }
    cursor = next;
  }
  return [list, []];
}

export function sliceRuns(runs: StyledRun[], start: number, end: number): StyledRun[] {
  if (end <= start) {
    return [];
  }
  const [, rest] = splitRunsAt(runs, start);
  const [middle] = splitRunsAt(rest, end - start);
  return middle;
}

export function rangeHasStyle(runs: StyledRun[], start: number, end: number, style: TextStyleFlag): boolean {
  if (end <= start) {
    return false;
  }
  const middle = sliceRuns(runs, start, end);
  return middle.length > 0 && middle.every((run) => Boolean(run[style]));
}

export function applyStyleToRange(
  runs: StyledRun[],
  start: number,
  end: number,
  style: TextStyleFlag,
  value: boolean,
): StyledRun[] {
  if (end <= start || (style !== 'bold' && style !== 'italic')) {
    return normalizeRuns(runs);
  }
  const [before, rest] = splitRunsAt(runs, start);
  const [middle, after] = splitRunsAt(rest, end - start);
  const styled = middle.map((run) => ({ ...run, [style]: Boolean(value) }));
  return normalizeRuns([...before, ...styled, ...after]);
}

export function toggleStyleInRange(runs: StyledRun[], start: number, end: number, style: TextStyleFlag): StyledRun[] {
  if (end <= start) {
    return normalizeRuns(runs);
  }
  const nextValue = !rangeHasStyle(runs, start, end, style);
  return applyStyleToRange(runs, start, end, style, nextValue);
}

export function selectionFormat(runs: StyledRun[], start: number, end: number): {
  hasSelection: boolean;
  bold: boolean;
  italic: boolean;
} {
  const hasSelection = Number(end) > Number(start);
  return {
    hasSelection,
    bold: hasSelection && rangeHasStyle(runs, start, end, 'bold'),
    italic: hasSelection && rangeHasStyle(runs, start, end, 'italic'),
  };
}

export function deleteRange(runs: StyledRun[], start: number, end: number): StyledRun[] {
  if (end <= start) {
    return normalizeRuns(runs);
  }
  const [before, rest] = splitRunsAt(runs, start);
  const [, after] = splitRunsAt(rest, end - start);
  return normalizeRuns([...before, ...after]);
}

export function insertText(
  runs: StyledRun[],
  index: number,
  text: string,
  style?: { bold?: boolean; italic?: boolean },
): StyledRun[] {
  if (!text) {
    return normalizeRuns(runs);
  }
  const [before, after] = splitRunsAt(runs, index);
  return normalizeRuns([
    ...before,
    {
      text,
      bold: Boolean(style?.bold),
      italic: Boolean(style?.italic),
    },
    ...after,
  ]);
}

export function diffPlainText(oldText: string, newText: string): {
  start: number;
  deleteEnd: number;
  insert: string;
} {
  const previous = typeof oldText === 'string' ? oldText : '';
  const next = typeof newText === 'string' ? newText : '';
  let start = 0;
  const maxStart = Math.min(previous.length, next.length);
  while (start < maxStart && previous.charCodeAt(start) === next.charCodeAt(start)) {
    start += 1;
  }
  let oldEnd = previous.length;
  let newEnd = next.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    previous.charCodeAt(oldEnd - 1) === next.charCodeAt(newEnd - 1)
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }
  return { start, deleteEnd: oldEnd, insert: next.slice(start, newEnd) };
}

function inheritInsertStyle(runs: StyledRun[], index: number): { bold: boolean; italic: boolean } {
  if (index <= 0) {
    return styleAt(runs, 0);
  }
  return styleAt(runs, index - 1);
}

export function applyPlainTextChange(runs: StyledRun[], oldText: string, newText: string): StyledRun[] {
  const { start, deleteEnd, insert } = diffPlainText(oldText, newText);
  const style = deleteEnd > start ? styleAt(runs, start) : inheritInsertStyle(runs, start);
  return insertText(deleteRange(runs, start, deleteEnd), start, insert, style);
}

export function mergeTextBox<T extends TextBoxLike>(box: T, patch: Partial<T>): T {
  const next = { ...box, ...patch };
  if (Array.isArray(patch.runs)) {
    const runs = normalizeRuns(patch.runs);
    next.runs = runs;
    next.text = plainTextFromRuns(runs);
    delete (next as TextBoxLike).bold;
    delete (next as TextBoxLike).italic;
    return next;
  }
  if (typeof patch.text === 'string' && patch.text !== box.text) {
    const runs = applyPlainTextChange(runsFromBox(box), box.text || '', patch.text);
    next.runs = runs;
    next.text = patch.text;
    delete (next as TextBoxLike).bold;
    delete (next as TextBoxLike).italic;
  }
  return next;
}

export function normalizeTextBox<T extends TextBoxLike>(box: T): T {
  const runs = runsFromBox(box);
  const { bold, italic, ...rest } = box;
  return {
    ...(rest as T),
    runs,
    text: plainTextFromRuns(runs),
  };
}

export function exportTextPayload(box: TextBoxLike): {
  text: string;
  runs: StyledRun[];
} {
  const runs = runsFromBox(box);
  return {
    text: plainTextFromRuns(runs),
    runs: runs.map((run) => ({
      text: run.text,
      bold: run.bold,
      italic: run.italic,
    })),
  };
}
