'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import { useCorporate } from '@/lib/hooks/useCorporate';
import { toast } from 'sonner';
import {
    Building,
    Briefcase,
    Plus,
    Search,
    Phone,
    Mail,
    User,
    Trash2,
    Edit,
    RefreshCw,
    Loader2
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

// Local types (matching hook types)
// Local types (matching hook types)
import type { CorporateAccount, TravelAgent, CreateCompanyPayload, CreateAgentPayload } from '@/lib/hooks/useCorporate';

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
        { id: 'companies', label: 'Corporate Accounts', icon: Building },
        { id: 'agents', label: 'Travel Agents', icon: Briefcase }
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

// Company Card
function CompanyCard({ company, onEdit, onDelete }: { company: CorporateAccount; onEdit: () => void; onDelete: () => void }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {company.companyName}
                    </h3>
                    {company.contactPerson && (
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                            <User size={12} /> {company.contactPerson}
                        </span>
                    )}
                </div>
                <span style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: company.status === 'ACTIVE' ? 'var(--notion-green-bg)' : 'var(--notion-gray-bg)',
                    color: company.status === 'ACTIVE' ? 'var(--notion-green)' : 'var(--notion-text-secondary)'
                }}>
                    {company.status}
                </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)' }}>
                {company.email && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={12} /> {company.email}</span>}
                {company.phone && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} /> {company.phone}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                {company.discountPercentage && (
                    <div style={{ padding: '8px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-green)' }}>{company.discountPercentage}%</div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Discount</div>
                    </div>
                )}
                {company.creditLimit && (
                    <div style={{ padding: '8px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-blue)' }}>${((company.creditLimit || 0) / 1000).toFixed(0)}K</div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Credit</div>
                    </div>
                )}
                <div style={{ padding: '8px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>{company.totalBookings || 0}</div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Bookings</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="ghost" size="sm" onClick={onEdit} icon={<Edit size={14} />}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 size={14} />} style={{ color: 'var(--notion-red)' }}>Delete</Button>
            </div>
        </div>
    );
}

// Agent Card
function AgentCard({ agent, onEdit, onDelete }: { agent: TravelAgent; onEdit: () => void; onDelete: () => void }) {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {agent.name}
                    </h3>
                    {agent.agencyName && (
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{agent.agencyName}</span>
                    )}
                </div>
                <span style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: agent.status === 'ACTIVE' ? 'var(--notion-green-bg)' : 'var(--notion-gray-bg)',
                    color: agent.status === 'ACTIVE' ? 'var(--notion-green)' : 'var(--notion-text-secondary)'
                }}>
                    {agent.status}
                </span>
            </div>

            {agent.email && (
                <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Mail size={12} /> {agent.email}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div style={{ padding: '8px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-orange)' }}>{((agent.commissionRate || 0) * 100).toFixed(0)}%</div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Commission</div>
                </div>
                <div style={{ padding: '8px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--notion-text)' }}>{agent.totalReferrals || 0}</div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)' }}>Referrals</div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="ghost" size="sm" onClick={onEdit} icon={<Edit size={14} />}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={onDelete} icon={<Trash2 size={14} />} style={{ color: 'var(--notion-red)' }}>Delete</Button>
            </div>
        </div>
    );
}

