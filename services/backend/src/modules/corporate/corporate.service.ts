import { db } from '../../db';
import { corporateAccounts, travelAgents, corporateLedger } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { evaluateCreditLimit, type CreditCheckResult } from './corporate-credit.util';

export type { CreditCheckResult };

export const CorporateService = {
    async getCompanies(hotelId: number) {
        return await db.query.corporateAccounts.findMany({
            where: eq(corporateAccounts.hotelId, hotelId)
        });
    },

    async createCompany(hotelId: number, data: any) {
        const [company] = await db.insert(corporateAccounts).values({
            hotelId,
            companyName: data.companyName,
            contactPerson: data.contactPerson,
            email: data.email,
            phone: data.phone,
            contractRate: data.contractRate?.toString(),
            discountPercentage: data.discountPercentage?.toString(),
            creditLimit: data.creditLimit?.toString()
        }).returning();
        return company;
    },

    async getTravelAgents(hotelId: number) {
        return await db.query.travelAgents.findMany({
            where: eq(travelAgents.hotelId, hotelId)
        });
    },

    async createTravelAgent(hotelId: number, data: any) {
        const [agent] = await db.insert(travelAgents).values({
            hotelId,
            name: data.name,
            agencyName: data.agencyName,
            email: data.email,
            phone: data.phone,
            commissionRate: data.commissionRate.toString()
        }).returning();
        return agent;
    },

    async getCompanyById(hotelId: number, companyId: number) {
        const company = await db.query.corporateAccounts.findFirst({
            where: and(eq(corporateAccounts.id, companyId), eq(corporateAccounts.hotelId, hotelId))
        });
        if (!company) throw new NotFoundError('Corporate Account');
        return company;
    },

    async updateCompany(hotelId: number, companyId: number, data: any) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.companyName !== undefined) updateData.companyName = data.companyName;
        if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.contractRate !== undefined) updateData.contractRate = data.contractRate.toString();
        if (data.discountPercentage !== undefined) updateData.discountPercentage = data.discountPercentage.toString();
        if (data.creditLimit !== undefined) updateData.creditLimit = data.creditLimit.toString();

        const [updated] = await db.update(corporateAccounts)
            .set(updateData)
            .where(and(eq(corporateAccounts.id, companyId), eq(corporateAccounts.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Corporate Account');
        return updated;
    },

    async deleteCompany(hotelId: number, companyId: number) {
        const [deleted] = await db.delete(corporateAccounts)
            .where(and(eq(corporateAccounts.id, companyId), eq(corporateAccounts.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Corporate Account');
        return deleted;
    },

    async getAgentById(hotelId: number, agentId: number) {
        const agent = await db.query.travelAgents.findFirst({
            where: and(eq(travelAgents.id, agentId), eq(travelAgents.hotelId, hotelId))
        });
        if (!agent) throw new NotFoundError('Travel Agent');
        return agent;
    },

    async updateAgent(hotelId: number, agentId: number, data: any) {
        const updateData: Record<string, any> = { updatedAt: new Date() };
        if (data.name !== undefined) updateData.name = data.name;
        if (data.agencyName !== undefined) updateData.agencyName = data.agencyName;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phone !== undefined) updateData.phone = data.phone;
        if (data.commissionRate !== undefined) updateData.commissionRate = data.commissionRate.toString();

        const [updated] = await db.update(travelAgents)
            .set(updateData)
            .where(and(eq(travelAgents.id, agentId), eq(travelAgents.hotelId, hotelId)))
            .returning();
        if (!updated) throw new NotFoundError('Travel Agent');
        return updated;
    },

    async deleteAgent(hotelId: number, agentId: number) {
        const [deleted] = await db.delete(travelAgents)
            .where(and(eq(travelAgents.id, agentId), eq(travelAgents.hotelId, hotelId)))
            .returning();
        if (!deleted) throw new NotFoundError('Travel Agent');
        return deleted;
    },

    async getLedger(hotelId: number, companyId: number) {
        const company = await db.query.corporateAccounts.findFirst({
            where: and(eq(corporateAccounts.id, companyId), eq(corporateAccounts.hotelId, hotelId))
        });
        if (!company) throw new NotFoundError('Corporate Account');

        const entries = await db.query.corporateLedger.findMany({
            where: and(eq(corporateLedger.corporateAccountId, companyId), eq(corporateLedger.hotelId, hotelId)),
            orderBy: [desc(corporateLedger.createdAt)],
            with: { createdBy: { columns: { name: true } } }
        });

        const balance = entries.length > 0 ? parseFloat(entries[0]!.balance) : 0;
        return { company, entries, balance };
    },

    async addLedgerEntry(hotelId: number, companyId: number, data: any, userId?: string) {
        const company = await db.query.corporateAccounts.findFirst({
            where: and(eq(corporateAccounts.id, companyId), eq(corporateAccounts.hotelId, hotelId))
        });
        if (!company) throw new NotFoundError('Corporate Account');

        const previousEntries = await db.query.corporateLedger.findMany({
            where: and(eq(corporateLedger.corporateAccountId, companyId), eq(corporateLedger.hotelId, hotelId)),
            orderBy: [desc(corporateLedger.createdAt)],
            limit: 1
        });

        const previousBalance = previousEntries.length > 0 ? parseFloat(previousEntries[0]!.balance) : 0;
        const debit = parseFloat(data.debit || '0');
        const credit = parseFloat(data.credit || '0');
        const newBalance = previousBalance + debit - credit;

        const [entry] = await db.insert(corporateLedger).values({
            hotelId,
            corporateAccountId: companyId,
            entryType: data.entryType,
            referenceId: data.referenceId,
            referenceType: data.referenceType,
            description: data.description,
            debit: debit.toString(),
            credit: credit.toString(),
            balance: newBalance.toString(),
            createdById: userId
        }).returning();

        return entry;
    },

    async getCompanyWithBalance(hotelId: number, companyId: number) {
        const company = await db.query.corporateAccounts.findFirst({
            where: and(eq(corporateAccounts.id, companyId), eq(corporateAccounts.hotelId, hotelId))
        });
        if (!company) throw new NotFoundError('Corporate Account');

        const entries = await db.query.corporateLedger.findMany({
            where: and(eq(corporateLedger.corporateAccountId, companyId), eq(corporateLedger.hotelId, hotelId)),
            orderBy: [desc(corporateLedger.createdAt)],
            limit: 1
        });

        const balance = entries.length > 0 ? parseFloat(entries[0]!.balance) : 0;
        return { ...company, balance };
    },

    /** Check corporate credit limit — returns warning when exceeded (does not block by default). */
    async checkCreditLimit(hotelId: number, companyId: number, additionalAmount: number): Promise<CreditCheckResult> {
        const company = await this.getCompanyWithBalance(hotelId, companyId);
        const limit = parseFloat(company.creditLimit || '0');
        const balance = company.balance || 0;
        return evaluateCreditLimit(balance, limit, additionalAmount, company.companyName);
    },

    /** Hard block when credit limit would be exceeded (use at checkout if desired). */
    async assertCreditAvailable(hotelId: number, companyId: number, additionalAmount: number) {
        const check = await this.checkCreditLimit(hotelId, companyId, additionalAmount);
        if (!check.ok && check.limit > 0) {
            throw new BusinessLogicError(check.warning || 'Corporate credit limit exceeded');
        }
        return check;
    },
};
