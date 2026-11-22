/**
 * SyncProvider — sign-in state, household membership and automatic syncing.
 *
 * Syncs: when the household is loaded, when the app comes to the foreground,
 * every 30 s while open, and ~1.5 s after any local change.
 */
import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useData } from '@/state/data';
import { lastSyncedAt, pendingChanges, resetSyncState, syncHousehold } from './engine';
import { onLocalChange } from './signals';
import { supabase } from './supabase';

export interface Household {
  id: string;
  name: string;
  role: 'owner' | 'member';
}

export interface Member {
  userId: string;
  email: string;
  role: 'owner' | 'member';
  joinedAt: string;
}

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'error';
  lastSyncedAt: string | null;
  pending: number;
  error: string | null;
}

interface SyncState {
  session: Session | null;
  authReady: boolean;
  household: Household | null;
  householdLoading: boolean;
  status: SyncStatus;
  sendMagicLink: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  createHousehold: (name: string) => Promise<void>;
  joinHousehold: (code: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  createInvite: () => Promise<string>;
  listMembers: () => Promise<Member[]>;
  removeMember: (userId: string) => Promise<void>;
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncState | null>(null);

/** Turns Supabase/Postgres errors into a readable sentence. */
function friendly(e: unknown): Error {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/network request failed|failed to fetch|fetch failed/i.test(msg)) return new Error('No internet connection. Try again when you are online.');
  if (/rate limit/i.test(msg)) return new Error('Too many emails were sent. Please wait a while and try again.');
  if (/expired|invalid/i.test(msg) && /otp|token/i.test(msg)) return new Error('That code is wrong or has expired. Request a new one.');
  return new Error(msg);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const { reload } = useData();
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [household, setHousehold] = useState<Household | null>(null);
  const [householdLoading, setHouseholdLoading] = useState(false);
  const [status, setStatus] = useState<SyncStatus>({ state: 'off', lastSyncedAt: null, pending: 0, error: null });
  const running = useRef(false);
  const again = useRef(false);
  const userId = session?.user.id ?? null;

  // ---- Auth ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // ---- Household membership ----
  const loadHousehold = useCallback(async () => {
    if (!userId) {
      setHousehold(null);
      return;
    }
    setHouseholdLoading(true);
    try {
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, role, households(name)')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setHousehold(null);
      } else {
        const h = data.households as unknown as { name: string } | { name: string }[] | null;
        const name = Array.isArray(h) ? h[0]?.name : h?.name;
        setHousehold({ id: data.household_id as string, name: name ?? 'Household', role: data.role as Household['role'] });
      }
    } catch (e) {
      setStatus((s) => ({ ...s, state: 'error', error: friendly(e).message }));
    } finally {
      setHouseholdLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  // ---- Syncing ----
  const householdId = household?.id ?? null;

  const runSync = useCallback(async () => {
    if (!householdId) return;
    if (running.current) {
      again.current = true; // sync once more when the current run finishes
      return;
    }
    running.current = true;
    setStatus((s) => ({ ...s, state: 'syncing' }));
    try {
      do {
        again.current = false;
        const stats = await syncHousehold(db, supabase, householdId);
        if (stats.pulled || stats.merged) await reload();
      } while (again.current);
      setStatus({ state: 'idle', lastSyncedAt: await lastSyncedAt(db, householdId), pending: await pendingChanges(db), error: null });
    } catch (e) {
      setStatus({ state: 'error', lastSyncedAt: await lastSyncedAt(db, householdId), pending: await pendingChanges(db), error: friendly(e).message });
      // Maybe we were removed from the household — re-check.
      loadHousehold();
    } finally {
      running.current = false;
    }
  }, [db, householdId, reload, loadHousehold]);

  useEffect(() => {
    if (!householdId) {
      setStatus({ state: 'off', lastSyncedAt: null, pending: 0, error: null });
      return;
    }
    runSync();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(runSync, 1500);
    };
    const offLocal = onLocalChange(debounced);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') runSync();
    }, 30_000);
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') runSync();
    });
    return () => {
      offLocal();
      clearInterval(interval);
      appSub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [householdId, runSync]);

  // ---- Actions ----
  const value = useMemo<SyncState>(() => ({
    session,
    authReady,
    household,
    householdLoading,
    status,
    sendMagicLink: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: Linking.createURL('auth-callback'), shouldCreateUser: true },
      });
      if (error) throw friendly(error);
    },
    verifyCode: async (email, code) => {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
      if (error) throw friendly(error);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      await resetSyncState(db);
      setHousehold(null);
    },
    createHousehold: async (name) => {
      const { error } = await supabase.rpc('create_household', { household_name: name });
      if (error) throw friendly(error);
      await loadHousehold();
    },
    joinHousehold: async (code) => {
      const { error } = await supabase.rpc('join_household', { invite_code: code });
      if (error) throw friendly(error);
      await loadHousehold();
    },
    leaveHousehold: async () => {
      const { error } = await supabase.rpc('leave_household');
      if (error) throw friendly(error);
      await resetSyncState(db);
      setHousehold(null);
    },
    createInvite: async () => {
      const { data, error } = await supabase.rpc('create_invite');
      if (error) throw friendly(error);
      return String(data);
    },
    listMembers: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('household_members')
        .select('user_id, email, role, joined_at')
        .eq('household_id', householdId)
        .order('joined_at');
      if (error) throw friendly(error);
      return (data ?? []).map((m) => ({ userId: m.user_id, email: m.email, role: m.role, joinedAt: m.joined_at }));
    },
    removeMember: async (memberId) => {
      const { error } = await supabase.rpc('remove_member', { member_id: memberId });
      if (error) throw friendly(error);
    },
    syncNow: runSync,
  }), [session, authReady, household, householdLoading, status, db, loadHousehold, householdId, runSync]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncState {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used inside <SyncProvider>');
  return ctx;
}
