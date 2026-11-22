/**
 * ADD / EDIT TRANSACTION — opens as a sheet.
 *   /transaction          → add new
 *   /transaction?id=abc   → edit existing
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarGrid } from '@/components/calendar-grid';
import { ReceiptImage, useReceiptUri } from '@/components/receipt-image';
import { AppText } from '@/components/text';
import { Button, CategoryIcon, Chip, Segmented, tap } from '@/components/ui';
import { closeScreen } from '@/lib/nav';
import { confirm, notify } from '@/lib/confirm';
import { addDays, addMonths, friendlyDate, monthLabel, parseDateKey, todayKey, type MonthRef } from '@/lib/dates';
import { parseAmount } from '@/lib/money';
import { deleteLocalReceipt, pickReceiptPhoto, receiptDisplayUri, type SavedReceipt } from '@/lib/receipts';
import type { TxnType } from '@/lib/types';
import { useData } from '@/state/data';
import { usePeriod } from '@/state/period';
import { radius, space, useTheme } from '@/theme';

export default function TransactionSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { transactions, categories, categoryById, saveTransaction, removeTransaction } = useData();
  const { period, isCurrent } = usePeriod();
  const existing = useMemo(() => (id ? transactions.find((t) => t.id === id) : undefined), [id, transactions]);

  // When adding while looking at a past month, default the date to that month.
  const defaultDate = isCurrent ? todayKey() : `${period.year}-${String(period.month + 1).padStart(2, '0')}-01`;

  const [type, setType] = useState<TxnType>(existing?.type ?? 'expense');
  const [amountText, setAmountText] = useState(existing ? String(existing.amount) : '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? '');
  const [date, setDate] = useState(existing?.date ?? defaultDate);
  const [note, setNote] = useState(existing?.note ?? '');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState<MonthRef>(() => {
    const d = parseDateKey(existing?.date ?? defaultDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [saving, setSaving] = useState(false);

  // Receipt photo. undefined = unchanged, null = removed, object = newly picked (saved on "Save").
  const [receipt, setReceipt] = useState<SavedReceipt | null | undefined>(undefined);
  const existingPhoto = useReceiptUri(existing?.receiptPath ? existing : undefined);
  const savedRef = useRef(false);
  const pendingRef = useRef<SavedReceipt | null | undefined>(undefined);
  useEffect(() => {
    pendingRef.current = receipt;
  }, [receipt]);
  // A photo picked but never saved (sheet cancelled) is deleted again.
  useEffect(() => () => {
    if (!savedRef.current && pendingRef.current) deleteLocalReceipt(pendingRef.current.localRef);
  }, []);

  async function addPhoto(source: 'camera' | 'library') {
    try {
      const picked = await pickReceiptPhoto(source);
      if (!picked) return;
      if (receipt) deleteLocalReceipt(receipt.localRef); // replacing a photo picked a moment ago
      setReceipt(picked);
    } catch (e) {
      notify('Could not add photo', (e as Error).message);
    }
  }

  function removePhoto() {
    if (receipt) deleteLocalReceipt(receipt.localRef);
    setReceipt(existing?.receiptPath ? null : undefined);
  }

  const photo =
    receipt ? { uri: receiptDisplayUri(receipt.localRef), loading: false, error: null }
      : receipt === null || !existing?.receiptPath ? null
        : existingPhoto;

  // When the user creates a category via "New", select it automatically on return.
  const knownCategoryIds = useRef(new Set(categories.map((c) => c.id)));
  useEffect(() => {
    const added = categories.find((c) => !knownCategoryIds.current.has(c.id));
    categories.forEach((c) => knownCategoryIds.current.add(c.id));
    if (added) {
      setType(added.kind);
      setCategoryId(added.id);
    }
  }, [categories]);

  const visibleCategories = categories.filter((c) => c.kind === type);
  const amount = parseAmount(amountText);
  const categoryValid = categoryById.get(categoryId)?.kind === type;
  const canSave = amount !== null && amount > 0 && categoryValid && !saving;
  const accent = type === 'income' ? colors.income : type === 'investment' ? colors.invest : colors.expense;

  async function onSave() {
    if (!canSave || amount === null) return;
    setSaving(true);
    try {
      await saveTransaction({ id: existing?.id, type, amount, categoryId, date, note: note.trim(), receipt });
      savedRef.current = true;
      closeScreen();
    } finally {
      setSaving(false);
    }
  }

  function onDelete() {
    if (!existing) return;
    confirm('Delete transaction?', 'This cannot be undone.', 'Delete', async () => {
      await removeTransaction(existing.id);
      closeScreen();
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'android' ? insets.top + 8 : 16 }]}>
        <Pressable onPress={() => closeScreen()} hitSlop={10}>
          <AppText tone="primary" variant="bodyStrong">Cancel</AppText>
        </Pressable>
        <AppText variant="heading">{existing ? 'Edit transaction' : 'New transaction'}</AppText>
        {existing ? (
          <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Delete">
            <Ionicons name="trash-outline" size={22} color={colors.expense} />
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Segmented<TxnType>
          value={type}
          onChange={(v) => { setType(v); setCategoryId(''); }}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
            { value: 'investment', label: 'Investment' },
          ]}
        />

        {/* Amount */}
        <View style={styles.amountWrap}>
          <AppText style={[styles.currency, { color: accent }]}>₹</AppText>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            keyboardType="decimal-pad"
            autoFocus={!existing}
            style={[styles.amountInput, { color: colors.text }]}
            accessibilityLabel="Amount"
          />
        </View>
        {amountText !== '' && amount === null ? (
          <AppText variant="caption" tone="expense" style={{ textAlign: 'center', marginTop: -space.lg }}>
            Enter a valid amount (up to 2 decimals)
          </AppText>
        ) : null}

        {/* Category */}
        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Category</AppText>
          <View style={styles.catGrid}>
            {visibleCategories.map((c) => {
              const sel = c.id === categoryId;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => { tap(); setCategoryId(c.id); }}
                  style={[styles.catItem, { backgroundColor: sel ? c.color + '1F' : colors.card, borderColor: sel ? c.color : colors.border }]}>
                  <CategoryIcon icon={c.icon} color={c.color} size={34} />
                  <AppText variant="caption" numberOfLines={1} style={{ textAlign: 'center', fontWeight: sel ? '700' : '500' }}>
                    {c.name}
                  </AppText>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => router.push({ pathname: '/category', params: { kind: type } })}
              style={[styles.catItem, { borderColor: colors.border, borderStyle: 'dashed' }]}>
              <View style={[styles.newCat, { backgroundColor: colors.cardMuted }]}>
                <Ionicons name="add" size={20} color={colors.textMuted} />
              </View>
              <AppText variant="caption" tone="muted">New</AppText>
            </Pressable>
          </View>
        </View>

        {/* Date */}
        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Date</AppText>
          <View style={styles.row}>
            <Chip label="Today" selected={date === todayKey()} onPress={() => { setDate(todayKey()); setShowCalendar(false); }} />
            <Chip label="Yesterday" selected={date === addDays(todayKey(), -1)} onPress={() => { setDate(addDays(todayKey(), -1)); setShowCalendar(false); }} />
            <Chip
              icon="calendar"
              label={date !== todayKey() && date !== addDays(todayKey(), -1) ? friendlyDate(date) : 'Pick date'}
              selected={showCalendar || (date !== todayKey() && date !== addDays(todayKey(), -1))}
              onPress={() => setShowCalendar((s) => !s)}
            />
          </View>
          {showCalendar ? (
            <View style={[styles.calendar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.calHeader}>
                <Pressable onPress={() => setCalMonth((m) => addMonths(m, -1))} hitSlop={10}>
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <AppText variant="bodyStrong">{monthLabel(calMonth)}</AppText>
                <Pressable onPress={() => setCalMonth((m) => addMonths(m, 1))} hitSlop={10}>
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
              </View>
              <CalendarGrid month={calMonth} selected={date} onSelect={(d) => { setDate(d); setShowCalendar(false); }} />
            </View>
          ) : null}
        </View>

        {/* Note */}
        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Note</AppText>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Dinner with family"
            placeholderTextColor={colors.textFaint}
            style={[styles.noteInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
            returnKeyType="done"
            onSubmitEditing={onSave}
          />
        </View>

        {/* Receipt photo */}
        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Receipt</AppText>
          {photo ? (
            <View style={styles.photoRow}>
              <Pressable
                accessibilityLabel="View receipt"
                disabled={!existing || receipt !== undefined}
                onPress={() => existing && router.push({ pathname: '/receipt', params: { id: existing.id } })}>
                <ReceiptImage uri={photo.uri} loading={photo.loading} error={photo.error} style={styles.thumb} />
              </Pressable>
              <View style={{ flex: 1, gap: space.sm }}>
                <Button label="Replace" icon="camera-outline" variant="secondary" onPress={() => addPhoto(Platform.OS === 'web' ? 'library' : 'camera')} />
                <Button label="Remove" icon="trash-outline" variant="danger" onPress={removePhoto} />
              </View>
            </View>
          ) : (
            <View style={styles.photoRow}>
              {Platform.OS !== 'web' ? (
                <Button label="Take photo" icon="camera-outline" variant="secondary" onPress={() => addPhoto('camera')} style={{ flex: 1 }} />
              ) : null}
              <Button label="Choose photo" icon="images-outline" variant="secondary" onPress={() => addPhoto('library')} style={{ flex: 1 }} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ padding: space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }}>
        <Button label={existing ? 'Save changes' : 'Add transaction'} onPress={onSave} disabled={!canSave} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: 8 },
  amountWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  currency: { fontSize: 36, fontWeight: '700' },
  amountInput: { fontSize: 52, fontWeight: '800', minWidth: 80, textAlign: 'center', letterSpacing: -1, padding: 0 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catItem: {
    width: '23%', flexGrow: 1, maxWidth: '25%', alignItems: 'center', gap: 6, paddingVertical: space.md, paddingHorizontal: 4,
    borderRadius: radius.md, borderWidth: 1,
  },
  newCat: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  calendar: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space.md, gap: space.sm },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.sm, marginBottom: 4 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: { width: 110, height: 140, borderRadius: radius.md },
  noteInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, height: 50, fontSize: 15 },
});
