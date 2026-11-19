import React, { useEffect, useMemo, useRef } from 'react';
import { Camera, Film, FolderOpen, Play, Trash2 } from 'lucide-react';
import { useResolvedMediaMap } from '../hooks/useResolvedMediaUrl';
import { formatBytes, type DraftLocalMedia } from '../types';

interface MediaCaptureSectionProps {
  items: DraftLocalMedia[];
  onAddFiles: (files: FileList) => void;
  onRemoveItem: (id: string) => void;
}

export const MediaCaptureSection: React.FC<MediaCaptureSectionProps> = ({
  items,
  onAddFiles,
  onRemoveItem,
}) => {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const existingAttachments = useMemo(
    () =>
      items
        .filter((item) => !item.file && item.existingAttachment)
        .map((item) => item.existingAttachment!),
    [items]
  );

  const resolvedExistingMap = useResolvedMediaMap(existingAttachments);

  const localFileUrls = useMemo(() => {
    const entries: Array<{ id: string; url: string }> = [];
    for (const item of items) {
      if (item.file) {
        entries.push({
          id: item.id,
          url: URL.createObjectURL(item.file),
        });
      }
    }
    return entries;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const entry of localFileUrls) {
        URL.revokeObjectURL(entry.url);
      }
    };
  }, [localFileUrls]);

  const urlMap = useMemo(() => {
    const map = new Map<string, string>();
    localFileUrls.forEach((p) => map.set(p.id, p.url));
    for (const item of items) {
      if (!item.file && item.existingAttachment) {
        const resolved = resolvedExistingMap[item.existingAttachment.id];
        if (resolved) {
          map.set(item.id, resolved);
        }
      }
    }
    return map;
  }, [localFileUrls, items, resolvedExistingMap]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddFiles(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
          Photos &amp; Videos (Saved Offline)
        </label>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
          {items.length} / 20 {items.length === 1 ? 'file' : 'files'}
        </span>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => photoInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition min-h-[68px]"
        >
          <Camera className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          <span className="whitespace-nowrap">Take Photo</span>
        </button>

        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition min-h-[68px]"
        >
          <Film className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          <span className="whitespace-nowrap">Record Video</span>
        </button>

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-[0.98] transition min-h-[68px]"
        >
          <FolderOpen className="h-5 w-5 text-blue-700 dark:text-blue-400" />
          <span className="whitespace-nowrap">Gallery</span>
        </button>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
          {items.map((item) => {
            const url = urlMap.get(item.id);
            return (
              <div
                key={item.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-4/3"
              >
                {item.type === 'image' && url ? (
                  <img
                    src={url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : url ? (
                  <div className="relative h-full w-full bg-slate-900">
                    <video
                      src={url}
                      className="h-full w-full object-cover opacity-85"
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/70 text-white">
                        <Play className="h-4 w-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2.5 py-1.5">
                  <p className="truncate text-[11px] font-medium text-white tabular-nums">
                    {item.type === 'video' ? 'Video' : 'Photo'} · {formatBytes(item.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="absolute top-1 right-1 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950/75 text-white hover:bg-red-600 transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
