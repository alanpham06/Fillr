import * as FileSystem from 'expo-file-system/legacy';
import { getApiBase } from './apiBase';
import type {
  GenerateResponse,
  IngestResponse,
  NotesUploadResponse,
  TemplateSettings,
  UploadFile,
  WorkspaceExportRequest,
  WorkspaceExportResponse,
  WorkspaceKind,
} from './types';

function formatDetail(detail: unknown): string {
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as { msg?: string; detail?: string };
          return record.msg || record.detail || JSON.stringify(item);
        }
        return String(item);
      })
      .join(' ');
  }
  return 'Request failed.';
}

async function readError(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (data && typeof data === 'object' && 'detail' in data) {
      return formatDetail((data as { detail: unknown }).detail) || response.statusText;
    }
    return response.statusText;
  } catch {
    return response.statusText || 'Request failed.';
  }
}

function unreachableMessage(): string {
  return (
    `Cannot reach the API at ${getApiBase()}. ` +
    'On an iPad, localhost is the tablet itself — paste a reachable URL in settings.'
  );
}

function apiHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  // ngrok's free interstitial; harmless on other tunnels.
  headers.set('ngrok-skip-browser-warning', '1');
  headers.set('User-Agent', 'NoteTemplate/1.0 (Expo Go)');
  return headers;
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: apiHeaders(init?.headers),
    });
  } catch {
    throw new Error(unreachableMessage());
  }
}

function safeUploadName(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_') || 'lecture.pdf';
  return /\.(pdf|png|jpe?g|webp)$/i.test(cleaned) ? cleaned : `${cleaned}.pdf`;
}

function errorFromUploadBody(body: string, status: number): string {
  try {
    const data: unknown = JSON.parse(body);
    if (data && typeof data === 'object' && 'detail' in data) {
      return formatDetail((data as { detail: unknown }).detail);
    }
  } catch {
    /* HTML interstitial or empty body */
  }
  if (/cloudflare|just a moment|attention required/i.test(body)) {
    return 'The tunnel blocked the file upload. Try the localhost.run URL, or a smaller PDF.';
  }
  return status ? `Upload failed (HTTP ${status}).` : 'Upload failed.';
}

async function uploadMultipart<T>(path: string, file: UploadFile): Promise<T> {
  const dest = `${FileSystem.cacheDirectory ?? ''}${safeUploadName(file.name)}`;
  if (!dest) {
    throw new Error('No cache directory available for the upload.');
  }
  if (file.uri !== dest) {
    await FileSystem.copyAsync({ from: file.uri, to: dest });
  }

  let result: FileSystem.FileSystemUploadResult;
  try {
    result = await FileSystem.uploadAsync(`${getApiBase()}${path}`, dest, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: file.mimeType,
      headers: { Accept: 'application/json' },
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    });
  } catch {
    throw new Error(
      `${unreachableMessage()} File uploads need a stable tunnel; GET /health can pass while POST still fails.`,
    );
  }

  if (result.status < 200 || result.status >= 300) {
    throw new Error(errorFromUploadBody(result.body, result.status));
  }
  try {
    return JSON.parse(result.body) as T;
  } catch {
    throw new Error('The API did not return JSON after the upload.');
  }
}

function resolveUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return `${getApiBase()}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}


export async function checkHealth(base = getApiBase()): Promise<boolean> {
  const result = await probeHealth(base);
  return result.ok;
}

export async function probeHealth(
  base = getApiBase(),
): Promise<{ ok: boolean; detail: string }> {
  const root = base.replace(/\/$/, '');
  try {
    const response = await fetch(`${root}/health`, {
      headers: apiHeaders(),
    });
    const text = await response.text();
    if (!response.ok) {
      const hint = /cloudflare|just a moment|attention required/i.test(text)
        ? 'Cloudflare blocked the iPad request. Use an ngrok URL instead of trycloudflare.com.'
        : `HTTP ${response.status}`;
      return { ok: false, detail: hint };
    }
    try {
      const data: unknown = JSON.parse(text);
      if (data && typeof data === 'object' && (data as { ok?: boolean }).ok) {
        return { ok: true, detail: `Connected to ${root}` };
      }
    } catch {
      return {
        ok: false,
        detail:
          'Got a web page instead of JSON. That tunnel is showing an interstitial — try ngrok.',
      };
    }
    return { ok: false, detail: 'API responded, but /health was not {"ok": true}.' };
  } catch (err) {
    return {
      ok: false,
      detail:
        err instanceof Error
          ? err.message
          : `Cannot reach ${root}. The tunnel may be down, or the iPad cannot open that host.`,
    };
  }
}

export async function ingest(file: UploadFile): Promise<IngestResponse> {
  return uploadMultipart<IngestResponse>('/ingest', file);
}

export async function generateTemplate(
  sourceId: string,
  settings: TemplateSettings,
): Promise<GenerateResponse> {
  const response = await request(`${getApiBase()}/templates/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_id: sourceId,
      density: settings.density,
      text_size: settings.textSize,
      include_diagrams: settings.includeDiagrams,
      include_code: settings.includeCode,
    }),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<GenerateResponse>;
}

export function sourceFileUrl(sourceId: string): string {
  return `${getApiBase()}/sources/${sourceId}/file`;
}

export function templateFileUrl(templateId: string): string {
  return `${getApiBase()}/templates/${templateId}/file`;
}

export function filledFileUrl(templateId: string): string {
  return `${getApiBase()}/templates/${templateId}/filled`;
}

export function fileUrl(pathOrUrl: string): string {
  return resolveUrl(pathOrUrl);
}

export async function uploadNotes(
  templateId: string,
  file: UploadFile,
): Promise<NotesUploadResponse> {
  return uploadMultipart<NotesUploadResponse>(`/templates/${templateId}/notes`, file);
}

export function workspacePageUrl(kind: WorkspaceKind, id: string, page: number): string {
  const params = new URLSearchParams({ kind, id });
  return `${getApiBase()}/workspace/pages/${page}?${params.toString()}`;
}

export async function fetchWorkspaceInfo(
  kind: WorkspaceKind,
  id: string,
): Promise<{ page_count: number }> {
  const params = new URLSearchParams({ kind, id });
  const response = await request(`${getApiBase()}/workspace/document?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<{ page_count: number }>;
}

export async function exportWorkspace(
  payload: WorkspaceExportRequest,
): Promise<WorkspaceExportResponse> {
  const response = await request(`${getApiBase()}/workspace/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json() as Promise<WorkspaceExportResponse>;
}
