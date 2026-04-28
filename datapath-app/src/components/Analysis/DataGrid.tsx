"use no memo";
import React, { useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DataRow } from '../../types/index';

interface DataGridProps {
  data: DataRow[];
  columns: string[];
}

export const DataGrid: React.FC<DataGridProps> = ({ data, columns }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const tableColumns = useMemo<ColumnDef<DataRow>[]>(() => 
    columns.map((col) => ({
      accessorKey: col,
      header: () => <span style={{ fontWeight: 'bold' }}>{col}</span>,
      cell: info => {
        const val = info.getValue();
        return typeof val === 'number' ? Number(val.toFixed(4)) : String(val ?? '');
      }
    })),
  [columns]);


  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  if (!data || data.length === 0) {
    return <div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>No data available</div>;
  }

  return (
    <div className="grid-module" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
      <div className="grid-toolbar" style={{ padding: '10px', background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <input 
          type="text" 
          value={globalFilter ?? ''} 
          onChange={e => setGlobalFilter(e.target.value)} 
          placeholder="Search all columns..."
          style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-color)', color: '#fff', width: '300px' }}
        />
        <span style={{ color: '#888', fontSize: '13px', display: 'flex', alignItems: 'center' }}>
          {rows.length} records found
        </span>
      </div>
      
      <div 
        ref={tableContainerRef} 
        style={{ overflow: 'auto', flex: 1, position: 'relative' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--card-bg)' }}>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th 
                    key={header.id} 
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ padding: '12px 16px', borderBottom: '2px solid var(--border)', cursor: header.column.getCanSort() ? 'pointer' : 'default', fontSize: '13px', color: '#94a3b8', whiteSpace: 'nowrap' }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() as string] ?? null}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index];
              return (
                <tr 
                  key={row.id} 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: `${virtualRow.size}px`, 
                    transform: `translateY(${virtualRow.start}px)`,
                    borderBottom: '1px solid var(--border)',
                    background: virtualRow.index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{ padding: '0 16px', fontSize: '13px', color: '#cbd5e1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', height: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </div>
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
};
