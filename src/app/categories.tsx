/**
 * CATEGORIES — list grouped by type. Tap to edit, + to add.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/text';
import { Card, ListRow } from '@/components/ui';
import { TYPE_LABEL } from '@/lib/defaults';
import type { TxnType } from '@/lib/types';
import { useData } from '@/state/data';
import { space, useTheme } from '@/theme';

const KINDS: TxnType[] = ['expense', 'investment', 'income'];

export default function CategoriesScreen() {
  const { colors } = useTheme();
  const { categories, transactions } = useData();
  const usage = new Map<string, number>();
  for (const t of transactions) usage.set(t.categoryId, (usage.get(t.categoryId) ?? 0) + 1);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/category')} hitSlop={10} accessibilityLabel="Add category">
              <Ionicons name="add-circle" size={28} color={colors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 60 }}>
        {KINDS.map((kind) => {
          const list = categories.filter((c) => c.kind === kind);
          return (
            <View key={kind} style={{ gap: space.sm }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <AppText variant="label" tone="muted" style={{ marginLeft: space.xs }}>{TYPE_LABEL[kind]}</AppText>
                <Pressable onPress={() => router.push({ pathname: '/category', params: { kind } })} hitSlop={8}>
                  <AppText variant="caption" tone="primary">+ Add</AppText>
                </Pressable>
              </View>
              <Card padded={false}>
                {list.length === 0 ? (
                  <View style={{ padding: space.lg }}><AppText tone="muted">No categories.</AppText></View>
                ) : (
                  list.map((c, i) => (
                    <ListRow
                      key={c.id}
                      icon={c.icon as never}
                      iconColor={c.color}
                      title={c.name}
                      subtitle={`${usage.get(c.id) ?? 0} transactions`}
                      onPress={() => router.push({ pathname: '/category', params: { id: c.id } })}
                      last={i === list.length - 1}
                    />
                  ))
                )}
              </Card>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
}
