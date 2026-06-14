/** Semantic dashboard accent colors — mirror apps/mobile/src/styles/global.css tokens. */
export const DASHBOARD_COLORS = {
    blue: '#2eaadc',
    green: '#0f7b6c',
    orange: '#d9730d',
    red: '#e03e3e',
    purple: '#9065b0',
    muted: '#9b9a97',
} as const;

export type DashboardColorKey = keyof typeof DASHBOARD_COLORS;
