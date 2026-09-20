import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { exportWorkspace, fetchWorkspaceInfo, fileUrl, workspacePageUrl } from '../api';
import { InkOverlay } from '../components/InkOverlay';
import { SegmentedControl } from '../components/SegmentedControl';
import { TextBoxLayer } from '../components/TextBoxLayer';
import { LETTER_ASPECT, containRect } from '../lib/geometry';
import { sharePdfFromUrl } from '../lib/sharePdf';
import { loadWorkspace, saveWorkspace } from '../lib/workspaceStore';
import {
  COLOR_ORDER,
  DRAW_TOOLS,
  DRAW_TOOL_LABELS,
  type DrawTool,
  DEFAULT_FONT_PT,
  DEFAULT_TOOL_SIZES,
  clampStrokePt,
  type EditorMode,
  fontSizeToPt,
  HIGHLIGHTER_OPACITY,
  INK_COLORS,
  type InkColorName,
  MAX_FONT_PT,
  MIN_FONT_PT,
  type WorkspaceDoc,
  type WorkspacePage,
  type WorkspaceStroke,
  type WorkspaceTextBox,
  emptyPage,
  pageHasInk,
  placedTextBox,
  ptToFontSize,
  STROKE_LIMITS,
  strokePtToNorm,
  strokePtToScreenPx,
  strokeOpacity,
  strokeTool,
} from '../lib/workspaceTypes';
import { colors, radii } from '../theme';

type WorkspaceScreenProps = {
  doc: WorkspaceDoc;
  onClose: () => void;
};

type SaveStatus = 'loading' | 'saved' | 'saving' | 'error';

let textSeq = 0;
function nextTextId(): string {
  textSeq += 1;
  return `text-${Date.now()}-${textSeq}`;
}

function notesFilename(name: string): string {
  const stem = name.replace(/\.(pdf|png|jpe?g|webp)$/i, '');
  return `${stem || 'notes'}-annotated.pdf`;
}

