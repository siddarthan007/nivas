'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api, tokenStorage } from '@/lib/api';

interface BackendTenant {
    id: number;
    name: string;
    slug: string;
    email: string;
    phone?: string;
    address?: string;
    website?: string;
    logoUrl?: string;
    ownerName?: string;
    panNumber?: string;
    vatNumber?: string;
    serviceChargeRate?: string | number;
    taxRate?: string | number;
    maxRooms?: number;
    maxUsers?: number;
    isActive: boolean;
    createdAt: string;
    licenseExpiresAt?: string;
    planTier?: string;
}

interface TenantCreatePayload {
    name: string;
    slug: string;
    address?: string;
    ownerName?: string;
    ownerEmail: string;
    ownerPhone?: string;
    ownerPassword?: string;
    website?: string;
    logoUrl?: string;
    panNumber?: string;
    vatNumber?: string;
    serviceChargeRate?: number;
    taxRate?: number;
    maxRooms?: number;
    maxUsers?: number;
    packageId?: number;
    trialDays?: number;
    billingCycle?: string;
}

interface TenantUpdatePayload {
    name?: string;
    slug?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    logoUrl?: string;
    panNumber?: string;
    vatNumber?: string;
    serviceChargeRate?: number;
    taxRate?: number;
    maxRooms?: number;
    maxUsers?: number;
    planTier?: string;
    planType?: string;
}

interface ToggleStatusResponse {
    licenseStatus?: string;
}

interface RecordPaymentResponse {
    data?: any;
    invoiceNumber?: string;
    periodEnd?: string;
}

interface ImpersonateResponse {
    token?: string;
    user?: {
        id?: string;
        fullName?: string;
        email?: string;
        hotelId?: number;
    };
    hotelName?: string;
    impersonationId?: string;
}

interface Tenant {
    id: string;
    name: string;
    slug: string;
    email: string;
    phone?: string;
    address?: string;
    website?: string;
    logoUrl?: string;
    ownerName?: string;
    panNumber?: string;
    vatNumber?: string;
    serviceChargeRate?: string | number;
    taxRate?: string | number;
    maxRooms?: number;
    maxUsers?: number;
    isActive: boolean;
    createdAt: string;
    licenseExpiry?: string;
    planType?: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
    roomCount?: number;
}

interface CreateTenantPayload {
    name: string;
    slug: string;
    email: string;
    phone?: string;
    address?: string;
    planType?: 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
    ownerName?: string;
    website?: string;
    logoUrl?: string;
    panNumber?: string;
    vatNumber?: string;
    serviceChargeRate?: number;
    taxRate?: number;
    maxRooms?: number;
    maxUsers?: number;
    billingCycle?: string;
}

export interface Payment {
    id: string;
    hotelId: number;
    amount: string;
    currency: string;
    billingCycle: 'MONTHLY' | 'ANNUAL';
    paymentMethod?: string;
    transactionId?: string;
    invoiceNumber?: string;
    createdAt: string;
}

/**
 * Hook for managing tenants (Super Admin only)
 */
