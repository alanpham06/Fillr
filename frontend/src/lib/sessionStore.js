const KEY = "steelhacks.sessions.v1";

export function listSessions() {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSession(id) {
  return listSessions().find((session) => session.id === id) || null;
}

export function upsertSession(partial) {
  if (!partial?.id) {
    return null;
  }
  const sessions = listSessions();
  const next = {
    ...partial,
    updatedAt: Date.now(),
  };
  const index = sessions.findIndex((session) => session.id === next.id);
  if (index >= 0) {
    sessions[index] = { ...sessions[index], ...next };
  } else {
    sessions.unshift(next);
  }
  sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  window.localStorage.setItem(KEY, JSON.stringify(sessions));
  return next;
}

export function deleteSession(id) {
  const sessions = listSessions().filter((session) => session.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(sessions));
}
