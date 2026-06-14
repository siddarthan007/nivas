export interface MessagingPayload {
    sms: {
        provider: string;
        senderId: string;
        apiKey?: string;
        apiSecret?: string;
    };
    email: {
        smtpHost: string;
        smtpPort: number;
        smtpUser: string;
        smtpFromEmail: string;
        smtpFromName: string;
        smtpPassword?: string;
    };
    whatsapp?: {
        provider?: string;
        phoneNumberId?: string;
        businessId?: string;
        apiKey?: string;
    };
}

export interface AiPayload {
    enabled: boolean;
    model: string;
    apiKey?: string;
    dailyLimit?: number;
}

export interface CbmsPayload {
    enabled: boolean;
    username: string;
    sellerPan: string;
    isRealtime: boolean;
    password?: string;
}

export interface PortalConfigForm {
    welcomeMessage: string;
    wifiNetworks: { floor?: string; ssid?: string; password?: string }[];
    contactNumbers: { label?: string; number?: string }[];
    customSections: { title?: string; content?: string }[];
    showBillBreakdown: boolean;
    showOrderProgress: boolean;
}
