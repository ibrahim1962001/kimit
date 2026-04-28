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
  externalFilter?: string;
}

export const DataGrid: React.FC<DataGridProps> = ({ data, columns, externalFilter }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  React.useEffect(() => {
    if (externalFilter !== undefined) {
      setGlobalFilter(externalFilter);
    }
  }, [externalFilter]);

  const tableColumns = useMemo<ColumnDef<DataRow>[]>(() => 
    columns.map((col) => ({
      accessorKey: col,
      header: () => <span style={{ fontWeight: 'bold' }}>{col}</span>,
      size: 150, // Default width for all columns
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
        style={{ overflow: 'auto', flex: 1, position: 'relative', background: 'rgba(2, 6, 23, 0.5)' }}
      >
        <div style={{ width: 'fit-content', minWidth: '100%' }}>
          {/* Header */}
          <div style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card-bg)', borderBottom: '2px solid var(--border)', display: 'flex' }}>
            {table.getHeaderGroups().map(headerGroup => (
              <React.Fragment key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <div 
                    key={header.id} 
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ 
                      width: header.column.getSize(), 
                      minWidth: header.column.getSize(),
                      padding: '12px 16px', 
                      cursor: header.column.getCanSort() ? 'pointer' : 'default', 
                      fontSize: '13px', 
                      color: '#94a3b8', 
                      whiteSpace: 'nowrap',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() as string] ?? null}
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}>
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              return (
                <div 
                  key={row.id} 
                  style={{ 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    width: '100%', 
                    height: `${virtualRow.size}px`, 
                    transform: `translateY(${virtualRow.start}px)`,
                    borderBottom: '1px solid var(--border)',
                    background: virtualRow.index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                    display: 'flex'
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <div 
                      key={cell.id} 
                      style={{ 
                        width: cell.column.getSize(), 
                        minWidth: cell.column.getSize(),
                        padding: '0 16px', 
                        fontSize: '13px', 
                        color: '#cbd5e1', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        display: 'flex', 
                        alignItems: 'center' 
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
