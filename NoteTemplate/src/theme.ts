import { StyleSheet } from 'react-native';

export const colors = {
  paper: '#f7f6f3',
  paperDeep: '#efece6',
  card: '#ffffff',
  ink: '#1f2933',
  muted: '#6b7280',
  line: '#e6e3dc',
  teal: '#1d4ed8',
  tealDeep: '#1e40af',
  gold: '#1d4ed8',
  cream: '#ffffff',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  infoBg: '#eef2ff',
  pdfStage: '#efece6',
};

export const radii = {
  card: 12,
  button: 8,
  pill: 6,
};

export const shadow = {
  shadowColor: '#1f2933',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
};

export const fonts = StyleSheet.create({
  serif: {
    fontFamily: 'Georgia',
    fontWeight: '600',
    color: colors.ink,
  },
});