// Loading Card Skeleton
function LoadingCard() {
    return (
        <div style={{
            backgroundColor: 'var(--notion-bg)',
            border: '1px solid var(--notion-border)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
            animation: 'pulse 2s infinite'
        }}>
            <div style={{ height: '20px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', marginBottom: '12px', width: '60%' }} />
            <div style={{ height: '14px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', marginBottom: '8px', width: '40%' }} />
            <div style={{ height: '14px', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', width: '80%' }} />
        </div>
    );
}

export default function CorporatePage() {
    const { companies, agents, isLoading, error, refresh, createCompany, createAgent, updateCompany, updateAgent, deleteCompany, deleteAgent } = useCorporate();
    const [activeTab, setActiveTab] = useState('companies');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingId, setEditingId] = useState<number | null>(null);

    // Form State
    const [companyForm, setCompanyForm] = useState<CreateCompanyPayload>({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        contractRate: 0,
        discountPercentage: 0,
        creditLimit: 0
    });

    const [agentForm, setAgentForm] = useState<CreateAgentPayload>({
        name: '',
        agencyName: '',
        email: '',
        phone: '',
        commissionRate: 0
    });

    const resetForms = () => {
        setCompanyForm({
            companyName: '',
            contactPerson: '',
            email: '',
            phone: '',
            contractRate: 0,
            discountPercentage: 0,
            creditLimit: 0
        });
        setAgentForm({
            name: '',
            agencyName: '',
            email: '',
            phone: '',
            commissionRate: 0
        });
        setEditingId(null);
    };

    const handleOpenCreate = () => {
        setModalMode('create');
        resetForms();
        setIsModalOpen(true);
    };

    const handleOpenEditCompany = (company: CorporateAccount) => {
        setModalMode('edit');
        setEditingId(company.id);
        setCompanyForm({
            companyName: company.companyName,
            contactPerson: company.contactPerson || '',
            email: company.email || '',
            phone: company.phone || '',
            contractRate: company.contractRate || 0,
            discountPercentage: company.discountPercentage || 0,
            creditLimit: company.creditLimit || 0
        });
        setIsModalOpen(true);
    };

    const handleOpenEditAgent = (agent: TravelAgent) => {
        setModalMode('edit');
        setEditingId(agent.id);
        setAgentForm({
            name: agent.name,
            agencyName: agent.agencyName || '',
            email: agent.email || '',
            phone: agent.phone || '',
            commissionRate: agent.commissionRate || 0
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        let success = false;

        if (activeTab === 'companies') {
            if (modalMode === 'create') {
                success = await createCompany(companyForm);
            } else if (editingId) {
                success = await updateCompany(editingId, companyForm);
            }
        } else {
            if (modalMode === 'create') {
                // Ensure commission rate is a number (handle potential string input)
                const payload = { ...agentForm, commissionRate: Number(agentForm.commissionRate) };
                success = await createAgent(payload);
            } else if (editingId) {
                const payload = { ...agentForm, commissionRate: Number(agentForm.commissionRate) };
                success = await updateAgent(editingId, payload);
            }
        }

        if (success) {
            setIsModalOpen(false);
            resetForms();
        }
    };

    const filteredCompanies = useMemo(() =>
        companies.filter(c => (c.companyName || '').toLowerCase().includes(searchQuery.toLowerCase())),
        [companies, searchQuery]
    );

    const filteredAgents = useMemo(() =>
        agents.filter(a => (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || a.agencyName?.toLowerCase().includes(searchQuery.toLowerCase())),
        [agents, searchQuery]
    );

    const stats = useMemo(() => ({
        totalCompanies: companies.length,
        activeCompanies: companies.filter(c => c.status === 'ACTIVE').length,
        totalAgents: agents.length,
        activeAgents: agents.filter(a => a.status === 'ACTIVE').length
    }), [companies, agents]);

    const handleDeleteCompany = async (id: number) => {
        if (confirm('Are you sure you want to delete this corporate account?')) {
            await deleteCompany(id);
        }
    };

    const handleDeleteAgent = async (id: number) => {
        if (confirm('Are you sure you want to delete this travel agent?')) {
            await deleteAgent(id);
        }
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{ padding: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <Building size={24} />
                                Corporate & Agents
                            </h1>
                            <p style={{ color: 'var(--notion-text-secondary)', fontSize: '14px' }}>
                                Manage corporate accounts and travel agent partnerships
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                            <Button variant="secondary" onClick={refresh} icon={isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}>
                                Refresh
                            </Button>
                            <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
                                Add {activeTab === 'companies' ? 'Company' : 'Agent'}
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
                            <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats.totalCompanies}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Total Companies</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-green-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-green)' }}>{stats.activeCompanies}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-green)' }}>Active Accounts</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700' }}>{stats.totalAgents}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Travel Agents</div>
                        </div>
                        <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--notion-blue)' }}>{stats.activeAgents}</div>
                            <div style={{ fontSize: '13px', color: 'var(--notion-blue)' }}>Active Agents</div>
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative', maxWidth: '300px', marginBottom: 'var(--space-4)' }}>
                        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-secondary)' }} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                fontSize: '14px',
                                border: '1px solid var(--notion-border)',
                                borderRadius: 'var(--radius-md)',
                                backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)'
                            }}
                        />
                    </div>

                    {/* Content */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                        {isLoading ? (
                            <>
                                <LoadingCard />
                                <LoadingCard />
                                <LoadingCard />
                            </>
                        ) : activeTab === 'companies' ? (
                            filteredCompanies.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                                    No corporate accounts found
                                </div>
                            ) : (
                                filteredCompanies.map(company => (
                                    <CompanyCard
                                        key={company.id}
                                        company={company}
                                        onEdit={() => handleOpenEditCompany(company)}
                                        onDelete={() => handleDeleteCompany(company.id)}
                                    />
                                ))
                            )
                        ) : (
                            filteredAgents.length === 0 ? (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 'var(--space-8)', color: 'var(--notion-text-secondary)' }}>
                                    No travel agents found
                                </div>
                            ) : (
                                filteredAgents.map(agent => (
                                    <AgentCard
                                        key={agent.id}
                                        agent={agent}
                                        onEdit={() => handleOpenEditAgent(agent)}
                                        onDelete={() => handleDeleteAgent(agent.id)}
                                    />
                                ))
                            )
                        )}
                    </div>
                </div>
            </PageContainer>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={`${modalMode === 'create' ? 'Add' : 'Edit'} ${activeTab === 'companies' ? 'Corporate Account' : 'Travel Agent'}`}
            >
                <form id="corporate-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {activeTab === 'companies' ? (
                        <>
                            <Input
                                label="Company Name"
                                value={companyForm.companyName}
                                onChange={e => setCompanyForm({ ...companyForm, companyName: e.target.value })}
                                required
                                placeholder="e.g. Acme Corp"
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <Input
                                    label="Contact Person"
                                    value={companyForm.contactPerson}
                                    onChange={e => setCompanyForm({ ...companyForm, contactPerson: e.target.value })}
                                    placeholder="Full Name"
                                />
                                <Input
                                    label="Phone"
                                    value={companyForm.phone}
                                    onChange={e => setCompanyForm({ ...companyForm, phone: e.target.value })}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>
                            <Input
                                label="Email"
                                type="email"
                                value={companyForm.email}
                                onChange={e => setCompanyForm({ ...companyForm, email: e.target.value })}
                                placeholder="contact@company.com"
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
                                <Input
                                    label="Contract Rate (NPR)"
                                    type="number"
                                    value={companyForm.contractRate || ''}
                                    onChange={e => setCompanyForm({ ...companyForm, contractRate: e.target.value === '' ? 0 : Number(e.target.value) })}
                                />
                                <Input
                                    label="Discount (%)"
                                    type="number"
                                    value={companyForm.discountPercentage || ''}
                                    onChange={e => setCompanyForm({ ...companyForm, discountPercentage: e.target.value === '' ? 0 : Number(e.target.value) })}
                                />
                                <Input
                                    label="Credit Limit (NPR)"
                                    type="number"
                                    value={companyForm.creditLimit || ''}
                                    onChange={e => setCompanyForm({ ...companyForm, creditLimit: e.target.value === '' ? 0 : Number(e.target.value) })}
                                />
                            </div>
                        </>
                    ) : (
                        <>
                            <Input
                                label="Agent Name"
                                value={agentForm.name}
                                onChange={e => setAgentForm({ ...agentForm, name: e.target.value })}
                                required
                                placeholder="Full Name"
                            />
                            <Input
                                label="Agency Name"
                                value={agentForm.agencyName}
                                onChange={e => setAgentForm({ ...agentForm, agencyName: e.target.value })}
                                placeholder="Travel Agency Name"
                            />
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                                <Input
                                    label="Email"
                                    type="email"
                                    value={agentForm.email}
                                    onChange={e => setAgentForm({ ...agentForm, email: e.target.value })}
                                    placeholder="agent@agency.com"
                                />
                                <Input
                                    label="Phone"
                                    value={agentForm.phone}
                                    onChange={e => setAgentForm({ ...agentForm, phone: e.target.value })}
                                    placeholder="+1 234 567 8900"
                                />
                            </div>
                            <Input
                                label="Commission Rate (0-1.0)"
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value={agentForm.commissionRate}
                                onChange={e => setAgentForm({ ...agentForm, commissionRate: parseFloat(e.target.value) })}
                                hint="Example: 0.15 for 15%"
                            />
                        </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button type="submit" variant="primary">{modalMode === 'create' ? 'Create' : 'Save Changes'}</Button>
                    </div>
                </form>
            </Modal>
        </DashboardLayout >
    );
}
