import { normalizeWorkspacePages } from "./workspaceTypes.js";

const PREFIX = "steelhacks.workspace.v1.";

export function workspaceStorageKey(kind, id) {
  return `${PREFIX}${kind}.${id}`;
}

export function loadWorkspace(kind, id) {
  const raw = window.localStorage.getItem(workspaceStorageKey(kind, id));
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
      return null;
    }
    if (!parsed.pages || typeof parsed.pages !== "object") {
      return null;
    }
    return { version: 1, pages: normalizeWorkspacePages(parsed.pages) };
  } catch {
    return null;
  }
}

export function saveWorkspace(kind, id, data) {
  window.localStorage.setItem(workspaceStorageKey(kind, id), JSON.stringify(data));
}
