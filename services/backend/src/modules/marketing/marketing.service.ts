import { db } from '../../db';
import { marketingTemplates, guests } from '../../db/schema';
import { OutstandingBalanceService } from '../finance/outstanding-balance.service';
import { eq, and } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { NotificationChannelService } from '../notifications/notification-channel.service';
import { logAction } from '../system/audit.service';

type Segment = 'ALL' | 'VIP' | 'HOTEL_GUEST' | 'RESTAURANT_CUSTOMER' | 'OUTSTANDING';

function interpolate(body: string, ctx: Record<string, string>): string {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => ctx[k] ?? '');
}

export const MarketingService = {
    listTemplates(hotelId: number) {
        return db.query.marketingTemplates.findMany({
            where: eq(marketingTemplates.hotelId, hotelId),
            orderBy: (t, { desc }) => [desc(t.createdAt)],
        });
    },

    async createTemplate(hotelId: number, userId: string, data: { name: string; channel: 'SMS' | 'EMAIL'; subject?: string; body: string }) {
        const [tpl] = await db.insert(marketingTemplates).values({
            hotelId, name: data.name, channel: data.channel, subject: data.subject, body: data.body, createdById: userId,
        }).returning();
        return tpl;
    },

    async updateTemplate(hotelId: number, id: number, data: Partial<{ name: string; channel: 'SMS' | 'EMAIL'; subject: string; body: string }>) {
        const [tpl] = await db.update(marketingTemplates)
            .set({ ...data, updatedAt: new Date() })
            .where(and(eq(marketingTemplates.id, id), eq(marketingTemplates.hotelId, hotelId)))
            .returning();
        if (!tpl) throw new NotFoundError('Template');
        return tpl;
    },

    async deleteTemplate(hotelId: number, id: number) {
        const [d] = await db.delete(marketingTemplates)
            .where(and(eq(marketingTemplates.id, id), eq(marketingTemplates.hotelId, hotelId)))
            .returning();
        if (!d) throw new NotFoundError('Template');
        return d;
    },

    /** Count recipients in a segment that have the channel's contact field. */
    async previewSegment(hotelId: number, channel: 'SMS' | 'EMAIL', segment: Segment) {
        const recipients = await this.resolveRecipients(hotelId, channel, segment);
        return { count: recipients.length };
    },

    async resolveRecipients(hotelId: number, channel: 'SMS' | 'EMAIL', segment: Segment) {
        if (segment === 'OUTSTANDING') {
            const outstanding = await OutstandingBalanceService.getOutstandingGuests(hotelId);
            return outstanding
                .filter(g => channel === 'SMS' ? !!g.phone : !!g.email)
                .map(g => ({
                    fullName: g.name,
                    phone: g.phone,
                    email: g.email,
                    customerType: 'HOTEL_GUEST' as const,
                    isVip: false,
                    isBanned: false,
                }));
        }

        const all = await db.query.guests.findMany({
            where: eq(guests.hotelId, hotelId),
            columns: { fullName: true, phone: true, email: true, customerType: true, isVip: true, isBanned: true },
        });
        const matched = all.filter(g => {
            if (g.isBanned) return false;
            if (channel === 'SMS' && !g.phone) return false;
            if (channel === 'EMAIL' && !g.email) return false;
            if (segment === 'VIP') return !!g.isVip;
            if (segment === 'HOTEL_GUEST') return g.customerType === 'HOTEL_GUEST' || g.customerType === 'BOTH';
            if (segment === 'RESTAURANT_CUSTOMER') return g.customerType === 'RESTAURANT_CUSTOMER' || g.customerType === 'BOTH';
            return true; // ALL
        });
        // Dedupe by the contact actually used (duplicate guest records / same
        // person in multiple segments must not get the message twice).
        const seen = new Set<string>();
        return matched.filter(g => {
            const key = (channel === 'SMS' ? g.phone : g.email)?.trim().toLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    },

    /**
     * Send a one-off campaign to a customer segment. Body supports {{name}}.
     * Returns sent/failed counts. Uses the hotel's configured SMS/email channel.
     */
    async sendCampaign(hotelId: number, userId: string, data: {
        channel: 'SMS' | 'EMAIL'; segment: Segment; subject?: string; body?: string; templateId?: number;
    }, ip?: string) {
        let { body, subject } = data;
        if (data.templateId) {
            const tpl = await db.query.marketingTemplates.findFirst({
                where: and(eq(marketingTemplates.id, data.templateId), eq(marketingTemplates.hotelId, hotelId)),
            });
            if (!tpl) throw new NotFoundError('Template');
            body = tpl.body;
            subject = subject || tpl.subject || undefined;
        }
        if (!body || !body.trim()) throw new BusinessLogicError('Message body is required');

        const recipients = await this.resolveRecipients(hotelId, data.channel, data.segment);
        if (recipients.length === 0) throw new BusinessLogicError('No recipients match this segment / channel');

        const bodyTpl = body, subjectTpl = subject, channel = data.channel, segment = data.segment;

        // Send in the BACKGROUND with bounded concurrency so the HTTP request returns
        // immediately — a large campaign must not block the request (would otherwise
        // take minutes and time out). Errors are tallied + logged when done.
        const runCampaign = async () => {
            let sent = 0, failed = 0;
            const CONCURRENCY = 5;
            for (let i = 0; i < recipients.length; i += CONCURRENCY) {
                const batch = recipients.slice(i, i + CONCURRENCY);
                await Promise.all(batch.map(async r => {
                    const msg = interpolate(bodyTpl, { name: r.fullName || "Customer" });
                    try {
                        if (channel === "SMS") await NotificationChannelService.send(hotelId, r.phone!, undefined, msg);
                        else await NotificationChannelService.send(hotelId, "", r.email!, interpolate(subjectTpl || "Update", { name: r.fullName || "" }) + " " + msg);
                        sent++;
                    } catch { failed++; }
                }));
            }
            await logAction(hotelId, userId, "SEND_MARKETING_CAMPAIGN", "MARKETING", undefined, {
                channel, segment, sent, failed, total: recipients.length,
            }, ip).catch(() => { });
        };
        runCampaign().catch(() => { });

        return { total: recipients.length, queued: true };
    },
};
