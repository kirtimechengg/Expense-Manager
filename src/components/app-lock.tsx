/**
 * App lock: shows a lock screen
 *   • when the app starts, and
 *   • when you come back after it was in the background longer than "Lock after".
 * While the app is in the app switcher it also shows a cover, so amounts aren't visible in the preview.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Modal, StyleSheet, View, type AppStateStatus } from 'react-native';

import { authenticate, getLockSupport, isExternalActivity, type LockSupport } from '@/lib/biometrics';
import { useData } from '@/state/data';
import { space, useTheme } from '@/theme';
import { AppText } from './text';
import { Button } from './ui';

export function AppLock({ children }: { children: ReactNode }) {
  const { prefs } = useData();
  const enabled = prefs.lockEnabled;
  const [locked, setLocked] = useState(enabled); // locked at app start if the lock is on
  const [appState, setAppState] = useState<AppStateStatus>((AppState.currentState as AppStateStatus | null) ?? 'active');
  const backgroundedAt = useRef<number | null>(null);

  // If the user turns the lock off, unlock immediately.
  if (!enabled && locked) setLocked(false);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setAppState(next);
      if (!enabled) return;
      if (next === 'background') {
        if (!isExternalActivity() && backgroundedAt.current === null) backgroundedAt.current = Date.now();
      } else if (next === 'active') {
        const since = backgroundedAt.current;
        backgroundedAt.current = null;
        if (since !== null && Date.now() - since >= prefs.lockAfterSeconds * 1000) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [enabled, prefs.lockAfterSeconds]);

  const showCover = enabled && !locked && appState !== 'active' && !isExternalActivity();

  return (
    <>
      {children}
      <Modal visible={locked} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={() => {}}>
        <LockScreen active={appState === 'active'} onUnlock={() => setLocked(false)} />
      </Modal>
      {showCover ? <PrivacyCover /> : null}
    </>
  );
}

function LockScreen({ active, onUnlock }: { active: boolean; onUnlock: () => void }) {
  const { colors } = useTheme();
  const [support, setSupport] = useState<LockSupport | null>(null);
  const method = support?.available ? support.label : null;
  const [message, setMessage] = useState<string | null>(null);
  const prompting = useRef(false);
  const autoPrompted = useRef(false);

  useEffect(() => {
    getLockSupport().then(setSupport).catch(() => setSupport(null));
  }, []);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const res = await authenticate('Unlock Wallet');
      if (res.ok) {
        setMessage(null);
        onUnlock();
      } else if (res.error === 'not_enrolled' || res.error === 'passcode_not_set' || res.error === 'not_available') {
        // The phone's screen lock was removed (or this device can't lock) — don't trap the user out of their data.
        onUnlock();
      } else if (res.error !== 'user_cancel' && res.error !== 'system_cancel' && res.error !== 'app_cancel') {
        setMessage(res.error === 'lockout' ? 'Too many attempts. Unlock your phone and try again.' : 'Could not verify. Try again.');
      }
    } finally {
      prompting.current = false;
    }
  }, [onUnlock]);

  // Ask automatically once, as soon as the app is in the foreground.
  useEffect(() => {
    if (active && support && !autoPrompted.current) {
      autoPrompted.current = true;
      unlock();
    }
  }, [active, support, unlock]);

  return (
    <LinearGradient colors={[colors.heroFrom, colors.heroTo]} style={styles.fill}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <Ionicons name="wallet" size={40} color="#fff" />
        </View>
        <AppText variant="title" style={{ color: '#fff' }}>Wallet is locked</AppText>
        <AppText style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
          {method ? `Use ${method} to unlock.` : 'Unlock to continue.'}
        </AppText>
        {message ? <AppText variant="caption" style={{ color: '#FDE68A', textAlign: 'center' }}>{message}</AppText> : null}
      </View>
      <View style={styles.bottom}>
        <Button
          label={method ? `Unlock with ${method}` : 'Unlock'}
          icon={method ? support!.icon : 'lock-open'}
          variant="secondary"
          onPress={unlock}
          style={{ backgroundColor: '#fff' }}
        />
      </View>
    </LinearGradient>
  );
}

function PrivacyCover() {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={[colors.heroFrom, colors.heroTo]} style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <View style={styles.badge}>
        <Ionicons name="wallet" size={40} color="#fff" />
      </View>
      <AppText variant="title" style={{ color: '#fff' }}>Wallet</AppText>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl },
  badge: {
    width: 84, height: 84, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center', marginBottom: space.sm,
  },
  bottom: { padding: space.xl, paddingBottom: 56 },
});
