'use client';

import { useState, useEffect } from 'react';
import {
    useCRM,
    type Guest,
    type GuestHistory,
    type Company,
    type TravelAgent,
    type CreateCompanyPayload,
    type CreateAgentPayload,
    type UpdateCompanyPayload,
    type UpdateAgentPayload,
} from '@/lib/hooks/useCRM';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Pagination from '@/components/ui/Pagination';
import {
    Users,
    Building2,
    Briefcase,
    Search,
    Plus,
    RefreshCw,
    Star,
    History,
    Mail,
    Phone,
    Pencil,
    Trash2,
    Calendar,
    IndianRupee,
    AlertTriangle,
    Loader2,
} from 'lucide-react';

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'guests', label: 'Guests', icon: Users },
        { id: 'companies', label: 'Corporate', icon: Building2 },
        { id: 'agents', label: 'Agents', icon: Briefcase },
    ];

    return (
        <div style={{
            display: 'flex',
            gap: 'var(--space-1)',
            borderBottom: '1px solid var(--notion-divider)',
            marginBottom: 'var(--space-6)',
        }}>
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--space-2)',
                        padding: 'var(--space-3) var(--space-4)',
                        fontSize: '14px',
                        fontWeight: activeTab === tab.id ? '600' : '400',
                        color: activeTab === tab.id ? 'var(--notion-text)' : 'var(--notion-text-secondary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === tab.id ? '2px solid var(--notion-blue)' : '2px solid transparent',
                        cursor: 'pointer',
                    }}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

// Guest Card
function GuestCard({ guest, onViewHistory, onToggleVip }: { guest: Guest; onViewHistory: () => void; onToggleVip: () => void }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--notion-blue-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--notion-blue)',
                    }}>
                        {(guest.firstName?.[0] || guest.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                            {guest.firstName} {guest.lastName}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                            {guest.email}
                        </div>
                    </div>
                </div>
                {guest.isVip && (
                    <Star size={16} fill="var(--notion-yellow)" color="var(--notion-yellow)" />
                )}
            </div>

            {guest.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-2)' }}>
                    <Phone size={12} />
                    {guest.phone}
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                <span>{guest.stays || 0} stays</span>
                <span>₹{(guest.totalSpend || 0).toLocaleString()} total</span>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button size="sm" variant="secondary" onClick={onViewHistory}>
                    <History size={12} style={{ marginRight: '4px' }} />
                    History
                </Button>
                <Button size="sm" variant="secondary" onClick={onToggleVip}>
                    <Star size={12} style={{ marginRight: '4px' }} />
                    {guest.isVip ? 'Remove VIP' : 'Make VIP'}
                </Button>
            </div>
        </div>
    );
}

// Company Card
function CompanyCard({ company, onEdit, onDelete }: { company: Company; onEdit: () => void; onDelete: () => void }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                    {company.companyName}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                        onClick={onEdit}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                            color: 'var(--notion-text-secondary)', borderRadius: 'var(--radius-sm)',
                        }}
                        title="Edit company"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={onDelete}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                            color: 'var(--notion-text-secondary)', borderRadius: 'var(--radius-sm)',
                        }}
                        title="Delete company"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {company.contactPerson && (
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    Contact: {company.contactPerson}
                </div>
            )}
            {company.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    <Mail size={12} />
                    {company.email}
                </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', fontSize: '12px' }}>
                {company.discountPercentage && (
                    <span style={{ color: 'var(--notion-green)' }}>{company.discountPercentage}% discount</span>
                )}
                {company.creditLimit && (
                    <span style={{ color: 'var(--notion-blue)' }}>₹{(company.creditLimit || 0).toLocaleString()} limit</span>
                )}
            </div>
        </div>
    );
}

// Agent Card
function AgentCard({ agent, onEdit, onDelete }: { agent: TravelAgent; onEdit: () => void; onDelete: () => void }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>
                    {agent.name}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                        onClick={onEdit}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                            color: 'var(--notion-text-secondary)', borderRadius: 'var(--radius-sm)',
                        }}
                        title="Edit agent"
                    >
                        <Pencil size={14} />
                    </button>
                    <button
                        onClick={onDelete}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                            color: 'var(--notion-text-secondary)', borderRadius: 'var(--radius-sm)',
                        }}
                        title="Delete agent"
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
            {agent.agencyName && (
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    {agent.agencyName}
                </div>
            )}
            {agent.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                    <Mail size={12} />
                    {agent.email}
                </div>
            )}
            <div style={{ marginTop: 'var(--space-3)', fontSize: '14px', fontWeight: '500', color: 'var(--notion-orange)' }}>
                {((agent.commissionRate || 0) * 100).toFixed(0)}% commission
            </div>
        </div>
    );
}

