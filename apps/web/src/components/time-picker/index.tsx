import type { LocalTime } from '@tasko/types';
import { useState } from 'react';
import { Button } from '../button';
import { Sheet } from '../sheet';
import styles from './styles.module.css';

export interface TimePickerProps {
  value: LocalTime | null;
  onChange: (v: LocalTime | null) => void;
  open: boolean;
  onClose: () => void;
  isMobile?: boolean;
  anchorEl?: HTMLElement | null;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

function parseTime(t: LocalTime | null): { h: string; m: string } {
  if (!t) return { h: '09', m: '00' };
  const [h, m] = t.split(':');
  return { h: h ?? '09', m: m ?? '00' };
}

function isValidTime(s: string): s is LocalTime {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function TimePicker({ value, onChange, open, onClose, isMobile = false }: TimePickerProps) {
  const { h, m } = parseTime(value);
  const [selectedHour, setSelectedHour] = useState(h);
  const [selectedMinute, setSelectedMinute] = useState(m);
  const [freeText, setFreeText] = useState('');
  const [freeTextError, setFreeTextError] = useState('');

  const commitTime = (hour: string, minute: string) => {
    const t = `${hour}:${minute}` as LocalTime;
    onChange(t);
  };

  const handleHourChange = (hour: string) => {
    setSelectedHour(hour);
    // round minute to nearest 15 if not already
    const nearestMinute = MINUTES.includes(selectedMinute) ? selectedMinute : '00';
    commitTime(hour, nearestMinute);
  };

  const handleMinuteChange = (minute: string) => {
    setSelectedMinute(minute);
    commitTime(selectedHour, minute);
  };

  const handleFreeTextBlur = () => {
    if (!freeText) {
      setFreeTextError('');
      return;
    }
    if (isValidTime(freeText)) {
      const [fh, fm] = freeText.split(':');
      if (fh && fm) {
        setSelectedHour(fh);
        setSelectedMinute(fm);
        onChange(freeText as LocalTime);
        setFreeText('');
        setFreeTextError('');
      }
    } else {
      setFreeTextError('Enter a valid time (HH:MM).');
    }
  };

  const content = (
    <div className={styles.wrapper}>
      <div className={styles.wheels}>
        <div className={styles.wheel}>
          <p className={styles.wheelLabel}>Hour</p>
          <div className={styles.wheelList} role="listbox" aria-label="Hour">
            {HOURS.map((hour) => (
              <button
                key={hour}
                type="button"
                role="option"
                aria-selected={hour === selectedHour}
                className={styles.wheelItem}
                data-selected={hour === selectedHour ? '' : undefined}
                onClick={() => handleHourChange(hour)}
              >
                {hour}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.wheelSep}>:</div>
        <div className={styles.wheel}>
          <p className={styles.wheelLabel}>Min</p>
          <div className={styles.wheelList} role="listbox" aria-label="Minute">
            {MINUTES.map((minute) => (
              <button
                key={minute}
                type="button"
                role="option"
                aria-selected={minute === selectedMinute}
                className={styles.wheelItem}
                data-selected={minute === selectedMinute ? '' : undefined}
                onClick={() => handleMinuteChange(minute)}
              >
                {minute}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.freeTextRow}>
        <input
          type="text"
          className={styles.freeText}
          placeholder="HH:MM"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onBlur={handleFreeTextBlur}
          aria-label="Enter time (HH:MM)"
        />
        {freeTextError && <p className={styles.error}>{freeTextError}</p>}
      </div>
      <div className={styles.actions}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          Remove time
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onClose={onClose} title="Pick a time">
        {content}
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <dialog open className={styles.popover} aria-label="Pick a time">
      {content}
    </dialog>
  );
}

export default TimePicker;
