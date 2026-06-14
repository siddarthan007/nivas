import type { Feature, AvailableRole } from '@/lib/hooks/usePlans';

export interface PlanLabelMaps {
    features: Record<string, string>;
    modules: Record<string, string>;
    roles: Record<string, string>;
}

export function buildPlanLabelMaps(
    features: Feature[],
    modules: Feature[],
    roles: AvailableRole[],
): PlanLabelMaps {
    return {
        features: Object.fromEntries(features.map(f => [f.id, f.label])),
        modules: Object.fromEntries(modules.map(m => [m.id, m.label])),
        roles: Object.fromEntries(roles.map(r => [r.id, r.label])),
    };
}

export function resolvePlanLabels(ids: string[] | undefined, map: Record<string, string>): string[] {
    if (!ids?.length) return [];
    return ids.map(id => map[id] || id);
}
