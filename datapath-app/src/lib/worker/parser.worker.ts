import Papa from 'papaparse';

self.onmessage = async (e: MessageEvent) => {
  const { file, config } = e.data;

  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    worker: false, // We are already in a worker
    ...config,
    complete: (results) => {
      self.postMessage({
        type: 'SUCCESS',
        data: results.data,
        meta: results.meta,
        errors: results.errors
      });
    },
    error: (error) => {
      self.postMessage({
        type: 'ERROR',
        error: error.message
      });
    }
  });
};
