import { useState, useCallback } from 'react';
import api from '../api';
import { toast } from 'sonner';

// Types
export interface Guest {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    fullName?: string;
    phone?: string;
    uniqueId?: string;
    preferences?: any;
    tags?: string[];
    isVip: boolean;
    createdAt: string;
    stays?: number;
    totalStays?: number;
    totalSpend?: number;
}

export interface GuestHistory {
    bookings: any[];
    orders: any[];
    totalSpend: number;
}

export interface Message {
    id: number;
    senderId: string;
    receiverId?: string;
    roomId?: number;
    content: string;
    messageType?: string;
    createdAt: string;
    isRead: boolean;
}

export interface Company {
    id: number;
    hotelId: number;
    companyName: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    contractRate?: number;
    discountPercentage?: number;
    creditLimit?: number;
    createdAt: string;
}

export interface TravelAgent {
    id: number;
    hotelId: number;
    name: string;
    agencyName?: string;
    email?: string;
    phone?: string;
    commissionRate: number;
    createdAt: string;
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

export interface UpdateCompanyPayload {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    contractRate?: number;
    discountPercentage?: number;
    creditLimit?: number;
}

export interface UpdateAgentPayload {
    name?: string;
    agencyName?: string;
    email?: string;
    phone?: string;
    commissionRate?: number;
}

export interface LedgerEntry {
    id: number;
    entryType: string;
    description: string;
    debit: string;
    credit: string;
    balance: string;
    referenceId?: string;
    referenceType?: string;
    createdAt: string;
    createdBy?: { name: string };
}

export interface CompanyLedger {
    company: Company;
    entries: LedgerEntry[];
    balance: number;
}

export interface SendMessagePayload {
    receiverId?: string;
    roomId?: number;
    content: string;
    messageType?: string;
}

export function useCRM() {
    const [guests, setGuests] = useState<Guest[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [agents, setAgents] = useState<TravelAgent[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [companyLedger, setCompanyLedger] = useState<CompanyLedger | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Guests
    const searchGuests = useCallback(async (search?: string) => {
        setIsLoading(true);
        try {
            const url = search ? `/crm/guests?search=${encodeURIComponent(search)}` : '/crm/guests';
            const res = await api.get<Guest[]>(url);
            setGuests(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to search guests');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const getGuestHistory = async (guestId: string) => {
        try {
            const res = await api.get<GuestHistory>(`/crm/guests/${guestId}/history`);
            return res.data;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch guest history');
            return null;
        }
    };

    const updateGuestProfile = async (guestId: string, data: { preferences?: any; tags?: string[]; isVip?: boolean }) => {
        setIsLoading(true);
        try {
            await api.patch(`/crm/guests/${guestId}`, data);
            await searchGuests();
            toast.success('Guest profile updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update guest');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Corporate
    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<Company[]>('/crm/companies');
            setCompanies(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch companies');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createCompany = async (data: CreateCompanyPayload) => {
        setIsLoading(true);
        try {
            await api.post('/crm/companies', data);
            await fetchCompanies();
            toast.success('Company created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create company');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateCompany = async (companyId: number, data: UpdateCompanyPayload) => {
        setIsLoading(true);
        try {
            await api.patch(`/crm/companies/${companyId}`, data);
            await fetchCompanies();
            toast.success('Company updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update company');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteCompany = async (companyId: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/crm/companies/${companyId}`);
            await fetchCompanies();
            toast.success('Company deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete company');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAgents = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<TravelAgent[]>('/crm/agents');
            setAgents(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch agents');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const createAgent = async (data: CreateAgentPayload) => {
        setIsLoading(true);
        try {
            await api.post('/crm/agents', data);
            await fetchAgents();
            toast.success('Agent created');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create agent');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const updateAgent = async (agentId: number, data: UpdateAgentPayload) => {
        setIsLoading(true);
        try {
            await api.patch(`/crm/agents/${agentId}`, data);
            await fetchAgents();
            toast.success('Agent updated');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update agent');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const deleteAgent = async (agentId: number) => {
        setIsLoading(true);
        try {
            await api.delete(`/crm/agents/${agentId}`);
            await fetchAgents();
            toast.success('Agent deleted');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete agent');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Messages
    const fetchInbox = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.get<Message[]>('/messages/inbox');
            setMessages(res.data || []);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch messages');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const sendMessage = async (data: SendMessagePayload) => {
        setIsLoading(true);
        try {
            await api.post('/messages', data);
            await fetchInbox();
            toast.success('Message sent');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to send message');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCompanyLedger = async (companyId: number) => {
        setIsLoading(true);
        try {
            const res = await api.get<CompanyLedger>(`/crm/companies/${companyId}/ledger`);
            setCompanyLedger(res.data || null);
            return res.data || null;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to fetch ledger');
            return null;
        } finally {
            setIsLoading(false);
        }
    };

    const addLedgerEntry = async (companyId: number, data: { entryType: string; description: string; debit?: number; credit?: number; referenceId?: string; referenceType?: string }) => {
        setIsLoading(true);
        try {
            await api.post(`/crm/companies/${companyId}/ledger`, data);
            await fetchCompanyLedger(companyId);
            toast.success('Ledger entry added');
            return true;
        } catch (err: any) {
            toast.error(err?.message || 'Failed to add ledger entry');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        // State
        guests,
        companies,
        agents,
        messages,
        companyLedger,
        isLoading,
        // Guests
        searchGuests,
        getGuestHistory,
        updateGuestProfile,
        // Corporate
        fetchCompanies,
        createCompany,
        updateCompany,
        deleteCompany,
        fetchAgents,
        createAgent,
        updateAgent,
        deleteAgent,
        fetchCompanyLedger,
        addLedgerEntry,
        // Messages
        fetchInbox,
        sendMessage
    };
}
