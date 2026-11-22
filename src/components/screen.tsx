import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useTheme } from '@/theme';
import { AppText } from './text';
import { tap } from './ui';

/** Space kept free at the bottom so content never hides behind the tab bar or the + button. */
export const BOTTOM_SPACE = 140;
/** In a web browser the tab bar sits at the top of the page, so leave room for it. */
const WEB_TOP = Platform.OS === 'web' ? 64 : 0;

/** Standard tab screen: big title, optional buttons on the right, scrolling content. */
export function Screen({
  title, subtitle, right, children, scroll = true, fab = true,
}: {
  title: string; subtitle?: string; right?: ReactNode; children: ReactNode; scroll?: boolean; fab?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const header = (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        {subtitle ? <AppText variant="caption" tone="muted">{subtitle}</AppText> : null}
        <AppText variant="title">{title}</AppText>
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + WEB_TOP }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: BOTTOM_SPACE, gap: space.lg }}
          showsVerticalScrollIndicator={false}>
          {header}
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: space.lg }}>{header}</View>
          {children}
        </View>
      )}
      {fab ? <AddButton /> : null}
    </View>
  );
}

/** The round "+" button that opens the Add Transaction sheet. */
export function AddButton() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityLabel="Add transaction"
      onPress={() => { tap(); router.push('/transaction'); }}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: colors.primary, bottom: Math.max(insets.bottom, 12) + 72, transform: [{ scale: pressed ? 0.94 : 1 }] },
      ]}>
      <Ionicons name="add" size={30} color={colors.onPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: space.md, paddingBottom: space.xs, gap: space.md },
  headerRight: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  fab: {
    position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4338CA', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8,
  },
});
