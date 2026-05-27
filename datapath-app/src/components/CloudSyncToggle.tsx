import React, { useState } from 'react';
import { Cloud, CloudOff } from 'lucide-react';
import { isCloudSyncEnabled, setCloudSyncEnabled } from '../lib/cloudSyncPreference';
import { isArabic } from '../lib/i18n';

export const CloudSyncToggle: React.FC = () => {
  const isAr = isArabic();
  const [on, setOn] = useState(isCloudSyncEnabled);

  const toggle = () => {
    const next = !on;
    setCloudSyncEnabled(next);
    setOn(next);
  };

  return (
    <label className="cloud-sync-toggle">
      <input type="checkbox" checked={on} onChange={toggle} />
      <span className="cloud-sync-toggle-ui">
        {on ? <Cloud size={14} /> : <CloudOff size={14} />}
        <span>
          {on
            ? isAr
              ? 'نسخ سحابي اختياري: مفعّل'
              : 'Optional cloud backup: ON'
            : isAr
              ? 'نسخ سحابي اختياري: متوقف (محلي فقط)'
              : 'Optional cloud backup: OFF (local only)'}
        </span>
      </span>
    </label>
  );
};
