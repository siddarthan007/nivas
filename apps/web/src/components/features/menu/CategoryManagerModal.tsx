import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, Loader2, Save } from 'lucide-react';
import { MenuCategoryService, type MenuCategory } from '@/lib/services/menu-category.service';
import Button from '@/components/ui/Button';
import { toast } from 'sonner';

interface CategoryManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onChange: () => void; // Trigger refresh
}

export default function CategoryManagerModal({ isOpen, onClose, onChange }: CategoryManagerModalProps) {
    const [categories, setCategories] = useState<MenuCategory[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchCategories();
        }
    }, [isOpen]);

    const fetchCategories = async () => {
        setLoading(true);
        try {
            const data = await MenuCategoryService.getAll();
            setCategories(data);
        } catch (error) {
            toast.error('Failed to load categories');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await MenuCategoryService.create({ name: newCategoryName });
            toast.success('Category created');
            setNewCategoryName('');
            setIsCreating(false);
            fetchCategories();
            onChange();
        } catch (error) {
            toast.error('Failed to create category');
        }
    };

    const handleUpdate = async (id: number) => {
        if (!editName.trim()) return;
        try {
            await MenuCategoryService.update(id, { name: editName });
            toast.success('Category updated');
            setEditingId(null);
            fetchCategories();
            onChange();
        } catch (error) {
            toast.error('Failed to update category');
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure? This will hide the category.')) return;
        try {
            await MenuCategoryService.delete(id);
            toast.success('Category deleted');
            fetchCategories();
            onChange();
        } catch (error) {
            toast.error('Failed to delete category');
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'var(--notion-overlay)',
            backdropFilter: 'blur(4px)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '28rem',
                backgroundColor: 'var(--notion-bg)',
                border: '1px solid var(--notion-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-xl)',
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease-out',
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderBottom: '1px solid var(--notion-border)',
                }}>
                    <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)', margin: 0 }}>Manage Categories</h2>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            cursor: 'pointer',
                            color: 'var(--notion-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color 150ms ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '16px' }}>
                                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--notion-text-secondary)' }} />
                            </div>
                        ) : categories.length === 0 ? (
                            <p style={{ textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '14px', padding: '16px', margin: 0 }}>No categories found.</p>
                        ) : (
                            categories.map(cat => (
                                <div
                                    key={cat.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        backgroundColor: 'var(--notion-bg-secondary)',
                                        border: '1px solid var(--notion-border)',
                                    }}
                                >
                                    {editingId === cat.id ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                                            <input
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: 'var(--notion-bg)',
                                                    border: '1px solid var(--notion-border)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    padding: '6px 10px',
                                                    fontSize: '14px',
                                                    outline: 'none',
                                                    color: 'var(--notion-text)',
                                                }}
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                autoFocus
                                                onKeyDown={e => e.key === 'Enter' && handleUpdate(cat.id)}
                                            />
                                            <button
                                                onClick={() => handleUpdate(cat.id)}
                                                style={{
                                                    padding: '4px',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--notion-green)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    display: 'flex',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(0,180,100,0.1)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <Check size={16} />
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                style={{
                                                    padding: '4px',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--notion-text-secondary)',
                                                    borderRadius: 'var(--radius-sm)',
                                                    display: 'flex',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'}
                                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>{cat.name}</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <button
                                                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                                                    style={{
                                                        padding: '6px',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'var(--notion-text-secondary)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        display: 'flex',
                                                        transition: 'all 150ms ease',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)'; e.currentTarget.style.color = 'var(--notion-blue)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--notion-text-secondary)'; }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(cat.id)}
                                                    style={{
                                                        padding: '6px',
                                                        background: 'none',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'var(--notion-text-secondary)',
                                                        borderRadius: 'var(--radius-sm)',
                                                        display: 'flex',
                                                        transition: 'all 150ms ease',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--notion-red-bg)'; e.currentTarget.style.color = 'var(--notion-red)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--notion-text-secondary)'; }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add New */}
                    {isCreating ? (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 12px',
                            border: '1px solid var(--notion-blue)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg)',
                        }}>
                            <input
                                style={{
                                    flex: 1,
                                    background: 'transparent',
                                    border: 'none',
                                    outline: 'none',
                                    fontSize: '14px',
                                    color: 'var(--notion-text)',
                                }}
                                placeholder="Category Name"
                                value={newCategoryName}
                                onChange={e => setNewCategoryName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                                autoFocus
                            />
                            <button
                                onClick={handleCreate}
                                style={{
                                    padding: '4px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--notion-blue)',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <Save size={16} />
                            </button>
                            <button
                                onClick={() => setIsCreating(false)}
                                style={{
                                    padding: '4px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: 'var(--notion-text-secondary)',
                                    borderRadius: 'var(--radius-sm)',
                                    display: 'flex',
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--notion-bg-secondary)'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : (
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={() => setIsCreating(true)}
                            icon={<Plus size={16} />}
                        >
                            Add New Category
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
