'use client';

import { useState, useEffect, useMemo } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Loader2, LayoutGrid, Shield } from 'lucide-react';
import type { SubscriptionPackage, Feature, AvailableRole } from '@/lib/hooks/usePlans';

export interface PlanFormPayload {
    name: string;
    code: string;
    description?: string;
    monthlyPrice: number;
    annualPrice?: number;
    maxRooms?: number;
    maxUsers?: number;
    trialDays?: number;
    features: string[];
    modules: string[];
    allowedRoles: string[];
}

interface PlanModalProps {
    plan: Partial<SubscriptionPackage> | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: PlanFormPayload) => Promise<void>;
    isLoading: boolean;
    featuresList: Feature[];
    modulesList: Feature[];
    rolesList: AvailableRole[];
}

type FormState = {
    name: string;
    code: string;
    description: string;
    monthlyPrice: number | '';
    annualPrice: number | '';
    maxRooms: number | '';
    maxUsers: number | '';
    trialDays: number | '';
    features: string[];
    modules: string[];
    allowedRoles: string[];
};

function buildFormState(plan: Partial<SubscriptionPackage> | null): FormState {
    return {
        name: plan?.name || '',
        code: plan?.code || '',
        description: plan?.description || '',
        monthlyPrice: plan?.monthlyPrice ? parseFloat(plan.monthlyPrice) : '',
        annualPrice: plan?.annualPrice ? parseFloat(plan.annualPrice) : '',
        maxRooms: plan?.maxRooms ?? '',
        maxUsers: plan?.maxUsers ?? '',
        trialDays: plan?.trialDays ?? 14,
        features: plan?.features || [],
        modules: plan?.modules || [],
        allowedRoles: plan?.allowedRoles || [],
    };
}

