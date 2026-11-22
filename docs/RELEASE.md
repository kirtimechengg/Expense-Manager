# Building & publishing Wallet

Builds are made **in the cloud by EAS** (Expo Application Services), so you don't need Xcode,
Android Studio or a Mac. All commands run from the project folder on your computer.

| Profile | What you get | Who can install it |
|---|---|---|
| `preview` | Android **APK** / iOS ad-hoc build | Android: anyone with the link · iOS: only registered iPhones |
| `production` | Android **AAB** (Play Store) / iOS **App Store** build | Through the stores (or TestFlight) |

> The free Expo plan includes a limited number of cloud builds per month, which is plenty for a personal app.
> Builds wait in a queue on the free plan, usually a few minutes but sometimes longer.

---

## 1. One-time setup (≈ 5 minutes)

```bash
npx eas-cli@latest login
```
Log in with your free Expo account (create one at expo.dev if needed).

```bash
npx eas-cli@latest init
```
This links the project to your Expo account and adds `extra.eas.projectId` to `app.json`.
**Commit that change** so it isn't lost.

> **App ID:** `app.json` uses `com.kirti.wallet` for both iOS (`bundleIdentifier`) and Android (`package`).
> After the first store upload it can **never change**, so if you want something else, change it now.

---

## 2. Android test build (APK), easiest

```bash
npx eas-cli@latest build --platform android --profile preview
```
When it finishes (10–20 min), EAS prints a link and QR code. Open it on your Android phone and install the APK.
You may need to allow "Install unknown apps" for your browser. Share the same link with family members.

The first time, EAS asks to **generate a keystore**. Answer *Yes*. EAS keeps it safe for you.
(The same keystore is reused for every future build; don't delete it from expo.dev.)

---

## 3. iPhone builds (needs Apple Developer Program, $99/year)

Enroll at developer.apple.com/programs first (approval can take a day or two).

### Option A: TestFlight (recommended)
```bash
npx eas-cli@latest build --platform ios --profile production
```
```bash
npx eas-cli@latest submit --platform ios --latest
```
EAS asks for your Apple ID, then creates the certificates and the App Store Connect app record for you.
After Apple processes the build (≈ 10–30 min), open **App Store Connect → TestFlight**, add yourself and
family as testers, and install it with the **TestFlight** app.

### Option B: Ad-hoc install on specific iPhones
```bash
npx eas-cli@latest device:create
```
Open the link it shows on each iPhone to register it, then:
```bash
npx eas-cli@latest build --platform ios --profile preview
```

---

## 4. Publishing to the stores

### Google Play ($25 one-time)
1. Create the app in **Play Console** (play.google.com/console).
2. Build the store version:
   ```bash
   npx eas-cli@latest build --platform android --profile production
   ```
3. The **first** upload must be done by hand: download the `.aab` from the EAS build page and upload it in
   Play Console → *Testing → Internal testing*. Later uploads can use `eas submit -p android`
   (needs a Google service-account key; see docs.expo.dev/submit/android).
4. Fill in the store listing, content rating, **Data safety** form and the **privacy policy** URL
   (see `docs/PRIVACY.md`).

### App Store
After TestFlight works, complete the listing in App Store Connect (screenshots, description,
privacy "nutrition label", privacy policy URL) and submit the build for review.

---

## 5. Releasing an update

1. Change `"version"` in `app.json` (e.g. `1.0.0` → `1.1.0`) for user-visible releases.
   Build numbers increase automatically (`autoIncrement` in `eas.json`).
2. Build again with the same commands.

---

## Store checklist

- [ ] `npx eas-cli@latest init` done and `app.json` change committed
- [ ] App ID (`com.kirti.wallet`) is final
- [ ] Supabase: SQL files 0001 + 0002 run, Redirect URLs include `wallet://**`, custom SMTP set up
- [ ] Privacy policy published at a public URL (e.g. a GitHub Pages page or Google Doc)
- [ ] Screenshots (phone): Home, Activity, Insights, Net Worth, Family sync
- [ ] Data safety / privacy labels: email address (account), financial info (user-entered),
      photos (user-provided receipts); data is encrypted in transit and can be deleted
