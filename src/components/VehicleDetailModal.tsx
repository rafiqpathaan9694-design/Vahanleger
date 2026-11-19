import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Edit3,
  Phone,
  Play,
  Printer,
  Share2,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { deleteVehicleLocal } from '../services/localLedgerService';
import { useResolvedMediaMap } from '../hooks/useResolvedMediaUrl';
import {
  formatBytes,
  formatDisplayDateTime,
  type MediaAttachment,
  type VehicleRecord,
} from '../types';

interface VehicleDetailModalProps {
  record: VehicleRecord;
  onClose: () => void;
  onEdit: (record: VehicleRecord) => void;
  onDeleted: () => Promise<void>;
}

const SHARE_BAR_COLORS = [
  'bg-blue-700',
  'bg-slate-700 dark:bg-slate-500',
  'bg-emerald-600',
  'bg-amber-600',
  'bg-indigo-600',
  'bg-cyan-700',
  'bg-rose-600',
  'bg-teal-700',
  'bg-sky-700',
  'bg-slate-500',
];

export const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({
  record,
  onClose,
  onEdit,
  onDeleted,
}) => {
  const pushedDetailHistoryRef = useRef(false);
  const pushedMediaHistoryRef = useRef(false);
  const activeMediaRef = useRef<MediaAttachment | null>(null);

  const [activeMedia, setActiveMedia] = useState<MediaAttachment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resolvedMediaMap = useResolvedMediaMap(record.mediaAttachments);

  useEffect(() => {
    activeMediaRef.current = activeMedia;
  }, [activeMedia]);

  useEffect(() => {
    window.history.pushState({ vahanOverlay: 'detail' }, '');
    pushedDetailHistoryRef.current = true;

    const handlePop = () => {
      if (activeMediaRef.current) {
        pushedMediaHistoryRef.current = false;
        setActiveMedia(null);
      } else {
        pushedDetailHistoryRef.current = false;
        onClose();
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, [onClose]);

  const openMediaViewer = (item: MediaAttachment) => {
    window.history.pushState({ vahanOverlay: 'media' }, '');
    pushedMediaHistoryRef.current = true;
    setActiveMedia(item);
  };

  const closeMediaViewer = () => {
    if (pushedMediaHistoryRef.current) {
      pushedMediaHistoryRef.current = false;
      window.history.back();
    } else {
      setActiveMedia(null);
    }
  };

  const requestCloseDetail = () => {
    if (pushedDetailHistoryRef.current) {
      pushedDetailHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  const buildShareText = () => {
    const partnersText = record.partners
      .map((p, idx) => `  ${idx + 1}. ${p.name} — ${p.percentage}%`)
      .join('\n');
    return [
      `Vehicle Record: ${record.vehicleNumber}`,
      `Customer: ${record.customerName}${record.customerPhone ? ` (${record.customerPhone})` : ''}`,
      `Finance Bank: ${record.bankName}`,
      `Partners (${record.partnerCount}):`,
      partnersText,
      `Date & Time: ${formatDisplayDateTime(record.dateTime)}`,
      record.notes ? `Notes: ${record.notes}` : null,
      record.mediaAttachments.length > 0
        ? `Attachments: ${record.mediaAttachments.length} media file(s)`
        : null,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Vehicle ${record.vehicleNumber}`,
          text,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteVehicleLocal(record);
      await onDeleted();
      requestCloseDetail();
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : 'Failed to delete record.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={requestCloseDetail}
    >
      <div
        className="flex h-[100dvh] sm:h-auto sm:max-h-[94dvh] w-full sm:max-w-2xl flex-col rounded-none sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border-0 sm:border sm:border-slate-200 dark:sm:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile-style Top Header with Back Arrow */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={requestCloseDetail}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 no-print"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Vehicle Record
              </p>
              <h2 className="mt-0.5 font-mono text-xl sm:text-2xl font-bold tracking-wider text-slate-900 dark:text-slate-100 truncate">
                {record.vehicleNumber}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 no-print shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className="flex h-11 items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Share or copy summary"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              title="Print / Save PDF"
              aria-label="Print record"
            >
              <Printer className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={requestCloseDetail}
              className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
              aria-label="Close detail"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {deleteError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-xs font-medium text-red-800 dark:text-red-300">
              {deleteError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Customer Name
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-slate-100">
                {record.customerName}
              </p>
              {record.customerPhone && (
                <a
                  href={`tel:${record.customerPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline pt-0.5 font-mono"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>{record.customerPhone}</span>
                </a>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Finance Bank
              </p>
              <div className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <span>{record.bankName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums pt-0.5">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>{formatDisplayDateTime(record.dateTime)}</span>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Ownership Shareholding
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 tabular-nums">
                {record.partnerCount}{' '}
                {record.partnerCount === 1 ? 'Partner' : 'Partners'}
              </span>
            </div>

            <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              {record.partners.map((p, idx) => (
                <div
                  key={p.id}
                  style={{ width: `${p.percentage}%` }}
                  className={`${SHARE_BAR_COLORS[idx % SHARE_BAR_COLORS.length]} transition-all`}
                  title={`${p.name}: ${p.percentage}%`}
                />
              ))}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              {record.partners.map((partner, idx) => (
                <div
                  key={partner.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                        SHARE_BAR_COLORS[idx % SHARE_BAR_COLORS.length]
                      }`}
                    />
                    <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                      {partner.name}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums shrink-0">
                    {partner.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {record.notes && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Notes
              </h3>
              <p className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                {record.notes}
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Attached Photos &amp; Videos
              </h3>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                {record.mediaAttachments.length}{' '}
                {record.mediaAttachments.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            {record.mediaAttachments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                No photos or videos attached to this vehicle entry.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {record.mediaAttachments.map((item) => {
                  const mediaUrl = resolvedMediaMap[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openMediaViewer(item)}
                      className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-4/3 text-left focus:outline-none focus:ring-2 focus:ring-blue-700"
                    >
                      {!mediaUrl ? (
                        <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          Loading media...
                        </div>
                      ) : item.type === 'image' ? (
                        <img
                          src={mediaUrl}
                          alt={item.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="relative h-full w-full bg-slate-900">
                          <video
                            src={mediaUrl}
                            className="h-full w-full object-cover opacity-85"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950/75 text-white">
                              <Play className="h-5 w-5 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-2.5 py-1.5">
                        <p className="truncate text-[11px] font-medium text-white tabular-nums">
                          {item.type === 'video' ? 'Video' : 'Photo'} · {formatBytes(item.size)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 pb-safe shrink-0 no-print">
          {confirmDelete ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs font-semibold text-red-700 dark:text-red-400">
                Delete this record permanently?
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDeleteConfirm}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 min-h-[44px]"
                >
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/40 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 transition-colors min-h-[46px]"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => onEdit(record)}
                className="inline-flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-slate-900 dark:bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors min-h-[46px]"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Record</span>
              </button>
            </>
          )}
        </div>
      </div>

      {activeMedia && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-slate-950/95 p-4"
          onClick={closeMediaViewer}
        >
          <div className="flex items-center justify-between text-white pb-3 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={closeMediaViewer}
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 shrink-0"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className="text-sm font-medium truncate">
                {record.vehicleNumber} — {activeMedia.name}
              </span>
            </div>
            <button
              type="button"
              onClick={closeMediaViewer}
              className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 shrink-0"
              aria-label="Close media viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="flex-1 flex items-center justify-center overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {!resolvedMediaMap[activeMedia.id] ? (
              <p className="text-sm font-medium text-slate-300">
                Media is unavailable offline because it has not been cached yet.
              </p>
            ) : activeMedia.type === 'image' ? (
              <img
                src={resolvedMediaMap[activeMedia.id]}
                alt={activeMedia.name}
                className="max-h-full max-w-full rounded-xl object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <video
                src={resolvedMediaMap[activeMedia.id]}
                controls
                autoPlay
                playsInline
                className="max-h-full max-w-full rounded-xl"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
