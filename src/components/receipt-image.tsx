/**
 * Shows a transaction's receipt photo. If the photo was added on another family member's phone,
 * it's downloaded the first time it's shown.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, type ImageContentFit } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { receiptDisplayUri, receiptExists } from '@/lib/receipts';
import type { Transaction } from '@/lib/types';
import { useSync } from '@/sync/sync-provider';
import { useTheme } from '@/theme';
import { AppText } from './text';

/** Returns a displayable URI for the transaction's photo, downloading it if needed. */
export function useReceiptUri(txn: Pick<Transaction, 'id' | 'receiptPath' | 'receiptLocal'> | undefined) {
  const { getReceipt } = useSync();
  const local = txn?.receiptLocal && receiptExists(txn.receiptLocal) ? txn.receiptLocal : null;
  const [fetched, setFetched] = useState<{ path: string; ref: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsDownload = !!txn?.receiptPath && !local && fetched?.path !== txn.receiptPath;

  useEffect(() => {
    if (!needsDownload || !txn) return;
    let alive = true;
    getReceipt(txn.id, txn.receiptPath)
      .then((ref) => alive && setFetched({ path: txn.receiptPath, ref }))
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [needsDownload, txn, getReceipt]);

  const ref = local ?? (fetched?.path === txn?.receiptPath ? fetched?.ref : null);
  return { uri: ref ? receiptDisplayUri(ref) : null, loading: needsDownload && !error, error: needsDownload ? error : null };
}

export function ReceiptImage({
  uri, loading, error, style, contentFit = 'cover',
}: {
  uri: string | null; loading?: boolean; error?: string | null; style?: StyleProp<ViewStyle>; contentFit?: ImageContentFit;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.cardMuted }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={contentFit} transition={150} />
      ) : loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={{ alignItems: 'center', gap: 4, padding: 8 }}>
          <Ionicons name="image-outline" size={24} color={colors.textFaint} />
          {error ? <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }} numberOfLines={3}>{error}</AppText> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
