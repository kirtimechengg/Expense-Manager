/**
 * Thin wrapper around expo-local-authentication (Face ID / Touch ID / fingerprint / device passcode).
 * We never store a PIN ourselves: the phone's own lock is the source of truth.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

export interface LockSupport {
  /** The phone has a passcode and/or biometrics set up. */
  available: boolean;
  /** "Face ID", "Fingerprint", … — for button labels. */
  label: string;
  icon: 'scan' | 'finger-print' | 'keypad';
  /** Why it isn't available, if it isn't. */
  reason?: string;
}

export async function getLockSupport(): Promise<LockSupport> {
  if (Platform.OS === 'web') {
    return { available: false, label: 'App lock', icon: 'keypad', reason: 'App lock works in the iOS and Android app, not in a web browser.' };
  }
  const [level, types] = await Promise.all([
    LocalAuthentication.getEnrolledLevelAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);
  if (level === LocalAuthentication.SecurityLevel.NONE) {
    return {
      available: false, label: 'App lock', icon: 'keypad',
      reason: 'Set up a screen lock (passcode, Face ID or fingerprint) in your phone settings first.',
    };
  }
  const hasBiometrics = level !== LocalAuthentication.SecurityLevel.SECRET;
  if (hasBiometrics && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return { available: true, label: Platform.OS === 'ios' ? 'Face ID' : 'Face unlock', icon: 'scan' };
  }
  if (hasBiometrics && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return { available: true, label: Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint', icon: 'finger-print' };
  }
  return { available: true, label: 'Device passcode', icon: 'keypad' };
}

/** Shows the system prompt. Falls back to the device passcode if biometrics fail. */
export async function authenticate(promptMessage: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return res.success ? { ok: true } : { ok: false, error: res.error };
  } catch {
    return { ok: false, error: 'not_available' }; // e.g. web browser
  }
}

// ---- Don't lock while the user is in the share sheet / file picker ----
// Opening those can send the app to the "background" on Android; that shouldn't count.

let externalDepth = 0;

export function isExternalActivity() {
  return externalDepth > 0;
}

/** Wraps a call that opens another app/system screen (share sheet, file picker, print). */
export async function withExternalActivity<T>(task: () => Promise<T>): Promise<T> {
  externalDepth++;
  try {
    return await task();
  } finally {
    // Let the "app became active again" event arrive before we stop ignoring it.
    setTimeout(() => {
      externalDepth = Math.max(0, externalDepth - 1);
    }, 1000);
  }
}
