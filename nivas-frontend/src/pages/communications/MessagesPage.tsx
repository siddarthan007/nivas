'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PageContainer from '@/components/layout/PageContainer';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { useMessages, type Message, type Conversation, type StaffMember } from '@/lib/hooks/useMessages';
import {
    MessageSquare,
    Search,
    Send,
    User,
    Clock,
    CheckCheck,
    Plus,
    Inbox,
    Bell,
    BedDouble,
    RefreshCw,
    Loader2,
    AlertCircle,
    X,
    ArrowLeft
} from 'lucide-react';

const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function ConversationItem({
    conversation,
    isActive,
    onClick
}: {
    conversation: Conversation;
    isActive: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backgroundColor: isActive ? 'var(--notion-bg-tertiary)' : 'transparent',
                border: 'none',
                borderLeft: isActive ? '3px solid var(--notion-blue)' : '3px solid transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease'
            }}
        >
            <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--notion-blue-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--notion-blue)',
                flexShrink: 0
            }}>
                <User size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{
                        fontWeight: conversation.unreadCount > 0 ? '600' : '500',
                        color: 'var(--notion-text)',
                        fontSize: '14px'
                    }}>
                        {conversation.guestName}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                        {formatTime(conversation.lastMessageAt)}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    {conversation.roomNumber && (
                        <span style={{
                            fontSize: '11px',
                            padding: '1px 6px',
                            backgroundColor: 'var(--notion-bg-tertiary)',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--notion-text-secondary)'
                        }}>
                            <BedDouble size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                            {conversation.roomNumber}
                        </span>
                    )}
                    <span style={{
                        fontSize: '13px',
                        color: 'var(--notion-text-secondary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                    }}>
                        {conversation.lastMessage}
                    </span>
                </div>
            </div>
            {conversation.unreadCount > 0 && (
                <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--notion-blue)',
                    color: 'var(--foreground-inverse)',
                    fontSize: '11px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    {conversation.unreadCount}
                </div>
            )}
        </button>
    );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: isOwn ? 'flex-end' : 'flex-start',
            marginBottom: '12px'
        }}>
            <div style={{
                maxWidth: '70%',
                padding: '10px 14px',
                borderRadius: isOwn ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                backgroundColor: isOwn ? 'var(--notion-blue)' : 'var(--notion-bg-tertiary)',
                color: isOwn ? 'var(--foreground-inverse)' : 'var(--notion-text)'
            }}>
                {!isOwn && message.senderName && (
                    <div style={{ fontSize: '12px', fontWeight: '500', marginBottom: '4px', opacity: 0.8 }}>
                        {message.senderName}
                    </div>
                )}
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>{message.content}</div>
                <div style={{
                    fontSize: '11px',
                    marginTop: '4px',
                    opacity: 0.7,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '4px'
                }}>
                    {formatTime(message.createdAt)}
                    {isOwn && message.isRead && <CheckCheck size={12} />}
                </div>
            </div>
        </div>
    );
}

