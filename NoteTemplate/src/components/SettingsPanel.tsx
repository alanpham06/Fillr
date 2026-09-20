import { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { probeHealth } from '../api';
import { DEFAULT_API_BASE } from '../apiBase';
import type { Density, TemplateSettings, TextSize } from '../types';
import { colors, radii } from '../theme';
import { SegmentedControl } from './SegmentedControl';

type TabId = 'input' | 'settings' | 'notes';

const TABS: [TabId, string][] = [
  ['input', 'Input'],
  ['settings', 'Settings'],
  ['notes', 'Notes'],
];

type SettingsPanelProps = {
  apiBase: string;
  onSaveApiBase: (url: string) => Promise<string>;
  fileName: string;
  pageCount: number;
  settings: TemplateSettings;
  onSettingsChange: (settings: TemplateSettings) => void;
  onPickFile: () => void;
  onClear: () => void;
  onGenerate: () => void;
  onDownload: () => void;
  onPickNotes: () => void;
  generating: boolean;
  canGenerate: boolean;
  canDownload: boolean;
  canUploadNotes: boolean;
  uploadingNotes: boolean;
  filledFileName: string;
};

export function SettingsPanel({
  apiBase,
  onSaveApiBase,
  fileName,
  pageCount,
  settings,
  onSettingsChange,
  onPickFile,
  onClear,
  onGenerate,
  onDownload,
  onPickNotes,
  generating,
  canGenerate,
  canDownload,
  canUploadNotes,
  uploadingNotes,
  filledFileName,
}: SettingsPanelProps) {
  const [tab, setTab] = useState<TabId>('input');
  const [draftBase, setDraftBase] = useState(apiBase);
  const [apiStatus, setApiStatus] = useState('');
  const [savingApi, setSavingApi] = useState(false);

  useEffect(() => {
    setDraftBase(apiBase);
  }, [apiBase]);

  function update(partial: Partial<TemplateSettings>) {
    onSettingsChange({ ...settings, ...partial });
  }

  async function handleSaveApi() {
    setSavingApi(true);
    setApiStatus('');
    try {
      const saved = await onSaveApiBase(draftBase);
      setDraftBase(saved);
      const result = await probeHealth(saved);
      setApiStatus(result.detail);
    } catch (err) {
      setApiStatus(err instanceof Error ? err.message : 'Could not save API URL.');
    } finally {
      setSavingApi(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {TABS.map(([id, label]) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            style={[styles.tab, tab === id && styles.tabOn]}
          >
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.body}>
        {tab === 'input' ? (
          <>
            <Text style={styles.legend}>Upload PDF</Text>
            <Text style={styles.muted}>
              Upload a PDF or a photo of slides, notes, or a textbook chapter.
            </Text>
            {fileName ? (
              <View style={styles.fileChip}>
                <Text style={styles.fileName}>{fileName}</Text>
                <Text style={styles.muted}>
                  {pageCount ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : 'PDF ready'}
                </Text>
                <View style={styles.chipActions}>
                  <Pressable onPress={onPickFile}>
                    <Text style={styles.ghost}>Replace</Text>
                  </Pressable>
                  <Pressable onPress={onClear}>
                    <Text style={styles.ghost}>Clear</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={onPickFile} style={styles.dropzone}>
                <Text style={styles.dropAccent}>Click to upload</Text>
                <Text style={styles.muted}>PDF or image · lecture slides</Text>
              </Pressable>
            )}

            <Text style={[styles.legend, styles.legendSpaced]}>API server</Text>
            <Text style={styles.muted}>
              Physical iPads cannot use localhost. Paste a reachable FastAPI URL.
            </Text>
            <TextInput
              value={draftBase}
              onChangeText={setDraftBase}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder={DEFAULT_API_BASE}
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel="API base URL"
            />
            <Pressable
              onPress={() => void handleSaveApi()}
              disabled={savingApi}
              style={[styles.secondary, savingApi && styles.disabled]}
            >
              <Text style={styles.secondaryLabel}>{savingApi ? 'Testing…' : 'Save and test'}</Text>
            </Pressable>
            {apiStatus ? <Text style={styles.muted}>{apiStatus}</Text> : null}
          </>
        ) : null}

        {tab === 'settings' ? (
          <>
            <Text style={styles.legend}>How much is already written</Text>
            <Text style={styles.hint}>Printed structure vs space to write.</Text>
            <SegmentedControl<Density>
              accessibilityLabel="How much is already written"
              value={settings.density}
              onChange={(density) => update({ density })}
              options={[
                { value: 'more_full', label: 'More structure' },
                { value: 'less_full', label: 'More blank space' },
              ]}
            />

            <Text style={[styles.legend, styles.legendSpaced]}>Template text size</Text>
            <Text style={styles.hint}>Size of printed headings and prompts.</Text>
            <SegmentedControl<TextSize>
              accessibilityLabel="Template text size"
              value={settings.textSize}
              onChange={(textSize) => update({ textSize })}
              options={[
                { value: 'small', label: 'Small' },
                { value: 'medium', label: 'Medium' },
                { value: 'large', label: 'Large' },
              ]}
            />

            <View style={styles.toggle}>
              <Switch
                value={settings.includeDiagrams}
                onValueChange={(includeDiagrams) => update({ includeDiagrams })}
                trackColor={{ false: colors.line, true: colors.teal }}
                thumbColor={colors.card}
              />
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>Leave room for diagrams</Text>
                <Text style={styles.hint}>Empty frames to sketch figures.</Text>
              </View>
            </View>
            <View style={styles.toggle}>
              <Switch
                value={settings.includeCode}
                onValueChange={(includeCode) => update({ includeCode })}
                trackColor={{ false: colors.line, true: colors.teal }}
                thumbColor={colors.card}
              />
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleLabel}>Leave room for code</Text>
                <Text style={styles.hint}>Empty blocks to copy examples.</Text>
              </View>
            </View>
          </>
        ) : null}

        {tab === 'notes' ? (
          <>
            <Text style={styles.legend}>Completed notes</Text>
            <Text style={styles.muted}>
              Photograph or scan the filled sheet. We OCR the writing and drop it
              back onto the template in teal ink. Handwriting accuracy is limited.
            </Text>
            {canUploadNotes ? (
              <>
                <Pressable
                  onPress={onPickNotes}
                  disabled={uploadingNotes}
                  style={[styles.secondary, uploadingNotes && styles.disabled]}
                >
                  <Text style={styles.secondaryLabel}>
                    {uploadingNotes ? 'Reading notes…' : 'Upload completed notes'}
                  </Text>
                </Pressable>
                {filledFileName ? (
                  <Text style={styles.muted}>Loaded {filledFileName}</Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.muted}>
                Generate a template first, then upload the filled sheet.
              </Text>
            )}
          </>
        ) : null}
      </View>

      {tab !== 'notes' ? (
        <View style={styles.actions}>
          <Pressable
            onPress={onGenerate}
            disabled={!canGenerate || generating}
            style={[styles.primary, (!canGenerate || generating) && styles.disabled]}
          >
            <Text style={styles.primaryLabel}>
              {generating ? 'Generating…' : 'Generate template'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onDownload}
            disabled={!canDownload}
            style={[styles.secondary, !canDownload && styles.disabled]}
          >
            <Text style={styles.secondaryLabel}>Share template PDF</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 0,
    paddingBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabOn: {
    borderBottomColor: colors.teal,
  },
  tabLabel: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '500',
  },
  tabLabelOn: {
    color: colors.teal,
    fontWeight: '600',
  },
  body: {
    gap: 8,
  },
  legend: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  legendSpaced: {
    marginTop: 14,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  hint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.card,
  },
  dropzone: {
    minHeight: 112,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radii.card,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 4,
  },
  dropAccent: {
    fontWeight: '600',
    color: colors.teal,
    fontSize: 15,
  },
  fileChip: {
    backgroundColor: colors.paper,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 4,
  },
  fileName: {
    fontWeight: '700',
    color: colors.ink,
  },
  chipActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  ghost: {
    color: colors.teal,
    fontWeight: '600',
    fontSize: 15,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.ink,
  },
  actions: {
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  primary: {
    backgroundColor: colors.teal,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.cream,
    fontWeight: '600',
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  secondaryLabel: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.45,
  },
});
