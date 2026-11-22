/**
 * SETTINGS — appearance, privacy, budgets, categories, export & backup, app lock & family sync.
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { Card, ListRow, Segmented } from '@/components/ui';
import { authenticate, getLockSupport, type LockSupport } from '@/lib/biometrics';
import { confirm, notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/dates';
import type { ThemePref } from '@/lib/types';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { useSync } from '@/sync/sync-provider';
import { space, useTheme } from '@/theme';


export default function SettingsScreen() {
  const { colors } = useTheme();
  const { prefs, setPref, categories, transactions, loadDemo } = useData();
  const { goToToday } = usePeriod();
  const { session, household, status } = useSync();
  const syncSubtitle = !session
    ? 'Back up & share with your household'
    : !household
      ? 'Signed in · set up a household'
      : status.state === 'error'
        ? 'Sync problem — tap for details'
        : status.lastSyncedAt
          ? `${household.name} · synced ${timeAgo(status.lastSyncedAt)}`
          : household.name;

  return (
    <Screen title="Settings" fab={false}>
      <Group title="Appearance">
        <View style={{ padding: space.lg, gap: space.md }}>
          <Segmented<ThemePref>
            value={prefs.theme}
            onChange={(v) => setPref('theme', v)}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </View>
        <ListRow
          icon="eye-off"
          iconColor={colors.primary}
          title="Privacy mode"
          subtitle="Hide all amounts with ••••"
          right={
            <Switch
              value={prefs.privacyMode}
              onValueChange={(v) => setPref('privacyMode', v)}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          }
        />
        <ListRow icon="calendar" iconColor="#0EA5E9" title="Jump to current month" onPress={() => { goToToday(); router.navigate('/'); }} last />
      </Group>

      <Group title="Planning">
        <ListRow icon="pie-chart" iconColor="#F97316" title="Monthly budgets" subtitle="Targets and remarks per category" onPress={() => router.push('/budgets')} />
        <ListRow icon="pricetags" iconColor="#A855F7" title="Categories" subtitle={`${categories.length} categories`} onPress={() => router.push('/categories')} last />
      </Group>

      <Group title="Data">
        <ListRow icon="document-text" iconColor="#EF4444" title="Reports & export" subtitle="PDF report, Excel" onPress={() => router.push('/data')} />
        <ListRow icon="cloud-download" iconColor="#F59E0B" title="Backup, restore & import" subtitle="JSON backup, Excel import, old Budget App files" onPress={() => router.push('/data')} last />
      </Group>

      <Group title="Security & sync">
        <AppLockSettings />
        <ListRow icon="people" iconColor="#3B82F6" title="Family sync" subtitle={syncSubtitle} onPress={() => router.push('/sync')} last />
      </Group>

      {__DEV__ ? (
        <Group title="Developer">
          <ListRow
            icon="flask"
            iconColor="#78716C"
            title="Load demo data"
            subtitle="Adds 6 months of sample transactions"
            onPress={() => confirm('Load demo data?', 'Sample transactions and budgets will be added to your data.', 'Load', loadDemo)}
            last
          />
        </Group>
      ) : null}

      <AppText variant="caption" tone="faint" style={{ textAlign: 'center' }}>
        Wallet 1.0 · {transactions.length} transactions stored on this device
      </AppText>
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="label" tone="muted" style={{ marginLeft: space.xs }}>{title}</AppText>
      <Card padded={false}>{children}</Card>
    </View>
  );
}

const LOCK_AFTER = [
  { value: '0', label: 'Immediately' },
  { value: '60', label: '1 min' },
  { value: '300', label: '5 min' },
] as const;

/** App lock switch + "lock after" choice. Turning it on or off asks for Face ID / fingerprint first. */
function AppLockSettings() {
  const { colors } = useTheme();
  const { prefs, setPref } = useData();
  const [support, setSupport] = useState<LockSupport | null>(null);

  useEffect(() => {
    getLockSupport().then(setSupport).catch(() => setSupport(null));
  }, []);

  async function toggle(on: boolean) {
    const s = await getLockSupport();
    setSupport(s);
    if (on && !s.available) {
      notify('App lock unavailable', s.reason ?? 'This device does not support app lock.');
      return;
    }
    const res = await authenticate(on ? 'Turn on app lock' : 'Turn off app lock');
    if (res.ok) await setPref('lockEnabled', on);
    else if (res.error !== 'user_cancel' && res.error !== 'system_cancel' && res.error !== 'app_cancel') {
      notify('Could not verify', 'App lock was not changed.');
    }
  }

  const subtitle = !support
    ? 'Checking…'
    : support.available
      ? `Unlock with ${support.label}`
      : (support.reason ?? 'Not available');

  return (
    <>
      <ListRow
        icon={support?.icon === 'scan' ? 'scan' : 'finger-print'}
        iconColor="#14B8A6"
        title="App lock"
        subtitle={subtitle}
        right={
          <Switch
            value={prefs.lockEnabled}
            onValueChange={toggle}
            disabled={!support || (!support.available && !prefs.lockEnabled)}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        }
      />
      {prefs.lockEnabled ? (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm }}>
          <AppText variant="caption" tone="muted">Lock again after leaving the app</AppText>
          <Segmented<(typeof LOCK_AFTER)[number]['value']>
            value={String(prefs.lockAfterSeconds) as (typeof LOCK_AFTER)[number]['value']}
            onChange={(v) => setPref('lockAfterSeconds', Number(v))}
            options={[...LOCK_AFTER]}
          />
        </View>
      ) : null}
    </>
  );
}
