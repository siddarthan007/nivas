'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/contexts/AuthContext';

interface HotelPlanInfo {
    licenseStatus: string;
    licenseExpiresAt: string | null;
    trialEndsAt: string | null;
    planName: string;
    planCode: string;
    maxRooms: number | null;
    maxUsers: number | null;
    features: string[];
    modules: string[];
    allowedRoles: string[];
    trialDays: number;
    daysRemaining: number | null;
    isTrialExpired: boolean;
    isLicenseActive: boolean;
}

const DEFAULT_PLAN: HotelPlanInfo = {
    licenseStatus: 'TRIAL',
    licenseExpiresAt: null,
    trialEndsAt: null,
    planName: 'Free Trial',
    planCode: 'TRIAL',
    maxRooms: null,
    maxUsers: null,
    features: [],
    modules: [],
    allowedRoles: [],
    trialDays: 14,
    daysRemaining: null,
    isTrialExpired: false,
    isLicenseActive: true,
};

export function useHotelPlan() {
    const { user } = useAuth();
    const [plan, setPlan] = useState<HotelPlanInfo>(DEFAULT_PLAN);
    const [isLoading, setIsLoading] = useState(true);

    const fetchPlan = useCallback(async () => {
        if (!user?.hotelId || user.userType === 'SUPER_ADMIN') {
            setPlan({ ...DEFAULT_PLAN, modules: [], allowedRoles: [], features: [] });
            setIsLoading(false);
            return;
        }

        try {
            const res = await api.get<any>('/saas-billing/my-subscription');
            const data = res.data;
            const hotel = data?.hotel;
            const sub = data?.subscription;
            const pkg = sub?.package;

            const licenseStatus = hotel?.licenseStatus || 'TRIAL';
            const expiresAt = hotel?.licenseExpiresAt || sub?.trialEndsAt || null;

            let daysRemaining: number | null = null;
            if (expiresAt) {
                const diff = new Date(expiresAt).getTime() - Date.now();
                daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
            }

            const isTrialExpired = licenseStatus === 'EXPIRED' || (licenseStatus === 'TRIAL' && daysRemaining !== null && daysRemaining <= 0);
            const isLicenseActive = ['ACTIVE', 'TRIAL'].includes(licenseStatus) && !isTrialExpired;

            setPlan({
                licenseStatus,
                licenseExpiresAt: hotel?.licenseExpiresAt || null,
                trialEndsAt: sub?.trialEndsAt || null,
                planName: pkg?.name || 'Free Trial',
                planCode: pkg?.code || 'TRIAL',
                maxRooms: pkg?.maxRooms || null,
                maxUsers: pkg?.maxUsers || null,
                features: pkg?.features || [],
                modules: pkg?.modules || [],
                allowedRoles: pkg?.allowedRoles || [],
                trialDays: pkg?.trialDays || 14,
                daysRemaining,
                isTrialExpired,
                isLicenseActive,
            });
        } catch (err) {
            console.warn('Failed to fetch hotel plan:', err);
            setPlan(DEFAULT_PLAN);
        } finally {
            setIsLoading(false);
        }
    }, [user?.hotelId, user?.userType]);

    useEffect(() => {
        fetchPlan();
    }, [fetchPlan]);

    const hasModule = useCallback((moduleId: string): boolean => {
        // If no modules are set (empty array), allow everything (backwards compat / Owner plan)
        if (plan.modules.length === 0) return true;
        return plan.modules.includes(moduleId);
    }, [plan.modules]);

    const hasFeature = useCallback((featureId: string): boolean => {
        if (plan.features.length === 0) return true;
        return plan.features.includes(featureId);
    }, [plan.features]);

    const isRoleAllowed = useCallback((roleName: string): boolean => {
        // If no allowed roles set, allow all
        if (plan.allowedRoles.length === 0) return true;
        // Owner is always allowed
        if (roleName === 'Owner') return true;
        return plan.allowedRoles.includes(roleName);
    }, [plan.allowedRoles]);

    return {
        plan,
        isLoading,
        hasModule,
        hasFeature,
        isRoleAllowed,
        refetch: fetchPlan,
    };
}
