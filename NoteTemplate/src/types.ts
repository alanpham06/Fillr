export type Density = 'more_full' | 'less_full';
export type TextSize = 'small' | 'medium' | 'large';

export type TemplateSettings = {
  density: Density;
  textSize: TextSize;
  includeDiagrams: boolean;
  includeCode: boolean;
};

export type UploadFile = {
  uri: string;
  name: string;
  mimeType: string;
};

export type IngestResponse = {
  id: string;
  filename: string;
  page_count: number;
  file_url: string;
};

export type GenerateResponse = {
  template_id: string;
  pdf_url: string;
  page_count: number;
  stub: boolean;
};

export type NotesUploadResponse = {
  template_id: string;
  filled_template_id: string;
  pdf_url: string;
  mapper: 'heuristic' | 'nemotron';
  ocr_pages: number;
  page_count: number;
  stub: boolean;
};

export type WorkspaceKind = 'source' | 'template' | 'filled';

export type WorkspaceExportStroke = {
  points: { x: number; y: number }[];
  color: string;
  width: number;
};

export type WorkspaceExportText = {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  font_size: number;
  color: string;
};

export type WorkspaceExportRequest = {
  kind: WorkspaceKind;
  id: string;
  pages: {
    page: number;
    strokes: WorkspaceExportStroke[];
    texts: WorkspaceExportText[];
  }[];
};

export type WorkspaceExportResponse = {
  export_id: string;
  pdf_url: string;
  page_count: number;
};

export const DEFAULT_SETTINGS: TemplateSettings = {
  density: 'more_full',
  textSize: 'medium',
  includeDiagrams: true,
  includeCode: true,
};

export const LOADING_MESSAGES = [
  'Reading the uploaded slides…',
  'Laying out fill-in sections…',
  'Leaving blanks for you to write…',
  'Building a printable PDF…',
];

export const NOTES_NAME_RE = /\.(pdf|png|jpe?g|webp)$/i;