// Create Company Modal
function CreateCompanyModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateCompanyPayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateCompanyPayload>({ companyName: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ companyName: '' });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Corporate Account">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                    value={formData.companyName}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Company Name *"
                    required
                />
                <Input
                    value={formData.contactPerson || ''}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Contact Person"
                />
                <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                />
                <Input
                    type="number"
                    value={formData.discountPercentage || ''}
                    onChange={e => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || undefined })}
                    placeholder="Discount %"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.companyName.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Create Agent Modal
function CreateAgentModal({ isOpen, onClose, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateAgentPayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<CreateAgentPayload>({ name: '', commissionRate: 0.1 });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        const success = await onSubmit(formData);
        setIsSubmitting(false);
        if (success) {
            setFormData({ name: '', commissionRate: 0.1 });
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add Travel Agent">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Agent Name *"
                    required
                />
                <Input
                    value={formData.agencyName || ''}
                    onChange={e => setFormData({ ...formData, agencyName: e.target.value })}
                    placeholder="Agency Name"
                />
                <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                />
                <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.commissionRate}
                    onChange={e => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                    placeholder="Commission Rate (0.10 = 10%)"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Guest History Modal
function GuestHistoryModal({ isOpen, onClose, guest, onFetchHistory }: {
    isOpen: boolean;
    onClose: () => void;
    guest: Guest | null;
    onFetchHistory: (guestId: string) => Promise<GuestHistory | null>;
}) {
    const [history, setHistory] = useState<GuestHistory | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        if (isOpen && guest) {
            setIsLoadingHistory(true);
            onFetchHistory(guest.id).then(data => {
                setHistory(data);
                setIsLoadingHistory(false);
            });
        }
        if (!isOpen) {
            setHistory(null);
        }
    }, [isOpen, guest, onFetchHistory]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Stay History — ${guest?.firstName || ''} ${guest?.lastName || ''}`} size="lg">
            <div style={{ minHeight: '200px' }}>
                {isLoadingHistory ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                        <Loader2 size={20} style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }} />
                        Loading history...
                    </div>
                ) : !history ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                        No history data available
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        <div style={{
                            display: 'flex', gap: 'var(--space-6)', padding: 'var(--space-4)',
                            backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--notion-border)',
                        }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                    {history.bookings?.length || 0}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Bookings</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>
                                    {history.orders?.length || 0}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Orders</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-green)' }}>
                                    ₹{(history.totalSpend || 0).toLocaleString()}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Total Spend</div>
                            </div>
                        </div>

                        {history.bookings && history.bookings.length > 0 && (
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                                    Bookings
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {history.bookings.map((booking: any, idx: number) => (
                                        <div key={booking.id || idx} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg)',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <Calendar size={14} style={{ color: 'var(--notion-blue)' }} />
                                                <div>
                                                    <div style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                                        Room {booking.roomNumber || booking.roomId || '—'}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                        {booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : '—'}
                                                        {' → '}
                                                        {booking.checkOut ? new Date(booking.checkOut).toLocaleDateString() : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <span style={{
                                                    fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                                                    backgroundColor: booking.status === 'checked_out' ? 'var(--notion-bg-tertiary)' :
                                                        booking.status === 'confirmed' ? 'var(--notion-blue-bg)' :
                                                        'var(--notion-green-bg)',
                                                    color: booking.status === 'checked_out' ? 'var(--notion-text-secondary)' :
                                                        booking.status === 'confirmed' ? 'var(--notion-blue)' :
                                                        'var(--notion-green)',
                                                }}>
                                                    {booking.status || 'unknown'}
                                                </span>
                                                <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                                    ₹{(booking.totalAmount || 0).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {history.orders && history.orders.length > 0 && (
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-3)' }}>
                                    Orders
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    {history.orders.map((order: any, idx: number) => (
                                        <div key={order.id || idx} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg)',
                                            borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                                <IndianRupee size={14} style={{ color: 'var(--notion-orange)' }} />
                                                <div>
                                                    <div style={{ fontSize: '13px', color: 'var(--notion-text)' }}>
                                                        {order.orderType || order.type || 'Order'}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '—'}
                                                    </div>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                                ₹{(order.totalAmount || order.amount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(!history.bookings || history.bookings.length === 0) && (!history.orders || history.orders.length === 0) && (
                            <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--notion-text-secondary)' }}>
                                No stay history recorded yet
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
}

// Edit Company Modal
function EditCompanyModal({ isOpen, onClose, company, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    company: Company | null;
    onSubmit: (id: number, data: UpdateCompanyPayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<UpdateCompanyPayload>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (company) {
            setFormData({
                companyName: company.companyName,
                contactPerson: company.contactPerson || '',
                email: company.email || '',
                phone: company.phone || '',
                discountPercentage: company.discountPercentage,
                creditLimit: company.creditLimit,
                contractRate: company.contractRate,
            });
        }
    }, [company]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company) return;
        setIsSubmitting(true);
        const success = await onSubmit(company.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Corporate Account">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                    value={formData.companyName || ''}
                    onChange={e => setFormData({ ...formData, companyName: e.target.value })}
                    placeholder="Company Name *"
                    required
                />
                <Input
                    value={formData.contactPerson || ''}
                    onChange={e => setFormData({ ...formData, contactPerson: e.target.value })}
                    placeholder="Contact Person"
                />
                <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                />
                <Input
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone"
                />
                <Input
                    type="number"
                    value={formData.discountPercentage ?? ''}
                    onChange={e => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || undefined })}
                    placeholder="Discount %"
                />
                <Input
                    type="number"
                    value={formData.creditLimit ?? ''}
                    onChange={e => setFormData({ ...formData, creditLimit: parseFloat(e.target.value) || undefined })}
                    placeholder="Credit Limit"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.companyName?.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Edit Agent Modal
function EditAgentModal({ isOpen, onClose, agent, onSubmit }: {
    isOpen: boolean;
    onClose: () => void;
    agent: TravelAgent | null;
    onSubmit: (id: number, data: UpdateAgentPayload) => Promise<boolean>;
}) {
    const [formData, setFormData] = useState<UpdateAgentPayload>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (agent) {
            setFormData({
                name: agent.name,
                agencyName: agent.agencyName || '',
                email: agent.email || '',
                phone: agent.phone || '',
                commissionRate: agent.commissionRate,
            });
        }
    }, [agent]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!agent) return;
        setIsSubmitting(true);
        const success = await onSubmit(agent.id, formData);
        setIsSubmitting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Travel Agent">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <Input
                    value={formData.name || ''}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Agent Name *"
                    required
                />
                <Input
                    value={formData.agencyName || ''}
                    onChange={e => setFormData({ ...formData, agencyName: e.target.value })}
                    placeholder="Agency Name"
                />
                <Input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="Email"
                />
                <Input
                    value={formData.phone || ''}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Phone"
                />
                <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={formData.commissionRate ?? ''}
                    onChange={e => setFormData({ ...formData, commissionRate: parseFloat(e.target.value) || 0 })}
                    placeholder="Commission Rate (0.10 = 10%)"
                />
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button type="submit" disabled={isSubmitting || !formData.name?.trim()} style={{ flex: 1 }}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ isOpen, onClose, onConfirm, entityName, entityType }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<boolean>;
    entityName: string;
    entityType: 'company' | 'agent';
}) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        const success = await onConfirm();
        setIsDeleting(false);
        if (success) onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Delete ${entityType === 'company' ? 'Company' : 'Agent'}`} size="sm">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
                    <AlertTriangle size={20} style={{ color: 'var(--notion-red)', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ fontSize: '14px', color: 'var(--notion-text)' }}>
                        Are you sure you want to delete <strong>{entityName}</strong>? This action cannot be undone.
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        style={{
                            flex: 1,
                            backgroundColor: 'var(--notion-red)',
                            borderColor: 'var(--notion-red)',
                        }}
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}

// Main Page
export default function CRMPage() {
    const {
        guests,
        companies,
        agents,
        isLoading,
        searchGuests,
        getGuestHistory,
        updateGuestProfile,
        fetchCompanies,
        createCompany,
        updateCompany,
        deleteCompany,
        fetchAgents,
        createAgent,
        updateAgent,
        deleteAgent,
    } = useCRM();

    const [activeTab, setActiveTab] = useState('guests');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [guestPage, setGuestPage] = useState(1);
    const [guestLimit, setGuestLimit] = useState(20);

    // Guest history
    const [historyGuest, setHistoryGuest] = useState<Guest | null>(null);

    // Edit modals
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [editingAgent, setEditingAgent] = useState<TravelAgent | null>(null);

    // Delete modals
    const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
    const [deletingAgent, setDeletingAgent] = useState<TravelAgent | null>(null);

    useEffect(() => {
        searchGuests();
        fetchCompanies();
        fetchAgents();
    }, [searchGuests, fetchCompanies, fetchAgents]);

    const handleSearch = () => {
        searchGuests(searchQuery);
        setGuestPage(1);
    };

    // Guest pagination
    const guestTotalPages = Math.ceil(guests.length / guestLimit);
    const paginatedGuests = guests.slice((guestPage - 1) * guestLimit, guestPage * guestLimit);

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <Users size={28} />
                                CRM
                            </h1>
                            <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                                Guest profiles, corporate accounts, and travel agents
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => { searchGuests(); fetchCompanies(); fetchAgents(); }} disabled={isLoading}>
                                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                Refresh
                            </Button>
                            {activeTab === 'companies' && (
                                <Button onClick={() => setIsCompanyModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    Add Company
                                </Button>
                            )}
                            {activeTab === 'agents' && (
                                <Button onClick={() => setIsAgentModalOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    Add Agent
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>{guests.length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Guests</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-yellow)' }}>{guests.filter(g => g.isVip).length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>VIP</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-blue)' }}>{companies.length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Companies</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)' }}>{agents.length}</span>
                            <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Agents</span>
                        </div>
                    </div>

                    {/* Search (Guests tab) */}
                    {activeTab === 'guests' && (
                        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                            <Input
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Search by name, email, or phone..."
                                style={{ maxWidth: '400px' }}
                                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                            />
                            <Button onClick={handleSearch} disabled={isLoading}>
                                <Search size={14} style={{ marginRight: '6px' }} />
                                Search
                            </Button>
                        </div>
                    )}

                    {/* Tabs */}
                    <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Tab Content */}
                    {activeTab === 'guests' && (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                                {guests.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                        <Users size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                        <p>No guests found</p>
                                    </div>
                                ) : (
                                    paginatedGuests.map(guest => (
                                        <GuestCard
                                            key={guest.id}
                                            guest={guest}
                                            onViewHistory={() => setHistoryGuest(guest)}
                                            onToggleVip={() => updateGuestProfile(guest.id, { isVip: !guest.isVip })}
                                        />
                                    ))
                                )}
                            </div>
                            {guests.length > 0 && (
                                <Pagination
                                    page={guestPage}
                                    totalPages={guestTotalPages}
                                    total={guests.length}
                                    limit={guestLimit}
                                    onPageChange={setGuestPage}
                                    onLimitChange={(l) => { setGuestLimit(l); setGuestPage(1); }}
                                />
                            )}
                        </>
                    )}

                    {activeTab === 'companies' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                            {companies.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Building2 size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No corporate accounts</p>
                                    <Button onClick={() => setIsCompanyModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                        Add First Company
                                    </Button>
                                </div>
                            ) : (
                                companies.map(company => (
                                    <CompanyCard
                                        key={company.id}
                                        company={company}
                                        onEdit={() => setEditingCompany(company)}
                                        onDelete={() => setDeletingCompany(company)}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'agents' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                            {agents.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                                    <Briefcase size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                                    <p>No travel agents</p>
                                    <Button onClick={() => setIsAgentModalOpen(true)} style={{ marginTop: 'var(--space-4)' }}>
                                        Add First Agent
                                    </Button>
                                </div>
                            ) : (
                                agents.map(agent => (
                                    <AgentCard
                                        key={agent.id}
                                        agent={agent}
                                        onEdit={() => setEditingAgent(agent)}
                                        onDelete={() => setDeletingAgent(agent)}
                                    />
                                ))
                            )}
                        </div>
                    )}
            </div>

            {/* Modals */}
            <CreateCompanyModal isOpen={isCompanyModalOpen} onClose={() => setIsCompanyModalOpen(false)} onSubmit={createCompany} />
            <CreateAgentModal isOpen={isAgentModalOpen} onClose={() => setIsAgentModalOpen(false)} onSubmit={createAgent} />

            <GuestHistoryModal
                isOpen={!!historyGuest}
                onClose={() => setHistoryGuest(null)}
                guest={historyGuest}
                onFetchHistory={getGuestHistory}
            />

            <EditCompanyModal
                isOpen={!!editingCompany}
                onClose={() => setEditingCompany(null)}
                company={editingCompany}
                onSubmit={updateCompany}
            />
            <EditAgentModal
                isOpen={!!editingAgent}
                onClose={() => setEditingAgent(null)}
                agent={editingAgent}
                onSubmit={updateAgent}
            />

            <DeleteConfirmModal
                isOpen={!!deletingCompany}
                onClose={() => setDeletingCompany(null)}
                onConfirm={() => deleteCompany(deletingCompany!.id)}
                entityName={deletingCompany?.companyName || ''}
                entityType="company"
            />
            <DeleteConfirmModal
                isOpen={!!deletingAgent}
                onClose={() => setDeletingAgent(null)}
                onConfirm={() => deleteAgent(deletingAgent!.id)}
                entityName={deletingAgent?.name || ''}
                entityType="agent"
            />
        </DashboardLayout>
    );
}
