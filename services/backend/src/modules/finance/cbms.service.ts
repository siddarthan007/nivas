import NepaliDate from 'nepali-date-converter';
import { db } from '../../db';
import { cbmsLogs, hotels, invoices, creditNotes, tenantFeatures } from '../../db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { getRedis } from '../../shared/redis';
import { logger } from '../../shared/logger';

const BILL_URL = process.env.CBMS_BILL_URL || 'https://cbapi.ird.gov.np/api/bill';
const RETURN_URL = process.env.CBMS_RETURN_URL || 'https://cbapi.ird.gov.np/api/billreturn';
const MAX_ATTEMPTS = 6;
const LOCK_KEY = 'lock:cbms:worker';

type CbmsCfg = { enabled?: boolean; username?: string; password?: string; sellerPan?: string; isRealtime?: boolean };

const num = (v: any) => Math.round((parseFloat(v ?? '0') || 0) * 100) / 100;

// BS date "YYYY.MM.DD" (IRD format) from a JS Date.
function bsDate(d: Date): string {
    const n = new NepaliDate(d);
    return `${n.getYear()}.${String(n.getMonth() + 1).padStart(2, '0')}.${String(n.getDate()).padStart(2, '0')}`;
}
// IRD CBMS datetimeClient format: "yyyy-MM-dd HH:mm:ss" (NOT ISO with T/Z).
function cbmsDateTime(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
// Invoice fiscalYear is stored "81/82" → CBMS wants "2081.082".
function cbmsFiscalYear(fy?: string | null): string {
    if (!fy) return '';
    const start = parseInt(fy.split('/')[0] || '0', 10);
    const fullStart = start < 100 ? 2000 + start : start;
    return `${fullStart}.0${String((fullStart + 1) % 100).padStart(2, '0')}`;
}

export const CbmsService = {
    async getConfig(hotelId: number): Promise<{ cfg: CbmsCfg; sellerPan: string } | null> {
        // Plan gate FIRST — CBMS is only available on plans that include it.
        const feat = await db.query.tenantFeatures.findFirst({ where: eq(tenantFeatures.hotelId, hotelId), columns: { enableCbms: true } });
        if (!feat?.enableCbms) return null;

        const hotel = await db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { cbmsConfig: true, panNumber: true } });
        if (!hotel) return null;
        const cfg = (hotel.cbmsConfig || {}) as CbmsCfg;
        if (!cfg.enabled || !cfg.username || !cfg.password) return null; // hotel toggle + creds
        const sellerPan = cfg.sellerPan || hotel.panNumber || '';
        if (!sellerPan) return null;
        return { cfg, sellerPan };
    },

    /** Queue an invoice/credit-note for CBMS sync (idempotent — unique row per doc). */
    async enqueue(hotelId: number, docType: 'BILL' | 'RETURN', refId: string, invoiceNumber?: string) {
        // Skip if CBMS isn't configured for the hotel.
        const cfg = await this.getConfig(hotelId);
        if (!cfg) return;
        await db.insert(cbmsLogs)
            .values({ hotelId, docType, refId, invoiceNumber, status: 'PENDING' })
            .onConflictDoNothing();
    },

    async buildBillPayload(hotelId: number, invoiceId: string, cfg: CbmsCfg, sellerPan: string) {
        const inv = await db.query.invoices.findFirst({ where: and(eq(invoices.id, invoiceId), eq(invoices.hotelId, hotelId)) });
        if (!inv) return null;
        const taxable = num(inv.subTotal) + num(inv.serviceCharge) - num(inv.discountAmount);
        return {
            username: cfg.username, password: cfg.password, seller_pan: sellerPan,
            buyer_pan: inv.guestPan || '', buyer_name: inv.guestName || '',
            fiscal_year: cbmsFiscalYear(inv.fiscalYear),
            invoice_number: inv.invoiceNumber,
            invoice_date: bsDate(inv.createdAt || new Date()),
            total_sales: num(inv.grandTotal),
            taxable_sales_vat: Math.max(0, taxable),
            vat: num(inv.vatAmount),
            excisable_amount: 0, excise: 0, taxable_sales_hst: 0, hst: 0,
            amount_for_esf: 0, esf: 0, export_sales: 0,
            tax_exempted_sales: 0,
            isrealtime: cfg.isRealtime ?? true,
            datetimeClient: cbmsDateTime(new Date()),
        };
    },

    async buildReturnPayload(hotelId: number, creditNoteId: string, cfg: CbmsCfg, sellerPan: string) {
        const cn = await db.query.creditNotes.findFirst({ where: and(eq(creditNotes.id, creditNoteId), eq(creditNotes.hotelId, hotelId)) });
        if (!cn) return null;
        const inv = cn.originalInvoiceId
            ? await db.query.invoices.findFirst({ where: eq(invoices.id, cn.originalInvoiceId) })
            : null;
        const taxable = num(inv?.subTotal) + num(inv?.serviceCharge) - num(inv?.discountAmount);
        return {
            username: cfg.username, password: cfg.password, seller_pan: sellerPan,
            buyer_pan: inv?.guestPan || '', buyer_name: inv?.guestName || '',
            fiscal_year: cbmsFiscalYear(cn.fiscalYear || inv?.fiscalYear),
            ref_invoice_number: inv?.invoiceNumber || '',
            credit_note_number: cn.creditNoteNumber,
            credit_note_date: bsDate(cn.createdAt || new Date()),
            reason_for_return: cn.reason || 'Return',
            total_sales: num(inv?.grandTotal ?? cn.amount),
            taxable_sales_vat: Math.max(0, taxable),
            vat: num(inv?.vatAmount),
            excisable_amount: 0, excise: 0, taxable_sales_hst: 0, hst: 0,
            amount_for_esf: 0, esf: 0, export_sales: 0, tax_exempted_sales: 0,
            isrealtime: cfg.isRealtime ?? true,
            datetimeClient: cbmsDateTime(new Date()),
        };
    },

    /** POST one log to CBMS. Maps IRD response codes → status. */
    async pushOne(log: typeof cbmsLogs.$inferSelect): Promise<void> {
        const cfg = await this.getConfig(log.hotelId);
        if (!cfg) return; // config removed → leave PENDING

        const payload = log.docType === 'RETURN'
            ? await this.buildReturnPayload(log.hotelId, log.refId, cfg.cfg, cfg.sellerPan)
            : await this.buildBillPayload(log.hotelId, log.refId, cfg.cfg, cfg.sellerPan);
        if (!payload) {
            await db.update(cbmsLogs).set({ status: 'FAILED', lastError: 'document not found', updatedAt: new Date() }).where(eq(cbmsLogs.id, log.id));
            return;
        }

        const url = log.docType === 'RETURN' ? RETURN_URL : BILL_URL;
        let code = 0; let errText = '';
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(20000),
            });
            // CBMS returns the numeric code in the body or as status.
            const text = await res.text();
            const parsed = parseInt((text || '').replace(/[^0-9]/g, '').slice(0, 3)) || (res.ok ? 200 : res.status);
            code = parsed;
            errText = res.ok ? '' : text.slice(0, 400);
        } catch (e: any) {
            errText = String(e?.message || e).slice(0, 400);
        }

        const attempts = log.attempts + 1;
        // 200 = saved; 101 = already exists → both are terminal success (idempotent).
        if (code === 200 || code === 101) {
            await db.update(cbmsLogs).set({ status: code === 101 ? 'EXISTS' : 'SENT', responseCode: code, attempts, sentAt: new Date(), payload, updatedAt: new Date() }).where(eq(cbmsLogs.id, log.id));
            return;
        }
        // 100 (bad creds) / 104 (invalid) / 105 (not found) are non-retryable → FAIL fast.
        const nonRetryable = code === 100 || code === 104 || code === 105;
        const status = (nonRetryable || attempts >= MAX_ATTEMPTS) ? 'FAILED' : 'PENDING';
        await db.update(cbmsLogs).set({ status, responseCode: code || null, attempts, lastError: errText || `code ${code}`, payload, updatedAt: new Date() }).where(eq(cbmsLogs.id, log.id));
    },

    /** Worker — runs on a cron. Distributed-locked so only one instance processes. */
    async processQueue(): Promise<number> {
        const redis = getRedis();
        if (redis?.status === 'ready') {
            const locked = await redis.set(LOCK_KEY, '1', 'EX', 110, 'NX').catch(() => null);
            if (locked !== 'OK') return 0;
        }
        try {
            const pending = await db.query.cbmsLogs.findMany({
                where: and(eq(cbmsLogs.status, 'PENDING'), lt(cbmsLogs.attempts, MAX_ATTEMPTS)),
                orderBy: (c, { asc }) => [asc(c.createdAt)],
                limit: 50,
            });
            let done = 0;
            for (const log of pending) {
                try { await this.pushOne(log); done++; } catch (err) { logger.warn?.({ err, id: log.id }, '[cbms] push failed'); }
            }
            return done;
        } finally {
            try { if (redis?.status === 'ready') await redis.del(LOCK_KEY); } catch { /* ignore */ }
        }
    },
};
