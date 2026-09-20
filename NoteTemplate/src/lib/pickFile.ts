import * as DocumentPicker from 'expo-document-picker';
import { NOTES_NAME_RE, type UploadFile } from '../types';

const ACCEPT = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];

function guessMime(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  return 'application/pdf';
}

export function isPdfName(name: string): boolean {
  return name.toLowerCase().endsWith('.pdf');
}

export function isImageName(name: string): boolean {
  return /\.(png|jpe?g|webp)$/i.test(name);
}

export async function pickLectureOrNotesFile(
  emptyMessage: string,
): Promise<UploadFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ACCEPT,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  const name = asset.name || 'lecture.pdf';
  if (!NOTES_NAME_RE.test(name)) {
    throw new Error(emptyMessage);
  }

  return {
    uri: asset.uri,
    name,
    mimeType: asset.mimeType || guessMime(name),
  };
}
