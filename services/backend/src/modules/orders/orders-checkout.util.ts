import { BusinessLogicError } from '../../utils/errors';
import { FonepayService } from '../finance/fonepay.service';
import { CouponsService } from '../coupons/coupons.service';

export function computeOrderGross(
    subTotal: number,
    applyServiceCharge: boolean,
    applyVat: boolean,
    serviceChargeRate: number,
    vatRate: number,
): { serviceCharge: number; vat: number; gross: number } {
    const serviceCharge = applyServiceCharge ? subTotal * serviceChargeRate : 0;
    const vat = applyVat ? (subTotal + serviceCharge) * vatRate : 0;
    return { serviceCharge, vat, gross: subTotal + serviceCharge + vat };
}

export async function verifyFonepayPrn(
    hotelId: number,
    prn: string | undefined,
    expectedAmount: number,
): Promise<void> {
    if (!prn?.trim()) {
        throw new BusinessLogicError('Fonepay payment reference (PRN) is required');
    }
    const status = await FonepayService.checkStatus(hotelId, prn.trim());
    if (!status.paid) {
        throw new BusinessLogicError('Fonepay payment has not been confirmed yet');
    }
    const paidAmount = Number(status.raw?.amount ?? status.raw?.paidAmount ?? expectedAmount);
    if (!Number.isNaN(paidAmount) && paidAmount > 0 && Math.abs(paidAmount - expectedAmount) > 0.02) {
        throw new BusinessLogicError(
            `Fonepay amount mismatch: expected ${expectedAmount.toFixed(2)}, got ${paidAmount.toFixed(2)}`,
        );
    }
}

export async function resolveCouponDiscount(
    hotelId: number,
    couponId: number | undefined,
    grossBeforeDiscount: number,
    scope: 'ROOM' | 'FNB' | 'ALL' = 'FNB',
): Promise<{ couponId?: number; discount: number }> {
    if (!couponId) return { discount: 0 };
    const validated = await CouponsService.validateById(hotelId, couponId, grossBeforeDiscount, scope);
    return { couponId: validated.couponId, discount: validated.discount };
}
