import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

// Types
export interface InvoiceLineItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface Invoice {
    id: string;
    invoiceNumber: string;
    hotelId: number;
    bookingId: string;
    guestName: string;
    guestPan?: string;
    guestPhone?: string;
    guestEmail?: string;
    checkIn?: string;
    checkOut?: string;
    subTotal: string;
    serviceCharge: string;
    discountAmount: string;
    vatAmount: string;
    roomRevenue?: string;
    fbRevenue?: string;
    grandTotal: string;
    fiscalYear: string;
    paymentStatus?: string;
    isVoided: boolean;
    createdAt: string;
    booking?: {
        guestName: string;
        guestPhone?: string;
        guestEmail?: string;
        checkIn?: string;
        checkOut?: string;
    };
    lineItems?: InvoiceLineItem[];
}

export interface Payment {
    id: string;
    hotelId: number;
    bookingId?: string;
    orderId?: string;
    amount: string;
    paymentMethod: 'CASH' | 'CARD' | 'ESEWA' | 'KHALTI' | 'CONNECT_IPS' | 'FONEPAY' | 'BANK_TRANSFER' | 'OTHER';
    transactionId?: string;
    notes?: string;
    recordedById: string;
    createdAt: string;
}

export interface CreditNote {
    id: string;
    creditNoteNumber: string;
    originalInvoiceId: string;
    reason: string;
    amount: string;
    createdAt: string;
    originalInvoice?: {
        invoiceNumber: string;
        guestName: string;
    };
    createdBy?: {
        fullName: string;
    };
}

export interface Shift {
    id: string;
    userId: string;
    hotelId: number;
    startFloat: string;
    endCashCount?: string;
    systemCashTotal?: string;
    variance?: string;
    status: 'OPEN' | 'CLOSED';
    startTime: string;
    endTime?: string;
    notes?: string;
}

export interface RecordPaymentPayload {
    bookingId?: string;
    orderId?: string;
    amount: number;
    paymentMethod: Payment['paymentMethod'];
    transactionId?: string;
    notes?: string;
}

export interface GenerateInvoicePayload {
    bookingId: string;
    discount?: number;
    guestPan?: string;
    doCheckout?: boolean;
}

