'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ImageUpload from '@/components/ui/ImageUpload';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSettings } from '@/lib/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api, { tokenStorage } from '@/lib/api';
import { toast } from 'sonner';
import { useTableSort } from '@/lib/hooks/useTableSort';
import SortableTh from '@/components/ui/SortableTh';
import { QRCodeCanvas } from 'qrcode.react';
import DateField from "@/components/ui/DateField";
import TimePicker from "@/components/ui/TimePicker";
import {
    Settings,
    Save,
    Building2,
    Palette,
    Clock,
    DollarSign,
    QrCode,
    Bell,
    ToggleLeft,
    ToggleRight,
    CheckCircle,
    AlertCircle,
    Upload,
    Loader2,
    Wifi,
    Phone,
    Plus,
    Trash2,
    Globe,
    Printer,
    FileText,
  Sparkles,
} from 'lucide-react';

// Toggle Switch Component
function ToggleSwitch({ enabled, onToggle, label }: { enabled: boolean; onToggle: () => void; label: string }) {
    return (
        <button
            onClick={onToggle}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: 'var(--space-4)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
            }}
        >
            <span style={{ fontSize: '14px', color: 'var(--notion-text)' }}>{label}</span>
            {enabled ? (
                <ToggleRight size={24} style={{ color: 'var(--notion-green)' }} />
            ) : (
                <ToggleLeft size={24} style={{ color: 'var(--notion-text-secondary)' }} />
            )}
        </button>
    );
}

interface PortalConfigForm {
    welcomeMessage: string;
    wifiNetworks: { floor?: string; ssid?: string; password?: string }[];
    contactNumbers: { label?: string; number?: string }[];
    customSections: { title?: string; content?: string }[];
    showBillBreakdown: boolean;
    showOrderProgress: boolean;
}

