'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { api, tokenStorage, ApiError } from '@/lib/api';
import { clearPlanCache } from '@/lib/hooks/useHotelPlan';

export type UserType = 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';

export interface User {
    id: string;
    name: string;
    email?: string;
    role?: {
        id: number;
        name: string;
        level: number;
    };
    hotelId?: number | null;
    userType: UserType;
    permissions: string[];
}

interface LoginResponse {
    token: string;
    user: {
        id: string;
        name: string;
        role?: {
            id: number;
            name: string;
            level: number;
        };
    };
}

interface TwoFAResponse {
    require2FA: true;
    userId: string;
}

interface ProfileResponse {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    hotelId: number | null;
    userType: UserType;
    isActive: boolean;
    role?: {
        id: number;
        name: string;
        level: number;
        permissions: string[];
    };
}

interface ImpersonationState {
    isImpersonating: boolean;
    hotelName: string;
    hotelId: number | null;
    impersonationId?: string;
}

interface AuthContextValue {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    impersonation: ImpersonationState;
    login: (email: string, password: string) => Promise<{ success: boolean; require2FA?: boolean; userId?: string; error?: string }>;
    verifyOTP: (userId: string, otp: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    hasPermission: (permission: string) => boolean;
    refreshProfile: () => Promise<User | null>;
    endImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildUserFromProfile(data: ProfileResponse): User {
    return {
        id: data.id,
        name: data.fullName,
        email: data.email,
        role: data.role ? {
            id: data.role.id,
            name: data.role.name,
            level: data.role.level
        } : undefined,
        hotelId: data.hotelId,
        userType: data.userType,
        permissions: data.role?.permissions || [],
    };
}

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match && match[2] ? decodeURIComponent(match[2]) : null;
}

function deleteCookie(name: string): void {
    if (typeof document === 'undefined') return;
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function clearAllImpersonationState(): void {
    localStorage.removeItem('impersonation_mode');
    localStorage.removeItem('impersonation_hotel');
    localStorage.removeItem('impersonation_hotel_id');
    localStorage.removeItem('impersonation_id');
    deleteCookie('impersonation_active');
    deleteCookie('impersonation_hotel');
    deleteCookie('impersonation_token');
    deleteCookie('impersonation_id');
    deleteCookie('restored_token');
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [impersonation, setImpersonation] = useState<ImpersonationState>({
        isImpersonating: false,
        hotelName: '',
        hotelId: null,
    });

    const refreshProfile = useCallback(async (): Promise<User | null> => {
        const response = await api.get<ProfileResponse>('/iam/profile');
        if (!response.data) {
            return null;
        }

        const freshUser = buildUserFromProfile(response.data);
        setUser(freshUser);
        tokenStorage.setUser(freshUser);
        return freshUser;
    }, []);

    useEffect(() => {
        const initAuth = async () => {
            let isImpersonating = false;
            let impersonationHotelName = '';
            let impersonationId: string | undefined;

            // Returning from impersonation: restore admin token, purge all impersonation state
            const restoredToken = getCookie('restored_token');
            if (restoredToken) {
                tokenStorage.setToken(restoredToken);
                clearAllImpersonationState();
                isImpersonating = false;
            }

            // Fresh impersonation start from cookie (server-set redirect)
            const impersonationToken = getCookie('impersonation_token');
            if (impersonationToken) {
                tokenStorage.setToken(impersonationToken);
                deleteCookie('impersonation_token');
                isImpersonating = true;

                const hotelNameCookie = getCookie('impersonation_hotel');
                impersonationHotelName = hotelNameCookie ? decodeURIComponent(hotelNameCookie) : 'Hotel';
                impersonationId = getCookie('impersonation_id') || undefined;

                localStorage.setItem('impersonation_mode', 'true');
                localStorage.setItem('impersonation_hotel', impersonationHotelName);
                if (impersonationId) localStorage.setItem('impersonation_id', impersonationId);
            }

            // Recover from localStorage (page refresh during impersonation)
            if (!isImpersonating && !restoredToken) {
                const modeFromStorage = localStorage.getItem('impersonation_mode');
                const modeFromCookie = getCookie('impersonation_active');

                if (modeFromStorage === 'true' || modeFromCookie === 'true') {
                    isImpersonating = true;
                    const hotelNameCookie = getCookie('impersonation_hotel');
                    impersonationHotelName =
                        (hotelNameCookie ? decodeURIComponent(hotelNameCookie) : null)
                        || localStorage.getItem('impersonation_hotel')
                        || 'Hotel';
                    impersonationId = localStorage.getItem('impersonation_id') || undefined;
                }
            }

            if (isImpersonating) {
                const hotelIdStr = localStorage.getItem('impersonation_hotel_id');
                setImpersonation({
                    isImpersonating: true,
                    hotelName: impersonationHotelName,
                    hotelId: hotelIdStr ? parseInt(hotelIdStr, 10) : null,
                    impersonationId,
                });
            } else {
                setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
            }

            const token = tokenStorage.getToken();
            if (token) {
                try {
                    const freshUser = await refreshProfile();
                    if (freshUser) {
                        // SECURITY: Validate impersonation state against actual user identity
                        const storedMode = localStorage.getItem('impersonation_mode');
                        if (storedMode === 'true') {
                            const storedHotelId = localStorage.getItem('impersonation_hotel_id');
                            const storedId = localStorage.getItem('impersonation_id');

                            // Edge case 1: Super Admin logged in directly but impersonation flag is stale
                            if (freshUser.userType === 'SUPER_ADMIN') {
                                clearAllImpersonationState();
                                setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
                            }
                            // Edge case 2: Hotel user logged in but hotelId doesn't match
                            else if (storedHotelId && freshUser.hotelId !== parseInt(storedHotelId, 10)) {
                                clearAllImpersonationState();
                                setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
                            }
                            // Edge case 3: No token signature match (token changed since impersonation)
                            else if (storedId) {
                                try {
                                    const res = await api.get<{ valid: boolean }>('/super-admin/validate-impersonation');
                                    if (!res.data?.valid) {
                                        clearAllImpersonationState();
                                        setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
                                    }
                                } catch {
                                    // Network failure during validation: keep state but it will be re-checked on next profile refresh
                                }
                            }
                        }
                    }
                } catch {
                    tokenStorage.removeToken();
                    clearAllImpersonationState();
                    setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
                }
            } else {
                // No token but impersonation flags exist -> clear stale state
                clearAllImpersonationState();
                setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
            }

            setIsLoading(false);
        };

        void initAuth();
    }, [refreshProfile]);

    useEffect(() => {
        if (!user) return;

        const interval = setInterval(async () => {
            try {
                await refreshProfile();
            } catch {
                tokenStorage.removeToken();
                setUser(null);
                window.location.href = '/login';
            }
        }, 10 * 60 * 1000);

        return () => clearInterval(interval);
        // Depend only on whether a user is logged in (by id) — NOT the whole `user`
        // object. refreshProfile() updates `user`, so depending on `user` tore down
        // and restarted the timer every refresh, so the 10-min tick never fired.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id]);

    const login = useCallback(async (email: string, password: string) => {
        // SECURITY: Any fresh login must purge impersonation state to prevent stale ribbon
        clearAllImpersonationState();
        setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });

        try {
            const response = await api.post<LoginResponse | TwoFAResponse>('/iam/login', {
                email,
                password,
            });

            if (response.data && 'require2FA' in response.data && response.data.require2FA) {
                return {
                    success: true,
                    require2FA: true,
                    userId: response.data.userId,
                };
            }

            const loginData = response.data as LoginResponse;
            if (loginData?.token) {
                tokenStorage.setToken(loginData.token);
                if ((loginData as any).refreshToken) tokenStorage.setRefreshToken((loginData as any).refreshToken);
                await refreshProfile();
                return { success: true };
            }

            return { success: false, error: 'Invalid response from server' };
        } catch (error) {
            if (error instanceof ApiError) {
                return { success: false, error: error.message };
            }
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, [refreshProfile]);

    const verifyOTP = useCallback(async (userId: string, otp: string) => {
        // SECURITY: Any fresh auth must purge impersonation state
        clearAllImpersonationState();
        setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });

        try {
            const response = await api.post<LoginResponse>('/iam/verify-otp', {
                userId,
                otp,
            });

            if (response.data?.token) {
                tokenStorage.setToken(response.data.token);
                if ((response.data as any).refreshToken) tokenStorage.setRefreshToken((response.data as any).refreshToken);
                await refreshProfile();
                return { success: true };
            }

            return { success: false, error: 'Invalid response from server' };
        } catch (error) {
            if (error instanceof ApiError) {
                return { success: false, error: error.message };
            }
            return { success: false, error: 'Verification failed. Please try again.' };
        }
    }, [refreshProfile]);

    const endImpersonation = useCallback(async () => {
        try {
            const res = await api.post<{ restored: boolean; message?: string }>('/super-admin/end-impersonate');

            clearAllImpersonationState();

            if (res.data?.restored) {
                // Admin session restored successfully
                window.location.href = '/admin/tenants';
            } else {
                // Backup token missing/invalid — force re-authentication as admin
                tokenStorage.removeToken();
                window.location.href = '/login?reason=impersonation_expired';
            }
        } catch (err) {
            // If backend rejects (e.g., not in impersonation session, or backup invalid), force logout
            tokenStorage.removeToken();
            clearAllImpersonationState();
            const isForbidden = err instanceof ApiError && err.status === 403;
            window.location.href = isForbidden ? '/login?reason=impersonation_forbidden' : '/login?reason=impersonation_error';
        }
    }, []);

    const logout = useCallback(() => {
        tokenStorage.removeToken();
        clearPlanCache();
        clearAllImpersonationState();
        setUser(null);
        setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
        window.location.href = '/login';
    }, []);

    const hasPermission = useCallback((permission: string): boolean => {
        if (!user) return false;
        if (user.userType === 'SUPER_ADMIN') return true;
        if (user.permissions.includes('*')) return true;
        return user.permissions.includes(permission);
    }, [user]);

    const contextValue = useMemo<AuthContextValue>(() => ({
        user,
        isAuthenticated: !!user,
        isLoading,
        impersonation,
        login,
        verifyOTP,
        logout,
        hasPermission,
        refreshProfile,
        endImpersonation,
    }), [user, isLoading, impersonation, login, verifyOTP, logout, hasPermission, refreshProfile, endImpersonation]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export default AuthContext;