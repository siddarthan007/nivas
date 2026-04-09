import { db } from '../../db';
import { subscriptionPackages, subscriptionPayments, subscriptions } from '../../db/schema';
import { eq, desc } from 'drizzle-orm';
import { BusinessLogicError, NotFoundError } from '../../utils/errors';
import { LicenseService } from './license.service';
import { PdfService } from '../../utils/pdf.service';
import { SaasAdminService } from './saas-admin.service';

export const SaasBillingService = {
    async getPackages() {
        const packages = await db.query.subscriptionPackages.findMany({
            where: eq(subscriptionPackages.isActive, true),
            orderBy: (pkg, { asc }) => [asc(pkg.monthlyPrice)]
        });

        const featureMap = new Map(SaasAdminService.getAvailableFeatures().map((feature) => [feature.id, feature.label]));

        return packages.map((pkg) => ({
            ...pkg,
            price: Number(pkg.monthlyPrice),
            billingCycle: 'MONTHLY',
            features: ((pkg.features as string[]) || []).map((feature) => featureMap.get(feature) || feature)
        }));
    },

    async getMySubscription(hotelId: number) {
        const hotel = await LicenseService.getHotel(hotelId);
        const subscription = await LicenseService.getSubscription(hotelId);
        const featureMap = new Map(SaasAdminService.getAvailableFeatures().map((feature) => [feature.id, feature.label]));

        const mappedSubscription = subscription ? {
            ...subscription,
            package: subscription.package ? {
                ...subscription.package,
                price: Number(subscription.package.monthlyPrice),
                features: ((subscription.package.features as string[]) || []).map((feature) => featureMap.get(feature) || feature)
            } : null
        } : null;

        const recentPayments = await db.query.subscriptionPayments.findMany({
            where: eq(subscriptionPayments.hotelId, hotelId),
            orderBy: [desc(subscriptionPayments.createdAt)],
            limit: 5
        });

        return {
            hotel: { ...hotel, licenseStatus: hotel.licenseStatus ?? 'TRIAL' },
            subscription: mappedSubscription,
            recentPayments
        };
    },

    async recordPayment(hotelId: number, userId: string, data: any, ipAddress?: string) {
        return LicenseService.recordPayment(
            hotelId,
            userId,
            data.amount,
            data.currency ?? 'USD',
            data.billingCycle ?? 'MONTHLY',
            data.paymentMethod,
            data.transactionId,
            data.packageId,
            ipAddress
        );
    },

    async getTenantPayments(hotelId: number, limit: number, offset: number) {
        return db.query.subscriptionPayments.findMany({
            where: eq(subscriptionPayments.hotelId, hotelId),
            orderBy: [desc(subscriptionPayments.createdAt)],
            limit,
            offset
        });
    },

    async getPayment(paymentId: string) {
        const payment = await db.query.subscriptionPayments.findFirst({
            where: eq(subscriptionPayments.id, paymentId),
            with: { hotel: { columns: { id: true, name: true, slug: true } } }
        });

        if (!payment) throw new NotFoundError('Payment');
        return payment;
    },

    async getAllPayments(limit: number, offset: number) {
        return db.query.subscriptionPayments.findMany({
            orderBy: [desc(subscriptionPayments.createdAt)],
            limit,
            offset,
            with: { hotel: { columns: { id: true, name: true } } }
        });
    },

    async getBillingStats() {
        const payments = await db.query.subscriptionPayments.findMany();
        const activeSubscription = await db.query.subscriptions.findFirst({
            where: eq(subscriptions.status, 'ACTIVE'),
            with: { package: true }
        });

        const totalPaid = payments.reduce((sum, payment) => {
            return payment.status === 'PAID' || payment.status === 'COMPLETED'
                ? sum + Number(payment.amount ?? 0)
                : sum;
        }, 0);

        const pendingAmount = payments.reduce((sum, payment) => {
            return payment.status === 'PENDING' || payment.status === 'OVERDUE'
                ? sum + Number(payment.amount ?? 0)
                : sum;
        }, 0);

        return {
            currentPlan: activeSubscription?.package?.name || 'No active plan',
            nextBillingDate: activeSubscription?.currentPeriodEnd?.toISOString() || '',
            totalPaid,
            pendingAmount
        };
    },

    async subscribe(hotelId: number, userId: string, packageId: number, billingCycle: 'MONTHLY' | 'ANNUAL' | '2_YEAR' | '3_YEAR', ip?: string) {
        const pkg = await db.query.subscriptionPackages.findFirst({
            where: eq(subscriptionPackages.id, packageId)
        });
        if (!pkg) throw new NotFoundError('Subscription Package');

        let amount = Number(pkg.monthlyPrice);
        if (billingCycle === 'ANNUAL') {
            amount = pkg.annualPrice ? Number(pkg.annualPrice) : Number(pkg.monthlyPrice) * 12 * 0.9;
        } else if (billingCycle === '2_YEAR') {
            amount = (pkg.annualPrice ? Number(pkg.annualPrice) : Number(pkg.monthlyPrice) * 12) * 2 * 0.85;
        } else if (billingCycle === '3_YEAR') {
            amount = (pkg.annualPrice ? Number(pkg.annualPrice) : Number(pkg.monthlyPrice) * 12) * 3 * 0.8;
        }

        let subscription = await LicenseService.getSubscription(hotelId);
        if (!subscription) {
            const trialEndsAt = new Date();
            trialEndsAt.setDate(trialEndsAt.getDate() + (pkg.trialDays ?? 14));
            await LicenseService.ensureSubscription(hotelId, packageId, 'TRIAL', trialEndsAt);
            subscription = await LicenseService.getSubscription(hotelId);
        }

        if (!subscription) {
            throw new BusinessLogicError('Subscription record not found. Please contact support.');
        }

        const [payment] = await db.insert(subscriptionPayments).values({
            hotelId,
            subscriptionId: subscription.id,
            amount: amount.toString(),
            currency: 'NPR',
            status: 'PENDING',
            notes: `Subscription to ${pkg.name} (${billingCycle})`,
            recordedById: userId
        }).returning();

        if (!payment) {
            throw new BusinessLogicError('Failed to create subscription payment request.');
        }

        return {
            paymentId: payment.id,
            amount,
            currency: 'NPR',
            package: pkg.name,
            billingCycle
        };
    },

    async generateInvoicePdf(paymentId: string) {
        const payment = await this.getPayment(paymentId);
        const hotel = await LicenseService.getHotel(payment.hotelId);

        const data = {
            hotelName: hotel.name,
            address: hotel.address || 'N/A',
            panNumber: hotel.panNumber || 'N/A',
            invoiceNumber: payment.invoiceNumber || `INV-${payment.id.slice(0, 8).toUpperCase()}`,
            date: payment.createdAt ? payment.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            paymentMethod: payment.paymentMethod || 'PENDING',
            description: 'Subscription Payment',
            amount: Number(payment.amount)
        };

        const docDefinition = PdfService.generateSaasInvoiceDefinition(data);
        return PdfService.generatePdf(docDefinition);
    }
};