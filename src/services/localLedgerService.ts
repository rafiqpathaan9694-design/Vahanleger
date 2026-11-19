import {
  deleteLocalMediaBlob,
  deleteLocalRecord,
  getAllLocalRecords,
  getLocalRecordById,
  putLocalMediaBlob,
  putLocalRecord,
  putManyLocalRecords,
} from '../db/offlineStore';
import type {
  DraftLocalMedia,
  MediaAttachment,
  PartnerShare,
  VehicleRecord,
} from '../types';

export async function getAllVehiclesLocal(): Promise<VehicleRecord[]> {
  return getAllLocalRecords();
}

export async function saveVehicleLocal(
  draft: {
    id: string;
    isEdit: boolean;
    vehicleNumber: string;
    customerName: string;
    customerPhone?: string;
    bankName: string;
    notes?: string;
    partnerCount: number;
    partners: PartnerShare[];
    dateTime: string;
  },
  mediaItems: DraftLocalMedia[],
  removedAttachments: MediaAttachment[]
): Promise<VehicleRecord> {
  const now = Date.now();
  const existingLocal = draft.isEdit
    ? await getLocalRecordById(draft.id)
    : null;

  const localAttachments: MediaAttachment[] = [];
  for (const item of mediaItems) {
    if (item.existingAttachment) {
      localAttachments.push(item.existingAttachment);
    } else if (item.file) {
      const localId = item.id.startsWith('local-')
        ? item.id
        : `local-${item.id}`;
      await putLocalMediaBlob({
        id: localId,
        type: item.type,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        blob: item.file,
        createdAt: now,
      });
      localAttachments.push({
        id: localId,
        type: item.type,
        name: item.name,
        mimeType: item.mimeType,
        size: item.size,
        url: `local://${localId}`,
      });
    }
  }

  for (const removed of removedAttachments) {
    await deleteLocalMediaBlob(removed.id);
  }

  const localRecord: VehicleRecord = {
    id: draft.id,
    vehicleNumber: draft.vehicleNumber.trim().toUpperCase(),
    customerName: draft.customerName.trim(),
    ...(draft.customerPhone?.trim()
      ? { customerPhone: draft.customerPhone.trim() }
      : {}),
    bankName: draft.bankName.trim(),
    ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
    partnerCount: draft.partners.length,
    partners: draft.partners,
    dateTime: draft.dateTime,
    mediaAttachments: localAttachments,
    createdAt: existingLocal?.createdAt ?? now,
    updatedAt: now,
  };

  await putLocalRecord(localRecord);
  return localRecord;
}

export async function deleteVehicleLocal(
  record: VehicleRecord
): Promise<void> {
  await deleteLocalRecord(record.id);
  for (const att of record.mediaAttachments) {
    await deleteLocalMediaBlob(att.id);
  }
}

export async function importVehiclesBackupLocal(
  importedRecords: VehicleRecord[]
): Promise<number> {
  const validRecords = importedRecords.filter(
    (r) =>
      r &&
      typeof r.id === 'string' &&
      typeof r.vehicleNumber === 'string' &&
      typeof r.customerName === 'string' &&
      typeof r.bankName === 'string' &&
      Array.isArray(r.partners)
  );
  if (validRecords.length === 0) return 0;
  await putManyLocalRecords(validRecords);
  return validRecords.length;
}
