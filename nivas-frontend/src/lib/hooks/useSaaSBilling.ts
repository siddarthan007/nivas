import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface SubscriptionPackage {
    id: number;
    name: string;
    description: string;
    price: number;
    billingCycle: 'MONTHLY';
    features: string[];
    isActive: boolean;
    maxRooms?: number | null;
    maxUsers?: number | null;
}

export interface Payment {
    id: string;
    invoiceNumber: string;
    amount: number;
    status: 'PENDING' | 'PAID' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
    dueDate: string;
    paidAt?: string;
    description: string;
    createdAt?: string;
    paymentMethod?: string;
    currency?: string;
    periodStart?: string;
    periodEnd?: string;
}

export interface TenantSubscription {
    id: string;
    status: string;
    billingCycle?: string;
    startDate?: string;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    trialEndsAt?: string;
    package?: SubscriptionPackage | null;
}

export interface BillingHotel {
    id: number;
    name: string;
    licenseStatus: string;
    licenseExpiresAt?: string | null;
}

export interface BillingStats {
    currentPlan: string;
    nextBillingDate: string;
    totalPaid: number;
    pendingAmount: number;
    licenseStatus: string;
    billingCycle?: string;
}

interface MySubscriptionResponse {
    hotel: {
        id: number;
        name: string;
        licenseStatus: string;
        licenseExpiresAt?: string | null;
    };
    subscription: {
        id: string;
        status: string;
        billingCycle?: string;
        startDate?: string;
        currentPeriodStart?: string;
        currentPeriodEnd?: string;
        trialEndsAt?: string;
        package?: {
            id: number;
            name: string;
            description: string;
            price: number;
            features: string[];
            maxRooms?: number | null;
            maxUsers?: number | null;
        } | null;
    } | null;
    recentPayments: Array<Record<string, any>>;
}

export interface UseSaaSBillingReturn {
    packages: SubscriptionPackage[];
    payments: Payment[];
    subscription: TenantSubscription | null;
    hotel: BillingHotel | null;
    stats: BillingStats;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    subscribeToPlan: (packageId: number, billingCycle?: 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR') => Promise<boolean>;
}

const emptyStats: BillingStats = {
    currentPlan: '',
    nextBillingDate: '',
    totalPaid: 0,
    pendingAmount: 0,
    licenseStatus: 'TRIAL',
    billingCycle: undefined,
};

function mapPackage(pkg: Record<string, any>): SubscriptionPackage {
    return {
        id: Number(pkg.id),
        name: pkg.name || 'Unnamed Plan',
        description: pkg.description || 'Subscription package',
        price: Number(pkg.price || 0),
        billingCycle: 'MONTHLY',
        features: Array.isArray(pkg.features) ? pkg.features : [],
        isActive: Boolean(pkg.isActive),
        maxRooms: pkg.maxRooms ?? null,
        maxUsers: pkg.maxUsers ?? null,
    };
}

function mapPayment(payment: Record<string, any>): Payment {
    const status = payment.status === 'COMPLETED' ? 'COMPLETED' : payment.status || 'PENDING';

    return {
        id: String(payment.id),
        invoiceNumber: payment.invoiceNumber || `INV-${String(payment.id).slice(0, 8).toUpperCase()}`,
        amount: Number(payment.amount || 0),
        status,
        dueDate: payment.periodEnd || payment.createdAt || '',
        paidAt: status === 'PAID' || status === 'COMPLETED' ? (payment.createdAt || '') : undefined,
        description: payment.notes || payment.description || 'Subscription payment',
        createdAt: payment.createdAt || '',
        paymentMethod: payment.paymentMethod || undefined,
        currency: payment.currency || 'NPR',
        periodStart: payment.periodStart || undefined,
        periodEnd: payment.periodEnd || undefined,
    };
}

function deriveStats(hotel: BillingHotel | null, subscription: TenantSubscription | null, payments: Payment[]): BillingStats {
    const totalPaid = payments
        .filter((payment) => payment.status === 'PAID' || payment.status === 'COMPLETED')
        .reduce((sum, payment) => sum + payment.amount, 0);

    const pendingAmount = payments
        .filter((payment) => payment.status === 'PENDING' || payment.status === 'OVERDUE')
        .reduce((sum, payment) => sum + payment.amount, 0);

    return {
        currentPlan: subscription?.package?.name || (hotel?.licenseStatus === 'TRIAL' ? 'Trial' : 'Not assigned'),
        nextBillingDate: subscription?.currentPeriodEnd || subscription?.trialEndsAt || hotel?.licenseExpiresAt || '',
        totalPaid,
        pendingAmount,
        licenseStatus: hotel?.licenseStatus || subscription?.status || 'TRIAL',
        billingCycle: subscription?.billingCycle,
    };
}

export function useSaaSBilling(): UseSaaSBillingReturn {
    const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
    const [hotel, setHotel] = useState<BillingHotel | null>(null);
    const [stats, setStats] = useState<BillingStats>(emptyStats);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBilling = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [packagesRes, subscriptionRes] = await Promise.all([
                api.get<SubscriptionPackage[]>('/saas-billing/packages'),
                api.get<MySubscriptionResponse>('/saas-billing/my-subscription'),
            ]);

            const normalizedPackages = (packagesRes.data || []).map((pkg) => mapPackage(pkg as Record<string, any>));
            const billingContext = subscriptionRes.data;
            const normalizedHotel = billingContext
                ? {
                    id: billingContext.hotel.id,
                    name: billingContext.hotel.name,
                    licenseStatus: billingContext.hotel.licenseStatus,
                    licenseExpiresAt: billingContext.hotel.licenseExpiresAt || null,
                }
                : null;
            const normalizedSubscription = billingContext?.subscription
                ? {
                    ...billingContext.subscription,
                    package: billingContext.subscription.package
                        ? mapPackage({
                            ...billingContext.subscription.package,
                            isActive: true,
                        })
                        : null,
                }
                : null;
            const normalizedPayments = (billingContext?.recentPayments || []).map((payment) => mapPayment(payment));

            setPackages(normalizedPackages);
            setHotel(normalizedHotel);
            setSubscription(normalizedSubscription);
            setPayments(normalizedPayments);
            setStats(deriveStats(normalizedHotel, normalizedSubscription, normalizedPayments));
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to fetch billing data';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const subscribeToPlan = useCallback(async (packageId: number, billingCycle: 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR' = 'MONTHLY') => {
        try {
            await api.post('/saas-billing/subscribe', { packageId, billingCycle });
            toast.success('Subscription request submitted');
            await fetchBilling();
            return true;
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to update subscription';
            toast.error(message);
            return false;
        }
    }, [fetchBilling]);

    useEffect(() => {
        void fetchBilling();
    }, [fetchBilling]);

    return {
        packages,
        payments,
        subscription,
        hotel,
        stats,
        isLoading,
        error,
        refresh: fetchBilling,
        subscribeToPlan,
    };
}

export default useSaaSBilling;