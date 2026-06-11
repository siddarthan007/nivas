'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { GuestService, type CustomerType } from '@/lib/services/guest.service';
import { useModuleConfig } from '@/lib/hooks/useModuleConfig';
import NationalitySelect from '@/components/features/guests/NationalitySelect';
import { useRouter } from '@/lib/router';
import { toast } from 'sonner';
import { Users, Phone, Mail, Shield, MapPin, Globe, Banknote, FileText, ChevronLeft, ChevronRight, Check, Hash } from 'lucide-react';

const STEP_LABELS = [
  { num: 1, label: 'Basic Info' },
  { num: 2, label: 'Identity & Address' },
  { num: 3, label: 'Additional Details' },
];

export default function CreateCustomerPage() {
  const router = useRouter();
  const { config } = useModuleConfig();
  const isMixed = config.enableHotel && config.enableFoodAndBeverage;
  const isRestaurantOnly = !config.enableHotel && config.enableFoodAndBeverage;

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    uniqueId: '',
    phone: '',
    email: '',
    fatherName: '',
    dob: '',
    occupation: '',
    nationality: '',
    address: '',
    city: '',
    country: 'Nepal',
    idType: '',
    idNumber: '',
    panNumber: '',
    vatNumber: '',
    openingDueAmount: '',
    customerType: (isRestaurantOnly ? 'RESTAURANT_CUSTOMER' : 'HOTEL_GUEST') as CustomerType,
    notes: '',
  });

  const update = (field: keyof typeof form, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    if (step === 1) return form.firstName.trim() && form.lastName.trim();
    if (step === 2) return true; // optional fields
    return true;
  };

  const handleSubmit = async () => {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First and last name are required');
      setStep(1);
      return;
    }
    setIsSubmitting(true);
    try {
      await GuestService.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        fullName: `${form.firstName} ${form.lastName}`.trim(),
        uniqueId: form.uniqueId || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        fatherName: form.fatherName || undefined,
        dob: form.dob || undefined,
        occupation: form.occupation || undefined,
        nationality: form.nationality || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        idType: form.idType || undefined,
        idNumber: form.idNumber || undefined,
        panNumber: form.panNumber || undefined,
        vatNumber: form.vatNumber || undefined,
        openingDueAmount: form.openingDueAmount || undefined,
        customerType: form.customerType,
        notes: form.notes || undefined,
      });
      toast.success('Customer created successfully');
      router.push('/hotel/guests');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepLabelStyle: React.CSSProperties = {
    fontSize: '11px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em',
    textAlign: 'center', whiteSpace: 'nowrap',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '12px', color: 'var(--notion-text-secondary)', marginBottom: '4px' };

  return (
    <DashboardLayout>
      <div style={{ padding: 'var(--space-8)', maxWidth: '720px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--notion-text)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <Users size={28} /> New Customer
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--notion-text-secondary)', marginTop: 'var(--space-1)' }}>
              Create a new customer / guest profile
            </p>
          </div>
          <Button variant="secondary" onClick={() => router.push('/hotel/guests')}>
            <ChevronLeft size={14} style={{ marginRight: '4px' }} /> Back to List
          </Button>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', marginBottom: 'var(--space-6)', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '14px', left: '20%', right: '20%', display: 'flex' }}>
            <div style={{ flex: 1, height: '2px', backgroundColor: step > 1 ? 'var(--notion-blue)' : 'var(--notion-border)', transition: 'background-color 200ms ease' }} />
            <div style={{ flex: 1, height: '2px', backgroundColor: step > 2 ? 'var(--notion-blue)' : 'var(--notion-border)', transition: 'background-color 200ms ease' }} />
          </div>
          {STEP_LABELS.map(s => (
            <div key={s.num} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1 }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: '600',
                backgroundColor: step >= s.num ? 'var(--notion-blue)' : 'var(--notion-bg-secondary)',
                color: step >= s.num ? 'white' : 'var(--notion-text-secondary)',
                border: step >= s.num ? 'none' : '1px solid var(--notion-border)',
                transition: 'all 200ms ease',
              }}>
                {step > s.num ? <Check size={14} /> : s.num}
              </div>
              <span style={{ ...stepLabelStyle, marginTop: '6px', color: step >= s.num ? 'var(--notion-blue)' : 'var(--notion-text-secondary)', lineHeight: '1.3' }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div style={{ backgroundColor: 'var(--notion-bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--notion-border)', padding: 'var(--space-6)' }}>

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <Input value={form.firstName} onChange={e => update('firstName', e.target.value)} placeholder="Chandra" icon={<Users size={14} />} required />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <Input value={form.lastName} onChange={e => update('lastName', e.target.value)} placeholder="Karki" icon={<Users size={14} />} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>Phone</label>
                  <Input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="9851187548" icon={<Phone size={14} />} />
                </div>
                <div>
                  <label style={labelStyle}>Email</label>
                  <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="john@example.com" icon={<Mail size={14} />} />
                </div>
              </div>
              {isMixed && (
                <div>
                  <label style={labelStyle}>Customer Type</label>
                  <select value={form.customerType} onChange={e => update('customerType', e.target.value as CustomerType)} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none', color: 'var(--notion-text)' }}>
                    <option value="HOTEL_GUEST">Hotel Guest</option>
                    <option value="RESTAURANT_CUSTOMER">Restaurant Customer</option>
                    <option value="BOTH">Both</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Identity & Address */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Identity & Address</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>ID Type</label>
                  <select value={form.idType} onChange={e => update('idType', e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none', color: 'var(--notion-text)' }}>
                    <option value="">Select ID Type</option>
                    <option value="Citizenship">Citizenship</option>
                    <option value="Passport">Passport</option>
                    <option value="Voter ID">Voter ID</option>
                    <option value="National ID">National ID</option>
                    <option value="Driver's License">Driver's License</option>
                    <option value="Aadhar Card">Aadhar Card</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>ID Number</label>
                  <Input value={form.idNumber} onChange={e => update('idNumber', e.target.value)} placeholder="ID number" icon={<Shield size={14} />} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>PAN</label>
                  <Input value={form.panNumber} onChange={e => update('panNumber', e.target.value)} placeholder="PAN" icon={<Hash size={14} />} />
                </div>
                <div>
                  <label style={labelStyle}>VAT</label>
                  <Input value={form.vatNumber} onChange={e => update('vatNumber', e.target.value)} placeholder="VAT" icon={<Hash size={14} />} />
                </div>
                <div>
                  <label style={labelStyle}>Opening Due (NPR)</label>
                  <Input type="number" value={form.openingDueAmount} onChange={e => update('openingDueAmount', e.target.value)} placeholder="0.00" icon={<Banknote size={14} />} />
                </div>
              </div>
              <NationalitySelect label="Nationality" value={form.nationality} onChange={val => update('nationality', val)} />
              <div>
                <label style={labelStyle}>Address</label>
                <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="Full address" icon={<MapPin size={14} />} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>City</label>
                  <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Kathmandu" icon={<MapPin size={14} />} />
                </div>
                <div>
                  <label style={labelStyle}>Country</label>
                  <Input value={form.country} onChange={e => update('country', e.target.value)} placeholder="Nepal" icon={<Globe size={14} />} />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Additional Details */}
          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Additional Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>Father Name</label>
                  <Input value={form.fatherName} onChange={e => update('fatherName', e.target.value)} placeholder="Father Name" icon={<Users size={14} />} />
                </div>
                <div>
                  <label style={labelStyle}>Occupation</label>
                  <Input value={form.occupation} onChange={e => update('occupation', e.target.value)} placeholder="Occupation" />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <div>
                  <label style={labelStyle}>Date of Birth</label>
                  <input type="date" value={form.dob} onChange={e => update('dob', e.target.value)} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none', color: 'var(--notion-text)' }} />
                </div>
                <div>
                  <label style={labelStyle}>Photo</label>
                  <input type="file" accept="image/*" style={{ width: '100%', fontSize: '13px', color: 'var(--notion-text)', padding: '6px 0' }} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Any special notes or preferences..." rows={3} style={{ width: '100%', padding: '8px', backgroundColor: 'var(--notion-bg)', border: '1px solid var(--notion-border)', borderRadius: 'var(--radius-md)', fontSize: '14px', outline: 'none', color: 'var(--notion-text)', resize: 'vertical' }} />
              </div>

              {/* Summary */}
              <div style={{ backgroundColor: 'var(--notion-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--notion-border)', padding: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--notion-text)', marginBottom: 'var(--space-2)' }}>Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', fontSize: '13px', color: 'var(--notion-text-secondary)' }}>
                  <div><strong style={{ color: 'var(--notion-text)' }}>Name:</strong> {form.firstName} {form.lastName}</div>
                  <div><strong style={{ color: 'var(--notion-text)' }}>Phone:</strong> {form.phone || '—'}</div>
                  <div><strong style={{ color: 'var(--notion-text)' }}>ID:</strong> {form.idType ? `${form.idType}: ${form.idNumber}` : '—'}</div>
                  <div><strong style={{ color: 'var(--notion-text)' }}>PAN:</strong> {form.panNumber || '—'}</div>
                  <div><strong style={{ color: 'var(--notion-text)' }}>VAT:</strong> {form.vatNumber || '—'}</div>
                  <div><strong style={{ color: 'var(--notion-text)' }}>Type:</strong> {form.customerType === 'RESTAURANT_CUSTOMER' ? 'Restaurant' : form.customerType === 'BOTH' ? 'Both' : 'Hotel Guest'}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-6)' }}>
          <Button variant="secondary" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>
            <ChevronLeft size={14} style={{ marginRight: '4px' }} /> Previous
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next <ChevronRight size={14} style={{ marginLeft: '4px' }} />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting || !canProceed()}>
              <Check size={14} style={{ marginRight: '4px' }} />
              {isSubmitting ? 'Creating...' : 'Create Customer'}
            </Button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
