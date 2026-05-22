import { FloatingPortal, autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/react';
import type { LocalDate } from '@tasko/types';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { useHotkeyStore } from '../../store/hotkey-registry';
import { Button } from '../button';
import { Sheet } from '../sheet';
import styles from './styles.module.css';
import { addDaysToLocalDate, dateToLocalDate, localDateToDate } from './utils';

export interface DatePickerProps {
  value: LocalDate | null;
  onChange: (v: LocalDate | null) => void;
  optional?: boolean;
  minDate?: LocalDate;
  triggerLabel?: string;
  weekStart: 'sun' | 'mon';
  open: boolean;
  onClose: () => void;
  anchorEl?: HTMLElement | null;
  isMobile?: boolean;
}

export function DatePicker({
  value,
  onChange,
  optional = false,
  minDate,
  weekStart,
  open,
  onClose,
  anchorEl,
  isMobile = false,
}: DatePickerProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // task-18: hotkey mode — push 'date-picker' while open, pop on close
  useEffect(() => {
    if (!open) return;
    useHotkeyStore.getState().push('date-picker');
    return () => {
      useHotkeyStore.getState().pop();
    };
  }, [open]);

  const { refs, floatingStyles } = useFloating({
    open,
    placement: 'bottom-start',
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    ...(anchorEl ? { elements: { reference: anchorEl } } : {}),
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDialogElement>) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (document.activeElement?.tagName === 'INPUT') return;

    const today = dateToLocalDate(new Date());
    if (e.key === 't') {
      onChange(today);
      onClose();
    } else if (e.key === 'm') {
      onChange(addDaysToLocalDate(today, 1));
      onClose();
    } else if (e.key === 'w') {
      onChange(addDaysToLocalDate(today, 7));
      onClose();
    } else if (e.key === 'n' && optional) {
      onChange(null);
      onClose();
    }
  };

  const todayDate = new Date();
  const selectedDate = value ? localDateToDate(value) : undefined;
  const disabledMatcher = minDate ? { before: localDateToDate(minDate) } : undefined;

  const quickSelect = (
    <div className={styles.quickSelect}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(dateToLocalDate(new Date()));
          onClose();
        }}
      >
        Today
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(addDaysToLocalDate(dateToLocalDate(new Date()), 1));
          onClose();
        }}
      >
        Tomorrow
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onChange(addDaysToLocalDate(dateToLocalDate(new Date()), 7));
          onClose();
        }}
      >
        Next week
      </Button>
      {optional && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          No date
        </Button>
      )}
    </div>
  );

  const footer =
    optional && value ? (
      <div className={styles.footer}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onChange(null);
            onClose();
          }}
        >
          Clear
        </Button>
      </div>
    ) : null;

  const calendar = (
    <dialog open className={styles.calendarWrapper} onKeyDown={handleKeyDown} aria-label="Pick a date">
      {quickSelect}
      <DayPicker
        mode="single"
        selected={selectedDate}
        onSelect={(day) => {
          if (day) {
            onChange(dateToLocalDate(day));
            onClose();
          }
        }}
        weekStartsOn={weekStart === 'sun' ? 0 : 1}
        today={todayDate}
        disabled={disabledMatcher}
        modifiers={{ today: todayDate }}
        modifiersClassNames={{ today: styles.today ?? '' }}
      />
      {footer}
    </dialog>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onClose={onClose} title="Pick a date">
        {calendar}
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <FloatingPortal>
      <div
        ref={(node) => {
          refs.setFloating(node);
          (popoverRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        style={{ ...floatingStyles, zIndex: 8000 }}
        className={styles.popover}
      >
        {calendar}
      </div>
    </FloatingPortal>
  );
}

export default DatePicker;
