import { useState, useCallback, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type {
    UpdateBrandingPayload,
    UpdateContactPayload,
    UpdateTaxPayload,
    UpdateInvoicePayload,
    UpdateRegionalPayload,
} from '../types/api.types';

interface SettingsFeatures {
    enableGuestPortal: boolean;
    enableHousekeeping: boolean;
    enableInventory: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
}

export interface SettingsViewModel {
    branding?: {
        name?: string;
        logoUrl?: string;
        primaryColor?: string;
        secondaryColor?: string;
    };
    contact?: {
        address?: string;
        phone?: string;
        email?: string;
        website?: string;
    };
    tax?: {
        panNumber?: string;
        vatNumber?: string;
        serviceChargeRate?: number;
        taxRate?: number;
    };
    invoice?: {
        prefix?: string;
        footerText?: string;
        terms?: string;
    };
    regional?: {
        currency?: string;
        timezone?: string;
        dateFormat?: string;
        fiscalYearStart?: string;
        checkInTime?: string;
        checkOutTime?: string;
    };
    features?: Partial<SettingsFeatures>;
    name?: string;
    logo?: string;
    email?: string;
    phone?: string;
    address?: string;
    website?: string;
    checkInTime?: string;
    checkOutTime?: string;
    taxRate?: number;
    serviceCharge?: number;
    currency?: string;
    timezone?: string;
    invoicePrefix?: string;
    invoiceFooterText?: string;
    invoiceTerms?: string;
    enableGuestPortal?: boolean;
    enableHousekeeping?: boolean;
    enableInventory?: boolean;
    emailNotifications?: boolean;
    smsNotifications?: boolean;
}

function flattenSettings(raw: any): SettingsViewModel {
    const features = raw.features || {};

    return {
        ...raw,
        name: raw.branding?.name || '',
        logo: raw.branding?.logoUrl || '',
        address: raw.contact?.address || '',
        phone: raw.contact?.phone || '',
        email: raw.contact?.email || '',
        website: raw.contact?.website || '',
        serviceCharge: raw.tax?.serviceChargeRate ?? 10,
        taxRate: raw.tax?.taxRate ?? 13,
        currency: raw.regional?.currency || 'NPR',
        timezone: raw.regional?.timezone || 'Asia/Kathmandu',
        invoicePrefix: raw.invoice?.prefix || 'INV',
        invoiceFooterText: raw.invoice?.footerText || '',
        invoiceTerms: raw.invoice?.terms || '',
        checkInTime: raw.regional?.checkInTime || '14:00',
        checkOutTime: raw.regional?.checkOutTime || '11:00',
        enableGuestPortal: features.enableGuestPortal ?? false,
        enableHousekeeping: features.enableHousekeeping ?? true,
        enableInventory: features.enableInventory ?? true,
        emailNotifications: features.emailNotifications ?? true,
        smsNotifications: features.smsNotifications ?? false,
    };
}

export function useSettings() {
    const [settings, setSettings] = useState<SettingsViewModel | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            const userStr = localStorage.getItem('nivas_user_data');
            if (userStr) {
                const user = JSON.parse(userStr);
                if (user.userType === 'SUPER_ADMIN') {
                    setIsLoading(false);
                    return;
                }
            }
        } catch {
            // Continue with fetch.
        }

        setIsLoading(true);
        setError(null);
        try {
            const response = await api.get<any>('/settings');
            if (response.data) {
                setSettings(flattenSettings(response.data));
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to fetch settings');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        if (!successMessage) return;
        const timer = setTimeout(() => setSuccessMessage(null), 3000);
        return () => clearTimeout(timer);
    }, [successMessage]);

    const withRefresh = async (promise: Promise<unknown>, successText: string, errorText: string) => {
        setIsSaving(true);
        try {
            await promise;
            await fetchSettings();
            toast.success(successText);
            setSuccessMessage(successText);
            return true;
        } catch (err: any) {
            const message = err?.message || errorText;
            toast.error(message);
            setError(message);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const updateBranding = async (data: UpdateBrandingPayload & { name?: string }) => withRefresh(api.patch('/settings/branding', data), 'Branding updated successfully', 'Failed to update branding');
    const updateContact = async (data: UpdateContactPayload) => withRefresh(api.patch('/settings/contact', data), 'Contact settings updated successfully', 'Failed to update contact settings');
    const updateTax = async (data: UpdateTaxPayload) => withRefresh(api.patch('/settings/tax', data), 'Tax settings updated successfully', 'Failed to update tax settings');
    const updateInvoice = async (data: UpdateInvoicePayload) => withRefresh(api.patch('/settings/invoice', data), 'Invoice settings updated successfully', 'Failed to update invoice settings');
    const updateRegional = async (data: UpdateRegionalPayload & { checkInTime?: string; checkOutTime?: string }) => withRefresh(api.patch('/settings/regional', data), 'Regional settings updated successfully', 'Failed to update regional settings');

    const updateSettings = async (data: Record<string, any>) => {
        setIsSaving(true);
        setError(null);
        try {
            const requests: Promise<unknown>[] = [];
            const contactData: Record<string, any> = {};
            const taxData: Record<string, any> = {};
            const brandingData: Record<string, any> = {};
            const regionalData: Record<string, any> = {};
            const featuresData: Record<string, any> = {};

            if (data.email !== undefined) contactData.email = data.email;
            if (data.phone !== undefined) contactData.phone = data.phone;
            if (data.address !== undefined) contactData.address = data.address;
            if (data.website !== undefined) contactData.website = data.website;

            if (data.name !== undefined) brandingData.name = data.name;
            if (data.logo !== undefined) brandingData.logoUrl = data.logo;

            if (data.taxRate !== undefined) taxData.taxRate = data.taxRate;
            if (data.serviceCharge !== undefined) taxData.serviceChargeRate = data.serviceCharge;

            if (data.checkInTime !== undefined) regionalData.checkInTime = data.checkInTime;
            if (data.checkOutTime !== undefined) regionalData.checkOutTime = data.checkOutTime;
            if (data.currency !== undefined) regionalData.currency = data.currency;
            if (data.timezone !== undefined) regionalData.timezone = data.timezone;

            if (data.enableGuestPortal !== undefined) featuresData.enableGuestPortal = data.enableGuestPortal;
            if (data.enableHousekeeping !== undefined) featuresData.enableHousekeeping = data.enableHousekeeping;
            if (data.enableInventory !== undefined) featuresData.enableInventory = data.enableInventory;
            if (data.emailNotifications !== undefined) featuresData.emailNotifications = data.emailNotifications;
            if (data.smsNotifications !== undefined) featuresData.smsNotifications = data.smsNotifications;

            if (Object.keys(contactData).length > 0) requests.push(api.patch('/settings/contact', contactData));
            if (Object.keys(taxData).length > 0) requests.push(api.patch('/settings/tax', taxData));
            if (Object.keys(brandingData).length > 0) requests.push(api.patch('/settings/branding', brandingData));
            if (Object.keys(regionalData).length > 0) requests.push(api.patch('/settings/regional', regionalData));
            if (Object.keys(featuresData).length > 0) requests.push(api.patch('/settings/features', featuresData));

            await Promise.all(requests);
            await fetchSettings();
            toast.success('Settings saved successfully');
            setSuccessMessage('Settings saved successfully');
            return true;
        } catch (err: any) {
            const message = err?.message || 'Failed to save settings';
            setError(message);
            toast.error(message);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const toggleFeature = async (featureKey: keyof SettingsFeatures) => {
        if (!settings) return;
        const currentValue = settings[featureKey] ?? false;
        await updateSettings({ [featureKey]: !currentValue });
    };

    return {
        settings,
        isLoading,
        isSaving,
        error,
        successMessage,
        fetchSettings,
        updateSettings,
        toggleFeature,
        updateBranding,
        updateContact,
        updateTax,
        updateInvoice,
        updateRegional,
    };
}
