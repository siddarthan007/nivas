import { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { RefreshCcw, Search, ArrowUpDown } from 'lucide-react';
import DualDate from '@/components/ui/DualDate';
import CustomDatePicker from '@/components/ui/DatePicker';

export default function GLPage() {
    const [activeTab, setActiveTab] = useState('trial-balance');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [trialBalance, setTrialBalance] = useState<any[]>([]);
    const [journalEntries, setJournalEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [accountTypeFilter, setAccountTypeFilter] = useState('ALL');
    const [accountSort, setAccountSort] = useState<'code' | 'name'>('code');
    const [journalSort, setJournalSort] = useState<'date' | 'status'>('date');
    const [journalSortDir, setJournalSortDir] = useState<'asc' | 'desc'>('desc');

    const accountTypes = useMemo(() => ['ALL', ...Array.from(new Set(accounts.map(a => a.type).filter(Boolean)))], [accounts]);

    const filteredAccounts = useMemo(() => {
        let data = [...accounts];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(a => (a.name || '').toLowerCase().includes(q) || (a.code || '').toLowerCase().includes(q));
        }
        if (accountTypeFilter !== 'ALL') data = data.filter(a => a.type === accountTypeFilter);
        data.sort((a, b) => (a[accountSort] || '').localeCompare(b[accountSort] || ''));
        return data;
    }, [accounts, searchQuery, accountTypeFilter, accountSort]);

    const filteredJournal = useMemo(() => {
        let data = [...journalEntries];
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(j => (j.description || '').toLowerCase().includes(q) || (j.reference || '').toLowerCase().includes(q));
        }
        data.sort((a, b) => {
            let cmp = 0;
            if (journalSort === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
            else cmp = (a.status || '').localeCompare(b.status || '');
            return journalSortDir === 'asc' ? cmp : -cmp;
        });
        return data;
    }, [journalEntries, searchQuery, journalSort, journalSortDir]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accRes, tbRes, jeRes] = await Promise.allSettled([
                api.get('/finance/gl/accounts'),
                api.get('/finance/gl/trial-balance'),
                api.get('/finance/gl/journal')
            ]);
            setAccounts(accRes.status === 'fulfilled' && Array.isArray(accRes.value.data) ? accRes.value.data : []);
            setTrialBalance(tbRes.status === 'fulfilled' && Array.isArray(tbRes.value.data) ? tbRes.value.data : []);
            if (jeRes.status === 'rejected') {
                toast.error('Journal entries temporarily unavailable (server error)');
                setJournalEntries([]);
            } else {
                setJournalEntries(Array.isArray(jeRes.value.data) ? jeRes.value.data : []);
            }
        } catch (error) {
            toast.error('Failed to load GL data');
        } finally {
            setLoading(false);
        }
    };

    const handleInitCoA = async () => {
        if (!confirm('Are you sure you want to initialize the default Chart of Accounts?')) return;
        try {
            await api.post('/finance/gl/accounts/init');
            toast.success('Chart of Accounts initialized');
            fetchData();
        } catch (error) {
            toast.error('Initialization failed');
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const totalDebit = trialBalance.reduce((sum, item) => sum + Number(item.total_debit || 0), 0);
    const totalCredit = trialBalance.reduce((sum, item) => sum + Number(item.total_credit || 0), 0);

    const accountsColumns = [
        { key: 'code', header: 'Code' },
        { key: 'name', header: 'Name' },
        { key: 'type', header: 'Type', render: (val: any) => <Badge>{val}</Badge> },
        { key: 'isControlAccount', header: 'Control Account', render: (val: any) => val ? <Badge>Yes</Badge> : '-' },
        { key: 'isActive', header: 'Status', render: (val: any) => val ? <Badge variant="success">Active</Badge> : <Badge variant="error">Inactive</Badge> }
    ];

    const journalColumns = [
        { key: 'date', header: 'Date', render: (val: any) => <DualDate date={val} format="compact" /> },
        { key: 'description', header: 'Description' },
        { key: 'reference', header: 'Reference' },
        { key: 'status', header: 'Status', render: (val: any) => <Badge variant={val === 'POSTED' ? 'default' : 'error'}>{val}</Badge> }
    ];

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ color: 'var(--notion-text-secondary)' }}>Manage accounts, journal entries, and trial balance</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <Button variant="secondary" onClick={fetchData}><RefreshCcw size={16} /> Refresh</Button>
                    <Button variant="primary" onClick={handleInitCoA}>Initialize Default CoA</Button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--notion-border)', paddingBottom: '16px', flexWrap: 'wrap' }}>
                <Button
                    variant={activeTab === 'trial-balance' ? 'primary' : 'secondary'}
                    onClick={() => setActiveTab('trial-balance')}
                >Trial Balance</Button>
                <Button
                    variant={activeTab === 'journal' ? 'primary' : 'secondary'}
                    onClick={() => setActiveTab('journal')}
                >Journal Entries</Button>
                <Button
                    variant={activeTab === 'accounts' ? 'primary' : 'secondary'}
                    onClick={() => setActiveTab('accounts')}
                >Chart of Accounts</Button>
                <Button
                    variant="secondary"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >{showAdvanced ? 'Hide Advanced' : 'Show Advanced'}</Button>
                {showAdvanced && (
                    <>
                        <Button
                            variant={activeTab === 'ledger' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('ledger')}
                        >Account Ledger</Button>
                        <Button
                            variant={activeTab === 'cash-flow' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('cash-flow')}
                        >Cash Flow</Button>
                        <Button
                            variant={activeTab === 'ar-aging' ? 'primary' : 'secondary'}
                            onClick={() => setActiveTab('ar-aging')}
                        >AR Aging</Button>
                    </>
                )}
            </div>

            {showAdvanced && activeTab === 'ledger' && <AccountLedgerView accounts={accounts} />}
            {showAdvanced && activeTab === 'cash-flow' && <CashFlowView />}
            {showAdvanced && activeTab === 'ar-aging' && <ArAgingView />}

            {/* Filter toolbar for Journal and Accounts tabs */}
            {(activeTab === 'journal' || activeTab === 'accounts') && (
                <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap', padding: 'var(--space-3)', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ position: 'relative', minWidth: '220px', flex: 1, maxWidth: '320px' }}>
                        <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--notion-text-muted)' }} />
                        <input
                            type="text"
                            placeholder={activeTab === 'accounts' ? 'Search accounts...' : 'Search journal entries...'}
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '6px 10px 6px 32px', borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)',
                                color: 'var(--notion-text)', fontSize: '13px', outline: 'none',
                            }}
                        />
                    </div>
                    {activeTab === 'accounts' && (
                        <>
                            <select
                                value={accountTypeFilter}
                                onChange={e => setAccountTypeFilter(e.target.value)}
                                style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}
                            >
                                {accountTypes.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Types' : t}</option>)}
                            </select>
                            <select
                                value={accountSort}
                                onChange={e => setAccountSort(e.target.value as 'code' | 'name')}
                                style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}
                            >
                                <option value="code">Sort by Code</option>
                                <option value="name">Sort by Name</option>
                            </select>
                        </>
                    )}
                    {activeTab === 'journal' && (
                        <select
                            value={`${journalSort}-${journalSortDir}`}
                            onChange={e => {
                                const [field, dir] = e.target.value.split('-') as [any, 'asc' | 'desc'];
                                setJournalSort(field);
                                setJournalSortDir(dir);
                            }}
                            style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', backgroundColor: 'var(--notion-bg)', color: 'var(--notion-text)', fontSize: '13px', cursor: 'pointer' }}
                        >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="status-asc">Status A→Z</option>
                            <option value="status-desc">Status Z→A</option>
                        </select>
                    )}
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} style={{ fontSize: '12px', color: 'var(--notion-blue)', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
                    )}
                </div>
            )}

            {activeTab === 'trial-balance' && (
                <Card>
                    <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--notion-border)' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Trial Balance</h3>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        <div style={{ width: '100%', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                        <th style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500', fontSize: '12px' }}>Account Code</th>
                                        <th style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500', fontSize: '12px' }}>Account Name</th>
                                        <th style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500', fontSize: '12px' }}>Type</th>
                                        <th style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500', fontSize: '12px', textAlign: 'right' }}>Debit</th>
                                        <th style={{ padding: '10px 12px', color: 'var(--notion-text-secondary)', fontWeight: '500', fontSize: '12px', textAlign: 'right' }}>Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {trialBalance.length === 0 ? (
                                        <tr><td colSpan={5}><EmptyState title="No trial balance data" description="Initialize the Chart of Accounts to start tracking balances." /></td></tr>
                                    ) : (
                                        trialBalance.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--notion-divider)' }}>
                                                <td style={{ padding: '8px 12px', color: 'var(--notion-text)' }}>{item.code}</td>
                                                <td style={{ padding: '8px 12px', color: 'var(--notion-text)' }}>{item.name}</td>
                                                <td style={{ padding: '8px 12px', color: 'var(--notion-text)' }}><Badge>{item.type}</Badge></td>
                                                <td style={{ padding: '8px 12px', color: 'var(--notion-text)', textAlign: 'right' }}>{(Number(item.total_debit)).toLocaleString()}</td>
                                                <td style={{ padding: '8px 12px', color: 'var(--notion-text)', textAlign: 'right' }}>{(Number(item.total_credit)).toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                    <tr style={{ fontWeight: 'bold', borderTop: '2px solid var(--notion-divider)' }}>
                                        <td colSpan={3} style={{ padding: '8px 12px', textAlign: 'right' }}>Total</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{totalDebit.toLocaleString()}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>{totalCredit.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </Card>
            )}

            {activeTab === 'journal' && (
                <Card>
                    <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--notion-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Recent Journal Entries</h3>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{filteredJournal.length} records</span>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        {filteredJournal.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--notion-text-secondary)' }}>No journal entries found</div>
                        ) : (
                            <Table columns={journalColumns} data={filteredJournal} />
                        )}
                    </div>
                </Card>
            )}

            {activeTab === 'accounts' && (
                <Card>
                    <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--notion-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Chart of Accounts</h3>
                        <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{filteredAccounts.length} accounts</span>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        {filteredAccounts.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--notion-text-secondary)' }}>No accounts found. Please initialize.</div>
                        ) : (
                            <Table columns={accountsColumns} data={filteredAccounts} />
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}

interface LedgerLine { date: string; description: string; reference: string; debit: number; credit: number; balance: number }
interface AccountLedger {
    account: { id: number; code: string; name: string; type: string };
    fromDate: string; toDate: string;
    openingBalance: number; closingBalance: number;
    lines: LedgerLine[];
}

const fyStart = () => `${new Date().getFullYear()}-01-01`;
const isoToday = () => new Date().toISOString().split('T')[0] || '';
const money = (n: number) => Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function AccountLedgerView({ accounts }: { accounts: any[] }) {
    const [accountId, setAccountId] = useState<string>('');
    const [from, setFrom] = useState(fyStart());
    const [to, setTo] = useState(isoToday());
    const [data, setData] = useState<AccountLedger | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFromChange = (d: any) => setFrom(d ? d.toISOString().split('T')[0] : '');
    const handleToChange = (d: any) => setTo(d ? d.toISOString().split('T')[0] : '');

    // Default to the first account once the list loads.
    useEffect(() => {
        if (!accountId && accounts.length > 0) setAccountId(String(accounts[0].id));
    }, [accounts, accountId]);

    useEffect(() => {
        if (!accountId) return;
        let cancelled = false;
        setLoading(true);
        api.get<AccountLedger>(`/finance/gl/account-ledger?accountId=${accountId}&from=${from}&to=${to}`)
            .then(res => { if (!cancelled && res.data) setData(res.data); })
            .catch(() => { if (!cancelled) toast.error('Failed to load ledger'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [accountId, from, to]);

    const inputStyle: React.CSSProperties = {
        padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)',
        borderRadius: 'var(--radius-md)', color: 'var(--notion-text)', fontSize: '14px',
    };

    return (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ ...inputStyle, minWidth: '240px' }}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
                <CustomDatePicker selected={from ? new Date(from) : null} onChange={handleFromChange} fullWidth={false} />
                <span style={{ color: 'var(--notion-text-secondary)' }}>→</span>
                <CustomDatePicker selected={to ? new Date(to) : null} onChange={handleToChange} fullWidth={false} />
            </div>

            {data && (
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                    <div><span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Opening</span><div style={{ fontWeight: 700 }}>NPR {money(data.openingBalance)}</div></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Closing</span><div style={{ fontWeight: 700 }}>NPR {money(data.closingBalance)}</div></div>
                    <div><span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>Entries</span><div style={{ fontWeight: 700 }}>{data.lines.length}</div></div>
                </div>
            )}

            <Card>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-secondary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Date</th>
                                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Description</th>
                                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Reference</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Debit</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Credit</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading…</td></tr>
                            ) : !data || data.lines.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No postings in this period.</td></tr>
                            ) : data.lines.map((l, i) => (
                                <tr key={i} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 14px', color: 'var(--notion-text)' }}>{new Date(l.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px 14px', color: 'var(--notion-text)' }}>{l.description}</td>
                                    <td style={{ padding: '8px 14px', color: 'var(--notion-text-secondary)' }}>{l.reference}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--notion-text)' }}>{l.debit ? money(l.debit) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--notion-text)' }}>{l.credit ? money(l.credit) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--notion-text)' }}>{money(l.balance)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

