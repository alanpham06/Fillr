const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

function formatDetail(detail) {
  if (typeof detail === "string") {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item.msg || item.detail || JSON.stringify(item))
      .join(" ");
  }
  return "Request failed.";
}

async function readError(response) {
  try {
    const data = await response.json();
    return formatDetail(data.detail) || response.statusText;
  } catch {
    return response.statusText || "Request failed.";
  }
}

export async function ingest(file) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE}/ingest`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function generateTemplate(sourceId, settings) {
  const response = await fetch(`${API_BASE}/templates/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  return response.json();
}

export function sourceFileUrl(sourceId) {
  return `${API_BASE}/sources/${sourceId}/file`;
}

export function templateFileUrl(templateId) {
  return `${API_BASE}/templates/${templateId}/file`;
}

export async function fetchPdfBlob(pathOrUrl) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_BASE}${pathOrUrl}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return URL.createObjectURL(await response.blob());
}

export function filledFileUrl(templateId) {
  return `${API_BASE}/templates/${templateId}/filled`;
}

export async function uploadNotes(templateId, file) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch(`${API_BASE}/templates/${templateId}/notes`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

async function downloadFromUrl(url, filename) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadTemplate(templateId, filename) {
  await downloadFromUrl(templateFileUrl(templateId), filename);
}

export async function downloadFilled(templateId, filename) {
  await downloadFromUrl(filledFileUrl(templateId), filename);
}

export function workspacePageUrl(kind, id, page) {
  const params = new URLSearchParams({ kind, id });
  return `${API_BASE}/workspace/pages/${page}?${params.toString()}`;
}

export async function fetchWorkspaceInfo(kind, id) {
  const params = new URLSearchParams({ kind, id });
  const response = await fetch(`${API_BASE}/workspace/document?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function exportWorkspace(payload) {
  const response = await fetch(`${API_BASE}/workspace/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function downloadWorkspacePdf(pathOrUrl, filename) {
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${API_BASE}${pathOrUrl}`;
  await downloadFromUrl(url, filename);
}
