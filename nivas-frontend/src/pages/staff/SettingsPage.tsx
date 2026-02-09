'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useSettings } from '@/lib/hooks/useSettings';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    Settings,
    Building2,
    Palette,
    Receipt,
    Globe,
    FileText,
    Save
} from 'lucide-react';

const TABS = [
    { id: 'contact', label: 'Contact', icon: Building2 },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'tax', label: 'Tax & Charges', icon: Receipt },
    { id: 'invoice', label: 'Invoice', icon: FileText },
    { id: 'regional', label: 'Regional', icon: Globe },
];

export default function SettingsPage() {
    const { settings, isLoading, fetchSettings, updateContact, updateBranding, updateTax, updateInvoice, updateRegional } = useSettings();
    const [activeTab, setActiveTab] = useState('contact');
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        fetchSettings();
    }, []);

    useEffect(() => {
        if (settings) {
            // Initialize form data based on active tab
            switch (activeTab) {
                case 'contact':
                    setFormData(settings.contact || {});
                    break;
                case 'branding':
                    setFormData(settings.branding || {});
                    break;
                case 'tax':
                    setFormData(settings.tax || {});
                    break;
                case 'invoice':
                    setFormData(settings.invoice || {});
                    break;
                case 'regional':
                    setFormData(settings.regional || {});
                    break;
            }
        }
    }, [settings, activeTab]);

    const handleSave = async () => {
        let success = false;
        switch (activeTab) {
            case 'contact':
                success = await updateContact(formData);
                break;
            case 'branding':
                success = await updateBranding(formData);
                break;
            case 'tax':
                success = await updateTax(formData);
                break;
            case 'invoice':
                success = await updateInvoice(formData);
                break;
            case 'regional':
                success = await updateRegional(formData);
                break;
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    if (isLoading && !settings) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    Loading settings...
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                {/* Header */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <h1 style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        <Settings size={28} />
                        Settings
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: '4px' }}>
                        Manage hotel configuration and preferences
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--space-8)' }}>
                    {/* Sidebar Tabs */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '10px 12px',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                                    backgroundColor: activeTab === tab.id ? 'var(--notion-bg-secondary)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    transition: 'background-color 0.1s ease',
                                }}
                            >
                                <tab.icon size={18} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content Area */}
                    <div style={{
                        backgroundColor: 'var(--notion-bg)',
                        border: '1px solid var(--notion-border)',
                        borderRadius: 'var(--radius-lg)',
                        padding: 'var(--space-6)',
                    }}>
                        {activeTab === 'contact' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>Contact Information</h2>
                                <div>
                                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Hotel Address</label>
                                    <Input
                                        value={formData.address || ''}
                                        onChange={e => handleChange('address', e.target.value)}
                                        placeholder="123 Hotel St, City"
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Phone Number</label>
                                        <Input
                                            value={formData.phone || ''}
                                            onChange={e => handleChange('phone', e.target.value)}
                                            placeholder="+977-..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Email</label>
                                        <Input
                                            value={formData.email || ''}
                                            onChange={e => handleChange('email', e.target.value)}
                                            placeholder="info@hotel.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Website</label>
                                    <Input
                                        value={formData.website || ''}
                                        onChange={e => handleChange('website', e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'branding' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>Branding & Appearance</h2>
                                <div>
                                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Logo URL</label>
                                    <Input
                                        value={formData.logoUrl || ''}
                                        onChange={e => handleChange('logoUrl', e.target.value)}
                                        placeholder="https://..."
                                    />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Primary Color</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Input
                                                type="color"
                                                value={formData.primaryColor || '#000000'}
                                                onChange={e => handleChange('primaryColor', e.target.value)}
                                                style={{ width: '50px', padding: '2px' }}
                                            />
                                            <Input
                                                value={formData.primaryColor || ''}
                                                onChange={e => handleChange('primaryColor', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Secondary Color</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <Input
                                                type="color"
                                                value={formData.secondaryColor || '#ffffff'}
                                                onChange={e => handleChange('secondaryColor', e.target.value)}
                                                style={{ width: '50px', padding: '2px' }}
                                            />
                                            <Input
                                                value={formData.secondaryColor || ''}
                                                onChange={e => handleChange('secondaryColor', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tax' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>Tax & Service Charges</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">PAN Number</label>
                                        <Input
                                            value={formData.panNumber || ''}
                                            onChange={e => handleChange('panNumber', e.target.value)}
                                            placeholder="PAN..."
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">VAT Number</label>
                                        <Input
                                            value={formData.vatNumber || ''}
                                            onChange={e => handleChange('vatNumber', e.target.value)}
                                            placeholder="VAT..."
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Service Charge (%)</label>
                                        <Input
                                            type="number"
                                            value={formData.serviceChargeRate || 0}
                                            onChange={e => handleChange('serviceChargeRate', Number(e.target.value))}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Tax Rate (%)</label>
                                        <Input
                                            type="number"
                                            value={formData.taxRate || 0}
                                            onChange={e => handleChange('taxRate', Number(e.target.value))}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'invoice' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>Invoice Configuration</h2>
                                <div>
                                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Invoice Prefix</label>
                                    <Input
                                        value={formData.prefix || ''}
                                        onChange={e => handleChange('prefix', e.target.value)}
                                        placeholder="INV-"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Terms & Conditions</label>
                                    <textarea
                                        value={formData.terms || ''}
                                        onChange={e => handleChange('terms', e.target.value)}
                                        placeholder="Terms..."
                                        style={{
                                            width: '100%',
                                            minHeight: '100px',
                                            padding: '8px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            border: '1px solid var(--notion-border)',
                                            backgroundColor: 'rgba(255,255,255,0.03)',
                                            color: 'var(--notion-text)',
                                            fontSize: '14px',
                                            outline: 'none',
                                            resize: 'vertical'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Footer Text</label>
                                    <Input
                                        value={formData.footerText || ''}
                                        onChange={e => handleChange('footerText', e.target.value)}
                                        placeholder="Thank you for staying with us!"
                                    />
                                </div>
                            </div>
                        )}

                        {activeTab === 'regional' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: 'var(--space-2)' }}>Regional Settings</h2>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Currency</label>
                                        <Input
                                            value={formData.currency || ''}
                                            onChange={e => handleChange('currency', e.target.value)}
                                            placeholder="NPR"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-[var(--notion-text-secondary)] mb-1">Timezone</label>
                                        <Input
                                            value={formData.timezone || ''}
                                            onChange={e => handleChange('timezone', e.target.value)}
                                            placeholder="Asia/Kathmandu"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                                variant="primary"
                                onClick={handleSave}
                                loading={isLoading}
                                icon={<Save size={16} />}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}
