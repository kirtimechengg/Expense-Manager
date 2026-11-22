/**
 * Saving, sharing and picking files — the parts that differ between phone and web.
 *  - Phone: write the file to the cache folder, then open the Share sheet
 *    (save to Files / Drive, send on WhatsApp, email…).
 *  - Web: download the file in the browser.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

export const MIME = {
  json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  csv: 'text/csv',
  pdf: 'application/pdf',
} as const;

const UTI: Record<string, string> = {
  [MIME.json]: 'public.json',
  [MIME.xlsx]: 'org.openxmlformats.spreadsheetml.sheet',
  [MIME.pdf]: 'com.adobe.pdf',
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Saves a file and lets the user share/save it. `content` is text, or base64 when `base64` is true. */
export async function saveAndShare(filename: string, content: string, mimeType: string, opts: { base64?: boolean } = {}) {
  if (Platform.OS === 'web') {
    const data = opts.base64 ? base64ToBytes(content) : content;
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mimeType }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(content, opts.base64 ? { encoding: 'base64' } : undefined);
  await shareFile(file.uri, mimeType, filename);
}

async function shareFile(uri: string, mimeType: string, title: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType, UTI: UTI[mimeType], dialogTitle: title });
}

/** Turns report HTML into a PDF and opens the Share sheet (web: opens the browser's print dialog → "Save as PDF"). */
export async function sharePdf(html: string, filename: string) {
  if (Platform.OS === 'web') {
    const frame = document.createElement('iframe');
    frame.style.position = 'fixed';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);
    const doc = frame.contentWindow!.document;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      frame.contentWindow!.focus();
      frame.contentWindow!.print();
      setTimeout(() => frame.remove(), 60_000);
    }, 300);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  // Give the PDF a friendly name instead of a random one.
  const source = new File(uri);
  const target = new File(Paths.cache, filename);
  if (target.exists) target.delete();
  await source.move(target);
  await shareFile(target.uri, MIME.pdf, filename);
}

export interface PickedFile {
  name: string;
  bytes: () => Promise<Uint8Array>;
  text: () => Promise<string>;
}

/** Opens the system file picker. Returns null if the user cancels. */
export async function pickFile(types: string[]): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: types, copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  if (Platform.OS === 'web' && asset.file) {
    const f = asset.file;
    return { name: asset.name, bytes: async () => new Uint8Array(await f.arrayBuffer()), text: () => f.text() };
  }
  const file = new File(asset.uri);
  return { name: asset.name, bytes: () => file.bytes(), text: () => file.text() };
}
