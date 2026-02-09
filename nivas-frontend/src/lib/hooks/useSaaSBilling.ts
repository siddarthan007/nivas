/**
 * SaaS Billing API Hook
 * Connects to /saas/billing endpoints
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface SubscriptionPackage {
    id: number;
    name: string;
    description: string;
    price: number;
    billingCycle: 'MONTHLY' | 'YEARLY';
    features: string[];
    isActive: boolean;
    maxRooms?: number;
    maxStaff?: number;
}

export interface Payment {
    id: number;
    invoiceNumber: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    dueDate: string;
    paidAt?: string;
    description: string;
}

export interface CreatePackagePayload {
    name: string;
    description: string;
    price: number;
    billingCycle: 'MONTHLY' | 'YEARLY';
    features: string[];
    maxRooms?: number;
    maxStaff?: number;
}

export interface RecordPaymentPayload {
    invoiceNumber: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED';
    dueDate: string;
    description: string;
}

export interface BillingStats {
    currentPlan: string;
    nextBillingDate: string;
    totalPaid: number;
    pendingAmount: number;
}

export interface UseSaaSBillingReturn {
    packages: SubscriptionPackage[];
    payments: Payment[];
    stats: BillingStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    subscribeToPlan: (packageId: number) => Promise<boolean>;
    cancelSubscription: () => Promise<boolean>;
}

export function useSaaSBilling(): UseSaaSBillingReturn {
    const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [stats, setStats] = useState<BillingStats>({
        currentPlan: '',
        nextBillingDate: '',
        totalPaid: 0,
        pendingAmount: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBilling = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [packagesRes, paymentsRes, statsRes] = await Promise.all([
                api.get<SubscriptionPackage[]>('/saas-billing/packages'),
                api.get<Payment[]>('/saas-billing/payments'),
                api.get<BillingStats>('/saas-billing/stats')
            ]);

            if (packagesRes.data) setPackages(packagesRes.data);
            if (paymentsRes.data) setPayments(paymentsRes.data);
            if (statsRes.data) setStats(statsRes.data);
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch billing data';
            setError(message);
            console.error('[useSaaSBilling]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const subscribeToPlan = useCallback(async (packageId: number): Promise<boolean> => {
        try {
            await api.post('/saas-billing/subscribe', { packageId });
            toast.success('Subscription updated successfully');
            await fetchBilling();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update subscription';
            toast.error(message);
            return false;
        }
    }, [fetchBilling]);

    const cancelSubscription = useCallback(async (): Promise<boolean> => {
        try {
            const response = await api.post<{ success: boolean; message: string }>('/saas-billing/cancel');
            toast.success(response.data?.message || 'Subscription cancelled');
            await fetchBilling();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to cancel subscription';
            toast.error(message);
            return false;
        }
    }, [fetchBilling]);

    useEffect(() => {
        fetchBilling();
    }, [fetchBilling]);

    return {
        packages,
        payments,
        stats,
        isLoading,
        error,
        refresh: fetchBilling,
        subscribeToPlan,
        cancelSubscription,
    };
}

export default useSaaSBilling;
