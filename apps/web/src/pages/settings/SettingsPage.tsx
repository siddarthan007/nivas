'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useSettings } from '@/lib/hooks/useSettings';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { tokenStorage } from '@/lib/api';
import { toast } from 'sonner';
import TimePicker from '@/components/ui/TimePicker';
import {
    Settings,
    Save,
    Building2,
    Palette,
    Clock,
    DollarSign,
    Bell,
    ToggleRight,
    CheckCircle,
    AlertCircle,
    Upload,
    Loader2,
} from 'lucide-react';
import { ToggleSwitch, SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import {
    GuestPortalConfigSection,
    PrintersSection,
    CouponsSection,
    PaymentGatewaySection,
    BillReceiptSection,
    FiscalYearSection,
    NotificationSettingsSection,
    MarketingSection,
    GuestPortalSection,
    DigitalMenuSection,
    MessagingProvidersSection,
    AiSection,
    CbmsSection,
    ApiKeysSection,
    AmenitiesSection,
    SupportConfigSection,
    BackupSection,
    DbStatsSection,
    BillingConfigSection,
} from '@/components/features/settings/sections';

export default function SettingsPage() {
    const { settings, isLoading, isSaving, error, successMessage, updateSettings } = useSettings();

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

    const { user, isLoading: authLoading } = useAuth();
    const isSuperAdmin = user?.userType === 'SUPER_ADMIN';

    if (authLoading || (isLoading && !isSuperAdmin)) {
        return (
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', padding: 'var(--space-8)' }}>
                    <div style={{ color: 'var(--notion-text-secondary)' }}>Loading settings...</div>
                </div>
        );
    }

    return (
                    <>
                    <style>{`
                        @media (max-width: 768px) {
                            .settings-two-col { grid-template-columns: 1fr !important; }
                        }
                    `}</style>
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
                                <BillingConfigSection />
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
                                    <div className="settings-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                                    <div className="settings-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
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
                                    <div className="settings-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                        <div>
                                            <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'block', marginBottom: '4px' }}>
                                                VAT Rate (%)
                                            </label>
                                            <Input
                                                type="number"
                                                value={formData.taxRate || ''}
                                                onChange={e => setFormData({ ...formData, taxRate: e.target.value === '' ? 0 : Number(e.target.value) })}
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
                                                value={formData.serviceCharge || ''}
                                                onChange={e => setFormData({ ...formData, serviceCharge: e.target.value === '' ? 0 : Number(e.target.value) })}
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

                                {/* Plan-managed modules — features are controlled by your subscription plan */}
                                <SettingsSection title="Modules & Features" icon={ToggleRight}>
                                    <p style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                                        Enabled modules are controlled by your subscription plan.
                                        Contact your administrator or upgrade to change what is available.
                                    </p>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 'var(--space-3)',
                                        padding: '6px 10px', borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-bg-tertiary)', fontSize: '12px',
                                        color: 'var(--notion-text-muted)', fontWeight: 500,
                                    }}>
                                        <ToggleRight size={14} style={{ opacity: 0.6 }} />
                                        Managed by plan
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 'var(--space-4)' }}>
                                        {[
                                            { on: settings?.enableHotel, label: 'Hotel (Rooms & Bookings)' },
                                            { on: settings?.enableFoodAndBeverage, label: 'Food & Beverage' },
                                            { on: settings?.enableGuestPortal, label: 'Guest Portal' },
                                            { on: settings?.enableHousekeeping, label: 'Housekeeping' },
                                            { on: settings?.enableInventory, label: 'Inventory' },
                                            { on: (settings as any)?.enableBanquets, label: 'Banquets & Events' },
                                            { on: (settings as any)?.enableFonepay, label: 'Fonepay' },
                                        ].map(item => (
                                            <span key={item.label} title="Managed by subscription plan" style={{
                                                padding: '6px 12px', borderRadius: 'var(--radius-full)', fontSize: '12px', fontWeight: 500,
                                                backgroundColor: item.on ? 'var(--notion-green-bg)' : 'var(--notion-bg-tertiary)',
                                                color: item.on ? 'var(--notion-green)' : 'var(--notion-text-muted)',
                                                border: '1px solid var(--notion-border)',
                                                cursor: 'not-allowed',
                                                opacity: item.on ? 1 : 0.75,
                                            }}>
                                                {item.label}
                                                <span style={{ display: 'block', fontSize: '10px', fontWeight: 400, marginTop: 2, opacity: 0.8 }}>
                                                    {item.on ? 'Included in plan' : 'Not in plan'}
                                                </span>
                                            </span>
                                        ))}
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
                    </>
    );
}

