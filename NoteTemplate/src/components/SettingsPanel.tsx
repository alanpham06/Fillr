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
      <View style={styles.card}>
        <Text style={styles.heading}>API server</Text>
        <Text style={styles.muted}>
          Physical iPads cannot use localhost. Paste a reachable FastAPI URL
          (ngrok, Cloudflare Tunnel, or a LAN IP that actually forwards to WSL).
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
        <Text style={styles.tiny}>Current: {apiBase}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Lecture slides</Text>
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
            <Text style={styles.dropTitle}>Choose a PDF or image</Text>
            <Text style={styles.muted}>Opens the iPad Files picker</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Template settings</Text>

        <Text style={styles.legend}>How complete should it look?</Text>
        <SegmentedControl<Density>
          accessibilityLabel="Template density"
          value={settings.density}
          onChange={(density) => update({ density })}
          options={[
            { value: 'more_full', label: 'More filled in' },
            { value: 'less_full', label: 'More blank' },
          ]}
        />

        <Text style={[styles.legend, styles.legendSpaced]}>Text size</Text>
        <SegmentedControl<TextSize>
          accessibilityLabel="Text size"
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
          <Text style={styles.toggleLabel}>Include diagram slots</Text>
        </View>
        <View style={styles.toggle}>
          <Switch
            value={settings.includeCode}
            onValueChange={(includeCode) => update({ includeCode })}
            trackColor={{ false: colors.line, true: colors.teal }}
            thumbColor={colors.card}
          />
          <Text style={styles.toggleLabel}>Include code-block slots</Text>
        </View>
      </View>

      {canUploadNotes ? (
        <View style={styles.card}>
          <Text style={styles.heading}>Completed notes</Text>
          <Text style={styles.muted}>
            Photograph or scan the filled sheet. We OCR the writing and drop it
            back onto the template in teal ink. Handwriting accuracy is limited.
          </Text>
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
        </View>
      ) : null}

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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 12,
    paddingBottom: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: 14,
    gap: 8,
  },
  heading: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  tiny: {
    color: colors.muted,
    fontSize: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  dropzone: {
    minHeight: 96,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#b7ad9b',
    borderRadius: 14,
    backgroundColor: colors.paperDeep,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 4,
  },
  dropTitle: {
    fontWeight: '700',
    color: colors.ink,
    fontSize: 15,
  },
  fileChip: {
    backgroundColor: colors.paperDeep,
    borderRadius: 12,
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
  legend: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    marginTop: 4,
  },
  legendSpaced: {
    marginTop: 12,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  toggleLabel: {
    fontSize: 15,
    color: colors.ink,
    flex: 1,
  },
  actions: {
    gap: 8,
  },
  primary: {
    backgroundColor: colors.teal,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
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
