import { useColorScheme } from 'nativewind';

/** Semantic colors for icons / borders where Tailwind className on Lucide is unreliable. */
export function useAppColors() {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    return {
        isDark,
        text: isDark ? '#f0efed' : '#37352f',
        textMuted: isDark ? 'rgba(255,255,255,0.55)' : '#6f6e6b',
        bg: isDark ? '#191919' : '#ffffff',
        bgSecondary: isDark ? '#252525' : '#f7f7f5',
        bgTertiary: isDark ? '#2f2f2f' : '#edece9',
        border: isDark ? 'rgba(255,255,255,0.08)' : '#e9e9e7',
        accent: isDark ? '#5eb3e8' : '#2eaadc',
        segmentActive: isDark ? '#383838' : '#ffffff',
        segmentTrack: isDark ? 'rgba(255,255,255,0.06)' : '#f7f7f5',
        tabBar: isDark ? '#191919' : '#ffffff',
        tabBarBorder: isDark ? 'rgba(255,255,255,0.08)' : '#e9e9e7',
    };
}
