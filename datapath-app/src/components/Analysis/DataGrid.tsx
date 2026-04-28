"use client";
import React, { useMemo, useRef, useState, useEffect } from 'react';
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

// Static model generators to satisfy React Compiler stability requirements
const coreRowModel = getCoreRowModel();
const sortedRowModel = getSortedRowModel();
const filteredRowModel = getFilteredRowModel();

export const DataGrid: React.FC<DataGridProps> = ({ data, columns, externalFilter }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth < 768);
    checkSize();
    window.addEventListener('resize', checkSize);
    return () => window.removeEventListener('resize', checkSize);
  }, []);

  useEffect(() => {
    if (externalFilter !== undefined) {
      setGlobalFilter(externalFilter);
    }
  }, [externalFilter]);

  const tableColumns = useMemo<ColumnDef<DataRow>[]>(() => 
    columns.map((col, index) => ({
      accessorKey: col,
      header: () => (
        <div style={{ textAlign: 'left', width: '100%' }}>
          <div style={{ fontWeight: 'bold', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col}</div>
          <SmartProfiler columnName={col} data={data} />
        </div>
      ),
      size: index === 0 ? (isMobile ? 120 : 180) : 180,
      cell: info => {
        const val = info.getValue();
        return typeof val === 'number' ? Number(val.toFixed(4)) : String(val ?? '');
      }
    })),
  [columns, data, isMobile]);

  // TanStack Table setup with optimized stability for React Compiler
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
    getFilteredRowModel: filteredRowModel,
  });

  const { rows } = table.getRowModel();
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
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
    <div className="grid-module" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="grid-toolbar" style={{ padding: isMobile ? '10px' : '15px 20px', gap: isMobile ? '10px' : '20px' }}>
        <input 
          type="text" 
          value={globalFilter ?? ''} 
          onChange={e => setGlobalFilter(e.target.value)} 
          placeholder="Search columns..."
          className="grid-search"
          style={{ flex: 1, minWidth: 0 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#94a3b8', fontSize: isMobile ? '10px' : '12px', fontWeight: 500 }}>
            <b style={{ color: 'var(--primary)' }}>{rows.length}</b> records
          </span>
        </div>
      </div>
      
      <div 
        ref={tableContainerRef} 
        style={{ 
          overflow: 'auto', 
          flex: 1, 
          position: 'relative',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div style={{ width: 'fit-content', minWidth: '100%' }}>
          {/* Header */}
          <div style={{ position: 'sticky', top: 0, zIndex: 20, background: '#0a0f1d', borderBottom: '2px solid #1e293b', display: 'flex' }}>
            {table.getHeaderGroups().map(headerGroup => (
              <React.Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header, idx) => (
                  <div 
                    key={header.id} 
                    onClick={header.column.getToggleSortingHandler()}
                    className="grid-header-cell"
                    style={{ 
                      width: header.column.getSize(), 
                      minWidth: header.column.getSize(),
                      cursor: header.column.getCanSort() ? 'pointer' : 'default', 
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      flexDirection: 'column',
                      position: idx === 0 ? 'sticky' : 'relative',
                      left: idx === 0 ? 0 : 'auto',
                      zIndex: idx === 0 ? 30 : 1,
                      background: '#0a0f1d',
                      boxShadow: idx === 0 ? '4px 0 8px rgba(0,0,0,0.3)' : 'none'
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
                    background: virtualRow.index % 2 === 0 ? '#050810' : '#0a0f1d',
                    display: 'flex',
                    transition: 'background 0.2s ease'
                  }}
                  className="grid-row-container"
                >
                  {row.getVisibleCells().map((cell, idx) => (
                    <div 
                      key={cell.id} 
                      className="grid-cell"
                      style={{ 
                        width: cell.column.getSize(), 
                        minWidth: cell.column.getSize(),
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        display: 'flex', 
                        alignItems: 'center',
                        position: idx === 0 ? 'sticky' : 'relative',
                        left: idx === 0 ? 0 : 'auto',
                        zIndex: idx === 0 ? 15 : 1,
                        background: 'inherit',
                        boxShadow: idx === 0 ? '4px 0 8px rgba(0,0,0,0.3)' : 'none'
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
