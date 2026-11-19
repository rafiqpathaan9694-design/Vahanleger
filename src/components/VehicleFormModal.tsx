import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Minus,
  Plus,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { saveVehicleLocal } from '../services/localLedgerService';
import {
  BANKS_LIST,
  getCurrentLocalDateTime,
  type DraftLocalMedia,
  type MediaAttachment,
  type PartnerShare,
  type VehicleRecord,
} from '../types';
import { MediaCaptureSection } from './MediaCaptureSection';

interface VehicleFormModalProps {
  editingRecord: VehicleRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function splitEqually(count: number): number[] {
  const base = Math.floor((100 / count) * 100) / 100;
  const result = Array.from({ length: count }, () => base);
  const sumExceptFirst = base * (count - 1);
  result[0] = Math.round((100 - sumExceptFirst) * 100) / 100;
  return result;
}

export const VehicleFormModal: React.FC<VehicleFormModalProps> = ({
  editingRecord,
  onClose,
  onSaved,
}) => {
  const pushedHistoryRef = useRef(false);

  useEffect(() => {
    if (window.history.state?.vahanOverlay === 'detail') {
      window.history.replaceState({ vahanOverlay: 'form' }, '');
    } else {
      window.history.pushState({ vahanOverlay: 'form' }, '');
    }
    pushedHistoryRef.current = true;

    const handlePop = () => {
      pushedHistoryRef.current = false;
      onClose();
    };
    window.addEventListener('popstate', handlePop);
    return () => {
      window.removeEventListener('popstate', handlePop);
    };
  }, [onClose]);

  const requestClose = () => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  };

  const [vehicleNumber, setVehicleNumber] = useState(
    editingRecord?.vehicleNumber ?? ''
  );
  const [customerName, setCustomerName] = useState(
    editingRecord?.customerName ?? ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    editingRecord?.customerPhone ?? ''
  );

  const initialBankIsPreset = editingRecord
    ? (BANKS_LIST as readonly string[]).includes(editingRecord.bankName)
    : true;
  const [selectedBankOption, setSelectedBankOption] = useState<string>(
    editingRecord
      ? initialBankIsPreset
        ? editingRecord.bankName
        : 'OTHER'
      : BANKS_LIST[0]
  );
  const [customBankName, setCustomBankName] = useState(
    editingRecord && !initialBankIsPreset ? editingRecord.bankName : ''
  );

  const [partnerCount, setPartnerCount] = useState<number>(
    editingRecord?.partnerCount ?? 1
  );
  const [partners, setPartners] = useState<PartnerShare[]>(() => {
    if (editingRecord && editingRecord.partners.length > 0) {
      return editingRecord.partners;
    }
    return [{ id: crypto.randomUUID(), name: '', percentage: 100 }];
  });

  const [dateTime, setDateTime] = useState<string>(
    editingRecord?.dateTime ?? getCurrentLocalDateTime()
  );
  const [notes, setNotes] = useState(editingRecord?.notes ?? '');

  const [mediaItems, setMediaItems] = useState<DraftLocalMedia[]>(() =>
    (editingRecord?.mediaAttachments ?? []).map((att) => ({
      id: att.id,
      type: att.type,
      name: att.name,
      mimeType: att.mimeType,
      size: att.size,
      existingAttachment: att,
    }))
  );
  const [removedAttachments, setRemovedAttachments] = useState<MediaAttachment[]>([]);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePartnerCountChange = (nextCount: number) => {
    const clamped = Math.max(1, Math.min(10, nextCount));
    setPartnerCount(clamped);

    setPartners((prev) => {
      const equalShares = splitEqually(clamped);
      const next: PartnerShare[] = [];
      for (let i = 0; i < clamped; i++) {
        if (prev[i]) {
          next.push({ ...prev[i], percentage: equalShares[i] });
        } else {
          next.push({
            id: crypto.randomUUID(),
            name: i === 0 && customerName.trim() ? customerName.trim() : '',
            percentage: equalShares[i],
          });
        }
      }
      return next;
    });
  };

  const handleEqualSplit = () => {
    const shares = splitEqually(partnerCount);
    setPartners((prev) =>
      prev.map((p, idx) => ({ ...p, percentage: shares[idx] ?? 0 }))
    );
  };

