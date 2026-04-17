import React, { useEffect, useRef, useState } from 'react';

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
  providers = [],
  minHeight,
  onLoad,
  onError,
  lazyLoad = false,
  rootMargin = '200px'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazyLoad);

  useEffect(() => {
    if (!lazyLoad || isLoaded) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      { rootMargin }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazyLoad, isLoaded, rootMargin]);

  useEffect(() => {
    if (!isVisible || !containerRef.current || providers.length === 0 || isLoaded) return;

    const enabledProviders = providers.filter(p => p.enabled);
    if (enabledProviders.length === 0) return;

    // Weighted random selection
    const totalWeight = enabledProviders.reduce((acc, p) => acc + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedProvider = enabledProviders[0];

    for (const p of enabledProviders) {
      if (random < p.weight) {
        selectedProvider = p;
        break;
      }
      random -= p.weight;
    }

    // Render ad and execute scripts if present
    try {
      containerRef.current.innerHTML = selectedProvider.code;
      const scripts = containerRef.current.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        // Copy all attributes from the original script tag.
        for (let i = 0; i < oldScript.attributes.length; i += 1) {
          const attr = oldScript.attributes[i];
          newScript.setAttribute(attr.name, attr.value);
        }
        if (oldScript.textContent) {
          newScript.text = oldScript.textContent;
        }
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
      setIsLoaded(true);
      onLoad?.();
    } catch (error) {
      console.error('AdSpace: Failed to load ad', error);
      setHasError(true);
      onError?.();
    }
  }, [providers, type, minHeight, onLoad, onError, isVisible, isLoaded]);

  const getDefaultHeight = (adType: string): number => {
    switch (adType) {
      case 'horizontal': return 90;
      case 'vertical': return 400;
      case 'square': return 250;
      case 'responsive': return 250;
      default: return 250;
    }
  };

  const placeholderStyle: React.CSSProperties = {
    color: 'rgba(255,255,255,0.08)',
    fontSize: '11px',
    textAlign: 'center',
    padding: '20px'
  };

  const getAdTypeDisplay = (): string => {
    switch (type) {
      case 'horizontal': return '728x90';
      case 'vertical': return '160x600';
      case 'square': return '250x250';
      default: return 'Responsive';
    }
  };

  return (
    <div
      className={`ad-space ${className}`}
      data-ad-type={type}
      data-loaded={isLoaded}
      style={{
        width: '100%',
        minHeight: minHeight || getDefaultHeight(type),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        overflow: 'hidden',
        position: 'relative',
        margin: '10px 0'
      }}
    >
      {!isLoaded && !hasError && (
        <div style={{
          ...placeholderStyle,
          width: '100%',
          height: '100%',
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '2px solid rgba(255,255,255,0.1)',
            borderTopColor: 'rgba(16,185,129,0.5)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span style={{ letterSpacing: '1px', textTransform: 'uppercase', fontSize: '10px' }}>
            Loading {getAdTypeDisplay()} ad...
          </span>
        </div>
      )}
      {hasError && (
        <div style={placeholderStyle}>
          <span>Ad unavailable</span>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          display: isLoaded ? 'flex' : 'none',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};
