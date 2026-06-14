export interface CreditCheckResult {
    ok: boolean;
    warning?: string;
    balance: number;
    limit: number;
    projected: number;
}

/** Pure credit-limit evaluation — used by CorporateService and tests. */
export function evaluateCreditLimit(
    balance: number,
    limit: number,
    additionalAmount: number,
    companyName = 'Corporate account',
): CreditCheckResult {
    const projected = balance + additionalAmount;

    if (!limit || limit <= 0) {
        return { ok: true, balance, limit: 0, projected };
    }

    if (projected > limit) {
        const warning = `Corporate account "${companyName}" will exceed credit limit: NPR ${projected.toFixed(2)} / NPR ${limit.toFixed(2)} (current balance NPR ${balance.toFixed(2)})`;
        return { ok: false, warning, balance, limit, projected };
    }

    return { ok: true, balance, limit, projected };
}
