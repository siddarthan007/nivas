'use client';

import { createContext, useContext, type ReactNode } from 'react';

const DashboardShellContext = createContext(false);

export function useDashboardShellMounted() {
    return useContext(DashboardShellContext);
}

export function DashboardShellProvider({ children }: { children: ReactNode }) {
    return (
        <DashboardShellContext.Provider value={true}>
            {children}
        </DashboardShellContext.Provider>
    );
}
