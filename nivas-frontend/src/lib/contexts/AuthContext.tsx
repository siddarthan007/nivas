'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api, tokenStorage, ApiError } from '@/lib/api';

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
    userId?: string;
    debugOtp?: string;
    message: string;
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
    endImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

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

    const buildUserFromProfile = (data: ProfileResponse): User => ({
        id: data.id,
        name: data.fullName,
        email: data.email,
        role: data.role?.name,
        hotelId: data.hotelId,
        userType: data.userType,
        permissions: data.role?.permissions || [],
    });

    // Initialize auth state from storage
    useEffect(() => {
        const initAuth = async () => {
            let isImpersonating = false;
            let impersonationHotelName = '';

            // ── Step 1: Check for restored_token cookie (Return to Admin) ──
            // Backend sets this non-HttpOnly cookie when ending impersonation.
            const restoredToken = getCookie('restored_token');
            if (restoredToken) {
                tokenStorage.setToken(restoredToken);
                deleteCookie('restored_token');

                // Clear all impersonation state
                localStorage.removeItem('impersonation_mode');
                localStorage.removeItem('impersonation_hotel');
                localStorage.removeItem('impersonation_hotel_id');
                deleteCookie('impersonation_active');
                deleteCookie('impersonation_hotel');
                deleteCookie('impersonation_token');

                isImpersonating = false;
            }

            // ── Step 2: Check for impersonation_token cookie (Start Impersonation) ──
            // Backend sets this non-HttpOnly cookie during impersonation.
            const impersonationToken = getCookie('impersonation_token');
            if (impersonationToken) {
                tokenStorage.setToken(impersonationToken);
                deleteCookie('impersonation_token');
                isImpersonating = true;

                // Read hotel name from cookie (backend always sets this)
                const hotelNameCookie = getCookie('impersonation_hotel');
                impersonationHotelName = hotelNameCookie
                    ? decodeURIComponent(hotelNameCookie)
                    : 'Hotel';

                // Sync to localStorage for persistence across SPA navigations
                localStorage.setItem('impersonation_mode', 'true');
                localStorage.setItem('impersonation_hotel', impersonationHotelName);
            }

            // ── Step 3: Check existing impersonation state ──
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

            // ── Step 4: Apply impersonation state ──
            if (isImpersonating) {
                const hotelIdStr = localStorage.getItem('impersonation_hotel_id');
                setImpersonation({
                    isImpersonating: true,
                    hotelName: impersonationHotelName,
                    hotelId: hotelIdStr ? parseInt(hotelIdStr) : null,
                });
            } else {
                setImpersonation({ isImpersonating: false, hotelName: '', hotelId: null });
            }

            // ── Step 5: Fetch user profile ──
            const token = tokenStorage.getToken();
            if (token) {
                try {
                    const response = await api.get<ProfileResponse>('/iam/profile');
                    if (response.data) {
                        const freshUser = buildUserFromProfile(response.data);
                        setUser(freshUser);
                        tokenStorage.setUser(freshUser);
                    }
                } catch {
                    tokenStorage.removeToken();
                }
            }

            setIsLoading(false);
        };

        initAuth();
    }, []);

    // Periodic token validation (every 10 minutes)
    useEffect(() => {
        if (!user) return;

        const interval = setInterval(async () => {
            try {
                const response = await api.get<ProfileResponse>('/iam/profile');
                if (response.data) {
                    const freshUser = buildUserFromProfile(response.data);
                    setUser(freshUser);
                    tokenStorage.setUser(freshUser);
                }
            } catch {
                tokenStorage.removeToken();
                setUser(null);
                window.location.href = '/login';
            }
        }, 10 * 60 * 1000);

        return () => clearInterval(interval);
    }, [user]);

    const login = useCallback(async (email: string, password: string) => {
        try {
            const response = await api.post<LoginResponse | TwoFAResponse>('/iam/login', {
                email,
                password,
            });

            const responseAny = response as unknown as { require2FA?: boolean; userId?: string; data?: LoginResponse | TwoFAResponse };

            if (responseAny.require2FA === true) {
                return {
                    success: true,
                    require2FA: true,
                    userId: responseAny.userId,
                };
            }

            if (response.data && 'require2FA' in response.data && response.data.require2FA) {
                return {
                    success: true,
                    require2FA: true,
                    userId: response.data.userId,
                };
            }

            const token = (responseAny as { token?: string }).token || (response.data as LoginResponse)?.token;
            if (token) {
                tokenStorage.setToken(token);

                const profileRes = await api.get<ProfileResponse>('/iam/profile');
                if (profileRes.data) {
                    const newUser = buildUserFromProfile(profileRes.data);
                    setUser(newUser);
                    tokenStorage.setUser(newUser);
                }

                return { success: true };
            }

            return { success: false, error: 'Invalid response from server' };
        } catch (error) {
            if (error instanceof ApiError) {
                return { success: false, error: error.message };
            }
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, []);

    const verifyOTP = useCallback(async (userId: string, otp: string) => {
        try {
            const response = await api.post<LoginResponse>('/iam/verify-otp', {
                userId,
                otp,
            });

            if (response.data?.token) {
                tokenStorage.setToken(response.data.token);

                const profileRes = await api.get<ProfileResponse>('/iam/profile');
                if (profileRes.data) {
                    const newUser = buildUserFromProfile(profileRes.data);
                    setUser(newUser);
                    tokenStorage.setUser(newUser);
                }

                return { success: true };
            }

            return { success: false, error: 'Invalid response from server' };
        } catch (error) {
            if (error instanceof ApiError) {
                return { success: false, error: error.message };
            }
            return { success: false, error: 'Verification failed. Please try again.' };
        }
    }, []);

    const endImpersonation = useCallback(async () => {
        try {
            // Call backend -- it sets restored_token cookie + clears impersonation cookies
            await api.post('/super-admin/end-impersonate');

            // Clear localStorage impersonation flags
            localStorage.removeItem('impersonation_mode');
            localStorage.removeItem('impersonation_hotel');
            localStorage.removeItem('impersonation_hotel_id');

            // Clear non-HttpOnly cookies we can reach from JS
            deleteCookie('impersonation_active');
            deleteCookie('impersonation_hotel');
            deleteCookie('impersonation_token');

            // Full page reload. On reload, initAuth will:
            // 1. Find the restored_token cookie (set by backend)
            // 2. Store it in localStorage as the auth token
            // 3. Clear impersonation state
            // 4. Fetch the admin profile
            window.location.href = '/dashboard/tenants';
        } catch {
            // Fallback: clear everything and redirect to login
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

    return (
        <AuthContext.Provider
            value={{
                user,
                isAuthenticated: !!user,
                isLoading,
                impersonation,
                login,
                verifyOTP,
                logout,
                hasPermission,
                endImpersonation,
            }}
        >
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