function GuestPortalConfigSection() {
    const [config, setConfig] = useState<PortalConfigForm | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchConfig = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<any>('/settings/guest-portal');
            const d = res.data;
            setConfig({
                welcomeMessage: d.welcomeMessage || '',
                wifiNetworks: Array.isArray(d.wifiNetworks) ? d.wifiNetworks : [],
                contactNumbers: Object.entries(d.contactNumbers || {}).map(([label, number]) => ({ label, number: String(number) })),
                customSections: Array.isArray(d.customSections) ? d.customSections : [],
                showBillBreakdown: d.showBillBreakdown !== false,
                showOrderProgress: d.showOrderProgress !== false,
            });
        } catch {
            setConfig({
                welcomeMessage: '',
                wifiNetworks: [],
                contactNumbers: [],
                customSections: [],
                showBillBreakdown: true,
                showOrderProgress: true,
            });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchConfig(); }, [fetchConfig]);

    const handleSave = async () => {
        if (!config) return;
        setIsSaving(true);
        try {
            const payload: Record<string, any> = {};
            payload.welcomeMessage = config.welcomeMessage;
            payload.wifiNetworks = config.wifiNetworks;
            payload.contactNumbers = config.contactNumbers.reduce((acc, c) => { if (c.label && c.number) acc[c.label] = c.number; return acc; }, {} as Record<string, string>);
            payload.customSections = config.customSections;
            payload.showBillBreakdown = config.showBillBreakdown;
            payload.showOrderProgress = config.showOrderProgress;
            await api.patch('/settings/guest-portal', payload);
            toast.success('Guest portal config saved');
        } catch {
            toast.error('Failed to save guest portal config');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !config) {
        return (
            <SettingsSection title="Guest Portal" icon={Globe}>
                <div style={{ color: 'var(--notion-text-secondary)' }}>Loading...</div>
            </SettingsSection>
        );
    }

    const update = (patch: Partial<PortalConfigForm>) => setConfig({ ...config, ...patch });

    return (
        <SettingsSection title="Guest Portal" icon={Globe}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Welcome Message</label>
                    <textarea
                        value={config.welcomeMessage}
                        onChange={e => update({ welcomeMessage: e.target.value })}
                        placeholder="Welcome to our hotel! We're delighted to have you."
                        rows={3}
                        style={{
                            width: '100%',
                            padding: '8px 12px',
                            backgroundColor: 'var(--notion-bg)',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '14px',
                            color: 'var(--notion-text)',
                            resize: 'vertical',
                        }}
                    />
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Wifi size={14} /> WiFi Networks
                        </label>
                        <Button size="sm" variant="secondary" onClick={() => update({ wifiNetworks: [...config.wifiNetworks, { floor: '', ssid: '', password: '' }] })}>
                            <Plus size={14} style={{ marginRight: '4px' }} /> Add
                        </Button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {config.wifiNetworks.map((net, i) => (
                            <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                <Input placeholder="Floor / Area" value={net.floor} onChange={e => { const n = [...config.wifiNetworks]; n[i] = { ...n[i], floor: e.target.value }; update({ wifiNetworks: n }); }} style={{ flex: 1 }} />
                                <Input placeholder="SSID" value={net.ssid} onChange={e => { const n = [...config.wifiNetworks]; n[i] = { ...n[i], ssid: e.target.value }; update({ wifiNetworks: n }); }} style={{ flex: 1 }} />
                                <Input placeholder="Password" value={net.password} onChange={e => { const n = [...config.wifiNetworks]; n[i] = { ...n[i], password: e.target.value }; update({ wifiNetworks: n }); }} style={{ flex: 1 }} />
                                <Button size="sm" variant="ghost" onClick={() => update({ wifiNetworks: config.wifiNetworks.filter((_, idx) => idx !== i) })} style={{ color: 'var(--notion-red)' }}>
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Phone size={14} /> Extra Contact Numbers
                        </label>
                        <Button size="sm" variant="secondary" onClick={() => update({ contactNumbers: [...config.contactNumbers, { label: '', number: '' }] })}>
                            <Plus size={14} style={{ marginRight: '4px' }} /> Add
                        </Button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {config.contactNumbers.map((c, i) => (
                            <div key={i} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                <Input placeholder="Label (e.g. Room Service)" value={c.label} onChange={e => { const n = [...config.contactNumbers]; n[i] = { ...n[i], label: e.target.value }; update({ contactNumbers: n }); }} style={{ flex: 1 }} />
                                <Input placeholder="Number" value={c.number} onChange={e => { const n = [...config.contactNumbers]; n[i] = { ...n[i], number: e.target.value }; update({ contactNumbers: n }); }} style={{ flex: 1 }} />
                                <Button size="sm" variant="ghost" onClick={() => update({ contactNumbers: config.contactNumbers.filter((_, idx) => idx !== i) })} style={{ color: 'var(--notion-red)' }}>
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Custom Sections</label>
                        <Button size="sm" variant="secondary" onClick={() => update({ customSections: [...config.customSections, { title: '', content: '' }] })}>
                            <Plus size={14} style={{ marginRight: '4px' }} /> Add
                        </Button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {config.customSections.map((sec, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                                    <Input placeholder="Section Title" value={sec.title} onChange={e => { const n = [...config.customSections]; n[i] = { ...n[i], title: e.target.value }; update({ customSections: n }); }} style={{ flex: 1 }} />
                                    <Button size="sm" variant="ghost" onClick={() => update({ customSections: config.customSections.filter((_, idx) => idx !== i) })} style={{ color: 'var(--notion-red)' }}>
                                        <Trash2 size={14} />
                                    </Button>
                                </div>
                                <textarea
                                    placeholder="Content..."
                                    value={sec.content}
                                    onChange={e => { const n = [...config.customSections]; n[i] = { ...n[i], content: e.target.value }; update({ customSections: n }); }}
                                    rows={3}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        border: '1px solid var(--notion-border)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: '14px',
                                        color: 'var(--notion-text)',
                                        resize: 'vertical',
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <ToggleSwitch enabled={config.showBillBreakdown} onToggle={() => update({ showBillBreakdown: !config.showBillBreakdown })} label="Show bill breakdown in guest portal" />
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <ToggleSwitch enabled={config.showOrderProgress} onToggle={() => update({ showOrderProgress: !config.showOrderProgress })} label="Show order/service progress in guest portal" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button onClick={handleSave} disabled={isSaving}>
                        <Save size={14} style={{ marginRight: '6px' }} />
                        {isSaving ? 'Saving...' : 'Save Guest Portal Config'}
                    </Button>
                </div>
            </div>
        </SettingsSection>
    );
}

// Section Card Component
interface KotPrinter {
    id: number;
    name: string;
    printerType?: string;
    ipAddress?: string | null;
    port?: number | null;
    station?: string | null;
    categories?: string[] | null;
    isDefault?: boolean;
    isActive?: boolean;
}

// KOT/BOT printer management — list, add, test and remove network printers.
function PrintersSection() {
    const [printers, setPrinters] = useState<KotPrinter[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', ipAddress: '', port: '9100', station: '', categories: '', isDefault: false });
    const [saving, setSaving] = useState(false);
    const [testingId, setTestingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<KotPrinter[]>('/orders/kot/printers');
            setPrinters(res.data || []);
        } catch {
            // section is optional; ignore load failure
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const addPrinter = async () => {
        if (!form.name.trim()) { toast.error('Printer name is required'); return; }
        setSaving(true);
        try {
            await api.post('/orders/kot/printers', {
                name: form.name.trim(),
                ipAddress: form.ipAddress.trim() || undefined,
                port: form.port ? Number(form.port) : 9100,
                station: form.station.trim() || undefined,
                categories: form.categories.split(',').map(c => c.trim()).filter(Boolean),
                isDefault: form.isDefault,
            });
            toast.success('Printer added');
            setForm({ name: '', ipAddress: '', port: '9100', station: '', categories: '', isDefault: false });
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to add printer');
        } finally {
            setSaving(false);
        }
    };

    const testPrinter = async (id: number) => {
        setTestingId(id);
        try {
            await api.post(`/orders/kot/printers/${id}/test`);
            toast.success('Test sent to printer');
        } catch (e: any) {
            toast.error(e?.message || 'Printer connection failed');
        } finally {
            setTestingId(null);
        }
    };

    const removePrinter = async (id: number) => {
        try {
            await api.delete(`/orders/kot/printers/${id}`);
            toast.success('Printer removed');
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to remove printer');
        }
    };

    const inputStyle = { width: '100%' } as const;

    return (
        <SettingsSection title="KOT / BOT Printers" icon={Printer}>
            {/* Add printer form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <Input placeholder="Printer Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <Input placeholder="Station / Title (e.g. Kitchen)" value={form.station} onChange={e => setForm({ ...form, station: e.target.value })} style={inputStyle} />
                <Input placeholder="IP Address (e.g. 192.168.1.50)" value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} style={inputStyle} />
                <Input placeholder="Port" value={form.port} onChange={e => setForm({ ...form, port: e.target.value })} style={inputStyle} />
                <Input placeholder="Categories (comma separated)" value={form.categories} onChange={e => setForm({ ...form, categories: e.target.value })} style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text-secondary)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={form.isDefault} onChange={e => setForm({ ...form, isDefault: e.target.checked })} style={{ accentColor: 'var(--notion-blue)' }} />
                    Default printer (catch-all)
                </label>
                <Button onClick={addPrinter} disabled={saving}><Plus size={14} style={{ marginRight: '6px' }} /> {saving ? 'Adding…' : 'Add Printer'}</Button>
            </div>

            {/* Printer list */}
            {loading ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>Loading printers…</div>
            ) : printers.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-muted)', fontSize: '13px', textAlign: 'center' }}>No printers configured yet.</div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Name</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>IP : Port</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Station</th>
                                <th style={{ textAlign: 'left', padding: '8px 12px' }}>Categories</th>
                                <th style={{ textAlign: 'right', padding: '8px 12px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {printers.map(p => (
                                <tr key={p.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text)', fontWeight: 500 }}>
                                        {p.name}{p.isDefault && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 600, color: 'var(--notion-blue)', background: 'var(--notion-blue-bg)', padding: '1px 6px', borderRadius: '4px' }}>DEFAULT</span>}
                                    </td>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', color: 'var(--notion-text-secondary)' }}>{p.ipAddress || '—'}{p.ipAddress ? `:${p.port ?? 9100}` : ''}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{p.station || '—'}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{(p.categories && p.categories.length) ? p.categories.join(', ') : 'All'}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                        <Button size="sm" variant="secondary" onClick={() => testPrinter(p.id)} disabled={testingId === p.id} style={{ marginRight: '6px' }}>{testingId === p.id ? 'Testing…' : 'Test'}</Button>
                                        <Button size="sm" variant="ghost" onClick={() => removePrinter(p.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SettingsSection>
    );
}

interface Coupon {
    id: number;
    code: string;
    description?: string | null;
    discountType: 'PERCENT' | 'FIXED';
    discountValue: string | number;
    maxDiscount?: string | number | null;
    minOrderAmount?: string | number | null;
    scope: 'ALL' | 'ROOM' | 'FNB';
    usageLimit?: number | null;
    usedCount?: number | null;
    validUntil?: string | null;
    isActive?: boolean;
}

const selectStyle: React.CSSProperties = {
    width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)',
    border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)',
    fontSize: '14px', outline: 'none', color: 'var(--notion-text)',
};

// Coupons / discounts management — create, toggle and remove promo codes.
function CouponsSection() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        code: '', description: '', discountType: 'PERCENT', discountValue: '', maxDiscount: '',
        minOrderAmount: '', scope: 'ALL', usageLimit: '', validUntil: '',
    });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<Coupon[]>('/coupons');
            setCoupons(res.data || []);
        } catch {
            // optional section
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const { sorted, sortField, sortDir, toggleSort } = useTableSort(
        coupons, 'code', 'asc',
        {
            discountValue: c => Number(c.discountValue),
            usedCount: c => Number(c.usedCount ?? 0),
            status: c => (c.isActive ? 1 : 0),
        }
    );

    const addCoupon = async () => {
        if (!form.code.trim()) { toast.error('Coupon code is required'); return; }
        if (!form.discountValue || Number(form.discountValue) <= 0) { toast.error('Enter a discount value'); return; }
        setSaving(true);
        try {
            await api.post('/coupons', {
                code: form.code.trim().toUpperCase(),
                description: form.description.trim() || undefined,
                discountType: form.discountType,
                discountValue: Number(form.discountValue),
                maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : 0,
                minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : 0,
                scope: form.scope,
                usageLimit: form.usageLimit ? Number(form.usageLimit) : 0,
                validUntil: form.validUntil || undefined,
            });
            toast.success('Coupon created');
            setForm({ code: '', description: '', discountType: 'PERCENT', discountValue: '', maxDiscount: '', minOrderAmount: '', scope: 'ALL', usageLimit: '', validUntil: '' });
            await load();
        } catch (e: any) {
            toast.error(e?.message || 'Failed to create coupon');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (c: Coupon) => {
        try {
            await api.patch(`/coupons/${c.id}`, { isActive: !c.isActive });
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed to update coupon'); }
    };

    const removeCoupon = async (id: number) => {
        try {
            await api.delete(`/coupons/${id}`);
            toast.success('Coupon removed');
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed to remove coupon'); }
    };

    return (
        <SettingsSection title="Coupons & Discounts" icon={DollarSign}>
            {/* Create form */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <Input placeholder="Code * (e.g. WELCOME10)" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
                <select value={form.discountType} onChange={e => setForm({ ...form, discountType: e.target.value })} style={selectStyle}>
                    <option value="PERCENT">Percent (%)</option>
                    <option value="FIXED">Fixed (Rs)</option>
                </select>
                <Input type="number" placeholder="Discount value *" value={form.discountValue} onChange={e => setForm({ ...form, discountValue: e.target.value })} />
                <select value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })} style={selectStyle}>
                    <option value="ALL">All</option>
                    <option value="ROOM">Room only</option>
                    <option value="FNB">F&B only</option>
                </select>
                <Input type="number" placeholder="Min order (optional)" value={form.minOrderAmount} onChange={e => setForm({ ...form, minOrderAmount: e.target.value })} />
                <Input type="number" placeholder="Max discount (% cap)" value={form.maxDiscount} onChange={e => setForm({ ...form, maxDiscount: e.target.value })} />
                <Input type="number" placeholder="Usage limit (0 = ∞)" value={form.usageLimit} onChange={e => setForm({ ...form, usageLimit: e.target.value })} />
                <DateField placeholder="Valid until" value={form.validUntil} onChange={(v) => setForm({ ...form, validUntil: v })} />
                <Input placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
                <Button onClick={addCoupon} disabled={saving}><Plus size={14} style={{ marginRight: '6px' }} /> {saving ? 'Adding…' : 'Add Coupon'}</Button>
            </div>

            {/* List */}
            {loading ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>Loading coupons…</div>
            ) : coupons.length === 0 ? (
                <div style={{ padding: '16px', color: 'var(--notion-text-muted)', fontSize: '13px', textAlign: 'center' }}>No coupons yet.</div>
            ) : (
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <SortableTh field="code" label="Code" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <SortableTh field="discountType" label="Type" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <SortableTh field="discountValue" label="Value" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                                <SortableTh field="scope" label="Scope" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <SortableTh field="usedCount" label="Used" sortField={sortField} sortDir={sortDir} onSort={toggleSort} align="right" />
                                <SortableTh field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                                <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 500 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sorted.map(c => (
                                <tr key={c.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--notion-text)' }}>{c.code}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{c.discountType}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text)' }}>{c.discountType === 'PERCENT' ? `${Number(c.discountValue)}%` : `Rs ${Number(c.discountValue)}`}</td>
                                    <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{c.scope}</td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text-secondary)' }}>{c.usedCount ?? 0}{(c.usageLimit ?? 0) > 0 ? `/${c.usageLimit}` : ''}</td>
                                    <td style={{ padding: '8px 12px' }}>
                                        <button onClick={() => toggleActive(c)} style={{ cursor: 'pointer', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: c.isActive ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)', color: c.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>
                                            {c.isActive ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                        <Button size="sm" variant="ghost" onClick={() => removeCoupon(c.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </SettingsSection>
    );
}

// Payment gateway / methods. Nepal rails only — no UPI (that's India).
const ALL_PAYMENT_METHODS: { value: string; label: string }[] = [
    { value: 'CASH', label: 'Cash' },
    { value: 'CARD', label: 'Card' },
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'ESEWA', label: 'eSewa' },
    { value: 'KHALTI', label: 'Khalti' },
    { value: 'CONNECT_IPS', label: 'ConnectIPS' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

// Digital methods that can carry a scan-to-pay QR (excludes Cash/Card).
const QR_METHODS: { value: string; label: string }[] = [
    { value: 'FONEPAY', label: 'Fonepay' },
    { value: 'ESEWA', label: 'eSewa' },
    { value: 'KHALTI', label: 'Khalti' },
    { value: 'CONNECT_IPS', label: 'ConnectIPS' },
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
];

function PaymentGatewaySection() {
    const [enabled, setEnabled] = useState<string[]>([]);
    const [fonepay, setFonepay] = useState({ merchantCode: '', secretKey: '', qrString: '', secretKeySet: false });
    const [paymentQr, setPaymentQr] = useState({ imageUrl: '', label: '' });
    const [paymentQrs, setPaymentQrs] = useState<Record<string, { imageUrl?: string; label?: string }>>({});
    const [cancellation, setCancellation] = useState({ enabled: false, type: 'FIXED', value: 0 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings/payment');
            setEnabled(res.data?.enabledMethods || []);
            setFonepay({
                merchantCode: res.data?.fonepay?.merchantCode || '',
                secretKey: '',
                secretKeySet: !!res.data?.fonepay?.secretKeySet,
                qrString: res.data?.fonepay?.qrString || '',
            });
            setPaymentQr({ imageUrl: res.data?.paymentQr?.imageUrl || '', label: res.data?.paymentQr?.label || '' });
            setPaymentQrs(res.data?.paymentQrs || {});
            const c = res.data?.cancellation || {};
            setCancellation({ enabled: !!c.enabled, type: c.type || 'FIXED', value: Number(c.value) || 0 });
        } catch {
            // optional
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const toggle = (method: string) => {
        setEnabled(prev => prev.includes(method) ? prev.filter(m => m !== method) : [...prev, method]);
    };

    const save = async () => {
        if (enabled.length === 0) { toast.error('Enable at least one payment method'); return; }
        setSaving(true);
        try {
            await api.patch('/settings/payment', { enabledMethods: enabled, fonepay, paymentQr, paymentQrs, cancellation });
            toast.success('Payment settings saved');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <SettingsSection title="Payment Methods" icon={DollarSign}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;

    return (
        <SettingsSection title="Payment Methods" icon={DollarSign}>
            <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>Methods enabled here appear at the POS and checkout.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {ALL_PAYMENT_METHODS.map(m => (
                    <label key={m.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--notion-text)', background: enabled.includes(m.value) ? 'var(--notion-blue-bg)' : 'var(--notion-bg)' }}>
                        <input type="checkbox" checked={enabled.includes(m.value)} onChange={() => toggle(m.value)} style={{ accentColor: 'var(--notion-blue)' }} />
                        {m.label}
                    </label>
                ))}
            </div>

            {enabled.includes('FONEPAY') && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Fonepay Configuration</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <Input placeholder="Merchant Code" value={fonepay.merchantCode} onChange={e => setFonepay({ ...fonepay, merchantCode: e.target.value })} />
                        <Input type="password" placeholder={(fonepay as any).secretKeySet ? '•••• (set — blank keeps it)' : 'Secret Key'} value={fonepay.secretKey} onChange={e => setFonepay({ ...fonepay, secretKey: e.target.value })} />
                        <Input placeholder="QR String / Merchant ID" value={fonepay.qrString} onChange={e => setFonepay({ ...fonepay, qrString: e.target.value })} style={{ gridColumn: '1 / -1' }} />
                    </div>
                </div>
            )}

            {/* Per-method scan-to-pay QRs — uploaded image shown at checkout for that method */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-1)' }}>Scan-to-Pay QR Codes</div>
                <p style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>Upload a QR image for each digital method you accept. The matching QR is shown to the guest during checkout.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
                    {QR_METHODS.filter(m => enabled.includes(m.value)).map(m => {
                        const qr = paymentQrs[m.value] || { imageUrl: '', label: '' };
                        return (
                            <div key={m.value} style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-2)', background: 'var(--notion-bg)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 6 }}>{m.label}</div>
                                <ImageUpload value={qr.imageUrl || null} onChange={(url) => setPaymentQrs(prev => ({ ...prev, [m.value]: { ...(prev[m.value] || {}), imageUrl: url || '' } }))} />
                                <Input placeholder="Label (optional)" value={qr.label || ''} onChange={e => setPaymentQrs(prev => ({ ...prev, [m.value]: { ...(prev[m.value] || {}), label: e.target.value } }))} style={{ marginTop: 6 }} />
                            </div>
                        );
                    })}
                    {QR_METHODS.filter(m => enabled.includes(m.value)).length === 0 && (
                        <div style={{ fontSize: 12, color: 'var(--notion-text-muted)' }}>Enable a digital method above (eSewa, Khalti, Fonepay, ConnectIPS, Bank) to upload its QR.</div>
                    )}
                </div>
            </div>

            {/* Cancellation policy */}
            <div style={{ padding: 'var(--space-3)', background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', cursor: 'pointer', marginBottom: 'var(--space-2)' }}>
                    <input type="checkbox" checked={cancellation.enabled} onChange={e => setCancellation({ ...cancellation, enabled: e.target.checked })} style={{ accentColor: 'var(--notion-blue)' }} />
                    Charge a cancellation fee
                </label>
                {cancellation.enabled && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                        <select value={cancellation.type} onChange={e => setCancellation({ ...cancellation, type: e.target.value })} style={selectStyle}>
                            <option value="FIXED">Fixed amount</option>
                            <option value="PERCENT">% of booking total</option>
                        </select>
                        <Input type="number" placeholder={cancellation.type === 'PERCENT' ? '% (e.g. 10)' : 'Amount'} value={cancellation.value} onChange={e => setCancellation({ ...cancellation, value: Number(e.target.value) })} />
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save Payment Methods'}</Button>
            </div>
        </SettingsSection>
    );
}

// Bill / receipt template configuration (invoice prefix, footer, terms + toggles).
function BillReceiptSection() {
    const [form, setForm] = useState({
        prefix: '', footerText: '', terms: '', headerNote: '', receiptFooter: '',
        showLogo: true, showTaxBreakdown: true, showQr: false,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings');
            const inv = res.data?.invoice || {};
            const cfg = inv.config || {};
            setForm({
                prefix: inv.prefix || '',
                footerText: inv.footerText || '',
                terms: inv.terms || '',
                headerNote: cfg.headerNote || '',
                receiptFooter: cfg.receiptFooter || '',
                showLogo: cfg.showLogo !== false,
                showTaxBreakdown: cfg.showTaxBreakdown !== false,
                showQr: cfg.showQr === true,
            });
        } catch {
            // optional
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/invoice', {
                prefix: form.prefix,
                footerText: form.footerText,
                terms: form.terms,
                config: {
                    headerNote: form.headerNote,
                    receiptFooter: form.receiptFooter,
                    showLogo: form.showLogo,
                    showTaxBreakdown: form.showTaxBreakdown,
                    showQr: form.showQr,
                },
            });
            toast.success('Bill/receipt template saved');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const taLabel = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;
    const taStyle: React.CSSProperties = {
        width: '100%', minHeight: '60px', padding: '8px 12px', backgroundColor: 'var(--notion-bg)',
        border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', color: 'var(--notion-text)',
        fontSize: '14px', fontFamily: 'inherit', resize: 'vertical',
    };

    if (loading) return <SettingsSection title="Bill / Receipt Template" icon={FileText}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;

    return (
        <SettingsSection title="Bill / Receipt Template" icon={FileText}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                    <label style={taLabel}>Invoice Prefix</label>
                    <Input value={form.prefix} onChange={e => setForm({ ...form, prefix: e.target.value })} placeholder="INV" />
                </div>
                <div>
                    <label style={taLabel}>Header Note (top of invoice)</label>
                    <Input value={form.headerNote} onChange={e => setForm({ ...form, headerNote: e.target.value })} placeholder="Tax Invoice" />
                </div>
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={taLabel}>Footer Text</label>
                <textarea value={form.footerText} onChange={e => setForm({ ...form, footerText: e.target.value })} style={taStyle} placeholder="Thank you for your stay!" />
            </div>
            <div style={{ marginBottom: 'var(--space-3)' }}>
                <label style={taLabel}>Terms &amp; Conditions</label>
                <textarea value={form.terms} onChange={e => setForm({ ...form, terms: e.target.value })} style={taStyle} placeholder="Payment due on receipt…" />
            </div>
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={taLabel}>Receipt Footer (thermal / POS)</label>
                <Input value={form.receiptFooter} onChange={e => setForm({ ...form, receiptFooter: e.target.value })} placeholder="Visit again!" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                <ToggleSwitch enabled={form.showLogo} onToggle={() => setForm({ ...form, showLogo: !form.showLogo })} label="Show hotel logo on invoice" />
                <ToggleSwitch enabled={form.showTaxBreakdown} onToggle={() => setForm({ ...form, showTaxBreakdown: !form.showTaxBreakdown })} label="Show tax / service charge breakdown" />
                <ToggleSwitch enabled={form.showQr} onToggle={() => setForm({ ...form, showQr: !form.showQr })} label="Show payment QR on receipt" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save Template'}</Button>
            </div>
        </SettingsSection>
    );
}

// Fiscal year + locale (Nepal BS fiscal year start, currency, timezone).
function FiscalYearSection() {
    const [form, setForm] = useState({ fiscalYearStart: '', currency: 'NPR', timezone: 'Asia/Kathmandu' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings');
            const r = res.data?.regional || {};
            setForm({
                fiscalYearStart: r.fiscalYearStart || '',
                currency: r.currency || 'NPR',
                timezone: r.timezone || 'Asia/Kathmandu',
            });
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/regional', form);
            toast.success('Fiscal year & locale saved');
        } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    if (loading) return <SettingsSection title="Fiscal Year & Locale" icon={Clock}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;
    const lbl = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;

    return (
        <SettingsSection title="Fiscal Year & Locale" icon={Clock}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                    <label style={lbl}>Fiscal Year Start</label>
                    <Input value={form.fiscalYearStart} onChange={e => setForm({ ...form, fiscalYearStart: e.target.value })} placeholder="Shrawan 1 (e.g. 07-16)" />
                </div>
                <div>
                    <label style={lbl}>Currency</label>
                    <Input value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} placeholder="NPR" />
                </div>
                <div>
                    <label style={lbl}>Timezone</label>
                    <Input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} placeholder="Asia/Kathmandu" />
                </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>Nepal fiscal year runs Shrawan→Ashad. Invoice numbering resets each fiscal year.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save'}</Button>
            </div>
        </SettingsSection>
    );
}

// Realtime push (Pusher) + PMS event-notification toggles.
function NotificationSettingsSection() {
    const [pusher, setPusher] = useState({ appKey: '', cluster: 'ap2' });
    const [events, setEvents] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('/settings/notifications');
            setPusher(res.data?.pusher || { appKey: '', cluster: 'ap2' });
            setEvents(res.data?.events || {});
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true);
        try {
            await api.patch('/settings/notifications', { pusher, events });
            toast.success('Notification settings saved');
        } catch (e: any) { toast.error(e?.message || 'Failed to save'); }
        finally { setSaving(false); }
    };

    const EVENTS: { key: string; label: string }[] = [
        { key: 'newBooking', label: 'New booking confirmed' },
        { key: 'checkout', label: 'Guest checkout / room ready' },
        { key: 'newOrder', label: 'New F&B order' },
        { key: 'orderReady', label: 'Order ready to serve' },
        { key: 'lowStock', label: 'Low stock alerts' },
        { key: 'housekeeping', label: 'Housekeeping requests' },
    ];

    if (loading) return <SettingsSection title="Notifications & Push" icon={Bell}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;
    const lbl = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;

    return (
        <SettingsSection title="Notifications & Push" icon={Bell}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <div>
                    <label style={lbl}>Pusher App Key</label>
                    <Input value={pusher.appKey} onChange={e => setPusher({ ...pusher, appKey: e.target.value })} placeholder="Realtime push key (optional)" />
                </div>
                <div>
                    <label style={lbl}>Pusher Cluster</label>
                    <Input value={pusher.cluster} onChange={e => setPusher({ ...pusher, cluster: e.target.value })} placeholder="ap2" />
                </div>
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Event notifications</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-4)' }}>
                {EVENTS.map(ev => (
                    <ToggleSwitch key={ev.key} enabled={events[ev.key] !== false} onToggle={() => setEvents({ ...events, [ev.key]: events[ev.key] === false })} label={ev.label} />
                ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button onClick={save} disabled={saving}><Save size={14} style={{ marginRight: '6px' }} /> {saving ? 'Saving…' : 'Save'}</Button>
            </div>
        </SettingsSection>
    );
}

interface MarketingTemplate { id: number; name: string; channel: 'SMS' | 'EMAIL'; subject?: string | null; body: string }

// SMS / Email marketing: reusable templates + send a campaign to a customer segment.
function MarketingSection() {
    const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
    const [loading, setLoading] = useState(true);
    const [tpl, setTpl] = useState({ name: '', channel: 'SMS', subject: '', body: '' });
    const [savingTpl, setSavingTpl] = useState(false);
    const [send, setSend] = useState({ channel: 'SMS', segment: 'ALL', templateId: '', body: '', subject: '' });
    const [recipientCount, setRecipientCount] = useState<number | null>(null);
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<MarketingTemplate[]>('/marketing/templates');
            setTemplates(res.data || []);
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // Live recipient preview when channel/segment changes.
    useEffect(() => {
        let cancelled = false;
        api.get<{ count: number }>(`/marketing/preview?channel=${send.channel}&segment=${send.segment}`)
            .then(r => { if (!cancelled) setRecipientCount(r.data?.count ?? 0); })
            .catch(() => { if (!cancelled) setRecipientCount(null); });
        return () => { cancelled = true; };
    }, [send.channel, send.segment]);

    const addTemplate = async () => {
        if (!tpl.name.trim() || !tpl.body.trim()) { toast.error('Name and body required'); return; }
        setSavingTpl(true);
        try {
            await api.post('/marketing/templates', { name: tpl.name, channel: tpl.channel, subject: tpl.subject || undefined, body: tpl.body });
            toast.success('Template saved');
            setTpl({ name: '', channel: 'SMS', subject: '', body: '' });
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSavingTpl(false); }
    };

    const delTemplate = async (id: number) => {
        try { await api.delete(`/marketing/templates/${id}`); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); }
    };

    const sendCampaign = async () => {
        if (!send.templateId && !send.body.trim()) { toast.error('Pick a template or type a message'); return; }
        setSending(true);
        try {
            const res = await api.post<{ total: number; queued?: boolean }>('/marketing/send', {
                channel: send.channel, segment: send.segment,
                templateId: send.templateId ? Number(send.templateId) : undefined,
                body: send.body || undefined,
                subject: send.subject || undefined,
            });
            const d = res.data;
            toast.success(`Campaign started — sending to ${d?.total ?? 0} recipient${(d?.total ?? 0) === 1 ? '' : 's'} in the background.`);
        } catch (e: any) { toast.error(e?.message || 'Failed to send'); } finally { setSending(false); }
    };

    if (loading) return <SettingsSection title="SMS & Email Marketing" icon={Bell}><div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div></SettingsSection>;
    const lbl = { fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' } as const;
    const ta: React.CSSProperties = { width: '100%', minHeight: '70px', padding: '8px 12px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', color: 'var(--notion-text)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' };

    return (
        <SettingsSection title="SMS & Email Marketing" icon={Bell}>
            {/* Templates */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Templates</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <Input placeholder="Template name" value={tpl.name} onChange={e => setTpl({ ...tpl, name: e.target.value })} />
                <select value={tpl.channel} onChange={e => setTpl({ ...tpl, channel: e.target.value })} style={selectStyle}>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                </select>
            </div>
            {tpl.channel === 'EMAIL' && <Input placeholder="Email subject" value={tpl.subject} onChange={e => setTpl({ ...tpl, subject: e.target.value })} style={{ marginBottom: 'var(--space-2)' }} />}
            <textarea placeholder="Message body — use {{name}} for the customer's name" value={tpl.body} onChange={e => setTpl({ ...tpl, body: e.target.value })} style={{ ...ta, marginBottom: 'var(--space-2)' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
                <Button onClick={addTemplate} disabled={savingTpl}><Plus size={14} style={{ marginRight: '6px' }} /> {savingTpl ? 'Saving…' : 'Save Template'}</Button>
            </div>
            {templates.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 'var(--space-5)' }}>
                    {templates.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                            <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>{t.channel}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--notion-text)' }}>{t.name}</span>
                            <span style={{ flex: 1, fontSize: '12px', color: 'var(--notion-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</span>
                            <Button size="sm" variant="ghost" onClick={() => delTemplate(t.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
                        </div>
                    ))}
                </div>
            )}

            {/* Send campaign */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--notion-divider)' }}>Send Campaign</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                <div><label style={lbl}>Channel</label>
                    <select value={send.channel} onChange={e => setSend({ ...send, channel: e.target.value, templateId: '' })} style={selectStyle}>
                        <option value="SMS">SMS</option><option value="EMAIL">Email</option>
                    </select>
                </div>
                <div><label style={lbl}>Audience</label>
                    <select value={send.segment} onChange={e => setSend({ ...send, segment: e.target.value })} style={selectStyle}>
                        <option value="ALL">All customers</option>
                        <option value="VIP">VIP only</option>
                        <option value="HOTEL_GUEST">Hotel guests</option>
                        <option value="RESTAURANT_CUSTOMER">Restaurant customers</option>
                    </select>
                </div>
                <div><label style={lbl}>Template</label>
                    <select value={send.templateId} onChange={e => setSend({ ...send, templateId: e.target.value })} style={selectStyle}>
                        <option value="">— custom message —</option>
                        {templates.filter(t => t.channel === send.channel).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            </div>
            {!send.templateId && (
                <>
                    {send.channel === 'EMAIL' && <Input placeholder="Email subject" value={send.subject} onChange={e => setSend({ ...send, subject: e.target.value })} style={{ marginBottom: 'var(--space-2)' }} />}
                    <textarea placeholder="Message — {{name}} supported" value={send.body} onChange={e => setSend({ ...send, body: e.target.value })} style={{ ...ta, marginBottom: 'var(--space-2)' }} />
                </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{recipientCount === null ? '' : `${recipientCount} recipient${recipientCount === 1 ? '' : 's'}`}</span>
                <Button onClick={sendCampaign} disabled={sending || recipientCount === 0}>{sending ? 'Sending…' : `Send ${send.channel}`}</Button>
            </div>
        </SettingsSection>
    );
}

// Hotel-specific guest-portal URL + downloadable QR (guests scan to open the portal).
function GuestPortalSection({ slug }: { slug?: string }) {
    const qrWrapRef = useRef<HTMLDivElement>(null);
    if (!slug) {
        return (
            <SettingsSection title="Guest Portal QR & Link" icon={QrCode}>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)' }}>Hotel identifier not available yet. Save your hotel profile first.</div>
            </SettingsSection>
        );
    }
    const portalUrl = `${window.location.origin}/guest?hotel=${encodeURIComponent(slug)}`;

    const copy = async () => {
        try { await navigator.clipboard.writeText(portalUrl); toast.success('Link copied'); }
        catch { toast.error('Copy failed'); }
    };
    const downloadQr = () => {
        const canvas = qrWrapRef.current?.querySelector('canvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `guest-portal-${slug}.png`;
        a.click();
    };

    return (
        <SettingsSection title="Guest Portal QR & Link" icon={QrCode}>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Print the QR for rooms/reception — guests scan it to open your portal, then sign in with room number + PIN.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div ref={qrWrapRef} style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                    <QRCodeCanvas value={portalUrl} size={160} level="M" includeMargin={false} />
                </div>
                <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Portal URL</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-3)' }}>
                        <Input value={portalUrl} readOnly fullWidth onFocus={e => e.target.select()} />
                        <Button variant="secondary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>Copy</Button>
                    </div>
                    <Button onClick={downloadQr}><QrCode size={14} style={{ marginRight: '6px' }} /> Download QR (PNG)</Button>
                    <p style={{ fontSize: '11px', color: 'var(--notion-text-muted)', marginTop: 'var(--space-3)' }}>
                        Tip: append <code>&amp;room=&lt;number&gt;</code> to pre-fill a specific room.
                    </p>
                </div>
            </div>
        </SettingsSection>
    );
}

// Public digital-menu URL + downloadable QR (no login — guests scan to view the menu).
function DigitalMenuSection({ slug }: { slug?: string }) {
    const qrWrapRef = useRef<HTMLDivElement>(null);
    if (!slug) {
        return (
            <SettingsSection title="Digital Menu QR & Link" icon={QrCode}>
                <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)' }}>Save your hotel profile first.</div>
            </SettingsSection>
        );
    }
    const menuUrl = `${window.location.origin}/menu?hotel=${encodeURIComponent(slug)}`;
    const copy = async () => { try { await navigator.clipboard.writeText(menuUrl); toast.success('Link copied'); } catch { toast.error('Copy failed'); } };
    const downloadQr = () => {
        const canvas = qrWrapRef.current?.querySelector('canvas');
        if (!canvas) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `digital-menu-${slug}.png`;
        a.click();
    };
    return (
        <SettingsSection title="Digital Menu QR & Link" icon={QrCode}>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Public, no-login menu. Put the QR on tables — guests scan to browse your live menu.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div ref={qrWrapRef} style={{ background: '#fff', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                    <QRCodeCanvas value={menuUrl} size={160} level="M" />
                </div>
                <div style={{ flex: 1, minWidth: '240px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>Menu URL</label>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: 'var(--space-3)' }}>
                        <Input value={menuUrl} readOnly fullWidth onFocus={e => e.target.select()} />
                        <Button variant="secondary" onClick={copy} style={{ whiteSpace: 'nowrap' }}>Copy</Button>
                    </div>
                    <Button onClick={downloadQr}><QrCode size={14} style={{ marginRight: '6px' }} /> Download QR (PNG)</Button>
                </div>
            </div>
        </SettingsSection>
    );
}

// Per-hotel SMS + Email provider credentials (drives all SMS/email sending).
function MessagingProvidersSection() {
    const [sms, setSms] = useState({ provider: '', senderId: '', apiKey: '', apiSecret: '' });
    const [email, setEmail] = useState({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpFromEmail: '', smtpFromName: '', smtpPassword: '' });
    const [flags, setFlags] = useState({ apiKeySet: false, apiSecretSet: false, smtpPasswordSet: false });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<any>('/settings/messaging').then(r => {
            const d = r.data; if (!d) return;
            setSms(s => ({ ...s, provider: d.sms?.provider || '', senderId: d.sms?.senderId || '' }));
            setEmail(e => ({ ...e, smtpHost: d.email?.smtpHost || '', smtpPort: d.email?.smtpPort || 587, smtpUser: d.email?.smtpUser || '', smtpFromEmail: d.email?.smtpFromEmail || '', smtpFromName: d.email?.smtpFromName || '' }));
            setFlags({ apiKeySet: !!d.sms?.apiKeySet, apiSecretSet: !!d.sms?.apiSecretSet, smtpPasswordSet: !!d.email?.smtpPasswordSet });
        }).catch(() => {});
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const payload: any = { sms: { provider: sms.provider, senderId: sms.senderId }, email: { smtpHost: email.smtpHost, smtpPort: email.smtpPort, smtpUser: email.smtpUser, smtpFromEmail: email.smtpFromEmail, smtpFromName: email.smtpFromName } };
            if (sms.apiKey) payload.sms.apiKey = sms.apiKey;
            if (sms.apiSecret) payload.sms.apiSecret = sms.apiSecret;
            if (email.smtpPassword) payload.email.smtpPassword = email.smtpPassword;
            await api.patch('/settings/messaging', payload);
            toast.success('Messaging providers saved');
            setSms(s => ({ ...s, apiKey: '', apiSecret: '' })); setEmail(e => ({ ...e, smtpPassword: '' }));
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    return (
        <SettingsSection title="SMS & Email Providers" icon={Bell}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>Connect your SMS and email accounts so booking confirmations, receipts and marketing messages are sent from your own hotel. Your SMS company and email provider give you these details.</p>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Text messages (SMS)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <select value={sms.provider} onChange={e => setSms({ ...sms, provider: e.target.value })} style={selectStyle}>
                    <option value="">Choose your SMS company…</option>
                    <option value="SPARROW">Sparrow SMS (Nepal)</option>
                    <option value="AAKASH">Aakash SMS (Nepal)</option>
                    <option value="TWILIO">Twilio</option>
                </select>
                <Input placeholder="Sender name shown to guests" value={sms.senderId} onChange={e => setSms({ ...sms, senderId: e.target.value })} />
                <Input type="password" placeholder={flags.apiKeySet ? '•••••••• (saved)' : 'Access key from your SMS company'} value={sms.apiKey} onChange={e => setSms({ ...sms, apiKey: e.target.value })} />
                <Input type="password" placeholder={flags.apiSecretSet ? '•••••••• (saved)' : 'Secret (Twilio only)'} value={sms.apiSecret} onChange={e => setSms({ ...sms, apiSecret: e.target.value })} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--notion-text)', margin: 'var(--space-3) 0 var(--space-2)' }}>Email</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <Input placeholder="Mail server (e.g. smtp.gmail.com)" value={email.smtpHost} onChange={e => setEmail({ ...email, smtpHost: e.target.value })} />
                <Input type="number" placeholder="Port (usually 587)" value={email.smtpPort} onChange={e => setEmail({ ...email, smtpPort: Number(e.target.value) })} />
                <Input placeholder="Email login / username" value={email.smtpUser} onChange={e => setEmail({ ...email, smtpUser: e.target.value })} />
                <Input type="password" placeholder={flags.smtpPasswordSet ? '•••••••• (saved)' : 'Email password'} value={email.smtpPassword} onChange={e => setEmail({ ...email, smtpPassword: e.target.value })} />
                <Input placeholder="Send emails from (address)" value={email.smtpFromEmail} onChange={e => setEmail({ ...email, smtpFromEmail: e.target.value })} />
                <Input placeholder="Sender name (your hotel)" value={email.smtpFromName} onChange={e => setEmail({ ...email, smtpFromName: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
        </SettingsSection>
    );
}

// AI engine (Gemini) — per-hotel key + toggle. Only shown when the plan enables it.
function AiSection() {
    const [available, setAvailable] = useState<boolean | null>(null);
    const [cfg, setCfg] = useState({ enabled: true, model: 'gemini-2.5-flash', apiKey: '' });
    const [keySet, setKeySet] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<any>('/saas/ai').then(r => {
            const d = r.data; setAvailable(!!d?.available);
            if (d?.available) { setCfg(c => ({ ...c, enabled: d.enabled !== false, model: d.model || 'gemini-2.0-flash' })); setKeySet(!!d.apiKeySet); }
        }).catch(() => setAvailable(false));
    }, []);

    if (available === null || !available) return null;

    const save = async () => {
        setSaving(true);
        try {
            const payload: any = { enabled: cfg.enabled, model: cfg.model };
            if (cfg.apiKey) payload.apiKey = cfg.apiKey;
            await api.patch('/saas/ai', payload);
            toast.success('AI settings saved');
            setCfg(c => ({ ...c, apiKey: '' })); setKeySet(k => k || !!payload.apiKey);
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    return (
        <SettingsSection title="AI Assistant" icon={Sparkles}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Turn on smart features: a chat that answers questions about your sales and occupancy, suggested replies to guest reviews, and an in-room assistant that helps guests order food and request service.
            </p>
            <div style={{ background: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: 12, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                You'll need a free Google AI key. Get one in a minute at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--notion-blue)' }}>aistudio.google.com</a>, then paste it below. Your hotel's data is only ever used to answer your own questions.
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} /> Turn on AI features
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-1)' }}>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Google AI key</label>
                    <Input type="password" placeholder={keySet ? '•••••••• (saved)' : 'Paste your key'} value={cfg.apiKey} onChange={e => setCfg({ ...cfg, apiKey: e.target.value })} />
                </div>
                <div>
                    <label style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'block', marginBottom: 4 }}>Speed / quality</label>
                    <select value={cfg.model} onChange={e => setCfg({ ...cfg, model: e.target.value })} style={selectStyle}>
                        <option value="gemini-2.5-flash">Balanced (recommended)</option>
                        <option value="gemini-2.5-flash-lite">Fastest & cheapest</option>
                        <option value="gemini-2.0-flash">Standard</option>
                        <option value="gemini-2.0-flash-lite">Standard lite</option>
                    </select>
                </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
        </SettingsSection>
    );
}

// IRD CBMS (Nepal) real-time billing sync — only shown when the plan enables it.
function CbmsSection() {
    const [available, setAvailable] = useState<boolean | null>(null);
    const [cfg, setCfg] = useState({ enabled: false, username: '', sellerPan: '', isRealtime: true, password: '' });
    const [passwordSet, setPasswordSet] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get<any>('/saas/cbms').then(r => {
            const d = r.data; setAvailable(!!d?.available);
            if (d?.available) { setCfg(c => ({ ...c, enabled: !!d.enabled, username: d.username || '', sellerPan: d.sellerPan || '', isRealtime: d.isRealtime ?? true })); setPasswordSet(!!d.passwordSet); }
        }).catch(() => setAvailable(false));
    }, []);

    if (available === null) return null;
    if (!available) return null; // plan doesn't include CBMS → hide entirely

    const save = async () => {
        setSaving(true);
        try {
            const payload: any = { enabled: cfg.enabled, username: cfg.username, sellerPan: cfg.sellerPan, isRealtime: cfg.isRealtime };
            if (cfg.password) payload.password = cfg.password;
            await api.patch('/saas/cbms', payload);
            toast.success('CBMS settings saved');
            setCfg(c => ({ ...c, password: '' })); setPasswordSet(p => p || !!payload.password);
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };

    return (
        <SettingsSection title="IRD CBMS (Real-time Billing Sync)" icon={Bell}>
            <p style={{ fontSize: 12, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>
                Auto-syncs every invoice + credit note to IRD's Central Billing Monitoring System. Use the IRD-issued username, password and seller PAN.
            </p>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 'var(--space-3)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />
                Enable CBMS sync
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                <Input label="IRD username" value={cfg.username} onChange={e => setCfg({ ...cfg, username: e.target.value })} />
                <Input label="IRD password" type="password" placeholder={passwordSet ? '•••• (set — blank keeps it)' : ''} value={cfg.password} onChange={e => setCfg({ ...cfg, password: e.target.value })} />
                <Input label="Seller PAN" value={cfg.sellerPan} onChange={e => setCfg({ ...cfg, sellerPan: e.target.value })} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, alignSelf: 'end', paddingBottom: 8, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cfg.isRealtime} onChange={e => setCfg({ ...cfg, isRealtime: e.target.checked })} />
                    Mark pushes as real-time
                </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save CBMS Settings'}</Button></div>
        </SettingsSection>
    );
}

interface ApiKey { id: number; name: string; keyPrefix: string; scopes: string[]; isActive: boolean; lastUsedAt?: string | null; createdAt?: string }

// Booking-engine API keys — generate keys for the hotel's website / partners.
function ApiKeysSection() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [name, setName] = useState('');
    const [canBook, setCanBook] = useState(false);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        try { const r = await api.get<ApiKey[]>('/api-keys'); setKeys(r.data || []); } catch { /* optional */ }
    }, []);
    useEffect(() => { load(); }, [load]);

    const create = async () => {
        if (!name.trim()) { toast.error('Name required'); return; }
        setBusy(true);
        try {
            const r = await api.post<{ key: string }>('/api-keys', { name: name.trim(), scopes: canBook ? ['read', 'book'] : ['read'] });
            setNewKey(r.data?.key || null);
            setName(''); setCanBook(false);
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setBusy(false); }
    };
    const revoke = async (id: number) => { try { await api.delete(`/api-keys/${id}`); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); } };

    return (
        <SettingsSection title="Website Booking Connection" icon={QrCode}>
            <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Create a secure key so your own website can show live room availability and take direct bookings. Give this key to whoever built your website — keep it private.
            </p>
            {newKey && (
                <div style={{ background: 'var(--notion-green-bg)', border: '1px solid var(--notion-green)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--notion-green)', marginBottom: 4 }}>Copy now — shown only once:</div>
                    <code style={{ fontSize: 12, wordBreak: 'break-all', color: 'var(--notion-text)' }}>{newKey}</code>
                    <div style={{ marginTop: 6 }}><Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(newKey); toast.success('Copied'); }}>Copy</Button> <Button size="sm" variant="ghost" onClick={() => setNewKey(null)}>Done</Button></div>
                </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <Input placeholder="Key name (e.g. Website)" value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--notion-text-secondary)' }}>
                    <input type="checkbox" checked={canBook} onChange={e => setCanBook(e.target.checked)} /> Allow booking
                </label>
                <Button onClick={create} disabled={busy}><Plus size={14} style={{ marginRight: 4 }} />Generate</Button>
            </div>
            {keys.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {keys.map(k => (
                        <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', opacity: k.isActive ? 1 : 0.5 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--notion-text)' }}>{k.name}</span>
                            <code style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>{k.keyPrefix}…</code>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>{(k.scopes || []).join(', ')}</span>
                            <span style={{ flex: 1 }} />
                            {k.isActive ? <Button size="sm" variant="ghost" onClick={() => revoke(k.id)} style={{ color: 'var(--notion-red)' }}>Revoke</Button> : <span style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>Revoked</span>}
                        </div>
                    ))}
                </div>
            )}
        </SettingsSection>
    );
}

interface Amenity { id: number; name: string; category: string; price: string | number; taxable: boolean; isActive: boolean }
const AMENITY_CATEGORIES = ['PARKING', 'EV_CHARGING', 'DAMAGE', 'LAUNDRY', 'SPA', 'MINIBAR', 'OTHER'];

// Extra-charge catalog (parking, EV charging, damages, laundry…) postable to a
// guest folio / POS bill.
function AmenitiesSection() {
    const [items, setItems] = useState<Amenity[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ name: '', category: 'PARKING', price: '', taxable: true });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<Amenity[]>('/amenities');
            setItems(res.data || []);
        } catch { /* optional */ } finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!form.name.trim() || form.price === '' || Number(form.price) < 0) { toast.error('Name and price required'); return; }
        setSaving(true);
        try {
            await api.post('/amenities', { name: form.name.trim(), category: form.category, price: Number(form.price), taxable: form.taxable });
            toast.success('Amenity added');
            setForm({ name: '', category: 'PARKING', price: '', taxable: true });
            await load();
        } catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };
    const toggle = async (a: Amenity) => { try { await api.patch(`/amenities/${a.id}`, { isActive: !a.isActive }); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); } };
    const del = async (id: number) => { try { await api.delete(`/amenities/${id}`); await load(); } catch (e: any) { toast.error(e?.message || 'Failed'); } };

    return (
        <SettingsSection title="Amenities & Extra Charges" icon={DollarSign}>
            <p style={{ fontSize: '12px', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-3)' }}>Damages, EV charging, parking, laundry, etc. Postable to a guest folio or POS bill.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr auto', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}>
                <Input placeholder="Name (e.g. Parking / fwd)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={selectStyle}>
                    {AMENITY_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
                </select>
                <Input type="number" placeholder="Price" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
                <Button onClick={add} disabled={saving}><Plus size={14} /></Button>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-4)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.taxable} onChange={e => setForm({ ...form, taxable: e.target.checked })} style={{ accentColor: 'var(--notion-blue)' }} /> Taxable
            </label>

            {loading ? <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Loading…</div>
                : items.length === 0 ? <div style={{ fontSize: '13px', color: 'var(--notion-text-muted)', textAlign: 'center', padding: '12px' }}>No amenities yet.</div>
                : (
                    <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead style={{ background: 'var(--notion-bg-tertiary)', color: 'var(--notion-text-secondary)' }}>
                                <tr>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Name</th>
                                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500 }}>Category</th>
                                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Price</th>
                                    <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 500 }}>Status</th>
                                    <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(a => (
                                    <tr key={a.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                        <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--notion-text)' }}>{a.name}</td>
                                        <td style={{ padding: '8px 12px', color: 'var(--notion-text-secondary)' }}>{a.category?.replace('_', ' ')}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--notion-text)' }}>Rs {Number(a.price).toFixed(2)}{a.taxable ? '' : ' (no tax)'}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                                            <button onClick={() => toggle(a)} style={{ cursor: 'pointer', border: 'none', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: 600, background: a.isActive ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)', color: a.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}>{a.isActive ? 'Active' : 'Inactive'}</button>
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                            <Button size="sm" variant="ghost" onClick={() => del(a.id)} style={{ color: 'var(--notion-red)' }}><Trash2 size={14} /></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
        </SettingsSection>
    );
}

function SettingsSection({ title, icon: Icon, children }: { title: string; icon: typeof Settings; children: React.ReactNode }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            marginBottom: 'var(--space-5)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
                paddingBottom: 'var(--space-4)',
                borderBottom: '1px solid var(--notion-divider)',
            }}>
                <Icon size={20} style={{ color: 'var(--notion-blue)' }} />
                <h2 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>{title}</h2>
            </div>
            {children}
        </div>
    );
}

// SaaS-admin: configure the support contacts shown to all hotels.
function SupportConfigSection() {
    const [cfg, setCfg] = useState({ email: '', phone: '', whatsapp: '', hours: '' });
    const [saving, setSaving] = useState(false);
    useEffect(() => { api.get<any>('/saas-admin/support').then(r => r.data && setCfg({ email: r.data.email || '', phone: r.data.phone || '', whatsapp: r.data.whatsapp || '', hours: r.data.hours || '' })).catch(() => {}); }, []);
    const save = async () => {
        setSaving(true);
        try { await api.patch('/saas-admin/support', cfg); toast.success('Support contacts saved'); }
        catch (e: any) { toast.error(e?.message || 'Failed'); } finally { setSaving(false); }
    };
    return (
        <SettingsSection title="Support Contacts" icon={Settings}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>Shown to all hotels in the in-app "Help" button.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)' }}>
                <Input placeholder="Support email" value={cfg.email} onChange={e => setCfg({ ...cfg, email: e.target.value })} />
                <Input placeholder="Phone" value={cfg.phone} onChange={e => setCfg({ ...cfg, phone: e.target.value })} />
                <Input placeholder="WhatsApp number (with country code)" value={cfg.whatsapp} onChange={e => setCfg({ ...cfg, whatsapp: e.target.value })} />
                <Input placeholder="Hours (e.g. Sun–Fri, 9am–6pm)" value={cfg.hours} onChange={e => setCfg({ ...cfg, hours: e.target.value })} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button></div>
        </SettingsSection>
    );
}

