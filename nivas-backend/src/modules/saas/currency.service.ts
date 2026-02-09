import { db } from '../../db';
import { exchangeRates } from '../../db/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

export interface ConversionResult {
    from: string;
    to: string;
    amount: number;
    convertedAmount: number;
    rate: number;
}

export const CurrencyService = {
    supportedCurrencies: ['NPR', 'INR'] as const,

    async getRate(from: string, to: string): Promise<number | null> {
        const today = new Date().toISOString().split('T')[0];

        const rate = await db.query.exchangeRates.findFirst({
            where: and(
                eq(exchangeRates.baseCurrency, from),
                eq(exchangeRates.targetCurrency, to)
            ),
            orderBy: (r, { desc }) => [desc(r.effectiveFrom)]
        });

        if (rate) return parseFloat(rate.rate);

        const reverseRate = await db.query.exchangeRates.findFirst({
            where: and(
                eq(exchangeRates.baseCurrency, to),
                eq(exchangeRates.targetCurrency, from)
            ),
            orderBy: (r, { desc }) => [desc(r.effectiveFrom)]
        });

        if (reverseRate) return 1 / parseFloat(reverseRate.rate);

        return null;
    },

    async convert(from: string, to: string, amount: number): Promise<ConversionResult | null> {
        if (from === to) {
            return { from, to, amount, convertedAmount: amount, rate: 1 };
        }

        const rate = await this.getRate(from, to);
        if (!rate) return null;

        return {
            from,
            to,
            amount,
            convertedAmount: Math.round(amount * rate * 100) / 100,
            rate
        };
    },

    formatCurrency(amount: number, currency: string): string {
        const symbols: Record<string, string> = {
            NPR: 'रू',
            INR: '₹'
        };

        const formatted = new Intl.NumberFormat('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);

        return `${symbols[currency] || currency} ${formatted}`;
    }
};
