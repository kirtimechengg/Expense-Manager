# Wallet: expense manager for iOS & Android

A modern, offline-first expense manager built with **Expo (React Native) + TypeScript**.
It's a rebuild of the earlier Gemini web app: expenses, income and investments,
monthly budgets, insights and net worth.

## Run it on your phone (about 5 minutes)

1. Install **Node.js LTS** from https://nodejs.org (one-time).
2. Install the **Expo Go** app on your phone (App Store / Play Store).
3. In a terminal:

   ```bash
   git clone https://github.com/kirtimechengg/Expense-Manager.git
   cd Expense-Manager
   npm install
   npx expo start
   ```

4. Scan the QR code: with the Camera app on iPhone, or from inside Expo Go on Android.
   Your phone and computer must be on the same Wi-Fi. If they can't connect, run `npx expo start --tunnel`.
5. To try it with sample data: **Settings → Developer → Load demo data**.

Edit any file in `src/` and save, and the app on your phone reloads by itself.

You can also run it in a browser with `npx expo start --web` (press `w`). The tab bar appears at the top there; on phones it's the native bottom bar.

## Features (current)

| Tab | What it shows |
|---|---|
| **Home** | Cash left this month, income / invested / spent, budget progress, top spending categories, 6-month trend, recent transactions |
| **Activity** | All transactions grouped by day; search; filter by type; month / year / all-time |
| **Insights** | Calendar heat-map of daily spending · yearly cash flow (chart + month table with budget) · category × month table |
| **Net Worth** | All-time net worth, income / investments / expenses / cash, investment portfolio split |
| **Settings** | Light / Dark / System theme, privacy mode (hides amounts), monthly budgets (with remarks + copy from last month), categories (icons & colours) |
| **Settings → Export & backup** | PDF report (month or year) · Excel export · JSON backup & restore · Excel import for transactions and budgets (with templates) |

The **+** button opens the Add Transaction sheet. Tap any transaction to edit or delete it.

All data is stored **on the device** in SQLite. Nothing leaves the phone unless you export or back it up.

### App lock
**Settings → Security & sync → App lock** uses your phone's own Face ID / Touch ID / fingerprint,
with the phone passcode as a fallback (the app never stores a PIN). Choose whether it locks again
**immediately**, after **1 min** or after **5 min** in the background. While the lock is on, the app-switcher
preview is covered so amounts aren't visible. If you remove your phone's screen lock, the app unlocks
instead of locking you out.

### Receipt photos
In the Add/Edit transaction sheet, use **Take photo** or **Choose photo**. Photos are shrunk to about
1600 px (usually 150–400 KB) and kept in the app's private storage. A 📎 in the list marks transactions with
a photo. Tap the photo to view it full screen and share it. With Family sync on, photos upload to a
private Supabase Storage bucket that only your household can read. Other members download a photo the first
time they open it. Photos are **not** included in JSON backups or Excel exports.

### Family sync (Supabase)
Settings → **Family sync**: sign in with your email (magic link or 6-digit code), then **create** a household
or **join** one with an invite code. Everything syncs automatically: on opening the app, every 30 s while it's open,
and a moment after each change. The app still works fully offline, and changes upload when you're back online.
If two phones edit the same item, the most recent edit wins.

**One-time Supabase setup** (project `onpytnvyosfshldlcfxz`). Do these in the Supabase dashboard:

1. **Create the tables:** SQL Editor → New query → paste all of
   [`supabase/migrations/0001_wallet_sync.sql`](supabase/migrations/0001_wallet_sync.sql) → **Run**.
   Then do the same with [`supabase/migrations/0002_receipts.sql`](supabase/migrations/0002_receipts.sql)
   (receipt photos). Each file is safe to run again.
2. **Allow the app's sign-in links:** Authentication → URL Configuration → **Redirect URLs** → add:
   - `wallet://**` (the installed app)
   - `exp://**` (testing in Expo Go)
   - `http://localhost:8081/**` (testing in a browser)
