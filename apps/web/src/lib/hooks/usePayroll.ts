import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import ENDPOINTS from '@/lib/api/endpoints';
import { toast } from 'sonner';

export interface PayrollSummary {
    id: number;
    hotelId: string;
    employeeId: string;
    employeeName: string; // Typically joined from User
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    deductions: number;
    bonuses: number;
    netPay: number;
    status: 'DRAFT' | 'APPROVED' | 'PAID';
    glJournalId?: string;
    createdAt: string;
}

export interface CreatePayrollPayload {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    deductions?: number;
    bonuses?: number;
}

export function usePayroll() {
    const [payrolls, setPayrolls] = useState<PayrollSummary[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPayrolls = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<PayrollSummary[]>(ENDPOINTS.HR.PAYROLL_LIST);
            setPayrolls(response.data || []);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch payrolls');
            toast.error(err.message || 'Failed to fetch payrolls');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createPayroll = async (payload: CreatePayrollPayload) => {
        try {
            await api.post(ENDPOINTS.HR.PAYROLL_CREATE, payload);
            toast.success('Payroll generated successfully');
            await fetchPayrolls();
            return true;
        } catch (err: any) {
            toast.error(err.message || 'Failed to generate payroll');
            return false;
        }
    };

    const payPayroll = async (id: number) => {
        try {
            await api.post(ENDPOINTS.HR.PAYROLL_PAY(id), {});
            toast.success('Payroll marked as paid and posted to GL');
            await fetchPayrolls();
            return true;
        } catch (err: any) {
            toast.error(err.message || 'Failed to process payment');
            return false;
        }
    };

    return {
        payrolls,
        isLoading,
        error,
        fetchPayrolls,
        createPayroll,
        payPayroll
    };
}
