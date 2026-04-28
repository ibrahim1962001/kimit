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
import { SmartProfiler } from './SmartProfiler';
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
      header: () => (
        <div style={{ textAlign: 'left', width: '100%' }}>
          <div style={{ fontWeight: 'bold', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</div>
          <SmartProfiler columnName={col} data={data} />
        </div>
      ),
      size: 180, // Optimized width for profiler visibility
      cell: info => {
        const val = info.getValue();
        return typeof val === 'number' ? Number(val.toFixed(4)) : String(val ?? '');
      }
    })),
  [columns, data]);

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
    estimateSize: () => 52, // Slightly taller for better readability
    overscan: 10,
  });

  if (!data || data.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
        No data available for display.
      </div>
    );
  }

  return (
    <div className="grid-module" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: '#020617' }}>
      <div className="grid-toolbar" style={{ padding: '12px 16px', background: 'rgba(15, 23, 42, 0.8)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <input 
          type="text" 
          value={globalFilter ?? ''} 
          onChange={e => setGlobalFilter(e.target.value)} 
          placeholder="Search all columns..."
          style={{ padding: '8px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: '#0f172a', color: '#f1f5f9', width: '280px', fontSize: '13px' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>
            <b style={{ color: 'var(--primary)' }}>{rows.length}</b> records found
          </span>
        </div>
      </div>
      
      <div 
        ref={tableContainerRef} 
        style={{ overflow: 'auto', flex: 1, position: 'relative' }}
      >
        <div style={{ width: 'fit-content', minWidth: '100%' }}>
          {/* Header */}
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#0f172a', borderBottom: '2px solid #1e293b', display: 'flex' }}>
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
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{ asc: ' 🔼', desc: ' 🔽' }[header.column.getIsSorted() as string] ?? null}
                    </div>
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
                    borderBottom: '1px solid #1e293b',
                    background: virtualRow.index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    display: 'flex',
                    transition: 'background 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = virtualRow.index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
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
