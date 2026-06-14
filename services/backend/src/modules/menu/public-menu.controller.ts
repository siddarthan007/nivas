import { Elysia, t } from 'elysia';
import { db } from '../../db';
import { hotels, menuItems, invoices, folioCharges } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { createResponse } from '../../utils/response.helper';
import { cache } from '../../shared/redis';

/**
 * Public, unauthenticated digital menu — served by hotel slug for QR/link access.
 * Returns only safe, customer-facing fields (no prices tampering surface, no
 * internal flags). Read-only.
 */
export const publicMenuController = new Elysia({ prefix: '/public' })
    .get('/:slug/menu', async ({ params, set }) => {
        // High-traffic public endpoint — cache 60s (menu changes rarely; a brief
        // staleness window is fine, and the short TTL self-heals without explicit
        // invalidation). No-ops to a direct DB read if Redis is absent.
        const cached = await cache.getJSON<any>(`pubmenu:${params.slug}`);
        if (cached) return createResponse(cached, 'Menu fetched');

        const hotel = await db.query.hotels.findFirst({
            where: eq(hotels.slug, params.slug),
            columns: { id: true, name: true, logoUrl: true, primaryColor: true, secondaryColor: true, currency: true, invoiceConfig: true },
        });
        if (!hotel) {
            set.status = 404;
            return createResponse(null, 'Hotel not found');
        }

        const items = await db.query.menuItems.findMany({
            where: and(eq(menuItems.hotelId, hotel.id), eq(menuItems.isAvailable, true)),
            columns: { id: true, name: true, description: true, price: true, category: true, imageUrl: true },
            orderBy: (m, { asc }) => [asc(m.category), asc(m.name)],
        });

        // Group by category for easy rendering.
        const byCategory: Record<string, typeof items> = {};
        for (const it of items) {
            const cat = it.category || 'Other';
            (byCategory[cat] ||= []).push(it);
        }
        const categories = Object.keys(byCategory).sort().map(name => ({ name, items: byCategory[name] }));

        const menuConfig = ((hotel.invoiceConfig as Record<string, unknown>)?.digitalMenu || {}) as Record<string, unknown>;

        const num = (key: string, fallback: number) => {
            const v = menuConfig[key];
            return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
        };
        const str = (key: string, fallback: string) => {
            const v = menuConfig[key];
            return typeof v === 'string' ? v : fallback;
        };
        const optStr = (key: string) => {
            const v = menuConfig[key];
            return typeof v === 'string' ? v : undefined;
        };

        const payload = {
            hotel: {
                name: hotel.name,
                logoUrl: hotel.logoUrl,
                primaryColor: hotel.primaryColor,
                secondaryColor: hotel.secondaryColor,
                currency: hotel.currency || 'NPR',
                subtitle: str('subtitle', 'Digital Menu'),
                footerText: str('footerText', 'Powered by Nivas PMS'),
                showFooter: menuConfig.showFooter !== false,
                pageBackground: str('pageBackground', (hotel.secondaryColor as string) || '#f7f7f8'),
                cardBackground: str('cardBackground', '#ffffff'),
                headerTitleColor: str('headerTitleColor', '#ffffff'),
                headerSubtitleColor: str('headerSubtitleColor', '#ffffff'),
                categoryTitleColor: optStr('categoryTitleColor'),
                itemNameColor: str('itemNameColor', '#1a1a1a'),
                itemDescriptionColor: str('itemDescriptionColor', '#777777'),
                priceColor: optStr('priceColor'),
                footerTextColor: str('footerTextColor', '#aaaaaa'),
                headerTitleSize: num('headerTitleSize', 22),
                headerSubtitleSize: num('headerSubtitleSize', 13),
                categoryTitleSize: num('categoryTitleSize', 16),
                itemNameSize: num('itemNameSize', 15),
                itemDescriptionSize: num('itemDescriptionSize', 13),
                priceSize: num('priceSize', 15),
                footerSize: num('footerSize', 12),
            },
            categories,
            itemCount: items.length,
        };
        await cache.setJSON(`pubmenu:${params.slug}`, payload, 60);
        return createResponse(payload, 'Menu fetched');
    }, {
        params: t.Object({ slug: t.String() }),
        detail: { summary: 'Public digital menu by hotel slug', tags: ['Public'] },
    })

    /**
     * Public invoice view — the invoice id (a UUID) IS the unguessable token, so
     * the guest can open their bill from an SMS/email link without logging in.
     * Returns only safe, customer-facing fields.
     */
    .get('/invoice/:id', async ({ params, set }) => {
        const invoice = await db.query.invoices.findFirst({
            where: eq(invoices.id, params.id),
            with: { hotel: { columns: { name: true, logoUrl: true, address: true, phone: true, email: true, website: true, panNumber: true, vatNumber: true, primaryColor: true, currency: true, invoiceTerms: true } } },
        });
        if (!invoice) { set.status = 404; return createResponse(null, 'Invoice not found'); }

        const charges = await db.query.folioCharges.findMany({
            where: eq(folioCharges.invoiceId, invoice.id),
            columns: { description: true, amount: true, type: true, date: true },
        });
        const hotel = (invoice as any).hotel;

        return createResponse({
            hotel,
            invoice: {
                invoiceNumber: invoice.invoiceNumber,
                fiscalYear: invoice.fiscalYear,
                date: invoice.createdAt,
                guestName: invoice.guestName,
                guestPan: invoice.guestPan,
                paymentStatus: invoice.paymentStatus,
                currency: hotel?.currency || 'NPR',
            },
            lineItems: charges,
            terms: hotel?.invoiceTerms || '',
            totals: {
                subTotal: parseFloat(invoice.subTotal || '0'),
                serviceCharge: parseFloat(invoice.serviceCharge || '0'),
                vat: parseFloat(invoice.vatAmount || '0'),
                discount: parseFloat(invoice.discountAmount || '0'),
                grandTotal: parseFloat(invoice.grandTotal || '0'),
            },
        }, 'Invoice');
    }, {
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Public invoice view by id (token)', tags: ['Public'] },
    });
