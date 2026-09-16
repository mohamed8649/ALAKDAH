'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { Checkbox } from '@/components/ui/misc';
import { TableSkeleton } from '@/components/ui/states';

/**
 * DataTable.
 *
 * A table on a 390px screen is not a table. Every instance supplies a `mobile`
 * renderer; below `md` the rows render as cards and the <table> is not mounted
 * at all, so a phone never carries a horizontally-scrolling grid it cannot use.
 *
 * Capabilities are opt-in. Selection, row actions and sticky columns are only
 * present when a caller asks for them.
 */

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Right-aligned numeric cells get tabular figures and LTR digits. */
  numeric?: boolean;
  width?: string;
  className?: string;
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: ReadonlyArray<Column<T>>;
  rowKey: (row: T) => string;
  /** Card layout used below the md breakpoint. */
  mobile: (row: T) => ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  selection?: {
    selectedIds: ReadonlySet<string>;
    onToggle: (id: string) => void;
    onToggleAll: (checked: boolean) => void;
    selectAllLabel: string;
  };
  rowClassName?: (row: T) => string | undefined;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  mobile,
  loading,
  empty,
  onRowClick,
  selection,
  rowClassName,
  className,
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton rows={6} columns={columns.length} />;
  }

  if (rows.length === 0) {
    return <>{empty}</>;
  }

  const allSelected =
    selection !== undefined && rows.length > 0 && rows.every((row) => selection.selectedIds.has(rowKey(row)));
  const someSelected =
    selection !== undefined && !allSelected && rows.some((row) => selection.selectedIds.has(rowKey(row)));

  return (
    <div className={className}>
      {/* Mobile: card list. */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const id = rowKey(row);
          return (
            <li key={id} className={cn('relative', rowClassName?.(row))}>
              {selection ? (
                <div className="absolute inset-inline-start-0 start-3 top-3.5 z-10">
                  <Checkbox
                    checked={selection.selectedIds.has(id)}
                    onCheckedChange={() => selection.onToggle(id)}
                    aria-label={`تحديد ${id}`}
                  />
                </div>
              ) : null}
              <div className={cn(selection && 'ps-9')}>{mobile(row)}</div>
            </li>
          );
        })}
      </ul>

      {/* Desktop: real table. */}
      <div className="scrollbar-thin hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-border">
              {selection ? (
                <th scope="col" className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={(checked) => selection.onToggleAll(checked === true)}
                    aria-label={selection.selectAllLabel}
                  />
                </th>
              ) : null}
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={column.width ? { width: column.width } : undefined}
                  className={cn(
                    'px-3 py-2.5 text-start text-2xs font-medium uppercase tracking-wide text-subtle-foreground',
                    column.numeric && 'text-end',
                    column.headerClassName,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const id = rowKey(row);
              const selected = selection?.selectedIds.has(id) ?? false;

              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    'transition-colors duration-fast',
                    onRowClick && 'cursor-pointer',
                    selected ? 'bg-[var(--primary-soft)]' : 'hover:bg-surface-2',
                    rowClassName?.(row),
                  )}
                >
                  {selection ? (
                    <td className="px-3 py-2.5" onClick={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={selected}
                        onCheckedChange={() => selection.onToggle(id)}
                        aria-label={`تحديد ${id}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3 py-2.5 align-middle text-foreground',
                        column.numeric && 'numeric-cell tabular-nums',
                        column.className,
                      )}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
