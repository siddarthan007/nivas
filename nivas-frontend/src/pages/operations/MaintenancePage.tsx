'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { useMaintenance } from '@/lib/hooks/useMaintenance';
import { SkeletonList, SkeletonCard } from '@/components/ui/Skeleton';
import { Plus, Wrench, Package, AlertTriangle } from 'lucide-react';

export default function MaintenancePage() {
    const { assets, tickets, isLoading, createAsset, createTicket, updateTicketStatus } = useMaintenance();
    const [activeTab, setActiveTab] = useState('tickets');
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    
    // Forms state
    const [newTicket, setNewTicket] = useState({ title: '', description: '', priority: 'NORMAL', blockRoom: false });
    const [newAsset, setNewAsset] = useState({ name: '', category: 'FURNITURE', status: 'ACTIVE' });

    const handleCreateTicket = async (e: React.FormEvent) => {
        e.preventDefault();
        await createTicket(newTicket);
        setIsTicketModalOpen(false);
        setNewTicket({ title: '', description: '', priority: 'NORMAL', blockRoom: false });
    };

    const handleCreateAsset = async (e: React.FormEvent) => {
        e.preventDefault();
        await createAsset(newAsset);
        setIsAssetModalOpen(false);
        setNewAsset({ name: '', category: 'FURNITURE', status: 'ACTIVE' });
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            <Wrench size={28} />
                            Maintenance
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                            Manage maintenance tickets and hotel assets.
                        </p>
                    </div>
                    <div>
                        <Button onClick={() => activeTab === 'tickets' ? setIsTicketModalOpen(true) : setIsAssetModalOpen(true)}>
                            <Plus size={14} style={{ marginRight: '6px' }} />
                            {activeTab === 'tickets' ? 'New Ticket' : 'Add Asset'}
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 'var(--space-1)', borderBottom: '1px solid var(--notion-divider)', marginBottom: 'var(--space-6)' }}>
                    <button onClick={() => setActiveTab('tickets')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: '14px', fontWeight: activeTab === 'tickets' ? '600' : '400', color: activeTab === 'tickets' ? 'var(--notion-text)' : 'var(--notion-text-secondary)', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'tickets' ? '2px solid var(--notion-blue)' : '2px solid transparent', cursor: 'pointer' }}>
                        <AlertTriangle size={16} /> Tickets
                    </button>
                    <button onClick={() => setActiveTab('assets')} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)', fontSize: '14px', fontWeight: activeTab === 'assets' ? '600' : '400', color: activeTab === 'assets' ? 'var(--notion-text)' : 'var(--notion-text-secondary)', backgroundColor: 'transparent', border: 'none', borderBottom: activeTab === 'assets' ? '2px solid var(--notion-blue)' : '2px solid transparent', cursor: 'pointer' }}>
                        <Package size={16} /> Assets
                    </button>
                </div>

                {/* Tickets Tab */}
                {activeTab === 'tickets' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {isLoading ? <SkeletonList items={4} /> : tickets.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>No active maintenance tickets</div>
                        ) : tickets.map(ticket => (
                            <div key={ticket.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                <div>
                                    <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: 'var(--space-1)' }}>{ticket.title}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{ticket.description}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: ticket.priority === 'HIGH' ? 'var(--notion-red-bg)' : 'var(--notion-blue-bg)' }}>{ticket.priority}</span>
                                    <Select value={ticket.status} onChange={(e) => updateTicketStatus(ticket.id, e.target.value)} options={[
                                        { value: 'OPEN', label: 'Open' },
                                        { value: 'IN_PROGRESS', label: 'In Progress' },
                                        { value: 'RESOLVED', label: 'Resolved' }
                                    ]} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Assets Tab */}
                {activeTab === 'assets' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {isLoading ? <SkeletonCard /> : assets.length === 0 ? (
                            <div style={{ textAlign: 'center', gridColumn: '1 / -1', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>No assets found</div>
                        ) : assets.map(asset => (
                            <div key={asset.id} style={{ backgroundColor: 'var(--notion-bg-secondary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                                <div style={{ fontSize: '15px', fontWeight: '500', marginBottom: 'var(--space-2)' }}>{asset.name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>Category: {asset.category}</div>
                                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Status: <span style={{ color: asset.status === 'ACTIVE' ? 'var(--notion-green)' : 'var(--notion-red)' }}>{asset.status}</span></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modals */}
            <Modal isOpen={isTicketModalOpen} onClose={() => setIsTicketModalOpen(false)} title="New Maintenance Ticket">
                <form onSubmit={handleCreateTicket} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Title</label>
                        <Input value={newTicket.title} onChange={e => setNewTicket({...newTicket, title: e.target.value})} required />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Description</label>
                        <Input value={newTicket.description} onChange={e => setNewTicket({...newTicket, description: e.target.value})} required />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Priority</label>
                        <Select value={newTicket.priority} onChange={e => setNewTicket({...newTicket, priority: e.target.value})} options={[{value: 'LOW', label: 'Low'}, {value: 'NORMAL', label: 'Normal'}, {value: 'HIGH', label: 'High'}, {value: 'URGENT', label: 'Urgent'}]} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsTicketModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Create Ticket</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={isAssetModalOpen} onClose={() => setIsAssetModalOpen(false)} title="Add Asset">
                <form onSubmit={handleCreateAsset} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Name</label>
                        <Input value={newAsset.name} onChange={e => setNewAsset({...newAsset, name: e.target.value})} required />
                    </div>
                    <div>
                        <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>Category</label>
                        <Input value={newAsset.category} onChange={e => setNewAsset({...newAsset, category: e.target.value})} required />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsAssetModalOpen(false)}>Cancel</Button>
                        <Button type="submit">Add Asset</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout>
    );
}
