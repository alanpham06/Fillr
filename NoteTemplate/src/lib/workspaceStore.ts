import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedWorkspace, WorkspaceKind } from './workspaceTypes';

const PREFIX = 'steelhacks.workspace.v1.';

export function workspaceStorageKey(kind: WorkspaceKind, id: string): string {
  return `${PREFIX}${kind}.${id}`;
}

export async function loadWorkspace(
  kind: WorkspaceKind,
  id: string,
): Promise<SavedWorkspace | null> {
  const raw = await AsyncStorage.getItem(workspaceStorageKey(kind, id));
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || (parsed as SavedWorkspace).version !== 1) {
      return null;
    }
    const pages = (parsed as SavedWorkspace).pages;
    if (!pages || typeof pages !== 'object') {
      return null;
    }
    return { version: 1, pages };
  } catch {
    return null;
  }
}

export async function saveWorkspace(
  kind: WorkspaceKind,
  id: string,
  data: SavedWorkspace,
): Promise<void> {
  await AsyncStorage.setItem(workspaceStorageKey(kind, id), JSON.stringify(data));
}
