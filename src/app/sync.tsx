/**
 * FAMILY SYNC — sign in with an email link/code, create or join a household, invite members.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/text';
import { Button, Card, CategoryIcon, ListRow, Segmented } from '@/components/ui';
import { confirm, notify } from '@/lib/confirm';
import { timeAgo } from '@/lib/dates';
import { useSync, type Member } from '@/sync/sync-provider';
import { radius, space, useTheme } from '@/theme';

export default function SyncScreen() {
  const { colors } = useTheme();
  const { authReady, session, household, householdLoading } = useSync();

  let body: React.ReactNode;
  if (!authReady || (session && householdLoading && !household)) {
    body = <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />;
  } else if (!session) body = <SignIn />;
  else if (!household) body = <NoHousehold />;
  else body = <HouseholdView />;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        {body}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------- sign in

function SignIn() {
  const { sendMagicLink, verifyCode } = useSync();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    setBusy(true);
    try {
      await sendMagicLink(email);
      setSentTo(email.trim().toLowerCase());
      setCooldown(60);
    } catch (e) {
      notify('Could not send email', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!sentTo) return;
    setBusy(true);
    try {
      await verifyCode(sentTo, code);
    } catch (e) {
      notify('Could not sign in', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Intro
        icon="people"
        title="Share Wallet with your family"
        text="Sign in with your email to back up your data to the cloud and share it with your household. No password needed."
      />
      {!sentTo ? (
        <Card style={{ gap: space.md }}>
          <AppText variant="label" tone="muted">Email</AppText>
          <Field value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" />
          <Button label="Send sign-in link" icon="mail-outline" onPress={send} disabled={!validEmail || busy} />
        </Card>
      ) : (
        <Card style={{ gap: space.md }}>
          <AppText variant="heading">Check your email</AppText>
          <AppText tone="muted">
            We sent a sign-in email to <AppText variant="bodyStrong">{sentTo}</AppText>. Open the link on this phone, or type the
            6-digit code from the email below.
          </AppText>
          <Field
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 10))}
            placeholder="123456"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            style={{ fontSize: 24, letterSpacing: 6, textAlign: 'center', fontWeight: '700' }}
          />
          <Button label="Sign in" icon="log-in-outline" onPress={verify} disabled={code.length < 6 || busy} />
          <View style={styles.row}>
            <Button label={cooldown ? `Resend (${cooldown}s)` : 'Resend email'} variant="ghost" onPress={send} disabled={cooldown > 0 || busy} style={{ flex: 1 }} />
            <Button label="Change email" variant="ghost" onPress={() => { setSentTo(null); setCode(''); }} style={{ flex: 1 }} />
          </View>
        </Card>
      )}
      <AppText variant="caption" tone="faint" style={{ textAlign: 'center' }}>
        Your data stays on this phone too. Sync is optional and you can stop any time.
      </AppText>
    </>
  );
}

// ---------------------------------------------------------------- signed in, no household

function NoHousehold() {
  const { session, createHousehold, joinHousehold, signOut } = useSync();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      if (mode === 'create') await createHousehold(name.trim() || 'Our household');
      else await joinHousehold(code);
    } catch (e) {
      notify(mode === 'create' ? 'Could not create household' : 'Could not join', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Intro icon="home" title="Set up your household" text={`Signed in as ${session?.user.email ?? ''}.`} />
      <Card style={{ gap: space.md }}>
        <Segmented<'create' | 'join'>
          value={mode}
          onChange={setMode}
          options={[{ value: 'create', label: 'Create new' }, { value: 'join', label: 'Join with code' }]}
        />
        {mode === 'create' ? (
          <>
            <AppText tone="muted">Start a household and invite your family. Everything on this phone is uploaded to it.</AppText>
            <Field value={name} onChangeText={setName} placeholder="e.g. Sharma family" maxLength={60} />
            <Button label="Create household" icon="add-circle-outline" onPress={go} disabled={busy} />
          </>
        ) : (
          <>
            <AppText tone="muted">
              Enter the 8-character code a family member shared with you. Transactions already on this phone are added to the household;
              categories with the same name are merged.
            </AppText>
            <Field
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="ABCD2345"
              autoCapitalize="characters"
              style={{ fontSize: 22, letterSpacing: 4, textAlign: 'center', fontWeight: '700' }}
            />
            <Button label="Join household" icon="enter-outline" onPress={go} disabled={code.length !== 8 || busy} />
          </>
        )}
      </Card>
      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </>
  );
}

// ---------------------------------------------------------------- in a household

function HouseholdView() {
  const { colors } = useTheme();
  const { session, household, status, syncNow, createInvite, listMembers, removeMember, leaveHousehold, signOut } = useSync();
  const [members, setMembers] = useState<Member[]>([]);
  const [invite, setInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isOwner = household?.role === 'owner';
  const me = session?.user.id;

  const refreshMembers = useCallback(() => {
    listMembers().then(setMembers).catch(() => {});
  }, [listMembers]);
  // Reload the member list after every sync, so new members show up without reopening the screen.
  useEffect(refreshMembers, [refreshMembers, status.lastSyncedAt]);

  async function makeInvite() {
    setBusy(true);
    try {
      setInvite(await createInvite());
    } catch (e) {
      notify('Could not create invite', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function shareInvite() {
    if (!invite) return;
    Share.share({
      message: `Join our "${household?.name}" household in Wallet.\n\n1. Open Wallet → Settings → Family sync\n2. Sign in with your email\n3. Choose "Join with code" and enter: ${invite}\n\nThe code works once and expires in 7 days.`,
    }).catch(() => {});
  }

  const statusLine =
    status.state === 'syncing' ? 'Syncing…'
      : status.state === 'error' ? status.error ?? 'Sync failed'
        : status.lastSyncedAt ? `Synced ${timeAgo(status.lastSyncedAt)}`
          : 'Not synced yet';

  return (
    <>
      <Card style={{ gap: space.md }}>
        <View style={styles.row}>
          <CategoryIcon icon="home" color={colors.primary} size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading">{household?.name}</AppText>
            <AppText variant="caption" tone="muted">{session?.user.email} · {isOwner ? 'Owner' : 'Member'}</AppText>
          </View>
        </View>
        <View style={[styles.status, { backgroundColor: status.state === 'error' ? colors.expenseSoft : colors.cardMuted }]}>
          {status.state === 'syncing' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name={status.state === 'error' ? 'alert-circle' : 'checkmark-circle'}
              size={20}
              color={status.state === 'error' ? colors.expense : colors.income}
            />
          )}
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong" tone={status.state === 'error' ? 'expense' : 'default'}>{statusLine}</AppText>
            {status.pending > 0 ? <AppText variant="caption" tone="muted">{status.pending} change(s) waiting to upload</AppText> : null}
          </View>
          <Button label="Sync now" variant="ghost" onPress={syncNow} disabled={status.state === 'syncing'} style={{ paddingVertical: 6, paddingHorizontal: 8 }} />
        </View>
      </Card>

      <View style={{ gap: space.sm }}>
        <AppText variant="label" tone="muted" style={{ marginLeft: space.xs }}>Members</AppText>
        <Card padded={false}>
          {members.map((m, i) => (
            <ListRow
              key={m.userId}
              icon={m.role === 'owner' ? 'star' : 'person'}
              iconColor={m.role === 'owner' ? '#F59E0B' : '#3B82F6'}
              title={m.email || 'Member'}
              subtitle={`${m.role === 'owner' ? 'Owner' : 'Member'}${m.userId === me ? ' · you' : ''}`}
              last={i === members.length - 1}
              right={
                isOwner && m.userId !== me ? (
                  <Button
                    label="Remove"
                    variant="danger"
                    style={{ paddingVertical: 6, paddingHorizontal: 10 }}
                    onPress={() =>
                      confirm('Remove member?', `${m.email} will no longer see or change the household's data.`, 'Remove', async () => {
                        try {
                          await removeMember(m.userId);
                          refreshMembers();
                        } catch (e) {
                          notify('Could not remove', (e as Error).message);
                        }
                      })
                    }
                  />
                ) : undefined
              }
            />
          ))}
        </Card>
      </View>

      <Card style={{ gap: space.md }}>
        <AppText variant="heading">Invite a family member</AppText>
        {invite ? (
          <>
            <View style={[styles.code, { backgroundColor: colors.primarySoft }]}>
              <AppText selectable style={{ fontSize: 30, fontWeight: '800', letterSpacing: 6, color: colors.primary }}>{invite}</AppText>
            </View>
            <AppText variant="caption" tone="muted" style={{ textAlign: 'center' }}>Works once · expires in 7 days</AppText>
            <Button label="Share code" icon="share-outline" onPress={shareInvite} />
          </>
        ) : (
          <>
            <AppText tone="muted">Create a one-time code and send it to them. They sign in with their own email and enter the code.</AppText>
            <Button label="Create invite code" icon="key-outline" variant="secondary" onPress={makeInvite} disabled={busy} />
          </>
        )}
      </Card>

      <Button
        label="Leave household"
        icon="exit-outline"
        variant="danger"
        onPress={() =>
          confirm(
            'Leave household?',
            members.length <= 1
              ? 'You are the last member, so the household and its cloud copy will be deleted. Your data stays on this phone.'
              : 'You will stop seeing changes from your family. Your data stays on this phone.',
            'Leave',
            async () => {
              try {
                await leaveHousehold();
              } catch (e) {
                notify('Could not leave', (e as Error).message);
              }
            },
          )
        }
      />
      <Button label="Sign out" variant="ghost" onPress={() => confirm('Sign out?', 'Syncing stops. Your data stays on this phone.', 'Sign out', signOut)} />
    </>
  );
}

// ---------------------------------------------------------------- helpers

function Intro({ icon, title, text }: { icon: string; title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.md }}>
      <CategoryIcon icon={icon} color={colors.primary} size={64} />
      <AppText variant="title" style={{ textAlign: 'center', fontSize: 24 }}>{title}</AppText>
      <AppText tone="muted" style={{ textAlign: 'center' }}>{text}</AppText>
    </View>
  );
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
      style={[styles.input, { color: colors.text, backgroundColor: colors.cardMuted, borderColor: colors.border }, props.style]}
    />
  );
}


const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.md },
  code: { alignItems: 'center', paddingVertical: space.lg, borderRadius: radius.md },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: space.lg, height: 52, fontSize: 16 },
});
