'use client';

import { useState } from 'react';
import { useHousekeeping } from '@/lib/hooks/useHousekeeping';
import { useRooms } from '@/lib/hooks/useRooms';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import {
    Sparkles,
    RefreshCw,
    Plus,
    Clock,
    Play,
    CheckCircle,
    AlertTriangle,
    User
} from 'lucide-react';
import type { HousekeepingTask, HousekeepingStatus, HousekeepingPriority, HousekeepingTaskType, CreateHousekeepingPayload } from '@/lib/types/api.types';

// Status colors
const STATUS_COLORS: Record<HousekeepingStatus, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)', label: 'Pending' },
    IN_PROGRESS: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)', label: 'In Progress' },
    COMPLETED: { bg: 'var(--notion-green-bg)', text: 'var(--notion-green)', label: 'Completed' },
    DONE: { bg: 'rgba(120,120,120,0.2)', text: '#666', label: 'Done' },
};

// Priority colors
const PRIORITY_COLORS: Record<HousekeepingPriority, { bg: string; text: string }> = {
    LOW: { bg: 'rgba(120,120,120,0.2)', text: '#666' },
    NORMAL: { bg: 'var(--notion-blue-bg)', text: 'var(--notion-blue)' },
    HIGH: { bg: 'var(--notion-yellow-bg)', text: 'var(--notion-orange)' },
    URGENT: { bg: 'var(--notion-red-bg)', text: 'var(--notion-red)' },
};

const TASK_TYPES: HousekeepingTaskType[] = ['CHECKOUT_CLEAN', 'STAYOVER_CLEAN', 'DEEP_CLEAN', 'MAINTENANCE', 'INSPECTION'];
const PRIORITIES: HousekeepingPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

// Task Card Component
function TaskCard({
    task,
    onStart,
    onComplete
}: {
    task: HousekeepingTask;
    onStart: () => void;
    onComplete: () => void;
}) {
    const statusInfo = STATUS_COLORS[task.status];
    const priorityInfo = PRIORITY_COLORS[task.priority];

    // Calculate time since created
    const createdAt = new Date(task.createdAt);
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - createdAt.getTime()) / 60000);
    let timeLabel = '';
    if (diffMins < 60) timeLabel = `${diffMins}m`;
    else if (diffMins < 1440) timeLabel = `${Math.floor(diffMins / 60)}h`;
    else timeLabel = `${Math.floor(diffMins / 1440)}d`;

    return (
        <div style={{
            backgroundColor: 'var(--notion-bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)',
            padding: 'var(--space-4)',
            borderLeft: `4px solid ${priorityInfo.text}`,
            transition: 'transform 150ms ease, box-shadow 150ms ease',
        }}
            onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-md)';
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = 'none';
            }}
        >
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-3)'
            }}>
                <div>
                    <div style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: 'var(--notion-text)',
                    }}>
                        Room {task.room?.number || task.roomId}
                    </div>
                    <div style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-secondary)',
                        marginTop: '2px',
                        textTransform: 'capitalize',
                    }}>
                        {(task.taskType || '').toLowerCase().replace(/_/g, ' ')}
                    </div>
                </div>

                {/* Priority Badge */}
                {task.priority !== 'NORMAL' && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        backgroundColor: priorityInfo.bg,
                        borderRadius: '10px',
                    }}>
                        {task.priority === 'URGENT' && <AlertTriangle size={12} style={{ color: priorityInfo.text }} />}
                        <span style={{
                            fontSize: '11px',
                            fontWeight: '500',
                            color: priorityInfo.text,
                        }}>
                            {task.priority}
                        </span>
                    </div>
                )}
            </div>

            {/* Status and Time */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-3)',
                padding: 'var(--space-2) 0',
                borderTop: '1px solid var(--notion-divider)',
            }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    backgroundColor: statusInfo.bg,
                    borderRadius: '10px',
                }}>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: '500',
                        color: statusInfo.text,
                    }}>
                        {statusInfo.label}
                    </span>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: 'var(--notion-text-secondary)',
                }}>
                    <Clock size={12} />
                    {timeLabel}
                </div>
            </div>

            {/* Assigned Staff */}
            {task.assignedTo && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)',
                    fontSize: '12px',
                    color: 'var(--notion-text-secondary)',
                    marginBottom: 'var(--space-3)',
                }}>
                    <User size={12} />
                    {task.assignedTo.fullName}
                </div>
            )}

            {/* Actions */}
            <div style={{
                display: 'flex',
                gap: 'var(--space-2)',
            }}>
                {task.status === 'PENDING' && (
                    <Button size="sm" onClick={onStart} style={{ flex: 1 }}>
                        <Play size={14} style={{ marginRight: '4px' }} />
                        Start
                    </Button>
                )}
                {task.status === 'IN_PROGRESS' && (
                    <Button size="sm" onClick={onComplete} style={{ flex: 1 }}>
                        <CheckCircle size={14} style={{ marginRight: '4px' }} />
                        Complete
                    </Button>
                )}
            </div>
        </div>
    );
}

