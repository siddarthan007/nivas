'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { api, tokenStorage, ApiError } from '@/lib/api';
import { clearPlanCache } from '@/lib/hooks/useHotelPlan';

export type UserType = 'SUPER_ADMIN' | 'HOTEL_STAFF' | 'GUEST';

export interface User {
    id: string;
    name: string;
    email?: string;
    role?: string;
    hotelId?: number | null;
    userType: UserType;
    permissions: string[];
}

interface LoginResponse {
    token: string;
    user: {
        id: string;
        name: string;
        role?: string;
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
        permissions: string[];
    };
}

interface ImpersonationState {
    isImpersonating: boolean;
    hotelName: string;
    hotelId: number | null;
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
        role: data.role?.name,
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

            const restoredToken = getCookie('restored_token');
            if (restoredToken) {
                tokenStorage.setToken(restoredToken);
                deleteCookie('restored_token');

                localStorage.removeItem('impersonation_mode');
                localStorage.removeItem('impersonation_hotel');
                localStorage.removeItem('impersonation_hotel_id');
                deleteCookie('impersonation_active');
                deleteCookie('impersonation_hotel');
                deleteCookie('impersonation_token');

                isImpersonating = false;
            }

            const impersonationToken = getCookie('impersonation_token');
            if (impersonationToken) {
                tokenStorage.setToken(impersonationToken);
                deleteCookie('impersonation_token');
                isImpersonating = true;

                const hotelNameCookie = getCookie('impersonation_hotel');
                impersonationHotelName = hotelNameCookie
                    ? decodeURIComponent(hotelNameCookie)
                    : 'Hotel';

                localStorage.setItem('impersonation_mode', 'true');
                localStorage.setItem('impersonation_hotel', impersonationHotelName);
            }

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
                }
            }

            if (isImpersonating) {
                const hotelIdStr = localStorage.getItem('impersonation_hotel_id');
                setImpersonation({
                    isImpersonating: true,
                    hotelName: impersonationHotelName,
                    hotelId: hotelIdStr ? parseInt(hotelIdStr, 10) : null,
                });
            } else {
                setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
            }

            const token = tokenStorage.getToken();
            if (token) {
                try {
                    await refreshProfile();
                } catch {
                    tokenStorage.removeToken();
                }
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
    }, [refreshProfile, user]);

    const login = useCallback(async (email: string, password: string) => {
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
        try {
            const response = await api.post<LoginResponse>('/iam/verify-otp', {
                userId,
                otp,
            });

            if (response.data?.token) {
                tokenStorage.setToken(response.data.token);
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
            await api.post('/super-admin/end-impersonate');

            localStorage.removeItem('impersonation_mode');
            localStorage.removeItem('impersonation_hotel');
            localStorage.removeItem('impersonation_hotel_id');

            deleteCookie('impersonation_active');
            deleteCookie('impersonation_hotel');
            deleteCookie('impersonation_token');

            window.location.href = '/dashboard/tenants';
        } catch {
            tokenStorage.removeToken();
            localStorage.removeItem('impersonation_mode');
            localStorage.removeItem('impersonation_hotel');
            localStorage.removeItem('impersonation_hotel_id');
            deleteCookie('impersonation_active');
            deleteCookie('impersonation_hotel');
            deleteCookie('impersonation_token');
            deleteCookie('restored_token');
            window.location.href = '/login';
        }
    }, []);

    const logout = useCallback(() => {
        tokenStorage.removeToken();
        clearPlanCache();
        localStorage.removeItem('impersonation_mode');
        localStorage.removeItem('impersonation_hotel');
        localStorage.removeItem('impersonation_hotel_id');
        deleteCookie('impersonation_active');
        deleteCookie('impersonation_hotel');
        deleteCookie('impersonation_token');
        deleteCookie('restored_token');
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