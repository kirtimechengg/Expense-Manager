/**
 * ADD / EDIT CATEGORY — opens as a sheet.
 *   /category?kind=expense   → new expense category
 *   /category?id=abc         → edit existing
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/text';
import { Button, CategoryIcon, Segmented, tap, type IconName } from '@/components/ui';
import { closeScreen } from '@/lib/nav';
import { confirm } from '@/lib/confirm';
import { CATEGORY_ICONS } from '@/lib/defaults';
import type { TxnType } from '@/lib/types';
import { useData } from '@/state/data';
import { CATEGORY_COLORS, radius, space, useTheme } from '@/theme';

export default function CategorySheet() {
  const { id, kind: kindParam } = useLocalSearchParams<{ id?: string; kind?: TxnType }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { categoryById, categories, transactions, saveCategory, removeCategory } = useData();
  const existing = id ? categoryById.get(id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [kind, setKind] = useState<TxnType>(existing?.kind ?? kindParam ?? 'expense');
  const [icon, setIcon] = useState<string>(existing?.icon ?? 'pricetag');
  const [color, setColor] = useState<string>(existing?.color ?? CATEGORY_COLORS[0]);

  const trimmed = name.trim();
  const duplicate = categories.some((c) => c.id !== existing?.id && c.kind === kind && c.name.toLowerCase() === trimmed.toLowerCase());
  const canSave = trimmed.length > 0 && !duplicate;
  const usage = existing ? transactions.filter((t) => t.categoryId === existing.id).length : 0;

  async function onSave() {
    if (!canSave) return;
    await saveCategory({ id: existing?.id, name: trimmed, kind, icon, color });
    closeScreen();
  }

  function onDelete() {
    if (!existing) return;
    const msg = usage
      ? `${usage} transaction(s) use “${existing.name}”. They will be kept and shown as “Uncategorised”.`
      : 'This category is not used by any transaction.';
    confirm('Delete category?', msg, 'Delete', async () => {
      await removeCategory(existing.id);
      closeScreen();
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.topBar, { paddingTop: Platform.OS === 'android' ? insets.top + 8 : 16 }]}>
        <Pressable onPress={() => closeScreen()} hitSlop={10}>
          <AppText tone="primary" variant="bodyStrong">Cancel</AppText>
        </Pressable>
        <AppText variant="heading">{existing ? 'Edit category' : 'New category'}</AppText>
        {existing ? (
          <Pressable onPress={onDelete} hitSlop={10} accessibilityLabel="Delete category">
            <Ionicons name="trash-outline" size={22} color={colors.expense} />
          </Pressable>
        ) : (
          <View style={{ width: 50 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: space.md }}>
          <CategoryIcon icon={icon} color={color} size={72} />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Category name"
            placeholderTextColor={colors.textFaint}
            autoFocus={!existing}
            style={[styles.nameInput, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
          />
          {duplicate ? <AppText variant="caption" tone="expense">A category with this name already exists.</AppText> : null}
        </View>

        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Type</AppText>
          <Segmented<TxnType>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
              { value: 'investment', label: 'Investment' },
            ]}
          />
          {existing && usage > 0 && kind !== existing.kind ? (
            <AppText variant="caption" tone="muted">Its {usage} transaction(s) will move to “{kind}”.</AppText>
          ) : null}
        </View>

        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Colour</AppText>
          <View style={styles.wrap}>
            {CATEGORY_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => { tap(); setColor(c); }}
                accessibilityLabel={`Colour ${c}`}
                style={[styles.swatch, { backgroundColor: c, borderColor: c === color ? colors.text : 'transparent' }]}>
                {c === color ? <Ionicons name="checkmark" size={18} color="#fff" /> : null}
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Icon</AppText>
          <View style={styles.wrap}>
            {CATEGORY_ICONS.map((i) => {
              const sel = i === icon;
              return (
                <Pressable
                  key={i}
                  onPress={() => { tap(); setIcon(i); }}
                  style={[styles.iconCell, { backgroundColor: sel ? color + '22' : colors.card, borderColor: sel ? color : colors.border }]}>
                  <Ionicons name={i as IconName} size={22} color={sel ? color : colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={{ padding: space.lg, paddingBottom: Math.max(insets.bottom, space.lg) }}>
        <Button label={existing ? 'Save changes' : 'Create category'} onPress={onSave} disabled={!canSave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingBottom: 8 },
  nameInput: {
    alignSelf: 'stretch', borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg,
    height: 52, fontSize: 18, fontWeight: '600', textAlign: 'center',
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  iconCell: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
