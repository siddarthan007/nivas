'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSettings } from '@/lib/hooks/useSettings';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { tokenStorage } from '@/lib/api';
import { toast } from 'sonner';
import {
    Settings,
    Save,
    Building2,
    Palette,
    Clock,
    DollarSign,
    Bell,
    ToggleLeft,
    ToggleRight,
    CheckCircle,
    AlertCircle,
    Upload,
    Loader2,
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

// Section Card Component
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

export default function SettingsPage() {
    const { settings, isLoading, isSaving, error, successMessage, updateSettings, toggleFeature } = useSettings();

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

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
            const res = await fetch('/api/v1/upload/upload', {
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
                            <SettingsSection title="Global Configuration" icon={Settings}>
                                <div style={{ color: 'var(--notion-text)', fontSize: '14px' }}>
                                    <p style={{ marginBottom: '1rem' }}>Global system settings are managed via environment variables and deployment configuration.</p>

                                    <div style={{
                                        padding: 'var(--space-4)',
                                        backgroundColor: 'var(--notion-bg-tertiary)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--notion-border)'
                                    }}>
                                        <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Platform Information</h3>
                                        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '0.5rem', fontSize: '13px' }}>
                                            <span style={{ color: 'var(--notion-text-secondary)' }}>Version:</span>
                                            <span>1.0.0</span>
                                            <span style={{ color: 'var(--notion-text-secondary)' }}>Environment:</span>
                                            <span>Production</span>
                                            <span style={{ color: 'var(--notion-text-secondary)' }}>API Endpoint:</span>
                                            <span>/api/v1</span>
                                        </div>
                                    </div>
                                </div>
                            </SettingsSection>
                        ) : (
                            <>
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
                                            <Input
                                                type="time"
                                                value={formData.checkInTime}
                                                onChange={e => setFormData({ ...formData, checkInTime: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                Check-out Time
                                            </label>
                                            <Input
                                                type="time"
                                                value={formData.checkOutTime}
                                                onChange={e => setFormData({ ...formData, checkOutTime: e.target.value })}
                                            />
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
                                    </div>
                                </SettingsSection>

                                {/* Feature Toggles */}
                                <SettingsSection title="Features" icon={ToggleRight}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                        <ToggleSwitch
                                            enabled={settings?.enableGuestPortal ?? false}
                                            onToggle={() => toggleFeature('enableGuestPortal')}
                                            label="Guest QR Portal"
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

                                {/* Notifications */}
                                <SettingsSection title="Notifications" icon={Bell}>
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
                            </>
                        )}
                    </div>
            </div>
        </DashboardLayout>
    );
}

