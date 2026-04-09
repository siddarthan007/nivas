'use client';

import { useState, useEffect } from 'react';
import {
    useCRM,
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
import { SkeletonCard } from '@/components/ui';
import {
    Building2,
    Briefcase,
    Plus,
    RefreshCw,
    Mail,
    Pencil,
    Trash2,
    AlertTriangle,
} from 'lucide-react';

// Tab Navigation
function TabNav({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
    const tabs = [
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
        companies,
        agents,
        isLoading,
        fetchCompanies,
        createCompany,
        updateCompany,
        deleteCompany,
        fetchAgents,
        createAgent,
        updateAgent,
        deleteAgent,
    } = useCRM();

    const [activeTab, setActiveTab] = useState('companies');
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);

    // Edit modals
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [editingAgent, setEditingAgent] = useState<TravelAgent | null>(null);

    // Delete modals
    const [deletingCompany, setDeletingCompany] = useState<Company | null>(null);
    const [deletingAgent, setDeletingAgent] = useState<TravelAgent | null>(null);

    useEffect(() => {
        fetchCompanies();
        fetchAgents();
    }, [fetchCompanies, fetchAgents]);

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
                            <Briefcase size={28} />
                            CRM
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                            Corporate accounts and travel agents
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="secondary" onClick={() => { fetchCompanies(); fetchAgents(); }} disabled={isLoading}>
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
                        <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-blue)' }}>{companies.length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Companies</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-orange)' }}>{agents.length}</span>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>Agents</span>
                    </div>
                </div>

                {/* Tabs */}
                <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Tab Content */}
                {isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                ) : activeTab === 'companies' ? (
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
                ) : (
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
