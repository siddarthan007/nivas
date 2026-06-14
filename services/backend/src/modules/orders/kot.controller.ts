import { Elysia, t } from 'elysia';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { PERMISSIONS } from '../../config/permissions';
import { KotPrintService } from './kot-print.service';
import { createResponse } from '../../utils/response.helper';
import { ValidationError, NotFoundError } from '../../utils/errors';
import { db } from '../../db';
import { kotPrinters, orders, restaurantTables, rooms } from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export const kotController = new Elysia({ prefix: '/orders/kot' })
    .use(authMiddleware)
    // List all printers for the hotel (management view).
    .get('/printers', async ({ user }) => {
        const list = await db.query.kotPrinters.findMany({
            where: eq(kotPrinters.hotelId, user!.hotelId!),
            orderBy: (p, { desc }) => [desc(p.isDefault), desc(p.createdAt)],
        });
        return createResponse(list, 'Printers fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        detail: { summary: 'List KOT printers', tags: ['KOT'] }
    })
    // Create a printer.
    .post('/printers', async ({ user, body }) => {
        // Only one default printer per hotel.
        if (body.isDefault) {
            await db.update(kotPrinters)
                .set({ isDefault: false })
                .where(eq(kotPrinters.hotelId, user!.hotelId!));
        }
        const [printer] = await db.insert(kotPrinters).values({
            hotelId: user!.hotelId!,
            name: body.name,
            printerType: body.printerType || 'THERMAL',
            ipAddress: body.ipAddress,
            port: body.port ?? 9100,
            station: body.station,
            categories: body.categories ?? [],
            isDefault: body.isDefault ?? false,
            isActive: body.isActive ?? true,
        }).returning();
        return createResponse(printer, 'Printer added');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        body: t.Object({
            name: t.String(),
            printerType: t.Optional(t.String()),
            ipAddress: t.Optional(t.String()),
            port: t.Optional(t.Number()),
            station: t.Optional(t.String()),
            categories: t.Optional(t.Array(t.String())),
            isDefault: t.Optional(t.Boolean()),
            isActive: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Create KOT printer', tags: ['KOT'] }
    })
    // Update a printer.
    .patch('/printers/:id', async ({ params, user, body }) => {
        const id = parseInt(params.id);
        if (body.isDefault) {
            await db.update(kotPrinters)
                .set({ isDefault: false })
                .where(eq(kotPrinters.hotelId, user!.hotelId!));
        }
        const updates: Record<string, unknown> = {};
        for (const k of ['name', 'printerType', 'ipAddress', 'port', 'station', 'categories', 'isDefault', 'isActive'] as const) {
            if (body[k] !== undefined) updates[k] = body[k];
        }
        const [printer] = await db.update(kotPrinters)
            .set(updates)
            .where(and(eq(kotPrinters.id, id), eq(kotPrinters.hotelId, user!.hotelId!)))
            .returning();
        if (!printer) throw new NotFoundError('Printer');
        return createResponse(printer, 'Printer updated');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        body: t.Object({
            name: t.Optional(t.String()),
            printerType: t.Optional(t.String()),
            ipAddress: t.Optional(t.String()),
            port: t.Optional(t.Number()),
            station: t.Optional(t.String()),
            categories: t.Optional(t.Array(t.String())),
            isDefault: t.Optional(t.Boolean()),
            isActive: t.Optional(t.Boolean()),
        }),
        detail: { summary: 'Update KOT printer', tags: ['KOT'] }
    })
    .delete('/printers/:id', async ({ params, user }) => {
        await db.delete(kotPrinters)
            .where(and(
                eq(kotPrinters.id, parseInt(params.id)),
                eq(kotPrinters.hotelId, user!.hotelId!)
            ));
        return createResponse(null, 'Printer deleted');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
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
                },
                room: true,
            }
        });

        if (!order) throw new NotFoundError('Order');

        // Fallback lookups if Drizzle relations didn't populate
        let roomNumber = (order as any).room?.number || '';
        if (!roomNumber && order.roomId) {
            const roomRow = await db.query.rooms.findFirst({
                where: eq(rooms.id, order.roomId),
                columns: { number: true }
            });
            if (roomRow) roomNumber = String(roomRow.number);
        }

        const table = (order as any).restaurantTableId
            ? await db.query.restaurantTables.findFirst({ where: eq(restaurantTables.id, (order as any).restaurantTableId), columns: { tableNumber: true } })
            : null;

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
                receiptNumber: order.orderNumber,
                orderNumber: order.orderNumber,
                orderType: order.orderType,
                table: table?.tableNumber || 'N/A',
                room: roomNumber || 'N/A',
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                date: new Date().toLocaleDateString('en-US'),
                items: r.items.map((item, idx) => ({
                    sn: idx + 1,
                    name: item.name,
                    qty: item.quantity,
                    notes: item.notes || ''
                })),
                footer: `--- END OF KOT ---`,
                station: r.printer.station || r.printer.name
            },
            itemCount: r.items.length
        }));

        return createResponse({
            orderNumber: order.orderNumber,
            orderType: order.orderType,
            createdAt: order.createdAt,
            totalItems: (order.items || []).length,
            printerCount: kotData.length,
            routing: kotData
        }, 'KOT routing fetched');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.READ,
        params: t.Object({ orderId: t.String() }),
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
        if (!printer.ipAddress) throw new ValidationError('This printer has no IP address configured');

        // Actually connect + print a test ticket (was previously a no-op fake).
        await KotPrintService.testPrint(printer.ipAddress, printer.port || 9100, printer.name);

        return createResponse({
            printer: printer.name,
            ipAddress: printer.ipAddress,
            port: printer.port,
            testResult: 'PRINTED',
        }, 'Test ticket sent — check the printer');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.SYSTEM.MANAGE_SETTINGS,
        params: t.Object({ id: t.String() }),
        detail: { summary: 'Test printer connection', tags: ['KOT'] }
    })
    .post('/print/:orderId', async ({ params, user }) => {
        if (!user?.hotelId) throw new ValidationError('Hotel ID is required');
        const results = await KotPrintService.printOrderKots(user.hotelId, params.orderId);
        const allOk = results.every(r => r.status === 'PRINTED');
        return createResponse(results, allOk ? 'KOT printed successfully' : 'Some printers failed');
    }, {
        isSignedIn: true,
        hasPermission: PERMISSIONS.ORDERS.CREATE,
        params: t.Object({ orderId: t.String() }),
        detail: { summary: 'Print KOT tickets for an order', tags: ['KOT'] }
    });
