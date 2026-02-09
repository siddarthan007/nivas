import { db } from '../../db';
import { corporateAccounts, travelAgents } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError } from '../../utils/errors';

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
    }
};