export function useFinance() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
    const [currentShift, setCurrentShift] = useState<Shift | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Invoices
    const fetchInvoices = useCallback(async (limit = 50) => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<Invoice[]>(`/invoices?limit=${limit}`);
            setInvoices(res.data || []);
        } catch (err: any) {
            const msg = err?.message || 'Failed to fetch invoices';
            setError(msg);
            toast.error(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const generateInvoice = async (data: GenerateInvoicePayload) => {
        setIsLoading(true);
        try {
            const res = await api.post<Invoice>('/invoices/generate', data);
            await fetchInvoices();
            toast.success('Invoice generated successfully');
            return res.data;
        } catch (err: any) {
            const msg = err?.message || 'Failed to generate invoice';
            toast.error(msg);
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Payments
    const fetchPayments = useCallback(async (limit = 50) => {
        setIsLoading(true);
        try {
            const res = await api.get<Payment[]>(`/finance/payments?limit=${limit}`);
            setPayments(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch payments');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const recordPayment = async (data: RecordPaymentPayload) => {
        setIsLoading(true);
        try {
            await api.post('/finance/payments', data);
            await Promise.all([fetchPayments(), fetchInvoices()]);
            toast.success('Payment recorded successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to record payment');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const voidPayment = async (paymentId: string, confirmPassword: string) => {
        setIsLoading(true);
        try {
            await api.post(`/finance/payments/${paymentId}/void`, { confirmPassword });
            await fetchPayments();
            toast.success('Payment voided');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to void payment');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Credit Notes
    const fetchCreditNotes = useCallback(async (limit = 50) => {
        setIsLoading(true);
        try {
            const res = await api.get<CreditNote[]>(`/credit-notes?limit=${limit}`);
            setCreditNotes(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch credit notes');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createCreditNote = async (invoiceId: string, reason: string, confirmPassword: string) => {
        setIsLoading(true);
        try {
            await api.post('/credit-notes', { invoiceId, reason, confirmPassword });
            await fetchCreditNotes();
            await fetchInvoices();
            toast.success('Credit note created, invoice voided');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create credit note');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Shifts
    const checkCurrentShift = useCallback(async () => {
        try {
            const res = await api.get<Shift | null>('/finance/shifts/current');
            setCurrentShift(res.data || null);
        } catch (err: any) {
            console.error('Failed to check shift:', err);
        }
    }, []);

    const startShift = async (startFloat: number) => {
        setIsLoading(true);
        try {
            const res = await api.post<Shift>('/finance/shifts/start', { startFloat });
            setCurrentShift(res.data || null);
            toast.success('Shift started');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to start shift');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const endShift = async (endCashCount: number, notes?: string) => {
        setIsLoading(true);
        try {
            const res = await api.post<{ shift: Shift; summary: any }>('/finance/shifts/end', {
                endCashCount,
                notes
            });
            setCurrentShift(null);
            toast.success('Shift closed');
            return res.data;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to end shift');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    // Accounting exports
    const exportTally = async (date?: string, type: 'sales' | 'purchase' | 'receipt' = 'sales') => {
        const endpoint = type === 'sales' ? '/finance/accounting/export-tally'
            : type === 'purchase' ? '/finance/accounting/export-tally-purchase'
                : '/finance/accounting/export-tally-receipt';

        const url = date ? `${endpoint}?date=${date}` : endpoint;
        window.open(`${api.getBaseUrl()}${url}`, '_blank');
    };

    const exportAnnex5 = async (date?: string, type: 'sales' | 'purchase' = 'sales') => {
        const endpoint = type === 'sales'
            ? '/finance/accounting/export-annex5-sales'
            : '/finance/accounting/export-annex5-purchase';

        const url = date ? `${endpoint}?date=${date}` : endpoint;
        window.open(`${api.getBaseUrl()}${url}`, '_blank');
    };

    return {
        // State
        invoices,
        payments,
        creditNotes,
        currentShift,
        isLoading,
        error,
        // Invoices
        fetchInvoices,
        generateInvoice,
        // Payments
        fetchPayments,
        recordPayment,
        voidPayment,
        // Credit Notes
        fetchCreditNotes,
        createCreditNote,
        // Shifts
        checkCurrentShift,
        startShift,
        endShift,
        // Accounting
        exportTally,
        exportAnnex5
    };
}

export interface FinanceDashboardSummary {
    totalRevenueMtd: number;
    accountsReceivable: number;
    accountsPayable: number;
    cashBankBalance: number;
    recentInvoices: Invoice[];
    recentPayments: Payment[];
    revenueTrend: any[];
}

export function useFinanceDashboard() {
    const [summary, setSummary] = useState<FinanceDashboardSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboardData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [tbRes, revRes, invRes, payRes] = await Promise.allSettled([
                api.get('/finance/gl/trial-balance'),
                api.get('/analytics/revenue?days=30'),
                api.get('/invoices?limit=5'),
                api.get('/finance/payments?limit=5')
            ]);

            const tbData = tbRes.status === 'fulfilled' ? tbRes.value.data : [];
            const revData: any = revRes.status === 'fulfilled' ? revRes.value.data : {};
            const invoices = invRes.status === 'fulfilled' ? invRes.value.data : [];
            const payments = payRes.status === 'fulfilled' ? payRes.value.data : [];

            // Calculate AR, AP, Cash from Trial Balance (mocked logic based on typical CoA naming)
            let ar = 0;
            let ap = 0;
            let cash = 0;

            if (Array.isArray(tbData)) {
                tbData.forEach((account: any) => {
                    const name = (account.name || account.account_name || '')?.toLowerCase();
                    const balance = Number(account.balance) || 0;
                    const type = (account.type || '').toLowerCase();

                    // Use account type when available, fallback to name heuristic.
                    if (type === 'asset' && (name.includes('receivable'))) ar += balance;
                    else if (!type && name.includes('receivable')) ar += balance;

                    if (type === 'liability' && name.includes('payable')) ap += Math.abs(balance);
                    else if (!type && name.includes('payable')) ap += Math.abs(balance);

                    if (type === 'asset' && (name.includes('cash') || name.includes('bank'))) cash += balance;
                    else if (!type && (name.includes('cash') || name.includes('bank'))) cash += balance;
                });
            }

            setSummary({
                totalRevenueMtd: revData?.totalRevenue || 0,
                accountsReceivable: ar,
                accountsPayable: ap,
                cashBankBalance: cash,
                recentInvoices: Array.isArray(invoices) ? invoices : [],
                recentPayments: Array.isArray(payments) ? payments : [],
                revenueTrend: revData?.trend || []
            });
        } catch (err: any) {
            setError(err?.message || 'Failed to fetch dashboard data');
            toast.error('Failed to load dashboard data');
        } finally {
            setIsLoading(false);
        }
    }, []);

    return {
        summary,
        isLoading,
        error,
        fetchDashboardData
    };
}
