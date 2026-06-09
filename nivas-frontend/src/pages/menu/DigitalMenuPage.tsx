import { useEffect, useMemo, useState } from 'react';
import { Search, UtensilsCrossed } from 'lucide-react';

interface MenuItemLite { id: number; name: string; description?: string | null; price: string | number; category?: string | null; imageUrl?: string | null }
interface MenuData {
    hotel: { name: string; logoUrl?: string | null; primaryColor?: string | null; secondaryColor?: string | null; currency: string };
    categories: { name: string; items: MenuItemLite[] }[];
    itemCount: number;
}

// Public, no-auth digital menu reached via /menu?hotel=<slug> (QR/link).
export default function DigitalMenuPage() {
    const slug = new URLSearchParams(window.location.search).get('hotel') || '';
    const [data, setData] = useState<MenuData | null>(null);
    const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
    const [query, setQuery] = useState('');
    const [activeCat, setActiveCat] = useState<string>('All');

    useEffect(() => {
        if (!slug) { setState('error'); return; }
        fetch(`/api/v1/public/${encodeURIComponent(slug)}/menu`)
            .then(r => r.ok ? r.json() : Promise.reject())
            .then(res => { setData(res.data); setState('ok'); })
            .catch(() => setState('error'));
    }, [slug]);

    const accent = data?.hotel.primaryColor || '#7c3aed';
    const cur = data?.hotel.currency || 'NPR';

    // Apply category filter + text search across name/description.
    const cats = useMemo(() => {
        if (!data) return [];
        const q = query.trim().toLowerCase();
        return data.categories
            .filter(c => activeCat === 'All' || c.name === activeCat)
            .map(c => ({
                name: c.name,
                items: q ? c.items.filter(i => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)) : c.items,
            }))
            .filter(c => c.items.length > 0);
    }, [data, query, activeCat]);

    if (state === 'loading') return <Centered>Loading menu…</Centered>;
    if (state === 'error' || !data) return <Centered>Menu not available. Check the link.</Centered>;

    const allCats = ['All', ...data.categories.map(c => c.name)];
    const resultCount = cats.reduce((n, c) => n + c.items.length, 0);

    return (
        <div style={{ minHeight: '100vh', background: '#f7f7f8', color: '#1a1a1a', fontFamily: 'system-ui, sans-serif' }}>
            {/* Header */}
            <header style={{ background: accent, color: '#fff', padding: '24px 20px', textAlign: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                {data.hotel.logoUrl && <img src={data.hotel.logoUrl} alt="" style={{ height: 48, marginBottom: 8, objectFit: 'contain' }} />}
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{data.hotel.name}</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.85 }}>Digital Menu</p>
            </header>

            {/* Search + category filter */}
            <div style={{ background: '#fff', position: 'sticky', top: 96, zIndex: 9, borderBottom: '1px solid #eee', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ position: 'relative', maxWidth: 680, width: '100%', margin: '0 auto' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search dishes…"
                        style={{ width: '100%', padding: '10px 12px 10px 36px', fontSize: 14, borderRadius: 10, border: '1px solid #e2e2e2', outline: 'none', background: '#fafafa', boxSizing: 'border-box' }}
                    />
                </div>
                {allCats.length > 2 && (
                    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', maxWidth: 680, width: '100%', margin: '0 auto', paddingBottom: 2 }}>
                        {allCats.map(name => (
                            <button key={name} onClick={() => setActiveCat(name)}
                                style={{ whiteSpace: 'nowrap', padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: activeCat === name ? accent : '#f0f0f0', color: activeCat === name ? '#fff' : '#555' }}>
                                {name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Items */}
            <main style={{ maxWidth: 680, margin: '0 auto', padding: '16px' }}>
                {resultCount === 0 && (
                    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#999' }}>
                        <UtensilsCrossed size={40} style={{ opacity: 0.4, marginBottom: 12 }} />
                        <div style={{ fontSize: 14 }}>{query ? `No dishes match “${query}”.` : 'No items on the menu yet.'}</div>
                    </div>
                )}
                {cats.map(c => (
                    <section key={c.name} id={`cat-${c.name}`} style={{ marginBottom: 28, scrollMarginTop: 150 }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px', color: accent }}>{c.name}</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {c.items.map(it => (
                                <div key={it.id} style={{ display: 'flex', gap: 12, background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                                    {it.imageUrl && <img src={it.imageUrl} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 15, fontWeight: 600 }}>{it.name}</div>
                                        {it.description && <div style={{ fontSize: 13, color: '#777', marginTop: 2 }}>{it.description}</div>}
                                    </div>
                                    <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: accent }}>{cur} {Number(it.price).toFixed(2)}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
            </main>
            <footer style={{ textAlign: 'center', padding: '20px', fontSize: 12, color: '#aaa' }}>Powered by Nivas PMS</footer>
        </div>
    );
}

function Centered({ children }: { children: React.ReactNode }) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontFamily: 'system-ui, sans-serif', fontSize: 14, padding: 20, textAlign: 'center' }}>{children}</div>;
}
