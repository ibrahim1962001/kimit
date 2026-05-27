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
  slotId?: string;
  minHeight?: number;
  lazyLoad?: boolean;
  rootMargin?: string;
}

export const AdSpace: React.FC<AdSpaceProps> = ({
  type,
  className = '',
  slotId = 'default',
  minHeight,
  lazyLoad = true,
  rootMargin = '200px',
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!lazyLoad);

  const defaultHeight = () => {
    switch (type) {
      case 'horizontal': return 90;
      case 'vertical': return 400;
      case 'square': return 280;
      default: return 120;
    }
  };

  const height = minHeight ?? defaultHeight();

  useEffect(() => {
    if (!lazyLoad || isVisible) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    if (wrapperRef.current) observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [lazyLoad, isVisible, rootMargin]);

  const showAd = isVisible;

  return (
    <div
      ref={wrapperRef}
      className={`ad-space ${className}`}
      data-ad-type={type}
      data-ad-slot={slotId}
      style={{
        width: '100%',
        minHeight: height,
        position: 'relative',
        margin: '10px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showAd && (
        <iframe
          src={`/ad.html?slot=${encodeURIComponent(slotId)}`}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-top-navigation-by-user-activation"
          style={{
            width: '100%',
            minHeight: `${height}px`,
            border: 'none',
            display: 'block',
          }}
          title="Advertisement"
          loading="lazy"
          scrolling="no"
        />
      )}
      {!isVisible && (
        <div className="ad-space-placeholder ad-space-placeholder--loading">
          Loading...
        </div>
      )}
    </div>
  );
};
