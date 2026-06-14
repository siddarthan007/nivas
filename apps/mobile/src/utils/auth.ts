import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nivas_auth_token';
const USER_KEY = 'nivas_user_data';
const REFRESH_KEY = 'nivas_refresh_token';

export const mobileTokenStorage = {
    async getToken(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(TOKEN_KEY);
        } catch {
            return null;
        }
    },
    async setToken(token: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(TOKEN_KEY, token);
        } catch {
            /* ignore */
        }
    },
    async getRefreshToken(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(REFRESH_KEY);
        } catch {
            return null;
        }
    },
    async setRefreshToken(token: string): Promise<void> {
        try {
            await SecureStore.setItemAsync(REFRESH_KEY, token);
        } catch {
            /* ignore */
        }
    },
    async removeToken(): Promise<void> {
        try {
            await SecureStore.deleteItemAsync(TOKEN_KEY);
            await SecureStore.deleteItemAsync(USER_KEY);
            await SecureStore.deleteItemAsync(REFRESH_KEY);
        } catch {
            /* ignore */
        }
    },
    async getUser<T>(): Promise<T | null> {
        try {
            const data = await SecureStore.getItemAsync(USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },
    async setUser<T>(user: T): Promise<void> {
        try {
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
        } catch {
            /* ignore */
        }
    },
};
