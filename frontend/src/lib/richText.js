export function normalizeRuns(runs) {
  if (!Array.isArray(runs) || runs.length === 0) {
    return [];
  }
  const merged = [];
  for (const run of runs) {
    const text = typeof run?.text === "string" ? run.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n") : "";
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

export function plainTextFromRuns(runs) {
  return normalizeRuns(runs)
    .map((run) => run.text)
    .join("");
}

export function runsFromBox(box) {
  if (!box) {
    return [];
  }
  if (Array.isArray(box.runs) && box.runs.length > 0) {
    return normalizeRuns(box.runs);
  }
  const text = typeof box.text === "string" ? box.text : "";
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

export function styleAt(runs, index) {
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

function splitRunsAt(runs, offset) {
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

export function sliceRuns(runs, start, end) {
  if (end <= start) {
    return [];
  }
  const [, rest] = splitRunsAt(runs, start);
  const [middle] = splitRunsAt(rest, end - start);
  return middle;
}

export function rangeHasStyle(runs, start, end, style) {
  if (end <= start) {
    return false;
  }
  const middle = sliceRuns(runs, start, end);
  return middle.length > 0 && middle.every((run) => Boolean(run[style]));
}

export function applyStyleToRange(runs, start, end, style, value) {
  if (end <= start || (style !== "bold" && style !== "italic")) {
    return normalizeRuns(runs);
  }
  const [before, rest] = splitRunsAt(runs, start);
  const [middle, after] = splitRunsAt(rest, end - start);
  const styled = middle.map((run) => ({ ...run, [style]: Boolean(value) }));
  return normalizeRuns([...before, ...styled, ...after]);
}

export function toggleStyleInRange(runs, start, end, style) {
  if (end <= start) {
    return normalizeRuns(runs);
  }
  const nextValue = !rangeHasStyle(runs, start, end, style);
  return applyStyleToRange(runs, start, end, style, nextValue);
}

export function selectionFormat(runs, start, end) {
  const hasSelection = Number(end) > Number(start);
  return {
    hasSelection,
    bold: hasSelection && rangeHasStyle(runs, start, end, "bold"),
    italic: hasSelection && rangeHasStyle(runs, start, end, "italic"),
  };
}

export function deleteRange(runs, start, end) {
  if (end <= start) {
    return normalizeRuns(runs);
  }
  const [before, rest] = splitRunsAt(runs, start);
  const [, after] = splitRunsAt(rest, end - start);
  return normalizeRuns([...before, ...after]);
}

export function insertText(runs, index, text, style) {
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

export function diffPlainText(oldText, newText) {
  const previous = typeof oldText === "string" ? oldText : "";
  const next = typeof newText === "string" ? newText : "";
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

function inheritInsertStyle(runs, index) {
  if (index <= 0) {
    return styleAt(runs, 0);
  }
  return styleAt(runs, index - 1);
}

export function applyPlainTextChange(runs, oldText, newText) {
  const { start, deleteEnd, insert } = diffPlainText(oldText, newText);
  const style = deleteEnd > start ? styleAt(runs, start) : inheritInsertStyle(runs, start);
  return insertText(deleteRange(runs, start, deleteEnd), start, insert, style);
}

export function mergeTextBox(box, patch) {
  const next = { ...box, ...patch };
  if (Array.isArray(patch.runs)) {
    const runs = normalizeRuns(patch.runs);
    next.runs = runs;
    next.text = plainTextFromRuns(runs);
    delete next.bold;
    delete next.italic;
    return next;
  }
  if (typeof patch.text === "string" && patch.text !== box.text) {
    const runs = applyPlainTextChange(runsFromBox(box), box.text || "", patch.text);
    next.runs = runs;
    next.text = patch.text;
    delete next.bold;
    delete next.italic;
  }
  return next;
}

export function normalizeTextBox(box) {
  const runs = runsFromBox(box);
  const { bold, italic, ...rest } = box;
  return {
    ...rest,
    runs,
    text: plainTextFromRuns(runs),
  };
}

export function exportTextPayload(box) {
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

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function htmlFromRuns(runs) {
  return normalizeRuns(runs)
    .map((run) => {
      const style = [];
      if (run.bold) {
        style.push("font-weight:700");
      }
      if (run.italic) {
        style.push("font-style:italic");
      }
      const attr = style.length ? ` style="${style.join(";")}"` : "";
      return run.text.split("\n").map((part, index, parts) => {
        const span = part ? `<span${attr}>${escapeHtml(part)}</span>` : "";
        return index < parts.length - 1 ? `${span}<br>` : span;
      }).join("");
    })
    .join("");
}

function flagsFromElement(node, root) {
  let bold = false;
  let italic = false;
  let current = node;
  while (current && current !== root.parentNode) {
    if (current.nodeType === 1) {
      const tag = current.tagName;
      if (tag === "B" || tag === "STRONG") {
        bold = true;
      }
      if (tag === "I" || tag === "EM") {
        italic = true;
      }
      const weight = current.style?.fontWeight;
      const fontStyle = current.style?.fontStyle;
      if (weight === "bold" || weight === "700" || Number(weight) >= 600) {
        bold = true;
      }
      if (fontStyle === "italic" || fontStyle === "oblique") {
        italic = true;
      }
    }
    if (current === root) {
      break;
    }
    current = current.parentNode;
  }
  return { bold, italic };
}

function isBlockElement(node) {
  return node.nodeType === 1 && (node.tagName === "DIV" || node.tagName === "P");
}

export function runsFromElement(root) {
  if (!root) {
    return [];
  }
  if (!root.textContent) {
    return [];
  }
  const runs = [];
  function push(text, bold, italic) {
    if (!text) {
      return;
    }
    const last = runs[runs.length - 1];
    if (last && last.bold === bold && last.italic === italic) {
      last.text += text;
    } else {
      runs.push({ text, bold, italic });
    }
  }
  function walk(node, bold, italic) {
    if (node.nodeType === 3) {
      push(node.nodeValue.replace(/\u00a0/g, " "), bold, italic);
      return;
    }
    if (node.nodeType !== 1) {
      return;
    }
    const flags = flagsFromElement(node, root);
    const nextBold = bold || flags.bold;
    const nextItalic = italic || flags.italic;
    if (node.tagName === "BR") {
      push("\n", nextBold, nextItalic);
      return;
    }
    const children = Array.from(node.childNodes);
    children.forEach((child, index) => {
      if (index > 0 && isBlockElement(child)) {
        push("\n", nextBold, nextItalic);
      }
      walk(child, nextBold, nextItalic);
    });
  }
  walk(root, false, false);
  return normalizeRuns(runs);
}

function isEditorNode(root, node) {
  return node === root || root.contains(node);
}

export function getSelectionOffsets(root) {
  if (!root || typeof window === "undefined") {
    return { start: 0, end: 0 };
  }
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { start: 0, end: 0 };
  }
  const range = selection.getRangeAt(0);
  if (!isEditorNode(root, range.startContainer) || !isEditorNode(root, range.endContainer)) {
    return { start: 0, end: 0 };
  }
  const start = offsetInEditor(root, range.startContainer, range.startOffset);
  const end = offsetInEditor(root, range.endContainer, range.endOffset);
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function offsetInEditor(root, container, offset) {
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(container, offset);
  } catch {
    return root.textContent?.length ?? 0;
  }
  const fragment = range.cloneContents();
  return range.toString().length + fragment.querySelectorAll("br").length;
}

function pointFromOffset(root, target) {
  let remaining = Math.max(0, target);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while ((node = walker.nextNode())) {
    if (node.nodeType === 3) {
      if (remaining <= node.nodeValue.length) {
        return { node, offset: remaining };
      }
      remaining -= node.nodeValue.length;
    } else if (node.tagName === "BR") {
      if (remaining === 0) {
        return { node: node.parentNode, offset: Array.from(node.parentNode.childNodes).indexOf(node) };
      }
      remaining -= 1;
    }
  }
  return { node: root, offset: root.childNodes.length };
}

export function setSelectionOffsets(root, start, end) {
  if (!root || typeof window === "undefined") {
    return;
  }
  const from = pointFromOffset(root, start);
  const to = pointFromOffset(root, end);
  const range = document.createRange();
  try {
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
  } catch {
    return;
  }
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
