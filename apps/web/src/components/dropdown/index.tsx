import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useListNavigation,
  useTypeahead,
} from '@floating-ui/react';
import { Check, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import styles from './styles.module.css';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface DropdownProps<T extends string> {
  options: Array<DropdownOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  placeholder?: string;
  placement?: 'bottom-start' | 'top-start' | 'bottom-end' | 'top-end';
}

export function Dropdown<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder = 'Select…',
  placement = 'bottom-start',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const listRef = useRef<Array<HTMLElement | null>>([]);
  const listContentRef = useRef<Array<string>>(options.map((o) => o.label));

  const triggerId = useId();
  const listboxId = useId();

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(4), flip(), shift({ padding: 8 })],
  });

  const click = useClick(context);
  const dismiss = useDismiss(context);
  const listNav = useListNavigation(context, {
    listRef,
    activeIndex,
    onNavigate: setActiveIndex,
    loop: true,
  });
  const typeahead = useTypeahead(context, {
    listRef: listContentRef,
    activeIndex,
    onMatch: setActiveIndex,
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([
    click,
    dismiss,
    listNav,
    typeahead,
  ]);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption?.label ?? placeholder;

  return (
    <div className={styles.wrapper}>
      <button
        id={triggerId}
        ref={refs.setReference}
        role="combobox"
        type="button"
        className={styles.trigger}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        {...getReferenceProps()}
      >
        {selectedOption?.icon && (
          <selectedOption.icon size={16} aria-hidden="true" className={styles.triggerIcon} />
        )}
        <span className={styles.triggerLabel}>{displayLabel}</span>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={styles.chevron}
          data-open={isOpen ? '' : undefined}
        />
      </button>

      {isOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            className={styles.menu}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {options.map((option, index) => (
              <div
                key={option.value}
                ref={(node) => {
                  listRef.current[index] = node;
                }}
                role="option"
                aria-selected={option.value === value}
                aria-disabled={option.disabled ? 'true' : undefined}
                tabIndex={activeIndex === index ? 0 : -1}
                className={styles.option}
                data-active={activeIndex === index ? '' : undefined}
                data-selected={option.value === value ? '' : undefined}
                data-disabled={option.disabled ? '' : undefined}
                {...getItemProps({
                  onClick: () => {
                    if (!option.disabled) {
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  },
                  onKeyDown: (e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && !option.disabled) {
                      e.preventDefault();
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  },
                })}
              >
                {option.icon && <option.icon size={16} aria-hidden="true" className={styles.optionIcon} />}
                <span className={styles.optionLabel}>{option.label}</span>
                {option.value === value && (
                  <Check size={14} aria-hidden="true" className={styles.checkIcon} />
                )}
              </div>
            ))}
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}

export default Dropdown;