function ConversationSkeleton() {
    return (
        <div style={{ padding: '16px' }}>
            {[1, 2, 3, 4].map(i => (
                <div key={i} style={{
                    display: 'flex',
                    gap: '12px',
                    marginBottom: '12px',
                    padding: '8px 0'
                }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--notion-bg-secondary)',
                        animation: 'pulse 2s infinite'
                    }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ height: '14px', width: '60%', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', marginBottom: '8px', animation: 'pulse 2s infinite' }} />
                        <div style={{ height: '12px', width: '80%', backgroundColor: 'var(--notion-bg-secondary)', borderRadius: '4px', animation: 'pulse 2s infinite' }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function NewConversationPanel({
    staffList,
    isLoading,
    onSelect,
    onClose
}: {
    staffList: StaffMember[];
    isLoading: boolean;
    onSelect: (member: StaffMember) => void;
    onClose: () => void;
}) {
    const [search, setSearch] = useState('');

    const filtered = useMemo(() =>
        staffList.filter(m =>
            (m.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (m.role?.name || '').toLowerCase().includes(search.toLowerCase())
        ),
        [staffList, search]
    );

    return (
        <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'var(--notion-bg)',
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
        }}>
            <div style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--notion-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
            }}>
                <button
                    onClick={onClose}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--notion-text-secondary)',
                        padding: '4px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                    }}
                >
                    <ArrowLeft size={18} />
                </button>
                <span style={{ fontWeight: '600', fontSize: '15px', color: 'var(--notion-text)' }}>
                    New Conversation
                </span>
            </div>

            <div style={{ padding: '12px 16px' }}>
                <Input
                    type="text"
                    placeholder="Search staff..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoFocus
                    icon={<Search size={14} />}
                />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                {isLoading ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                        <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Loading staff...
                    </div>
                ) : filtered.length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--notion-text-secondary)', fontSize: '13px' }}>
                        No staff members found
                    </div>
                ) : (
                    filtered.map(member => (
                        <button
                            key={member.id}
                            onClick={() => onSelect(member)}
                            style={{
                                width: '100%',
                                padding: '10px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'background 0.15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--notion-bg-tertiary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                            <div style={{
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--notion-green-bg)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--notion-green)',
                                flexShrink: 0
                            }}>
                                <User size={16} />
                            </div>
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--notion-text)' }}>
                                    {member.name}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                    {member.role?.name}
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}

export default function MessagesPage() {
    const { user } = useAuth();
    const {
        conversations, activeConversation, messages, isLoading, error,
        staffList, isLoadingStaff,
        refresh, selectConversation, sendMessage, markAsRead,
        fetchStaffList, startNewConversation
    } = useMessages();

    const [searchQuery, setSearchQuery] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [showNewConversation, setShowNewConversation] = useState(false);

    const totalUnread = useMemo(() => conversations.reduce((sum, c) => sum + c.unreadCount, 0), [conversations]);

    const filteredConversations = useMemo(
        () => conversations.filter(c =>
            (c.guestName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.roomNumber?.includes(searchQuery) ||
            (c.lastMessage || '').toLowerCase().includes(searchQuery.toLowerCase())
        ),
        [conversations, searchQuery]
    );

    useEffect(() => {
        if (activeConversation && activeConversation.unreadCount > 0 && activeConversation.participantId) {
            markAsRead(activeConversation.participantId);
        }
    }, [activeConversation, markAsRead]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !activeConversation) return;

        setIsSending(true);
        const success = await sendMessage({
            content: newMessage,
            receiverId: activeConversation.participantId || undefined,
            roomId: activeConversation.roomId ?? undefined
        });

        if (success) {
            setNewMessage('');
        }
        setIsSending(false);
    };

    const handleNewConversation = () => {
        fetchStaffList();
        setShowNewConversation(true);
    };

    const handleSelectStaff = (member: StaffMember) => {
        startNewConversation(member);
        setShowNewConversation(false);
    };

    return (
        <DashboardLayout>
            <PageContainer>
                <div style={{
                    display: 'flex',
                    height: 'calc(100vh - 120px)',
                    backgroundColor: 'var(--notion-bg)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--notion-border)',
                    overflow: 'hidden'
                }}>
                    {/* Conversation List */}
                    <div style={{
                        width: '320px',
                        minWidth: '280px',
                        borderRight: '1px solid var(--notion-border)',
                        display: 'flex',
                        flexDirection: 'column',
                        position: 'relative',
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid var(--notion-border)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MessageSquare size={20} color="var(--notion-blue)" />
                                    <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0 }}>Messages</h2>
                                    {totalUnread > 0 && (
                                        <span style={{
                                            backgroundColor: 'var(--notion-red)',
                                            color: 'var(--foreground-inverse)',
                                            fontSize: '11px',
                                            padding: '2px 6px',
                                            borderRadius: '10px',
                                            fontWeight: '600'
                                        }}>
                                            {totalUnread}
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={refresh}
                                        disabled={isLoading}
                                        icon={isLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        icon={<Plus size={16} />}
                                        onClick={handleNewConversation}
                                    />
                                </div>
                            </div>

                            <Input
                                type="text"
                                placeholder="Search messages..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                icon={<Search size={14} />}
                            />
                        </div>

                        {/* Error State */}
                        {error && (
                            <div style={{
                                padding: 'var(--space-3)',
                                margin: 'var(--space-2)',
                                backgroundColor: 'var(--notion-red-bg)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--notion-red)',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                <AlertCircle size={12} />
                                {error}
                            </div>
                        )}

                        {/* Conversation List */}
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {isLoading ? (
                                <ConversationSkeleton />
                            ) : filteredConversations.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--notion-text-secondary)' }}>
                                    <Inbox size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                    <div>No conversations found</div>
                                    <button
                                        onClick={handleNewConversation}
                                        style={{
                                            marginTop: '12px',
                                            padding: '6px 12px',
                                            fontSize: '13px',
                                            color: 'var(--notion-blue)',
                                            background: 'var(--notion-blue-bg)',
                                            border: 'none',
                                            borderRadius: 'var(--radius-md)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        Start a conversation
                                    </button>
                                </div>
                            ) : (
                                filteredConversations.map(conv => (
                                    <ConversationItem
                                        key={conv.id}
                                        conversation={conv}
                                        isActive={activeConversation?.id === conv.id}
                                        onClick={() => {
                                            const pid = conv.participantId || String(conv.id);
                                            selectConversation(pid);
                                        }}
                                    />
                                ))
                            )}
                        </div>

                        {/* New Conversation Panel (overlay) */}
                        {showNewConversation && (
                            <NewConversationPanel
                                staffList={staffList}
                                isLoading={isLoadingStaff}
                                onSelect={handleSelectStaff}
                                onClose={() => setShowNewConversation(false)}
                            />
                        )}
                    </div>

                    {/* Chat Area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {activeConversation ? (
                            <>
                                {/* Chat Header */}
                                <div style={{
                                    padding: '16px 20px',
                                    borderBottom: '1px solid var(--notion-border)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{
                                        width: '36px',
                                        height: '36px',
                                        borderRadius: '50%',
                                        backgroundColor: 'var(--notion-blue-bg)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--notion-blue)'
                                    }}>
                                        <User size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: '600', fontSize: '15px' }}>{activeConversation.guestName}</div>
                                        {activeConversation.roomNumber && (
                                            <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)' }}>
                                                Room {activeConversation.roomNumber}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Messages */}
                                <div style={{
                                    flex: 1,
                                    padding: '20px',
                                    overflowY: 'auto',
                                    backgroundColor: 'var(--notion-bg-secondary)'
                                }}>
                                    {messages.length === 0 ? (
                                        <div style={{ textAlign: 'center', color: 'var(--notion-text-secondary)', padding: '32px' }}>
                                            <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                                            <div>No messages yet. Start the conversation!</div>
                                        </div>
                                    ) : (
                                        messages.map(msg => (
                                            <MessageBubble
                                                key={msg.id}
                                                message={msg}
                                                isOwn={String(msg.senderId) === String(user?.id)}
                                            />
                                        ))
                                    )}
                                </div>

                                {/* Message Input */}
                                <div style={{
                                    padding: '16px 20px',
                                    borderTop: '1px solid var(--notion-border)',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'center'
                                }}>
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                                        disabled={isSending}
                                        style={{
                                            flex: 1,
                                            padding: '10px 14px',
                                            fontSize: '14px',
                                            border: '1px solid var(--notion-border)',
                                            borderRadius: 'var(--radius-md)',
                                            backgroundColor: 'var(--notion-bg)',
                                            color: 'var(--notion-text)',
                                            outline: 'none'
                                        }}
                                    />
                                    <Button
                                        variant="primary"
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim() || isSending}
                                        icon={isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    >
                                        Send
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div style={{
                                flex: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--notion-text-secondary)',
                                padding: '0 32px',
                                textAlign: 'center'
                            }}>
                                <Inbox size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                                <h3 style={{ margin: '0 0 8px 0', fontWeight: '600', fontSize: '16px', color: 'var(--notion-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select a conversation</h3>
                                <p style={{ fontSize: '14px', marginBottom: '20px', maxWidth: '320px', lineHeight: '1.5' }}>Choose from your existing conversations or start a new one</p>
                                <Button variant="secondary" onClick={handleNewConversation} icon={<Plus size={16} />}>
                                    New Conversation
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </PageContainer>
        </DashboardLayout>
    );
}

