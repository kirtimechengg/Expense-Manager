import { router } from 'expo-router';

/** Closes a sheet/screen. If there's nothing to go back to (e.g. opened from a link), goes Home instead. */
export function closeScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
