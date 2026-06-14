'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import ENDPOINTS from '@/lib/api/endpoints';
import type { GeneratePayrollPayload, PayrollSummary } from '@/lib/types/api.types';

function unwrapList<T>(response: { data?: T } | T): T | null {
    if (response && typeof response === 'object' && 'data' in response && (response as { data?: T }).data !== undefined) {
        return (response as { data: T }).data;
    }
    return (response as T) ?? null;
}

export function useHR() {
    const [payroll, setPayroll] = useState<PayrollSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPayroll = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<PayrollSummary[]>(ENDPOINTS.HR.PAYROLL_LIST);
            const data = unwrapList<PayrollSummary[]>(response);
            if (!Array.isArray(data)) {
                setError('Invalid payroll data format');
                setPayroll([]);
                return;
            }
            const mapped: PayrollSummary[] = data.map((p: PayrollSummary & {
                userId?: string;
                employee?: { fullName?: string };
                overtimePay?: number;
            }) => ({
                id: p.id,
                employeeId: p.userId || p.employeeId || '',
                employeeName: p.employee?.fullName || p.employeeName || 'Unknown',
                periodStart: p.periodStart,
                periodEnd: p.periodEnd,
                baseSalary: parseFloat(String(p.baseSalary || 0)),
                deductions: parseFloat(String(p.deductions || 0)),
                bonuses: parseFloat(String(p.bonuses || p.overtimePay || 0)),
                netPay: parseFloat(String(p.netPay || 0)),
                status: p.status as PayrollSummary['status'],
                paymentDate: p.paymentDate,
            }));
            setPayroll(mapped);
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
            const response = await api.post<PayrollSummary>(ENDPOINTS.HR.PAYROLL_CREATE, data);
            if (response.data) {
                await fetchPayroll();
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
            const response = await api.post<PayrollSummary>(ENDPOINTS.HR.PAYROLL_PAY(id), { confirmPassword });
            if (response.data) {
                await fetchPayroll();
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

    const generatePayrollFromAttendance = async (data: {
        employeeId: string;
        periodStart: string;
        periodEnd: string;
        monthlyBaseSalary: number;
        hourlyRate?: number;
        deductions?: number;
    }) => {
        try {
            const response = await api.post<PayrollSummary>('/hr/payroll/from-attendance', data);
            if (response.data) {
                await fetchPayroll();
                toast.success('Payroll generated from approved attendance');
                return { success: true, payroll: response.data };
            }
            return { success: false, error: 'Failed to generate payroll' };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to generate payroll from attendance';
            toast.error(msg);
            return { success: false, error: msg };
        }
    };

    const previewPayrollFromAttendance = async (data: {
        employeeId: string;
        periodStart: string;
        periodEnd: string;
        monthlyBaseSalary: number;
        hourlyRate?: number;
        deductions?: number;
    }) => {
        const params = new URLSearchParams({
            employeeId: data.employeeId,
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            monthlyBaseSalary: String(data.monthlyBaseSalary),
            deductions: String(data.deductions || 0),
        });
        if (data.hourlyRate) params.append('hourlyRate', String(data.hourlyRate));
        const response = await api.get<{
            daysPresent: number;
            totalHours: number;
            overtimeHours: number;
            hourlyRate: number;
            regularPay: number;
            overtimePay: number;
            deductions: number;
            netPay: number;
        }>(`/hr/payroll/attendance-preview?${params.toString()}`);
        return response.data;
    };

    return {
        payroll,
        isLoading,
        error,
        fetchPayroll,
        generatePayroll,
        generatePayrollFromAttendance,
        previewPayrollFromAttendance,
        processPayment,
    };
}

