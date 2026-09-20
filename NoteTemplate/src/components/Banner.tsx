import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../theme';

type BannerKind = 'error' | 'info' | 'progress';

type BannerProps = {
  kind: BannerKind;
  message: string;
};

export function Banner({ kind, message }: BannerProps) {
  return (
    <View style={[styles.banner, styles[kind]]} accessibilityRole="text">
      {kind === 'progress' ? (
        <ActivityIndicator size="small" color={colors.teal} />
      ) : null}
      <Text style={[styles.text, kind === 'error' ? styles.errorText : styles.infoText]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.button,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  error: {
    backgroundColor: colors.dangerBg,
  },
  info: {
    backgroundColor: colors.infoBg,
  },
  progress: {
    backgroundColor: colors.infoBg,
  },
  text: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.danger,
  },
  infoText: {
    color: colors.tealDeep,
  },
});
