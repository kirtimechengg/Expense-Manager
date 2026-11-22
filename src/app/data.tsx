/**
 * DATA — PDF reports, Excel export, JSON backup & restore, Excel import.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppText } from '@/components/text';
import { Button, Card, Segmented, type IconName } from '@/components/ui';
import { buildBackup, parseBackup } from '@/lib/backup';
import { confirm, notify } from '@/lib/confirm';
import { monthKey, todayKey } from '@/lib/dates';
import {
  buildBudgetTemplate, buildExpenseTemplate, buildExportWorkbook, readSheetRows, rowsToBudgetPlan, rowsToTransactionPlan,
} from '@/lib/excel';
import { MIME, pickFile, saveAndShare, sharePdf } from '@/lib/files';
import { summarizeResult, type ImportPlan } from '@/lib/import-plan';
import { buildReportHtml, reportTitle } from '@/lib/report';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { radius, space, useTheme } from '@/theme';

type Scope = 'month' | 'year' | 'all';
const SHEET_TYPES = [MIME.xlsx, MIME.xls, MIME.csv, 'text/comma-separated-values'];

export default function DataScreen() {
  const { colors } = useTheme();
  const { transactions, categories, budgets, importPlan } = useData();
  const { period } = usePeriod();
  const [scope, setScope] = useState<Scope>('month');
  const [busy, setBusy] = useState<string | null>(null);

  /** Runs a task with a spinner and shows any error as a message. */
  async function run(label: string, task: () => Promise<void>) {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      notify('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const budgetList = [...budgets.values()];
  const prefix = scope === 'month' ? monthKey(period) : scope === 'year' ? String(period.year) : '';
  const scopeName = scope === 'all' ? 'All time' : reportTitle({ scope, period });
  const fileTag = scope === 'all' ? 'all-time' : prefix;

  const exportPdf = () =>
    run('Creating PDF…', async () => {
      if (scope === 'all') return;
      const html = buildReportHtml({ scope, period, transactions, categories, budgets });
      await sharePdf(html, `Wallet-report-${fileTag}.pdf`);
    });

  const exportExcel = () =>
    run('Creating Excel file…', async () => {
      const b64 = buildExportWorkbook({ transactions, categories, budgets: budgetList, prefix });
      await saveAndShare(`Wallet-${fileTag}.xlsx`, b64, MIME.xlsx, { base64: true });
    });

  const backup = () =>
    run('Creating backup…', async () => {
      const json = JSON.stringify(buildBackup(categories, transactions, budgetList), null, 2);
      await saveAndShare(`Wallet-backup-${todayKey()}.json`, json, MIME.json);
    });

  /** Shows what was found in the file and asks before importing. */
  function confirmAndImport(plan: ImportPlan) {
    const parts = [
      plan.transactions.length ? `${plan.transactions.length} transaction(s)` : '',
      plan.budgets.length ? `${plan.budgets.length} budget value(s)` : '',
      plan.categories.length ? `${plan.categories.length} categor${plan.categories.length === 1 ? 'y' : 'ies'}` : '',
    ].filter(Boolean);
    if (!plan.transactions.length && !plan.budgets.length) {
      notify('Nothing to import', plan.skipped.length ? `No valid rows found.\n• ${plan.skipped.slice(0, 5).join('\n• ')}` : 'The file has no rows to import.');
      return;
    }
    const warn = plan.skipped.length ? `\n\n${plan.skipped.length} row(s) can't be read and will be skipped.` : '';
    confirm(
      `Import from ${plan.source}?`,
      `Found ${parts.join(', ')}.\n\nYour existing data is kept. Duplicates are skipped.${warn}`,
      'Import',
      () => run('Importing…', async () => {
        const result = await importPlan(plan);
        notify('Import finished', summarizeResult(result));
      }),
    );
  }

  const restore = () =>
    run('Reading backup…', async () => {
      const file = await pickFile([MIME.json, 'text/plain', '*/*']);
      if (!file) return;
      confirmAndImport(parseBackup(await file.text()));
    });

  const importSheet = (kind: 'transactions' | 'budgets') =>
    run('Reading file…', async () => {
      const file = await pickFile(SHEET_TYPES);
      if (!file) return;
      let rows: Record<string, unknown>[];
      try {
        rows = readSheetRows(await file.bytes());
      } catch {
        throw new Error('This file could not be read. Please choose an .xlsx, .xls or .csv file.');
      }
      confirmAndImport(kind === 'transactions' ? rowsToTransactionPlan(rows, categories) : rowsToBudgetPlan(rows, categories));
    });

  const template = (kind: 'transactions' | 'budgets') =>
    run('Creating template…', async () => {
      const b64 = kind === 'transactions' ? buildExpenseTemplate(categories) : buildBudgetTemplate(categories, period.year, period.month);
      await saveAndShare(kind === 'transactions' ? 'Wallet-transactions-template.xlsx' : 'Wallet-budget-template.xlsx', b64, MIME.xlsx, { base64: true });
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 60 }}>
        <Section icon="document-text" title="Reports & export" text="Share a PDF report or open your data in Excel.">
          <Segmented<Scope>
            value={scope}
            onChange={setScope}
            options={[{ value: 'month', label: 'Month' }, { value: 'year', label: 'Year' }, { value: 'all', label: 'All time' }]}
          />
          {scope !== 'all' ? <MonthSwitcher mode={scope} /> : null}
          <View style={styles.row}>
            <Button label="PDF report" icon="document-text-outline" onPress={exportPdf} disabled={scope === 'all' || !!busy} style={{ flex: 1 }} />
            <Button label="Excel" icon="grid-outline" variant="secondary" onPress={exportExcel} disabled={!!busy} style={{ flex: 1 }} />
          </View>
          <AppText variant="caption" tone="muted">
            {scope === 'all' ? 'PDF reports cover one month or one year. Excel exports everything.' : `Period: ${scopeName}`}
          </AppText>
        </Section>

        <Section icon="shield-checkmark" title="Backup & restore" text="A backup file contains everything. Keep it in Google Drive, iCloud or email it to yourself. Restoring also accepts backups from the old Budget App.">
          <View style={styles.row}>
            <Button label="Back up" icon="cloud-download-outline" onPress={backup} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Restore" icon="cloud-upload-outline" variant="secondary" onPress={restore} disabled={!!busy} style={{ flex: 1 }} />
          </View>
        </Section>

        <Section icon="grid" title="Import from Excel" text="Fill in the template (or use your old Budget App sheets) and import it. Existing data is kept and duplicates are skipped.">
          <AppText variant="label" tone="muted">Transactions</AppText>
          <View style={styles.row}>
            <Button label="Template" icon="download-outline" variant="ghost" onPress={() => template('transactions')} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Import" icon="push-outline" variant="secondary" onPress={() => importSheet('transactions')} disabled={!!busy} style={{ flex: 1 }} />
          </View>
          <AppText variant="label" tone="muted">Budgets</AppText>
          <View style={styles.row}>
            <Button label="Template" icon="download-outline" variant="ghost" onPress={() => template('budgets')} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Import" icon="push-outline" variant="secondary" onPress={() => importSheet('budgets')} disabled={!!busy} style={{ flex: 1 }} />
          </View>
        </Section>
      </ScrollView>

      {busy ? (
        <View style={styles.overlay}>
          <View style={[styles.busy, { backgroundColor: colors.card }]}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="bodyStrong">{busy}</AppText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Section({ icon, title, text, children }: { icon: IconName; title: string; text: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: space.md }}>
      <View style={styles.sectionHead}>
        <View style={[styles.sectionIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">{title}</AppText>
        </View>
      </View>
      <AppText tone="muted">{text}</AppText>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sectionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, paddingVertical: space.lg, borderRadius: radius.lg },
});
