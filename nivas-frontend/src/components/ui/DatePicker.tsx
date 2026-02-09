'use client';

import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Calendar as CalendarIcon } from 'lucide-react';
import { forwardRef } from 'react';

// Custom CSS for DatePicker to match Notion styling
const datePickerStyles = `
  .react-datepicker-wrapper {
    width: 100%;
  }
  .react-datepicker__input-container {
    width: 100%;
  }
  .react-datepicker {
    font-family: inherit;
    border-color: var(--notion-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    background-color: var(--notion-bg);
    color: var(--notion-text);
  }
  .react-datepicker__header {
    background-color: var(--notion-bg-secondary);
    border-bottom: 1px solid var(--notion-border);
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
  }
  .react-datepicker__current-month, 
  .react-datepicker__day-name,
  .react-datepicker__day {
    color: var(--notion-text);
  }
  .react-datepicker__day:hover {
    background-color: var(--notion-bg-secondary);
  }
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background-color: var(--notion-blue);
    color: white;
  }
  .react-datepicker__day--selected:hover {
    background-color: var(--notion-blue);
  }
  .react-datepicker__navigation-icon::before {
    border-color: var(--notion-text-secondary);
  }
`;

interface CustomDatePickerProps {
    selected: Date | null;
    onChange: (date: Date | null) => void;
    label?: string;
    placeholder?: string;
    minDate?: Date;
    maxDate?: Date;
    error?: string;
    fullWidth?: boolean;
    required?: boolean;
}

const CustomDatePicker = forwardRef<any, CustomDatePickerProps>(
    ({ selected, onChange, label, placeholder, minDate, maxDate, error, fullWidth = true, required }, ref) => {
        return (
            <div style={{ width: fullWidth ? '100%' : 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <style>{datePickerStyles}</style>
                {label && (
                    <label style={{
                        fontSize: '12px',
                        color: 'var(--notion-text-secondary)',
                        marginBottom: '4px'
                    }}>
                        {label} {required && <span style={{ color: 'var(--notion-red)' }}>*</span>}
                    </label>
                )}

                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.1s ease',
                }}>
                    <span style={{
                        position: 'absolute',
                        left: '10px',
                        zIndex: 1,
                        color: 'var(--notion-text-muted)',
                        pointerEvents: 'none',
                        display: 'flex'
                    }}>
                        <CalendarIcon size={16} />
                    </span>

                    <DatePicker
                        selected={selected}
                        onChange={onChange}
                        placeholderText={placeholder}
                        minDate={minDate}
                        maxDate={maxDate}
                        dateFormat="dd MMM yyyy"
                        popperPlacement="top-start"
                        customInput={
                            <input
                                style={{
                                    width: '100%',
                                    backgroundColor: 'transparent',
                                    border: '1px solid transparent',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: '8px 12px 8px 36px',
                                    fontSize: '14px',
                                    color: 'var(--notion-text)',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            />
                        }
                    />
                </div>

                {error && (
                    <span style={{ fontSize: '12px', color: 'var(--notion-red)' }}>{error}</span>
                )}
            </div>
        );
    }
);

CustomDatePicker.displayName = "CustomDatePicker";

export default CustomDatePicker;
