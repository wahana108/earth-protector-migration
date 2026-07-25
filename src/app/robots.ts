import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/admin',
        '/admin/',
        '/create',
        '/buyback',
        '/buyback-requests',
        '/purchase-confirmations',
        '/transactions',
        '/validate',
        '/validation',
        '/validated',
        '/parameters',
        '/top-developers',
        '/ai-review',
        '/infrastructure',
        '/profile',
        '/recommendations',
        '/explore',
        '/pool',
        '/projects',
        '/projects/',
        '/nft/',
        '/instances',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
