'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useRouter } from '@/lib/router';
import { GuestService, type GuestDetails, type GuestFinancials, type CustomerType } from '@/lib/services/guest.service';
import { ArrowLeft, Edit3, Save, Star, Ban, Phone, Mail, Globe, MapPin, Shield, Calendar, CreditCard, FileText, UtensilsCrossed, Home, DollarSign, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import RecordPaymentModal from '@/components/features/payments/RecordPaymentModal';

import DateField from "@/components/ui/DateField";
function getIdFromPath(): string | null {
    const m = window.location.pathname.match(/^\/hotel\/guests\/(.+)$/);
    return m && m[1] ? decodeURIComponent(m[1]) : null;
}

function InfoRow({ label, value, icon }: { label: string; value?: string | null | number; icon: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--notion-text)' }}>
                <span style={{ color: 'var(--notion-text-muted)' }}>{icon}</span>
                {value || '—'}
            </div>
        </div>
    );
}

function EmptyState({ message, icon }: { message: string; icon: React.ReactNode }) {
    return (
        <div style={{ padding: '48px', textAlign: 'center', color: 'var(--notion-text-secondary)', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ marginBottom: '12px', color: 'var(--notion-text-muted)' }}>{icon}</div>
            <p style={{ fontSize: '14px' }}>{message}</p>
        </div>
    );
}

function typeBadge(type?: CustomerType) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        HOTEL_GUEST: { bg: 'var(--notion-blue-bg)', color: 'var(--notion-blue)', label: 'Hotel Guest' },
        RESTAURANT_CUSTOMER: { bg: 'var(--notion-orange-bg)', color: 'var(--notion-orange)', label: 'Restaurant' },
        BOTH: { bg: 'var(--notion-purple-bg)', color: 'var(--notion-purple)', label: 'Both' },
    };
    const s = map[type || 'HOTEL_GUEST'];
    return <span style={{ display: 'inline-flex', padding: '2px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', backgroundColor: s?.bg, color: s?.color }}>{s?.label}</span>;
}

