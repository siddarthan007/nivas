'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/contexts/AuthContext';

export const PLAN_MANAGED_FEATURE_KEYS = [
    'enableHotel',
    'enableFoodAndBeverage',
    'enableGuestPortal',
    'enableHousekeeping',
    'enableInventory',
    'enableFonepay',
    'enableBanquets',
] as const;

export type PlanManagedFeatureKey = typeof PLAN_MANAGED_FEATURE_KEYS[number];

export interface HotelSettings {
    slug?: string;
    name?: string;
    logo?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    checkInTime?: string;
    checkOutTime?: string;
    taxRate?: number;
    serviceCharge?: number;
    panNumber?: string;
    vatNumber?: string;
    latitude?: string;
    longitude?: string;
    enableHotel?: boolean;
    enableFoodAndBeverage?: boolean;
    enableGuestPortal?: boolean;
    enableHousekeeping?: boolean;
    enableInventory?: boolean;
    enableFonepay?: boolean;
    enableBanquets?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
}

type SettingsApi = {
    slug?: string;
    branding?: { name?: string; logoUrl?: string };
    contact?: { email?: string; phone?: string; address?: string; website?: string; latitude?: string; longitude?: string };
    tax?: { panNumber?: string; vatNumber?: string; serviceChargeRate?: number; taxRate?: number };
    regional?: { checkInTime?: string; checkOutTime?: string };
    features?: Record<string, boolean>;
};

function flattenSettings(raw: SettingsApi): HotelSettings {
    const f = raw.features || {};
    return {
        slug: raw.slug,
        name: raw.branding?.name,
        logo: raw.branding?.logoUrl,
        email: raw.contact?.email,
        phone: raw.contact?.phone,
        address: raw.contact?.address,
        website: raw.contact?.website,
        latitude: raw.contact?.latitude,
        longitude: raw.contact?.longitude,
        checkInTime: raw.regional?.checkInTime,
        checkOutTime: raw.regional?.checkOutTime,
        taxRate: raw.tax?.taxRate,
        serviceCharge: raw.tax?.serviceChargeRate,
        panNumber: raw.tax?.panNumber,
        vatNumber: raw.tax?.vatNumber,
        enableHotel: f.enableHotel ?? true,
        enableFoodAndBeverage: f.enableFoodAndBeverage ?? true,
        enableGuestPortal: f.enableGuestPortal ?? false,
        enableHousekeeping: f.enableHousekeeping ?? true,
        enableInventory: f.enableInventory ?? true,
        enableFonepay: f.enableFonepay ?? false,
        enableBanquets: f.enableBanquets ?? false,
        emailNotifications: f.emailNotifications ?? true,
        smsNotifications: f.smsNotifications ?? false,
    };
}

export function useSettings() {
    const { user, isLoading: authLoading } = useAuth();
    const isPlatformAdmin = user?.userType === 'SUPER_ADMIN';

    const [settings, setSettings] = useState<HotelSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        if (isPlatformAdmin) {
            setSettings(null);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<SettingsApi>('/settings');
            setSettings(flattenSettings(res.data || {}));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to load settings';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, [isPlatformAdmin]);

    useEffect(() => {
        if (authLoading) return;
        void fetchSettings();
    }, [authLoading, fetchSettings]);

    const updateSettings = useCallback(async (patch: Partial<HotelSettings>) => {
        if (isPlatformAdmin) return;
        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);
        try {
            const tasks: Promise<unknown>[] = [];

            if (patch.name !== undefined || patch.logo !== undefined) {
                tasks.push(api.patch('/settings/branding', {
                    ...(patch.name !== undefined && { name: patch.name }),
                    ...(patch.logo !== undefined && { logoUrl: patch.logo }),
                }));
            }
            if (patch.email !== undefined || patch.phone !== undefined || patch.address !== undefined
                || patch.website !== undefined || patch.latitude !== undefined || patch.longitude !== undefined) {
                tasks.push(api.patch('/settings/contact', {
                    ...(patch.email !== undefined && { email: patch.email }),
                    ...(patch.phone !== undefined && { phone: patch.phone }),
                    ...(patch.address !== undefined && { address: patch.address }),
                    ...(patch.website !== undefined && { website: patch.website }),
                    ...(patch.latitude !== undefined && { latitude: patch.latitude }),
                    ...(patch.longitude !== undefined && { longitude: patch.longitude }),
                }));
            }
            if (patch.taxRate !== undefined || patch.serviceCharge !== undefined
                || patch.panNumber !== undefined || patch.vatNumber !== undefined) {
                tasks.push(api.patch('/settings/tax', {
                    ...(patch.taxRate !== undefined && { taxRate: patch.taxRate }),
                    ...(patch.serviceCharge !== undefined && { serviceChargeRate: patch.serviceCharge }),
                    ...(patch.panNumber !== undefined && { panNumber: patch.panNumber }),
                    ...(patch.vatNumber !== undefined && { vatNumber: patch.vatNumber }),
                }));
            }
            if (patch.checkInTime !== undefined || patch.checkOutTime !== undefined) {
                tasks.push(api.patch('/settings/regional', {
                    ...(patch.checkInTime !== undefined && { checkInTime: patch.checkInTime }),
                    ...(patch.checkOutTime !== undefined && { checkOutTime: patch.checkOutTime }),
                }));
            }
            if (patch.emailNotifications !== undefined || patch.smsNotifications !== undefined) {
                tasks.push(api.patch('/settings/features', {
                    ...(patch.emailNotifications !== undefined && { emailNotifications: patch.emailNotifications }),
                    ...(patch.smsNotifications !== undefined && { smsNotifications: patch.smsNotifications }),
                }));
            }

            await Promise.all(tasks);
            setSettings(prev => ({ ...prev, ...patch }));
            setSuccessMessage('Settings saved');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to save settings';
            setError(msg);
        } finally {
            setIsSaving(false);
        }
    }, [isPlatformAdmin]);

    const toggleFeature = useCallback(async (key: keyof HotelSettings) => {
        if (isPlatformAdmin) return;
        if (PLAN_MANAGED_FEATURE_KEYS.includes(key as PlanManagedFeatureKey)) {
            setError('This module is managed by your subscription plan. Upgrade or change your plan to enable it.');
            return;
        }
        const current = settings?.[key];
        if (typeof current !== 'boolean') return;
        setIsSaving(true);
        setError(null);
        try {
            await api.patch('/settings/features', { [key]: !current });
            setSettings(prev => prev ? { ...prev, [key]: !current } : prev);
            setSuccessMessage('Feature updated');
            setTimeout(() => setSuccessMessage(null), 2000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to update feature';
            setError(msg);
        } finally {
            setIsSaving(false);
        }
    }, [settings, isPlatformAdmin]);

    return {
        settings,
        isLoading,
        isSaving,
        error,
        successMessage,
        updateSettings,
        toggleFeature,
        refetch: fetchSettings,
        planManagedFeatureKeys: PLAN_MANAGED_FEATURE_KEYS,
    };
}
