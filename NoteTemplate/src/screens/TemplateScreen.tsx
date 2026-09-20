import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  filledFileUrl,
  generateTemplate,
  ingest,
  sourceFileUrl,
  templateFileUrl,
  uploadNotes,
} from '../api';
import { Banner } from '../components/Banner';
import { FillrLogo } from '../components/FillrLogo';
import { PdfPreview } from '../components/PdfPreview';
import { SegmentedControl } from '../components/SegmentedControl';
import { SettingsPanel } from '../components/SettingsPanel';
import { useApiBase } from '../hooks/useApiBase';
import { isImageName, isPdfName, pickLectureOrNotesFile } from '../lib/pickFile';
import { sharePdfFromUrl } from '../lib/sharePdf';
import type { WorkspaceDoc } from '../lib/workspaceTypes';
import { WorkspaceScreen } from './WorkspaceScreen';
import { colors } from '../theme';
import {
  DEFAULT_SETTINGS,
  LOADING_MESSAGES,
  NOTES_NAME_RE,
  type GenerateResponse,
  type IngestResponse,
  type NotesUploadResponse,
  type TemplateSettings,
  type UploadFile,
} from '../types';

function notesFilename(file: UploadFile | null, suffix: string): string {
  const stem = file
    ? file.name.replace(NOTES_NAME_RE, '')
    : 'lecture';
  return `${stem}-${suffix}.pdf`;
}

