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
    border: 1px solid var(--notion-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    background-color: var(--notion-bg);
    color: var(--notion-text);
    z-index: 100000;
    pointer-events: auto;
  }
  .react-datepicker__header {
    background-color: var(--notion-bg-secondary);
    border-bottom: 1px solid var(--notion-border);
    border-top-left-radius: var(--radius-md);
    border-top-right-radius: var(--radius-md);
  }
  .react-datepicker__current-month {
    color: var(--notion-text);
    font-weight: 600;
    font-size: 14px;
  }
  .react-datepicker__day-name {
    color: var(--notion-text-secondary);
    font-size: 12px;
    font-weight: 500;
  }
  .react-datepicker__day {
    color: var(--notion-text);
    border-radius: var(--radius-sm);
    font-size: 13px;
    transition: background-color 120ms ease;
  }
  .react-datepicker__day:hover {
    background-color: var(--notion-bg-hover);
    color: var(--notion-text);
  }
  .react-datepicker__day--selected,
  .react-datepicker__day--keyboard-selected {
    background-color: var(--notion-blue);
    color: #ffffff;
  }
  .react-datepicker__day--selected:hover,
  .react-datepicker__day--keyboard-selected:hover {
    background-color: var(--notion-blue);
    color: #ffffff;
  }
  .react-datepicker__day--today {
    font-weight: 700;
    color: var(--notion-blue);
  }
  .react-datepicker__day--today.react-datepicker__day--selected,
  .react-datepicker__day--today.react-datepicker__day--keyboard-selected {
    background-color: var(--notion-blue);
    color: #ffffff;
  }
  .react-datepicker__day--disabled {
    color: var(--notion-text-muted);
  }
  .react-datepicker__day--disabled:hover {
    background-color: transparent;
    cursor: not-allowed;
  }
  .react-datepicker__day--in-range,
  .react-datepicker__day--in-selecting-range {
    background-color: var(--notion-blue-bg);
    color: var(--notion-blue);
  }
  .react-datepicker__day--in-range:hover,
  .react-datepicker__day--in-selecting-range:hover {
    background-color: var(--notion-blue-bg);
  }
  .react-datepicker__day--range-start,
  .react-datepicker__day--range-end {
    background-color: var(--notion-blue);
    color: var(--accent-primary-foreground);
  }
  .react-datepicker__navigation {
    top: 8px;
  }
  .react-datepicker__navigation-icon::before {
    border-color: var(--notion-text-secondary);
  }
  .react-datepicker__navigation:hover .react-datepicker__navigation-icon::before {
    border-color: var(--notion-text);
  }
  /* Month / Year dropdowns */
  .react-datepicker__month-dropdown-container,
  .react-datepicker__year-dropdown-container {
    margin: 0 4px;
  }
  .react-datepicker__month-read-view,
  .react-datepicker__year-read-view {
    color: var(--notion-text);
    font-size: 13px;
    font-weight: 500;
    border-radius: var(--radius-sm);
    padding: 2px 6px;
  }
  .react-datepicker__month-dropdown,
  .react-datepicker__year-dropdown {
    background-color: var(--notion-bg);
    border: 1px solid var(--notion-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
  }
  .react-datepicker__month-option,
  .react-datepicker__year-option {
    color: var(--notion-text);
    font-size: 13px;
    padding: 4px 8px;
    transition: background-color 120ms ease;
  }
  .react-datepicker__month-option:hover,
  .react-datepicker__year-option:hover {
    background-color: var(--notion-bg-hover);
  }
  .react-datepicker__month-option--selected,
  .react-datepicker__year-option--selected {
    background-color: var(--notion-blue-bg);
    color: var(--notion-blue);
    font-weight: 600;
  }
  /* Time picker */
  .react-datepicker__time-container {
    border-left: 1px solid var(--notion-border);
    width: 90px;
  }
  .react-datepicker__time-container .react-datepicker__time {
    background-color: var(--notion-bg);
    border-bottom-right-radius: var(--radius-md);
  }
  .react-datepicker__time-container .react-datepicker__time-box {
    border-radius: 0;
  }
  .react-datepicker__time-list {
    scrollbar-width: thin;
    scrollbar-color: var(--notion-border) transparent;
  }
  .react-datepicker__time-list-item {
    color: var(--notion-text);
    font-size: 13px;
    padding: 6px 8px;
    transition: background-color 120ms ease;
  }
  .react-datepicker__time-list-item:hover {
    background-color: var(--notion-bg-hover);
  }
  .react-datepicker__time-list-item--selected {
    background-color: var(--notion-blue) !important;
    color: var(--accent-primary-foreground) !important;
    font-weight: 600;
  }
  .react-datepicker__time-list-item--disabled {
    color: var(--notion-text-muted);
  }
  /* Header time label */
  .react-datepicker-time__header {
    color: var(--notion-text);
    font-size: 13px;
    font-weight: 600;
    border-bottom: 1px solid var(--notion-border);
  }
  /* Triangle (when not using portal) */
  .react-datepicker__triangle {
    display: none;
  }
  /* Week numbers */
  .react-datepicker__week-number {
    color: var(--notion-text-muted);
    font-size: 12px;
  }
`;

interface CustomDatePickerProps {
    selected?: Date | null;
    onChange?: (date: Date | null) => void;
    label?: string;
    placeholder?: string;
    minDate?: Date;
    maxDate?: Date;
    error?: string;
    fullWidth?: boolean;
    required?: boolean;
    // Range support
    selectsRange?: boolean;
    startDate?: Date | null;
    endDate?: Date | null;
    // Time support
    showTimeSelect?: boolean;
    showTimeSelectOnly?: boolean;
    timeIntervals?: number;
    timeFormat?: string;
    dateFormat?: string;
}

const CustomDatePicker = forwardRef<any, CustomDatePickerProps>(
    ({ selected, onChange, label, placeholder, minDate, maxDate, error, fullWidth = true, required, selectsRange, startDate, endDate, showTimeSelect, showTimeSelectOnly, timeIntervals = 15, timeFormat = 'HH:mm', dateFormat: customDateFormat }, ref) => {
        const fmt = showTimeSelectOnly ? timeFormat : (customDateFormat || (showTimeSelect ? 'dd MMM yyyy, HH:mm' : 'dd MMM yyyy'));
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
                    border: '1px solid var(--notion-border)',
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
                        {...{
                            ref: ref as any,
                            selected,
                            onChange: selectsRange ? onChange as any : onChange,
                            startDate,
                            endDate,
                            selectsRange,
                            placeholderText: placeholder,
                            minDate,
                            maxDate,
                            dateFormat: fmt,
                            showTimeSelect,
                            showTimeSelectOnly,
                            timeIntervals,
                            timeFormat,
                            popperPlacement: 'top-start',
                            portalId: 'datepicker-portal',
                            popperProps: { strategy: 'fixed' },
                            customInput: (
                                <input
                                    readOnly
                                    value={selectsRange
                                        ? (startDate && endDate
                                            ? `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
                                            : startDate ? startDate.toLocaleDateString() : '')
                                        : (selected ? selected.toLocaleDateString() : '')}
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
                            )
                        } as any}
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
