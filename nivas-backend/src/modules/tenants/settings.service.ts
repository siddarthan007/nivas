import { db } from '../../db';
import { hotels, tenantFeatures } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logAction } from '../system/audit.service';
import { NotFoundError, ForbiddenError } from '../../utils/errors';

export const SettingsService = {
    async getSettings(hotelId: number) {
        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.id, hotelId)
        });

        if (!hotel) throw new NotFoundError('Hotel');

        return {
            branding: {
                name: hotel.name,
                logoUrl: hotel.logoUrl,
                primaryColor: hotel.primaryColor,
                secondaryColor: hotel.secondaryColor
            },
            contact: {
                address: hotel.address,
                phone: hotel.phone,
                email: hotel.email,
                website: hotel.website
            },
            tax: {
                panNumber: hotel.panNumber,
                vatNumber: hotel.vatNumber,
                serviceChargeRate: parseFloat(hotel.serviceChargeRate ?? '0.10') * 100,
                taxRate: parseFloat(hotel.taxRate ?? '0.13') * 100
            },
            regional: {
                currency: hotel.currency,
                timezone: hotel.timezone,
                dateFormat: hotel.dateFormat,
                fiscalYearStart: hotel.fiscalYearStart,
                checkInTime: hotel.checkInTime || '14:00',
                checkOutTime: hotel.checkOutTime || '11:00',
            },
            invoice: {
                prefix: hotel.invoicePrefix,
                footerText: hotel.invoiceFooterText,
                terms: hotel.invoiceTerms
            }
        };
    },

    async updateBranding(hotelId: number, userId: string, data: any, ip?: string) {
        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.name !== undefined) updatePayload.name = data.name;
        if (data.logoUrl !== undefined) updatePayload.logoUrl = data.logoUrl;
        if (data.primaryColor !== undefined) updatePayload.primaryColor = data.primaryColor;
        if (data.secondaryColor !== undefined) updatePayload.secondaryColor = data.secondaryColor;

        await db.update(hotels)
            .set(updatePayload)
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_BRANDING', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateContact(hotelId: number, userId: string, data: any, ip?: string) {
        await db.update(hotels)
            .set({
                address: data.address,
                phone: data.phone,
                email: data.email,
                website: data.website,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_CONTACT', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateTax(hotelId: number, userId: string, userRole: string, userType: string, data: any, ip?: string) {
        if (!['Owner', 'Manager'].includes(userRole) && userType !== 'SUPER_ADMIN') {
            throw new ForbiddenError('Only Owners or Managers can modify tax settings');
        }

        await db.update(hotels)
            .set({
                panNumber: data.panNumber,
                vatNumber: data.vatNumber,
                serviceChargeRate: data.serviceChargeRate !== undefined
                    ? (data.serviceChargeRate / 100).toFixed(4)
                    : undefined,
                taxRate: data.taxRate !== undefined
                    ? (data.taxRate / 100).toFixed(4)
                    : undefined,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_TAX_SETTINGS', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateInvoice(hotelId: number, userId: string, data: any, ip?: string) {
        await db.update(hotels)
            .set({
                invoicePrefix: data.prefix,
                invoiceFooterText: data.footerText,
                invoiceTerms: data.terms,
                updatedAt: new Date()
            })
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_INVOICE_SETTINGS', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateRegional(hotelId: number, userId: string, data: any, ip?: string) {
        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.currency !== undefined) updatePayload.currency = data.currency;
        if (data.timezone !== undefined) updatePayload.timezone = data.timezone;
        if (data.dateFormat !== undefined) updatePayload.dateFormat = data.dateFormat;
        if (data.fiscalYearStart !== undefined) updatePayload.fiscalYearStart = data.fiscalYearStart;
        if (data.checkInTime !== undefined) updatePayload.checkInTime = data.checkInTime;
        if (data.checkOutTime !== undefined) updatePayload.checkOutTime = data.checkOutTime;

        await db.update(hotels)
            .set(updatePayload)
            .where(eq(hotels.id, hotelId));

        await logAction(hotelId, userId, 'UPDATE_REGIONAL_SETTINGS', 'HOTEL', hotelId.toString(), data, ip);
    },

    async updateFeatures(hotelId: number, userId: string, data: any, ip?: string) {
        // Upsert tenant features
        const existing = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId)
        });

        const updatePayload: Record<string, any> = { updatedAt: new Date() };
        if (data.enableGuestPortal !== undefined) updatePayload.enableGuestPortal = data.enableGuestPortal;
        if (data.enableHousekeeping !== undefined) updatePayload.enableHousekeeping = data.enableHousekeeping;
        if (data.enableInventory !== undefined) updatePayload.enableInventory = data.enableInventory;
        if (data.emailNotifications !== undefined) updatePayload.enableEmailNotifications = data.emailNotifications;
        if (data.smsNotifications !== undefined) updatePayload.enableSmsNotifications = data.smsNotifications;

        if (existing) {
            await db.update(tenantFeatures)
                .set(updatePayload)
                .where(eq(tenantFeatures.hotelId, hotelId));
        } else {
            await db.insert(tenantFeatures).values({
                hotelId,
                ...updatePayload,
            });
        }

        await logAction(hotelId, userId, 'UPDATE_FEATURES', 'HOTEL', hotelId.toString(), data, ip);
    }
};
