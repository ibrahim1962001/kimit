import React, { useRef, useState, useEffect } from 'react';

export interface AdProvider {
  id: string;
  name: string;
  code: string;
  weight: number;
  enabled: boolean;
}

interface AdSpaceProps {
  type: 'horizontal' | 'vertical' | 'square' | 'responsive';
  className?: string;
  providers?: AdProvider[];
  minHeight?: number;
  onLoad?: () => void;
  onError?: () => void;
  lazyLoad?: boolean;
  rootMargin?: string;
}

// بناء HTML كامل للـ iframe لكل بانر معزول
const buildAdIframeHtml = (adCode: string): string => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: transparent;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
  </style>
</head>
<body>
  ${adCode}
</body>
</html>`;

export const AdSpace: React.FC<AdSpaceProps> = ({
  type,
  className = '',
  providers = [],
  minHeight,
  lazyLoad = false,
  rootMargin = '300px',
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!lazyLoad);
  const [iframeHtml, setIframeHtml] = useState<string | null>(null);

  // Lazy load via IntersectionObserver
  useEffect(() => {
    if (!lazyLoad || isVisible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [lazyLoad, isVisible, rootMargin]);

  // اختيار provider وبناء محتوى الـ iframe
  useEffect(() => {
    if (!isVisible || iframeHtml) return;
    const enabled = providers.filter((p) => p.enabled);
    if (enabled.length === 0) return;

    // اختيار عشوائي بالوزن
    const totalWeight = enabled.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = enabled[0];
    for (const p of enabled) {
      if (rand < p.weight) { selected = p; break; }
      rand -= p.weight;
    }

    setIframeHtml(buildAdIframeHtml(selected.code));
  }, [isVisible, providers, iframeHtml]);

  const defaultHeight = () => {
    switch (type) {
      case 'horizontal': return 100;
      case 'vertical':   return 400;
      case 'square':     return 280;
      default:           return 120;
    }
  };

  const height = minHeight ?? defaultHeight();

  return (
    <div
      ref={wrapperRef}
      className={`ad-space ${className}`}
      data-ad-type={type}
      style={{
        width: '100%',
        minHeight: height,
        borderRadius: 14,
        overflow: 'hidden',
        position: 'relative',
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.05)',
        margin: '10px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {iframeHtml ? (
        <iframe
          srcDoc={iframeHtml}
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          style={{
            width: '100%',
            height: `${height}px`,
            border: 'none',
            display: 'block',
          }}
          title="Advertisement"
          loading="lazy"
        />
      ) : isVisible ? (
        /* spinner بينما يُحمَّل */
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 8,
          color: 'rgba(255,255,255,0.07)', fontSize: 10,
          letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          <div style={{
            width: 28, height: 28,
            border: '2px solid rgba(255,255,255,0.06)',
            borderTopColor: 'rgba(16,185,129,0.35)',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
          <span>Ad</span>
        </div>
      ) : null}
    </div>
  );
};
