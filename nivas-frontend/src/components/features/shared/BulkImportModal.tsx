import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';

interface RowError { row: number; field: string; message: string }

interface Props {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    endpoint: string;            // e.g. '/import/menu'
    columns: { key: string; required: boolean; hint?: string }[];
    sampleRow: Record<string, string>;
    onImported?: () => void;
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields + embedded commas/quotes).
function parseCsv(text: string): Record<string, string>[] {
    const rows: string[][] = [];
    let field = '', row: string[] = [], inQuotes = false;
    const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (inQuotes) {
            if (c === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
            else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); field = ''; row = []; }
        else field += c;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const nonEmpty = rows.filter(r => r.some(c => c.trim() !== ''));
    if (nonEmpty.length < 2) return [];
    const headers = nonEmpty[0].map(h => h.trim());
    return nonEmpty.slice(1).map(r => {
        const obj: Record<string, string> = {};
        headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
        return obj;
    });
}

export default function BulkImportModal({ isOpen, onClose, title, endpoint, columns, sampleRow, onImported }: Props) {
    const [rows, setRows] = useState<Record<string, string>[]>([]);
    const [fileName, setFileName] = useState('');
    const [errors, setErrors] = useState<RowError[]>([]);
    const [busy, setBusy] = useState(false);

    const headers = columns.map(c => c.key);

    const downloadTemplate = () => {
        const csv = `${headers.join(',')}\n${headers.map(h => sampleRow[h] ?? '').join(',')}`;
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${title.toLowerCase().replace(/\s+/g, '-')}-template.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        setFileName(f.name); setErrors([]);
        const reader = new FileReader();
        reader.onload = () => {
            const parsed = parseCsv(String(reader.result || ''));
            if (parsed.length === 0) { toast.error('No data rows found. Check the header + at least one row.'); setRows([]); return; }
            const missing = headers.filter(h => columns.find(c => c.key === h)?.required && !(h in parsed[0]));
            if (missing.length) { toast.error(`Missing required column(s): ${missing.join(', ')}`); setRows([]); return; }
            setRows(parsed);
        };
        reader.readAsText(f);
    };

    const doImport = async () => {
        if (rows.length === 0) { toast.error('Upload a CSV first'); return; }
        setBusy(true); setErrors([]);
        try {
            const res = await api.post<{ imported: number; errors: RowError[] }>(endpoint, { rows });
            const data = res.data;
            if (data && data.errors && data.errors.length) {
                setErrors(data.errors);
                toast.error(`${data.errors.length} problem(s) found — nothing imported`);
            } else {
                toast.success(`Imported ${data?.imported ?? 0} rows`);
                setRows([]); setFileName('');
                onImported?.(); onClose();
            }
        } catch (e: any) {
            toast.error(e?.message || 'Import failed');
        } finally { setBusy(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Bulk Import — ${title}`} size="lg">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div style={{ fontSize: 13, color: 'var(--notion-text-secondary)' }}>
                    Upload a CSV. Columns:&nbsp;
                    {columns.map((c, i) => (
                        <span key={c.key}>
                            <code style={{ background: 'var(--notion-bg-tertiary)', padding: '1px 5px', borderRadius: 4 }}>{c.key}</code>
                            {c.required ? <span style={{ color: 'var(--notion-red)' }}>*</span> : ''}
                            {c.hint ? <span style={{ color: 'var(--notion-text-muted)', fontSize: 11 }}> ({c.hint})</span> : ''}
                            {i < columns.length - 1 ? ', ' : ''}
                        </span>
                    ))}. <span style={{ color: 'var(--notion-red)' }}>*</span> = required. Images not supported.
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" onClick={downloadTemplate}><Download size={14} style={{ marginRight: 6 }} />Template</Button>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px dashed var(--notion-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13 }}>
                        <Upload size={14} /> Choose CSV
                        <input type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: 'none' }} />
                    </label>
                    {fileName && <span style={{ fontSize: 12, color: 'var(--notion-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={13} />{fileName} · {rows.length} rows</span>}
                </div>

                {errors.length > 0 && (
                    <div style={{ border: '1px solid var(--notion-red)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', maxHeight: 220, overflowY: 'auto', background: 'var(--notion-red-bg)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--notion-red)', marginBottom: 8 }}>
                            <AlertCircle size={14} /> {errors.length} validation error(s) — fix the CSV and re-upload
                        </div>
                        {errors.slice(0, 100).map((er, i) => (
                            <div key={i} style={{ fontSize: 12, color: 'var(--notion-text)', padding: '2px 0' }}>
                                {er.row > 0 ? <strong>Row {er.row}</strong> : <strong>File</strong>} · <code>{er.field}</code>: {er.message}
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={doImport} disabled={busy || rows.length === 0}>{busy ? 'Importing…' : `Import ${rows.length || ''} Rows`}</Button>
                </div>
            </div>
        </Modal>
    );
}
