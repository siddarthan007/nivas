import { useCallback, useSyncExternalStore, useMemo } from "react";

/**
 * Lightweight router utilities for Bun + React
 * Replaces Next.js navigation hooks
 */

// Subscribe to popstate events for pathname changes
function subscribeToPathname(callback: () => void) {
    window.addEventListener("popstate", callback);
    return () => window.removeEventListener("popstate", callback);
}

function getPathname() {
    return typeof window !== "undefined" ? window.location.pathname : "/";
}

function getSearchString() {
    return typeof window !== "undefined" ? window.location.search : "";
}

/**
 * Hook to get current pathname - reacts to navigation changes
 */
export function usePathname(): string {
    return useSyncExternalStore(subscribeToPathname, getPathname, () => "/");
}

/**
 * Hook to get search params
 * Returns a stable URLSearchParams object that only changes when search string changes
 */
export function useSearchParams(): URLSearchParams {
    const searchString = useSyncExternalStore(subscribeToPathname, getSearchString, () => "");
    return useMemo(() => new URLSearchParams(searchString), [searchString]);
}

interface RouterInstance {
    push: (url: string) => void;
    replace: (url: string) => void;
    refresh: () => void;
    back: () => void;
    forward: () => void;
}

/**
 * Hook for programmatic navigation
 */
export function useRouter(): RouterInstance {
    const push = useCallback((url: string) => {
        window.history.pushState({}, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
    }, []);

    const replace = useCallback((url: string) => {
        window.history.replaceState({}, "", url);
        window.dispatchEvent(new PopStateEvent("popstate"));
    }, []);

    const refresh = useCallback(() => {
        window.location.reload();
    }, []);

    const back = useCallback(() => {
        window.history.back();
    }, []);

    const forward = useCallback(() => {
        window.history.forward();
    }, []);

    return { push, replace, refresh, back, forward };
}

/**
 * Simple prefetch utility - fetches URL in background
 */
export async function prefetch(url: string): Promise<void> {
    try {
        await fetch(url, { priority: "low" } as RequestInit);
    } catch {
        // Silently fail - prefetch is best-effort
    }
}
