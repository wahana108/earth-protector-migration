'use client';

import { useEffect, useState } from 'react';
import { Globe, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const PLATFORM_VERSION = '2.3';
const INSTANCES_URL =
  'https://raw.githubusercontent.com/wahana108/earth-nft-instances/main/instances.json';

interface Instance {
  name: string;
  url: string;
  version: string;
  admin: string;
  region: string;
  registered_at: string;
}

export default function InstancesPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    const currentOrigin = window.location.origin;
    setOrigin(currentOrigin);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    fetch(INSTANCES_URL, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('fetch failed');
        return res.json();
      })
      .then((data: Instance[]) => setInstances(data))
      .catch(() => {
        setInstances([
          {
            url: currentOrigin,
            name: 'Earth Sanctuary',
            version: '2.3',
            admin: 'wahana108',
            region: 'Bali, Indonesia',
            registered_at: '2026-06-01',
          },
        ]);
      })
      .finally(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Globe className="h-8 w-8" />
          Komunitas
        </h1>
        <p className="text-muted-foreground mt-1">
          Jaringan komunitas yang menggunakan platform TMEP
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instances.map((inst) => (
            <Card key={inst.url}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight">{inst.name}</CardTitle>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    {inst.url === origin && (
                      <Badge variant="default">Komunitas Induk</Badge>
                    )}
                    {inst.version === PLATFORM_VERSION && (
                      <Badge variant="secondary">✓ Verified</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div>
                  <span className="font-medium">Region:</span>{' '}
                  <span className="text-muted-foreground">{inst.region}</span>
                </div>
                <div>
                  <span className="font-medium">Admin:</span>{' '}
                  <span className="text-muted-foreground">{inst.admin}</span>
                </div>
                <div>
                  <span className="font-medium">Version:</span>{' '}
                  <span className="text-muted-foreground">{inst.version}</span>
                </div>
                <div>
                  <span className="font-medium">Bergabung:</span>{' '}
                  <span className="text-muted-foreground">
                    {new Date(inst.registered_at).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <a
                  href={inst.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline pt-1 break-all"
                >
                  {inst.url}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
