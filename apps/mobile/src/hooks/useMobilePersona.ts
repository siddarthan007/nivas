import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import {
    fallbackPersonaFromRole,
    TAB_ROUTE_MAP,
    type MobilePersonaPayload,
    type LegacyMobileTabId,
    type MobileTabId,
} from '@/constants/mobilePersona';

function normalizeTabs(tabs: LegacyMobileTabId[]): MobileTabId[] {
    const out: MobileTabId[] = [];
    for (const tab of tabs) {
        const id: MobileTabId = tab === 'more' ? 'profile' : tab;
        if (!out.includes(id)) out.push(id);
    }
    return out;
}

export function useMobilePersona(): MobilePersonaPayload & {
    hasTab: (tab: MobileTabId) => boolean;
    tabRoutes: { name: string; href: string; id: MobileTabId }[];
} {
    const { user, mobile } = useAuthStore();

    const payload = useMemo(() => {
        if (mobile?.persona && mobile.tabs?.length) return mobile;
        return fallbackPersonaFromRole(user?.role ?? '');
    }, [mobile, user?.role]);

    const tabRoutes = useMemo(
        () =>
            normalizeTabs(payload.tabs)
                .filter((tab) => TAB_ROUTE_MAP[tab])
                .map((tab) => ({ id: tab, ...TAB_ROUTE_MAP[tab] })),
        [payload.tabs],
    );

    const hasTab = (tab: MobileTabId) => normalizeTabs(payload.tabs).includes(tab);

    return {
        ...payload,
        hasTab,
        tabRoutes,
    };
}

export default useMobilePersona;
