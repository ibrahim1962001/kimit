const STORAGE_KEY = 'kimit_cloud_sync';

/** Opt-in cloud backup for signed-in users. Default: off (local-first). */
export function isCloudSyncEnabled(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) === 'on';
}

export function setCloudSyncEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
}

export function toggleCloudSync(): boolean {
  const next = !isCloudSyncEnabled();
  setCloudSyncEnabled(next);
  return next;
}
