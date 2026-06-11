'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface SubscriptionPackage {
    id: number;
    name: string;
    code: string;
    description?: string;
    monthlyPrice: string;
    annualPrice?: string;
    maxRooms?: number;
    maxUsers?: number;
    features: string[];
    modules: string[];
    allowedRoles: string[];
    trialDays: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

interface CreatePackagePayload {
    name: string;
    code: string;
    description?: string;
    monthlyPrice: number;
    annualPrice?: number;
    maxRooms?: number;
    maxUsers?: number;
    features?: string[];
    modules?: string[];
    allowedRoles?: string[];
    trialDays?: number;
}

interface UpdatePackagePayload {
    name?: string;
    description?: string;
    monthlyPrice?: number;
    annualPrice?: number;
    maxRooms?: number;
    maxUsers?: number;
    features?: string[];
    modules?: string[];
    allowedRoles?: string[];
    trialDays?: number;
    isActive?: boolean;
}

/**
 * Hook for managing subscription packages (Super Admin only)
 */
export interface Feature {
    id: string;
    label: string;
    category: string;
}

export interface AvailableRole {
    id: string;
    label: string;
}

/**
 * Hook for managing subscription packages (Super Admin only)
 */
export function usePlans() {
    const [plans, setPlans] = useState<SubscriptionPackage[]>([]);
    const [features, setFeatures] = useState<Feature[]>([]);
    const [modules, setModules] = useState<Feature[]>([]);
    const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch all available features, modules, and roles in parallel
    const fetchMetadata = useCallback(async () => {
        const [featRes, modRes, roleRes] = await Promise.allSettled([
            api.get<Feature[]>('/saas-admin/features'),
            api.get<Feature[]>('/saas-admin/modules'),
            api.get<AvailableRole[]>('/saas-admin/available-roles'),
        ]);

        if (featRes.status === 'fulfilled' && featRes.value.data?.length) {
            setFeatures(featRes.value.data);
        } else {
            setFeatures([
                { id: 'enableSmsNotifications', label: 'SMS Notifications', category: 'Notifications' },
                { id: 'enableWhatsappNotifications', label: 'WhatsApp Notifications', category: 'Notifications' },
                { id: 'enableEmailNotifications', label: 'Email Notifications', category: 'Notifications' },
                { id: 'enableBanquets', label: 'Banquet Management', category: 'Modules' },
                { id: 'enablePosIntegration', label: 'POS Integration', category: 'Modules' },
                { id: 'enableInventory', label: 'Inventory Management', category: 'Modules' },
                { id: 'enableHousekeeping', label: 'Housekeeping', category: 'Modules' },
                { id: 'enableGuestPortal', label: 'Guest Portal', category: 'Modules' },
            ]);
        }

        if (modRes.status === 'fulfilled' && modRes.value.data?.length) {
            setModules(modRes.value.data);
        }

        if (roleRes.status === 'fulfilled' && roleRes.value.data?.length) {
            setAvailableRoles(roleRes.value.data);
        }
    }, []);

    // Fetch all packages
    const fetchPlans = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            await Promise.all([
                (async () => {
                    const response = await api.get<SubscriptionPackage[]>('/saas-admin/packages');
                    setPlans(response.data || []);
                })(),
                fetchMetadata()
            ]);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch packages');
        } finally {
            setIsLoading(false);
        }
    }, [fetchMetadata]);

    // Create a new package
    const createPlan = async (data: CreatePackagePayload): Promise<SubscriptionPackage | null> => {
        try {
            const response = await api.post<SubscriptionPackage>('/saas-admin/packages', data);
            if (response.data) {
                setPlans(prev => [response.data!, ...prev]);
                return response.data;
            }
            return null;
        } catch (err: any) {
            throw new Error(err.message || 'Failed to create package');
        }
    };

    // Update a package
    const updatePlan = async (id: number, data: UpdatePackagePayload): Promise<SubscriptionPackage | null> => {
        try {
            const response = await api.patch<SubscriptionPackage>(`/saas-admin/packages/${id}`, data);
            if (response.data) {
                setPlans(prev => prev.map(p => p.id === id ? response.data! : p));
                return response.data;
            }
            return null;
        } catch (err: any) {
            throw new Error(err.message || 'Failed to update package');
        }
    };

    // Toggle package active status
    const togglePlanStatus = async (id: number, isActive: boolean): Promise<boolean> => {
        try {
            await updatePlan(id, { isActive });
            return true;
        } catch {
            return false;
        }
    };

    // Initial fetch
    useEffect(() => {
        fetchPlans();
    }, [fetchPlans]);

    return {
        plans,
        features,
        modules,
        availableRoles,
        isLoading,
        error,
        fetchPlans,
        createPlan,
        updatePlan,
        togglePlanStatus,
    };
}
