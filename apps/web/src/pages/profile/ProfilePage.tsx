import { useEffect, useState, type FormEvent } from 'react';
import { UserCircle, Mail, Phone, Shield, Building2, KeyRound, Save, Loader2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ChangePasswordModal from '@/components/modals/ChangePasswordModal';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/contexts/AuthContext';

interface ProfileResponse {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    hotelId: number | null;
    userType: 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';
    isActive: boolean;
    role?: {
        id: number;
        name: string;
        permissions: string[];
    };
}

export default function ProfilePage() {
    const { user, refreshProfile, logout } = useAuth();
    const [loggingOutAll, setLoggingOutAll] = useState(false);
    const [profile, setProfile] = useState<ProfileResponse | null>(null);
    const [formData, setFormData] = useState({ fullName: '', phone: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showPasswordModal, setShowPasswordModal] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const response = await api.get<ProfileResponse>('/iam/profile');
                if (response.data) {
                    setProfile(response.data);
                    setFormData({
                        fullName: response.data.fullName,
                        phone: response.data.phone || '',
                    });
                }
            } catch (error) {
                const message = error instanceof ApiError ? error.message : 'Failed to load your profile';
                toast.error(message);
            } finally {
                setIsLoading(false);
            }
        };

        void loadProfile();
    }, []);

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        setIsSaving(true);

        try {
            const response = await api.put<ProfileResponse>('/iam/profile', formData);
            if (response.data) {
                setProfile(response.data);
                await refreshProfile();
                toast.success('Profile updated successfully');
            }
        } catch (error) {
            const message = error instanceof ApiError ? error.message : 'Failed to update your profile';
            toast.error(message);
        } finally {
            setIsSaving(false);
        }
    };

    const detailRows = [
        {
            label: 'Account type',
            value: profile?.userType === 'SUPER_ADMIN' ? 'Super Admin' : 'Hotel Staff',
            icon: <Shield size={16} />,
        },
        {
            label: 'Role',
            value: profile?.role?.name || user?.role?.name || 'Unassigned',
            icon: <UserCircle size={16} />,
        },
        {
            label: 'Hotel context',
            value: profile?.hotelId ? `Hotel #${profile.hotelId}` : 'Platform-wide access',
            icon: <Building2 size={16} />,
        },
    ];

    return (
        <DashboardLayout>
            <PageContainer
                title="Profile"
                icon={<UserCircle size={40} />}
                action={
                    <Button
                        variant="secondary"
                        icon={<KeyRound size={16} />}
                        onClick={() => setShowPasswordModal(true)}
                    >
                        Change Password
                    </Button>
                }
            >
                <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <Card variant="outline" hoverEffect={false} style={{ padding: 'var(--space-5)' }}>
                        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--notion-text)' }}>Your account</h2>
                                <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                                    Keep your profile accurate so notifications, approvals, and team context stay aligned.
                                </p>
                            </div>

                            {isLoading ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--notion-text-secondary)' }}>
                                    <Loader2 size={16} className="animate-spin" />
                                    Loading profile...
                                </div>
                            ) : (
                                <form onSubmit={handleSave} style={{ display: 'grid', gap: 'var(--space-4)' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                                        <Input
                                            label="Full name"
                                            value={formData.fullName}
                                            onChange={(event) => setFormData(prev => ({ ...prev, fullName: event.target.value }))}
                                            icon={<UserCircle size={14} />}
                                            required
                                        />
                                        <Input
                                            label="Phone"
                                            value={formData.phone}
                                            onChange={(event) => setFormData(prev => ({ ...prev, phone: event.target.value }))}
                                            icon={<Phone size={14} />}
                                            required
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
                                        <Input
                                            label="Email"
                                            value={profile?.email || ''}
                                            icon={<Mail size={14} />}
                                            disabled
                                        />
                                        <Input
                                            label="Status"
                                            value={profile?.isActive ? 'Active' : 'Inactive'}
                                            icon={<Shield size={14} />}
                                            disabled
                                        />
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <Button
                                            type="submit"
                                            variant="primary"
                                            icon={isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            disabled={isSaving || isLoading}
                                        >
                                            Save Changes
                                        </Button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </Card>

                    <Card variant="outline" hoverEffect={false} style={{ padding: 'var(--space-5)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--notion-text)' }}>Security</h2>
                                <p style={{ margin: '6px 0 0', fontSize: '14px', color: 'var(--notion-text-secondary)' }}>
                                    Sign out everywhere — invalidates every active session on all devices.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                icon={<LogOut size={16} />}
                                disabled={loggingOutAll}
                                onClick={async () => {
                                    if (!confirm('Sign out of all devices? You will need to log in again.')) return;
                                    setLoggingOutAll(true);
                                    try {
                                        await api.post('/iam/logout-all', {});
                                        toast.success('Signed out of all devices');
                                        logout();
                                    } catch (e: any) {
                                        toast.error(e?.message || 'Failed');
                                        setLoggingOutAll(false);
                                    }
                                }}
                                style={{ color: 'var(--notion-red)' }}
                            >
                                Log out all devices
                            </Button>
                        </div>
                    </Card>

                    <Card variant="outline" hoverEffect={false} style={{ padding: 'var(--space-5)' }}>
                        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--notion-text)' }}>Access summary</h2>
                            </div>

                            {detailRows.map((row) => (
                                <div
                                    key={row.label}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '12px',
                                        padding: '12px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--notion-text-secondary)' }}>
                                        {row.icon}
                                        <span style={{ fontSize: '13px' }}>{row.label}</span>
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--notion-text)' }}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </PageContainer>

            <ChangePasswordModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
            />
        </DashboardLayout>
    );
}