export default function CustomerDetailPage() {
    const router = useRouter();
    const guestId = getIdFromPath();
    const [details, setDetails] = useState<GuestDetails | null>(null);
    const [financials, setFinancials] = useState<GuestFinancials | null>(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<'profile'|'orders'|'bookings'|'ledger'>('profile');
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState<any>({});
    const [saving, setSaving] = useState(false);
    const [showPayment, setShowPayment] = useState(false);

    const fetchData = useCallback(async () => {
        if (!guestId) return;
        setLoading(true);
        try {
            const [d, f] = await Promise.all([GuestService.getById(guestId), GuestService.getFinancials(guestId)]);
            setDetails(d); setFinancials(f);
            if (d) setForm({
                firstName: d.firstName||'', lastName: d.lastName||'', fullName: d.fullName||'', uniqueId: d.uniqueId||'',
                phone: d.phone||'', email: d.email||'', fatherName: d.fatherName||'', dob: d.dob||'',
                occupation: d.occupation||'', nationality: d.nationality||'', city: d.city||'', country: d.country||'',
                idType: d.idType||'', idNumber: d.idNumber||'', panNumber: d.panNumber||'', openingDueAmount: d.openingDueAmount||'',
                customerType: d.customerType||'HOTEL_GUEST', address: d.address||'', notes: d.notes||'', isVip: d.isVip||false,
            });
        } catch { toast.error('Failed to load customer'); }
        finally { setLoading(false); }
    }, [guestId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async () => {
        if (!guestId) return;
        setSaving(true);
        try { await GuestService.update(guestId, form); toast.success('Saved'); setEditing(false); fetchData(); }
        catch (err: any) { toast.error(err?.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <DashboardLayout><div style={{ padding: 'var(--space-12)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--notion-text-secondary)' }} />
            <span style={{ color: 'var(--notion-text-secondary)' }}>Loading customer...</span>
        </div></DashboardLayout>
    );

    if (!details) return (
        <DashboardLayout><div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
            <p style={{ color: 'var(--notion-text-secondary)' }}>Customer not found</p>
            <Button variant="secondary" onClick={() => router.push('/hotel/guests')} style={{ marginTop: '16px' }}>
                <ArrowLeft size={14} style={{ marginRight: '6px' }} /> Back to Customers
            </Button>
        </div></DashboardLayout>
    );

    const ls = { fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' } as const;

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" size="sm" onClick={() => router.push('/hotel/guests')}><ArrowLeft size={14} /> Back</Button>
                        <h1 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>Customer Detail</h1>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button variant="secondary" size="sm" onClick={() => setEditing(!editing)}><Edit3 size={14} style={{ marginRight: '6px' }} /> {editing?'Cancel':'Edit'}</Button>
                        {financials?.stats && financials.stats.balance > 0 && (
                            <Button variant="primary" size="sm" onClick={() => setShowPayment(true)}><CreditCard size={14} style={{ marginRight: '6px' }} /> Payment</Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={() => router.push(`/hotel/finance?tab=customer-ledger`)}><FileText size={14} style={{ marginRight: '6px' }} /> Ledger</Button>
                    </div>
                </div>

                {/* Customer Card */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', padding: 'var(--space-5)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', marginBottom: 'var(--space-6)' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: details.isVip ? 'var(--notion-yellow-bg)' : 'var(--notion-blue-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: '700', color: details.isVip ? 'var(--notion-yellow)' : 'var(--notion-blue)', flexShrink: 0 }}>
                        {details.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>{details.fullName}</h2>
                            {details.isVip && <span style={{ fontSize: '11px', backgroundColor: 'var(--notion-yellow-bg)', color: 'var(--notion-yellow)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Star size={10} /> VIP</span>}
                            {details.isBanned && <span style={{ fontSize: '11px', backgroundColor: 'var(--notion-red-bg)', color: 'var(--notion-red)', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Ban size={10} /> Banned</span>}
                            {typeBadge(details.customerType)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '6px', fontSize: '13px', color: 'var(--notion-text-secondary)', flexWrap: 'wrap' }}>
                            {details.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {details.phone}</span>}
                            {details.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {details.email}</span>}
                            {details.nationality && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Globe size={12} /> {details.nationality}</span>}
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Shield size={12} /> {details.uniqueId || '—'}</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', textAlign: 'center' }}>
                        <div><div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{details.bookings?.length||0}</div><div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Stays</div></div>
                        <div><div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>{details.orders?.length||0}</div><div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Orders</div></div>
                        <div><div style={{ fontSize: '20px', fontWeight: '700', color: (financials?.stats.balance||0)>0?'var(--notion-red)':'var(--notion-green)' }}>NPR {(financials?.stats.balance||0).toLocaleString()}</div><div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Balance</div></div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--notion-border)', marginBottom: 'var(--space-5)' }}>
                    {[{k:'profile',l:'Profile',i:User},{k:'orders',l:'Orders',i:UtensilsCrossed},{k:'bookings',l:'Bookings',i:Home},{k:'ledger',l:'Ledger',i:FileText}].map(t => (
                        <button key={t.k} onClick={()=>setTab(t.k as any)} style={{ padding: '10px 20px', fontSize: '14px', fontWeight: '500', borderBottom: tab===t.k?'2px solid var(--notion-blue)':'2px solid transparent', color: tab===t.k?'var(--notion-blue)':'var(--notion-text-secondary)', background:'none', border:'none', borderBottomWidth:'2px', borderBottomStyle:'solid', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}><t.i size={14} /> {t.l}</button>
                    ))}
                </div>

                {/* Profile */}
                {tab==='profile' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', animation: 'fadeIn 0.2s ease-out' }}>
                        {editing ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', padding: 'var(--space-5)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                                    {['firstName','lastName','uniqueId','phone','email','fatherName'].map(k => (
                                        <div key={k}><label style={ls}>{k.replace(/[A-Z]/g, ' $&').replace(/^./, c=>c.toUpperCase())}</label><Input value={form[k]} onChange={(e:any)=>setForm({...form,[k]:e.target.value})} /></div>
                                    ))}
                                    <div><label style={ls}>DOB</label><DateField value={form.dob} onChange={(v)=>setForm({...form,dob:v})} /></div>
                                    {['occupation','nationality','city','country','panNumber'].map(k => (
                                        <div key={k}><label style={ls}>{k.replace(/[A-Z]/g, ' $&').replace(/^./, c=>c.toUpperCase())}</label><Input value={form[k]} onChange={(e:any)=>setForm({...form,[k]:e.target.value})} /></div>
                                    ))}
                                    <div>
                                        <label style={ls}>ID Type</label>
                                        <select value={form.idType||''} onChange={(e:any)=>setForm({...form,idType:e.target.value})} style={{ width:'100%',padding:'8px',backgroundColor:'var(--notion-bg)',border:'1px solid var(--notion-border)',borderRadius:'var(--radius-md)',fontSize:'14px',outline:'none',color:'var(--notion-text)' }}>
                                            <option value="">Select</option><option>Citizenship</option><option>Passport</option><option>Voter ID</option><option>National ID</option><option>Driver's License</option><option>Aadhar Card</option>
                                        </select>
                                    </div>
                                    <div><label style={ls}>ID Number</label><Input value={form.idNumber} onChange={(e:any)=>setForm({...form,idNumber:e.target.value})} /></div>
                                    <div><label style={ls}>Opening Due</label><Input value={form.openingDueAmount} onChange={(e:any)=>setForm({...form,openingDueAmount:e.target.value})} /></div>
                                </div>
                                <div><label style={ls}>Address</label><Input value={form.address} onChange={(e:any)=>setForm({...form,address:e.target.value})} placeholder="Full address" /></div>
                                <div><label style={ls}>Notes</label><textarea value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} style={{ width:'100%',minHeight:'80px',padding:'8px 12px',backgroundColor:'var(--notion-bg)',border:'1px solid var(--notion-border)',borderRadius:'var(--radius-md)',color:'var(--notion-text)',fontSize:'14px',fontFamily:'inherit',resize:'vertical' }} placeholder="Notes..." /></div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text)', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={form.isVip} onChange={e=>setForm({...form,isVip:e.target.checked})} style={{ accentColor: 'var(--notion-yellow)' }} />
                                        <Star size={14} style={{ color: 'var(--notion-yellow)' }} /> Mark as VIP
                                    </label>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <Button variant="secondary" onClick={()=>setEditing(false)}>Cancel</Button>
                                    <Button onClick={handleSave} disabled={saving}><Save size={14} style={{ marginRight: '4px' }} /> {saving?'Saving...':'Save'}</Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-4)', padding: 'var(--space-5)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                    <InfoRow label="Full Name" value={details.fullName} icon={<User size={14} />} />
                                    <InfoRow label="Unique ID" value={details.uniqueId} icon={<Shield size={14} />} />
                                    <InfoRow label="Phone" value={details.phone} icon={<Phone size={14} />} />
                                    <InfoRow label="Email" value={details.email} icon={<Mail size={14} />} />
                                    <InfoRow label="Father Name" value={details.fatherName} icon={<User size={14} />} />
                                    <InfoRow label="DOB" value={details.dob?format(new Date(details.dob),'MMM d, yyyy'):undefined} icon={<Calendar size={14} />} />
                                    <InfoRow label="Occupation" value={details.occupation} icon={<User size={14} />} />
                                    <InfoRow label="Nationality" value={details.nationality} icon={<Globe size={14} />} />
                                    <InfoRow label="City" value={details.city} icon={<MapPin size={14} />} />
                                    <InfoRow label="Country" value={details.country} icon={<Globe size={14} />} />
                                    <InfoRow label="ID" value={details.idType?`${details.idType}: ${details.idNumber}`:undefined} icon={<Shield size={14} />} />
                                    <InfoRow label="PAN" value={details.panNumber} icon={<Shield size={14} />} />
                                    <InfoRow label="Opening Due" value={details.openingDueAmount?`NPR ${Number(details.openingDueAmount).toLocaleString()}`:undefined} icon={<DollarSign size={14} />} />
                                    <InfoRow label="Member Since" value={details.createdAt?format(new Date(details.createdAt),'MMM d, yyyy'):undefined} icon={<Calendar size={14} />} />
                                </div>
                                <div style={{ padding: 'var(--space-5)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)', margin: '0 0 12px 0' }}>Address</h4>
                                    <p style={{ fontSize: '14px', color: 'var(--notion-text-muted)', margin: 0 }}>{details.address || 'No address on file.'}</p>
                                </div>
                                <div style={{ padding: 'var(--space-5)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                    <h4 style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)', margin: '0 0 12px 0' }}>Notes</h4>
                                    <p style={{ fontSize: '14px', color: 'var(--notion-text-muted)', margin: 0 }}>{details.notes || 'No notes available.'}</p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Orders */}
                {tab==='orders' && (
                    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                        {(!details.orders||details.orders.length===0)?<EmptyState message="No orders found." icon={<UtensilsCrossed size={32} />} />:<div style={{ display:'flex',flexDirection:'column',gap:'var(--space-3)' }}>
                            {details.orders.map((o:any)=>(<div key={o.id} style={{ padding:'16px',backgroundColor:'var(--notion-bg-secondary)',borderRadius:'var(--radius-md)',border:'1px solid var(--notion-border)' }}>
                                <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'8px' }}>
                                    <span style={{ fontWeight:'600',color:'var(--notion-text)' }}>#{o.orderNumber} — {o.orderType?.replace('_',' ')}</span>
                                    <span style={{ fontSize:'12px',padding:'2px 8px',borderRadius:'99px',fontWeight:'500',backgroundColor:'var(--notion-bg-tertiary)',color:'var(--notion-text-secondary)' }}>{o.status}</span>
                                </div>
                                <div style={{ fontSize:'13px',color:'var(--notion-text-secondary)' }}>{o.createdAt?format(new Date(o.createdAt),'MMM d, yyyy h:mm a'):''} · NPR {Number(o.totalAmount||0).toLocaleString()}</div>
                            </div>))}
                        </div>}
                    </div>
                )}

                {/* Bookings */}
                {tab==='bookings' && (
                    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                        {(!details.bookings||details.bookings.length===0)?<EmptyState message="No bookings found." icon={<Home size={32} />} />:<div style={{ display:'flex',flexDirection:'column',gap:'var(--space-3)' }}>
                            {details.bookings.map((b:any)=>{
                                const active = b.status==='CHECKED_IN'||b.status==='CONFIRMED';
                                return (<div key={b.id} style={{ padding:'16px',backgroundColor:'var(--notion-bg-secondary)',borderRadius:'var(--radius-md)',border:'1px solid var(--notion-border)',borderLeft:`4px solid ${active?'var(--notion-green)':'var(--notion-border)'}` }}>
                                    <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'6px' }}>
                                        <span style={{ fontWeight:'600',color:'var(--notion-text)' }}>Room {b.room?.number||b.roomId}</span>
                                        <span style={{ fontSize:'12px',padding:'2px 8px',borderRadius:'4px',fontWeight:'500',backgroundColor:active?'var(--notion-green-bg)':'var(--notion-bg-tertiary)',color:active?'var(--notion-green)':'var(--notion-text-secondary)' }}>{b.status}</span>
                                    </div>
                                    <div style={{ fontSize:'13px',color:'var(--notion-text-secondary)' }}>{format(new Date(b.checkIn),'MMM d, yyyy')} – {format(new Date(b.checkOut),'MMM d, yyyy')} · NPR {Number(b.totalAmount||0).toLocaleString()}</div>
                                </div>);
                            })}
                        </div>}
                    </div>
                )}

                {/* Ledger */}
                {tab==='ledger' && (
                    <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                        {(!financials||financials.invoices.length===0&&financials.payments.length===0&&financials.orders.length===0)?<EmptyState message="No ledger entries found." icon={<FileText size={32} />} />:<>
                            <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--space-4)',marginBottom:'var(--space-4)' }}>
                                <div style={{ padding:'16px',backgroundColor:'var(--notion-bg-secondary)',borderRadius:'var(--radius-lg)',border:'1px solid var(--notion-border)',textAlign:'center' }}>
                                    <div style={{ fontSize:'12px',color:'var(--notion-text-secondary)',textTransform:'uppercase',marginBottom:'4px' }}>Total Invoiced</div>
                                    <div style={{ fontSize:'18px',fontWeight:'700',color:'var(--notion-text)' }}>NPR {financials.stats.totalInvoiced.toLocaleString()}</div>
                                </div>
                                <div style={{ padding:'16px',backgroundColor:'var(--notion-bg-secondary)',borderRadius:'var(--radius-lg)',border:'1px solid var(--notion-border)',textAlign:'center' }}>
                                    <div style={{ fontSize:'12px',color:'var(--notion-text-secondary)',textTransform:'uppercase',marginBottom:'4px' }}>Total Paid</div>
                                    <div style={{ fontSize:'18px',fontWeight:'700',color:'var(--notion-green)' }}>NPR {financials.stats.totalPaid.toLocaleString()}</div>
                                </div>
                                <div style={{ padding:'16px',backgroundColor:'var(--notion-bg-secondary)',borderRadius:'var(--radius-lg)',border:'1px solid var(--notion-border)',textAlign:'center' }}>
                                    <div style={{ fontSize:'12px',color:'var(--notion-text-secondary)',textTransform:'uppercase',marginBottom:'4px' }}>Balance Due</div>
                                    <div style={{ fontSize:'18px',fontWeight:'700',color:financials.stats.balance>0?'var(--notion-red)':'var(--notion-text)' }}>NPR {financials.stats.balance.toLocaleString()}</div>
                                </div>
                            </div>
                            <div style={{ backgroundColor:'var(--notion-bg-secondary)',borderRadius:'var(--radius-lg)',border:'1px solid var(--notion-border)',overflow:'hidden' }}>
                                <table style={{ width:'100%',fontSize:'14px',borderCollapse:'collapse' }}>
                                    <thead style={{ backgroundColor:'var(--notion-bg-tertiary)',color:'var(--notion-text-secondary)' }}>
                                        <tr><th style={{padding:'10px 16px',textAlign:'left',fontWeight:'500'}}>Date</th><th style={{padding:'10px 16px',textAlign:'left',fontWeight:'500'}}>Description</th><th style={{padding:'10px 16px',textAlign:'right',fontWeight:'500'}}>Debit</th><th style={{padding:'10px 16px',textAlign:'right',fontWeight:'500'}}>Credit</th></tr>
                                    </thead>
                                    <tbody>
                                        {(()=>{
                                            const txs:Array<{date:Date;desc:string;debit:number;credit:number}> = [];
                                            financials.invoices.forEach((inv:any)=>txs.push({date:new Date(inv.createdAt),desc:`Invoice ${inv.invoiceNumber}`,debit:Number(inv.grandTotal||0),credit:0}));
                                            financials.orders.forEach((o:any)=>txs.push({date:new Date(o.createdAt),desc:`Order ${o.orderNumber||''} — ${o.orderType?.replace('_',' ')||'Food'}`,debit:Number(o.totalAmount||0),credit:0}));
                                            financials.payments.forEach((pay:any)=>txs.push({date:new Date(pay.createdAt),desc:`Payment — ${pay.method||'Cash'}`,debit:0,credit:Number(pay.amount||0)}));
                                            txs.sort((a,b)=>b.date.getTime()-a.date.getTime());
                                            return txs.map((tx,i)=>(<tr key={i} style={{borderBottom:'1px solid var(--notion-border)'}}>
                                                <td style={{padding:'10px 16px',color:'var(--notion-text-secondary)',fontSize:'13px'}}>{format(tx.date,'MMM d, yyyy')}</td>
                                                <td style={{padding:'10px 16px',color:'var(--notion-text)'}}>{tx.desc}</td>
                                                <td style={{padding:'10px 16px',textAlign:'right',color:'var(--notion-red)',fontWeight:500}}>{tx.debit?`NPR ${tx.debit.toLocaleString()}`:'—'}</td>
                                                <td style={{padding:'10px 16px',textAlign:'right',color:'var(--notion-green)',fontWeight:500}}>{tx.credit?`NPR ${tx.credit.toLocaleString()}`:'—'}</td>
                                            </tr>));
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </>}
                    </div>
                )}
            </div>

            {showPayment && guestId && (
                <RecordPaymentModal
                    isOpen={showPayment}
                    onClose={() => setShowPayment(false)}
                    context={{ bookingId: guestId }}
                    onSuccess={() => { setShowPayment(false); fetchData(); }}
                />
            )}
        </DashboardLayout>
    );
}
