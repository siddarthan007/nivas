'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

type PlanType = 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
type LicenseStatus = 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'TRIAL' | 'PAUSED' | 'REVOKED';

interface License {
    id: string;
    tenantId: string;
    tenantName: string;
    planType: PlanType;
    status: LicenseStatus;
    startDate: string;
    expiryDate: string;
    maxUsers: number;
    maxRooms: number;
    features: string[];
    lastPaymentDate?: string;
    lastPaymentAmount?: number;
    createdAt: string;
}

interface CreateLicensePayload {
    tenantId: string;
    planType: PlanType;
    durationMonths: number;
    maxUsers?: number;
    maxRooms?: number;
}

interface RenewalPayload {
    durationMonths: number;
    paymentAmount: number;
    paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'QR';
}

/**
 * Hook for managing licenses (Super Admin only)
 */
export function useLicenses() {
    const [licenses, setLicenses] = useState<License[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch licenses
    const fetchLicenses = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Using tenants endpoint to derive license info
            // Ideally should be /saas-billing/licenses but we'll use tenants list which has subscription data
            const response = await api.get<any[]>('/saas-admin/tenants');

            const licenseList: License[] = response.data?.map((t: any) => ({
                id: t.subscription?.id || `lic-${t.id}`,
                tenantId: t.id,
                tenantName: t.name,
                planType: (t.planTier || 'BASIC') as PlanType,
                status: (t.licenseStatus || 'ACTIVE') as LicenseStatus,
                startDate: t.subscription?.startDate || t.createdAt,
                expiryDate: t.licenseExpiresAt || t.subscription?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                maxUsers: t.maxUsers || 5,
                maxRooms: t.maxRooms || 10,
                features: [], // Detailed features might need separate fetch
                createdAt: t.createdAt
            })) || [];

            setLicenses(licenseList);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch licenses');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchLicenses();
    }, [fetchLicenses]);

    // Create license - Handled via Tenant Onboarding or separate Grant Trial
    const createLicense = async (data: CreateLicensePayload): Promise<License | null> => {
        try {
            // Mapping to Grant Trial
            const response = await api.post<{ licenseStatus: string, trialEndsAt: string }>(
                `/saas-admin/tenants/${data.tenantId}/grant-trial`,
                { days: 14 } // Default 14 days trial
            );

            if (response.data) {
                await fetchLicenses();
                return null;
            }
            return null;
        } catch (err: any) {
            throw new Error(err.message || 'Failed to create license');
        }
    };

    // Renew license
    const renewLicense = async (id: string, data: RenewalPayload): Promise<boolean> => {
        try {
            const license = licenses.find(l => l.id === id);
            if (!license) throw new Error('License not found');

            await api.post(`/saas-admin/tenants/${license.tenantId}/extend`, {
                days: data.durationMonths * 30
            });

            await fetchLicenses();
            return true;
        } catch (err: any) {
            throw new Error(err.message || 'Failed to renew license');
        }
    };

    // Suspend license
    const suspendLicense = async (id: string): Promise<boolean> => {
        try {
            const license = licenses.find(l => l.id === id);
            if (!license) return false;

            await api.post(`/saas-admin/tenants/${license.tenantId}/pause`, { reason: 'Admin suspended' });

            setLicenses(prev => prev.map(l =>
                l.id === id ? { ...l, status: 'SUSPENDED' as LicenseStatus } : l
            ));
            return true;
        } catch {
            return false;
        }
    };

    // Reactivate license
    const reactivateLicense = async (id: string): Promise<boolean> => {
        try {
            const license = licenses.find(l => l.id === id);
            if (!license) return false;

            await api.post(`/saas-admin/tenants/${license.tenantId}/resume`, { reason: 'Admin resumed' });

            setLicenses(prev => prev.map(l =>
                l.id === id ? { ...l, status: 'ACTIVE' as LicenseStatus } : l
            ));
            return true;
        } catch {
            return false;
        }
    };

    // Revoke license
    const revokeLicense = async (id: string, confirmPassword: string): Promise<boolean> => {
        try {
            const license = licenses.find(l => l.id === id);
            if (!license) return false;

            await api.post(`/saas-admin/tenants/${license.tenantId}/revoke`, { reason: 'Admin revoked', confirmPassword });

            setLicenses(prev => prev.map(l =>
                l.id === id ? { ...l, status: 'REVOKED' as LicenseStatus } : l
            ));
            return true;
        } catch {
            return false;
        }
    };

    // Calculate days until expiry
    const getDaysUntilExpiry = (expiryDate: string): number => {
        const expiry = new Date(expiryDate);
        const now = new Date();
        return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    };

    // Activate license without recording payment (complimentary / offline settled)
    const activateLicense = async (id: string, billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'): Promise<boolean> => {
        try {
            const license = licenses.find(l => l.id === id);
            if (!license) return false;
            await api.post(`/saas-admin/tenants/${license.tenantId}/activate`, { billingCycle });
            await fetchLicenses();
            return true;
        } catch (err: unknown) {
            throw new Error(err instanceof Error ? err.message : 'Failed to activate license');
        }
    };

    // Stats
    const stats = {
        total: licenses.length,
        active: licenses.filter(l => l.status === 'ACTIVE').length,
        expired: licenses.filter(l => l.status === 'EXPIRED').length,
        expiringSoon: licenses.filter(l => {
            const days = getDaysUntilExpiry(l.expiryDate);
            return l.status === 'ACTIVE' && days > 0 && days <= 30;
        }).length,
        trial: licenses.filter(l => l.status === 'TRIAL').length,
        paused: licenses.filter(l => l.status === 'PAUSED').length,
        revoked: licenses.filter(l => l.status === 'REVOKED').length,
    };

    // Plan revenue breakdown
    const revenueByPlan = {
        BASIC: licenses.filter(l => l.planType === 'BASIC').length,
        PROFESSIONAL: licenses.filter(l => l.planType === 'PROFESSIONAL').length,
        ENTERPRISE: licenses.filter(l => l.planType === 'ENTERPRISE').length,
    };

    return {
        licenses,
        isLoading,
        error,
        stats,
        revenueByPlan,
        fetchLicenses,
        createLicense,
        renewLicense,
        suspendLicense,
        reactivateLicense,
        revokeLicense,
        activateLicense,
        getDaysUntilExpiry,
    };
}

export default useLicenses;
