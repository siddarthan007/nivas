import { db } from '../../db';
import { kotPrinters, orders, rooms, restaurantTables } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { NotFoundError, BusinessLogicError } from '../../utils/errors';
import { ThermalPrinter, PrinterTypes, CharacterSet } from 'node-thermal-printer';

/**
 * KOT (Kitchen Order Ticket) printing over the network using the ESC/POS standard.
 * Interfacing (TCP socket, ESC/POS encoding, cut, character sets, connection
 * checks) is handled by `node-thermal-printer` so we don't hand-roll byte codes.
 * Standard 80mm thermal-POS layout. All printer failures are returned as a status
 * (never thrown out of the loop) so one offline printer can't break an order.
 */

export interface KotPrintPayload {
    orderNumber: string;
    receiptNumber: string;
    orderType: string;
    table?: string;
    room?: string;
    station: string;
    items: { name: string; quantity: number; notes?: string }[];
    notes?: string;
    printerName: string;
}

const PRINT_TIMEOUT_MS = 5000;

export const KotPrintService = {
    /** Build + send one KOT to a network ESC/POS printer. Throws on failure. */
    async printToNetworkPrinter(ipAddress: string, port: number, payload: KotPrintPayload): Promise<void> {
        if (!ipAddress) throw new BusinessLogicError('Printer has no IP address');

        const printer = new ThermalPrinter({
            type: PrinterTypes.EPSON,                 // ESC/POS (covers Epson + most clones)
            interface: `tcp://${ipAddress}:${port || 9100}`,
            characterSet: CharacterSet.PC437_USA,
            removeSpecialCharacters: false,
            width: 48,                                // 80mm @ Font A
            options: { timeout: PRINT_TIMEOUT_MS },
        });

        // Pre-flight: fail fast + clearly if the printer is offline/unreachable
        // (avoids a long hang and surfaces a useful status to the caller).
        const connected = await printer.isPrinterConnected().catch(() => false);
        if (!connected) throw new BusinessLogicError(`Printer not reachable at ${ipAddress}:${port || 9100}`);

        const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        // --- Header: station name, big + bold, centered ---
        printer.alignCenter();
        printer.bold(true);
        printer.setTextDoubleHeight();
        printer.setTextDoubleWidth();
        printer.println((payload.station || 'KITCHEN').toUpperCase());
        printer.setTextNormal();
        printer.bold(false);
        printer.println('Kitchen Order Ticket');
        printer.drawLine();

        // --- Order meta: receipt # + order # + time; always show room/table for context ---
        printer.alignLeft();
        printer.bold(true);
        printer.leftRight(`Receipt: ${payload.receiptNumber}`, time);
        printer.bold(false);
        printer.println(`Order #: ${payload.orderNumber}`);
        printer.println(`Table: ${payload.table || 'N/A'}  |  Room: ${payload.room || 'N/A'}`);
        // Order type only when it's not a plain dine-in (kitchen already assumes dine-in).
        if (payload.orderType && payload.orderType !== 'DINE_IN') {
            printer.bold(true);
            printer.println(payload.orderType.replace(/_/g, ' '));
            printer.bold(false);
        }
        printer.drawLine();

        // --- Items: large + bold qty×name for kitchen legibility, notes indented ---
        for (const item of payload.items) {
            printer.setTextDoubleHeight();
            printer.bold(true);
            printer.println(`${item.quantity} x ${item.name}`);
            printer.setTextNormal();
            printer.bold(false);
            if (item.notes) printer.println(`   >> ${item.notes}`);
        }

        // --- Order-level note only if present (no empty sections) ---
        if (payload.notes) {
            printer.drawLine();
            printer.bold(true);
            printer.println(`NOTE: ${payload.notes}`);
            printer.bold(false);
        }

        // End cleanly with a cut — no decorative footer (saves paper).
        printer.cut();

        try {
            await printer.execute();
        } catch (err: any) {
            throw new BusinessLogicError(`Print failed: ${err?.message || 'printer error'}`);
        }
    },

    /** Print a short test ticket — used by the "Test print" button. Throws on failure. */
    async testPrint(ipAddress: string, port: number, printerName: string): Promise<void> {
        await this.printToNetworkPrinter(ipAddress, port, {
            orderNumber: 'TEST',
            receiptNumber: 'TEST',
            orderType: 'DINE_IN',
            station: printerName || 'Test Printer',
            items: [{ name: 'Test item — printer OK', quantity: 1 }],
            notes: 'If you can read this, printing works.',
            printerName: printerName || 'Test',
        });
    },

    async printOrderKots(hotelId: number, orderId: string): Promise<{ printer: string; status: string; error?: string }[]> {
        const order = await db.query.orders.findFirst({
            where: and(eq(orders.id, orderId), eq(orders.hotelId, hotelId)),
            with: {
                items: { with: { menuItem: true } },
                room: true,
                restaurantTable: true,
            }
        });

        if (!order) throw new NotFoundError('Order');

        // Fallback: direct lookups if Drizzle relations didn't populate
        let roomNumber = (order as any).room?.number?.toString() || '';
        let tableNumber = (order as any).restaurantTable?.tableNumber || '';

        if (!roomNumber && order.roomId) {
            const roomRow = await db.query.rooms.findFirst({
                where: eq(rooms.id, order.roomId),
                columns: { number: true }
            });
            if (roomRow) roomNumber = String(roomRow.number);
        }
        if (!tableNumber && order.restaurantTableId) {
            const tableRow = await db.query.restaurantTables.findFirst({
                where: eq(restaurantTables.id, order.restaurantTableId),
                columns: { tableNumber: true }
            });
            if (tableRow) tableNumber = tableRow.tableNumber;
        }

        const printers = await db.query.kotPrinters.findMany({
            where: and(eq(kotPrinters.hotelId, hotelId), eq(kotPrinters.isActive, true))
        });

        if (printers.length === 0) {
            throw new BusinessLogicError('No active KOT printers configured');
        }

        const defaultPrinter = printers.find(p => p.isDefault);

        // Group items by printer (category routing → default → first).
        const routing = new Map<number, { printer: typeof printers[0]; items: { name: string; quantity: number; notes?: string }[] }>();

        for (const item of (order.items || [])) {
            const category = (item.menuItem as any)?.category || 'OTHER';
            let targetPrinter = printers.find(p => p.categories && (p.categories as string[]).includes(category));
            if (!targetPrinter) targetPrinter = defaultPrinter;
            if (!targetPrinter && printers.length > 0) targetPrinter = printers[0];

            if (targetPrinter) {
                if (!routing.has(targetPrinter.id)) {
                    routing.set(targetPrinter.id, { printer: targetPrinter, items: [] });
                }
                routing.get(targetPrinter.id)!.items.push({
                    name: (item.menuItem as any)?.name || 'Unknown Item',
                    quantity: item.quantity,
                    notes: item.notes || undefined
                });
            }
        }

        const results: { printer: string; status: string; error?: string }[] = [];

        for (const route of routing.values()) {
            if (route.items.length === 0) continue;
            const payload: KotPrintPayload = {
                orderNumber: order.orderNumber,
                receiptNumber: order.orderNumber,
                orderType: order.orderType || 'DINE_IN',
                table: tableNumber || 'N/A',
                room: roomNumber || 'N/A',
                station: route.printer.station || route.printer.name,
                items: route.items,
                notes: (order as any).notes || undefined,
                printerName: route.printer.name
            };

            try {
                if (route.printer.ipAddress) {
                    await this.printToNetworkPrinter(route.printer.ipAddress, route.printer.port || 9100, payload);
                    results.push({ printer: route.printer.name, status: 'PRINTED' });
                } else {
                    results.push({ printer: route.printer.name, status: 'SKIPPED', error: 'No IP address configured' });
                }
            } catch (err: any) {
                results.push({ printer: route.printer.name, status: 'FAILED', error: err?.message || 'Unknown error' });
            }
        }

        return results;
    }
};
