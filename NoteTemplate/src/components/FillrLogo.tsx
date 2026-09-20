import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

const FILLR_BLUE = '#1d4ed8';
const FILLR_INK = '#1f2933';

type FillrLogoProps = {
  size?: number;
  showWordmark?: boolean;
};

export function FillrLogo({ size = 28, showWordmark = true }: FillrLogoProps) {
  return (
    <View style={styles.brand} accessibilityRole="header" accessibilityLabel="Fillr">
      <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <Rect width="32" height="32" rx="8" fill={FILLR_BLUE} />
        <Path
          d="M11 22.5V9.5h11M11 16h8"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {showWordmark ? <Text style={styles.wordmark}>Fillr</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: 'Georgia',
    fontSize: 28,
    fontWeight: '600',
    color: FILLR_INK,
    letterSpacing: -0.4,
  },
});
