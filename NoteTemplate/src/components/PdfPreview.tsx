import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radii, shadow } from '../theme';

type PdfPreviewProps = {
  title: string;
  subtitle: string;
  uri: string | null;
  kind?: 'pdf' | 'image';
  emptyTitle: string;
  emptyBody: string;
  actions?: ReactNode;
  onOpenExternally?: () => void;
  onOpenWorkspace?: () => void;
};

export function PdfPreview({
  title,
  subtitle,
  uri,
  kind = 'pdf',
  emptyTitle,
  emptyBody,
  actions,
  onOpenExternally,
  onOpenWorkspace,
}: PdfPreviewProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <View style={styles.pane}>
      <View style={styles.head}>
        <View style={styles.headCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.headActions}>
          {onOpenWorkspace && uri ? (
            <Pressable onPress={onOpenWorkspace} style={styles.workspaceBtn} accessibilityLabel="Edit">
              <Text style={styles.workspaceLabel}>Edit</Text>
            </Pressable>
          ) : null}
          {actions}
        </View>
      </View>

      <View style={styles.body}>
        {!uri ? (
          <View style={styles.empty}>
            <View style={styles.emptyRule} />
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyBody}>{emptyBody}</Text>
          </View>
        ) : failed ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Could not preview this PDF</Text>
            <Text style={styles.emptyBody}>
              Expo Go cannot run pdf.js. iOS WebView usually shows PDFs; if this
              pane stays blank, share the file into Files or Preview.
            </Text>
            {onOpenExternally ? (
              <Pressable onPress={onOpenExternally} style={styles.openBtn}>
                <Text style={styles.openLabel}>Open / Share PDF</Text>
              </Pressable>
            ) : null}
          </View>
        ) : kind === 'image' ? (
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
        ) : (
          <WebView
            source={{ uri, headers: { Accept: 'application/pdf' } }}
            style={styles.webview}
            originWhitelist={['*']}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            startInLoadingState
            setSupportMultipleWindows={false}
            renderLoading={() => (
              <View style={styles.loading}>
                <ActivityIndicator color={colors.teal} />
                <Text style={styles.loadingText}>Loading PDF…</Text>
              </View>
            )}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    minHeight: 280,
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.card,
    overflow: 'hidden',
    ...shadow,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexWrap: 'wrap',
  },
  headCopy: {
    flex: 1,
    minWidth: 120,
  },
  headActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  workspaceBtn: {
    backgroundColor: colors.teal,
    borderRadius: radii.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  workspaceLabel: {
    color: colors.cream,
    fontWeight: '700',
    fontSize: 13,
  },
  title: {
    fontFamily: 'Georgia',
    fontSize: 18,
    fontWeight: '600',
    color: colors.ink,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    flex: 1,
    backgroundColor: colors.pdfStage,
    minHeight: 220,
    position: 'relative',
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: colors.pdfStage,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 6,
  },
  emptyRule: {
    width: 48,
    height: 2,
    backgroundColor: colors.gold,
    marginBottom: 6,
  },
  emptyTitle: {
    fontFamily: 'Georgia',
    fontSize: 17,
    fontWeight: '600',
    color: colors.muted,
    textAlign: 'center',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  openBtn: {
    marginTop: 10,
    backgroundColor: colors.teal,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  openLabel: {
    color: colors.cream,
    fontWeight: '600',
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.pdfStage,
    gap: 8,
  },
  loadingText: {
    color: colors.muted,
  },
});
