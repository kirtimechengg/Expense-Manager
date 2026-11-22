/**
 * SETTINGS — appearance, privacy, budgets, categories, and (coming soon) backup & sync.
 */
import { router } from 'expo-router';
import { Alert, Platform, Switch, View } from 'react-native';

import { Screen } from '@/components/screen';
import { AppText } from '@/components/text';
import { Card, ListRow, Segmented } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import type { ThemePref } from '@/lib/types';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { space, useTheme } from '@/theme';

function comingSoon(what: string) {
  const msg = `${what} is planned for a later phase.`;
  if (Platform.OS === 'web') window.alert(msg);
  else Alert.alert('Coming soon', msg);
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { prefs, setPref, categories, transactions, loadDemo } = useData();
  const { goToToday } = usePeriod();

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
        <ListRow icon="document-text" iconColor="#EF4444" title="Export PDF report" onPress={() => comingSoon('PDF export')} />
        <ListRow icon="grid" iconColor="#10B981" title="Export to Excel" onPress={() => comingSoon('Excel export')} />
        <ListRow icon="cloud-download" iconColor="#F59E0B" title="Backup & restore (JSON)" onPress={() => comingSoon('Backup & restore')} />
        <ListRow icon="cloud-upload" iconColor="#6366F1" title="Import from Excel" onPress={() => comingSoon('Excel import')} last />
      </Group>

      <Group title="Security & sync">
        <ListRow icon="finger-print" iconColor="#14B8A6" title="App lock" subtitle="Face ID / fingerprint" onPress={() => comingSoon('App lock')} />
        <ListRow icon="people" iconColor="#3B82F6" title="Family sync" subtitle="Share with your household (Supabase)" onPress={() => comingSoon('Family sync')} last />
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
