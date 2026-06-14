import { useEffect, useState } from 'react';

interface InvoiceData {
    hotel: { name?: string; logoUrl?: string | null; address?: string | null; phone?: string | null; email?: string | null; panNumber?: string | null; vatNumber?: string | null; primaryColor?: string | null; currency?: string };
    invoice: { invoiceNumber?: string; fiscalYear?: string; date?: string; guestName?: string; guestPan?: string | null; paymentStatus?: string; currency?: string };
    lineItems: { description: string; amount: string | number; type?: string; date?: string }[];
    totals: { subTotal: number; serviceCharge: number; vat: number; discount: number; grandTotal: number };
    terms?: string;
    room?: { number?: string; type?: string };
}

// Public, no-auth invoice — opened via /invoice?id=<invoiceId> from an SMS/email link.
export default function PublicInvoicePage() {
    const id = new URLSearchParams(window.location.search).get('id') || '';
    const [data, setData] = useState<InvoiceData | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

    useEffect(() => {
        if (!id) { setState('error'); return; }
        fetch(`/api/v1/public/invoice/${encodeURIComponent(id)}`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(res => { setData(res.data); setState('ok'); })
            .catch(() => setState('error'));
    }, [id]);

    if (state === 'loading') return <Centered>Loading invoice…</Centered>;
    if (state === 'error' || !data) return <Centered>Invoice not found.</Centered>;

    const accent = data.hotel.primaryColor || '#1a365d';
    const cur = data.invoice.currency || data.hotel.currency || 'NPR';
    const fmt = (n: number) => `${cur} ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div style={{ minHeight: '100vh', background: '#f4f4f5', padding: '24px 12px', fontFamily: 'Arial, sans-serif', color: '#1a1a1a' }}>
            <div style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                {/* Header */}
                <div style={{ background: accent, color: '#fff', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        {data.hotel.logoUrl ? (
                            <img
                                src={data.hotel.logoUrl}
                                alt={data.hotel.name || 'Hotel logo'}
                                style={{ height: 40, maxWidth: 120, marginBottom: 6, objectFit: 'contain', display: 'block' }}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        ) : null}
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{data.hotel.name}</div>
                        <div style={{ fontSize: 12, opacity: 0.85 }}>{data.hotel.address}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>INVOICE</div>
                        <div>{data.invoice.invoiceNumber}</div>
                        {data.invoice.fiscalYear && <div>FY {data.invoice.fiscalYear}</div>}
                    </div>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    {/* Meta */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#555', marginBottom: 16 }}>
                        <div>
                            <div><strong style={{ color: '#111' }}>{data.invoice.guestName}</strong></div>
                            {data.room?.number && <div style={{ marginTop: 2 }}>Room: {data.room.number} {data.room.type ? `(${data.room.type})` : ''}</div>}
                            {data.invoice.guestPan && <div style={{ marginTop: 2 }}>PAN: {data.invoice.guestPan}</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            {data.invoice.date && <div>{new Date(data.invoice.date).toLocaleDateString()}</div>}
                            <div style={{ marginTop: 4, display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: data.invoice.paymentStatus === 'PAID' ? '#dcfce7' : '#fef3c7', color: data.invoice.paymentStatus === 'PAID' ? '#166534' : '#92400e' }}>
                                {data.invoice.paymentStatus || 'PAID'}
                            </div>
                        </div>
                    </div>

                    {/* Line items */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 12 }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #eee', color: '#888' }}>
                                <th style={{ textAlign: 'left', padding: '8px 0' }}>Description</th>
                                <th style={{ textAlign: 'right', padding: '8px 0' }}>Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.lineItems.length === 0 ? (
                                <tr><td colSpan={2} style={{ padding: '12px 0', color: '#999' }}>Room charges</td></tr>
                            ) : data.lineItems.map((it, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f3f3' }}>
                                    <td style={{ padding: '8px 0' }}>{it.description}</td>
                                    <td style={{ padding: '8px 0', textAlign: 'right' }}>{fmt(Number(it.amount))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Totals */}
                    <div style={{ marginLeft: 'auto', maxWidth: 280, fontSize: 13 }}>
                        <Row label="Subtotal" value={fmt(data.totals.subTotal)} />
                        {data.totals.serviceCharge > 0 && <Row label="Service charge" value={fmt(data.totals.serviceCharge)} />}
                        {data.totals.vat > 0 && <Row label="VAT" value={fmt(data.totals.vat)} />}
                        {data.totals.discount > 0 && <Row label="Discount" value={`- ${fmt(data.totals.discount)}`} />}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid #eee', fontWeight: 700, fontSize: 15, color: accent }}>
                            <span>Total</span><span>{fmt(data.totals.grandTotal)}</span>
                        </div>
                    </div>

                    {data.terms ? (
                        <div style={{ marginTop: 16, padding: '12px 14px', background: '#f9fafb', borderRadius: 8, fontSize: 11, color: '#666', lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: '#444' }}>Terms & Conditions</div>
                            {data.terms}
                        </div>
                    ) : null}

                    {/* Footer */}
                    <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #eee', fontSize: 11, color: '#999', textAlign: 'center' }}>
                        {(data.hotel.panNumber || data.hotel.vatNumber) && <div>PAN/VAT: {data.hotel.panNumber || data.hotel.vatNumber}</div>}
                        {[data.hotel.phone, data.hotel.email].filter(Boolean).join(' · ')}
                        <div style={{ marginTop: 6 }}>
                            <button onClick={() => window.print()} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, cursor: 'pointer' }}>Print / Save PDF</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', color: '#555' }}><span>{label}</span><span style={{ color: '#111' }}>{value}</span></div>;
}
function Centered({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'Arial, sans-serif', fontSize: 14 }}>{children}</div>;
}
