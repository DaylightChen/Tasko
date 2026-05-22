import type { LocalDate, LocalTime } from '@tasko/types';
import { CalendarDays, Clock } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '../button';
import { DatePicker } from '../date-picker';
import { formatLocalDate } from '../date-picker/utils';
import { TimePicker } from '../time-picker';
import styles from './styles.module.css';

export interface DateTimeCombinedProps {
  date: LocalDate | null;
  time: LocalTime | null;
  onDateChange: (v: LocalDate | null) => void;
  onTimeChange: (v: LocalTime | null) => void;
  optional?: boolean;
  minDate?: LocalDate;
  weekStart: 'sun' | 'mon';
  dateError?: string | undefined;
  isMobile?: boolean;
  dateRef?: React.RefObject<HTMLButtonElement | null>;
  'data-testid'?: string;
}

export function DateTimeCombined({
  date,
  time,
  onDateChange,
  onTimeChange,
  optional = false,
  minDate,
  weekStart,
  dateError,
  isMobile = false,
  dateRef,
  'data-testid': testId,
}: DateTimeCombinedProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const buttonRef = dateRef ?? triggerRef;

  const dateLabel = date ? formatLocalDate(date) : '— none';
  const timeLabel = time ?? null;

  return (
    <div className={styles.wrapper} data-testid={testId}>
      <div className={styles.row}>
        {/* Date trigger */}
        <div className={styles.dateWrapper}>
          <button
            ref={buttonRef}
            type="button"
            className={styles.dateBtn}
            data-error={dateError ? '' : undefined}
            onClick={() => setDatePickerOpen((o) => !o)}
            aria-label={date ? `Due date: ${dateLabel}` : 'Pick a due date'}
            aria-expanded={datePickerOpen}
            aria-haspopup="dialog"
            aria-required={optional === false ? 'true' : undefined}
            aria-invalid={dateError ? 'true' : undefined}
          >
            <CalendarDays size={16} aria-hidden="true" className={styles.icon} />
            <span>{dateLabel}</span>
          </button>

          <DatePicker
            value={date}
            onChange={onDateChange}
            optional={optional}
            {...(minDate !== undefined && { minDate })}
            weekStart={weekStart}
            open={datePickerOpen}
            onClose={() => setDatePickerOpen(false)}
            anchorEl={buttonRef.current}
            isMobile={isMobile}
          />
        </div>

        {/* Time section */}
        <div className={styles.timeWrapper}>
          {time === null ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onTimeChange('09:00');
                setTimePickerOpen(true);
              }}
              className={styles.addTimeBtn}
            >
              <Clock size={14} aria-hidden="true" />
              Add time
            </Button>
          ) : (
            <button
              type="button"
              className={styles.timeBtn}
              onClick={() => setTimePickerOpen((o) => !o)}
              aria-label={`Time: ${time}`}
            >
              <Clock size={14} aria-hidden="true" className={styles.icon} />
              {timeLabel}
            </button>
          )}

          {timePickerOpen && (
            <div className={styles.timePickerAnchor}>
              <TimePicker
                value={time}
                onChange={(v) => {
                  onTimeChange(v);
                  if (v === null) setTimePickerOpen(false);
                }}
                open={timePickerOpen}
                onClose={() => setTimePickerOpen(false)}
                isMobile={isMobile}
              />
            </div>
          )}
        </div>

        {/* All-day toggle */}
        {time !== null && (
          <label className={styles.allDayToggle}>
            <input
              type="checkbox"
              className={styles.toggleInput}
              checked={time === null}
              onChange={(e) => {
                if (e.target.checked) {
                  onTimeChange(null);
                  setTimePickerOpen(false);
                }
              }}
              aria-label="All-day"
            />
            <span className={styles.toggleLabel}>All-day</span>
          </label>
        )}
      </div>

      {dateError && (
        <p className={styles.error} role="alert">
          {dateError}
        </p>
      )}
    </div>
  );
}

export default DateTimeCombined;
