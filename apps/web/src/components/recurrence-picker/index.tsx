import type { AnchorMode, RecurrenceRule, Weekday } from '@tasko/types';
import { useId } from 'react';
import { describeRecurrence } from '../../lib/recurrence-description';
import { Dropdown } from '../dropdown';
import styles from './styles.module.css';

export interface RecurrencePickerProps {
  value: RecurrenceRule | null;
  onChange: (v: RecurrenceRule | null) => void;
}

type FrequencyOption = 'never' | 'daily' | 'every_n_days' | 'weekly' | 'monthly' | 'yearly';

const FREQUENCY_OPTIONS: { value: FrequencyOption; label: string }[] = [
  { value: 'never', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'every_n_days', label: 'Every N days' },
  { value: 'weekly', label: 'Weekly on…' },
  { value: 'monthly', label: 'Monthly on day N' },
  { value: 'yearly', label: 'Yearly' },
];

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 'sun', label: 'Sun' },
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
];

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function ruleToFreq(r: RecurrenceRule | null): FrequencyOption {
  if (!r) return 'never';
  return r.frequency;
}

function defaultRuleFor(freq: FrequencyOption, current: RecurrenceRule | null): RecurrenceRule | null {
  const anchor: AnchorMode = (current as { anchor_mode?: AnchorMode })?.anchor_mode ?? 'on_schedule';
  switch (freq) {
    case 'never':
      return null;
    case 'daily':
      return { frequency: 'daily', anchor_mode: anchor };
    case 'every_n_days':
      return { frequency: 'every_n_days', interval: 7, anchor_mode: anchor };
    case 'weekly':
      return { frequency: 'weekly', weekdays: ['mon'], anchor_mode: anchor };
    case 'monthly':
      return { frequency: 'monthly', day_of_month: 1, anchor_mode: anchor };
    case 'yearly':
      return { frequency: 'yearly', month: 1, day: 1, anchor_mode: anchor };
  }
}

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  const anchorSectionId = useId();
  const freq = ruleToFreq(value);
  const anchorMode: AnchorMode = (value as { anchor_mode?: AnchorMode } | null)?.anchor_mode ?? 'on_schedule';

  const setFreq = (newFreq: FrequencyOption) => {
    onChange(defaultRuleFor(newFreq, value));
  };

  const setAnchor = (mode: AnchorMode) => {
    if (!value) return;
    onChange({ ...value, anchor_mode: mode } as RecurrenceRule);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.frequencyRow}>
        <Dropdown options={FREQUENCY_OPTIONS} value={freq} onChange={setFreq} ariaLabel="Repeat" />
      </div>

      {/* Frequency-specific fields */}
      {freq === 'every_n_days' && value?.frequency === 'every_n_days' && (
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="recurrence-interval">
            Every
          </label>
          <input
            id="recurrence-interval"
            type="number"
            min={1}
            max={365}
            className={styles.numberInput}
            value={value.interval}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(n) && n >= 1 && n <= 365) {
                onChange({ ...value, interval: n });
              }
            }}
          />
          <span className={styles.fieldLabel}>days</span>
        </div>
      )}

      {freq === 'weekly' && value?.frequency === 'weekly' && (
        <fieldset className={styles.weekdayGroup}>
          <legend className={styles.weekdayLegend}>Weekdays</legend>
          {WEEKDAYS.map((day) => {
            const checked = value.weekdays.includes(day.value);
            return (
              <label key={day.value} className={styles.weekdayLabel}>
                <input
                  type="checkbox"
                  className={styles.weekdayCheckbox}
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...value.weekdays, day.value]
                      : value.weekdays.filter((d) => d !== day.value);
                    // Must have at least one weekday
                    if (next.length > 0) {
                      onChange({ ...value, weekdays: next });
                    }
                  }}
                />
                <span className={styles.weekdayName}>{day.label}</span>
              </label>
            );
          })}
        </fieldset>
      )}

      {freq === 'monthly' && value?.frequency === 'monthly' && (
        <div className={styles.fieldRow}>
          <label className={styles.fieldLabel} htmlFor="recurrence-day-of-month">
            Day of month
          </label>
          <input
            id="recurrence-day-of-month"
            type="number"
            min={1}
            max={31}
            className={styles.numberInput}
            value={value.day_of_month}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isNaN(n) && n >= 1 && n <= 31) {
                onChange({ ...value, day_of_month: n });
              }
            }}
          />
          <p className={styles.helper}>This recurrence will use the last day of the month when needed.</p>
        </div>
      )}

      {freq === 'yearly' && value?.frequency === 'yearly' && (
        <div className={styles.yearlyRow}>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="recurrence-month">
              Month
            </label>
            <select
              id="recurrence-month"
              className={styles.select}
              value={value.month}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                onChange({ ...value, month: n });
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.fieldRow}>
            <label className={styles.fieldLabel} htmlFor="recurrence-day">
              Day
            </label>
            <input
              id="recurrence-day"
              type="number"
              min={1}
              max={31}
              className={styles.numberInput}
              value={value.day}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(n) && n >= 1 && n <= 31) {
                  onChange({ ...value, day: n });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Anchor toggle — only when a recurrence is set */}
      {value !== null && (
        <div className={styles.anchorSection} id={anchorSectionId}>
          <p className={styles.anchorLabel}>Anchor next due date</p>
          <div className={styles.anchorOptions} role="radiogroup" aria-label="Anchor next due date">
            <label className={styles.anchorOption}>
              <input
                type="radio"
                name={`anchor-${anchorSectionId}`}
                value="on_schedule"
                checked={anchorMode === 'on_schedule'}
                onChange={() => setAnchor('on_schedule')}
                className={styles.radio}
              />
              <span>On schedule</span>
            </label>
            <label className={styles.anchorOption}>
              <input
                type="radio"
                name={`anchor-${anchorSectionId}`}
                value="after_completion"
                checked={anchorMode === 'after_completion'}
                onChange={() => setAnchor('after_completion')}
                className={styles.radio}
              />
              <span>After completion</span>
            </label>
          </div>
          <p className={styles.anchorHelper}>
            "On schedule" keeps the cadence even if you complete late. "After completion" restarts the clock
            when you finish.
          </p>
        </div>
      )}

      {/* Description preview — shown when any recurrence is configured */}
      {value !== null && (
        <p className={styles.descriptionPreview} aria-live="polite">
          {describeRecurrence(value)}
        </p>
      )}
    </div>
  );
}

export default RecurrencePicker;
