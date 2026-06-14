import { useAuthStore, type User } from '@/stores/authStore';

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  if (user.type === 'SUPER_ADMIN') return true;
  const { permissions } = useAuthStore.getState();
  return permissions.includes(permission);
}

export function hasAnyPermission(user: User | null, checkPermissions: string[]): boolean {
  if (!user) return false;
  if (user.type === 'SUPER_ADMIN') return true;
  const { permissions } = useAuthStore.getState();
  return checkPermissions.some((p) => permissions.includes(p));
}
