/**
 * Receipt photos on this device.
 *
 *  - Photos are shrunk (longest side 1600 px, JPEG 70%) — usually 150–400 KB each.
 *  - Phone: saved as files in the app's private "receipts" folder. The database stores the file name.
 *  - Web (testing only): stored inline as a data URL.
 *
 * `receipt_path` (synced, e.g. "txnId/uuid.jpg") names the photo in the cloud;
 * `receipt_local` (this device only) is where the photo is on this device, if downloaded.
 */
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { withExternalActivity } from './biometrics';

const MAX_SIDE = 1600;
const isWeb = Platform.OS === 'web';

function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export interface SavedReceipt {
  /** Where it lives on this device (file name, or data URL on web). */
  localRef: string;
  /** Name to use in the cloud, e.g. "uuid.jpg". */
  fileName: string;
}

/** Opens the camera or photo library. Returns null if cancelled; throws if permission is denied. */
export async function pickReceiptPhoto(source: 'camera' | 'library'): Promise<SavedReceipt | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera access is off. You can turn it on in your phone settings → Wallet.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, allowsEditing: false, exif: false };
  const res = await withExternalActivity(() =>
    source === 'camera' ? ImagePicker.launchCameraAsync(options) : ImagePicker.launchImageLibraryAsync(options),
  );
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  return saveShrunk(asset.uri, asset.width, asset.height);
}

async function saveShrunk(uri: string, width: number, height: number): Promise<SavedReceipt> {
  const ctx = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: isWeb });
  const fileName = `${randomUUID()}.jpg`;
  if (isWeb) return { localRef: `data:image/jpeg;base64,${result.base64}`, fileName };
  const target = new File(receiptsDir(), fileName);
  await new File(result.uri).move(target);
  return { localRef: fileName, fileName };
}

/** A URI that <Image> can display. */
export function receiptDisplayUri(localRef: string): string {
  if (isWeb || localRef.startsWith('data:')) return localRef;
  return new File(receiptsDir(), localRef).uri;
}

export function receiptExists(localRef: string | null | undefined): boolean {
  if (!localRef) return false;
  if (isWeb || localRef.startsWith('data:')) return true;
  return new File(receiptsDir(), localRef).exists;
}

/** Raw JPEG bytes (for uploading). */
export async function receiptBytes(localRef: string): Promise<Uint8Array> {
  if (localRef.startsWith('data:')) {
    const bin = atob(localRef.slice(localRef.indexOf(',') + 1));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new File(receiptsDir(), localRef).bytes();
}

/** Downloads a photo from a (signed) URL into the receipts folder and returns its localRef. */
export async function downloadReceipt(url: string, fileName: string): Promise<string> {
  if (isWeb) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    return saveDownloadedReceipt(fileName, new Uint8Array(await res.arrayBuffer()));
  }
  const target = new File(receiptsDir(), fileName);
  await File.downloadFileAsync(url, target, { idempotent: true });
  return fileName;
}

/** Saves a downloaded photo and returns its localRef. */
export async function saveDownloadedReceipt(fileName: string, bytes: Uint8Array): Promise<string> {
  if (isWeb) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:image/jpeg;base64,${btoa(bin)}`;
  }
  const file = new File(receiptsDir(), fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(bytes);
  return fileName;
}

export function deleteLocalReceipt(localRef: string | null | undefined) {
  if (!localRef || isWeb || localRef.startsWith('data:')) return;
  try {
    const f = new File(receiptsDir(), localRef);
    if (f.exists) f.delete();
  } catch {
    // already gone — fine
  }
}
