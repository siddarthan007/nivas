import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

// Types
export interface Invoice {
    id: string;
    invoiceNumber: string;
    hotelId: number;
    bookingId: string;
    guestName: string;
    guestPan?: string;
    roomCharges: string;
    serviceCharges: string;
    restaurantCharges: string;
    otherCharges: string;
    discountAmount: string;
    taxableAmount: string;
    vatAmount: string;
    grandTotal: string;
    fiscalYear: string;
    cbmsSynced: boolean;
    isVoided: boolean;
    createdAt: string;
    booking?: {
        guestName: string;
    };
}

export interface Payment {
    id: string;
    hotelId: number;
    bookingId?: string;
    orderId?: string;
    amount: string;
    paymentMethod: 'CASH' | 'CARD' | 'ESEWA' | 'KHALTI' | 'CONNECT_IPS' | 'UPI' | 'BANK_TRANSFER' | 'OTHER';
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

    const syncInvoiceCbms = async (invoiceId: string) => {
        try {
            await api.post(`/invoices/${invoiceId}/sync-cbms`, {});
            toast.success('CBMS sync initiated');
            await fetchInvoices();
        } catch (err: any) {
            toast.error(err?.message || 'CBMS sync failed');
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
            await fetchPayments();
            toast.success('Payment recorded successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to record payment');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const voidPayment = async (paymentId: string) => {
        setIsLoading(true);
        try {
            await api.post(`/finance/payments/${paymentId}/void`, {});
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

    const createCreditNote = async (invoiceId: string, reason: string) => {
        setIsLoading(true);
        try {
            await api.post('/credit-notes', { invoiceId, reason });
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

    const retryFailedCbms = async () => {
        try {
            await api.post('/finance/accounting/cbms/retry-failed', {});
            toast.success('Retry initiated for failed CBMS syncs');
            await fetchInvoices();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to retry CBMS syncs');
        }
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
        syncInvoiceCbms,
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
        exportAnnex5,
        retryFailedCbms
    };
}
