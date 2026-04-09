'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth, type UserType } from '@/lib/contexts/AuthContext';

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

const PLAN_CACHE_TTL_MS = 30_000;

let planCache: { key: string; data: HotelPlanInfo; fetchedAt: number } | null = null;
let inFlightRequest: Promise<HotelPlanInfo> | null = null;
let inFlightKey: string | null = null;

export function clearPlanCache(): void {
    planCache = null;
    inFlightRequest = null;
    inFlightKey = null;
}

function createPlanCacheKey(hotelId?: number | null, userType?: UserType): string {
    return `${userType || 'UNKNOWN'}:${hotelId ?? 'none'}`;
}

function getDefaultPlanForUser(userType?: UserType): HotelPlanInfo {
    if (userType === 'SUPER_ADMIN') {
        return { ...DEFAULT_PLAN, modules: [], allowedRoles: [], features: [] };
    }

    return DEFAULT_PLAN;
}

function mapPlanResponse(data: any): HotelPlanInfo {
    const hotel = data?.hotel;
    const subscription = data?.subscription;
    const pkg = subscription?.package;

    const licenseStatus = hotel?.licenseStatus || 'TRIAL';
    const expiresAt = hotel?.licenseExpiresAt || subscription?.trialEndsAt || null;

    let daysRemaining: number | null = null;
    if (expiresAt) {
        const diff = new Date(expiresAt).getTime() - Date.now();
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }

    const isTrialExpired = licenseStatus === 'EXPIRED' || (licenseStatus === 'TRIAL' && daysRemaining !== null && daysRemaining <= 0);
    const isLicenseActive = ['ACTIVE', 'TRIAL'].includes(licenseStatus) && !isTrialExpired;

    return {
        licenseStatus,
        licenseExpiresAt: hotel?.licenseExpiresAt || null,
        trialEndsAt: subscription?.trialEndsAt || null,
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
    };
}

async function fetchHotelPlanData(hotelId: number | null | undefined, userType: UserType | undefined, force = false): Promise<HotelPlanInfo> {
    const cacheKey = createPlanCacheKey(hotelId, userType);
    const fallbackPlan = getDefaultPlanForUser(userType);

    if (!hotelId || userType === 'SUPER_ADMIN') {
        return fallbackPlan;
    }

    const now = Date.now();
    if (!force && planCache && planCache.key === cacheKey && now - planCache.fetchedAt < PLAN_CACHE_TTL_MS) {
        return planCache.data;
    }

    if (!force && inFlightRequest && inFlightKey === cacheKey) {
        return inFlightRequest;
    }

    inFlightKey = cacheKey;
    inFlightRequest = (async () => {
        try {
            const res = await api.get<any>('/saas-billing/my-subscription');
            const nextPlan = mapPlanResponse(res.data);
            planCache = {
                key: cacheKey,
                data: nextPlan,
                fetchedAt: Date.now(),
            };
            return nextPlan;
        } catch (err) {
            console.warn('Failed to fetch hotel plan:', err);
            return planCache?.key === cacheKey ? planCache.data : fallbackPlan;
        } finally {
            inFlightRequest = null;
            inFlightKey = null;
        }
    })();

    return inFlightRequest;
}

export function useHotelPlan() {
    const { user } = useAuth();
    const cacheKey = createPlanCacheKey(user?.hotelId, user?.userType);
    const cachedPlan = planCache?.key === cacheKey ? planCache.data : getDefaultPlanForUser(user?.userType);
    const [plan, setPlan] = useState<HotelPlanInfo>(cachedPlan);
    const [isLoading, setIsLoading] = useState(planCache?.key === cacheKey ? false : true);

    const fetchPlan = useCallback(async (force = false) => {
        setIsLoading(true);
        const nextPlan = await fetchHotelPlanData(user?.hotelId, user?.userType, force);
        setPlan(nextPlan);
        setIsLoading(false);
        return nextPlan;
    }, [user?.hotelId, user?.userType]);

    useEffect(() => {
        let cancelled = false;

        fetchHotelPlanData(user?.hotelId, user?.userType)
            .then(nextPlan => {
                if (!cancelled) {
                    setPlan(nextPlan);
                    setIsLoading(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPlan(getDefaultPlanForUser(user?.userType));
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [user?.hotelId, user?.userType]);

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
        refetch: () => fetchPlan(true),
    };
}