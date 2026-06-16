import { useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AdSlot from '@/components/ads/AdSlot';
import { Outlet } from 'react-router-dom';
import usePublicSettings from '@/hooks/usePublicSettings';

export default function MainLayout() {
  const settings = usePublicSettings();

  const siteName    = settings?.general?.siteName        || 'InnovateTools';
  const description = settings?.general?.siteDescription || '';
  const keywords    = settings?.general?.keywords        || '';

  useEffect(() => {
    const css = settings?.general?.customCss;
    let tag = document.getElementById('admin-custom-css');
    if (css) {
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'admin-custom-css';
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    } else if (tag) {
      tag.remove();
    }
  }, [settings?.general?.customCss]);

  useEffect(() => {
    const general = settings?.general;
    if (!general) return;

    // Custom <head> tags
    let headTag = document.getElementById('admin-head-tags');
    if (general.customHeaderTags) {
      if (!headTag) {
        headTag = document.createElement('div');
        headTag.id = 'admin-head-tags';
        document.head.appendChild(headTag);
      }
      headTag.innerHTML = general.customHeaderTags;
    } else if (headTag) {
      headTag.remove();
    }

    // Custom <body> tags
    let bodyTag = document.getElementById('admin-body-tags');
    if (general.customBodyTags) {
      if (!bodyTag) {
        bodyTag = document.createElement('div');
        bodyTag.id = 'admin-body-tags';
        document.body.appendChild(bodyTag);
      }
      bodyTag.innerHTML = general.customBodyTags;
    } else if (bodyTag) {
      bodyTag.remove();
    }

    // Google Analytics (injected once — GA does not support re-initialization)
    if (general.googleAnalyticsId && !document.getElementById('admin-ga-script')) {
      const script = document.createElement('script');
      script.id = 'admin-ga-script';
      script.src = `https://www.googletagmanager.com/gtag/js?id=${general.googleAnalyticsId}`;
      script.async = true;
      document.head.appendChild(script);
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', general.googleAnalyticsId);
    }
  }, [settings?.general?.customHeaderTags, settings?.general?.customBodyTags, settings?.general?.googleAnalyticsId]);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>{siteName}</title>
        {description && <meta name="description" content={description} />}
        {keywords    && <meta name="keywords"    content={keywords} />}
      </Helmet>
      <AdSlot slot="headerBanner" />
      <Navbar />
      <div className="flex-1">
        <Outlet />
      </div>
      <AdSlot slot="footerBanner" />
      <Footer />
    </div>
  );
}