export function WorkspaceScreen({ doc, onClose }: WorkspaceScreenProps) {
  const [pageCount, setPageCount] = useState(Math.max(1, doc.pageCount || 1));
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState<Record<string, WorkspacePage>>({});
  const [mode, setMode] = useState<EditorMode>('write');
  const [drawTool, setDrawTool] = useState<DrawTool>('pen');
  const [toolSizes, setToolSizes] = useState({ ...DEFAULT_TOOL_SIZES });
  const [strokeDraft, setStrokeDraft] = useState(String(DEFAULT_TOOL_SIZES.pen));
  const [colorName, setColorName] = useState<InkColorName>('Black');
  const [colorOpen, setColorOpen] = useState(false);
  const [fontPt, setFontPt] = useState(DEFAULT_FONT_PT);
  const [fontDraft, setFontDraft] = useState(String(DEFAULT_FONT_PT));
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 850, height: 1100 });
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [ready, setReady] = useState(false);

  const pagesRef = useRef(pages);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  pagesRef.current = pages;

  const current = pages[String(page)] ?? emptyPage();
  const pageUri = workspacePageUrl(doc.kind, doc.id, page);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      try {
        const [stored, info] = await Promise.all([
          loadWorkspace(doc.kind, doc.id),
          fetchWorkspaceInfo(doc.kind, doc.id).catch(() => null),
        ]);
        if (cancelled) {
          return;
        }
        if (stored) {
          setPages(stored.pages);
        }
        if (info?.page_count) {
          setPageCount(info.page_count);
        }
        setSaveStatus('saved');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not open that PDF.');
          setSaveStatus('error');
        }
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [doc.kind, doc.id]);

  useEffect(() => {
    setImageFailed(false);
    setSelectedTextId(null);
  }, [page, pageUri]);

  const persist = useCallback(async () => {
    setSaveStatus('saving');
    try {
      await saveWorkspace(doc.kind, doc.id, { version: 1, pages: pagesRef.current });
      setSaveStatus('saved');
      setError('');
    } catch (err) {
      setSaveStatus('error');
      setError(err instanceof Error ? err.message : 'Could not save your notes.');
      throw err;
    }
  }, [doc.id, doc.kind]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }
    setSaveStatus('saving');
    saveTimer.current = setTimeout(() => {
      void persist().catch(() => undefined);
    }, 350);
  }, [persist]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
    };
  }, []);

  const updatePage = useCallback(
    (pageNumber: number, updater: (currentPage: WorkspacePage) => WorkspacePage) => {
      setPages((prev) => {
        const key = String(pageNumber);
        const next = updater(prev[key] ?? emptyPage());
        return { ...prev, [key]: next };
      });
      scheduleSave();
    },
    [scheduleSave],
  );

  const handleStroke = useCallback(
    (stroke: WorkspaceStroke) => {
      updatePage(page, (currentPage) => ({
        ...currentPage,
        strokes: [...currentPage.strokes, stroke],
      }));
    },
    [page, updatePage],
  );

  const handleErase = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }
      const remove = new Set(ids);
      updatePage(page, (currentPage) => ({
        ...currentPage,
        strokes: currentPage.strokes.filter((stroke) => !remove.has(stroke.id)),
      }));
    },
    [page, updatePage],
  );

  const handleUndo = useCallback(() => {
    updatePage(page, (currentPage) => {
      if (currentPage.strokes.length > 0) {
        return { ...currentPage, strokes: currentPage.strokes.slice(0, -1) };
      }
      if (currentPage.texts.length > 0) {
        return { ...currentPage, texts: currentPage.texts.slice(0, -1) };
      }
      return currentPage;
    });
    setSelectedTextId(null);
  }, [page, updatePage]);

  const handleClearPage = useCallback(() => {
    if (!pageHasInk(current)) {
      return;
    }
    Alert.alert('Clear this page?', 'Ink and typed notes on this page will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear page',
        style: 'destructive',
        onPress: () => {
          updatePage(page, () => emptyPage());
          setSelectedTextId(null);
        },
      },
    ]);
  }, [current, page, updatePage]);

  const handlePlaceText = useCallback(
    (x: number, y: number) => {
      const id = nextTextId();
      const box: WorkspaceTextBox = {
        id,
        ...placedTextBox(x, y),
        text: '',
        fontSize: ptToFontSize(fontPt),
        color: INK_COLORS[colorName],
        bold: textBold,
        italic: textItalic,
      };
      updatePage(page, (currentPage) => ({
        ...currentPage,
        texts: [...currentPage.texts, box],
      }));
      setSelectedTextId(id);
    },
    [colorName, fontPt, page, textBold, textItalic, updatePage],
  );

  const handleChangeText = useCallback(
    (id: string, patch: Partial<WorkspaceTextBox>) => {
      updatePage(page, (currentPage) => ({
        ...currentPage,
        texts: currentPage.texts.map((box) => (box.id === id ? { ...box, ...patch } : box)),
      }));
    },
    [page, updatePage],
  );

  useEffect(() => {
    const box = current.texts.find((item) => item.id === selectedTextId);
    if (!box) {
      return;
    }
    const nextPt = fontSizeToPt(box.fontSize);
    setFontPt(nextPt);
    setFontDraft(String(nextPt));
    setTextBold(Boolean(box.bold));
    setTextItalic(Boolean(box.italic));
    const match = COLOR_ORDER.find(
      (name) => INK_COLORS[name].toLowerCase() === box.color.toLowerCase(),
    );
    if (match) {
      setColorName(match);
    }
    // Sync format controls when the selection changes, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTextId]);

  const applyColor = useCallback(
    (name: InkColorName) => {
      setColorName(name);
      setColorOpen(false);
      if (mode === 'type' && selectedTextId) {
        handleChangeText(selectedTextId, { color: INK_COLORS[name] });
      }
    },
    [handleChangeText, mode, selectedTextId],
  );

  const applyDrawTool = useCallback((next: DrawTool) => {
    setDrawTool(next);
    setStrokeDraft(String(toolSizes[next]));
    setColorOpen(false);
    if (next === 'highlighter' && colorName === 'Black') {
      setColorName('Yellow');
    }
    if (next === 'pen' && colorName === 'Yellow') {
      setColorName('Black');
    }
  }, [colorName, toolSizes]);

  const applyStrokeSize = useCallback(
    (raw: string | number) => {
      const parsed = Number.parseFloat(String(raw));
      const next = Number.isFinite(parsed) ? clampStrokePt(drawTool, parsed) : toolSizes[drawTool];
      setToolSizes((prev) => ({ ...prev, [drawTool]: next }));
      setStrokeDraft(String(next));
      return next;
    },
    [drawTool, toolSizes],
  );

  const applyFontSize = useCallback(
    (raw: string | number) => {
      const parsed = Number.parseInt(String(raw), 10);
      const next = Number.isFinite(parsed)
        ? Math.min(MAX_FONT_PT, Math.max(MIN_FONT_PT, parsed))
        : fontPt;
      setFontPt(next);
      setFontDraft(String(next));
      if (selectedTextId) {
        handleChangeText(selectedTextId, { fontSize: ptToFontSize(next) });
      }
      return next;
    },
    [fontPt, handleChangeText, selectedTextId],
  );

  const applyBold = useCallback(() => {
    setTextBold((prev) => {
      const next = !prev;
      if (selectedTextId) {
        handleChangeText(selectedTextId, { bold: next });
      }
      return next;
    });
  }, [handleChangeText, selectedTextId]);

  const applyItalic = useCallback(() => {
    setTextItalic((prev) => {
      const next = !prev;
      if (selectedTextId) {
        handleChangeText(selectedTextId, { italic: next });
      }
      return next;
    });
  }, [handleChangeText, selectedTextId]);

  const handleRemoveText = useCallback(
    (id: string) => {
      updatePage(page, (currentPage) => ({
        ...currentPage,
        texts: currentPage.texts.filter((box) => box.id !== id),
      }));
      setSelectedTextId(null);
    },
    [page, updatePage],
  );

  const handleBack = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await persist();
      onClose();
    } catch {
      Alert.alert('Could not save your notes', 'Leave anyway? Ink and typed notes may be lost.', [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ]);
    }
  }, [onClose, persist]);

  const handleSave = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    void persist().catch(() => undefined);
  }, [persist]);

  const handleExport = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    try {
      await persist();
    } catch {
      return;
    }
    setExporting(true);
    setError('');
    try {
      const payload = {
        kind: doc.kind,
        id: doc.id,
        pages: Object.entries(pagesRef.current)
          .map(([key, value]) => ({
            page: Number(key),
            strokes: value.strokes
              .filter((stroke) => strokeTool(stroke) !== 'eraser')
              .map((stroke) => ({
                points: stroke.points,
                color: stroke.color,
                width: stroke.width,
                tool: strokeTool(stroke),
                opacity: strokeOpacity(stroke),
              })),
            texts: value.texts
              .filter((box) => box.text.trim().length > 0)
              .map((box) => ({
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                text: box.text,
                font_size: box.fontSize,
                color: box.color,
                bold: Boolean(box.bold),
                italic: Boolean(box.italic),
              })),
          }))
          .filter((entry) => entry.strokes.length > 0 || entry.texts.length > 0),
      };
      const result = await exportWorkspace(payload);
      await sharePdfFromUrl(fileUrl(result.pdf_url), notesFilename(doc.filename));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share the annotated PDF.');
    } finally {
      setExporting(false);
    }
  }, [doc.filename, doc.id, doc.kind, persist]);

  const pageRect = useMemo(() => {
    const aspect = imageSize.width / imageSize.height || LETTER_ASPECT;
    const naturalWidth = 1000;
    const naturalHeight = naturalWidth / aspect;
    return containRect(stage.width, stage.height, naturalWidth, naturalHeight);
  }, [imageSize.height, imageSize.width, stage.height, stage.width]);

  const strokePt = toolSizes[drawTool];
  const strokeRange = STROKE_LIMITS[drawTool];
  const widthNorm = strokePtToNorm(strokePt);
  const strokeAlpha = drawTool === 'highlighter' ? HIGHLIGHTER_OPACITY : 1;
  const canUndo = current.strokes.length > 0 || current.texts.length > 0;
  const saveLabel =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved';

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
        <Text style={styles.muted}>Opening workspace…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topbar}>
        <Pressable onPress={() => void handleBack()} style={styles.back} accessibilityLabel="Back">
          <Text style={styles.backLabel}>← Notes</Text>
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Workspace</Text>
          <Text style={styles.title} numberOfLines={1}>
            {doc.title}
          </Text>
        </View>
        <Text style={[styles.saveHint, saveStatus === 'error' && styles.saveError]}>{saveLabel}</Text>
      </View>

      <View style={styles.toolbar} accessibilityRole="toolbar">
        <SegmentedControl<EditorMode>
          accessibilityLabel="Workspace mode"
          value={mode}
          onChange={(next) => {
            setMode(next);
            setColorOpen(false);
            if (next === 'write') {
              setSelectedTextId(null);
            }
          }}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'type', label: 'Type' },
          ]}
        />

        {mode === 'write' ? (
          <View style={styles.drawTools}>
            <SegmentedControl<DrawTool>
              accessibilityLabel="Drawing tool"
              value={drawTool}
              onChange={applyDrawTool}
              options={DRAW_TOOLS.map((value) => ({
                value,
                label: DRAW_TOOL_LABELS[value],
              }))}
            />
            <View style={styles.fontSizeField}>
              <Pressable
                onPress={() => applyStrokeSize(toolSizes[drawTool] - strokeRange.step)}
                accessibilityRole="button"
                accessibilityLabel="Smaller stroke"
                style={styles.fontStep}
              >
                <Text style={styles.fontStepLabel}>−</Text>
              </Pressable>
              <TextInput
                value={strokeDraft}
                onChangeText={(text) => {
                  setStrokeDraft(text);
                  if (text.trim() === '') {
                    return;
                  }
                  applyStrokeSize(text);
                }}
                onBlur={() => applyStrokeSize(strokeDraft)}
                keyboardType="decimal-pad"
                selectTextOnFocus
                accessibilityLabel="Stroke size in points"
                style={styles.fontSizeInput}
              />
              <Text style={styles.fontSizeUnit}>pt</Text>
              <Pressable
                onPress={() => applyStrokeSize(toolSizes[drawTool] + strokeRange.step)}
                accessibilityRole="button"
                accessibilityLabel="Larger stroke"
                style={styles.fontStep}
              >
                <Text style={styles.fontStepLabel}>+</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.toolGroup}>
            <View style={styles.fontSizeField}>
              <Pressable
                onPress={() => applyFontSize(fontPt - 1)}
                accessibilityRole="button"
                accessibilityLabel="Smaller text"
                style={styles.fontStep}
              >
                <Text style={styles.fontStepLabel}>−</Text>
              </Pressable>
              <TextInput
                value={fontDraft}
                onChangeText={(text) => {
                  setFontDraft(text);
                  if (text.trim() === '') {
                    return;
                  }
                  applyFontSize(text);
                }}
                onBlur={() => applyFontSize(fontDraft)}
                keyboardType="number-pad"
                selectTextOnFocus
                accessibilityLabel="Font size in points"
                style={styles.fontSizeInput}
              />
              <Text style={styles.fontSizeUnit}>pt</Text>
              <Pressable
                onPress={() => applyFontSize(fontPt + 1)}
                accessibilityRole="button"
                accessibilityLabel="Larger text"
                style={styles.fontStep}
              >
                <Text style={styles.fontStepLabel}>+</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={applyBold}
              accessibilityRole="button"
              accessibilityLabel="Bold"
              accessibilityState={{ selected: textBold }}
              style={[styles.chip, textBold && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, styles.boldMark, textBold && styles.chipLabelOn]}>B</Text>
            </Pressable>
            <Pressable
              onPress={applyItalic}
              accessibilityRole="button"
              accessibilityLabel="Italic"
              accessibilityState={{ selected: textItalic }}
              style={[styles.chip, textItalic && styles.chipSelected]}
            >
              <Text style={[styles.chipLabel, styles.italicMark, textItalic && styles.chipLabelOn]}>I</Text>
            </Pressable>
          </View>
        )}

        {drawTool !== 'eraser' || mode === 'type' ? (
          <View style={styles.colorWrap}>
            <Pressable
              onPress={() => setColorOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel="Color"
              accessibilityState={{ expanded: colorOpen }}
              style={styles.colorBtn}
            >
              <View style={[styles.colorDot, { backgroundColor: INK_COLORS[colorName] }]} />
              <Text style={styles.colorBtnLabel}>Color</Text>
            </Pressable>
            {colorOpen ? (
              <View style={styles.colorMenu} accessibilityRole="menu">
                {COLOR_ORDER.map((name) => {
                  const selected = name === colorName;
                  return (
                    <Pressable
                      key={name}
                      onPress={() => applyColor(name)}
                      accessibilityRole="button"
                      accessibilityLabel={name}
                      accessibilityState={{ selected }}
                      style={[
                        styles.swatch,
                        { backgroundColor: INK_COLORS[name] },
                        selected && styles.swatchSelected,
                      ]}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={styles.toolGroup}>
          <Pressable
            onPress={handleUndo}
            disabled={!canUndo}
            style={[styles.chip, !canUndo && styles.disabled]}
            accessibilityLabel="Undo"
          >
            <Text style={styles.chipLabel}>Undo</Text>
          </Pressable>
          <Pressable
            onPress={handleClearPage}
            disabled={!canUndo}
            style={[styles.chip, !canUndo && styles.disabled]}
            accessibilityLabel="Clear page"
          >
            <Text style={styles.chipLabel}>Clear page</Text>
          </Pressable>
          <Pressable onPress={handleSave} style={styles.chip} accessibilityLabel="Save progress">
            <Text style={styles.chipLabel}>Save</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleExport()}
            disabled={exporting}
            style={[styles.primary, exporting && styles.disabled]}
            accessibilityLabel="Download annotated PDF"
          >
            <Text style={styles.primaryLabel}>{exporting ? 'Preparing…' : 'Download'}</Text>
          </Pressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBar}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View
        style={styles.stage}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setStage({ width, height });
        }}
      >
        {imageFailed ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not load this page</Text>
            <Text style={styles.muted}>
              Check the API server, then go back and open the workspace again.
            </Text>
          </View>
        ) : (
          <>
            <Image
              source={{ uri: pageUri }}
              style={styles.pageImage}
              resizeMode="contain"
              onLoad={(event) => {
                const { width, height } = event.nativeEvent.source;
                if (width > 0 && height > 0) {
                  setImageSize({ width, height });
                }
              }}
              onError={() => setImageFailed(true)}
            />
            {pageRect.width > 0 ? (
              <View
                style={[
                  styles.overlay,
                  {
                    left: pageRect.x,
                    top: pageRect.y,
                    width: pageRect.width,
                    height: pageRect.height,
                  },
                ]}
                pointerEvents="box-none"
              >
                <InkOverlay
                  strokes={current.strokes}
                  enabled={mode === 'write'}
                  color={INK_COLORS[colorName]}
                  widthNorm={widthNorm}
                  tool={drawTool}
                  opacity={strokeAlpha}
                  eraserRadius={strokePtToScreenPx(toolSizes.eraser, pageRect.width)}
                  onStrokeComplete={handleStroke}
                  onEraseStrokes={handleErase}
                />
                <TextBoxLayer
                  boxes={current.texts}
                  selectedId={selectedTextId}
                  enabled={mode === 'type'}
                  pageWidth={pageRect.width}
                  pageHeight={pageRect.height}
                  onSelect={setSelectedTextId}
                  onChange={handleChangeText}
                  onRemove={handleRemoveText}
                  onPlace={handlePlaceText}
                />
              </View>
            ) : null}
          </>
        )}
      </View>

      <View style={styles.pager}>
        <Pressable
          onPress={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page <= 1}
          style={[styles.pageBtn, page <= 1 && styles.disabled]}
        >
          <Text style={styles.pageBtnLabel}>‹ Prev</Text>
        </Pressable>
        <Text style={styles.pageLabel}>
          Page {page} of {pageCount}
        </Text>
        <Pressable
          onPress={() => setPage((prev) => Math.min(pageCount, prev + 1))}
          disabled={page >= pageCount}
          style={[styles.pageBtn, page >= pageCount && styles.disabled]}
        >
          <Text style={styles.pageBtnLabel}>Next ›</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.paper,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  back: {
    paddingVertical: 8,
    paddingRight: 8,
  },
  backLabel: {
    color: colors.teal,
    fontWeight: '700',
    fontSize: 16,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontSize: 11,
    color: colors.gold,
    fontWeight: '700',
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
  },
  saveHint: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  saveError: {
    color: colors.danger,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    zIndex: 6,
  },
  toolGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  drawTools: {
    minWidth: 248,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchSelected: {
    borderColor: colors.ink,
    transform: [{ scale: 1.08 }],
  },
  colorWrap: {
    position: 'relative',
    zIndex: 4,
  },
  colorBtn: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  colorBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  colorMenu: {
    position: 'absolute',
    top: 40,
    left: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    width: 196,
    padding: 10,
    borderRadius: radii.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
    zIndex: 8,
  },
  boldMark: {
    fontWeight: '800',
  },
  italicMark: {
    fontStyle: 'italic',
    fontWeight: '700',
  },
  fontSizeField: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    gap: 4,
  },
  fontStep: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontStepLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  fontSizeInput: {
    width: 54,
    paddingVertical: 0,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  fontSizeUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
    paddingRight: 4,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  chipLabelOn: {
    color: colors.cream,
  },
  hint: {
    color: colors.muted,
    fontSize: 13,
    flexShrink: 1,
  },
  primary: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: radii.button,
    backgroundColor: colors.teal,
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 14,
  },
  disabled: {
    opacity: 0.4,
  },
  errorBar: {
    backgroundColor: colors.dangerBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    backgroundColor: colors.pdfStage,
  },
  pageImage: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    position: 'absolute',
    overflow: 'visible',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: 18,
    color: colors.ink,
  },
  muted: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.card,
  },
  pageBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  pageBtnLabel: {
    color: colors.teal,
    fontWeight: '700',
    fontSize: 16,
  },
  pageLabel: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 15,
  },
});
