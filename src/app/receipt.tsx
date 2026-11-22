/**
 * RECEIPT VIEWER — full-screen photo for /receipt?id=<transaction id>.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReceiptImage, useReceiptUri } from '@/components/receipt-image';
import { AppText } from '@/components/text';
import { closeScreen } from '@/lib/nav';
import { withExternalActivity } from '@/lib/biometrics';
import { notify } from '@/lib/confirm';
import { friendlyDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useData } from '@/state/data';

export default function ReceiptViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { transactions, categoryById } = useData();
  const txn = transactions.find((t) => t.id === id);
  const { uri, loading, error } = useReceiptUri(txn);

  async function share() {
    if (!uri) return;
    try {
      await withExternalActivity(() => Sharing.shareAsync(uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Receipt' }));
    } catch (e) {
      notify('Could not share', (e as Error).message);
    }
  }

  return (
    <View style={styles.root}>
      <ReceiptImage uri={uri} loading={loading} error={error ?? (txn ? null : 'Transaction not found')} contentFit="contain" style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <Round icon="close" label="Close" onPress={() => closeScreen()} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          {txn ? (
            <>
              <AppText variant="bodyStrong" style={styles.light} numberOfLines={1}>
                {txn.note || categoryById.get(txn.categoryId)?.name || 'Receipt'}
              </AppText>
              <AppText variant="caption" style={styles.dim}>
                {formatMoney(txn.amount)} · {friendlyDate(txn.date)}
              </AppText>
            </>
          ) : null}
        </View>
        {Platform.OS !== 'web' && uri ? <Round icon="share-outline" label="Share" onPress={share} /> : <View style={{ width: 40 }} />}
      </View>
    </View>
  );
}

function Round({ icon, label, onPress }: { icon: 'close' | 'share-outline'; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={10} style={styles.round}>
      <Ionicons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  bar: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.45)',
  },
  round: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  light: { color: '#fff' },
  dim: { color: 'rgba(255,255,255,0.7)' },
});
