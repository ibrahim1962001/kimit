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

// مُعرّف فريد لكل نسخة من المكوّن لتفادي تعارض id الـ div الإعلاني
let instanceCounter = 0;

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
  // instanceId يضمن div id فريد حتى لو نفس الكود الإعلاني
  const instanceId = useRef<number>(++instanceCounter).current;

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
    if (enabledProviders.length === 0) {
      console.warn('AdSpace: No enabled providers available', providers);
      setHasError(true);
      onError?.();
      return;
    }

    // اختيار Provider عشوائي بالوزن
    const totalWeight = enabledProviders.reduce((acc, p) => acc + p.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedProvider = enabledProviders[0];
    for (const p of enabledProviders) {
      if (random < p.weight) { selectedProvider = p; break; }
      random -= p.weight;
    }

    // استبدال id الحاوية لتفادي التعارض بين نسخ متعددة على نفس الصفحة
    const uniqueId = `adsterra-container-${instanceId}`;
    const adCode = selectedProvider.code.replace(
      /id="container-[^"]+"/g,
      `id="${uniqueId}"`
    );

    try {
      containerRef.current.innerHTML = adCode;
      // إعادة تشغيل الـ scripts يدوياً لأن innerHTML لا يُنفّذها
      const scripts = Array.from(containerRef.current.querySelectorAll('script'));
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        for (let i = 0; i < oldScript.attributes.length; i++) {
          const attr = oldScript.attributes[i];
          newScript.setAttribute(attr.name, attr.value);
        }
        if (oldScript.textContent) newScript.text = oldScript.textContent;
        oldScript.parentNode?.replaceChild(newScript, oldScript);
      });
      setIsLoaded(true);
      onLoad?.();
    } catch (error) {
      console.error('AdSpace: Failed to render ad', error);
      setHasError(true);
      onError?.();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, providers, isLoaded]);

  const getDefaultHeight = (adType: string): number => {
    switch (adType) {
      case 'horizontal': return 100;
      case 'vertical':   return 400;
      case 'square':     return 280;
      case 'responsive': return 280;
      default:           return 280;
    }
  };

  return (
    <div
      className={`ad-space ${className}`}
      data-ad-type={type}
      data-loaded={isLoaded}
      style={{
        width: '100%',
        minHeight: minHeight ?? getDefaultHeight(type),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.018)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '14px',
        overflow: 'hidden',
        position: 'relative',
        margin: '10px 0',
      }}
    >
      {/* Loading shimmer */}
      {!isLoaded && !hasError && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 10,
          color: 'rgba(255,255,255,0.07)', fontSize: 10,
          letterSpacing: '1px', textTransform: 'uppercase',
        }}>
          <div style={{
            width: 34, height: 34,
            border: '2px solid rgba(255,255,255,0.08)',
            borderTopColor: 'rgba(16,185,129,0.4)',
            borderRadius: '50%', animation: 'spin 1s linear infinite',
          }} />
          <span>Advertisement</span>
        </div>
      )}

      {/* Error placeholder */}
      {hasError && (
        <div style={{
          color: 'rgba(255,255,255,0.06)', fontSize: 11,
          textAlign: 'center', padding: 20,
        }}>
          <span>Ad unavailable</span>
        </div>
      )}

      {/* Ad content */}
      <div
        ref={containerRef}
        style={{
          display: isLoaded ? 'block' : 'none',
          width: '100%',
          minHeight: 'inherit',
        }}
      />
    </div>
  );
};
