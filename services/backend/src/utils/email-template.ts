interface HotelBrand {
    name?: string | null;
    logoUrl?: string | null;
    primaryColor?: string | null;
    website?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
}

export interface EmailContent {
    heading: string;
    intro?: string;
    paragraphs?: string[];
    rows?: { label: string; value: string }[];
    highlight?: string;            // big emphasised value (e.g. an OTP code)
    cta?: { text: string; url: string };
    footerNote?: string;
}

const esc = (s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Responsive, email-client-safe branded HTML (tables + inline styles). Used for
 * every transactional email so they carry the hotel's logo, name and colour.
 */
export function renderBrandedEmail(hotel: HotelBrand, c: EmailContent): string {
    const accent = hotel.primaryColor || '#1a365d';
    const name = esc(hotel.name || 'Our Hotel');
    const logo = hotel.logoUrl
        ? `<img src="${esc(hotel.logoUrl)}" alt="${name}" height="40" style="display:block;max-height:40px;margin:0 auto 8px;" />`
        : '';

    const rows = (c.rows || []).map(r => `
        <tr>
            <td style="padding:6px 0;color:#6b7280;font-size:13px;">${esc(r.label)}</td>
            <td style="padding:6px 0;color:#111827;font-size:13px;font-weight:600;text-align:right;">${esc(r.value)}</td>
        </tr>`).join('');

    const paragraphs = (c.paragraphs || []).map(p => `<p style="margin:0 0 12px;color:#374151;font-size:14px;line-height:1.55;">${esc(p)}</p>`).join('');
    const highlight = c.highlight
        ? `<div style="margin:16px 0;padding:14px;background:#f3f4f6;border-radius:8px;text-align:center;font-size:26px;font-weight:700;letter-spacing:4px;color:${accent};">${esc(c.highlight)}</div>`
        : '';
    const cta = c.cta
        ? `<div style="text-align:center;margin:20px 0 4px;"><a href="${esc(c.cta.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:600;">${esc(c.cta.text)}</a></div>`
        : '';

    const contact = [hotel.phone, hotel.email, hotel.website].filter(Boolean).map(x => esc(String(x))).join(' · ');

    return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="background:${accent};padding:22px 24px;text-align:center;">
          ${logo}
          <div style="color:#ffffff;font-size:18px;font-weight:700;">${name}</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h1 style="margin:0 0 14px;font-size:19px;color:#111827;">${esc(c.heading)}</h1>
          ${c.intro ? `<p style="margin:0 0 14px;color:#374151;font-size:14px;line-height:1.55;">${esc(c.intro)}</p>` : ''}
          ${highlight}
          ${paragraphs}
          ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">${rows}</table>` : ''}
          ${cta}
          ${c.footerNote ? `<p style="margin:16px 0 0;color:#9ca3af;font-size:12px;line-height:1.5;">${esc(c.footerNote)}</p>` : ''}
        </td></tr>
        <tr><td style="padding:16px 24px;background:#fafafa;border-top:1px solid #eee;text-align:center;color:#9ca3af;font-size:11px;">
          ${contact ? `<div>${contact}</div>` : ''}
          ${hotel.address ? `<div>${esc(hotel.address)}</div>` : ''}
          <div style="margin-top:6px;">Powered by Nivas PMS</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
