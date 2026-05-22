import { Eye, Pencil } from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { renderMarkdown } from '../../lib/markdown';
import {
  continueListItem,
  insertAtCursor,
  insertLinkPrompt,
  unindentLine,
  wrapSelection,
} from '../../lib/textarea-ops';
import styles from './styles.module.css';

export interface TextareaMarkdownProps {
  value: string;
  onChange: (next: string) => void;
  label?: string;
  'aria-label'?: string;
  placeholder?: string;
  autoFocus?: boolean;
  minHeight?: number;
  maxHeight?: number;
}

type Mode = 'edit' | 'preview';

export function TextareaMarkdown({
  value,
  onChange,
  label,
  'aria-label': ariaLabel,
  placeholder,
  autoFocus = false,
  minHeight,
  maxHeight = 320,
}: TextareaMarkdownProps) {
  const [mode, setMode] = useState<Mode>(() => (value.trim() === '' ? 'edit' : 'preview'));
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Track whether this is the first render so we can honour autoFocus only on mount
  const didMountRef = useRef(false);

  const effectiveLabel = ariaLabel ?? label;

  // Auto-grow helper
  const adjustHeight = useCallback(
    (ta: HTMLTextAreaElement) => {
      ta.style.height = 'auto';
      const clamped = Math.min(ta.scrollHeight, maxHeight);
      ta.style.height = `${clamped}px`;
    },
    [maxHeight],
  );

  // When entering edit mode, focus the textarea and adjust its height.
  // On first mount + edit mode, only focus if autoFocus is true.
  useEffect(() => {
    if (mode !== 'edit' || !taRef.current) return;
    const ta = taRef.current;
    if (!didMountRef.current) {
      // First render
      didMountRef.current = true;
      if (autoFocus) {
        ta.focus();
      }
    } else {
      // Mode switched to edit after mount → always focus
      ta.focus();
    }
    adjustHeight(ta);
  }, [mode, autoFocus, adjustHeight]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.key === 'b') {
      e.preventDefault();
      wrapSelection(ta, '**', '**');
      onChange(ta.value);
      return;
    }

    if (isMod && e.key === 'i') {
      e.preventDefault();
      wrapSelection(ta, '*', '*');
      onChange(ta.value);
      return;
    }

    if (isMod && e.key === 'k') {
      e.preventDefault();
      const changed = insertLinkPrompt(ta);
      if (changed) onChange(ta.value);
      return;
    }

    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      insertAtCursor(ta, '  ');
      onChange(ta.value);
      return;
    }

    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      unindentLine(ta);
      onChange(ta.value);
      return;
    }

    if (e.key === 'Enter') {
      const continued = continueListItem(ta);
      if (continued) {
        e.preventDefault();
        onChange(ta.value);
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    onChange(ta.value);
    adjustHeight(ta);
  };

  const handleBlur = () => {
    if (value.trim() !== '') {
      setMode('preview');
    }
  };

  const handlePreviewClick = () => {
    setMode('edit');
  };

  const toggleMode = () => {
    setMode((prev) => (prev === 'edit' ? 'preview' : 'edit'));
  };

  const textareaStyle: React.CSSProperties = {};
  if (minHeight !== undefined) textareaStyle.minHeight = `${minHeight}px`;
  if (maxHeight !== undefined) textareaStyle.maxHeight = `${maxHeight}px`;

  const previewStyle: React.CSSProperties = {};
  if (minHeight !== undefined) previewStyle.minHeight = `${minHeight}px`;
  if (maxHeight !== undefined) previewStyle.maxHeight = `${maxHeight}px`;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <button
          type="button"
          role="switch"
          aria-checked={mode === 'preview'}
          aria-label="Toggle Edit / Preview"
          className={styles.toggleBtn}
          onClick={toggleMode}
        >
          {mode === 'preview' ? (
            <Pencil size={14} aria-hidden="true" />
          ) : (
            <Eye size={14} aria-hidden="true" />
          )}
        </button>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={taRef}
          className={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onBlur={handleBlur}
          placeholder={placeholder}
          aria-label={effectiveLabel}
          aria-multiline="true"
          style={Object.keys(textareaStyle).length > 0 ? textareaStyle : undefined}
          maxLength={50_000}
        />
      ) : (
        // biome-ignore lint/a11y/useKeyWithClickEvents: preview area is click-to-edit; keyboard users use the toggle button above
        <div
          className={styles.preview}
          // biome-ignore lint/security/noDangerouslySetInnerHtml: output is sanitized by DOMPurify in renderMarkdown
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
          onClick={handlePreviewClick}
          role="region"
          aria-label={effectiveLabel ? `${effectiveLabel} preview` : 'Notes preview'}
          style={Object.keys(previewStyle).length > 0 ? previewStyle : undefined}
        />
      )}
    </div>
  );
}

export default TextareaMarkdown;
