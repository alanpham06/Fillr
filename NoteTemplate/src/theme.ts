import { StyleSheet } from 'react-native';

export const colors = {
  paper: '#f4efe6',
  paperDeep: '#ebe4d6',
  card: '#fffdf8',
  ink: '#1f1b16',
  muted: '#6b6258',
  line: '#d9d0c1',
  teal: '#1f4d4a',
  tealDeep: '#163836',
  gold: '#b0894a',
  cream: '#f7f3ea',
  danger: '#8a2f2f',
  dangerBg: '#f8e6e4',
  infoBg: '#e7eee9',
  pdfStage: '#f8f4ec',
};

export const radii = {
  card: 16,
  button: 11,
  pill: 999,
};

export const shadow = {
  shadowColor: '#2f2618',
  shadowOpacity: 0.08,
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
