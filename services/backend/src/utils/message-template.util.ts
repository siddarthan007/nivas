/** Replace {var} and {{var}} placeholders in stored templates. */
export function applyMessageTemplate(
    template: string | null | undefined,
    vars: Record<string, string>,
    fallback: string,
): string {
    if (!template?.trim()) return fallback;
    return template
        .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? '')
        .replace(/\{\s*(\w+)\s*\}/g, (_, key: string) => vars[key] ?? '');
}

/** Build simple HTML email body from a template with {variables}, wrapped for clients. */
export function renderTemplateHtml(
    template: string | null | undefined,
    vars: Record<string, string>,
    fallbackHtml: string,
): string {
    const body = applyMessageTemplate(template, vars, '');
    if (!body.trim()) return fallbackHtml;
    const safe = body
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br/>');
    return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#374151;line-height:1.6;">${safe}</div>`;
}