const dateInput: React.CSSProperties = {
    padding: '8px 10px', background: 'var(--notion-bg)', border: '1px solid var(--notion-border)',
    borderRadius: 'var(--radius-md)', color: 'var(--notion-text)', fontSize: '14px',
};

function StatBox({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
        <div style={{ padding: '12px 16px', background: 'var(--notion-bg-secondary)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-lg)', minWidth: '140px' }}>
            <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: color || 'var(--notion-text)', marginTop: '2px' }}>{value}</div>
        </div>
    );
}

function CashFlowView() {
    const [from, setFrom] = useState(fyStart());
    const [to, setTo] = useState(isoToday());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleFromChange = (d: any) => setFrom(d ? d.toISOString().split('T')[0] : '');
    const handleToChange = (d: any) => setTo(d ? d.toISOString().split('T')[0] : '');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get<any>(`/finance/gl/cash-flow?from=${from}&to=${to}`)
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(() => { if (!cancelled) toast.error('Failed to load cash flow'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [from, to]);

    return (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <CustomDatePicker selected={from ? new Date(from) : null} onChange={handleFromChange} fullWidth={false} />
                <span style={{ color: 'var(--notion-text-secondary)' }}>→</span>
                <CustomDatePicker selected={to ? new Date(to) : null} onChange={handleToChange} fullWidth={false} />
            </div>
            {data && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <StatBox label="Opening Cash" value={`NPR ${money(data.openingCash)}`} />
                    <StatBox label="Inflows" value={`NPR ${money(data.totalInflow)}`} color="var(--notion-green)" />
                    <StatBox label="Outflows" value={`NPR ${money(data.totalOutflow)}`} color="var(--notion-red)" />
                    <StatBox label="Net Change" value={`NPR ${money(data.netChange)}`} color={data.netChange >= 0 ? 'var(--notion-green)' : 'var(--notion-red)'} />
                    <StatBox label="Closing Cash" value={`NPR ${money(data.closingCash)}`} />
                </div>
            )}
            <Card>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-secondary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Date</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Inflow</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Outflow</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Net</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading…</td></tr>
                            ) : !data || data.series.length === 0 ? (
                                <tr><td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No cash movement in this period.</td></tr>
                            ) : data.series.map((s: any, i: number) => (
                                <tr key={i} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 14px' }}>{new Date(s.date).toLocaleDateString()}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--notion-green)' }}>{s.inflow ? money(s.inflow) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: 'var(--notion-red)' }}>{s.outflow ? money(s.outflow) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>{money(s.net)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}

function ArAgingView() {
    const [asOf, setAsOf] = useState(isoToday());
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const handleAsOfChange = (d: any) => setAsOf(d ? d.toISOString().split('T')[0] : '');

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get<any>(`/finance/gl/ar-aging?date=${asOf}`)
            .then(res => { if (!cancelled) setData(res.data); })
            .catch(() => { if (!cancelled) toast.error('Failed to load aging'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [asOf]);

    const b = data?.buckets || {};
    return (
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>As of</span>
                <CustomDatePicker selected={asOf ? new Date(asOf) : null} onChange={handleAsOfChange} fullWidth={false} />
            </div>
            {data && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <StatBox label="Current (0-30)" value={`NPR ${money(b.current || 0)}`} />
                    <StatBox label="31-60" value={`NPR ${money(b.d31_60 || 0)}`} />
                    <StatBox label="61-90" value={`NPR ${money(b.d61_90 || 0)}`} color="var(--notion-orange)" />
                    <StatBox label="90+" value={`NPR ${money(b.d90plus || 0)}`} color="var(--notion-red)" />
                    <StatBox label="Total Outstanding" value={`NPR ${money(data.totalOutstanding || 0)}`} />
                </div>
            )}
            <Card>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--notion-bg-secondary)', color: 'var(--notion-text-secondary)' }}>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: 600 }}>Customer</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Current</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>31-60</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>61-90</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>90+</th>
                                <th style={{ textAlign: 'right', padding: '10px 14px', fontWeight: 600 }}>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>Loading…</td></tr>
                            ) : !data || data.customers.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>No outstanding receivables. ✓</td></tr>
                            ) : data.customers.map((c: any, i: number) => (
                                <tr key={i} style={{ borderTop: '1px solid var(--notion-border)' }}>
                                    <td style={{ padding: '8px 14px', fontWeight: 500 }}>{c.customer}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>{c.current ? money(c.current) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>{c.d31_60 ? money(c.d31_60) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right' }}>{c.d61_90 ? money(c.d61_90) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', color: c.d90plus ? 'var(--notion-red)' : undefined }}>{c.d90plus ? money(c.d90plus) : ''}</td>
                                    <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>{money(c.total)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
