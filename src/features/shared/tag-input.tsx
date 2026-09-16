'use client';

import { X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { cn } from '@/lib/cn';

/**
 * Chip-style tag entry.
 *
 * Enter or comma commits a tag; Backspace on an empty field removes the last
 * one. Duplicates are silently ignored rather than rejected with an error the
 * merchant has to dismiss.
 */
export function TagInput({
  value,
  onChange,
  placeholder,
  disabled,
  max = 30,
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  max?: number;
  className?: string;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim().replace(/,$/, '');
    if (!trimmed || value.length >= max) {
      setDraft('');
      return;
    }
    if (!value.some((tag) => tag.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-border bg-[var(--input)] p-1.5',
        'focus-within:border-primary focus-within:ring-1 focus-within:ring-[var(--focus-ring)]',
        disabled && 'opacity-60',
        className,
      )}
    >
      {value.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-surface-3 px-2 py-1 text-xs text-foreground"
        >
          {tag}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(value.filter((_, position) => position !== index))}
            aria-label={`${tag} — إزالة`}
            className="text-subtle-foreground transition-colors duration-fast hover:text-danger"
          >
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commit}
        disabled={disabled || value.length >= max}
        placeholder={value.length === 0 ? placeholder : ''}
        className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none"
      />
    </div>
  );
}
