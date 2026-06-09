import { db } from '../../db';
import { hotels, menuItems } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { AiService } from '../../shared/ai.service';

type ProposedAction =
    | { type: 'ORDER'; items: { menuItemId: number; name: string; price: number; quantity: number; lineTotal: number }[]; total: number; currency: string }
    | { type: 'HOUSEKEEPING'; taskType: 'CLEANING' | 'TOWELS' | 'AMENITIES' | 'MAINTENANCE' };

const HK_TYPES = ['CLEANING', 'TOWELS', 'AMENITIES', 'MAINTENANCE'];

/**
 * In-room AI concierge. The model NEVER executes anything — it only PROPOSES a
 * structured action inside [[ACTION]]...[[/ACTION]]. The server then validates
 * every item against the REAL menu (rejecting anything invented, using real
 * prices), and the guest must tap Confirm in the UI, which calls the existing
 * validated /guest/actions endpoints. Defense in depth: model → server validate
 * → human confirm → scoped endpoint. Chats are NOT stored.
 */
export const AiConciergeService = {
    async chat(hotelId: number, message: string, history: { role: string; content: string }[] = []): Promise<{ reply: string; action: ProposedAction | null; aiUsed: boolean }> {
        if (!(await AiService.isEnabled(hotelId))) {
            return { reply: 'The AI concierge is not available right now. You can still order, request housekeeping or view your bill from the menu below.', action: null, aiUsed: false };
        }
        await AiService.guardUsage(hotelId);

        const [hotel, menu] = await Promise.all([
            db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { name: true, currency: true, checkInTime: true, checkOutTime: true, phone: true } }),
            db.query.menuItems.findMany({
                where: and(eq(menuItems.hotelId, hotelId), eq(menuItems.isAvailable, true)),
                columns: { id: true, name: true, price: true, category: true },
                limit: 80,
            }),
        ]);
        const cur = hotel?.currency || 'NPR';
        const menuList = menu.map(m => `${m.name} (${m.category || 'food'}) — ${cur} ${m.price}`).join('\n');

        const system = [
            `You are the in-room concierge for "${hotel?.name || 'the hotel'}". Reply in the guest's language (Nepali or English).`,
            'Format every reply in clean Markdown (use **bold**, bullet lists, short paragraphs). Be warm and concise.',
            'You may recommend menu items, answer hotel FAQs, and help order room service or request housekeeping.',
            '',
            'ACTIONS — you do NOT execute anything. When the guest clearly wants to order food, append EXACTLY ONE line at the very end:',
            '[[ACTION]]{"type":"ORDER","items":[{"name":"<exact menu name>","quantity":<int>}]}[[/ACTION]]',
            'For housekeeping/cleaning/towels/amenities/maintenance requests append:',
            '[[ACTION]]{"type":"HOUSEKEEPING","taskType":"CLEANING|TOWELS|AMENITIES|MAINTENANCE"}[[/ACTION]]',
            'Rules for ACTION: use ONLY exact item names from the menu below; never invent items; never include prices; only emit an ACTION when the guest clearly asked to order/request — otherwise no ACTION line. Never say the order is "placed"; say you have prepared it and the guest can confirm.',
            '',
            `Hotel: check-in ${hotel?.checkInTime || '14:00'}, check-out ${hotel?.checkOutTime || '11:00'}, front desk ${hotel?.phone || 'reception'}.`,
            `MENU:\n${menuList || '(no items)'}`,
        ].join('\n');

        const trimmed = history.slice(-6).map(h => `${h.role === 'assistant' ? 'Concierge' : 'Guest'}: ${h.content}`).join('\n');
        const raw = await AiService.generate(hotelId, system, `${trimmed ? trimmed + '\n' : ''}Guest: ${message}`, 450);
        if (!raw) return { reply: 'Sorry, I could not respond just now. Please use the menu buttons or contact the front desk.', action: null, aiUsed: false };

        // Extract + strip the proposed action; validate it against real data.
        const { reply, actionJson } = this.splitAction(raw);
        const action = actionJson ? this.validateAction(actionJson, menu as any, cur) : null;
        return { reply: reply || 'Here you go.', action, aiUsed: true };
    },

    splitAction(text: string): { reply: string; actionJson: any | null } {
        const m = text.match(/\[\[ACTION\]\]([\s\S]*?)\[\[\/ACTION\]\]/);
        if (!m) return { reply: text.trim(), actionJson: null };
        const reply = text.replace(m[0], '').trim();
        let actionJson: any = null;
        try { actionJson = JSON.parse((m[1] || '').trim()); } catch { actionJson = null; }
        return { reply, actionJson };
    },

    /** Validate the model's proposal against the REAL menu — invented items/prices are dropped. */
    validateAction(a: any, menu: { id: number; name: string; price: string }[], currency: string): ProposedAction | null {
        if (!a || typeof a !== 'object') return null;

        if (a.type === 'HOUSEKEEPING') {
            const t = String(a.taskType || '').toUpperCase();
            return HK_TYPES.includes(t) ? { type: 'HOUSEKEEPING', taskType: t as any } : null;
        }

        if (a.type === 'ORDER' && Array.isArray(a.items)) {
            const items: any[] = [];
            for (const it of a.items.slice(0, 20)) {
                const wanted = String(it?.name || '').trim().toLowerCase();
                const qty = Math.max(1, Math.min(20, Math.floor(Number(it?.quantity) || 1)));
                if (!wanted) continue;
                // Exact match first, then a safe contains match.
                const match = menu.find(m => m.name.toLowerCase() === wanted)
                    || menu.find(m => m.name.toLowerCase().includes(wanted) || wanted.includes(m.name.toLowerCase()));
                if (!match) continue; // invented item → dropped (server price is the source of truth)
                const price = parseFloat(match.price) || 0;
                items.push({ menuItemId: match.id, name: match.name, price, quantity: qty, lineTotal: Math.round(price * qty * 100) / 100 });
            }
            if (items.length === 0) return null;
            const total = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
            return { type: 'ORDER', items, total, currency };
        }
        return null;
    },
};
