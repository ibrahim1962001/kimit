import type { AdProvider } from '../components/AdSpace';

/**
 * إعدادات الإعلانات - يمكن تعديلها بسهولة
 * Weight: نسبة الظهور (كلما زادت زادت فرصة الظهور)
 * Enabled: تفعيل/تعطيل الإعلان
 */
export const AD_PROVIDERS: AdProvider[] = [
  {
    id: 'native_banner',
    name: 'Native Banner',
    code: `<script async="async" data-cfasync="false" src="https://pl29177405.profitablecpmratenetwork.com/1a777b2003bc5c410fd28c0bb40954b1/invoke.js"></script>
<div id="container-1a777b2003bc5c410fd28c0bb40954b1"></div>`,
    weight: 70,
    enabled: true
  },
  {
    id: 'social_banner',
    name: 'Social Banner',
    code: `<script src="https://pl29177408.profitablecpmratenetwork.com/8f/52/4b/8f524b47fb209e3b639335c819fba560.js"></script>`,
    weight: 30,
    enabled: true
  }
];

/**
 * إعلانات احتياطية (fallback) في حالة فشل الإعلان الرئيسي
 */
export const FALLBACK_AD_PROVIDERS: AdProvider[] = [
  {
    id: 'google_adsense',
    name: 'Google AdSense',
    code: `<!-- Google AdSense placeholder -->
<div style="padding: 20px; text-align: center; color: #666;">
  <small>Advertisement</small>
</div>`,
    weight: 5,
    enabled: false // متوقف حالياً
  }
];

/**
 * الحصول على قائمة الإعلانات النشطة
 */
export const getActiveAdProviders = (): AdProvider[] => {
  return AD_PROVIDERS.filter(provider => provider.enabled);
};

/**
 * الحصول على إعلان محدد حسب المعرف
 */
export const getAdProviderById = (id: string): AdProvider | undefined => {
  return AD_PROVIDERS.find(provider => provider.id === id);
};

/**
 * تحديد ما إذا كان يجب عرض إعلان بناءً على نوع الشاشة
 * @param adType نوع الإعلان
 * @param breakpoint نقطة التحقق (شاشة)
 */
export const shouldShowAd = (adType: string, breakpoint: 'mobile' | 'tablet' | 'desktop'): boolean => {
  switch (adType) {
    case 'horizontal':
      // الإعلان الأفقي يظهر فقط على الشاشات الكبيرة
      return breakpoint === 'desktop';
    case 'vertical':
      // الإعلان العمودي يظهر على كل الشاشات
      return true;
    case 'square':
      // الإعلان المربع يظهر على كل الشاشات
      return true;
    case 'responsive':
      // الإعلان المتجاوب يظهر على كل الشاشات
      return true;
    default:
      return true;
  }
};

/**
 * الحصول على حجم الإعلان المناسب حسب نوع الشاشة
 */
export const getAdDimensions = (adType: string, breakpoint: string): { width: number; height: number } => {
  const isMobile = breakpoint === 'mobile';

  switch (adType) {
    case 'horizontal':
      // على الموبايل: إخفاء، ولكن نرجع أبعاد للاستخدام الداخلي
      return { width: 728, height: 90 };
    case 'vertical':
      return {
        width: isMobile ? 300 : 160,
        height: isMobile ? 250 : 600
      };
    case 'square':
    case 'responsive':
    default:
      return { width: 300, height: 250 };
  }
};

/**
 * توليد كود إعلان متجاوب (Responsive ad code)
 * يستخدم لتوليد إعلان يتكيف مع حجم الحاوية
 */
export const generateResponsiveAdCode = (publisherId: string, slotId: string): string => {
  return `
<div id="${slotId}" style="width:100%;height:auto;min-height:250px;"></div>
<script>
  (function() {
    var ad = document.createElement('script');
    ad.type = 'text/javascript';
    ad.async = true;
    ad.src = 'https://pl29177405.profitablecpmratenetwork.com/' + '${publisherId}' + '/invoke.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ad, s);
  })();
</script>`.trim();
};

/**
 * الحصول على قائمة الإعلانات المناسبة لنوع الشاشة
 */
export const getAdProvidersForBreakpoint = (
  adType: string,
  breakpoint: 'mobile' | 'tablet' | 'desktop'
): AdProvider[] => {
  if (!shouldShowAd(adType, breakpoint)) {
    return [];
  }
  return getActiveAdProviders();
};


