/**
 * MONTHLY BUDGETS — a target (and optional remark) for every expense category.
 * Values are saved when you leave the field.
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MonthSwitcher } from '@/components/month-switcher';
import { AppText } from '@/components/text';
import { Amount, Button, Card, CategoryIcon, ProgressBar } from '@/components/ui';
import { confirm, notify } from '@/lib/confirm';
import { addMonths, monthKey, monthLabel } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { budgetLines, type BudgetLine } from '@/lib/stats';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { radius, space, useTheme } from '@/theme';

export default function BudgetsScreen() {
  const { colors } = useTheme();
  const { categories, budgets, transactions, copyBudgets } = useData();
  const { period } = usePeriod();
  const lines = budgetLines(categories, budgets, transactions, period);
  const totalBudget = lines.reduce((s, l) => s + l.budget, 0);
  const totalSpent = lines.reduce((s, l) => s + l.spent, 0);
  const prev = addMonths(period, -1);
  const [copyVersion, setCopyVersion] = useState(0);

  function onCopy() {
    confirm(
      'Copy budgets?',
      `Copy all budgets from ${monthLabel(prev)} into ${monthLabel(period)}? Existing values for ${monthLabel(period)} will be replaced.`,
      'Copy',
      async () => {
        const n = await copyBudgets(monthKey(prev), monthKey(period));
        setCopyVersion((v) => v + 1); // refresh the input boxes with the copied values
        if (n === 0) notify('Nothing to copy', `${monthLabel(prev)} has no budgets.`);
      },
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled">
        <MonthSwitcher />
        <Card>
          <View style={styles.between}>
            <View>
              <AppText variant="caption" tone="muted">Total budget</AppText>
              <Amount value={totalBudget} variant="title" />
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <AppText variant="caption" tone="muted">Spent</AppText>
              <Amount value={totalSpent} variant="heading" tone={totalBudget && totalSpent > totalBudget ? 'expense' : 'default'} />
            </View>
          </View>
          {totalBudget > 0 ? <View style={{ marginTop: space.md }}><ProgressBar value={totalSpent / totalBudget} height={10} /></View> : null}
          <Button label={`Copy from ${monthLabel(prev)}`} icon="copy-outline" variant="secondary" onPress={onCopy} style={{ marginTop: space.lg }} />
        </Card>

        {lines.map((l) => (
          // key includes the month so the input boxes reset when you switch month
          <BudgetRow key={`${monthKey(period)}|${l.category.id}|${copyVersion}`} line={l} month={monthKey(period)} />
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function BudgetRow({ line, month }: { line: BudgetLine; month: string }) {
  const { colors } = useTheme();
  const { saveBudget } = useData();
  const [amountText, setAmountText] = useState(line.budget ? String(line.budget) : '');
  const [remark, setRemark] = useState(line.remark);
  const invalid = amountText !== '' && parseAmount(amountText) === null;

  async function commit() {
    const amount = amountText === '' ? 0 : parseAmount(amountText);
    if (amount === null) return;
    if (amount === line.budget && remark.trim() === line.remark) return;
    await saveBudget({ categoryId: line.category.id, month, amount, remark: remark.trim() });
  }

  const pct = line.budget ? line.spent / line.budget : 0;
  return (
    <Card>
      <View style={styles.header}>
        <CategoryIcon icon={line.category.icon} color={line.category.color} size={36} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{line.category.name}</AppText>
          <AppText variant="caption" tone="muted">
            Spent <Amount value={line.spent} variant="caption" tone={line.budget && line.spent > line.budget ? 'expense' : 'muted'} />
            {line.budget ? ` · ${Math.round(pct * 100)}%` : ''}
          </AppText>
        </View>
        <View style={[styles.amountBox, { borderColor: invalid ? colors.expense : colors.border, backgroundColor: colors.cardMuted }]}>
          <AppText tone="muted">₹</AppText>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            onBlur={commit}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: colors.text }]}
            accessibilityLabel={`${line.category.name} budget`}
          />
        </View>
      </View>
      {line.budget ? <View style={{ marginTop: space.md }}><ProgressBar value={pct} color={line.category.color} height={6} /></View> : null}
      <TextInput
        value={remark}
        onChangeText={setRemark}
        onBlur={commit}
        placeholder="Remark (optional)"
        placeholderTextColor={colors.textFaint}
        style={[styles.remark, { color: colors.text, borderColor: colors.border }]}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  amountBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, height: 42, width: 120,
  },
  amountInput: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '700', textAlign: 'right', padding: 0, height: '100%' },
  remark: { marginTop: space.md, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, fontSize: 14 },
});