// SaaS-admin: database backups (manual + scheduled) with download links.
function BackupSection() {
    const [settings, setSettings] = useState<{ autoEnabled: boolean; frequency: string; lastRunAt: string | null; keep: number } | null>(null);
    const [backups, setBackups] = useState<{ filename: string; sizeBytes: number; createdAt: string; downloadUrl: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);

    const load = async () => {
        try { const r = await api.get<any>('/saas-admin/backups'); setSettings(r.data?.settings || null); setBackups(r.data?.backups || []); }
        catch (e: any) { toast.error(e?.message || 'Failed to load backups'); } finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const runNow = async () => {
        setRunning(true);
        try { const r = await api.post<any>('/saas-admin/backups', {}); toast.success('Backup created'); if (r.data?.downloadUrl) window.open(r.data.downloadUrl, '_blank'); await load(); }
        catch (e: any) { toast.error(e?.message || 'Backup failed'); } finally { setRunning(false); }
    };
    const saveSchedule = async (patch: any) => {
        try { const r = await api.patch<any>('/saas-admin/backups/settings', patch); setSettings(r.data); toast.success('Saved'); }
        catch (e: any) { toast.error(e?.message || 'Failed'); }
    };
    const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

    return (
        <SettingsSection title="Database Backups" icon={Settings}>
            <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                Create a compressed, restorable copy of all data. Only the latest {settings?.keep ?? 3} are kept to save space, and the download link works for 12 hours (also emailed to admins). To restore, download a backup and follow the restore guide — restoring is done manually for safety.
            </p>

            {settings && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' }}>
                        <input type="checkbox" checked={settings.autoEnabled} onChange={e => saveSchedule({ autoEnabled: e.target.checked })} /> Automatic backups
                    </label>
                    <select value={settings.frequency} disabled={!settings.autoEnabled} onChange={e => saveSchedule({ frequency: e.target.value })} style={selectStyle}>
                        <option value="DAILY">Every day</option>
                        <option value="WEEKLY">Every week</option>
                    </select>
                    <span style={{ fontSize: 12, color: 'var(--notion-text-muted)' }}>{settings.lastRunAt ? `Last: ${new Date(settings.lastRunAt).toLocaleString()}` : 'Never run'}</span>
                    <div style={{ marginLeft: 'auto' }}><Button onClick={runNow} disabled={running}>{running ? 'Backing up…' : 'Back up now'}</Button></div>
                </div>
            )}

            {loading ? <div style={{ fontSize: 13, color: 'var(--notion-text-muted)' }}>Loading…</div> : backups.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--notion-text-muted)', padding: 16, textAlign: 'center', border: '1px dashed var(--notion-border)', borderRadius: 8 }}>No backups yet.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backups.map(b => (
                        <div key={b.filename} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--notion-border)', borderRadius: 8, fontSize: 13 }}>
                            <span style={{ color: 'var(--notion-text)' }}>{new Date(b.createdAt).toLocaleString()} · <span style={{ color: 'var(--notion-text-muted)' }}>{mb(b.sizeBytes)}</span></span>
                            <a href={b.downloadUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--notion-blue)', fontWeight: 600 }}>Download</a>
                        </div>
                    ))}
                </div>
            )}
        </SettingsSection>
    );
}