export function TemplateScreen() {
  const { width } = useWindowDimensions();
  const { apiBase, saveApiBase } = useApiBase();
  const sideBySide = width >= 900;
  const previewsSideBySide = width >= 1100;

  const [settings, setSettings] = useState<TemplateSettings>(DEFAULT_SETTINGS);
  const [file, setFile] = useState<UploadFile | null>(null);
  const [localPreviewUri, setLocalPreviewUri] = useState('');
  const [source, setSource] = useState<IngestResponse | null>(null);
  const [template, setTemplate] = useState<GenerateResponse | null>(null);
  const [filled, setFilled] = useState<NotesUploadResponse | null>(null);
  const [filledName, setFilledName] = useState('');
  const [showFilled, setShowFilled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadingNotes, setUploadingNotes] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [error, setError] = useState('');
  const [busyLabel, setBusyLabel] = useState('');
  const [workspace, setWorkspace] = useState<WorkspaceDoc | null>(null);

  useEffect(() => {
    if (!generating) {
      return undefined;
    }
    let index = 0;
    setLoadingMessage(LOADING_MESSAGES[0]);
    const timer = setInterval(() => {
      index = (index + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[index]);
    }, 2200);
    return () => clearInterval(timer);
  }, [generating]);

  function resetFilled() {
    setFilled(null);
    setFilledName('');
    setShowFilled(false);
  }

  function resetGenerated() {
    setTemplate(null);
    resetFilled();
  }

  async function handleFileChosen(next: UploadFile) {
    resetGenerated();
    setError('');
    setFile(next);
    setSource(null);
    setLocalPreviewUri(isPdfName(next.name) || isImageName(next.name) ? next.uri : '');
    setBusyLabel('Uploading slides…');

    try {
      const record = await ingest(next);
      setSource(record);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that file.');
      setSource(null);
    } finally {
      setBusyLabel('');
    }
  }

  async function handlePickFile() {
    try {
      const next = await pickLectureOrNotesFile('Please choose a PDF or an image (png, jpg).');
      if (next) {
        await handleFileChosen(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that file.');
    }
  }

  function handleClear() {
    resetGenerated();
    setFile(null);
    setSource(null);
    setLocalPreviewUri('');
    setError('');
    setBusyLabel('');
  }

  async function handleGenerate() {
    if (!source) {
      setError('Upload lecture slides first.');
      return;
    }
    setError('');
    setGenerating(true);
    try {
      const result = await generateTemplate(source.id, settings);
      resetFilled();
      setTemplate(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate a template.');
    } finally {
      setGenerating(false);
    }
  }

  async function handlePickNotes() {
    if (!template) {
      setError('Generate a template first.');
      return;
    }
    try {
      const next = await pickLectureOrNotesFile(
        'Please choose a PDF or an image of your filled notes.',
      );
      if (!next) {
        return;
      }
      setError('');
      setUploadingNotes(true);
      setBusyLabel('OCR’ing your notes…');
      const result = await uploadNotes(template.template_id, next);
      setFilled(result);
      setFilledName(next.name);
      setShowFilled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read those notes.');
    } finally {
      setUploadingNotes(false);
      setBusyLabel('');
    }
  }

  async function handleDownload() {
    if (!template) {
      return;
    }
    try {
      await sharePdfFromUrl(
        templateFileUrl(template.template_id),
        notesFilename(file, 'notes'),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share the PDF.');
    }
  }

  const sourceUri = source ? sourceFileUrl(source.id) : localPreviewUri;
  const sourceKind: 'pdf' | 'image' =
    source || !file || isPdfName(file.name) ? 'pdf' : 'image';
  const templateUri = template ? templateFileUrl(template.template_id) : '';
  const filledUri = template && filled ? filledFileUrl(template.template_id) : '';
  const previewingFilled = Boolean(showFilled && filledUri);
  const generatedUri = previewingFilled ? filledUri : templateUri;

  const settingsPanel = (
    <SettingsPanel
      apiBase={apiBase}
      onSaveApiBase={saveApiBase}
      fileName={file?.name || ''}
      pageCount={source?.page_count || 0}
      settings={settings}
      onSettingsChange={setSettings}
      onPickFile={() => void handlePickFile()}
      onClear={handleClear}
      onGenerate={() => void handleGenerate()}
      onDownload={() => void handleDownload()}
      onPickNotes={() => void handlePickNotes()}
      generating={generating}
      canGenerate={Boolean(source) && !busyLabel}
      canDownload={Boolean(template)}
      canUploadNotes={Boolean(template)}
      uploadingNotes={uploadingNotes}
      filledFileName={filledName}
    />
  );

  const banners = (
    <View style={styles.banners}>
      {error ? <Banner kind="error" message={error} /> : null}
      {busyLabel ? <Banner kind="info" message={busyLabel} /> : null}
      {generating ? <Banner kind="progress" message={loadingMessage} /> : null}
    </View>
  );

  const sourcePreview = (
    <PdfPreview
      title="Uploaded slides"
      subtitle={file ? file.name : 'Waiting for a file'}
      uri={sourceUri || null}
      kind={sourceKind}
      emptyTitle="No slides yet"
      emptyBody="Upload a lecture PDF or a photo of a slide to preview it here."
      onOpenExternally={
        source ? () => void sharePdfFromUrl(sourceFileUrl(source.id), file?.name || 'slides.pdf') : undefined
      }
      onOpenWorkspace={
        source
          ? () =>
              setWorkspace({
                kind: 'source',
                id: source.id,
                title: file?.name || 'Uploaded slides',
                filename: file?.name || 'slides.pdf',
                pageCount: source.page_count || 1,
              })
          : undefined
      }
    />
  );

  const generatedPreview = (
    <PdfPreview
      title={previewingFilled ? 'Filled notes' : 'Generated template'}
      subtitle={
        previewingFilled
          ? 'Student ink over the printed skeleton'
          : template
            ? 'Fill-in lecture notes'
            : 'Will appear after you generate'
      }
      uri={generatedUri || null}
      emptyTitle="No template yet"
      emptyBody="Choose your settings, then generate a fill-in note sheet."
      onOpenExternally={
        template
          ? () =>
              void sharePdfFromUrl(
                previewingFilled
                  ? filledFileUrl(template.template_id)
                  : templateFileUrl(template.template_id),
                notesFilename(file, previewingFilled ? 'filled' : 'notes'),
              )
          : undefined
      }
      onOpenWorkspace={
        template
          ? () =>
              setWorkspace({
                kind: previewingFilled ? 'filled' : 'template',
                id: template.template_id,
                title: previewingFilled ? 'Filled notes' : 'Generated template',
                filename: notesFilename(file, previewingFilled ? 'filled' : 'notes'),
                pageCount:
                  (previewingFilled ? filled?.page_count : template.page_count) || 1,
              })
          : undefined
      }
      actions={
        filledUri ? (
          <SegmentedControl
            accessibilityLabel="Preview mode"
            value={showFilled ? 'filled' : 'template'}
            onChange={(mode) => setShowFilled(mode === 'filled')}
            options={[
              { value: 'template', label: 'Template' },
              { value: 'filled', label: 'Filled' },
            ]}
          />
        ) : undefined
      }
    />
  );

  if (workspace) {
    return <WorkspaceScreen doc={workspace} onClose={() => setWorkspace(null)} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topbar}>
        <FillrLogo />
        <Text style={styles.disclaimer}>
          Generated templates may miss topics from the source slides. This is a
          fill-in note sheet, not a homework solver. Teal ink on a filled PDF is
          OCR and may misread handwriting. Open a PDF workspace to write or type
          on a page; your ink is saved on this device.
        </Text>
      </View>

      {sideBySide ? (
        <View style={styles.workspaceRow}>
          <ScrollView
            style={styles.sidebar}
            contentContainerStyle={styles.sidebarContent}
            keyboardShouldPersistTaps="handled"
          >
            {settingsPanel}
          </ScrollView>
          <View style={styles.previewCol}>
            {banners}
            <View style={previewsSideBySide ? styles.previewRow : styles.previewStack}>
              {sourcePreview}
              {generatedPreview}
            </View>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.phoneContent}
          keyboardShouldPersistTaps="handled"
        >
          {settingsPanel}
          {banners}
          <View style={styles.phonePreview}>{sourcePreview}</View>
          <View style={styles.phonePreview}>{generatedPreview}</View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  topbar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 4,
  },
  disclaimer: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 640,
  },
  workspaceRow: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
  },
  sidebar: {
    width: 340,
    borderRightWidth: 1,
    borderRightColor: colors.line,
    backgroundColor: colors.card,
  },
  sidebarContent: {
    padding: 14,
  },
  previewCol: {
    flex: 1,
    minWidth: 0,
    padding: 12,
    gap: 10,
  },
  previewRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 0,
  },
  previewStack: {
    flex: 1,
    gap: 10,
    minHeight: 0,
  },
  banners: {
    gap: 8,
  },
  phoneContent: {
    padding: 14,
    gap: 12,
  },
  phonePreview: {
    height: 420,
  },
});
