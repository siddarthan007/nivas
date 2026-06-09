/**
 * Minimal, XSS-SAFE markdown → HTML. HTML is escaped FIRST, then only a known set
 * of tags is introduced — so no raw HTML/script from an AI response can execute.
 * Covers headings, bold, italic, inline + block code, bullet/numbered lists, links
 * (safe http(s) only), and line breaks. No external dependency.
 */
export function renderMarkdownSafe(md: string): string {
    if (!md) return '';
    let h = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Fenced code blocks
    h = h.replace(/```([\s\S]*?)```/g, (_m, c) => `<pre class="md-pre">${c.replace(/^\n/, '')}</pre>`);
    // Inline code
    h = h.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>');
    // Headings
    h = h.replace(/^######\s+(.+)$/gm, '<strong>$1</strong>')
        .replace(/^#{1,5}\s+(.+)$/gm, '<strong>$1</strong>');
    // Bold then italic
    h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    // Safe links [text](http...)
    h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Lists: convert bullet/numbered lines to <li>, then wrap contiguous groups.
    h = h.replace(/^\s*(?:[-*]|\d+\.)\s+(.+)$/gm, '<li>$1</li>');
    h = h.replace(/(<li>(?:(?!<\/li>)[\s\S])*<\/li>(?:\s*<li>(?:(?!<\/li>)[\s\S])*<\/li>)*)/g, '<ul class="md-ul">$1</ul>');
    // Remaining newlines → breaks (but not right after block tags)
    h = h.replace(/\n/g, '<br/>');
    h = h.replace(/(<\/(?:pre|ul|li)>)<br\/>/g, '$1');
    return h;
}