3. **Show a 6-digit code in the email** (so sign-in also works if the link opens on another device):
   Authentication → Emails → Templates → **Magic Link** → add this line to the message:
   `<p>Or enter this code in Wallet: <strong>{{ .Token }}</strong></p>`
4. **Emails to family members:** Supabase's built-in email sender is only for testing. It is heavily
   rate-limited and may only deliver to your own team's addresses. Before inviting family, set up a free
   email provider (e.g. Resend or Brevo) under Authentication → Emails → **SMTP Settings**.

The app contains only the **publishable** key, which is designed to be public. Data is protected by Row Level Security:
only members of a household can read or change its data. Never put the `secret` / `service_role` key in the app.

### Moving your data from the old Gemini Budget App
1. In the old app: **Download menu → Backup Data (JSON)**.
2. Get that file onto your phone (e.g. Google Drive / iCloud / WhatsApp to yourself).
3. In Wallet: **Settings → Backup, restore & import → Restore** and pick the file.

Categories are matched by name. The old app guessed investments from names (MF, PF, PPF, NPS, "equity", "deposit"…); those become **Investment** categories.
Old income entries go to Income categories. Receipt photos from the old app are not imported.
Running the same import twice is safe, because duplicates are skipped.

Old Excel sheets made from the old app's templates (columns `Date, Type, Category, Amount, Description` and
`Year, Month, Category, Amount, Remarks`) can be imported too.

## Project map

```
src/
  app/                    ← screens (every file here is a route)
    _layout.tsx             root: database → data → selected month → navigation
    (tabs)/_layout.tsx      bottom tab bar
    (tabs)/index.tsx        Home
    (tabs)/transactions.tsx Activity
    (tabs)/insights.tsx     Insights
    (tabs)/networth.tsx     Net Worth
    (tabs)/settings.tsx     Settings
    transaction.tsx         Add / edit transaction sheet
    category.tsx            Add / edit category sheet
    categories.tsx          Category list
    budgets.tsx             Monthly budgets
    data.tsx                Export & backup
    sync.tsx                Family sync (sign in, household, invites)
    auth-callback.tsx       Where the email sign-in link lands
  components/             ← reusable UI (cards, charts, calendar, buttons…)
  db/                     ← SQLite tables (database.ts), queries (repo.ts), demo data
  lib/                    ← plain logic: money, dates, calculations (stats.ts),
                            backup.ts (JSON), excel.ts, report.ts (PDF), files.ts (share / pick files)
  state/                  ← shared app state (data.tsx, period.tsx)
  sync/                   ← Supabase client, sync engine, sign-in & household state
supabase/migrations/      ← database setup SQL (run once in the Supabase dashboard)
  theme/                  ← colours for light & dark mode
```

**Common changes:**
- Colours: `src/theme/colors.ts`
- Default categories: `src/lib/defaults.ts` (only used the first time the app opens)
- How totals are calculated: `src/lib/stats.ts`

## Checks before committing

```bash
npx tsc --noEmit
```

```bash
npx eslint src
```

## Roadmap

- [x] **Phase 1:** Expo project, theme (light/dark), native tab navigation
- [x] **Phase 2:** SQLite data layer; add / edit / delete transactions; month switcher
- [x] **Phase 3:** Home, Activity, Insights (calendar, cash flow, category table), Net Worth
- [x] **Phase 4:** Budgets & categories management
- [x] **Phase 5:** Export PDF / Excel, JSON backup & restore (including import of the old Gemini backup), Excel templates & import
- [x] **Phase 6:** App lock (Face ID / fingerprint)
- [x] **Phase 7:** Supabase login + family sharing (secure household invites, offline sync)
- [x] **Phase 8:** Receipt photo attachments (AI scanning is not planned, since it would need a paid API key)
- [ ] **Phase 9:** App icon & splash, EAS Build → TestFlight / Play Store

## Publishing (later)

Builds are made in the cloud with **EAS** (no Mac needed for iOS):

```bash
npx eas-cli@latest build --platform all
```

Publishing needs an Apple Developer account ($99/year) and a Google Play Console account ($25 one-time).
