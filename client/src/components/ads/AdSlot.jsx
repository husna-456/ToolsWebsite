import { useEffect, useRef } from 'react';
import usePublicSettings from '@/hooks/usePublicSettings';

export default function AdSlot({ slot }) {
  const settings = usePublicSettings();
  const ref = useRef(null);

  const ads = settings?.ads;
  const slotConfig = ads?.slots?.[slot];

  const isVisible = ads?.enabled && slotConfig?.enabled && slotConfig?.code?.trim();

  // Re-execute any <script> tags in the injected ad code
  useEffect(() => {
    if (!isVisible || !ref.current) return;
    ref.current.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      [...old.attributes].forEach(a => s.setAttribute(a.name, a.value));
      s.textContent = old.textContent;
      old.replaceWith(s);
    });
  }, [isVisible, slotConfig?.code]);

  if (!isVisible) return null;

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden"
      data-ad-slot={slot}
      dangerouslySetInnerHTML={{ __html: slotConfig.code }}
    />
  );
}
