import { create } from 'zustand';
import { mobileTokenStorage } from '../utils/auth';
import * as SecureStore from 'expo-secure-store';
import { api, setUnauthorizedHandler } from '@/api/client';
import { withTimeout } from '@/utils/withTimeout';
import type { MobilePersonaPayload } from '@/constants/mobilePersona';

const RESTORE_TIMEOUT_MS = 12_000;

export interface User {
    id: string;
    email: string;
    name: string;
    hotelId: number | null;
    role: string;
    type: 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';
}

function base64Decode(input: string): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    const str = input.replace(/-/g, '+').replace(/_/g, '/');
    let output = '';
    let i = 0;
    while (i < str.length) {
        const enc1 = chars.indexOf(str.charAt(i++));
        const enc2 = chars.indexOf(str.charAt(i++));
        const enc3 = chars.indexOf(str.charAt(i++));
        const enc4 = chars.indexOf(str.charAt(i++));
        const chr1 = (enc1 << 2) | (enc2 >> 4);
        const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        const chr3 = ((enc3 & 3) << 6) | enc4;
        output += String.fromCharCode(chr1);
        if (enc3 !== 64) output += String.fromCharCode(chr2);
        if (enc4 !== 64) output += String.fromCharCode(chr3);
    }
    return output;
}

function decodeJwtPayload(token: string): any | null {
    try {
        const payload = token.split('.')[1];
        if (!payload) return null;
        const json = base64Decode(payload);
        return JSON.parse(json);
    } catch {
        return null;
    }
}

/** Build fresh user from profile API response */
function buildUserFromProfile(raw: any): User | null {
    if (!raw || !raw.id) return null;
    const name = typeof raw.name === 'string' ? raw.name : typeof raw.fullName === 'string' ? raw.fullName : 'User';
    const role = typeof raw.role === 'string' ? raw.role : typeof raw.role?.name === 'string' ? raw.role.name : 'Staff';
    return {
        id: String(raw.id),
        email: String(raw.email || ''),
        name,
        hotelId: raw.hotelId ?? null,
        role,
        type: raw.userType || raw.type || 'HOTEL_STAFF',
    };
}

interface AuthState {
    token: string | null;
    user: User | null;
    permissions: string[];
    mobile: MobilePersonaPayload | null;
    isAuthenticated: boolean;
    requiresBiometric: boolean;
    isLoading: boolean;
    setAuth: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
    restore: () => Promise<void>;
    completeBiometricAuth: () => void;
    hasPermission: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    token: null,
    user: null,
    permissions: [],
    mobile: null,
    isAuthenticated: false,
    requiresBiometric: false,
    isLoading: true,

    hasPermission: (permission: string) => {
        const perms = get().permissions;
        if (perms.includes('*')) return true;
        return perms.includes(permission);
    },

    setAuth: async (token, rawUser) => {
        await mobileTokenStorage.setToken(token);
        // On login, attempt to fetch fresh profile immediately to get explicit permissions
        let finalUser = rawUser;
        let finalPermissions: string[] = [];
        let finalMobile: MobilePersonaPayload | null = null;
        try {
            const res = await api.iam.profile.get();
            if (!res.error && res.data?.data) {
                const freshUser = buildUserFromProfile(res.data.data);
                if (freshUser) {
                    finalUser = freshUser;
                    finalPermissions = (res.data.data as any).role?.permissions || [];
                    finalMobile = (res.data.data as any).mobile ?? null;
                }
            }
        } catch (e) {
            console.warn('[AuthStore] setAuth profile fetch failed, fallback to JWT', e);
            const payload = decodeJwtPayload(token);
            finalPermissions = payload?.permissions || [];
        }

        await mobileTokenStorage.setUser(finalUser);
        set({ token, user: finalUser, permissions: finalPermissions, mobile: finalMobile, isAuthenticated: true, requiresBiometric: false });
    },

    logout: async () => {
        await mobileTokenStorage.removeToken();
        set({ token: null, user: null, permissions: [], mobile: null, isAuthenticated: false, requiresBiometric: false });
    },

    restore: async () => {
        try {
            const token = await mobileTokenStorage.getToken();
            if (!token) {
                set({ isAuthenticated: false, isLoading: false });
                return;
            }

            // Fetch fresh profile instead of trusting storage (bounded wait — a bad
            // API URL on device makes fetch hang forever without a timeout).
            const res = await withTimeout(
                api.iam.profile.get(),
                RESTORE_TIMEOUT_MS,
                'Could not reach the server. Check EXPO_PUBLIC_API_URL (use your PC LAN IP, not localhost).',
            );
            if (res.error || !res.data?.data) {
                // Invalid token / profile
                await mobileTokenStorage.removeToken();
                set({ isAuthenticated: false, isLoading: false });
                return;
            }

            const user = buildUserFromProfile(res.data.data);
            if (!user) {
                set({ isAuthenticated: false, isLoading: false });
                return;
            }
            
            await mobileTokenStorage.setUser(user);
            const permissions = (res.data.data as any).role?.permissions || [];
            const mobile = (res.data.data as any).mobile ?? null;

            const storedSettings = await SecureStore.getItemAsync('nivas_app_settings');
            const settings = storedSettings ? JSON.parse(storedSettings) : null;
            const biometricEnabled = settings?.biometricEnabled || false;

            if (biometricEnabled) {
                set({ token, user, permissions, mobile, requiresBiometric: true, isAuthenticated: false });
            } else {
                set({ token, user, permissions, mobile, requiresBiometric: false, isAuthenticated: true });
            }
        } catch (err) {
            console.error('[AuthStore] Restore failed:', err);
            await mobileTokenStorage.removeToken().catch(() => {});
            set({ token: null, user: null, permissions: [], mobile: null, isAuthenticated: false, requiresBiometric: false });
        } finally {
            set({ isLoading: false });
        }
    },

    completeBiometricAuth: () => {
        set({ requiresBiometric: false, isAuthenticated: true });
    }
}));

setUnauthorizedHandler(() => {
    useAuthStore.getState().logout();
});

