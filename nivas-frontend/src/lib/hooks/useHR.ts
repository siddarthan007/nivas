'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
    PayrollSummary,
    GeneratePayrollPayload,
} from '@/lib/types/api.types';

export function useHR() {
    const [payroll, setPayroll] = useState<PayrollSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPayroll = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<any[]>('/hr/payroll');
            if (response.data) {
                const mapped: PayrollSummary[] = response.data.map((p: any) => ({
                    id: p.id,
                    employeeId: p.userId || p.employeeId || '',
                    employeeName: p.employee?.fullName || p.employeeName || 'Unknown',
                    periodStart: p.periodStart,
                    periodEnd: p.periodEnd,
                    baseSalary: parseFloat(p.baseSalary || 0),
                    deductions: parseFloat(p.deductions || 0),
                    bonuses: parseFloat(p.bonuses || p.overtimePay || 0),
                    netPay: parseFloat(p.netPay || 0),
                    status: p.status === 'PAID' ? 'PAID' : 'PENDING',
                    paymentDate: p.paymentDate,
                }));
                setPayroll(mapped);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch payroll data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPayroll();
    }, [fetchPayroll]);

    const generatePayroll = async (data: GeneratePayrollPayload) => {
        try {
            const response = await api.post<PayrollSummary>('/hr/payroll', data);
            if (response.data) {
                setPayroll(prev => [...prev, response.data!]);
                toast.success('Payroll generated');
                return { success: true, payroll: response.data };
            }
            return { success: false, error: 'Failed to generate payroll' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to generate payroll';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    const processPayment = async (id: number, confirmPassword: string) => {
        try {
            const response = await api.post<PayrollSummary>(`/hr/payroll/${id}/pay`, { confirmPassword });
            if (response.data) {
                setPayroll(prev => prev.map(p => p.id === id ? response.data! : p));
                toast.success('Payment processed');
                return { success: true, payroll: response.data };
            }
            return { success: false, error: 'Failed to process payment' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to process payment';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    return {
        payroll,
        isLoading,
        error,
        fetchPayroll,
        generatePayroll,
        processPayment
    };
}
