'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import { useChannelManager } from '@/lib/hooks/useChannelManager';
import { toast } from 'sonner';
import {
    Globe,
    RefreshCw,
    Plus,
    Settings,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Activity,
    Zap,
    Clock
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { CreateChannelPayload, ChannelConnection } from '@/lib/hooks/useChannelManager';

// Channel logos/colors
const CHANNEL_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
    BOOKING_COM: { name: 'Booking.com', color: '#003580', bgColor: '#e6f0ff' },
    EXPEDIA: { name: 'Expedia', color: '#ffc439', bgColor: '#fff9e6' },
    AGODA: { name: 'Agoda', color: '#5392f9', bgColor: '#e8f0fe' },
    AIRBNB: { name: 'Airbnb', color: '#ff5a5f', bgColor: '#ffe8e9' },
    MMT: { name: 'MakeMyTrip', color: '#245aab', bgColor: '#e8effa' },
    GOIBIBO: { name: 'Goibibo', color: '#ff6035', bgColor: '#ffece7' },
};

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'channels', label: 'Channels', icon: Globe },
        { id: 'logs', label: 'Sync Logs', icon: Activity }
    ];

    return (
        <div style={{
            display: 'flex',
            gap: '4px',
            backgroundColor: 'var(--notion-bg-secondary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 'var(--space-4)'
        }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: activeTab === tab.id ? 'var(--notion-bg)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer'
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Loading Skeleton
function LoadingCard() {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            animation: 'pulse 2s infinite'
        }}>
            <div style={{ height: '24px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', marginBottom: '12px', width: '50%' }} />
            <div style={{ height: '40px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', marginBottom: '12px' }} />
            <div style={{ height: '20px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', width: '70%' }} />
        </div>
    );
}

// Format date helper
const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
};

