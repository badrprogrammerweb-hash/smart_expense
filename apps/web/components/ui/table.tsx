import type { ReactNode } from "react";

export type TableColumn<T> = { key: string; header: ReactNode; cell: (record: T) => ReactNode; className?: string };

export function Table<T extends { id: string }>({ columns, data, caption }: { columns: TableColumn<T>[]; data: T[]; caption: string }) {
  return <div className="overflow-x-auto rounded-[var(--radius-card)] border"><table className="w-full text-start text-sm"><caption className="sr-only">{caption}</caption><thead className="bg-muted text-muted-foreground"><tr>{columns.map((column) => <th key={column.key} scope="col" className="px-3 py-3 text-start font-medium">{column.header}</th>)}</tr></thead><tbody>{data.map((record) => <tr key={record.id} className="border-t hover:bg-[var(--color-surface-hover)]">{columns.map((column) => <td key={column.key} className={column.className ?? "px-3 py-3"}>{column.cell(record)}</td>)}</tr>)}</tbody></table></div>;
}
