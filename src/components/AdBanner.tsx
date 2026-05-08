"use client";

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

const AdBanner = () => {
  const pathname = usePathname();
  const adRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    // Only proceed if ad-related environment variables are present.
    if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT || !process.env.NEXT_PUBLIC_ADSENSE_AD_UNIT) {
        return;
    }
      
    try {
        if (typeof window !== 'undefined' && (window as any).adsbygoogle) {
            ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, [pathname]);


  if (!process.env.NEXT_PUBLIC_ADSENSE_CLIENT || !process.env.NEXT_PUBLIC_ADSENSE_AD_UNIT) {
    return null;
  }

  return (
    <div
      ref={adRef}
      key={pathname} 
      className="my-4" 
      style={{ minHeight: '100px', width: '100%', textAlign: 'center' }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
        data-ad-slot={process.env.NEXT_PUBLIC_ADSENSE_AD_UNIT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
};

export default AdBanner;
