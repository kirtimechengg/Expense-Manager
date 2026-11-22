/**
 * The Supabase client.
 *
 * The URL and *publishable* key are meant to be inside the app (they are not secrets).
 * Data is protected by Row Level Security in supabase/migrations/0001_wallet_sync.sql.
 * NEVER put the "secret" / "service_role" key in the app.
 *
 * You can point a build at another project with EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY.
 */
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState, Platform } from 'react-native';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://onpytnvyosfshldlcfxz.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY || 'sb_publishable_i4JDr5s5P9jUFMlYEhpcsA_rL7OMAdI';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // Keeps you signed in. Phones: a small SQLite key-value store. Web: the browser's localStorage
    // (expo-sqlite's web worker can't share with the app database during its first-run setup).
    storage: Platform.OS === 'web' ? undefined : Storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // we handle the magic-link URL ourselves in src/app/auth-callback.tsx
    flowType: 'pkce',
  },
});

// Refresh the login token only while the app is open (recommended by Supabase for mobile).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

// Lets automated browser tests sign in without an email. Development web builds only.
if (__DEV__ && Platform.OS === 'web') {
  (globalThis as Record<string, unknown>).__walletSupabase = supabase;
}
