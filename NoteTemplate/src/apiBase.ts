import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'steelhacks.apiBase';

export const DEFAULT_API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000'
).replace(/\/$/, '');

let current = DEFAULT_API_BASE;
const listeners = new Set<(url: string) => void>();

export function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/$/, '');
}

export function getApiBase(): string {
  return current;
}

export function subscribeApiBase(listener: (url: string) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(url: string) {
  current = url;
  listeners.forEach((listener) => listener(url));
}

export async function loadApiBase(): Promise<string> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    publish(normalizeApiBase(stored));
  }
  return current;
}

export async function saveApiBase(url: string): Promise<string> {
  const next = normalizeApiBase(url) || DEFAULT_API_BASE;
  await AsyncStorage.setItem(STORAGE_KEY, next);
  publish(next);
  return next;
}
