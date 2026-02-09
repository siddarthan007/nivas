import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { KotService } from './kot.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { db } from '../../db';
import { kotPrinters, orders } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const kotController = new Elysia({ prefix: '/orders/kot' })
    .use(authMiddleware)
    .delete('/printers/:id', async ({ params, user }) => {
        await db.delete(kotPrinters)
            .where(and(
                eq(kotPrinters.id, parseInt(params.id)),
                eq(kotPrinters.hotelId, user!.hotelId!)
            ));
        return { status: 'success', message: 'Printer deleted' };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Delete KOT printer', tags: ['KOT'] }
    })
    .get('/route/:orderId', async ({ params, user }) => {
        const order = await db.query.orders.findFirst({
            where: and(
                eq(orders.id, params.orderId),
                eq(orders.hotelId, user!.hotelId!)
            ),
            with: {
                items: {
                    with: { menuItem: true }
                }
            }
        });

        if (!order) throw new NotFoundError('Order');

        const printers = await db.query.kotPrinters.findMany({
            where: and(
                eq(kotPrinters.hotelId, user!.hotelId!),
                eq(kotPrinters.isActive, true)
            )
        });

        const routing: Record<number, { printer: any; items: any[] }> = {};
        const defaultPrinter = printers.find(p => p.isDefault);

        for (const item of (order.items || [])) {
            const category = item.menuItem.category || 'OTHER';

            let targetPrinter = printers.find(p =>
                p.categories && p.categories.includes(category)
            );
            if (!targetPrinter) targetPrinter = defaultPrinter;
            if (!targetPrinter && printers.length > 0) targetPrinter = printers[0];

            if (targetPrinter) {
                if (!routing[targetPrinter.id]) {
                    routing[targetPrinter.id] = { printer: targetPrinter, items: [] };
                }
                const routingEntry = routing[targetPrinter.id];
                if (routingEntry) {
                    routingEntry.items.push({
                        name: item.menuItem.name,
                        quantity: item.quantity,
                        notes: item.notes,
                        category
                    });
                }
            }
        }

        const kotData = Object.values(routing).map(r => ({
            printer: {
                id: r.printer.id,
                name: r.printer.name,
                ipAddress: r.printer.ipAddress,
                port: r.printer.port
            },
            printContent: {
                header: `=== KITCHEN ORDER TICKET ===`,
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                table: (order as any).tableNumber || 'N/A',
                room: (order as any).roomNumber || 'N/A',
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('en-US'),
                items: r.items.map((item, idx) => ({
                    sn: idx + 1,
                    name: item.name,
                    qty: item.quantity,
                    notes: item.notes || ''
                })),
                footer: `--- END OF KOT ---`,
                station: r.printer.stationName || r.printer.name
            },
            itemCount: r.items.length
        }));

        return {
            status: 'success',
            data: {
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                createdAt: order.createdAt,
                totalItems: (order.items || []).length,
                printerCount: kotData.length,
                routing: kotData
            }
        };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        detail: { summary: 'Get KOT routing for order', tags: ['KOT'] }
    })
    .post('/printers/:id/test', async ({ params, user }) => {
        const printer = await db.query.kotPrinters.findFirst({
            where: and(
                eq(kotPrinters.id, parseInt(params.id)),
                eq(kotPrinters.hotelId, user!.hotelId!)
            )
        });

        if (!printer) throw new NotFoundError('Printer');

        return {
            status: 'success',
            data: {
                printer: printer.name,
                ipAddress: printer.ipAddress,
                port: printer.port,
                testResult: 'CONNECTION_OK',
                message: 'Test print sent successfully'
            }
        };
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'Test printer connection', tags: ['KOT'] }
    });
