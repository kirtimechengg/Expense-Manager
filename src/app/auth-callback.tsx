/**
 * The magic link in the sign-in email opens this screen:
 *   wallet://auth-callback?code=…   (or exp://…/--/auth-callback?code=… in Expo Go)
 * We swap the one-time code for a login session, then go to the Family sync screen.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/components/text';
import { Button } from '@/components/ui';
import { supabase } from '@/sync/supabase';
import { space, useTheme } from '@/theme';

export default function AuthCallback() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(params.error_description ?? null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !params.code) return;
    started.current = true;
    supabase.auth.exchangeCodeForSession(params.code).then(({ error: e }) => {
      if (e) {
        setError(
          /code verifier|both auth code and code verifier/i.test(e.message)
            ? 'Please open the link on the same phone where you asked for it, or type the 6-digit code from the email instead.'
            : e.message,
        );
      } else {
        router.replace('/sync');
      }
    });
  }, [params.code]);

  const message = error ?? (params.code ? null : 'This sign-in link is incomplete. Please request a new one.');

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl, backgroundColor: colors.background }}>
      {message ? (
        <>
          <AppText variant="heading" style={{ textAlign: 'center' }}>Sign-in didn’t work</AppText>
          <AppText tone="muted" style={{ textAlign: 'center' }}>{message}</AppText>
          <Button label="Back to Family sync" onPress={() => router.replace('/sync')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <AppText tone="muted">Signing you in…</AppText>
        </>
      )}
    </View>
  );
}
