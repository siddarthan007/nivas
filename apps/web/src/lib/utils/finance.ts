import type { Payment } from '@/lib/hooks/useFinance';

/** Exclude void reversals and already-voided originals from payment totals. */
export function computeNetPayments(payments: Payment[]) {
    const voidedOriginalIds = new Set(
        payments
            .filter((p) => p.transactionId?.startsWith('VOID-'))
            .map((p) => p.transactionId!.slice(5))
    );

    const activePayments = payments.filter((p) => {
        const amount = parseFloat(p.amount) || 0;
        if (amount <= 0) return false;
        if (voidedOriginalIds.has(p.id)) return false;
        return true;
    });

    const netTotal = activePayments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const reversalCount = payments.filter((p) => (parseFloat(p.amount) || 0) < 0).length;

    return { netTotal, activeCount: activePayments.length, reversalCount };
}
