/**
 * Root of the app. Order matters:
 *   SQLiteProvider (opens the database) → DataProvider (loads data) → PeriodProvider (selected month)
 */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Appearance, Platform } from 'react-native';

import { DATABASE_NAME, migrateDatabase } from '@/db/database';
import { DataProvider, useData } from '@/state/data';
import { PeriodProvider } from '@/state/period';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <DataProvider>
        <PeriodProvider>
          <AppNavigator />
        </PeriodProvider>
      </DataProvider>
    </SQLiteProvider>
  );
}

function AppNavigator() {
  const { ready, prefs } = useData();
  const { colors, dark } = useTheme();

  // Make native parts (tab bar, keyboard, sheets) follow the in-app theme choice.
  useEffect(() => {
    if (Platform.OS !== 'web') Appearance.setColorScheme(prefs.theme === 'system' ? 'unspecified' : prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  const navTheme = dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{ ...navTheme, colors: { ...navTheme.colors, background: colors.background, card: colors.card, primary: colors.primary, text: colors.text, border: colors.border } }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.primary, headerTitleStyle: { color: colors.text } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction"
          options={{ presentation: 'modal', headerShown: false, contentStyle: { backgroundColor: colors.background } }}
        />
        <Stack.Screen name="category" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="budgets" options={{ title: 'Monthly budgets', headerBackTitle: 'Settings' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories', headerBackTitle: 'Settings' }} />
      </Stack>
    </ThemeProvider>
  );
}
