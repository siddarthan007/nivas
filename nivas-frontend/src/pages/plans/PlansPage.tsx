'use client';

import { useState } from 'react';
import { usePlans, type SubscriptionPackage, type Feature, type AvailableRole } from '@/lib/hooks/usePlans';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
    Package,
    Plus,
    Edit,
    ToggleLeft,
    ToggleRight,
    Users,
    DoorOpen,
    Calendar,
    CheckCircle,
    X,
    Loader2,
    Shield,
    LayoutGrid,
} from 'lucide-react';

// Plan Card Component
function PlanCard({
    plan,
    onEdit,
    onToggleStatus,
}: {
    plan: SubscriptionPackage;
    onEdit: () => void;
    onToggleStatus: () => void;
}) {
    const monthlyPrice = parseFloat(plan.monthlyPrice || '0');
    const annualPrice = plan.annualPrice ? parseFloat(plan.annualPrice) : null;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            opacity: plan.isActive ? 1 : 0.6,
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--notion-blue-bg)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--notion-blue)',
                    }}>
                        <Package size={22} />
                    </div>
                    <div>
                        <div style={{
                            fontSize: '15px',
                            fontWeight: '600',
                            color: 'var(--notion-text)',
                        }}>
                            {plan.name}
                        </div>
                        <div style={{
                            fontSize: '12px',
                            color: 'var(--notion-text-secondary)',
                            fontFamily: 'ui-monospace, monospace',
                        }}>
                            {plan.code}
                        </div>
                    </div>
                </div>

                {/* Status Badge */}
                <span style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: plan.isActive ? 'var(--notion-green-bg)' : 'var(--notion-red-bg)',
                    color: plan.isActive ? 'var(--notion-green)' : 'var(--notion-red)',
                }}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            {/* Description */}
            {plan.description && (
                <p style={{
                    fontSize: '13px',
                    color: 'var(--notion-text-secondary)',
                    marginBottom: 'var(--space-4)',
                    lineHeight: 1.5,
                }}>
                    {plan.description}
                </p>
            )}

            {/* Pricing */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>
                        NPR {(monthlyPrice || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>per month</div>
                </div>
                {annualPrice && (
                    <div style={{ borderLeft: '1px solid var(--notion-border)', paddingLeft: 'var(--space-4)' }}>
                        <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--notion-text)' }}>
                            NPR {(annualPrice || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--notion-text-muted)' }}>per year</div>
                    </div>
                )}
            </div>

            {/* Limits */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <DoorOpen size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <span style={{ color: 'var(--notion-text)' }}>{plan.maxRooms || '∞'} rooms</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <Users size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <span style={{ color: 'var(--notion-text)' }}>{plan.maxUsers || '∞'} users</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                    <Calendar size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <span style={{ color: 'var(--notion-text)' }}>{plan.trialDays} days trial</span>
                </div>
            </div>

            {/* Modules */}
            {plan.modules && plan.modules.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <LayoutGrid size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        Modules ({plan.modules.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {plan.modules.map((mod, i) => (
                            <span key={i} style={{
                                padding: '2px 8px', fontSize: '11px',
                                backgroundColor: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-sm)',
                                color: 'var(--notion-blue)',
                            }}>
                                {mod}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Allowed Roles */}
            {plan.allowedRoles && plan.allowedRoles.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Shield size={10} style={{ display: 'inline', marginRight: '4px' }} />
                        Roles ({plan.allowedRoles.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {plan.allowedRoles.map((role, i) => (
                            <span key={i} style={{
                                padding: '2px 8px', fontSize: '11px',
                                backgroundColor: 'var(--notion-purple-bg, rgba(167,130,195,0.15))',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--notion-purple, #9B6FC3)',
                            }}>
                                {role}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Features */}
            {plan.features && plan.features.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Features
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {plan.features.map((feature, i) => (
                            <span key={i} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                backgroundColor: 'var(--notion-bg-tertiary)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--notion-text-secondary)',
                            }}>
                                <CheckCircle size={10} style={{ color: 'var(--notion-green)' }} />
                                {feature}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
                borderTop: '1px solid var(--notion-divider)',
                paddingTop: 'var(--space-3)',
            }}>
                <Button size="sm" variant="secondary" onClick={onToggleStatus} style={{ flex: 1 }}>
                    {plan.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    <span style={{ marginLeft: '4px' }}>{plan.isActive ? 'Deactivate' : 'Activate'}</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
            </div>
        </div>
    );
}

// Create/Edit Modal
function PlanModal({
    plan,
    onClose,
    onSave,
    isLoading,
    featuresList,
    modulesList,
    rolesList,
}: {
    plan: Partial<SubscriptionPackage> | null;
    onClose: () => void;
    onSave: (data: any) => void;
    isLoading: boolean;
    featuresList: Feature[];
    modulesList: Feature[];
    rolesList: AvailableRole[];
}) {
    const isEdit = !!plan?.id;
    const [formData, setFormData] = useState<{
        name: string;
        code: string;
        description: string;
        monthlyPrice: number | '';
        annualPrice: number | undefined;
        maxRooms: number | undefined;
        maxUsers: number | undefined;
        trialDays: number | '';
        features: string[];
        modules: string[];
        allowedRoles: string[];
    }>({
        name: plan?.name || '',
        code: plan?.code || '',
        description: plan?.description || '',
        monthlyPrice: plan?.monthlyPrice ? parseFloat(plan.monthlyPrice) : '',
        annualPrice: plan?.annualPrice ? parseFloat(plan.annualPrice) : undefined,
        maxRooms: plan?.maxRooms || undefined,
        maxUsers: plan?.maxUsers || undefined,
        trialDays: plan?.trialDays || 14,
        features: plan?.features || [],
        modules: plan?.modules || [],
        allowedRoles: plan?.allowedRoles || [],
    });

    // Group features by category
    const featuresByCategory = (featuresList || []).reduce((acc, feature) => {
        if (!acc[feature.category]) acc[feature.category] = [];
        acc[feature.category]!.push(feature);
        return acc;
    }, {} as Record<string, typeof featuresList>);

    // Group modules by category
    const modulesByCategory = (modulesList || []).reduce((acc, mod) => {
        if (!acc[mod.category]) acc[mod.category] = [];
        acc[mod.category]!.push(mod);
        return acc;
    }, {} as Record<string, typeof modulesList>);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...formData,
            monthlyPrice: formData.monthlyPrice === '' ? 0 : Number(formData.monthlyPrice),
            annualPrice: formData.annualPrice ? Number(formData.annualPrice) : undefined,
            trialDays: formData.trialDays === '' ? 14 : formData.trialDays
        };
        onSave(payload);
    };

    const toggleItem = (list: string[], item: string, key: 'features' | 'modules' | 'allowedRoles') => {
        const exists = list.includes(item);
        setFormData(prev => ({
            ...prev,
            [key]: exists ? prev[key].filter(i => i !== item) : [...prev[key], item]
        }));
    };

    const toggleAllInCategory = (items: { id: string }[], key: 'features' | 'modules' | 'allowedRoles') => {
        const ids = items.map(i => i.id);
        const allSelected = ids.every(id => formData[key].includes(id));
        setFormData(prev => ({
            ...prev,
            [key]: allSelected
                ? prev[key].filter(id => !ids.includes(id))
                : [...new Set([...prev[key], ...ids])]
        }));
    };

    const toggleAllFeatures = (category?: string) => {
        if (category) {
            toggleAllInCategory(featuresByCategory[category] || [], 'features');
        } else {
            const allFeatureIds = featuresList.map(f => f.id);
            const allSelected = allFeatureIds.every(id => formData.features.includes(id));
            setFormData(prev => ({ ...prev, features: allSelected ? [] : allFeatureIds }));
        }
    };

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'var(--notion-overlay)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
        }}>
            <div style={{
                backgroundColor: 'var(--notion-bg)',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-6)',
                width: '100%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflowY: 'auto',
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 'var(--space-5)',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)' }}>
                        {isEdit ? 'Edit Plan' : 'Create New Plan'}
                    </h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--notion-text-muted)', cursor: 'pointer' }}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {/* ... Basic Info Fields ... */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Plan Name *
                            </label>
                            <Input
                                value={formData.name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Professional"
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Plan Code *
                            </label>
                            <Input
                                value={formData.code}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                placeholder="e.g., PROFESSIONAL"
                                required
                                disabled={isEdit}
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                            Description
                        </label>
                        <Input
                            value={formData.description}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description of this plan"
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Monthly Price (NPR) *
                            </label>
                            <Input
                                type="number"
                                value={formData.monthlyPrice}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, monthlyPrice: val === '' ? '' : parseFloat(val) });
                                }}
                                placeholder="5000"
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Annual Price (NPR)
                            </label>
                            <Input
                                type="number"
                                value={formData.annualPrice || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, annualPrice: val === '' ? undefined : parseFloat(val) });
                                }}
                                placeholder="50000"
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Max Rooms
                            </label>
                            <Input
                                type="number"
                                value={formData.maxRooms || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, maxRooms: val === '' ? undefined : parseInt(val) });
                                }}
                                placeholder="50"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Max Users
                            </label>
                            <Input
                                type="number"
                                value={formData.maxUsers || ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, maxUsers: val === '' ? undefined : parseInt(val) });
                                }}
                                placeholder="10"
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)', marginBottom: '4px' }}>
                                Trial Days
                            </label>
                            <Input
                                type="number"
                                value={formData.trialDays}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const val = e.target.value;
                                    setFormData({ ...formData, trialDays: val === '' ? '' : parseInt(val) });
                                }}
                                placeholder="14"
                            />
                        </div>
                    </div>

                    {/* Sidebar Modules */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)' }}>
                                <LayoutGrid size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                Sidebar Modules
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    const allIds = modulesList.map(m => m.id);
                                    const allSelected = allIds.every(id => formData.modules.includes(id));
                                    setFormData(prev => ({ ...prev, modules: allSelected ? [] : allIds }));
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                            >
                                {modulesList.every(m => formData.modules.includes(m.id)) ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {Object.entries(modulesByCategory).map(([category, mods]) => (
                                <div key={category} style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)',
                                        marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        {category}
                                        <button type="button" onClick={() => toggleAllInCategory(mods, 'modules')}
                                            style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: '10px', cursor: 'pointer' }}>
                                            {mods.every(m => formData.modules.includes(m.id)) ? 'None' : 'All'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        {mods.map(mod => (
                                            <label key={mod.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={formData.modules.includes(mod.id)}
                                                    onChange={() => toggleItem(formData.modules, mod.id, 'modules')}
                                                    style={{ accentColor: 'var(--notion-blue)' }} />
                                                <span style={{ color: 'var(--notion-text)' }}>{mod.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Allowed Roles */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)' }}>
                                <Shield size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                Allowed Roles
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    const allIds = rolesList.map(r => r.id);
                                    const allSelected = allIds.every(id => formData.allowedRoles.includes(id));
                                    setFormData(prev => ({ ...prev, allowedRoles: allSelected ? [] : allIds }));
                                }}
                                style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                            >
                                {rolesList.every(r => formData.allowedRoles.includes(r.id)) ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                {rolesList.map(role => (
                                    <label key={role.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={formData.allowedRoles.includes(role.id)}
                                            onChange={() => toggleItem(formData.allowedRoles, role.id, 'allowedRoles')}
                                            style={{ accentColor: 'var(--notion-purple, #9B6FC3)' }} />
                                        <span style={{ color: 'var(--notion-text)' }}>{role.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Feature Toggles */}
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '500', color: 'var(--notion-text-secondary)' }}>
                                Feature Toggles
                            </label>
                            <button type="button" onClick={() => toggleAllFeatures()}
                                style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}>
                                {featuresList.every(f => formData.features.includes(f.id)) ? 'Deselect All' : 'Select All'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                            {Object.entries(featuresByCategory).map(([category, features]) => (
                                <div key={category} style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        fontSize: '11px', fontWeight: '600', color: 'var(--notion-text-muted)',
                                        marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em'
                                    }}>
                                        {category}
                                        <button type="button" onClick={() => toggleAllFeatures(category)}
                                            style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: '10px', cursor: 'pointer' }}>
                                            {features.every(f => formData.features.includes(f.id)) ? 'None' : 'All'}
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        {features.map(feature => (
                                            <label key={feature.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={formData.features.includes(feature.id)}
                                                    onChange={() => toggleItem(formData.features, feature.id, 'features')}
                                                    style={{ accentColor: 'var(--notion-text)' }} />
                                                <span style={{ color: 'var(--notion-text)' }}>{feature.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                        <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading || !formData.name || !formData.monthlyPrice || formData.monthlyPrice <= 0 || (typeof formData.monthlyPrice === 'number' && isNaN(formData.monthlyPrice))} style={{ flex: 1 }}>
                            {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                            <span style={{ marginLeft: isLoading ? '8px' : 0 }}>{isEdit ? 'Update' : 'Create'}</span>
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function PlansPage() {
    const { plans, features, modules, availableRoles, isLoading, createPlan, updatePlan, togglePlanStatus } = usePlans();
    const [modalPlan, setModalPlan] = useState<Partial<SubscriptionPackage> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (data: any) => {
        setIsSaving(true);
        try {
            if (modalPlan?.id) {
                await updatePlan(modalPlan.id, data);
            } else {
                await createPlan(data);
            }
            setModalPlan(null);
        } catch (err) {
            console.error('Save failed:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (plan: SubscriptionPackage) => {
        await togglePlanStatus(plan.id, !plan.isActive);
    };

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)', maxWidth: '1400px', margin: '0 auto' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 'var(--space-6)',
                        flexWrap: 'wrap',
                        gap: 'var(--space-3)',
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                marginBottom: 'var(--space-2)'
                            }}>
                                Subscription Plans
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)'
                            }}>
                                Manage subscription packages and pricing for tenants
                            </p>
                        </div>

                        <Button onClick={() => setModalPlan({})}>
                            <Plus size={16} />
                            <span style={{ marginLeft: '6px' }}>New Plan</span>
                        </Button>
                    </div>

                    {/* Plans Grid */}
                    {isLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                            {[1, 2, 3].map(i => (
                                <div key={i} style={{
                                    height: '300px',
                                    backgroundColor: 'var(--notion-bg-secondary)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--notion-border)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                            ))}
                        </div>
                    ) : plans.length === 0 ? (
                        <div style={{
                            textAlign: 'center',
                            padding: 'var(--space-12)',
                            backgroundColor: 'var(--notion-bg-secondary)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--notion-border)',
                        }}>
                            <Package size={48} style={{ color: 'var(--notion-text-muted)', marginBottom: 'var(--space-4)' }} />
                            <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>
                                No plans created yet
                            </h3>
                            <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-4)' }}>
                                Create your first subscription plan to get started
                            </p>
                            <Button onClick={() => setModalPlan({})}>
                                <Plus size={16} />
                                <span style={{ marginLeft: '6px' }}>Create First Plan</span>
                            </Button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                            {plans.map(plan => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    onEdit={() => setModalPlan(plan)}
                                    onToggleStatus={() => handleToggleStatus(plan)}
                                />
                            ))}
                        </div>
                    )}
            </div>

            {/* Modal */}
            {modalPlan !== null && (
                <PlanModal
                    plan={modalPlan}
                    onClose={() => setModalPlan(null)}
                    onSave={handleSave}
                    isLoading={isSaving}
                    featuresList={features}
                    modulesList={modules}
                    rolesList={availableRoles}
                />
            )}
        </DashboardLayout>
    );
}
