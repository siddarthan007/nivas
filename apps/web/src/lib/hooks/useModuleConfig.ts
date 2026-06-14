'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

import { isNavIdAllowed, type PropertyModuleConfig as ModuleConfig } from '@/lib/config/property-modules';

const DEFAULT_CONFIG: ModuleConfig = {
    enableHotel: true,
    enableFoodAndBeverage: true,
    enableBanquets: false,
};

export function useModuleConfig() {
    const [config, setConfig] = useState<ModuleConfig>(DEFAULT_CONFIG);
    const [isLoading, setIsLoading] = useState(true);

    const hasHotel = useCallback(() => {
        try {
            const userStr = localStorage.getItem('nivas_user_data');
            const user = userStr ? JSON.parse(userStr) : null;
            return !!user?.hotelId;
        } catch { return false; }
    }, []);

    const fetchConfig = useCallback(async () => {
        if (!hasHotel()) { setIsLoading(false); return; }
        setIsLoading(true);
        try {
            const res = await api.get<any>('/settings');
            const payload = res.data ?? {};
            const features = payload.features || {};
            setConfig({
                enableHotel: features.enableHotel ?? true,
                enableFoodAndBeverage: features.enableFoodAndBeverage ?? true,
                enableBanquets: features.enableBanquets ?? false,
            });
        } catch {
            setConfig(DEFAULT_CONFIG);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (hasHotel()) fetchConfig();
    }, [fetchConfig]);

    const isModuleEnabled = useCallback((moduleId: string): boolean => {
        switch (moduleId) {
            case 'hotel':
                return config.enableHotel;
            case 'food-and-beverage':
                return config.enableFoodAndBeverage;
            default:
                return true;
        }
    }, [config]);

    const isRouteEnabled = useCallback((routeId: string): boolean => {
        return isNavIdAllowed(routeId, config);
    }, [config]);

    return {
        config,
        isLoading,
        isModuleEnabled,
        isRouteEnabled,
        refetch: fetchConfig,
    };
}
