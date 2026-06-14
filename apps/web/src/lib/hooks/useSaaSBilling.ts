import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { useLiveRefresh } from '@/lib/contexts/WebSocketContext';

export interface SubscriptionPackage {
    id: number;
    name: string;
    description?: string;
    price: number;
    billingCycle: string;
    features: string[];
    isActive: boolean;
    maxRooms?: number | null;
    maxUsers?: number | null;
    isCurrent?: boolean;
}

export interface Payment {
    id: string;
    invoiceNumber?: string | null;
    amount: number;
    status: string;
    dueDate?: string;
    paidAt?: string;
    description?: string;
    createdAt?: string;
    currency?: string;
}

export interface BillingStats {
    currentPlan: string;
    nextBillingDate: string;
    totalPaid: number;
    pendingAmount: number;
    licenseStatus?: string;
    subscriptionStatus?: string;
}

interface MySubscriptionResponse {
    hotel?: { name?: string; licenseStatus?: string };
    subscription?: {
        status?: string;
        billingCycle?: string;
        currentPeriodEnd?: string;
        package?: { id?: number; name?: string } | null;
    } | null;
    recentPayments?: Array<{
        id: string;
        amount: string;
        currency?: string;
        status?: string;
        invoiceNumber?: string | null;
        notes?: string | null;
        createdAt?: string;
        periodEnd?: string;
    }>;
}

function mapPayment(p: NonNullable<MySubscriptionResponse['recentPayments']>[number]): Payment {
    const amount = parseFloat(p.amount) || 0;
    return {
        id: p.id,
        invoiceNumber: p.invoiceNumber,
        amount,
        status: p.status || 'PENDING',
        description: p.notes || 'Subscription payment',
        createdAt: p.createdAt,
        dueDate: p.periodEnd || p.createdAt,
        currency: p.currency || 'NPR',
    };
}

export interface UseSaaSBillingReturn {
    packages: SubscriptionPackage[];
    payments: Payment[];
    stats: BillingStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    subscribeToPlan: (packageId: number) => Promise<boolean>;
}

export function useSaaSBilling(): UseSaaSBillingReturn {
    const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [stats, setStats] = useState<BillingStats>({
        currentPlan: '',
        nextBillingDate: '',
        totalPaid: 0,
        pendingAmount: 0,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBilling = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [subRes, pkgRes] = await Promise.all([
                api.get<MySubscriptionResponse>('/saas-billing/my-subscription'),
                api.get<Array<Record<string, unknown>>>('/saas-billing/packages'),
            ]);

            const sub = subRes.data;
            const currentPkgId = sub?.subscription?.package?.id;
            const mappedPackages: SubscriptionPackage[] = (pkgRes.data || []).map((pkg) => ({
                id: Number(pkg.id),
                name: String(pkg.name || ''),
                description: pkg.description ? String(pkg.description) : undefined,
                price: Number(pkg.price ?? pkg.monthlyPrice ?? 0),
                billingCycle: String(pkg.billingCycle || 'MONTHLY'),
                features: Array.isArray(pkg.features) ? pkg.features.map(String) : [],
                isActive: pkg.isActive !== false,
                maxRooms: pkg.maxRooms != null ? Number(pkg.maxRooms) : null,
                maxUsers: pkg.maxUsers != null ? Number(pkg.maxUsers) : null,
                isCurrent: currentPkgId != null && Number(pkg.id) === currentPkgId,
            }));

            const mappedPayments = (sub?.recentPayments || []).map(mapPayment);
            const totalPaid = mappedPayments
                .filter((p) => p.status === 'PAID' || p.status === 'COMPLETED')
                .reduce((sum, p) => sum + p.amount, 0);
            const pendingAmount = mappedPayments
                .filter((p) => p.status === 'PENDING' || p.status === 'OVERDUE')
                .reduce((sum, p) => sum + p.amount, 0);

            setPackages(mappedPackages);
            setPayments(mappedPayments);
            setStats({
                currentPlan: sub?.subscription?.package?.name || 'No active plan',
                nextBillingDate: sub?.subscription?.currentPeriodEnd || '',
                totalPaid,
                pendingAmount,
                licenseStatus: sub?.hotel?.licenseStatus,
                subscriptionStatus: sub?.subscription?.status,
            });
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
            await api.post('/saas-billing/subscribe', { packageId, billingCycle: 'MONTHLY' });
            toast.success('Subscription request submitted');
            await fetchBilling();
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update subscription';
            toast.error(message);
            return false;
        }
    }, [fetchBilling]);

    useEffect(() => {
        fetchBilling();
    }, [fetchBilling]);

    useLiveRefresh(useCallback((detail) => {
        const t = detail?.eventType;
        if (!t) return;
        const billingEvents = new Set([
            'PAYMENT_RECEIVED', 'PAYMENT_DUE_REMINDER', 'LICENSE_ACTIVATED', 'LICENSE_EXPIRED',
            'LICENSE_GRACE_PERIOD', 'LICENSE_PAUSED', 'LICENSE_REVOKED', 'LICENSE_EXPIRING_SOON',
        ]);
        if (billingEvents.has(t)) {
            void fetchBilling();
        }
    }, [fetchBilling]));

    return {
        packages,
        payments,
        stats,
        isLoading,
        error,
        refresh: fetchBilling,
        subscribeToPlan,
    };
}

export default useSaaSBilling;
