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

The **+** button opens the Add Transaction sheet. Tap any transaction to edit or delete it.

All data is stored **on the device** in SQLite. Nothing leaves the phone yet.

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
  components/             ← reusable UI (cards, charts, calendar, buttons…)
  db/                     ← SQLite tables (database.ts), queries (repo.ts), demo data
  lib/                    ← plain logic: money formatting, dates, calculations (stats.ts)
  state/                  ← shared app state (data.tsx, period.tsx)
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
- [ ] **Phase 5:** Export PDF / Excel, JSON backup & restore (including import of the old Gemini backup), Excel templates & import
- [ ] **Phase 6:** App lock (Face ID / fingerprint)
- [ ] **Phase 7:** Supabase login + family sharing (secure household invites, offline sync)
- [ ] **Phase 8:** Receipt photo attachments (AI scanning is not planned, since it would need a paid API key)
- [ ] **Phase 9:** App icon & splash, EAS Build → TestFlight / Play Store

## Publishing (later)

Builds are made in the cloud with **EAS** (no Mac needed for iOS):

```bash
npx eas-cli@latest build --platform all
```

Publishing needs an Apple Developer account ($99/year) and a Google Play Console account ($25 one-time).
