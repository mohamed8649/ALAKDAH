'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { IconButton } from '@/components/ui/icon-button';
import { useTranslations } from '@/i18n/provider';

export interface OptionDraft {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
}

const MAX_OPTIONS = 3;

/**
 * Product options.
 *
 * Capped at three options: beyond that the variant matrix becomes unmanageable
 * for the merchant long before it becomes a technical problem.
 *
 * Option values are entered as chips — type and press Enter — because a
 * comma-separated string is ambiguous the moment a value contains a comma.
 */
export function OptionEditor({
  value,
  onChange,
  disabled,
}: {
  value: OptionDraft[];
  onChange: (options: OptionDraft[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('products.options');

  const addOption = () => {
    if (value.length >= MAX_OPTIONS) return;
    onChange([...value, { id: `tmp_${Date.now()}`, name: '', values: [] }]);
  };

  const updateOption = (index: number, patch: Partial<OptionDraft>) => {
    onChange(value.map((option, position) => (position === index ? { ...option, ...patch } : option)));
  };

  const removeOption = (index: number) => {
    onChange(value.filter((_, position) => position !== index));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-subtle-foreground">{t('hint')}</p>

      {value.length === 0 ? (
        <p className="rounded-[var(--radius)] border border-dashed border-border px-3 py-4 text-center text-xs text-subtle-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="space-y-3">
          {value.map((option, index) => (
            <li key={option.id} className="rounded-[var(--radius)] border border-border p-3">
              <div className="flex items-end gap-2">
                <Field label={t('optionName')} className="flex-1">
                  <Input
                    value={option.name}
                    onChange={(event) => updateOption(index, { name: event.target.value })}
                    placeholder={t('optionNamePlaceholder')}
                    disabled={disabled}
                  />
                </Field>
                <IconButton
                  label={t('removeOption')}
                  icon={<Trash2 />}
                  variant="danger"
                  disabled={disabled}
                  onClick={() => removeOption(index)}
                />
              </div>

              <div className="mt-3">
                <ValueChips
                  values={option.values}
                  onChange={(values) => updateOption(index, { values })}
                  disabled={disabled}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {value.length < MAX_OPTIONS ? (
        <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={disabled}>
          <Plus aria-hidden />
          {t('addOption')}
        </Button>
      ) : null}
    </div>
  );
}

function ValueChips({
  values,
  onChange,
  disabled,
}: {
  values: Array<{ id: string; value: string }>;
  onChange: (values: Array<{ id: string; value: string }>) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('products.options');
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    // Duplicate values would produce two identically-titled variants.
    if (values.some((entry) => entry.value.toLowerCase() === trimmed.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, { id: `tmp_${Date.now()}_${values.length}`, value: trimmed }]);
    setDraft('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <Field label={t('optionValues')}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-border bg-[var(--input)] p-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-[var(--focus-ring)]">
        {values.map((entry, index) => (
          <span
            key={entry.id}
            className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-surface-3 px-2 py-1 text-xs text-foreground"
          >
            {entry.value}
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(values.filter((_, position) => position !== index))}
              aria-label={`${entry.value} — إزالة`}
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
          disabled={disabled}
          placeholder={values.length === 0 ? t('optionValuesPlaceholder') : ''}
          className="min-w-[8rem] flex-1 bg-transparent px-1 py-0.5 text-sm text-foreground placeholder:text-subtle-foreground focus:outline-none"
        />
      </div>
    </Field>
  );
}