// Kanban Column
function KanbanColumn({
    title,
    tasks,
    color,
    onStart,
    onComplete
}: {
    title: string;
    tasks: HousekeepingTask[];
    color: string;
    onStart: (id: number) => void;
    onComplete: (id: number) => void;
}) {
    return (
        <div style={{
            flex: 1,
            minWidth: '280px',
            backgroundColor: 'var(--notion-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-4)',
        }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                paddingBottom: 'var(--space-3)',
                borderBottom: '1px solid var(--notion-divider)',
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: color,
                }} />
                <span style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: 'var(--notion-text)',
                }}>
                    {title}
                </span>
                <span style={{
                    fontSize: '12px',
                    color: 'var(--notion-text-secondary)',
                    backgroundColor: 'var(--notion-bg)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                }}>
                    {tasks.length}
                </span>
            </div>

            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
            }}>
                {tasks.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: 'var(--space-6)',
                        color: 'var(--notion-text-secondary)',
                        fontSize: '13px',
                    }}>
                        No tasks
                    </div>
                ) : (
                    tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            onStart={() => onStart(task.id)}
                            onComplete={() => onComplete(task.id)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

// New Task Form Modal
function TaskFormModal({
    isOpen,
    onClose,
    onSubmit,
    rooms,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CreateHousekeepingPayload) => Promise<void>;
    rooms: { id: number; number: number }[];
}) {
    const [formData, setFormData] = useState<CreateHousekeepingPayload>({
        roomId: 0,
        taskType: 'CHECKOUT_CLEAN',
        priority: 'NORMAL',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        await onSubmit(formData);
        setIsSubmitting(false);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Task">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Room *
                    </label>
                    <select
                        value={formData.roomId}
                        onChange={e => setFormData({ ...formData, roomId: parseInt(e.target.value) })}
                        required
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                        }}
                    >
                        <option value={0}>Select Room</option>
                        {rooms.map(room => (
                            <option key={room.id} value={room.id}>Room {room.number}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Task Type *
                    </label>
                    <select
                        value={formData.taskType}
                        onChange={e => setFormData({ ...formData, taskType: e.target.value as HousekeepingTaskType })}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                        }}
                    >
                        {TASK_TYPES.map(type => (
                            <option key={type} value={type}>
                                {type.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label style={{ fontSize: '13px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' }}>
                        Priority
                    </label>
                    <select
                        value={formData.priority}
                        onChange={e => setFormData({ ...formData, priority: e.target.value as HousekeepingPriority })}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '14px',
                            border: '1px solid var(--notion-border)',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: 'var(--notion-bg)',
                            color: 'var(--notion-text)',
                        }}
                    >
                        {PRIORITIES.map(priority => (
                            <option key={priority} value={priority}>{priority}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                    <Button type="button" variant="secondary" onClick={onClose} style={{ flex: 1 }}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting || !formData.roomId} style={{ flex: 1 }}>
                        {isSubmitting ? 'Creating...' : 'Create Task'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default function HousekeepingPage() {
    const {
        isLoading,
        stats,
        pendingTasks,
        inProgressTasks,
        completedTasks,
        fetchTasks,
        createTask,
        startTask,
        completeTask
    } = useHousekeeping();
    const { rooms } = useRooms();
    const [isFormOpen, setIsFormOpen] = useState(false);

    const handleCreateTask = async (data: CreateHousekeepingPayload) => {
        await createTask(data);
    };

    const roomsList = rooms.map(r => ({ id: r.id, number: r.number }));

    return (
        <DashboardLayout>
            <div style={{ padding: 'var(--space-8)' }}>
                    {/* Header */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--space-6)',
                    }}>
                        <div>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: '600',
                                color: 'var(--notion-text)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-3)',
                            }}>
                                <Sparkles size={28} />
                                Housekeeping
                            </h1>
                            <p style={{
                                fontSize: '14px',
                                color: 'var(--notion-text-secondary)',
                                marginTop: 'var(--space-1)',
                            }}>
                                Room cleaning and maintenance tasks
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                            <Button variant="secondary" onClick={() => fetchTasks()} disabled={isLoading}>
                                <RefreshCw size={14} style={{ marginRight: '6px' }} />
                                Refresh
                            </Button>
                            <Button onClick={() => setIsFormOpen(true)}>
                                <Plus size={14} style={{ marginRight: '6px' }} />
                                New Task
                            </Button>
                        </div>
                    </div>

                    {/* Stats */}
                    <div style={{
                        display: 'flex',
                        gap: 'var(--space-6)',
                        marginBottom: 'var(--space-6)',
                    }}>
                        {[
                            { label: 'Total', value: stats.total, color: 'var(--notion-text)' },
                            { label: 'Pending', value: stats.pending, color: 'var(--notion-orange)' },
                            { label: 'In Progress', value: stats.inProgress, color: 'var(--notion-blue)' },
                            { label: 'Completed', value: stats.completed, color: 'var(--notion-green)' },
                        ].map(stat => (
                            <div key={stat.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                <span style={{ fontSize: '20px', fontWeight: '600', color: stat.color }}>{stat.value}</span>
                                <span style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>{stat.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Kanban Board */}
                    {isLoading ? (
                        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} style={{
                                    flex: 1,
                                    height: '400px',
                                    backgroundColor: 'var(--notion-bg-tertiary)',
                                    borderRadius: 'var(--radius-lg)',
                                    animation: 'pulse 1.5s ease-in-out infinite',
                                }} />
                            ))}
                        </div>
                    ) : stats.total === 0 ? (
                        <EmptyState
                            icon={<Sparkles size={48} strokeWidth={1} />}
                            title="No housekeeping tasks yet"
                            description="Create your first task to start managing room cleaning and maintenance."
                            action={
                                <Button onClick={() => setIsFormOpen(true)}>
                                    <Plus size={14} style={{ marginRight: '6px' }} />
                                    New Task
                                </Button>
                            }
                        />
                    ) : (
                        <div style={{
                            display: 'flex',
                            gap: 'var(--space-4)',
                            overflowX: 'auto',
                            paddingBottom: 'var(--space-4)',
                        }}>
                            <KanbanColumn
                                title="Pending"
                                tasks={pendingTasks}
                                color="var(--notion-orange)"
                                onStart={startTask}
                                onComplete={completeTask}
                            />
                            <KanbanColumn
                                title="In Progress"
                                tasks={inProgressTasks}
                                color="var(--notion-blue)"
                                onStart={startTask}
                                onComplete={completeTask}
                            />
                            <KanbanColumn
                                title="Completed"
                                tasks={completedTasks}
                                color="var(--notion-green)"
                                onStart={startTask}
                                onComplete={completeTask}
                            />
                        </div>
                    )}
            </div>

            {/* New Task Modal */}
            <TaskFormModal
                isOpen={isFormOpen}
                onClose={() => setIsFormOpen(false)}
                onSubmit={handleCreateTask}
                rooms={roomsList}
            />
        </DashboardLayout>
    );
}
