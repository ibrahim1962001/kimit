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



export const AdSpace: React.FC<AdSpaceProps> = ({
  type,
  className = '',
  minHeight,
  lazyLoad = false,
  rootMargin = '300px',
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(!lazyLoad);


  const defaultHeight = () => {
    switch (type) {
      case 'horizontal': return 100;
      case 'vertical':   return 400;
      case 'square':     return 280;
      default:           return 120;
    }
  };

  const height = minHeight ?? defaultHeight();

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


  // تأكدنا من إن الحاوية مش بتغطي على الكود و الإعلان واخد حريته
  return (
    <div
      ref={wrapperRef}
      className={`ad-space ${className}`}
      data-ad-type={type}
      style={{
        width: '100%',
        minHeight: height,
        position: 'relative',
        margin: '10px 0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50 // تأكيد عدم التغطية
      }}
    >
      {isVisible ? (
        <iframe
          src="/ad.html"
          style={{
            width: '100%',
            minHeight: `${height}px`,
            border: 'none',
            display: 'block',
            pointerEvents: 'auto',
          }}
          title="Advertisement"
          loading="lazy"
          scrolling="no"
        />
      ) : (
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
      )}
    </div>
  );
};
