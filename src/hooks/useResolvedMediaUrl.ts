import { useEffect, useState } from 'react';
import { getLocalMediaBlob } from '../db/offlineStore';
import type { MediaAttachment } from '../types';

export function useResolvedMediaMap(
  attachments: MediaAttachment[]
): Record<string, string> {
  const [resolvedMap, setResolvedMap] = useState<Record<string, string>>({});

  const attachmentKey = attachments.map((a) => `${a.id}:${a.url}`).join('|');

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    async function resolveAll() {
      if (attachments.length === 0) {
        setResolvedMap({});
        return;
      }

      const nextMap: Record<string, string> = {};

      await Promise.all(
        attachments.map(async (att) => {
          try {
            const localRec = await getLocalMediaBlob(att.id);
            if (localRec?.blob) {
              const objUrl = URL.createObjectURL(localRec.blob);
              objectUrls.push(objUrl);
              nextMap[att.id] = objUrl;
              return;
            }
          } catch {
            // Ignore IndexedDB lookup failure
          }

          if (!att.url.startsWith('local://')) {
            nextMap[att.id] = att.url;
          }
        })
      );

      if (!cancelled) {
        setResolvedMap(nextMap);
      } else {
        for (const u of objectUrls) {
          URL.revokeObjectURL(u);
        }
      }
    }

    resolveAll();

    return () => {
      cancelled = true;
      for (const u of objectUrls) {
        URL.revokeObjectURL(u);
      }
    };
  }, [attachmentKey]);

  return resolvedMap;
}
