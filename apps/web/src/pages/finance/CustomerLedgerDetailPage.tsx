'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from '@/lib/router';
import { type Invoice } from '@/lib/hooks/useFinance';
import {
    useFinanceInvoicesQuery,
    useFinancePaymentsQuery,
    useFinanceCreditNotesQuery,
} from '@/lib/queries/useFinanceQuery';
import api from '@/lib/api';
import { format, parseISO } from 'date-fns';
import DualDate from '@/components/ui/DualDate';
import {
    ChevronDown,
    ChevronUp,
    Calendar,
    ArrowLeft,
    FileSpreadsheet,
    Download,
    FileText,
    CreditCard,
    RotateCcw,
    User,
    Building2,
    Hash,
    Mail,
    Phone,
    Banknote,
    Wallet,
    QrCode,
    UtensilsCrossed,
    BedDouble,
    Star,
    MapPin,
    Filter,
    AlertTriangle,
    CheckCircle,
    Receipt
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DatePicker from '@/components/ui/DatePicker';
import Pagination from '@/components/ui/Pagination';

interface LedgerEntry {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
    type: 'invoice' | 'payment' | 'credit_note' | 'charge' | 'order';
    reference: string;
    details?: Record<string, any>;
}

interface CustomerLedger {
    bookingId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    totalDebit: number;
    totalCredit: number;
    balance: number;
    entries: LedgerEntry[];
}

interface LiveFolio {
    booking: any;
    bookings?: any[];
    charges: any[];
    payments: any[];
    orders: any[];
    invoices?: any[];
    summary: {
        folioTotal: number;
        ordersTotal: number;
        totalCharges: number;
        totalPayments: number;
        balance: number;
        stayCount?: number;
        orderCount?: number;
        invoiceTotal?: number;
    };
}

interface InvoiceDetailData {
    invoice: Invoice & { lineItems: { description: string; quantity: number; rate: number; amount: number }[] };
    hotel: any;
    room: { number?: string; type?: string };
    lineItems: { description: string; quantity: number; rate: number; amount: number }[];
    totals: any;
}

const PAYMENT_ICON_MAP: Record<string, React.ReactNode> = {
    CASH: <Banknote size={12} />,
    CARD: <CreditCard size={12} />,
    FONEPAY: <QrCode size={12} />,
    ESEWA: <Wallet size={12} />,
    KHALTI: <Wallet size={12} />,
    CONNECT_IPS: <Wallet size={12} />,
    COMP: <Star size={12} />,
    BANK_TRANSFER: <Building2 size={12} />,
};

function OrderItemsBreakdown({ order }: { order: any }) {
    const items = order?.items || [];
    if (items.length === 0) return <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)' }}>No item details available</div>;

    const subTotal = parseFloat(order.subTotal || '0');
    const serviceCharge = parseFloat(order.serviceChargeAmount || '0');
    const vat = parseFloat(order.vatAmount || '0');
    const discount = parseFloat(order.discountAmount || '0');
    const total = parseFloat(order.totalAmount || '0');

    return (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <UtensilsCrossed size={14} style={{ color: 'var(--notion-pink)' }} />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--notion-text-secondary)' }}>Order Items</span>
                {order.orderType && (
                    <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--notion-blue-bg)', color: 'var(--notion-blue)' }}>
                        {(order.orderType || '').replace(/_/g, ' ')}
                    </span>
                )}
                {order.restaurantTableId && (
                    <span style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>Table #{order.restaurantTableId}</span>
                )}
                {order.paymentStatus && (
                    <span style={{
                        padding: '1px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 600,
                        backgroundColor: order.paymentStatus === 'PAID' ? 'var(--notion-green-bg)' : 'var(--notion-orange-bg)',
                        color: order.paymentStatus === 'PAID' ? 'var(--notion-green)' : 'var(--notion-orange)',
                    }}>
                        {order.paymentStatus}
                    </span>
                )}
            </div>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '8px' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                        <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Item</th>
                        <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500, width: '60px' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500, width: '90px' }}>Rate</th>
                        <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500, width: '90px' }}>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item: any, idx: number) => {
                        const itemName = item.menuItem?.name || item.name || `Item #${item.menuItemId}`;
                        const price = parseFloat(item.price || '0');
                        const lineTotal = price * (item.quantity || 1);
                        return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--notion-border-light)' }}>
                                <td style={{ padding: '5px 0', color: 'var(--notion-text)' }}>
                                    {itemName}
                                    {item.notes && <span style={{ display: 'block', fontSize: '11px', color: 'var(--notion-text-muted)', fontStyle: 'italic' }}>{item.notes}</span>}
                                </td>
                                <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--notion-text)' }}>×{item.quantity}</td>
                                <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>NPR {price.toLocaleString()}</td>
                                <td style={{ padding: '5px 0', textAlign: 'right', color: 'var(--notion-text)', fontWeight: 500 }}>NPR {lineTotal.toLocaleString()}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '12px', paddingTop: '6px', borderTop: '1px solid var(--notion-border)' }}>
                <span style={{ color: 'var(--notion-text-secondary)' }}>Subtotal</span>
                <span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {subTotal.toLocaleString()}</span>
                {serviceCharge > 0 && <><span style={{ color: 'var(--notion-text-secondary)' }}>Service Charge</span><span style={{ textAlign: 'right' }}>NPR {serviceCharge.toLocaleString()}</span></>}
                {vat > 0 && <><span style={{ color: 'var(--notion-text-secondary)' }}>VAT</span><span style={{ textAlign: 'right' }}>NPR {vat.toLocaleString()}</span></>}
                {discount > 0 && <><span style={{ color: 'var(--notion-text-secondary)' }}>Discount</span><span style={{ textAlign: 'right', color: 'var(--notion-green)' }}>-NPR {discount.toLocaleString()}</span></>}
                <span style={{ fontWeight: 700, color: 'var(--notion-text)' }}>Total</span>
                <span style={{ fontWeight: 700, textAlign: 'right' }}>NPR {total.toLocaleString()}</span>
            </div>
        </div>
    );
}

