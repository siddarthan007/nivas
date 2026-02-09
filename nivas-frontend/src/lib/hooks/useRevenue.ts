import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

// Types
export interface PricingRule {
    id: number;
    hotelId: number;
    name: string;
    type: string;
    adjustmentType: 'FLAT' | 'PERCENTAGE';
    adjustmentValue: number;
    startDate?: string;
    endDate?: string;
    daysOfWeek?: number[];
    isActive: boolean;
    minOccupancy?: number;
    maxOccupancy?: number;
    createdAt: string;
}

export interface DiscountRule {
    id: number;
    hotelId: number;
    outletId?: number;
    name: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FLAT' | 'BOGO';
    discountValue: number;
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    startDate?: string;
    endDate?: string;
    minOrderAmount?: number;
    applicableCategories?: string[];
    applicableItems?: number[];
    priority?: number;
    isActive: boolean;
    createdAt: string;
}

export interface CreatePricingRulePayload {
    name: string;
    type: string;
    adjustmentType: 'FLAT' | 'PERCENTAGE';
    adjustmentValue: number;
    startDate?: string;
    endDate?: string;
    daysOfWeek?: number[];
    isActive?: boolean;
    minOccupancy?: number;
    maxOccupancy?: number;
}

export interface CreateDiscountRulePayload {
    outletId?: number;
    name: string;
    description?: string;
    discountType: 'PERCENTAGE' | 'FLAT' | 'BOGO';
    discountValue: number;
    startTime?: string;
    endTime?: string;
    daysOfWeek?: number[];
    startDate?: string;
    endDate?: string;
    minOrderAmount?: number;
    applicableCategories?: string[];
    applicableItems?: number[];
    priority?: number;
}

export interface LosDiscount {
    id: number;
    hotelId: number;
    name: string;
    minNights: number;
    maxNights?: number;
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    isActive: boolean;
    startDate?: string;
    endDate?: string;
    createdAt: string;
}

export interface CreateLosDiscountPayload {
    name: string;
    minNights: number;
    maxNights?: number;
    discountType: 'PERCENTAGE' | 'FLAT';
    discountValue: number;
    isActive?: boolean;
    startDate?: string;
    endDate?: string;
}

export function useRevenue() {
    const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
    const [discountRules, setDiscountRules] = useState<DiscountRule[]>([]);
    const [losDiscounts, setLosDiscounts] = useState<LosDiscount[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Pricing Rules
    const fetchPricingRules = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<PricingRule[]>('/revenue/pricing/rules');
            setPricingRules(res.data || []);
        } catch (err: any) {
            const msg = err?.message || 'Failed to fetch pricing rules';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createPricingRule = async (data: CreatePricingRulePayload) => {
        setIsLoading(true);
        try {
            await api.post('/revenue/pricing/rules', data);
            await fetchPricingRules();
            toast.success('Pricing rule created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create pricing rule');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updatePricingRule = async (id: number, data: Partial<CreatePricingRulePayload>) => {
        setIsLoading(true);
        try {
            await api.patch(`/revenue/pricing/rules/${id}`, data);
            await fetchPricingRules();
            toast.success('Pricing rule updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update pricing rule');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deletePricingRule = async (id: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/revenue/pricing/rules/${id}`);
            await fetchPricingRules();
            toast.success('Pricing rule deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete pricing rule');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const checkRate = async (baseRate: number, date: string) => {
        try {
            const res = await api.post<{ finalRate: number; appliedRules: any[] }>('/revenue/pricing/check-rate', {
                baseRate,
                date
            });
            return res.data;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to check rate');
            return null;
        }
    };

    // Discount Rules
    const fetchDiscountRules = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<DiscountRule[]>('/discounts');
            setDiscountRules(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch discount rules');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createDiscountRule = async (data: CreateDiscountRulePayload) => {
        setIsLoading(true);
        try {
            await api.post('/discounts', data);
            await fetchDiscountRules();
            toast.success('Discount rule created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create discount rule');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateDiscountRule = async (id: number, data: Partial<CreateDiscountRulePayload & { isActive?: boolean }>) => {
        setIsLoading(true);
        try {
            await api.patch(`/discounts/${id}`, data);
            await fetchDiscountRules();
            toast.success('Discount rule updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update discount rule');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteDiscountRule = async (id: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/discounts/${id}`);
            await fetchDiscountRules();
            toast.success('Discount rule deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete discount rule');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // LOS Discounts
    const fetchLosDiscounts = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<LosDiscount[]>('/los-discounts');
            setLosDiscounts(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch LOS discounts');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createLosDiscount = async (data: CreateLosDiscountPayload) => {
        setIsLoading(true);
        try {
            await api.post('/los-discounts', data);
            await fetchLosDiscounts();
            toast.success('LOS discount created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create LOS discount');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateLosDiscount = async (id: number, data: Partial<CreateLosDiscountPayload & { isActive?: boolean }>) => {
        setIsLoading(true);
        try {
            await api.patch(`/los-discounts/${id}`, data);
            await fetchLosDiscounts();
            toast.success('LOS discount updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update LOS discount');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteLosDiscount = async (id: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/los-discounts/${id}`);
            await fetchLosDiscounts();
            toast.success('LOS discount deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete LOS discount');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        // State
        pricingRules,
        discountRules,
        losDiscounts,
        isLoading,
        error,
        // Pricing
        fetchPricingRules,
        createPricingRule,
        updatePricingRule,
        deletePricingRule,
        checkRate,
        // Discounts
        fetchDiscountRules,
        createDiscountRule,
        updateDiscountRule,
        deleteDiscountRule,
        // LOS Discounts
        fetchLosDiscounts,
        createLosDiscount,
        updateLosDiscount,
        deleteLosDiscount,
    };
}