  const updatePartner = (
    id: string,
    field: 'name' | 'percentage',
    value: string
  ) => {
    setPartners((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        if (field === 'name') return { ...p, name: value };
        const num = parseFloat(value);
        return {
          ...p,
          percentage: Number.isNaN(num) ? 0 : Math.max(0, Math.min(100, num)),
        };
      })
    );
  };

  const totalPercentage = useMemo(() => {
    const sum = partners.reduce(
      (acc, p) => acc + (Number(p.percentage) || 0),
      0
    );
    return Math.round(sum * 100) / 100;
  }, [partners]);

  const handleAddFiles = (files: FileList) => {
    setErrorMsg(null);
    const added: DraftLocalMedia[] = [];
    const remainingSlots = Math.max(0, 20 - mediaItems.length);

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      if (!isVideo && !isImage) continue;
      if (file.size > 50 * 1024 * 1024) {
        setErrorMsg(`File "${file.name}" exceeds the 50 MB per-file limit.`);
        continue;
      }
      added.push({
        id: crypto.randomUUID(),
        type: isVideo ? 'video' : 'image',
        name: file.name || `${isVideo ? 'video' : 'photo'}-${Date.now()}`,
        mimeType: file.type,
        size: file.size,
        file,
      });
    }
    if (added.length > 0) {
      setMediaItems((prev) => [...prev, ...added]);
    }
  };

  const handleRemoveMedia = (id: string) => {
    setMediaItems((prev) => {
      const target = prev.find((m) => m.id === id);
      if (target?.existingAttachment) {
        setRemovedAttachments((r) => [...r, target.existingAttachment!]);
      }
      return prev.filter((m) => m.id !== id);
    });
  };

  const datePart = dateTime.split('T')[0] || '';
  const timePart = dateTime.split('T')[1]?.slice(0, 5) || '12:00';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanVehicle = vehicleNumber.trim().toUpperCase();
    const cleanCustomer = customerName.trim();
    const finalBank =
      selectedBankOption === 'OTHER'
        ? customBankName.trim()
        : selectedBankOption;

    if (cleanVehicle.length < 2) {
      setErrorMsg('Please enter a valid Vehicle Number.');
      return;
    }
    if (!cleanCustomer) {
      setErrorMsg('Please enter the Customer Name.');
      return;
    }
    if (!finalBank) {
      setErrorMsg('Please select or enter the Finance Bank Name.');
      return;
    }
    if (Math.abs(totalPercentage - 100) > 0.1) {
      setErrorMsg(
        `Total partner share must equal 100% (currently ${totalPercentage}%).`
      );
      return;
    }

    const sanitizedPartners: PartnerShare[] = partners.map((p, idx) => ({
      id: p.id,
      name:
        p.name.trim() || (idx === 0 ? cleanCustomer : `Partner ${idx + 1}`),
      percentage: Number(p.percentage) || 0,
    }));

    try {
      setSaving(true);
      await saveVehicleLocal(
        {
          id: editingRecord?.id ?? crypto.randomUUID(),
          isEdit: !!editingRecord,
          vehicleNumber: cleanVehicle,
          customerName: cleanCustomer,
          customerPhone: customerPhone.trim() || undefined,
          bankName: finalBank,
          notes: notes.trim() || undefined,
          partnerCount,
          partners: sanitizedPartners,
          dateTime: dateTime || getCurrentLocalDateTime(),
        },
        mediaItems,
        removedAttachments
      );
      await onSaved();
      requestClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Could not save record on this device. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={requestClose}
    >
      <div
        className="flex h-[100dvh] sm:h-auto sm:max-h-[94dvh] w-full sm:max-w-2xl flex-col rounded-none sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border-0 sm:border sm:border-slate-200 dark:sm:border-slate-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile-style header with Back Arrow on left */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={requestClose}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate">
                {editingRecord ? 'Edit Vehicle Entry' : 'New Vehicle Entry'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                Saved offline on your device
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="hidden sm:flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Close form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {errorMsg && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-300 break-words">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="vehicleNumber"
                className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5"
              >
                Vehicle Number <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="vehicleNumber"
                type="text"
                required
                maxLength={32}
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="e.g. RJ-14-AB-1234"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 font-mono text-base font-bold tracking-wider text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20 min-h-[46px]"
              />
            </div>

            <div>
              <label
                htmlFor="customerName"
                className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5"
              >
                Customer Name <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                id="customerName"
                type="text"
                required
                maxLength={120}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Full name of primary customer"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20 min-h-[46px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="bankSelect"
                className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5"
              >
                Financed By (Bank / NBFC) <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <select
                id="bankSelect"
                value={selectedBankOption}
                onChange={(e) => setSelectedBankOption(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20 min-h-[46px]"
              >
                {BANKS_LIST.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
                <option value="OTHER">Other / Custom Bank...</option>
              </select>

              {selectedBankOption === 'OTHER' && (
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={customBankName}
                  onChange={(e) => setCustomBankName(e.target.value)}
                  placeholder="Enter bank or finance company name"
                  className="mt-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20 min-h-[44px]"
                />
              )}
            </div>

            <div>
              <label
                htmlFor="customerPhone"
                className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5"
              >
                Customer Mobile <span className="text-xs font-normal text-slate-400">(Optional)</span>
              </label>
              <input
                id="customerPhone"
                type="tel"
                maxLength={24}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 font-mono text-sm font-medium text-slate-900 dark:text-slate-100 placeholder:font-sans placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20 min-h-[46px]"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Shareholders / Partners (Kitne logo ka hissa hai)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Set number of partners and each person&apos;s % share
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePartnerCountChange(partnerCount - 1)}
                  disabled={partnerCount <= 1}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  aria-label="Decrease partners"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-9 text-center font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                  {partnerCount}
                </span>
                <button
                  type="button"
                  onClick={() => handlePartnerCountChange(partnerCount + 1)}
                  disabled={partnerCount >= 10}
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                  aria-label="Increase partners"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2.5">
              {partners.map((partner, index) => (
                <div key={partner.id} className="flex items-center gap-2.5">
                  <span className="w-6 text-xs font-mono font-semibold text-slate-400 tabular-nums shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    value={partner.name}
                    onChange={(e) =>
                      updatePartner(partner.id, 'name', e.target.value)
                    }
                    placeholder={
                      index === 0
                        ? customerName.trim() || 'Partner 1 name'
                        : `Partner ${index + 1} name`
                    }
                    className="flex-1 min-w-0 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none min-h-[44px]"
                  />
                  <div className="relative w-24 shrink-0">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={partner.percentage}
                      onChange={(e) =>
                        updatePartner(partner.id, 'percentage', e.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-3 pr-7 py-2 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none min-h-[44px]"
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
              <button
                type="button"
                onClick={handleEqualSplit}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline py-1.5"
              >
                Split 100% equally
              </button>
              <div
                className={`text-xs font-semibold tabular-nums ${
                  Math.abs(totalPercentage - 100) <= 0.1
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-600 dark:text-red-400'
                }`}
              >
                Total Share: {totalPercentage}%
                {Math.abs(totalPercentage - 100) > 0.1 && ' (Must be 100%)'}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Date &amp; Time
              </label>
              <button
                type="button"
                onClick={() => setDateTime(getCurrentLocalDateTime())}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Set Now</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={datePart}
                  onChange={(e) => setDateTime(`${e.target.value}T${timePart}`)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none min-h-[46px]"
                />
              </div>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="time"
                  value={timePart}
                  onChange={(e) => setDateTime(`${datePart}T${e.target.value}`)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2.5 text-sm font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none min-h-[46px]"
                />
              </div>
            </div>
          </div>

          <MediaCaptureSection
            items={mediaItems}
            onAddFiles={handleAddFiles}
            onRemoveItem={handleRemoveMedia}
          />

          <div>
            <label
              htmlFor="notes"
              className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5"
            >
              Notes / Loan Reference <span className="text-xs font-normal text-slate-400">(Optional)</span>
            </label>
            <textarea
              id="notes"
              rows={2}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="EMI amount, dealer remarks, RC status, or extra details..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
            />
          </div>
        </form>

        <div className="flex items-center gap-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-3.5 pb-safe shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={requestClose}
            className="flex-1 sm:flex-none rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors min-h-[48px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={(e) => {
              const form = e.currentTarget.closest('div')?.previousElementSibling as HTMLFormElement | null;
              form?.requestSubmit();
            }}
            className="flex-2 sm:flex-1 rounded-xl bg-blue-700 dark:bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 dark:hover:bg-blue-500 active:scale-[0.99] disabled:opacity-50 transition min-h-[48px]"
          >
            {saving
              ? 'Saving...'
              : editingRecord
              ? 'Update Record'
              : 'Save Vehicle Entry'}
          </button>
        </div>
      </div>
    </div>
  );
};