export function PlanModal({
    plan,
    isOpen,
    onClose,
    onSave,
    isLoading,
    featuresList,
    modulesList,
    rolesList,
}: PlanModalProps) {
    const isEdit = !!plan?.id;
    const [formData, setFormData] = useState<FormState>(() => buildFormState(plan));

    useEffect(() => {
        if (isOpen) setFormData(buildFormState(plan));
    }, [isOpen, plan]);

    const featuresByCategory = useMemo(() => {
        return (featuresList || []).reduce<Record<string, Feature[]>>((acc, feature) => {
            if (!acc[feature.category]) acc[feature.category] = [];
            acc[feature.category]!.push(feature);
            return acc;
        }, {});
    }, [featuresList]);

    const modulesByCategory = useMemo(() => {
        return (modulesList || []).reduce<Record<string, Feature[]>>((acc, mod) => {
            if (!acc[mod.category]) acc[mod.category] = [];
            acc[mod.category]!.push(mod);
            return acc;
        }, {});
    }, [modulesList]);

    const toggleItem = (item: string, key: 'features' | 'modules' | 'allowedRoles') => {
        setFormData(prev => ({
            ...prev,
            [key]: prev[key].includes(item)
                ? prev[key].filter(i => i !== item)
                : [...prev[key], item],
        }));
    };

    const toggleAllInCategory = (items: { id: string }[], key: 'features' | 'modules' | 'allowedRoles') => {
        const ids = items.map(i => i.id);
        setFormData(prev => {
            const allSelected = ids.every(id => prev[key].includes(id));
            return {
                ...prev,
                [key]: allSelected
                    ? prev[key].filter(id => !ids.includes(id))
                    : [...new Set([...prev[key], ...ids])],
            };
        });
    };

    const toggleAllFeatures = (category?: string) => {
        if (category) {
            toggleAllInCategory(featuresByCategory[category] || [], 'features');
            return;
        }
        const allFeatureIds = featuresList.map(f => f.id);
        const allSelected = allFeatureIds.every(id => formData.features.includes(id));
        setFormData(prev => ({ ...prev, features: allSelected ? [] : allFeatureIds }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSave({
            name: formData.name.trim(),
            code: formData.code.trim().toUpperCase(),
            description: formData.description.trim() || undefined,
            monthlyPrice: formData.monthlyPrice === '' ? 0 : Number(formData.monthlyPrice),
            annualPrice: formData.annualPrice === '' ? undefined : Number(formData.annualPrice),
            maxRooms: formData.maxRooms === '' ? undefined : Number(formData.maxRooms),
            maxUsers: formData.maxUsers === '' ? undefined : Number(formData.maxUsers),
            trialDays: formData.trialDays === '' ? 14 : Number(formData.trialDays),
            features: formData.features,
            modules: formData.modules,
            allowedRoles: formData.allowedRoles,
        });
    };

    const canSubmit = Boolean(
        formData.name.trim()
        && formData.code.trim()
        && formData.monthlyPrice !== ''
        && Number(formData.monthlyPrice) > 0
        && !Number.isNaN(Number(formData.monthlyPrice))
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? `Edit plan — ${plan?.code || ''}` : 'Create new plan'}
            size="xl"
        >
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                    Modules control sidebar access and API routes. Roles limit which staff types hotels can assign.
                    Feature toggles sync to subscribed hotels when you save (SMS, Fonepay, AI, CBMS, etc.).
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input
                        label="Plan name *"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Professional"
                        required
                    />
                    <Input
                        label="Plan code *"
                        value={formData.code}
                        onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g. PROFESSIONAL"
                        required
                        disabled={isEdit}
                    />
                </div>

                <Input
                    label="Description"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of this plan"
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Input
                        label="Monthly price (NPR) *"
                        type="number"
                        min="0"
                        value={formData.monthlyPrice}
                        onChange={e => {
                            const val = e.target.value;
                            setFormData({ ...formData, monthlyPrice: val === '' ? '' : parseFloat(val) });
                        }}
                        placeholder="5000"
                        required
                    />
                    <Input
                        label="Annual price (NPR)"
                        type="number"
                        min="0"
                        value={formData.annualPrice}
                        onChange={e => {
                            const val = e.target.value;
                            setFormData({ ...formData, annualPrice: val === '' ? '' : parseFloat(val) });
                        }}
                        placeholder="50000"
                    />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <Input
                        label="Max rooms"
                        type="number"
                        min="0"
                        value={formData.maxRooms}
                        onChange={e => {
                            const val = e.target.value;
                            setFormData({ ...formData, maxRooms: val === '' ? '' : parseInt(val, 10) });
                        }}
                        placeholder="50"
                    />
                    <Input
                        label="Max users"
                        type="number"
                        min="0"
                        value={formData.maxUsers}
                        onChange={e => {
                            const val = e.target.value;
                            setFormData({ ...formData, maxUsers: val === '' ? '' : parseInt(val, 10) });
                        }}
                        placeholder="10"
                    />
                    <Input
                        label="Trial days"
                        type="number"
                        min="0"
                        value={formData.trialDays}
                        onChange={e => {
                            const val = e.target.value;
                            setFormData({ ...formData, trialDays: val === '' ? '' : parseInt(val, 10) });
                        }}
                        placeholder="14"
                    />
                </div>

                <SectionHeader
                    title="Sidebar modules"
                    icon={<LayoutGrid size={12} />}
                    selectAllLabel={modulesList.every(m => formData.modules.includes(m.id)) ? 'Deselect all' : 'Select all'}
                    onSelectAll={() => {
                        const allIds = modulesList.map(m => m.id);
                        const allSelected = allIds.every(id => formData.modules.includes(id));
                        setFormData(prev => ({ ...prev, modules: allSelected ? [] : allIds }));
                    }}
                />
                <CategoryCheckboxGrid
                    groups={modulesByCategory}
                    selected={formData.modules}
                    onToggle={id => toggleItem(id, 'modules')}
                    onToggleCategory={items => toggleAllInCategory(items, 'modules')}
                    accentColor="var(--notion-blue)"
                />

                <SectionHeader
                    title="Allowed roles"
                    icon={<Shield size={12} />}
                    selectAllLabel={rolesList.every(r => formData.allowedRoles.includes(r.id)) ? 'Deselect all' : 'Select all'}
                    onSelectAll={() => {
                        const allIds = rolesList.map(r => r.id);
                        const allSelected = allIds.every(id => formData.allowedRoles.includes(id));
                        setFormData(prev => ({ ...prev, allowedRoles: allSelected ? [] : allIds }));
                    }}
                />
                <div style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {rolesList.map(role => (
                            <CheckboxRow
                                key={role.id}
                                label={role.label}
                                checked={formData.allowedRoles.includes(role.id)}
                                onChange={() => toggleItem(role.id, 'allowedRoles')}
                                accentColor="var(--notion-purple, #9B6FC3)"
                            />
                        ))}
                    </div>
                </div>

                <SectionHeader
                    title="Feature toggles"
                    selectAllLabel={featuresList.every(f => formData.features.includes(f.id)) ? 'Deselect all' : 'Select all'}
                    onSelectAll={() => toggleAllFeatures()}
                />
                <CategoryCheckboxGrid
                    groups={featuresByCategory}
                    selected={formData.features}
                    onToggle={id => toggleItem(id, 'features')}
                    onToggleCategory={items => toggleAllInCategory(items, 'features')}
                    accentColor="var(--notion-text)"
                />

                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading || !canSubmit} style={{ flex: 1 }}>
                        {isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span style={{ marginLeft: isLoading ? 8 : 0 }}>{isEdit ? 'Update plan' : 'Create plan'}</span>
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

function SectionHeader({
    title,
    icon,
    selectAllLabel,
    onSelectAll,
}: {
    title: string;
    icon?: React.ReactNode;
    selectAllLabel: string;
    onSelectAll: () => void;
}) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--notion-text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {icon}
                {title}
            </label>
            <button
                type="button"
                onClick={onSelectAll}
                style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
            >
                {selectAllLabel}
            </button>
        </div>
    );
}

function CheckboxRow({
    label,
    checked,
    onChange,
    accentColor,
}: {
    label: string;
    checked: boolean;
    onChange: () => void;
    accentColor: string;
}) {
    return (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor }} />
            <span style={{ color: 'var(--notion-text)' }}>{label}</span>
        </label>
    );
}

function CategoryCheckboxGrid({
    groups,
    selected,
    onToggle,
    onToggleCategory,
    accentColor,
}: {
    groups: Record<string, Feature[]>;
    selected: string[];
    onToggle: (id: string) => void;
    onToggleCategory: (items: Feature[]) => void;
    accentColor: string;
}) {
    const entries = Object.entries(groups);
    if (!entries.length) {
        return (
            <div style={{ fontSize: 13, color: 'var(--notion-text-muted)', padding: '8px 0' }}>
                No options available.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {entries.map(([category, items]) => (
                <div key={category} style={{ border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--notion-text-muted)',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                    }}>
                        {category}
                        <button
                            type="button"
                            onClick={() => onToggleCategory(items)}
                            style={{ background: 'none', border: 'none', color: 'var(--notion-blue)', fontSize: 10, cursor: 'pointer' }}
                        >
                            {items.every(item => selected.includes(item.id)) ? 'None' : 'All'}
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {items.map(item => (
                            <CheckboxRow
                                key={item.id}
                                label={item.label}
                                checked={selected.includes(item.id)}
                                onChange={() => onToggle(item.id)}
                                accentColor={accentColor}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
