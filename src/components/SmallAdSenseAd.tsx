// src/components/SmallAdSenseAd.tsx
import React, { useEffect } from 'react';

// Extend Window interface to include adsbygoogle
declare global {
  interface Window {
    adsbygoogle: unknown[]; // Use unknown[] for flexibility, as it's an array for push
  }
}

interface SmallAdSenseProps {
  adSlot: string; // The data-ad-slot ID for your ad unit
  adClient: string; // Your data-ad-client (publisher ID)
}

const SmallAdSenseAd: React.FC<SmallAdSenseProps> = ({ adSlot, adClient }) => {
  useEffect(() => {
    // Only push if the script has loaded and initialized adsbygoogle
    if (window.adsbygoogle && typeof window.adsbygoogle.push === 'function') {
      try {
        // The common way to push an ad request
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        console.error("Error pushing AdSense ad for slot:", adSlot, e);
      }
    } else {
      console.warn("AdSense script not yet loaded or adsbygoogle not available. Ensure main AdSense script is in index.html. Slot:", adSlot);
    }
  }, [adSlot, adClient]); // Re-run effect if adSlot or adClient changes (though they're constants here)

  return (
    <div className="flex justify-center my-4"> {/* Center the ad and add vertical margin */}
      <ins
        className="adsbygoogle"
         style={{ display: 'block', width: '100%', height: 'auto', minHeight: '50px' }}
        data-ad-client={adClient}
        data-ad-slot={adSlot}
        data-ad-format="auto" // For flexible sizing. Consider "rectangle" or specific sizes if you want more control.
        data-full-width-responsive="false" // Keep this if your sidebar has a fixed width
      ></ins>
    </div>
  );
};

export default SmallAdSenseAd;