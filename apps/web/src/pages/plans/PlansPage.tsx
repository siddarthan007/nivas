'use client';

import { useState, useMemo } from 'react';
import Button from '@/components/ui/Button';
import { usePlans, type SubscriptionPackage } from '@/lib/hooks/usePlans';
import { PlanModal } from '@/components/features/plans/PlanModal';
import type { PlanFormPayload } from '@/components/features/plans/PlanModal';
import { buildPlanLabelMaps, resolvePlanLabels } from '@/lib/utils/planLabels';
import { toast } from 'sonner';
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
    RefreshCw,
    Shield,
    LayoutGrid,
} from 'lucide-react';

function PlanCard({
    plan,
    labelMaps,
    onEdit,
    onToggleStatus,
}: {
    plan: SubscriptionPackage;
    labelMaps: ReturnType<typeof buildPlanLabelMaps>;
    onEdit: () => void;
    onToggleStatus: () => void;
}) {
    const monthlyPrice = parseFloat(plan.monthlyPrice || '0');
    const annualPrice = plan.annualPrice ? parseFloat(plan.annualPrice) : null;
    const moduleLabels = resolvePlanLabels(plan.modules, labelMaps.modules);
    const roleLabels = resolvePlanLabels(plan.allowedRoles, labelMaps.roles);
    const featureLabels = resolvePlanLabels(plan.features, labelMaps.features);

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-5)',
            opacity: plan.isActive ? 1 : 0.6,
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{
                        width: 44,
                        height: 44,
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
                        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--notion-text)' }}>{plan.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--notion-text-secondary)', fontFamily: 'ui-monospace, monospace' }}>{plan.code}</div>
                    </div>
                </div>
                <span style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: 11,
                    fontWeight: 500,
                    backgroundColor: plan.isActive ? 'var(--notion-green-bg)' : 'var(--notion-red-bg)',
                    color: plan.isActive ? 'var(--notion-green)' : 'var(--notion-red)',
                }}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            {plan.description && (
                <p style={{ fontSize: 13, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                    {plan.description}
                </p>
            )}

            <div style={{
                display: 'flex',
                gap: 'var(--space-4)',
                marginBottom: 'var(--space-4)',
                padding: 'var(--space-3)',
                backgroundColor: 'var(--notion-bg-tertiary)',
                borderRadius: 'var(--radius-md)',
            }}>
                <div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--notion-text)' }}>
                        NPR {(monthlyPrice || 0).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>per month</div>
                </div>
                {annualPrice != null && annualPrice > 0 && (
                    <div style={{ borderLeft: '1px solid var(--notion-border)', paddingLeft: 'var(--space-4)' }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--notion-text)' }}>
                            NPR {annualPrice.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--notion-text-muted)' }}>per year</div>
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <DoorOpen size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <span style={{ color: 'var(--notion-text)' }}>{plan.maxRooms || '∞'} rooms</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <Users size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <span style={{ color: 'var(--notion-text)' }}>{plan.maxUsers || '∞'} users</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                    <Calendar size={14} style={{ color: 'var(--notion-text-muted)' }} />
                    <span style={{ color: 'var(--notion-text)' }}>{plan.trialDays} days trial</span>
                </div>
            </div>

            {moduleLabels.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <LayoutGrid size={10} style={{ display: 'inline', marginRight: 4 }} />
                        Modules ({moduleLabels.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {moduleLabels.map(mod => (
                            <span key={mod} style={{ padding: '2px 8px', fontSize: 11, backgroundColor: 'var(--notion-blue-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--notion-blue)' }}>
                                {mod}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {roleLabels.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        <Shield size={10} style={{ display: 'inline', marginRight: 4 }} />
                        Roles ({roleLabels.length})
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {roleLabels.map(role => (
                            <span key={role} style={{ padding: '2px 8px', fontSize: 11, backgroundColor: 'var(--notion-purple-bg, rgba(167,130,195,0.15))', borderRadius: 'var(--radius-sm)', color: 'var(--notion-purple, #9B6FC3)' }}>
                                {role}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {featureLabels.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--notion-text-muted)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Features
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {featureLabels.map(feature => (
                            <span key={feature} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: 11, backgroundColor: 'var(--notion-bg-tertiary)', borderRadius: 'var(--radius-sm)', color: 'var(--notion-text-secondary)' }}>
                                <CheckCircle size={10} style={{ color: 'var(--notion-green)' }} />
                                {feature}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)', borderTop: '1px solid var(--notion-divider)', paddingTop: 'var(--space-3)' }}>
                <Button size="sm" variant="secondary" onClick={onToggleStatus} style={{ flex: 1 }}>
                    {plan.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    <span style={{ marginLeft: 4 }}>{plan.isActive ? 'Deactivate' : 'Activate'}</span>
                </Button>
                <Button size="sm" variant="secondary" onClick={onEdit}>
                    <Edit size={14} />
                </Button>
            </div>
        </div>
    );
}

export default function PlansPage() {
    const { plans, features, modules, availableRoles, isLoading, fetchPlans, createPlan, updatePlan, togglePlanStatus } = usePlans();
    const [modalPlan, setModalPlan] = useState<Partial<SubscriptionPackage> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const labelMaps = useMemo(
        () => buildPlanLabelMaps(features, modules, availableRoles),
        [features, modules, availableRoles],
    );

    const handleSave = async (data: PlanFormPayload) => {
        setIsSaving(true);
        try {
            if (modalPlan?.id) {
                const { code: _code, ...updateData } = data;
                await updatePlan(modalPlan.id, updateData);
                toast.success('Plan updated');
            } else {
                await createPlan(data);
                toast.success('Plan created');
            }
            setModalPlan(null);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save plan');
            throw err;
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleStatus = async (plan: SubscriptionPackage) => {
        const ok = await togglePlanStatus(plan.id, !plan.isActive);
        if (ok) toast.success(plan.isActive ? 'Plan deactivated' : 'Plan activated');
    };

    return (
        <>
            <div style={{ padding: 'var(--space-8)', maxWidth: '1400px', margin: '0 auto' }}>
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
                            <Package size={28} />
                            Subscription Plans
                        </h1>
                        <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                            Manage subscription packages, pricing, modules, roles, and feature toggles for tenants.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button variant="secondary" onClick={() => fetchPlans()} disabled={isLoading}>
                            <RefreshCw size={14} style={{ marginRight: 6 }} />
                            Refresh
                        </Button>
                        <Button onClick={() => setModalPlan({})}>
                            <Plus size={16} style={{ marginRight: 6 }} />
                            New plan
                        </Button>
                    </div>
                </div>

                {isLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{ height: 300, backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        ))}
                    </div>
                ) : plans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 'var(--space-12)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                        <Package size={48} style={{ color: 'var(--notion-text-muted)', marginBottom: 'var(--space-4)' }} />
                        <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>
                            No plans created yet
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-4)' }}>
                            Create your first subscription plan with modules, roles, and features.
                        </p>
                        <Button onClick={() => setModalPlan({})}>
                            <Plus size={16} style={{ marginRight: 6 }} />
                            Create first plan
                        </Button>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)' }}>
                        {plans.map(plan => (
                            <PlanCard
                                key={plan.id}
                                plan={plan}
                                labelMaps={labelMaps}
                                onEdit={() => setModalPlan(plan)}
                                onToggleStatus={() => handleToggleStatus(plan)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <PlanModal
                plan={modalPlan}
                isOpen={modalPlan !== null}
                onClose={() => setModalPlan(null)}
                onSave={handleSave}
                isLoading={isSaving}
                featuresList={features}
                modulesList={modules}
                rolesList={availableRoles}
            />
        </>
    );
}
