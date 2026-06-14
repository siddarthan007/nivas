import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const SETTINGS_KEY = 'nivas_app_settings';

export interface AppSettings {
    biometricEnabled: boolean;
    theme: 'system' | 'light' | 'dark';
    pushNotifications: boolean;
}

const defaultSettings: AppSettings = {
    biometricEnabled: false,
    theme: 'system',
    pushNotifications: true,
};

interface SettingsState {
    settings: AppSettings;
    isLoading: boolean;
    loadSettings: () => Promise<void>;
    updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
    settings: defaultSettings,
    isLoading: true,
    
    loadSettings: async () => {
        try {
            const stored = await SecureStore.getItemAsync(SETTINGS_KEY);
            if (stored) {
                set({ settings: { ...defaultSettings, ...JSON.parse(stored) }, isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (err) {
            console.error('[SettingsStore] Failed to load settings:', err);
            set({ isLoading: false });
        }
    },

    updateSettings: async (updates) => {
        try {
            const current = get().settings;
            const updated = { ...current, ...updates };
            await SecureStore.setItemAsync(SETTINGS_KEY, JSON.stringify(updated));
            set({ settings: updated });
        } catch (err) {
            console.error('[SettingsStore] Failed to save settings:', err);
        }
    }
}));
