import * as Linking from 'expo-linking';
import { router } from 'expo-router';

export function handleDeepLink(url: string) {
  if (!url) return;

  const { hostname, path, queryParams } = Linking.parse(url);

  // Route: nivas://orders/123 → /orders/123
  // Route: nivas://login → /login
  if (path) {
    const route = path.startsWith('/') ? path : `/${path}`;
    router.push(route as any);
    return;
  }

  // Fallback: if just hostname is provided
  if (hostname === 'orders') {
    router.push('/(app)/orders');
  } else if (hostname === 'kitchen') {
    router.push('/(app)/kitchen');
  } else if (hostname === 'housekeeping') {
    router.push('/(app)/housekeeping');
  } else if (hostname === 'profile') {
    router.push('/(app)/profile');
  }
}

export function useDeepLinking() {
  return {
    handleDeepLink,
    createURL: (path: string) => Linking.createURL(path),
  };
}
