'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Save, Wifi, Phone, Plus, Trash2, Globe } from 'lucide-react';
import { ToggleSwitch, SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import type { PortalConfigForm } from '@/components/features/settings/types';

export function GuestPortalConfigSection() {
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
