import { db } from '../../db';
import { notificationSettings, tenantFeatures } from '../../db/schema';
import { eq } from 'drizzle-orm';
import * as nodemailer from 'nodemailer';

/**
 * Multi-channel Notification Service
 * Supports Email (SMTP), SMS (Sparrow/Aakash/Twilio), and WhatsApp (Meta/Twilio/WATI)
 * All credentials are stored per-hotel in database, not in environment variables
 */
export const NotificationChannelService = {
    /**
     * Send notification through configured channels
     */
    async send(hotelId: number, recipientPhone: string, recipientEmail: string | undefined, message: string, template?: string) {
        const features = await db.query.tenantFeatures.findFirst({
            where: eq(tenantFeatures.hotelId, hotelId)
        });

        const settings = await db.query.notificationSettings.findFirst({
            where: eq(notificationSettings.hotelId, hotelId)
        });

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

        // Send Email if enabled
        if (features?.enableEmailNotifications && settings?.smtpHost && recipientEmail) {
            const emailResult = await this.sendEmail(settings, recipientEmail, 'Notification', message);
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
                    url = 'http://api.sparrowsms.com/v2/sms/';
                    body = {
                        token: settings.smsApiKey,
                        from: settings.smsSenderId,
                        to: phone,
                        text: message
                    };
                    break;

                case 'AAKASH':
                    url = 'https://aakashsms.com/admin/public/sms/v3/send';
                    body = {
                        auth_token: settings.smsApiKey,
                        from: settings.smsSenderId,
                        to: phone,
                        text: message
                    };
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
                body: settings.smsProvider === 'TWILIO' ? body : JSON.stringify(body)
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
                    const url = `https://graph.facebook.com/v17.0/${settings.whatsappPhoneNumberId}/messages`;
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
                    user: settings.smtpUsername,
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
        const domain = settings.smtpHost.replace('smtp.mailgun.org', '').trim() || settings.smtpUsername?.split('@')[1];
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
        const message = `Your booking at ${bookingDetails.hotelName} is confirmed! 
Check-in: ${bookingDetails.checkIn}
Room: ${bookingDetails.roomNumber}
Confirmation: ${bookingDetails.bookingId}`;

        return await this.send(hotelId, guestPhone, guestEmail, message, 'booking_confirmation');
    },

    /**
     * Send check-in reminder
     */
    async sendCheckInReminder(hotelId: number, guestPhone: string, guestEmail: string | undefined, bookingDetails: any) {
        const message = `Reminder: Your check-in at ${bookingDetails.hotelName} is tomorrow! 
Room: ${bookingDetails.roomNumber}
Time: ${bookingDetails.checkInTime}`;

        return await this.send(hotelId, guestPhone, guestEmail, message, 'checkin_reminder');
    },

    /**
     * Send payment receipt
     */
    async sendPaymentReceipt(hotelId: number, guestPhone: string, guestEmail: string | undefined, paymentDetails: any) {
        const message = `Payment received: ${paymentDetails.currency} ${paymentDetails.amount}
Invoice: ${paymentDetails.invoiceNumber}
Thank you for staying with us!`;

        return await this.send(hotelId, guestPhone, guestEmail, message, 'payment_receipt');
    },

    /**
     * Send checkout notification
     */
    async sendCheckoutNotification(hotelId: number, guestPhone: string, guestEmail: string | undefined, details: any) {
        const message = `Thank you for staying at ${details.hotelName}!
Your checkout is complete.
Invoice: ${details.invoiceNumber}
We hope to see you again!`;

        return await this.send(hotelId, guestPhone, guestEmail, message, 'checkout_notification');
    }
};
