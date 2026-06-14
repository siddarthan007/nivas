'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import WalkInCheckInPanel from '@/components/features/bookings/WalkInCheckInPanel';
import { useBookings } from '@/lib/hooks/useBookings';
import { useRooms } from '@/lib/hooks/useRooms';
import { useRouter, useSearchParams } from '@/lib/router';
import { toast } from 'sonner';
import api from '@/lib/api';
import { GuestService, type GuestDetails } from '@/lib/services/guest.service';
import type { Booking, BookingStatus } from '@/lib/types/api.types';
import { format } from 'date-fns';
import {
  DoorOpen, Search, CalendarDays, User, Phone, Mail,
  BedDouble, ChevronLeft, Check, AlertCircle, Clock,
  Loader2, ArrowRight, UserPlus, Star, History
} from 'lucide-react';

type Step = 'search' | 'review' | 'success';
type FlowMode = 'reservation' | 'walkin';

export default function CheckInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkIn } = useBookings();
  const { rooms } = useRooms();

  const initialMode = (searchParams.get('mode') === 'walkin' ? 'walkin' : 'reservation') as FlowMode;
  const [flowMode, setFlowMode] = useState<FlowMode>(initialMode);
  const walkInPrefill = useMemo(() => ({
    guestId: searchParams.get('guestId') || undefined,
    guestName: searchParams.get('guestName') || undefined,
    guestPhone: searchParams.get('guestPhone') || undefined,
    guestEmail: searchParams.get('guestEmail') || undefined,
    nationality: searchParams.get('nationality') || undefined,
    idType: searchParams.get('idType') || undefined,
    idNumber: searchParams.get('idNumber') || undefined,
  }), [searchParams]);

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [step, setStep] = useState<Step>('search');
  const [checkingIn, setCheckingIn] = useState(false);
  const [guestPin, setGuestPin] = useState<string | null>(null);
  const [guestProfile, setGuestProfile] = useState<GuestDetails | null>(null);

  const searchBookings = useCallback(async () => {
    if (!query.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get<Booking[]>(`/bookings?segment=arrivals&search=${encodeURIComponent(query.trim())}&limit=20`);
      // Only show CONFIRMED bookings eligible for check-in
      const eligible = (res.data || []).filter((b: Booking) => b.status === 'CONFIRMED');
      setResults(eligible);
    } catch {
      toast.error('Failed to search bookings');
    } finally {
      setSearching(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => { searchBookings(); }, query.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [query, searchBookings]);

  const handleSelect = (booking: Booking) => {
    setSelectedBooking(booking);
    setGuestProfile(null);
    setStep('review');
  };

  useEffect(() => {
    if (!selectedBooking?.guestId) {
      setGuestProfile(null);
      return;
    }
    GuestService.getById(selectedBooking.guestId)
      .then(setGuestProfile)
      .catch(() => setGuestProfile(null));
  }, [selectedBooking?.guestId]);

  const handleWalkInSuccess = (result: { guestPin: string; guestName: string; roomId: number }) => {
    setGuestPin(result.guestPin);
    setSelectedBooking({
      id: '',
      guestName: result.guestName,
      roomId: result.roomId,
      checkIn: new Date().toISOString(),
      checkOut: new Date().toISOString(),
      status: 'CHECKED_IN' as BookingStatus,
    } as Booking);
    setStep('success');
  };

  const handleCheckIn = async () => {
    if (!selectedBooking) return;
    setCheckingIn(true);
    try {
      const result = await checkIn(selectedBooking.id);
      if (result?.success && result?.guestPin) {
        setGuestPin(result.guestPin);
        setStep('success');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Check-in failed');
    } finally {
      setCheckingIn(false);
    }
  };

  const room = selectedBooking ? rooms.find(r => r.id === selectedBooking.roomId) : null;
  const nights = selectedBooking
    ? Math.max(1, Math.ceil((new Date(selectedBooking.checkOut).getTime() - new Date(selectedBooking.checkIn).getTime()) / 86400000))
    : 0;

  const labelStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px', display: 'block' };

  return (
      <div style={{ padding: 'var(--space-8)', maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <DoorOpen size={28} /> Guest Check-In
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
              {flowMode === 'reservation'
                ? 'Search for confirmed bookings and complete check-in'
                : 'Register a walk-in guest and check in immediately'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => router.push('/hotel/guests/new')}>
              <UserPlus size={14} style={{ marginRight: 4 }} /> New Customer
            </Button>
            <Button variant="secondary" onClick={() => router.push('/hotel/bookings')}>
              <ChevronLeft size={14} style={{ marginRight: '4px' }} /> Back to Bookings
            </Button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-5)' }}>
          {([
            { id: 'reservation' as const, label: 'Reservation check-in', icon: Search },
            { id: 'walkin' as const, label: 'Walk-in check-in', icon: UserPlus },
          ]).map(tab => {
            const Icon = tab.icon;
            const active = flowMode === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setFlowMode(tab.id); setStep('search'); setSelectedBooking(null); }}
                style={{
                  padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
                  border: active ? '2px solid var(--notion-blue)' : '1px solid var(--notion-border)',
                  background: active ? 'var(--notion-blue-bg)' : 'var(--notion-bg-secondary)',
                  color: active ? 'var(--notion-blue)' : 'var(--notion-text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <Icon size={14} /> {tab.label}
              </button>
            );
          })}
        </div>

        {flowMode === 'walkin' && step !== 'success' && (
          <WalkInCheckInPanel prefill={walkInPrefill} onSuccess={handleWalkInSuccess} />
        )}

        {flowMode === 'reservation' && step === 'search' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search by guest name, phone, or booking ID..."
                  icon={<Search size={14} />}
                  autoFocus
                />
              </div>
              <Button onClick={searchBookings} disabled={searching}>
                {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
              </Button>
            </div>

            {results.length === 0 && query.trim() && !searching && (
              <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                <AlertCircle size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                <p>No confirmed bookings found.</p>
                <p style={{ fontSize: '13px', marginTop: 'var(--space-2)' }}>Try searching by guest name or phone number.</p>
              </div>
            )}

            {results.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text-secondary)' }}>
                  {results.length} booking{results.length > 1 ? 's' : ''} ready for check-in
                </div>
                {results.map(booking => {
                  const r = rooms.find(rm => rm.id === booking.roomId);
                  return (
                    <button
                      key={booking.id}
                      onClick={() => handleSelect(booking)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                        padding: 'var(--space-4)', textAlign: 'left',
                        backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--notion-border)', cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--notion-blue)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--notion-border)'; }}
                    >
                      <div style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        backgroundColor: 'var(--notion-blue-bg)', color: 'var(--notion-blue)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <User size={20} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)' }}>{booking.guestName}</div>
                        <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', display: 'flex', gap: 'var(--space-3)', marginTop: '2px' }}>
                          <span>{booking.guestPhone || '—'}</span>
                          <span>Room {r?.number || booking.roomId}</span>
                          <span>{format(new Date(booking.checkIn), 'MMM d')} – {format(new Date(booking.checkOut), 'MMM d')}</span>
                        </div>
                      </div>
                      <ArrowRight size={18} style={{ color: 'var(--notion-text-secondary)' }} />
                    </button>
                  );
                })}
              </div>
            )}

            {!query.trim() && !searching && (
              <div style={{ textAlign: 'center', padding: 'var(--space-12)', color: 'var(--notion-text-secondary)' }}>
                <Search size={48} style={{ opacity: 0.3, marginBottom: 'var(--space-4)' }} />
                <p>Enter a guest name or phone number to find bookings ready for check-in.</p>
              </div>
            )}
          </div>
        )}

        {flowMode === 'reservation' && step === 'review' && selectedBooking && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{
              backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--notion-border)', padding: 'var(--space-6)',
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <CalendarDays size={20} /> Booking Details
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={labelStyle}>Guest Name</label>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <User size={14} style={{ color: 'var(--notion-text-secondary)' }} /> {selectedBooking.guestName}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={14} style={{ color: 'var(--notion-text-secondary)' }} /> {selectedBooking.guestPhone || '—'}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Email</label>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={14} style={{ color: 'var(--notion-text-secondary)' }} /> {selectedBooking.guestEmail || '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={labelStyle}>Room</label>
                    <div style={{ fontSize: '15px', fontWeight: '500', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BedDouble size={14} style={{ color: 'var(--notion-text-secondary)' }} />
                      {room ? `Room ${room.number} — ${room.type}` : `Room ${selectedBooking.roomId}`}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Check-in / Check-out</label>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarDays size={14} style={{ color: 'var(--notion-text-secondary)' }} />
                      {format(new Date(selectedBooking.checkIn), 'MMM d, yyyy')} — {format(new Date(selectedBooking.checkOut), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Duration & Amount</label>
                    <div style={{ fontSize: '14px', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={14} style={{ color: 'var(--notion-text-secondary)' }} />
                      {nights} night{nights > 1 ? 's' : ''} · NPR {Number(selectedBooking.totalAmount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 'var(--space-5)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--notion-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                  <AlertCircle size={14} style={{ color: 'var(--notion-orange)' }} />
                  Please verify the guest identity before completing check-in.
                </div>
                {guestProfile && (
                  <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--notion-text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <History size={12} /> Guest profile
                      {guestProfile.isVip && <span style={{ color: 'var(--notion-yellow)', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Star size={10} /> VIP</span>}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                      {guestProfile.bookings?.length || 0} past stay{(guestProfile.bookings?.length || 0) !== 1 ? 's' : ''}
                      {guestProfile.notes ? ` · Note: ${guestProfile.notes}` : ''}
                    </div>
                    <Button size="sm" variant="secondary" style={{ marginTop: 8 }} onClick={() => router.push(`/hotel/guests/${guestProfile.id}`)}>
                      View full profile
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => { setStep('search'); setSelectedBooking(null); }}>
                <ChevronLeft size={14} style={{ marginRight: '4px' }} /> Back to Search
              </Button>
              <Button onClick={handleCheckIn} disabled={checkingIn}>
                {checkingIn ? <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} /> : <DoorOpen size={14} style={{ marginRight: '6px' }} />}
                {checkingIn ? 'Checking In...' : 'Complete Check-In'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && selectedBooking && (
          <div style={{
            backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--notion-border)', padding: 'var(--space-8)',
            textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)',
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              backgroundColor: 'var(--notion-green-bg)', color: 'var(--notion-green)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Check size={32} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--notion-text)' }}>
                Check-In Successful
              </div>
              <div style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
                {selectedBooking.guestName} has been checked in to Room {room?.number || selectedBooking.roomId}
              </div>
            </div>

            {guestPin && (
              <div style={{
                backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)',
                border: '2px dashed var(--notion-blue)', padding: 'var(--space-4)',
                minWidth: '280px', marginTop: 'var(--space-2)',
              }}>
                <div style={{ fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: 'var(--space-1)' }}>
                  Room Access PIN
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--notion-blue)', letterSpacing: '4px' }}>
                  {guestPin}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-2)' }}>
                  Share this PIN with the guest for room access.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
              <Button variant="secondary" onClick={() => { setStep('search'); setSelectedBooking(null); setGuestPin(null); setQuery(''); setResults([]); }}>
                Check In Another Guest
              </Button>
              <Button onClick={() => router.push('/hotel/bookings')}>
                Go to Bookings
              </Button>
            </div>
          </div>
        )}
      </div>
  );
}
