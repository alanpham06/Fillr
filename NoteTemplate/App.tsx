import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { TemplateScreen } from './src/screens/TemplateScreen';
import { colors } from './src/theme';

export default function App() {
  return (
    <SafeAreaView style={styles.safe} collapsable={false}>
      <StatusBar style="dark" />
      <TemplateScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.paper,
  },
});
