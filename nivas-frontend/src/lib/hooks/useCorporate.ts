/**
 * Corporate API Hook
 * Connects to /crm endpoints for corporate accounts and travel agents
 */
import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { toast } from 'sonner';

export interface CorporateAccount {
    id: number;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    contractRate?: number;
    discountPercentage?: number;
    creditLimit?: number;
    totalBookings?: number;
    status: 'ACTIVE' | 'INACTIVE';
}

export interface TravelAgent {
    id: number;
    name: string;
    agencyName?: string;
    email?: string;
    phone?: string;
    commissionRate: number;
    totalReferrals?: number;
    status: 'ACTIVE' | 'INACTIVE';
}

export interface CreateCompanyPayload {
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    contractRate?: number;
    discountPercentage?: number;
    creditLimit?: number;
}

export interface CreateAgentPayload {
    name: string;
    agencyName?: string;
    email?: string;
    phone?: string;
    commissionRate: number;
}

export interface UseCorporateReturn {
    companies: CorporateAccount[];
    agents: TravelAgent[];
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    createCompany: (payload: CreateCompanyPayload) => Promise<boolean>;
    createAgent: (payload: CreateAgentPayload) => Promise<boolean>;
    updateCompany: (id: number, payload: Partial<CreateCompanyPayload>) => Promise<boolean>;
    updateAgent: (id: number, payload: Partial<CreateAgentPayload>) => Promise<boolean>;
    deleteCompany: (id: number) => Promise<boolean>;
    deleteAgent: (id: number) => Promise<boolean>;
}

export function useCorporate(): UseCorporateReturn {
    const [companies, setCompanies] = useState<CorporateAccount[]>([]);
    const [agents, setAgents] = useState<TravelAgent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAll = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [companiesRes, agentsRes] = await Promise.all([
                api.get<CorporateAccount[]>('/crm/companies'),
                api.get<TravelAgent[]>('/crm/agents')
            ]);

            if (companiesRes.data) setCompanies(companiesRes.data);
            if (agentsRes.data) setAgents(agentsRes.data);
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to fetch corporate data';
            setError(message);
            console.error('[useCorporate]', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createCompany = useCallback(async (payload: CreateCompanyPayload): Promise<boolean> => {
        try {
            const response = await api.post<CorporateAccount>('/crm/companies', payload);
            if (response.data) {
                setCompanies(prev => [...prev, response.data!]);
                toast.success('Corporate account created');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to create corporate account';
            toast.error(message);
            return false;
        }
    }, []);

    const createAgent = useCallback(async (payload: CreateAgentPayload): Promise<boolean> => {
        try {
            const response = await api.post<TravelAgent>('/crm/agents', payload);
            if (response.data) {
                setAgents(prev => [...prev, response.data!]);
                toast.success('Travel agent added');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to add travel agent';
            toast.error(message);
            return false;
        }
    }, []);

    const updateCompany = useCallback(async (id: number, payload: Partial<CreateCompanyPayload>): Promise<boolean> => {
        try {
            const response = await api.patch<CorporateAccount>(`/crm/companies/${id}`, payload);
            if (response.data) {
                setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...response.data } : c));
                toast.success('Corporate account updated');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update corporate account';
            toast.error(message);
            return false;
        }
    }, []);

    const updateAgent = useCallback(async (id: number, payload: Partial<CreateAgentPayload>): Promise<boolean> => {
        try {
            const response = await api.patch<TravelAgent>(`/crm/agents/${id}`, payload);
            if (response.data) {
                setAgents(prev => prev.map(a => a.id === id ? { ...a, ...response.data } : a));
                toast.success('Travel agent updated');
                return true;
            }
            return false;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to update travel agent';
            toast.error(message);
            return false;
        }
    }, []);

    const deleteCompany = useCallback(async (id: number): Promise<boolean> => {
        try {
            await api.delete(`/crm/companies/${id}`);
            setCompanies(prev => prev.filter(c => c.id !== id));
            toast.success('Corporate account removed');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to delete corporate account';
            toast.error(message);
            return false;
        }
    }, []);

    const deleteAgent = useCallback(async (id: number): Promise<boolean> => {
        try {
            await api.delete(`/crm/agents/${id}`);
            setAgents(prev => prev.filter(a => a.id !== id));
            toast.success('Travel agent removed');
            return true;
        } catch (e) {
            const message = e instanceof ApiError ? e.message : 'Failed to delete travel agent';
            toast.error(message);
            return false;
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    return {
        companies,
        agents,
        isLoading,
        error,
        refresh: fetchAll,
        createCompany,
        createAgent,
        updateCompany,
        updateAgent,
        deleteCompany,
        deleteAgent
    };
}

export default useCorporate;