function PaymentDetailBreakdown({ payment }: { payment: any }) {
    const method = payment?.paymentMethod || 'Unknown';
    const icon = PAYMENT_ICON_MAP[method] || <CreditCard size={12} />;
    return (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--notion-green-bg)', color: 'var(--notion-green)' }}>{icon}</span>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Payment Method</div>
                        <div style={{ fontWeight: 600 }}>{method.replace(/_/g, ' ')}</div>
                    </div>
                </div>
                {payment?.recordedBy?.fullName && (
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Recorded By</div>
                        <div style={{ fontWeight: 500 }}>{payment.recordedBy.fullName}</div>
                    </div>
                )}
                {payment?.transactionId && (
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Transaction ID</div>
                        <div style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '11px' }}>{payment.transactionId}</div>
                    </div>
                )}
                {payment?.notes && (
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Notes</div>
                        <div style={{ fontStyle: 'italic' }}>{payment.notes}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ChargeDetailBreakdown({ charge }: { charge: any }) {
    return (
        <div style={{ marginTop: '12px', padding: '12px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', fontSize: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--notion-purple-bg)', color: 'var(--notion-purple)' }}>
                        {charge?.type === 'ROOM_CHARGE' ? <BedDouble size={12} /> : <FileText size={12} />}
                    </span>
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Charge Type</div>
                        <div style={{ fontWeight: 600 }}>{(charge?.type || 'CHARGE').replace(/_/g, ' ')}</div>
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Description</div>
                    <div style={{ fontWeight: 500 }}>{charge?.description || '—'}</div>
                </div>
                {charge?.date && (
                    <div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Date</div>
                        <div style={{ fontWeight: 500 }}>{new Date(charge.date).toLocaleDateString()}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

function AccordionRow({ entry, index, invoices, invoiceDetails, onExpand }: {
    entry: LedgerEntry;
    index: number;
    invoices: Invoice[];
    invoiceDetails: Map<string, InvoiceDetailData>;
    onExpand: (invoiceId: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);

    const typeConfig: Record<string, { label: string, color: string, bg: string }> = {
        invoice: { label: 'Invoice', color: 'var(--notion-blue)', bg: 'var(--notion-blue-bg)' },
        payment: { label: 'Payment', color: 'var(--notion-green)', bg: 'var(--notion-green-bg)' },
        credit_note: { label: 'Credit Note', color: 'var(--notion-orange)', bg: 'var(--notion-orange-bg)' },
        charge: { label: 'Folio Charge', color: 'var(--notion-purple)', bg: 'var(--notion-purple-bg)' },
        order: { label: 'POS Order', color: 'var(--notion-pink)', bg: 'var(--notion-pink-bg)' },
    };
    const cfg = typeConfig[entry.type] || { label: 'Record', color: 'var(--notion-text)', bg: 'var(--notion-bg-secondary)' };

    return (
        <div style={{ borderBottom: '1px solid var(--notion-border)' }}>
            <button
                onClick={() => setExpanded(!expanded)}
                style={{
                    width: '100%',
                    display: 'grid',
                    gridTemplateColumns: '48px 120px 1fr 100px 100px 100px 40px',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    background: expanded ? 'var(--notion-bg-secondary)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '13px',
                    color: 'var(--notion-text)',
                    transition: 'background 0.15s',
                }}
            >
                <span style={{ fontWeight: 600, color: 'var(--notion-text-secondary)' }}>{String(index + 1).padStart(2, '0')}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--notion-text-secondary)' }}>
                    <Calendar size={12} />
                    <DualDate date={entry.date} format="compact" />
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: cfg.bg,
                        color: cfg.color,
                        fontSize: '11px',
                        fontWeight: 600,
                        flexShrink: 0,
                    }}>
                        {cfg.label}
                    </span>
                    <span style={{ color: 'var(--notion-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.description}</span>
                </span>
                <span style={{ textAlign: 'right', color: entry.debit ? 'var(--notion-red)' : 'var(--notion-text-secondary)' }}>
                    {entry.debit ? `NPR ${entry.debit.toLocaleString()}` : '-'}
                </span>
                <span style={{ textAlign: 'right', color: entry.credit ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                    {entry.credit ? `NPR ${entry.credit.toLocaleString()}` : '-'}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 600, color: entry.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                    NPR {Math.abs(entry.balance).toLocaleString()}
                </span>
                <span style={{ textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
            </button>

            {expanded && (
                <div style={{
                    padding: '16px 24px 16px 72px',
                    backgroundColor: 'var(--notion-bg-secondary)',
                    borderTop: '1px solid var(--notion-border)',
                    fontSize: '13px',
                }}>
                    {/* Order type: show full item breakdown */}
                    {entry.type === 'order' && entry.details?.order && (
                        <OrderItemsBreakdown order={entry.details.order} />
                    )}
                    {/* Payment type: show method + staff + reference */}
                    {entry.type === 'payment' && entry.details?.payment && (
                        <PaymentDetailBreakdown payment={entry.details.payment} />
                    )}
                    {/* Charge type: show charge category + description */}
                    {entry.type === 'charge' && entry.details?.charge && (
                        <ChargeDetailBreakdown charge={entry.details.charge} />
                    )}
                    {/* Invoice type: existing invoice breakdown */}
                    {entry.type === 'invoice' && (
                        <InvoiceBreakdown entry={entry} invoices={invoices} invoiceDetails={invoiceDetails} onExpand={onExpand} />
                    )}
                    {/* Fallback generic detail for types without specific breakdown */}
                    {!['order', 'payment', 'charge', 'invoice'].includes(entry.type) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                            <DetailItem icon={<Hash size={14} />} label="Reference" value={entry.reference || '—'} />
                            <DetailItem icon={<FileText size={14} />} label="Type" value={cfg.label} />
                            <DetailItem icon={<Calendar size={14} />} label="Date" value={<DualDate date={entry.date} format="full" />} />
                            <DetailItem icon={<RotateCcw size={14} />} label="Running Balance" value={`NPR ${Math.abs(entry.balance).toLocaleString()} ${entry.balance >= 0 ? 'Dr' : 'Cr'}`} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function InvoiceBreakdown({ entry, invoices, invoiceDetails, onExpand }: {
    entry: LedgerEntry;
    invoices: Invoice[];
    invoiceDetails: Map<string, InvoiceDetailData>;
    onExpand: (invoiceId: string) => void;
}) {
    const detail = invoiceDetails.get(entry.id);
    const inv = invoices.find(i => i.id === entry.id);

    useEffect(() => {
        if (!detail && entry.type === 'invoice') {
            onExpand(entry.id);
        }
    }, [entry.id, entry.type, detail, onExpand]);

    if (!detail && !inv) {
        return (
            <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)' }}>Loading invoice details...</div>
            </div>
        );
    }

    const lineItems = detail?.lineItems || inv?.lineItems || [];
    const subTotal = parseFloat(inv?.subTotal || detail?.invoice?.subTotal || '0') || 0;
    const serviceCharge = parseFloat(inv?.serviceCharge || detail?.invoice?.serviceCharge || '0') || 0;
    const vat = parseFloat(inv?.vatAmount || detail?.invoice?.vatAmount || '0') || 0;
    const discount = parseFloat(inv?.discountAmount || detail?.invoice?.discountAmount || '0') || 0;
    const grandTotal = parseFloat(inv?.grandTotal || detail?.invoice?.grandTotal || '0') || 0;
    const guestPan = inv?.guestPan || detail?.invoice?.guestPan || '';
    const guestPhone = inv?.guestPhone || detail?.invoice?.guestPhone || '';
    const guestEmail = inv?.guestEmail || detail?.invoice?.guestEmail || '';
    const checkIn = inv?.checkIn || detail?.invoice?.checkIn;
    const checkOut = inv?.checkOut || detail?.invoice?.checkOut;
    const roomNumber = detail?.room?.number;

    return (
        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--notion-text-secondary)', marginBottom: '8px' }}>Invoice Breakdown</div>
            {(guestPan || guestPhone || guestEmail) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '4px', fontSize: '11px', color: 'var(--notion-text-muted)', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid var(--notion-border)' }}>
                    {guestPan && <span>PAN: {guestPan}</span>}
                    {guestPhone && <span>Phone: {guestPhone}</span>}
                    {guestEmail && <span>Email: {guestEmail}</span>}
                    {roomNumber && <span>Room: {roomNumber}</span>}
                    {checkIn && <span>Check-in: {new Date(checkIn).toLocaleDateString()}</span>}
                    {checkOut && <span>Check-out: {new Date(checkOut).toLocaleDateString()}</span>}
                </div>
            )}
            {lineItems.length > 0 ? (
                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', marginBottom: '8px' }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid var(--notion-border)', color: 'var(--notion-text-secondary)' }}>
                            <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Description</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Qty</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Rate</th>
                            <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {lineItems.map((item, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--notion-border-light)' }}>
                                <td style={{ padding: '4px 0', color: 'var(--notion-text)' }}>{item.description}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--notion-text)' }}>{item.quantity}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--notion-text)' }}>NPR {item.rate.toLocaleString()}</td>
                                <td style={{ padding: '4px 0', textAlign: 'right', color: 'var(--notion-text)', fontWeight: 500 }}>NPR {item.amount.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: '8px' }}>No line items available</div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12px', paddingTop: '6px', borderTop: '1px solid var(--notion-border)' }}>
                <span>Subtotal</span><span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {subTotal.toLocaleString()}</span>
                {serviceCharge > 0 && <><span>Service Charge</span><span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {serviceCharge.toLocaleString()}</span></>}
                <span>VAT</span><span style={{ fontWeight: 500, textAlign: 'right' }}>NPR {vat.toLocaleString()}</span>
                {discount > 0 && <><span>Discount</span><span style={{ fontWeight: 500, textAlign: 'right', color: 'var(--notion-green)' }}>-NPR {discount.toLocaleString()}</span></>}
                <span style={{ fontWeight: 700 }}>Grand Total</span><span style={{ fontWeight: 700, textAlign: 'right' }}>NPR {grandTotal.toLocaleString()}</span>
            </div>
        </div>
    );
}

function DetailItem({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; highlight?: 'red' | 'green' }) {
    const color = highlight === 'red' ? 'var(--notion-red)' : highlight === 'green' ? 'var(--notion-green)' : 'var(--notion-text)';
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--notion-text-secondary)' }}>{icon}</span>
            <div>
                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>{label}</div>
                <div style={{ fontWeight: 500, color }}>{value}</div>
            </div>
        </div>
    );
}

export interface CustomerLedgerDetailPanelProps {
    guestId?: string;
    bookingId?: string;
    onBack?: () => void;
}

export function CustomerLedgerDetailPanel(props: CustomerLedgerDetailPanelProps = {}) {
    const { guestId: guestIdProp, bookingId: bookingIdProp, onBack } = props;
    const searchParams = useSearchParams();
    const guestId = guestIdProp ?? decodeURIComponent(searchParams.get('guestId') || '');
    const bookingId = bookingIdProp ?? decodeURIComponent(searchParams.get('bookingId') || '');
    const { data: invoices = [], isLoading: invoicesLoading } = useFinanceInvoicesQuery(200);
    const { data: payments = [], isLoading: paymentsLoading } = useFinancePaymentsQuery(200);
    const { data: creditNotes = [], isLoading: creditNotesLoading } = useFinanceCreditNotesQuery(200);
    const isLoading = invoicesLoading || paymentsLoading || creditNotesLoading;
    const [ledgerPage, setLedgerPage] = useState(1);
    const LEDGER_PAGE_SIZE = 25;
    const [filterType, setFilterType] = useState<'all' | 'invoice' | 'payment' | 'credit_note' | 'charge' | 'order'>('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [invoiceDetails, setInvoiceDetails] = useState<Map<string, InvoiceDetailData>>(new Map());
    const [liveFolio, setLiveFolio] = useState<LiveFolio | null>(null);
    const [isFolioLoading, setIsFolioLoading] = useState(false);

    const fetchLiveFolio = useCallback(async () => {
        const idToTry = guestId || bookingId;
        if (!idToTry) return;

        setIsFolioLoading(true);
        try {
            // Try guest folio endpoint first (accepts both guestId and guestProfileId)
            let res;
            if (guestId) {
                res = await api.get<LiveFolio>(`/billing/customer/${encodeURIComponent(guestId)}/folio`);
            } else if (bookingId) {
                // If only bookingId provided, try booking folio endpoint
                try {
                    res = await api.get<LiveFolio>(`/billing/bookings/${encodeURIComponent(bookingId)}/folio`);
                } catch (e: any) {
                    // Fallback: try treating bookingId as guestId
                    if (e.status === 404 || e.status === 500) {
                        res = await api.get<LiveFolio>(`/billing/customer/${encodeURIComponent(bookingId)}/folio`);
                    } else {
                        throw e;
                    }
                }
            }
            if (res?.data) setLiveFolio(res.data);
        } catch (error) {
            console.error('Failed to fetch folio:', error);
            setLiveFolio(null);
        } finally {
            setIsFolioLoading(false);
        }
    }, [bookingId, guestId]);

    useEffect(() => {
        fetchLiveFolio();
    }, [fetchLiveFolio]);

    const handleExpandInvoice = useCallback(async (invoiceId: string) => {
        if (invoiceDetails.has(invoiceId)) return;
        try {
            const res = await api.get<InvoiceDetailData>(`/invoices/${invoiceId}`);
            if (res.data) {
                setInvoiceDetails(prev => {
                    const next = new Map(prev);
                    next.set(invoiceId, res.data!);
                    return next;
                });
            }
        } catch (e) {
            // silently fail — fallback to list data
        }
    }, [invoiceDetails]);

    const activeLedger: CustomerLedger | null = useMemo(() => {
        if (!liveFolio) return null;
        const entries: LedgerEntry[] = [];

        // 1. Add Folio Charges (Rooms, Laundry, Custom items) with room details
        (liveFolio.charges || []).forEach((charge: any) => {
            const amount = parseFloat(charge.amount) || 0;
            const roomInfo = charge.booking?.room ? ` (Room ${charge.booking.room.number})` : '';
            entries.push({
                id: `charge-${charge.id}`,
                date: charge.date || charge.createdAt,
                description: `${charge.description || 'Folio Charge'}${roomInfo}`,
                debit: amount,
                credit: 0,
                balance: 0,
                type: 'charge',
                reference: `Folio #${charge.id}`,
                details: { charge },
            });
        });

        // 2. Add POS Orders (Food, Drinks) with full item details
        const chargedOrderIds = new Set(
            (liveFolio.charges || [])
                .filter((c: any) => c.orderId)
                .map((c: any) => c.orderId as string)
        );
        const bookingsWithInvoice = new Set(
            (liveFolio.invoices || [])
                .filter((inv: any) => !inv.isVoided && inv.bookingId)
                .map((inv: any) => inv.bookingId as string)
        );
        (liveFolio.orders || []).forEach((order: any) => {
            const onInvoicedStay = order.bookingId && bookingsWithInvoice.has(order.bookingId);
            const alreadyOnFolio = chargedOrderIds.has(order.id);
            const isBillable = order.status === 'SERVED' && !alreadyOnFolio && !onInvoicedStay;

            const itemCount = order.items?.length || 0;
            const itemSummary = itemCount > 0
                ? order.items.slice(0, 3).map((i: any) => i.menuItem?.name || i.name || 'Item').join(', ') + (itemCount > 3 ? ` +${itemCount - 3} more` : '')
                : '';
            const roomInfo = order.booking?.room ? ` (Room ${order.booking.room.number})` : '';

            if (!isBillable) {
                entries.push({
                    id: `order-${order.id}`,
                    date: order.createdAt,
                    description: `${order.orderNumber || 'Order'} — ${itemSummary || order.orderType?.replace(/_/g, ' ') || 'POS'}${roomInfo}${onInvoicedStay ? ' (on invoice)' : ''}`,
                    debit: 0,
                    credit: 0,
                    balance: 0,
                    type: 'order',
                    reference: order.orderNumber || `Order #${order.id}`,
                    details: { order, informational: true },
                });
                return;
            }

            const amount = parseFloat(order.totalAmount || order.subTotal) || 0;
            entries.push({
                id: `order-${order.id}`,
                date: order.createdAt,
                description: `${order.orderNumber || 'Order'} — ${itemSummary || order.orderType?.replace(/_/g, ' ') || 'POS'}${roomInfo}`,
                debit: amount,
                credit: 0,
                balance: 0,
                type: 'order',
                reference: order.orderNumber || `Order #${order.id}`,
                details: { order }
            });
        });

        // 3. Add Invoices — primary billing document when checkout invoice exists
        (liveFolio.invoices || []).forEach((inv: any) => {
            if (inv.isVoided) return;
            const amount = parseFloat(inv.grandTotal) || 0;
            const roomInfo = inv.booking?.room ? ` (Room ${inv.booking.room.number})` : '';
            entries.push({
                id: inv.id,
                date: inv.createdAt,
                description: `Invoice ${inv.invoiceNumber}${roomInfo}`,
                debit: amount,
                credit: 0,
                balance: 0,
                type: 'invoice',
                reference: inv.invoiceNumber,
                details: { invoice: inv },
            });
        });

        // 4. Add Payments with method details
        // Include both booking-level and order-level payments
        (liveFolio.payments || []).forEach((pay: any) => {
            const amount = parseFloat(pay.amount) || 0;
            const method = (pay.paymentMethod || 'Unknown').replace(/_/g, ' ');
            const isOrderPayment = pay.orderId ? ` (Order)` : '';
            entries.push({
                id: `pay-${pay.id}`,
                date: pay.createdAt,
                description: `Payment via ${method}${isOrderPayment}${pay.recordedBy?.fullName ? ` by ${pay.recordedBy.fullName}` : ''}`,
                debit: 0,
                credit: amount,
                balance: 0,
                type: 'payment',
                reference: pay.transactionId || pay.id.toString(),
                details: { payment: pay },
            });
        });

        // 5. Credit notes linked to this guest's bookings
        const bookingIdsSet = new Set<string>();
        (liveFolio.bookings || []).forEach((b: { id?: string }) => { if (b.id) bookingIdsSet.add(b.id); });
        if (liveFolio.booking?.id) bookingIdsSet.add(liveFolio.booking.id);

        creditNotes.forEach(cn => {
            const original = invoices.find(i => i.id === cn.originalInvoiceId);
            const cnBookingId = original?.bookingId;
            if (!cnBookingId || !bookingIdsSet.has(cnBookingId)) return;
            const amount = parseFloat(cn.amount) || 0;
            entries.push({
                id: cn.id,
                date: cn.createdAt,
                description: `Credit Note ${cn.creditNoteNumber}`,
                debit: 0,
                credit: amount,
                balance: 0,
                type: 'credit_note',
                reference: cn.creditNoteNumber,
                details: { creditNote: cn },
            });
        });

        entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let running = 0;
        entries.forEach(e => {
            running += e.debit - e.credit;
            e.balance = running;
        });

        const firstBooking = liveFolio.bookings?.[0] || liveFolio.booking;
        const guest = firstBooking?.guest;
        const targetId = bookingId || guestId || '';
        
        return {
            bookingId: firstBooking?.id?.toString() || targetId,
            customerName: firstBooking?.guestName || guest?.fullName || 'Guest',
            customerPhone: firstBooking?.guestPhone || guest?.phone,
            customerEmail: firstBooking?.guestEmail || guest?.email,
            totalDebit: liveFolio.summary?.totalCharges ?? entries.reduce((s, e) => s + e.debit, 0),
            totalCredit: liveFolio.summary?.totalPayments ?? entries.reduce((s, e) => s + e.credit, 0),
            balance: liveFolio.summary?.balance ?? running,
            entries,
        };
    }, [liveFolio, bookingId, guestId, creditNotes, invoices]);

    const filteredEntries = useMemo(() => {
        if (!activeLedger) return [];
        let entries = activeLedger.entries;
        if (filterType !== 'all') entries = entries.filter(e => e.type === filterType);
        if (dateFrom) entries = entries.filter(e => e.date >= dateFrom);
        if (dateTo) entries = entries.filter(e => e.date <= dateTo + 'T23:59:59');
        return entries;
    }, [activeLedger, filterType, dateFrom, dateTo]);

    const paginatedEntries = useMemo(() => {
        const start = (ledgerPage - 1) * LEDGER_PAGE_SIZE;
        return filteredEntries.slice(start, start + LEDGER_PAGE_SIZE);
    }, [filteredEntries, ledgerPage]);

    const ledgerTotalPages = Math.max(1, Math.ceil(filteredEntries.length / LEDGER_PAGE_SIZE));

    useEffect(() => { setLedgerPage(1); }, [filterType, dateFrom, dateTo, guestId, bookingId]);

    const netBalance = activeLedger?.balance ?? liveFolio?.summary?.balance ?? 0;

    // Revenue and payment breakdowns for summary
    const summaryBreakdown = useMemo(() => {
        if (!activeLedger) return null;
        const roomRevenue = activeLedger.entries.filter(e => e.type === 'charge').reduce((s, e) => s + e.debit, 0);
        const fbRevenue = activeLedger.entries.filter(e => e.type === 'order').reduce((s, e) => s + e.debit, 0);
        const invoiceRevenue = activeLedger.entries.filter(e => e.type === 'invoice').reduce((s, e) => s + e.debit, 0);
        const paymentsByMethod: Record<string, number> = {};
        activeLedger.entries.filter(e => e.type === 'payment').forEach(e => {
            const method = e.details?.payment?.paymentMethod || 'Unknown';
            paymentsByMethod[method] = (paymentsByMethod[method] || 0) + e.credit;
        });
        
        return { roomRevenue, fbRevenue, invoiceRevenue, paymentsByMethod };
    }, [activeLedger]);

    const exportToExcel = useCallback(() => {
        if (!activeLedger) return;
        const rows: string[][] = [];

        rows.push(['Nivas PMS - Customer Ledger Report']);
        rows.push(['Guest:', activeLedger.customerName]);
        rows.push(['Booking ID:', activeLedger.bookingId]);
        rows.push(['Total Debits:', `NPR ${activeLedger.totalDebit.toLocaleString()}`]);
        rows.push(['Total Credits:', `NPR ${activeLedger.totalCredit.toLocaleString()}`]);
        rows.push(['Closing Balance:', `NPR ${Math.abs(activeLedger.balance).toLocaleString()} ${activeLedger.balance >= 0 ? 'Dr' : 'Cr'}`]);
        rows.push([]);

        rows.push(['#', 'Date', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'PAN', 'Phone', 'Email', 'Check-in', 'Check-out', 'Room']);
        activeLedger.entries.forEach((entry, idx) => {
            const inv = entry.type === 'invoice' ? invoices.find(i => i.id === entry.id) : null;
            rows.push([
                String(idx + 1),
                new Date(entry.date).toLocaleDateString(),
                entry.type,
                entry.description,
                entry.reference || '',
                entry.debit ? entry.debit.toString() : '',
                entry.credit ? entry.credit.toString() : '',
                entry.balance.toString(),
                inv?.guestPan || '',
                inv?.guestPhone || '',
                inv?.guestEmail || '',
                inv?.checkIn ? new Date(inv.checkIn).toLocaleDateString() : '',
                inv?.checkOut ? new Date(inv.checkOut).toLocaleDateString() : '',
                inv?.booking?.guestName || '',
            ]);
        });
        rows.push([]);

        rows.push(['Invoice Line Items Detail']);
        rows.push(['Invoice #', 'Description', 'Qty', 'Rate', 'Amount']);
        activeLedger.entries.filter(e => e.type === 'invoice').forEach(entry => {
            const detail = invoiceDetails.get(entry.id);
            const items = detail?.lineItems || [];
            if (items.length === 0) {
                rows.push([entry.reference, 'No line items available', '', '', '']);
            } else {
                items.forEach(item => {
                    rows.push([entry.reference, item.description, String(item.quantity), item.rate.toString(), item.amount.toString()]);
                });
            }
        });

        const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ledger-${activeLedger.customerName.replace(/\s+/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [activeLedger, invoices, invoiceDetails]);

    const handleBack = () => {
        if (onBack) onBack();
        else window.close();
    };

    if (isLoading || isFolioLoading) {
        return (
            <div className="page-center-column">
                <div className="animate-spin loading-spinner" />
                <p style={{ marginTop: '16px', color: 'var(--notion-text-secondary)' }}>Loading customer ledger...</p>
            </div>
        );
    }

    if (!activeLedger && !liveFolio) {
        return (
            <div style={{ padding: 'var(--space-8)', maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--notion-text-secondary)' }}>
                    <User size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                    <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Customer not found</h2>
                    <p style={{ marginBottom: '16px' }}>
                        No ledger data for {guestId ? `guest "${guestId.slice(0, 8)}..."` : `booking "${bookingId.slice(0, 8)}..."`}
                    </p>
                    <Button variant="secondary" onClick={handleBack} style={{ marginTop: '16px' }}>
                        <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Back
                    </Button>
                </div>
            </div>
        );
    }

    const displayName = activeLedger?.customerName || liveFolio?.booking?.guestName || liveFolio?.booking?.guest?.fullName || liveFolio?.booking?.guest?.name || 'Guest';
    const displayPhone = activeLedger?.customerPhone || liveFolio?.booking?.guestPhone;
    const displayEmail = activeLedger?.customerEmail || liveFolio?.booking?.guestEmail || liveFolio?.booking?.guest?.email;
    const stayCount = liveFolio?.summary?.stayCount || liveFolio?.bookings?.length || 0;
    const orderCount = liveFolio?.summary?.orderCount || liveFolio?.orders?.length || 0;

    return (
            <div style={{ padding: 'var(--space-2) 0 72px', maxWidth: '1200px', margin: '0 auto' }}>
                {/* Guest Profile Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                            <div style={{
                                width: '56px', height: '56px', borderRadius: '50%',
                                background: 'linear-gradient(135deg, var(--notion-blue), var(--notion-purple))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '22px',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                            }}>
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--notion-text)', margin: 0 }}>{displayName}</h1>
                                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: '6px', flexWrap: 'wrap' }}>
                                    {displayPhone && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            <Phone size={12} /> {displayPhone}
                                        </span>
                                    )}
                                    {displayEmail && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            <Mail size={12} /> {displayEmail}
                                        </span>
                                    )}
                                    {stayCount > 0 && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            <BedDouble size={12} /> {stayCount} stay{stayCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {orderCount > 0 && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                                            <UtensilsCrossed size={12} /> {orderCount} order{orderCount > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button variant="secondary" size="sm" onClick={exportToExcel} icon={<FileSpreadsheet size={14} />}>Export Excel</Button>
                        <Button variant="secondary" size="sm" onClick={handleBack} icon={<ArrowLeft size={14} />}>Back</Button>
                    </div>
                </div>

                {/* Unified Financial Summary */}
                {(activeLedger || liveFolio) && (
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                            <Card>
                                <div style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>Total Charges</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-red)' }}>
                                        NPR {(activeLedger?.totalDebit || liveFolio?.summary?.totalCharges || 0).toLocaleString()}
                                    </div>
                                    {summaryBreakdown && (
                                        <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {summaryBreakdown.roomRevenue > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--notion-text-secondary)' }}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BedDouble size={10} /> Room</span><span>NPR {summaryBreakdown.roomRevenue.toLocaleString()}</span></div>}
                                            {summaryBreakdown.fbRevenue > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--notion-text-secondary)' }}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><UtensilsCrossed size={10} /> F&B</span><span>NPR {summaryBreakdown.fbRevenue.toLocaleString()}</span></div>}
                                            {summaryBreakdown.invoiceRevenue > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--notion-text-secondary)' }}><span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Receipt size={10} /> Invoices</span><span>NPR {summaryBreakdown.invoiceRevenue.toLocaleString()}</span></div>}
                                        </div>
                                    )}
                                </div>
                            </Card>
                            <Card>
                                <div style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>Total Payments</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-green)' }}>
                                        NPR {(activeLedger?.totalCredit || liveFolio?.summary?.totalPayments || 0).toLocaleString()}
                                    </div>
                                    {summaryBreakdown && Object.keys(summaryBreakdown.paymentsByMethod).length > 0 && (
                                        <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                            {Object.entries(summaryBreakdown.paymentsByMethod).map(([method, amount]) => (
                                                <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--notion-text-secondary)' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>{PAYMENT_ICON_MAP[method] || <CreditCard size={10} />} {method.replace(/_/g, ' ')}</span>
                                                    <span>NPR {amount.toLocaleString()}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </Card>
                            <Card>
                                <div style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>Net Balance</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: netBalance > 0 ? 'var(--notion-red)' : netBalance < 0 ? 'var(--notion-green)' : 'var(--notion-text)' }}>
                                        {netBalance < 0 ? '−' : ''}NPR {Math.abs(netBalance).toLocaleString()}
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {netBalance > 0 ? (
                                            <><AlertTriangle size={12} style={{ color: 'var(--notion-orange)' }} /> Amount due from guest</>
                                        ) : netBalance < 0 ? (
                                            <><CheckCircle size={12} style={{ color: 'var(--notion-green)' }} /> Guest credit (overpaid)</>
                                        ) : (
                                            <><CheckCircle size={12} style={{ color: 'var(--notion-green)' }} /> Fully settled</>
                                        )}
                                    </div>
                                </div>
                            </Card>
                            <Card>
                                <div style={{ padding: 'var(--space-4)' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>Transactions</div>
                                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--notion-text)' }}>
                                        {activeLedger?.entries.length || (liveFolio?.charges?.length || 0) + (liveFolio?.orders?.length || 0) + (liveFolio?.payments?.length || 0) || 0}
                                    </div>
                                    <div style={{ marginTop: '8px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '3px', color: 'var(--notion-text-secondary)' }}>
                                        <span>{activeLedger?.entries.filter(e => e.type === 'charge').length || liveFolio?.charges?.length || 0} charges</span>
                                        <span>{activeLedger?.entries.filter(e => e.type === 'order').length || liveFolio?.orders?.length || 0} orders</span>
                                        <span>{activeLedger?.entries.filter(e => e.type === 'payment').length || liveFolio?.payments?.length || 0} payments</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {activeLedger && (
                    <>
                        {/* Filters & Date Range */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                {(['all', 'charge', 'order', 'payment', 'invoice', 'credit_note'] as const).map(t => {
                                    const labels: Record<string, string> = { all: 'All', charge: 'Room & Charges', order: 'F&B Orders', payment: 'Payments', invoice: 'Invoices', credit_note: 'Credit Notes' };
                                    const counts: Record<string, number> = {
                                        all: activeLedger?.entries.length || 0,
                                        charge: activeLedger?.entries.filter(e => e.type === 'charge').length || 0,
                                        order: activeLedger?.entries.filter(e => e.type === 'order').length || 0,
                                        payment: activeLedger?.entries.filter(e => e.type === 'payment').length || 0,
                                        invoice: activeLedger?.entries.filter(e => e.type === 'invoice').length || 0,
                                        credit_note: activeLedger?.entries.filter(e => e.type === 'credit_note').length || 0,
                                    };
                                    if (t !== 'all' && counts[t] === 0) return null;
                                    return (
                                        <button
                                            key={t}
                                            onClick={() => setFilterType(t)}
                                            style={{
                                                padding: '6px 14px',
                                                borderRadius: 'var(--radius-md)',
                                                border: '1px solid',
                                                borderColor: filterType === t ? 'var(--notion-border)' : 'transparent',
                                                backgroundColor: filterType === t ? 'var(--notion-bg-tertiary)' : 'transparent',
                                                color: filterType === t ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                fontWeight: filterType === t ? 600 : 400,
                                            }}
                                        >
                                            {labels[t]} {t !== 'all' && <span style={{ fontSize: '11px', opacity: 0.7 }}>({counts[t]})</span>}
                                        </button>
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                <Filter size={14} style={{ color: 'var(--notion-text-secondary)' }} />
                                <DatePicker
                                    selected={dateFrom ? new Date(dateFrom) : null}
                                    onChange={(date) => setDateFrom(date ? date.toISOString().split('T')[0] || '' : '')}
                                    placeholder="From"
                                    dateFormat="yyyy-MM-dd"
                                    fullWidth={false}
                                />
                                <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>to</span>
                                <DatePicker
                                    selected={dateTo ? new Date(dateTo) : null}
                                    onChange={(date) => setDateTo(date ? date.toISOString().split('T')[0] || '' : '')}
                                    placeholder="To"
                                    dateFormat="yyyy-MM-dd"
                                    fullWidth={false}
                                />
                                {(dateFrom || dateTo) && (
                                    <button onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ padding: '4px 8px', fontSize: '11px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', background: 'var(--notion-bg)', color: 'var(--notion-text-secondary)', cursor: 'pointer' }}>Clear</button>
                                )}
                            </div>
                        </div>

                        {/* Ledger Table */}
                        <Card>
                            <div style={{ overflowX: 'auto' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '48px 120px 1fr 100px 100px 100px 40px',
                                    gap: '8px',
                                    padding: '12px 16px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderBottom: '1px solid var(--notion-border)',
                                    fontSize: '12px',
                                    fontWeight: 600,
                                    color: 'var(--notion-text-secondary)',
                                }}>
                                    <span>#</span>
                                    <span>Date</span>
                                    <span>Description</span>
                                    <span style={{ textAlign: 'right' }}>Debit</span>
                                    <span style={{ textAlign: 'right' }}>Credit</span>
                                    <span style={{ textAlign: 'right' }}>Balance</span>
                                    <span></span>
                                </div>
                                <div>
                                    {paginatedEntries.map((entry, idx) => (
                                        <AccordionRow key={entry.id} entry={entry} index={(ledgerPage - 1) * LEDGER_PAGE_SIZE + idx} invoices={invoices} invoiceDetails={invoiceDetails} onExpand={handleExpandInvoice} />
                                    ))}
                                    {filteredEntries.length === 0 && (
                                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                                            No entries match the selected filter.
                                        </div>
                                    )}
                                </div>
                            </div>
                            {filteredEntries.length > LEDGER_PAGE_SIZE && (
                                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--notion-border)' }}>
                                    <Pagination
                                        page={ledgerPage}
                                        totalPages={ledgerTotalPages}
                                        total={filteredEntries.length}
                                        limit={LEDGER_PAGE_SIZE}
                                        onPageChange={setLedgerPage}
                                    />
                                </div>
                            )}
                        </Card>
                    </>
                )}

                {/* Footer summary */}
                <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                        Generated on <DualDate date={new Date()} format="full" />
                    </div>
                    {activeLedger && (
                        <div style={{ fontSize: '15px', fontWeight: 700, color: activeLedger.balance > 0 ? 'var(--notion-red)' : 'var(--notion-green)' }}>
                            Closing Balance: NPR {Math.abs(activeLedger.balance).toLocaleString()} {activeLedger.balance >= 0 ? 'Dr' : 'Cr'}
                        </div>
                    )}
                </div>
            </div>
    );
}

export default function CustomerLedgerDetailPage() {
    return <CustomerLedgerDetailPanel />;
}
