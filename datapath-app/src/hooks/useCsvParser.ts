import { useState, useCallback, useRef, useEffect } from 'react';
import type { ParseResult } from '../types/index';

export function useCsvParser() {
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Web Worker
    workerRef.current = new Worker(new URL('../lib/worker/parser.worker.ts', import.meta.url), {
      type: 'module'
    });

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const parseFile = useCallback((file: File, config: Record<string, unknown> = {}): Promise<ParseResult> => {
    return new Promise((resolve, reject) => {
      if (!workerRef.current) {
        reject(new Error("Worker not initialized"));
        return;
      }

      setIsParsing(true);
      setError(null);

      const handleMessage = (e: MessageEvent) => {
        setIsParsing(false);
        workerRef.current?.removeEventListener('message', handleMessage);
        
        if (e.data.type === 'SUCCESS') {
          resolve({
            data: e.data.data,
            columns: e.data.meta.fields,
            errors: e.data.errors,
            meta: e.data.meta
          });
        } else {
          setError(e.data.error);
          reject(new Error(e.data.error));
        }
      };

      workerRef.current.addEventListener('message', handleMessage);
      workerRef.current.postMessage({ file, config });
    });
  }, []);

  return { parseFile, isParsing, error };
}
