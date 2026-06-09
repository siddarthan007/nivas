import { createHmac, randomUUID } from 'crypto';
import { db } from '../../db';
import { hotels, tenantFeatures } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ForbiddenError, BusinessLogicError } from '../../utils/errors';

/**
 * Fonepay (Nepal) Dynamic-QR gateway integration.
 *
 * Optional, plan-gated (tenantFeatures.enableFonepay). Merchant credentials are
 * read from hotels.paymentConfig.fonepay { merchantCode, secretKey, username,
 * password, apiBaseUrl }. The data-validation (DV) field is an HMAC-SHA512 of
 * the comma-joined message using the merchant secret, per Fonepay's spec.
 */

const DEFAULT_BASE = 'https://merchantapi.fonepay.com/api/merchant/merchantDetailsForThirdParty';

interface FonepayConfig {
    merchantCode: string;
    secretKey: string;
    username?: string;
    password?: string;
    apiBaseUrl?: string;
}

function sign(secret: string, parts: (string | number)[]): string {
    const message = parts.join(',');
    return createHmac('sha512', secret).update(message).digest('hex');
}

export const FonepayService = {
    /** Throws if the hotel's plan doesn't include Fonepay or it's unconfigured. */
    async getConfig(hotelId: number): Promise<FonepayConfig> {
        const [features, hotel] = await Promise.all([
            db.query.tenantFeatures.findFirst({ where: eq(tenantFeatures.hotelId, hotelId) }),
            db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { paymentConfig: true } }),
        ]);
        if (!features?.enableFonepay) {
            throw new ForbiddenError('Fonepay is not enabled on your plan');
        }
        const cfg = ((hotel?.paymentConfig as any)?.fonepay || {}) as FonepayConfig;
        if (!cfg.merchantCode || !cfg.secretKey) {
            throw new BusinessLogicError('Fonepay is not configured. Add merchant code and secret in Settings → Payment Methods.');
        }
        return cfg;
    },

    /**
     * Generate a dynamic QR for an amount. Returns the QR message string the
     * client renders, plus the PRN (product reference number) used to poll
     * status later.
     */
    async generateQr(hotelId: number, data: { amount: number; remarks1?: string; remarks2?: string; prn?: string }) {
        const cfg = await this.getConfig(hotelId);
        const base = cfg.apiBaseUrl || DEFAULT_BASE;
        const prn = data.prn || randomUUID();
        const amount = Number(data.amount).toFixed(2);
        const remarks1 = data.remarks1 || 'Payment';
        const remarks2 = data.remarks2 || hotelId.toString();

        // DV per Fonepay dynamic-QR download spec: amount,prn,merchantCode,remarks1,remarks2
        // (comma-joined, NOT url-encoded, HMAC-SHA512 with the merchant secret).
        const dv = sign(cfg.secretKey, [amount, prn, cfg.merchantCode, remarks1, remarks2]);

        const payload = {
            amount, remarks1, remarks2, prn,
            merchantCode: cfg.merchantCode,
            username: cfg.username,
            password: cfg.password,
            dataValidation: dv,
        };

        try {
            const res = await fetch(`${base}/thirdPartyDynamicQrDownload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new BusinessLogicError(`Fonepay error: ${(body as any)?.message || res.statusText}`);
            }
            return {
                prn,
                amount: Number(amount),
                qrMessage: (body as any)?.qrMessage || (body as any)?.message || '',
                raw: body,
            };
        } catch (e: any) {
            if (e instanceof BusinessLogicError) throw e;
            throw new BusinessLogicError(`Could not reach Fonepay: ${e?.message || 'network error'}`);
        }
    },

    /** Poll the payment status for a PRN. Returns { paid, status, raw }. */
    async checkStatus(hotelId: number, prn: string) {
        const cfg = await this.getConfig(hotelId);
        const base = cfg.apiBaseUrl || DEFAULT_BASE;
        const dv = sign(cfg.secretKey, [prn, cfg.merchantCode]);
        const payload = {
            prn, merchantCode: cfg.merchantCode,
            username: cfg.username, password: cfg.password,
            dataValidation: dv,
        };
        try {
            const res = await fetch(`${base}/thirdPartyDynamicQrGetStatus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const body: any = await res.json().catch(() => ({}));
            const status = body?.paymentStatus || body?.status || 'PENDING';
            return { prn, paid: String(status).toUpperCase() === 'SUCCESS', status, raw: body };
        } catch (e: any) {
            throw new BusinessLogicError(`Could not reach Fonepay: ${e?.message || 'network error'}`);
        }
    },
};