export default function ChannelManagerPage() {
    const { channels, logs, isLoading, error, refresh, syncInventory, syncRates, toggleChannel, deleteChannel, createChannel, updateChannel } = useChannelManager();
    const [activeTab, setActiveTab] = useState('channels');
    const [syncingId, setSyncingId] = useState<number | null>(null);

    // Modal State
    const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [editingChannel, setEditingChannel] = useState<ChannelConnection | null>(null);

    // Forms
    const [connectForm, setConnectForm] = useState<CreateChannelPayload>({
        channelCode: 'BOOKING_COM',
        channelName: '',
        apiKey: '',
        apiSecret: '',
        hotelCode: '',
        syncRates: true,
        syncAvailability: true,
        syncReservations: true
    });

    const [settingsForm, setSettingsForm] = useState<Partial<ChannelConnection>>({});

    const handleOpenConnect = () => {
        setConnectForm({
            channelCode: 'BOOKING_COM',
            channelName: '',
            apiKey: '',
            apiSecret: '',
            hotelCode: '',
            syncRates: true,
            syncAvailability: true,
            syncReservations: true
        });
        setIsConnectModalOpen(true);
    };

    const handleOpenSettings = (channel: ChannelConnection) => {
        setEditingChannel(channel);
        setSettingsForm({
            syncRates: channel.syncRates,
            syncAvailability: channel.syncAvailability,
            syncReservations: channel.syncReservations,
            rateMultiplier: channel.rateMultiplier || 1,
            minLeadTime: channel.minLeadTime || 0
        });
        setIsSettingsModalOpen(true);
    };

    const handleSubmitConnect = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { ...connectForm };
        if (!payload.channelName && payload.channelCode) {
            payload.channelName = CHANNEL_CONFIG[payload.channelCode]?.name || payload.channelCode;
        }
        const success = await createChannel(payload);
        if (success) setIsConnectModalOpen(false);
    };


    const handleSync = async (channelId: number, type: 'inventory' | 'rates') => {
        setSyncingId(channelId);
        try {
            if (type === 'inventory') {
                await syncInventory(channelId);
            } else {
                await syncRates(channelId);
            }
        } finally {
            setSyncingId(null);
        }
    };

    const handleToggle = async (id: number, currentStatus: boolean) => {
        await toggleChannel(id, !currentStatus);
    };

    const handleDisconnect = async (id: number) => {
        if (confirm('Are you sure you want to disconnect this channel?')) {
            await deleteChannel(id);
        }
    };

    const stats = {
        total: channels.length,
        connected: channels.filter(c => c.status === 'CONNECTED').length,
        syncing: channels.filter(c => c.isActive).length,
        errors: channels.filter(c => c.status === 'ERROR').length
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <Globe size={24} />
                                Channel Manager
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage OTA channel integrations and sync settings
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button variant="secondary" onClick={refresh} icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}>
                                Refresh
                            </Button>
                            <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenConnect}>
                                Connect Channel
                            </Button>
                        </div>
                    </div>

                    {/* Error State */}
                    {error && (
                        <div style={{
                            padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-red-bg)',
                            borderRadius: 'var(--radius-md)',
                            color: 'var(--notion-red)',
                            marginBottom: 'var(--space-4)'
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Tabs */}
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats.total}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Channels</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-green-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-green)' }}>{stats.connected}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-green)' }}>Connected</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-blue)' }}>{stats.syncing}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-blue)' }}>Active Sync</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: stats.errors > 0 ? 'var(--notion-red-bg)' : 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: stats.errors > 0 ? 'var(--notion-red)' : 'var(--notion-text)' }}>{stats.errors}</div>
                            <div style={{ fontSize: '13px', color: stats.errors > 0 ? 'var(--notion-red)' : 'var(--notion-text-secondary)' }}>Errors</div>
                        </div>
                    </div>

                    {/* Content */}
                    {activeTab === 'channels' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                            {isLoading ? (
                                <>
                                    <LoadingCard />
                                    <LoadingCard />
                                    <LoadingCard />
                                </>
                            ) : channels.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                                    No channels connected. Click "Connect Channel" to add an OTA integration.
                                </div>
                            ) : (
                                channels.map(channel => {
                                    const config = CHANNEL_CONFIG[channel.channelCode] || { name: channel.channelName, color: '#666', bgColor: '#f5f5f5' };
                                    const StatusIcon = channel.status === 'CONNECTED' ? CheckCircle2 : channel.status === 'ERROR' ? XCircle : AlertCircle;
                                    const statusColor = channel.status === 'CONNECTED' ? 'var(--notion-green)' : channel.status === 'ERROR' ? 'var(--notion-red)' : 'var(--notion-yellow)';

                                    return (
                                        <div key={channel.id} style={{
                                            backgroundColor: 'var(--notion-bg)',
                                            border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-lg)',
                                            padding: 'var(--space-4)',
                                            opacity: channel.isActive ? 1 : 0.6
                                        }}>
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                                    <div style={{
                                                        width: '36px', height: '36px',
                                                        borderRadius: 'var(--radius-md)',
                                                        backgroundColor: config.bgColor,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}>
                                                        <Globe size={18} style={{ color: config.color }} />
                                                    </div>
                                                    <div>
                                                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '600' }}>{config.name}</h3>
                                                        {channel.hotelCode && (
                                                            <span style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>ID: {channel.hotelCode}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <StatusIcon size={18} style={{ color: statusColor }} />
                                            </div>

                                            {/* Sync Settings */}
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                                                {channel.syncRates && <span style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-full)' }}>Rates</span>}
                                                {channel.syncAvailability && <span style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-full)' }}>Inventory</span>}
                                                {channel.syncReservations && <span style={{ padding: '2px 8px', fontSize: '11px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-full)' }}>Bookings</span>}
                                            </div>

                                            {/* Last Sync */}
                                            {channel.lastSyncAt && (
                                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Clock size={12} /> Last sync: {formatDate(channel.lastSyncAt)}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleSync(channel.id, 'inventory')}
                                                    disabled={syncingId === channel.id}
                                                    icon={syncingId === channel.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                                >
                                                    Sync
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleOpenSettings(channel)} icon={<Settings size={12} />}>
                                                    Settings
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleToggle(channel.id, channel.isActive)}
                                                    icon={<Zap size={12} />}
                                                    style={{ color: channel.isActive ? 'var(--notion-green)' : 'var(--notion-text-secondary)' }}
                                                >
                                                    {channel.isActive ? 'Active' : 'Paused'}
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        /* Logs Tab */
                        <div style={{ backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                            {isLoading ? (
                                <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto' }} />
                                </div>
                            ) : logs.length === 0 ? (
                                <div style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                    No sync logs available
                                </div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--notion-border)' }}>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Channel</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Action</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Status</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Message</th>
                                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: 'var(--notion-text-secondary)', textTransform: 'uppercase' }}>Time</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {logs.map(log => (
                                            <tr key={log.id} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>
                                                    {CHANNEL_CONFIG[log.channelCode]?.name || log.channelCode}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px' }}>{log.action}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{
                                                        padding: '4px 10px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        borderRadius: 'var(--radius-full)',
                                                        backgroundColor: log.status === 'SUCCESS' ? 'var(--notion-green-bg)' : log.status === 'PENDING' ? 'var(--notion-yellow-bg)' : 'var(--notion-red-bg)',
                                                        color: log.status === 'SUCCESS' ? 'var(--notion-green)' : log.status === 'PENDING' ? 'var(--notion-yellow)' : 'var(--notion-red)'
                                                    }}>
                                                        {log.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{log.message}</td>
                                                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--notion-text-secondary)' }}>{formatDate(log.createdAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </div>
            </PageContainer>

            {/* Connect Channel Modal */}
            <Modal
                isOpen={isConnectModalOpen}
                onClose={() => setIsConnectModalOpen(false)}
                title="Connect New Channel"
            >
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    // Auto-set channel name based on code if empty
                    const payload = { ...connectForm };
                    if (!payload.channelName && payload.channelCode) {
                        payload.channelName = CHANNEL_CONFIG[payload.channelCode]?.name || payload.channelCode;
                    }
                    const success = await createChannel(payload);
                    if (success) setIsConnectModalOpen(false);
                }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <Select
                        label="Channel"
                        value={connectForm.channelCode}
                        onChange={e => setConnectForm({ ...connectForm, channelCode: e.target.value as any })}
                    >
                        {Object.entries(CHANNEL_CONFIG).map(([code, config]) => (
                            <option key={code} value={code}>{config.name}</option>
                        ))}
                    </Select>
                    <Input
                        label="Hotel ID / Property Code"
                        value={connectForm.hotelCode || ''}
                        onChange={e => setConnectForm({ ...connectForm, hotelCode: e.target.value })}
                        required
                        placeholder="e.g. 12345"
                        hint="Provided by the OTA"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <Input
                            label="API Key"
                            type="password"
                            value={connectForm.apiKey || ''}
                            onChange={e => setConnectForm({ ...connectForm, apiKey: e.target.value })}
                            placeholder="Optional"
                        />
                        <Input
                            label="API Secret"
                            type="password"
                            value={connectForm.apiSecret || ''}
                            onChange={e => setConnectForm({ ...connectForm, apiSecret: e.target.value })}
                            placeholder="Optional"
                        />
                    </div>

                    <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ margin: '0 0 var(--space-2) 0', fontSize: '14px', fontWeight: '600' }}>Initial Sync Settings</h4>
                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <input
                                    type="checkbox"
                                    checked={connectForm.syncRates}
                                    onChange={e => setConnectForm({ ...connectForm, syncRates: e.target.checked })}
                                />
                                Sync Rates
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                                <input
                                    type="checkbox"
                                    checked={connectForm.syncAvailability}
                                    onChange={e => setConnectForm({ ...connectForm, syncAvailability: e.target.checked })}
                                />
                                Sync Availability
                            </label>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsConnectModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Connect</Button>
                    </div>
                </form>
            </Modal>

            {/* Channel Settings Modal */}
            <Modal
                isOpen={isSettingsModalOpen}
                onClose={() => setIsSettingsModalOpen(false)}
                title={`Configure ${editingChannel ? CHANNEL_CONFIG[editingChannel.channelCode]?.name : 'Channel'}`}
            >
                <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (editingChannel) {
                        const success = await updateChannel(editingChannel.id, settingsForm);
                        if (success) setIsSettingsModalOpen(false);
                    }
                }} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <Input
                            label="Rate Multiplier"
                            type="number"
                            step="0.01"
                            value={String(settingsForm.rateMultiplier || 1)}
                            onChange={e => setSettingsForm({ ...settingsForm, rateMultiplier: parseFloat(e.target.value) })}
                            hint="e.g. 1.15 to increase rates by 15%"
                        />
                        <Input
                            label="Min Lead Time (Hours)"
                            type="number"
                            value={String(settingsForm.minLeadTime || 0)}
                            onChange={e => setSettingsForm({ ...settingsForm, minLeadTime: parseInt(e.target.value) })}
                        />
                    </div>

                    <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <h4 style={{ margin: '0 0 var(--space-3) 0', fontSize: '14px', fontWeight: '600' }}>Sync Configuration</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <input
                                    type="checkbox"
                                    checked={settingsForm.syncRates}
                                    onChange={e => setSettingsForm({ ...settingsForm, syncRates: e.target.checked })}
                                />
                                <span style={{ fontWeight: '500' }}>Sync Rates</span>
                                <span style={{ color: 'var(--notion-text-secondary)', fontSize: '12px' }}> - Push price updates to channel</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <input
                                    type="checkbox"
                                    checked={settingsForm.syncAvailability}
                                    onChange={e => setSettingsForm({ ...settingsForm, syncAvailability: e.target.checked })}
                                />
                                <span style={{ fontWeight: '500' }}>Sync Availability</span>
                                <span style={{ color: 'var(--notion-text-secondary)', fontSize: '12px' }}> - Update room inventory</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                                <input
                                    type="checkbox"
                                    checked={settingsForm.syncReservations}
                                    onChange={e => setSettingsForm({ ...settingsForm, syncReservations: e.target.checked })}
                                />
                                <span style={{ fontWeight: '500' }}>Sync Reservations</span>
                                <span style={{ color: 'var(--notion-text-secondary)', fontSize: '12px' }}> - Import bookings automatically</span>
                            </label>
                        </div>
                    </div>

                    {editingChannel && (
                        <div style={{ marginTop: 'var(--space-2)' }}>
                            <Button
                                type="button"
                                variant="ghost"
                                style={{ color: 'var(--notion-red)', width: '100%', justifyContent: 'center' }}
                                onClick={() => {
                                    if (confirm('Are you sure you want to disconnect this channel? This action cannot be undone.')) {
                                        deleteChannel(editingChannel.id);
                                        setIsSettingsModalOpen(false);
                                    }
                                }}
                            >
                                Disconnect Channel
                            </Button>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsSettingsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">Save Configuration</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
