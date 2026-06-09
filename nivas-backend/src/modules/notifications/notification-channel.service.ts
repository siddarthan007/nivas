import { db } from '../../db';
import { notificationSettings, tenantFeatures, hotels, platformSettings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';
import { renderBrandedEmail, type EmailContent } from '../../utils/email-template';

/**
 * Multi-channel Notification Service
 * Supports Email (SMTP), SMS (Sparrow/Aakash/Twilio), and WhatsApp (Meta/Twilio/WATI)
 * All credentials are stored per-hotel in database, not in environment variables
 */
export const NotificationChannelService = {
    /**
     * Send notification through configured channels
     */
    /**
     * Effective provider settings = the shared PLATFORM gateway (managed in
     * super-admin) as the base, with the hotel's own notificationSettings
     * overriding per non-empty field. So SMS/email work platform-wide by default.
     */
    async resolveSettings(hotelId: number): Promise<any> {
        const [hotel, platform] = await Promise.all([
            db.query.notificationSettings.findFirst({ where: eq(notificationSettings.hotelId, hotelId) }),
            db.query.platformSettings.findFirst({ where: eq(platformSettings.id, 1) }),
        ]);
        const h: any = hotel || {};
        const p: any = platform || {};

        // Resolve each provider as an ALL-OR-NOTHING block, never a field-by-field
        // merge — otherwise a hotel that set only an SMS provider (but no key) would
        // silently inherit the platform's secret and send via the wrong account.
        const hotelHasSms = !!(h.smsApiKey && h.smsProvider);
        const hotelHasSmtp = !!(h.smtpHost && h.smtpPassword);
        const hotelHasWhatsapp = !!(h.whatsappApiKey && h.whatsappProvider);

        return {
            // SMS block
            smsProvider: hotelHasSms ? h.smsProvider : p.smsProvider,
            smsApiKey: hotelHasSms ? h.smsApiKey : p.smsApiKey,
            smsApiSecret: hotelHasSms ? h.smsApiSecret : p.smsApiSecret,
            smsSenderId: hotelHasSms ? h.smsSenderId : p.smsSenderId,
            // SMTP block
            smtpHost: hotelHasSmtp ? h.smtpHost : p.smtpHost,
            smtpPort: hotelHasSmtp ? h.smtpPort : p.smtpPort,
            smtpUser: hotelHasSmtp ? h.smtpUser : p.smtpUser,
            smtpPassword: hotelHasSmtp ? h.smtpPassword : p.smtpPassword,
            smtpFromEmail: hotelHasSmtp ? h.smtpFromEmail : p.smtpFromEmail,
            smtpFromName: hotelHasSmtp ? h.smtpFromName : p.smtpFromName,
            // WhatsApp block (hotel-only — no platform fallback)
            whatsappProvider: hotelHasWhatsapp ? h.whatsappProvider : undefined,
            whatsappApiKey: hotelHasWhatsapp ? h.whatsappApiKey : undefined,
            whatsappPhoneNumberId: hotelHasWhatsapp ? h.whatsappPhoneNumberId : undefined,
            // Templates always from the hotel.
            bookingConfirmationTemplate: h.bookingConfirmationTemplate,
            checkInReminderTemplate: h.checkInReminderTemplate,
            paymentReceiptTemplate: h.paymentReceiptTemplate,
        };
    },

    async send(hotelId: number, recipientPhone: string, recipientEmail: string | undefined, message: string, template?: string) {
        const features = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId)
        });

        const settings = await this.resolveSettings(hotelId);

        const results: { channels: Array<{ type: string; success: boolean; provider?: string; error?: string }> } = { channels: [] };

        // Send SMS if enabled
        if (features?.enableSmsNotifications && settings?.smsApiKey) {
            const smsResult = await this.sendSms(settings, recipientPhone, message);
            results.channels.push({ type: 'SMS', ...smsResult });
        }

        // Send WhatsApp if enabled
        if (features?.enableWhatsappNotifications && settings?.whatsappApiKey) {
            const waResult = await this.sendWhatsApp(settings, recipientPhone, message, template);
            results.channels.push({ type: 'WHATSAPP', ...waResult });
        }

        // Send Email if enabled. Wrap the plain message in newline-safe HTML so
        // line breaks render (any caller not using sendBrandedEmail still looks ok).
        if (features?.enableEmailNotifications && settings?.smtpHost && recipientEmail) {
            const safe = String(message).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#374151;white-space:pre-wrap;line-height:1.55;">${safe}</div><div style="margin-top:16px;color:#9ca3af;font-size:11px;">Powered by Nivas PMS</div>`;
            const emailResult = await this.sendEmail(settings, recipientEmail, 'Notification', html);
            results.channels.push({ type: 'EMAIL', ...emailResult });
        }

        return results;
    },

    /**
     * Send SMS via configured provider
     */
    async sendSms(settings: any, phone: string, message: string) {
        try {
            let url = '';
            let body: any = {};
            let headers: Record<string, string> = { 'Content-Type': 'application/json' };

            switch (settings.smsProvider) {
                case 'SPARROW':
                    // HTTPS + form-encoded (Sparrow v2). `from` = approved identity/sender.
                    url = 'https://api.sparrowsms.com/v2/sms/';
                    headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
                    body = new URLSearchParams({
                        token: settings.smsApiKey,
                        from: settings.smsSenderId || 'Demo',
                        to: phone,
                        text: message,
                    });
                    break;

                case 'AAKASH':
                    // Current Aakash v3 endpoint; form-encoded; sender fixed per account (no `from`).
                    url = 'https://sms.aakashsms.com/sms/v3/send/';
                    headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
                    body = new URLSearchParams({
                        auth_token: settings.smsApiKey,
                        to: phone,
                        text: message,
                    });
                    break;

                case 'TWILIO':
                    const twilioSid = settings.smsApiKey;
                    const twilioToken = settings.smsApiSecret;
                    url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
                    headers = {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`
                    };
                    body = new URLSearchParams({
                        From: settings.smsSenderId,
                        To: phone,
                        Body: message
                    });
                    break;

                default:
                    return { success: false, error: 'SMS provider not configured' };
            }

            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: body instanceof URLSearchParams ? body : JSON.stringify(body)
            });

            const result = await response.json();
            return { success: response.ok, provider: settings.smsProvider, response: result };
        } catch (error) {
            console.error('[SMS] Error:', error);
            return { success: false, error: 'SMS sending failed' };
        }
    },

    /**
     * Send WhatsApp message via configured provider
     */
    async sendWhatsApp(settings: any, phone: string, message: string, template?: string) {
        try {
            switch (settings.whatsappProvider) {
                case 'META': {
                    const url = `https://graph.facebook.com/v21.0/${settings.whatsappPhoneNumberId}/messages`;
                    const body = template ? {
                        messaging_product: 'whatsapp',
                        to: phone,
                        type: 'template',
                        template: { name: template, language: { code: 'en' } }
                    } : {
                        messaging_product: 'whatsapp',
                        to: phone,
                        type: 'text',
                        text: { body: message }
                    };

                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${settings.whatsappApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(body)
                    });

                    const result = await response.json();
                    return { success: response.ok, provider: 'META', response: result };
                }

                case 'WATI': {
                    const watiUrl = `https://live-server-${settings.whatsappBusinessId}.wati.io/api/v1/sendSessionMessage/${phone}`;
                    const watiResponse = await fetch(watiUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${settings.whatsappApiKey}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ messageText: message })
                    });

                    const watiResult = await watiResponse.json();
                    return { success: watiResponse.ok, provider: 'WATI', response: watiResult };
                }

                default:
                    return { success: false, error: 'WhatsApp provider not configured' };
            }
        } catch (error) {
            console.error('[WhatsApp] Error:', error);
            return { success: false, error: 'WhatsApp sending failed' };
        }
    },

    /**
     * Send Email via SMTP using nodemailer-compatible approach
     * Uses Bun/fetch-based SMTP relay or transactional email services
     */
    /**
     * Send a transactional, BRANDED HTML email (hotel logo/name/colour). Not
     * gated by the marketing email toggle — used for confirmations, OTP, digests.
     * No-ops gracefully if the hotel has no SMTP/email provider configured.
     */
    async sendBrandedEmail(hotelId: number, to: string, subject: string, content: EmailContent) {
        if (!to) return { success: false, error: 'no recipient' };
        const [settings, hotel] = await Promise.all([
            this.resolveSettings(hotelId),
            db.query.hotels.findFirst({ where: eq(hotels.id, hotelId), columns: { name: true, logoUrl: true, primaryColor: true, website: true, phone: true, email: true, address: true } }),
        ]);
        if (!settings?.smtpHost) return { success: false, error: 'email not configured' };
        const html = renderBrandedEmail(hotel || {}, content);
        return this.sendEmail(settings, to, subject, html);
    },

    async sendEmail(settings: any, to: string, subject: string, htmlBody: string) {
        try {
            // Option 1: Use transactional email service (SendGrid, Mailgun, etc.) if configured
            if (settings.smtpHost?.includes('sendgrid')) {
                return await this.sendViaSendGrid(settings, to, subject, htmlBody);
            }

            if (settings.smtpHost?.includes('mailgun')) {
                return await this.sendViaMailgun(settings, to, subject, htmlBody);
            }

            // Option 2: Use generic SMTP relay via nodemailer
            const transporter = nodemailer.createTransport({
                host: settings.smtpHost,
                port: parseInt(settings.smtpPort),
                secure: parseInt(settings.smtpPort) === 465, // true for 465, false for other ports
                auth: {
                    // resolveSettings provides `smtpUser`; keep `smtpUsername` for back-compat.
                    user: settings.smtpUsername || settings.smtpUser,
                    pass: settings.smtpPassword
                }
            });

            const info = await transporter.sendMail({
                from: `"${settings.smtpFromName}" <${settings.smtpFromEmail}>`,
                to: to,
                subject: subject,
                html: htmlBody
            });

            return {
                success: true,
                provider: 'SMTP',
                response: info.messageId
            };
        } catch (error) {
            console.error('[Email] Error:', error);
            return { success: false, error: 'Email sending failed' };
        }
    },

    /**
     * Send via SendGrid API
     */
    async sendViaSendGrid(settings: any, to: string, subject: string, htmlBody: string) {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.smtpPassword}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email: to }] }],
                from: { email: settings.smtpFromEmail, name: settings.smtpFromName },
                subject,
                content: [{ type: 'text/html', value: htmlBody }]
            })
        });

        return {
            success: response.status === 202,
            provider: 'SENDGRID',
            status: response.status
        };
    },

    /**
     * Send via Mailgun API
     */
    async sendViaMailgun(settings: any, to: string, subject: string, htmlBody: string) {
        const domain = settings.smtpHost.replace('smtp.mailgun.org', '').trim() || (settings.smtpUsername || settings.smtpUser)?.split('@')[1];
        const response = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`api:${settings.smtpPassword}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                from: `${settings.smtpFromName} <${settings.smtpFromEmail}>`,
                to,
                subject,
                html: htmlBody
            })
        });

        const result = await response.json();
        return { success: response.ok, provider: 'MAILGUN', response: result };
    },

    /**
     * Send booking confirmation via all enabled channels
     */
    async sendBookingConfirmation(hotelId: number, guestPhone: string, guestEmail: string | undefined, bookingDetails: any) {
        const sms = `Your booking at ${bookingDetails.hotelName} is confirmed! Check-in: ${bookingDetails.checkIn}, Room: ${bookingDetails.roomNumber}, Confirmation: ${bookingDetails.bookingId}`;
        const r = await this.send(hotelId, guestPhone, undefined, sms, 'booking_confirmation');
        if (guestEmail) await this.sendBrandedEmail(hotelId, guestEmail, 'Booking Confirmed', {
            heading: 'Your booking is confirmed',
            rows: [
                { label: 'Confirmation', value: String(bookingDetails.bookingId) },
                { label: 'Check-in', value: String(bookingDetails.checkIn) },
                { label: 'Room', value: String(bookingDetails.roomNumber) },
            ],
            footerNote: 'We look forward to hosting you.',
        });
        return r;
    },

    /** Send check-in reminder */
    async sendCheckInReminder(hotelId: number, guestPhone: string, guestEmail: string | undefined, bookingDetails: any) {
        const sms = `Reminder: Your check-in at ${bookingDetails.hotelName} is tomorrow! Room: ${bookingDetails.roomNumber}, Time: ${bookingDetails.checkInTime}`;
        const r = await this.send(hotelId, guestPhone, undefined, sms, 'checkin_reminder');
        if (guestEmail) await this.sendBrandedEmail(hotelId, guestEmail, 'Check-in Reminder', {
            heading: 'See you tomorrow!',
            intro: 'Your stay is almost here. Here are your check-in details:',
            rows: [
                { label: 'Room', value: String(bookingDetails.roomNumber) },
                { label: 'Check-in time', value: String(bookingDetails.checkInTime) },
            ],
        });
        return r;
    },

    /** Send payment receipt */
    async sendPaymentReceipt(hotelId: number, guestPhone: string, guestEmail: string | undefined, paymentDetails: any) {
        const sms = `Payment received: ${paymentDetails.currency} ${paymentDetails.amount}. Invoice: ${paymentDetails.invoiceNumber}. Thank you!`;
        const r = await this.send(hotelId, guestPhone, undefined, sms, 'payment_receipt');
        if (guestEmail) await this.sendBrandedEmail(hotelId, guestEmail, 'Payment Receipt', {
            heading: 'Payment received',
            intro: 'Thank you — we have received your payment.',
            rows: [
                { label: 'Amount', value: `${paymentDetails.currency} ${paymentDetails.amount}` },
                { label: 'Invoice', value: String(paymentDetails.invoiceNumber) },
            ],
        });
        return r;
    },

    /** Send checkout notification (+ optional invoice link). */
    async sendCheckoutNotification(hotelId: number, guestPhone: string, guestEmail: string | undefined, details: any) {
        const link = details.invoiceUrl ? ` View your bill: ${details.invoiceUrl}` : '';
        const sms = `Thank you for staying at ${details.hotelName}! Checkout complete. Invoice ${details.invoiceNumber || ''}.${link}`;
        const r = await this.send(hotelId, guestPhone, undefined, sms, 'checkout_notification');
        if (guestEmail) await this.sendBrandedEmail(hotelId, guestEmail, 'Thank you for your stay', {
            heading: 'Checkout complete',
            intro: `Thank you for staying at ${details.hotelName}. We hope to see you again!`,
            rows: details.invoiceNumber ? [{ label: 'Invoice', value: String(details.invoiceNumber) }] : [],
            ...(details.invoiceUrl ? { cta: { text: 'View invoice', url: details.invoiceUrl } } : {}),
        });
        return r;
    }
};
