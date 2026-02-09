import { useState, useCallback, useEffect } from 'react';
import api from '../api';
import { toast } from 'sonner';
import type {
    TenantSettings,
    UpdateBrandingPayload,
    UpdateContactPayload,
    UpdateTaxPayload,
    UpdateInvoicePayload,
    UpdateRegionalPayload
} from '../types/api.types';

export function useSettings() {
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const fetchSettings = useCallback(async () => {
        try {
            const userStr = localStorage.getItem('nivas_user_data');
            if (userStr) {
                const u = JSON.parse(userStr);
                if (u.userType === 'SUPER_ADMIN') {
                    setIsLoading(false);
                    return;
                }
            }
        } catch { /* proceed */ }

        setIsLoading(true);
        setError(null);
        try {
            const res = await api.get<any>('/settings');
            const raw = res.data;
            if (raw) {
                // Flatten the nested backend response into a flat object for the frontend
                const flattened: any = {
                    ...raw,
                    name: raw.branding?.name || '',
                    logoUrl: raw.branding?.logoUrl || '',
                    primaryColor: raw.branding?.primaryColor || '',
                    secondaryColor: raw.branding?.secondaryColor || '',
                    address: raw.contact?.address || '',
                    phone: raw.contact?.phone || '',
                    email: raw.contact?.email || '',
                    website: raw.contact?.website || '',
                    panNumber: raw.tax?.panNumber || '',
                    vatNumber: raw.tax?.vatNumber || '',
                    serviceCharge: raw.tax?.serviceChargeRate ?? 10,
                    taxRate: raw.tax?.taxRate ?? 13,
                    currency: raw.regional?.currency || 'NPR',
                    timezone: raw.regional?.timezone || 'Asia/Kathmandu',
                    dateFormat: raw.regional?.dateFormat || 'DD/MM/YYYY',
                    invoicePrefix: raw.invoice?.prefix || 'INV',
                    invoiceFooterText: raw.invoice?.footerText || '',
                    invoiceTerms: raw.invoice?.terms || '',
                    checkInTime: raw.regional?.checkInTime || '14:00',
                    checkOutTime: raw.regional?.checkOutTime || '11:00',
                };
                setSettings(flattened);
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || err.message || 'Failed to fetch settings';
            setError(msg);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Auto-fetch settings on mount
    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // Clear success message after 3 seconds
    useEffect(() => {
        if (successMessage) {
            const timer = setTimeout(() => setSuccessMessage(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [successMessage]);

    const updateBranding = async (data: UpdateBrandingPayload) => {
        setIsSaving(true);
        try {
            await api.patch('/settings/branding', data);
            await fetchSettings();
            toast.success('Branding updated successfully');
            setSuccessMessage('Branding updated successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update branding');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const updateContact = async (data: UpdateContactPayload) => {
        setIsSaving(true);
        try {
            await api.patch('/settings/contact', data);
            await fetchSettings();
            toast.success('Contact settings updated successfully');
            setSuccessMessage('Contact settings updated successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update contact settings');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const updateTax = async (data: UpdateTaxPayload) => {
        setIsSaving(true);
        try {
            await api.patch('/settings/tax', data);
            await fetchSettings();
            toast.success('Tax settings updated successfully');
            setSuccessMessage('Tax settings updated successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update tax settings');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const updateInvoice = async (data: UpdateInvoicePayload) => {
        setIsSaving(true);
        try {
            await api.patch('/settings/invoice', data);
            await fetchSettings();
            toast.success('Invoice settings updated successfully');
            setSuccessMessage('Invoice settings updated successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update invoice settings');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const updateRegional = async (data: UpdateRegionalPayload) => {
        setIsSaving(true);
        try {
            await api.patch('/settings/regional', data);
            await fetchSettings();
            toast.success('Regional settings updated successfully');
            setSuccessMessage('Regional settings updated successfully');
            return true;
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to update regional settings');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Unified settings update method that delegates to specific endpoints based on data shape.
     * The SettingsPage uses this to save all settings at once.
     */
    const updateSettings = async (data: Record<string, any>) => {
        setIsSaving(true);
        setError(null);
        try {
            const contactData: Record<string, any> = {};
            const taxData: Record<string, any> = {};
            const brandingData: Record<string, any> = {};
            const regionalData: Record<string, any> = {};
            const featuresData: Record<string, any> = {};

            // Route fields to correct backend endpoints
            if (data.email !== undefined) contactData.email = data.email;
            if (data.phone !== undefined) contactData.phone = data.phone;
            if (data.address !== undefined) contactData.address = data.address;
            if (data.website !== undefined) contactData.website = data.website;

            if (data.name !== undefined) brandingData.name = data.name;
            if (data.logo !== undefined) brandingData.logoUrl = data.logo;

            if (data.taxRate !== undefined) taxData.taxRate = data.taxRate;
            if (data.serviceCharge !== undefined) taxData.serviceChargeRate = data.serviceCharge;

            // Operating hours go to regional
            if (data.checkInTime !== undefined) regionalData.checkInTime = data.checkInTime;
            if (data.checkOutTime !== undefined) regionalData.checkOutTime = data.checkOutTime;
            if (data.currency !== undefined) regionalData.currency = data.currency;
            if (data.timezone !== undefined) regionalData.timezone = data.timezone;

            // Notification / feature toggles
            if (data.emailNotifications !== undefined) featuresData.emailNotifications = data.emailNotifications;
            if (data.smsNotifications !== undefined) featuresData.smsNotifications = data.smsNotifications;

            const promises: Promise<any>[] = [];

            if (Object.keys(contactData).length > 0) {
                promises.push(api.patch('/settings/contact', contactData));
            }
            if (Object.keys(taxData).length > 0) {
                promises.push(api.patch('/settings/tax', taxData));
            }
            if (Object.keys(brandingData).length > 0) {
                promises.push(api.patch('/settings/branding', brandingData));
            }
            if (Object.keys(regionalData).length > 0) {
                promises.push(api.patch('/settings/regional', regionalData));
            }
            if (Object.keys(featuresData).length > 0) {
                promises.push(api.patch('/settings/features', featuresData));
            }

            await Promise.all(promises);
            await fetchSettings();
            toast.success('Settings saved successfully');
            setSuccessMessage('Settings saved successfully');
            return true;
        } catch (err: any) {
            const msg = err?.message || 'Failed to save settings';
            setError(msg);
            toast.error(msg);
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Toggle a feature flag for the current hotel
     */
    const toggleFeature = async (featureKey: string) => {
        if (!settings) return;

        const currentValue = (settings as any)[featureKey] ?? false;
        setIsSaving(true);
        try {
            await api.patch('/settings/features', {
                [featureKey]: !currentValue,
            });
            await fetchSettings();
            toast.success(`Feature ${!currentValue ? 'enabled' : 'disabled'}`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to toggle feature');
        } finally {
            setIsSaving(false);
        }
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
        updateRegional
    };
}
