import type { Tag, TagId } from '@tasko/types';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useTagAutocomplete } from '../../api/tags';
import { useHotkeyStore } from '../../store/hotkey-registry';
import styles from './styles.module.css';

export interface TagInputProps {
  value: TagId[];
  tagsById: Map<TagId, Tag>;
  onChange: (ids: TagId[]) => void;
  onCreateTag: (name: string) => Promise<Tag>;
  allTags?: Tag[];
  error?: string;
}

const MAX_TAG_LENGTH = 32;

export function TagInput({ value, tagsById, onChange, onCreateTag, allTags = [], error }: TagInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const wrapperId = useId();

  // Debounce query ~150ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 150);
    return () => clearTimeout(timer);
  }, [query]);

  const normalizedQuery = debouncedQuery.replace(/^#/, '').toLowerCase();
  const { data: autocompleteData } = useTagAutocomplete(normalizedQuery);

  const suggestions = autocompleteData?.tags ?? [];

  // Filter out already-selected tags
  const filteredSuggestions = suggestions.filter((t) => !value.includes(t.id as TagId));

  // Check if exact match exists (case-insensitive)
  const hasExactMatch = filteredSuggestions.some((t) => t.name.toLowerCase() === normalizedQuery);

  // Whether to show "Create '<x>'" row
  const showCreate = normalizedQuery.length > 0 && !hasExactMatch;

  // Combined options list: suggestions + optional "create" entry
  type TagOption = Tag & { isCreate: boolean };
  const allOptions: TagOption[] = showCreate
    ? [
        ...filteredSuggestions.map((t) => ({ ...(t as Tag), isCreate: false })),
        {
          id: '__create__' as TagId,
          name: normalizedQuery,
          isCreate: true,
          schema_version: 1 as const,
          name_lower: normalizedQuery,
          color: null,
          created_at: '',
          updated_at: '',
        },
      ]
    : (filteredSuggestions as Tag[]).map((t) => ({ ...t, isCreate: false }));

  const openDropdown = () => {
    setIsOpen(true);
    setActiveIndex(0);
  };

  const closeDropdown = () => {
    setIsOpen(false);
    setActiveIndex(0);
  };

  const addTag = (tag: Tag) => {
    if (!value.includes(tag.id as TagId)) {
      onChange([...value, tag.id as TagId]);
    }
    setQuery('');
    closeDropdown();
    inputRef.current?.focus();
  };

  const removeTag = (id: TagId) => {
    onChange(value.filter((v) => v !== id));
  };

  const commitOption = async (index: number) => {
    const opt = allOptions[index];
    if (!opt) return;

    if (opt.isCreate) {
      try {
        const newTag = await onCreateTag(normalizedQuery);
        addTag(newTag);
      } catch {
        // handled by onCreateTag's onError
      }
    } else {
      addTag(opt);
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && !e.shiftKey) {
      e.preventDefault();
      if (isOpen && allOptions.length > 0) {
        await commitOption(activeIndex);
      } else if (normalizedQuery.length > 0) {
        try {
          const newTag = await onCreateTag(normalizedQuery);
          addTag(newTag);
        } catch {
          // error handled by mutation
        }
      }
    } else if (e.key === 'Backspace' && query === '') {
      const last = value[value.length - 1];
      if (last) removeTag(last);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, allOptions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.length > MAX_TAG_LENGTH + 1) return; // +1 for '#' prefix
    setQuery(v);
    if (v) openDropdown();
    else closeDropdown();
  };

  const tagLengthError =
    query.replace(/^#/, '').length > MAX_TAG_LENGTH ? 'Tag names are limited to 32 characters.' : undefined;

  function renderOptions(opt: TagOption, idx: number) {
    const isCreate = (opt as { isCreate?: boolean }).isCreate;
    return (
      <button
        key={opt.id}
        type="button"
        id={`${listboxId}-opt-${idx}`}
        role="option"
        aria-selected={idx === activeIndex}
        className={styles.option}
        data-active={idx === activeIndex ? '' : undefined}
        tabIndex={-1}
        onMouseDown={(e) => {
          e.preventDefault();
          void commitOption(idx);
        }}
        onMouseEnter={() => setActiveIndex(idx)}
      >
        {isCreate ? (
          <span>
            Create <strong>'{opt.name}'</strong>
          </span>
        ) : (
          <span>#{opt.name}</span>
        )}
      </button>
    );
  }

  function renderSuggestions() {
    return (
      <div
        id={listboxId}
        role="listbox"
        aria-label="Tag suggestions"
        className={styles.listbox}
        tabIndex={-1}
      >
        {allOptions.map((opt, idx) => renderOptions(opt, idx))}
      </div>
    );
  }

  return (
    <fieldset className={styles.container} data-error={error ? '' : undefined} id={wrapperId}>
      <legend className={styles.legend}>Tags</legend>
      <div className={styles.chipRow}>
        {value.map((id) => {
          const tag = tagsById.get(id) ?? allTags.find((t) => t.id === id);
          const name = tag?.name ?? id;
          return (
            <span key={id} className={styles.chip}>
              #{name}
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={`Remove tag ${name}`}
                onClick={() => removeTag(id)}
              >
                <X size={10} aria-hidden="true" />
              </button>
            </span>
          );
        })}

        <div className={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listboxId : undefined}
            aria-activedescendant={
              isOpen && allOptions[activeIndex] ? `${listboxId}-opt-${activeIndex}` : undefined
            }
            aria-autocomplete="list"
            aria-label="Add tag"
            className={styles.input}
            placeholder="Add tag…"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query) openDropdown();
              // task-18: hotkey mode — override 'input' with 'tag-input'
              useHotkeyStore.getState().push('tag-input');
            }}
            onBlur={() => {
              // Delay to allow click on option
              setTimeout(() => closeDropdown(), 150);
              // task-18: hotkey mode — pop 'tag-input'
              useHotkeyStore.getState().pop();
            }}
          />

          {isOpen && allOptions.length > 0 && renderSuggestions()}
        </div>
      </div>

      {(error || tagLengthError) && <p className={styles.error}>{tagLengthError ?? error}</p>}
    </fieldset>
  );
}

export default TagInput;
