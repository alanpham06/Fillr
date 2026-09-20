import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^\w.\-]+/g, '_');
  return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
}

export async function sharePdfFromUrl(url: string, filename: string): Promise<void> {
  const dest = `${FileSystem.cacheDirectory ?? ''}${safeFilename(filename)}`;
  if (!dest) {
    throw new Error('No cache directory available to store the PDF.');
  }

  const result = await FileSystem.downloadAsync(url, dest);
  if (result.status && result.status >= 400) {
    throw new Error('Could not download the PDF.');
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(result.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: filename,
  });
}