export function useTenants() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch tenants
    const fetchTenants = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<BackendTenant[]>('/saas-admin/tenants');
            // Map backend fields to frontend fields
            const mapped: Tenant[] = (response.data || []).map((t: BackendTenant) => ({
                id: String(t.id),
                name: t.name || '',
                slug: t.slug || '',
                email: t.email || '',
                phone: t.phone,
                address: t.address,
                website: t.website,
                logoUrl: t.logoUrl,
                ownerName: t.ownerName,
                panNumber: t.panNumber,
                vatNumber: t.vatNumber,
                serviceChargeRate: t.serviceChargeRate,
                taxRate: t.taxRate,
                maxRooms: t.maxRooms,
                maxUsers: t.maxUsers,
                isActive: t.isActive ?? true,
                createdAt: t.createdAt || new Date().toISOString(),
                licenseExpiry: t.licenseExpiresAt,
                planType: t.planTier as 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE' | undefined,
                roomCount: t.maxRooms,
            }));
            setTenants(mapped);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch tenants');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Create tenant
    const createTenant = async (data: CreateTenantPayload & { ownerPassword?: string; packageId?: number; trialDays?: number }): Promise<Tenant | null> => {
        setIsLoading(true);
        try {
            const payload: Record<string, any> = {
                name: data.name,
                slug: data.slug,
                address: data.address || 'Unknown',
                ownerName: data.ownerName || data.name,
                ownerEmail: data.email,
                ownerPhone: data.phone || '0000000000',
                ownerPassword: data.ownerPassword || 'Password@123',
                website: data.website,
                logoUrl: data.logoUrl,
                panNumber: data.panNumber,
                vatNumber: data.vatNumber,
                serviceChargeRate: data.serviceChargeRate,
                taxRate: data.taxRate,
                maxRooms: data.maxRooms,
                maxUsers: data.maxUsers,
            };

            if (data.packageId) payload.packageId = data.packageId;
            if (data.trialDays) payload.trialDays = data.trialDays;
            if (data.billingCycle) payload.billingCycle = data.billingCycle;

            const response = await api.post<Tenant>('/super-admin/onboard', payload);

            if (response.data) {
                response.data.planType = data.planType;
                setTenants(prev => [response.data!, ...prev]);
                toast.success(`Hotel "${data.name}" onboarded successfully`);
                return response.data;
            }
            return null;
        } catch (err: any) {
            toast.error(err.message || 'Failed to create tenant');
            throw new Error(err.message || 'Failed to create tenant');
        } finally {
            setIsLoading(false);
        }
    };

    // Update tenant
    const updateTenant = async (id: string, data: Partial<CreateTenantPayload>): Promise<boolean> => {
        try {
            // Map frontend field names to backend field names
            const payload: TenantUpdatePayload = { ...data };
            if (payload.planType) {
                payload.planTier = payload.planType;
                delete payload.planType;
            }
            const response = await api.patch<Tenant>(`/saas-admin/tenants/${id}`, payload);
            setTenants(prev => prev.map(t => t.id === id ? { ...t, ...response.data } : t));
            toast.success('Tenant updated successfully');
            return true;
        } catch (err: any) {
            toast.error(err.message || 'Failed to update tenant');
            throw new Error(err.message || 'Failed to update tenant');
        }
    };

    // Toggle tenant status
    const toggleTenantStatus = async (id: string): Promise<boolean> => {
        try {
            const tenant = tenants.find(t => t.id === id);
            if (!tenant) return false;

            // Determine action based on current status
            const action = tenant.isActive ? 'pause' : 'resume';
            const res: any = await api.post(`/saas-admin/tenants/${id}/${action}`, { reason: 'Admin toggle' });
            const newLicenseStatus = res?.data?.licenseStatus || res?.licenseStatus || (tenant.isActive ? 'PAUSED' : 'ACTIVE');

            setTenants(prev => prev.map(t => t.id === id ? { ...t, isActive: !t.isActive, licenseStatus: newLicenseStatus } : t));
            return true;
        } catch {
            return false;
        }
    };

    // Extend license
    const extendLicense = async (id: string, days: number): Promise<boolean> => {
        try {
            await api.post(`/saas-admin/tenants/${id}/extend`, { days });
            // Optimistic update
            setTenants(prev => prev.map(t => {
                if (t.id !== id || !t.licenseExpiry) return t;
                const expiry = new Date(t.licenseExpiry);
                expiry.setDate(expiry.getDate() + days);
                return { ...t, licenseExpiry: expiry.toISOString() };
            }));
            return true;
        } catch {
            return false;
        }
    };

    // Record payment via billing service so it appears in analytics ledger
    const recordPayment = async (id: string, amount: number, cycle: string, packageId?: number): Promise<any | null> => {
        try {
            const res: RecordPaymentResponse = await api.post('/saas-billing/record-payment', {
                hotelId: parseInt(id, 10),
                amount,
                currency: 'NPR',
                billingCycle: cycle,
                paymentMethod: 'MANUAL',
                packageId,
            });
            return res?.data?.data || res?.data || null;
        } catch {
            return null;
        }
    };

    // Revoke license
    const revokeLicense = async (id: string): Promise<boolean> => {
        try {
            await api.post(`/saas-admin/tenants/${id}/revoke`, { reason: 'Admin revoked' });
            setTenants(prev => prev.map(t => t.id === id ? { ...t, isActive: false, licenseStatus: 'REVOKED' } : t));
            return true;
        } catch {
            return false;
        }
    };

    // Stats
    const activeTenants = tenants.filter(t => t.isActive).length;
    const expiringLicenses = tenants.filter(t => {
        if (!t.licenseExpiry) return false;
        const expiry = new Date(t.licenseExpiry);
        const now = new Date();
        const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > 0 && diffDays <= 30;
    }).length;

    // Initial fetch
    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    // Get payment history for a tenant
    const getPaymentHistory = async (hotelId: string): Promise<Payment[]> => {
        try {
            const response = await api.get<Payment[]>(`/saas-billing/tenants/${hotelId}/payments`);
            return response.data || [];
        } catch {
            return [];
        }
    };

    const getTenantDetails = async (hotelId: string) => {
        const [detailRes, usageRes] = await Promise.all([
            api.get<any>(`/saas-admin/tenants/${hotelId}`),
            api.get<any>(`/saas-admin/tenants/${hotelId}/usage`),
        ]);
        return {
            detail: detailRes.data,
            usage: usageRes.data,
        };
    };

    const impersonateOwner = async (hotelId: string): Promise<{ success: boolean; token?: string; hotelName?: string }> => {
        try {
            const tenant = tenants.find(t => t.id === hotelId);
            const response = await api.post<ImpersonateResponse>('/super-admin/impersonate', {
                hotelId: parseInt(hotelId)
            });

            // The backend sets the owner token via cookies (both HttpOnly auth cookie
            // and non-HttpOnly impersonation_token cookie for frontend to pick up).
            // We ALSO try to extract from the JSON response as a belt-and-suspenders approach.
            const tokenData: any = response.data || response;
            const token = tokenData?.token;
            const hotelName = tokenData?.hotelName || tenant?.name || 'Hotel';
            const impersonatedUser = tokenData?.user;
            const impersonationId = tokenData?.impersonationId;

            // If we got the token from the response body, store it directly
            if (token) {
                tokenStorage.setToken(token);
            }

            // Set impersonation flags in localStorage
            localStorage.setItem('impersonation_mode', 'true');
            localStorage.setItem('impersonation_hotel', hotelName);
            localStorage.setItem('impersonation_hotel_id', String(impersonatedUser?.hotelId || hotelId));
            if (impersonationId) localStorage.setItem('impersonation_id', impersonationId);

            if (impersonatedUser || token) {
                const ownerUserData = {
                    id: impersonatedUser?.id || '',
                    name: impersonatedUser?.fullName || hotelName,
                    email: impersonatedUser?.email || '',
                    role: 'Owner',
                    hotelId: impersonatedUser?.hotelId || parseInt(hotelId),
                    userType: 'HOTEL_STAFF' as const,
                    permissions: ['*'],
                };
                tokenStorage.setUser(ownerUserData);
            }

            // Full page reload to reinitialize the entire app with owner context.
            // On reload, AuthContext.initAuth reads the impersonation_token cookie
            // (set by backend) and stores it in localStorage, ensuring the correct token.
            window.location.href = '/hotel';

            return { success: true, token: token || 'cookie', hotelName };
        } catch (err) {
            console.error('Impersonation failed:', err);
            return { success: false };
        }
    };

    const activateLicense = async (id: string, billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'): Promise<{ expiresAt?: string } | null> => {
        try {
            const res = await api.post<{ expiresAt?: string; licenseStatus?: string }>(`/saas-admin/tenants/${id}/activate`, { billingCycle });
            const payload = res.data;
            const expiresAt = payload?.expiresAt;
            setTenants(prev => prev.map(t => {
                if (t.id !== id) return t;
                return {
                    ...t,
                    isActive: true,
                    licenseExpiry: expiresAt || t.licenseExpiry,
                };
            }));
            return payload || null;
        } catch (err: unknown) {
            throw new Error(err instanceof Error ? err.message : 'Failed to activate license');
        }
    };

    return {
        tenants,
        isLoading,
        error,
        fetchTenants,
        createTenant,
        updateTenant,
        toggleTenantStatus,
        extendLicense,
        recordPayment,
        revokeLicense,
        getPaymentHistory,
        getTenantDetails,
        impersonateOwner,
        activateLicense,
        stats: {
            total: tenants.length,
            active: activeTenants,
            inactive: tenants.length - activeTenants,
            expiringLicenses,
        },
    };
}

export default useTenants;