// SaaS-admin: storage usage by table.
function DbStatsSection() {
    const [data, setData] = useState<{ totalBytes: number; tables: { table: string; size: string; bytes: number; estRows: number }[] } | null>(null);
    useEffect(() => { api.get<any>('/saas-admin/database-stats').then(r => setData(r.data)).catch(() => {}); }, []);
    if (!data) return null;
    const gb = (b: number) => b > 1073741824 ? `${(b / 1073741824).toFixed(2)} GB` : `${(b / 1048576).toFixed(1)} MB`;
    return (
        <SettingsSection title="Storage Usage" icon={Settings}>
            <div style={{ fontSize: 14, marginBottom: 'var(--space-3)', color: 'var(--notion-text)' }}>Total database size: <strong>{gb(data.totalBytes)}</strong></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.tables.slice(0, 10).map(t => (
                    <div key={t.table} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--notion-divider)' }}>
                        <span style={{ color: 'var(--notion-text)' }}>{t.table}</span>
                        <span style={{ color: 'var(--notion-text-secondary)' }}>{t.size} · {t.estRows.toLocaleString()} rows</span>
                    </div>
                ))}
            </div>
        </SettingsSection>
    );
}

export default function SettingsPage() {
    const { settings, isLoading, isSaving, error, successMessage, updateSettings, toggleFeature } = useSettings();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'finance' | 'messaging' | 'operations' | 'guest'>('general');

    const SETTINGS_TABS = [
        { id: 'general', label: 'General' },
        { id: 'finance', label: 'Payments & Finance' },
        { id: 'messaging', label: 'Notifications & Messaging' },
        { id: 'operations', label: 'Operations' },
        { id: 'guest', label: 'Guest & API' },
    ] as const;

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Please upload a PNG, JPG, SVG, or WebP image');
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const token = tokenStorage.getToken();
            const res = await fetch('/api/v1/storage/upload', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => null);
                throw new Error(errData?.message || 'Upload failed');
            }

            const data = await res.json();
            const logoUrl = data.data?.url || data.url;

            if (logoUrl) {
                await updateSettings({ logo: logoUrl });
                toast.success('Logo uploaded successfully');
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to upload logo');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        website: '',
        checkInTime: '14:00',
        checkOutTime: '11:00',
        taxRate: 13,
        serviceCharge: 10,
        panNumber: '',
        vatNumber: '',
        latitude: '',
        longitude: '',
    });
    const [formInitialized, setFormInitialized] = useState(false);

    // Sync form data when settings load from backend
    useEffect(() => {
        if (settings && !formInitialized) {
            setFormData({
                name: (settings as any).name || '',
                email: (settings as any).email || '',
                phone: (settings as any).phone || '',
                address: (settings as any).address || '',
                website: (settings as any).website || '',
                checkInTime: (settings as any).checkInTime || '14:00',
                checkOutTime: (settings as any).checkOutTime || '11:00',
                taxRate: (settings as any).taxRate ?? 13,
                serviceCharge: (settings as any).serviceCharge ?? 10,
                panNumber: (settings as any).panNumber || '',
                vatNumber: (settings as any).vatNumber || '',
                latitude: (settings as any).latitude || '',
                longitude: (settings as any).longitude || '',
            });
            setFormInitialized(true);
        }
    }, [settings, formInitialized]);

    const handleSave = async () => {
        await updateSettings(formData);
    };

    const { user } = useAuth();
    const isSuperAdmin = user?.userType === 'SUPER_ADMIN';

    if (isLoading) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', padding: 'var(--space-8)' }}>
                    <div style={{ color: 'var(--notion-text-secondary)' }}>Loading settings...</div>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <Settings size={28} />
                                {isSuperAdmin ? 'System Settings' : 'Settings'}
                            </h1>
                            <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                                {isSuperAdmin ? 'Configure global system preferences' : 'Configure your hotel settings and preferences'}
                            </p>
                        </div>

                        {!isSuperAdmin && (
                            <Button onClick={handleSave} disabled={isSaving}>
                                <Save size={14} style={{ marginRight: '6px' }} />
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        )}
                    </div>

                    {/* Success/Error Messages */}
                    {successMessage && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-3) var(--space-4)',
                            backgroundColor: 'var(--notion-green-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            color: 'var(--notion-green)',
                            fontSize: '14px',
                        }}>
                            <CheckCircle size={16} />
                            {successMessage}
                        </div>
                    )}

                    {error && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            padding: 'var(--space-3) var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            color: 'var(--notion-red)',
                            fontSize: '14px',
                        }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}

                    <div style={{ maxWidth: '800px' }}>
                        {isSuperAdmin ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                                <SupportConfigSection />
                                <BackupSection />
                                <DbStatsSection />
                            </div>
                        ) : (
                            <>
                                {/* Tab navigation */}
                                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--notion-border)', marginBottom: 'var(--space-5)', overflowX: 'auto' }}>
                                    {SETTINGS_TABS.map(tab => (
                                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                            style={{
                                                padding: '8px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                                                fontWeight: activeTab === tab.id ? 600 : 500, whiteSpace: 'nowrap',
                                                color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                                borderBottom: activeTab === tab.id ? '2px solid var(--notion-blue)' : '2px solid transparent',
                                            }}>{tab.label}</button>
                                    ))}
                                </div>

                                {activeTab === 'general' && (<>
                                {/* AI Assistant — shown first so the Gemini key is easy to find. */}
                                <AiSection />
                                {/* Hotel Information */}
                                <SettingsSection title="Hotel Information" icon={Building2}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Hotel Name *
                                            </label>
                                            <Input
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                placeholder="My Hotel"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Email *
                                            </label>
                                            <Input
                                                type="email"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="contact@hotel.com"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Phone
                                            </label>
                                            <Input
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                placeholder="+977-1-XXXXXXX"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Website
                                            </label>
                                            <Input
                                                value={formData.website}
                                                onChange={e => setFormData({ ...formData, website: e.target.value })}
                                                placeholder="https://hotel.com"
                                            />
                                        </div>
                                        <div style={{ gridColumn: 'span 2' }}>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Address
                                            </label>
                                            <Input
                                                value={formData.address}
                                                onChange={e => setFormData({ ...formData, address: e.target.value })}
                                                placeholder="Kathmandu, Nepal"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Latitude
                                            </label>
                                            <Input
                                                value={formData.latitude}
                                                onChange={e => setFormData({ ...formData, latitude: e.target.value })}
                                                placeholder="27.7172"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Longitude
                                            </label>
                                            <Input
                                                value={formData.longitude}
                                                onChange={e => setFormData({ ...formData, longitude: e.target.value })}
                                                placeholder="85.3240"
                                            />
                                        </div>
                                    </div>
                                </SettingsSection>

                                {/* Branding */}
                                <SettingsSection title="Branding" icon={Palette}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'var(--notion-bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px dashed var(--notion-border)',
                                        }}>
                                            {settings?.logo ? (
                                                <img src={settings.logo} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%' }} />
                                            ) : (
                                                <Upload size={24} style={{ color: 'var(--notion-text-muted)' }} />
                                            )}
                                        </div>
                                        <div>
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                                onChange={handleLogoUpload}
                                                style={{ display: 'none' }}
                                            />
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => fileInputRef.current?.click()}
                                                disabled={isUploading}
                                            >
                                                {isUploading ? (
                                                    <Loader2 size={14} style={{ marginRight: '6px', animation: 'spin 1s linear infinite' }} />
                                                ) : (
                                                    <Upload size={14} style={{ marginRight: '6px' }} />
                                                )}
                                                {isUploading ? 'Uploading...' : 'Upload Logo'}
                                            </Button>
                                            <p style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                                                Recommended: 200x200px, PNG or SVG
                                            </p>
                                        </div>
                                    </div>
                                </SettingsSection>

                                {/* Operating Hours */}
                                <SettingsSection title="Operating Hours" icon={Clock}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Check-in Time
                                            </label>
                                            <TimePicker value={formData.checkInTime} onChange={(v) => setFormData({ ...formData, checkInTime: v })} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Check-out Time
                                            </label>
                                            <TimePicker value={formData.checkOutTime} onChange={(v) => setFormData({ ...formData, checkOutTime: v })} />
                                        </div>
                                    </div>
                                </SettingsSection>

                                {/* Tax & Charges */}
                                <SettingsSection title="Tax & Charges" icon={DollarSign}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                VAT Rate (%)
                                            </label>
                                            <Input
                                                type="number"
                                                value={formData.taxRate}
                                                onChange={e => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                                                min={0}
                                                max={100}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Service Charge (%)
                                            </label>
                                            <Input
                                                type="number"
                                                value={formData.serviceCharge}
                                                onChange={e => setFormData({ ...formData, serviceCharge: Number(e.target.value) })}
                                                min={0}
                                                max={100}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                PAN Number
                                            </label>
                                            <Input
                                                value={formData.panNumber}
                                                onChange={e => setFormData({ ...formData, panNumber: e.target.value })}
                                                placeholder="Business PAN"
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                VAT Number
                                            </label>
                                            <Input
                                                value={formData.vatNumber}
                                                onChange={e => setFormData({ ...formData, vatNumber: e.target.value })}
                                                placeholder="VAT registration no."
                                            />
                                        </div>
                                    </div>
                                </SettingsSection>

                                {/* Feature Toggles */}
                                <SettingsSection title="Features" icon={ToggleRight}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        <ToggleSwitch
                                            enabled={settings?.enableHotel ?? true}
                                            onToggle={() => toggleFeature('enableHotel')}
                                            label="Hotel Module (Rooms, Bookings, Guests)"
                                        />
                                        <ToggleSwitch
                                            enabled={settings?.enableFoodAndBeverage ?? true}
                                            onToggle={() => toggleFeature('enableFoodAndBeverage')}
                                            label="Food & Beverage Module (Orders, Kitchen, POS)"
                                        />
                                        <ToggleSwitch
                                            enabled={settings?.enableGuestPortal ?? false}
                                            onToggle={() => toggleFeature('enableGuestPortal')}
                                            label="Guest QR Portal"
                                        />
                                        <ToggleSwitch
                                            enabled={(settings as any)?.enableFonepay ?? false}
                                            onToggle={() => toggleFeature('enableFonepay')}
                                            label="Fonepay Payments (Nepal QR gateway)"
                                        />

                                        <ToggleSwitch
                                            enabled={settings?.enableHousekeeping ?? false}
                                            onToggle={() => toggleFeature('enableHousekeeping')}
                                            label="Housekeeping Management"
                                        />
                                        <ToggleSwitch
                                            enabled={settings?.enableInventory ?? false}
                                            onToggle={() => toggleFeature('enableInventory')}
                                            label="Inventory Tracking"
                                        />
                                    </div>
                                </SettingsSection>

                                </>)}

                                {activeTab === 'operations' && (<>
                                    <GuestPortalConfigSection />
                                    <PrintersSection />
                                    <AmenitiesSection />
                                </>)}

                                {activeTab === 'finance' && (<>
                                    <PaymentGatewaySection />
                                    <CouponsSection />
                                    <BillReceiptSection />
                                    <FiscalYearSection />
                                    <CbmsSection />
                                </>)}

                                {activeTab === 'guest' && (<>
                                    <GuestPortalSection slug={(settings as any)?.slug} />
                                    <DigitalMenuSection slug={(settings as any)?.slug} />
                                    <ApiKeysSection />
                                </>)}

                                {activeTab === 'messaging' && (<>
                                    <NotificationSettingsSection />
                                    <MessagingProvidersSection />
                                    <MarketingSection />
                                    <SettingsSection title="Notification Toggles" icon={Bell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                            <ToggleSwitch
                                                enabled={settings?.emailNotifications ?? true}
                                                onToggle={() => updateSettings({ emailNotifications: !settings?.emailNotifications })}
                                                label="Email Notifications"
                                            />
                                            <ToggleSwitch
                                                enabled={settings?.smsNotifications ?? false}
                                                onToggle={() => updateSettings({ smsNotifications: !settings?.smsNotifications })}
                                                label="SMS Notifications"
                                            />
                                        </div>
                                    </SettingsSection>
                                </>)}
                            </>
                        )}
                    </div>
            </div>
        </DashboardLayout>
    );
}

