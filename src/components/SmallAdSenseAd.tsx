// src/components/SmallAdSenseAd.tsx

import React, { useEffect } from 'react';



// Extend Window interface to include adsbygoogle

declare global {

  interface Window {

    adsbygoogle: unknown[];

  }

}



interface SmallAdSenseProps {

  adSlot: string;

  adClient: string;

}



const SmallAdSenseAd: React.FC<SmallAdSenseProps> = ({ adSlot, adClient }) => {

  useEffect(() => {

    try {

      if (window.adsbygoogle && typeof window.adsbygoogle.push === 'function') {

        (window.adsbygoogle = window.adsbygoogle || []).push({});

      } else {

        console.warn("AdSense script not yet loaded or adsbygoogle not available for slot:", adSlot);

      }

    } catch (e) {

      console.error("Error pushing AdSense ad for slot:", adSlot, e);

    }

  }, [adSlot, adClient]);



  return (

    <div className="flex justify-center my-4"> {/* Center the ad and add vertical margin */}

      <ins

        className="adsbygoogle"

        style={{ display: 'block', width: '100%', height: 'auto', minHeight: '50px' }} // Adjust styling

        data-ad-client={adClient}

        data-ad-slot={adSlot}

        data-ad-format="auto" // Consider a "Native Ad" or "In-feed" format for less intrusive

        data-full-width-responsive="false" // Likely false for a fixed sidebar width

      ></ins>

    </div>

  );

};



export default SmallAdSenseAd; 