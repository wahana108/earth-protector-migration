'use client';

import { useState, useEffect } from 'react';
import { fetchAllNfts, fetchUserById } from '@/lib/firestore';
import type { NFT, User } from '@/lib/types';

export function useNfts() {
  const [nfts, setNfts] = useState<NFT[]>([]);
  const [creatorsMap, setCreatorsMap] = useState<Record<string, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const allNfts = await fetchAllNfts();
        setNfts(allNfts);

        const uniqueIds = [...new Set(allNfts.map(n => n.createdBy))];
        const users = await Promise.all(uniqueIds.map(id => fetchUserById(id)));
        const map: Record<string, User> = {};
        uniqueIds.forEach((id, i) => {
          const u = users[i];
          if (u) map[id] = u;
        });
        setCreatorsMap(map);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { nfts, creatorsMap, loading, error };
}
