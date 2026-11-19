import type { MediaAttachment, VehicleRecord } from '../types';

const DB_NAME = 'vahanledger-offline-db';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_MEDIA = 'media';
const STORE_SYNC_QUEUE = 'syncQueue';

export interface LocalMediaBlobRecord {
  id: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: number;
}

export interface PendingSyncItem {
  id: string; // vehicle record ID
  action: 'upsert' | 'delete';
  isEdit?: boolean;
  removedMediaIds?: string[];
  updatedAt: number;
}

function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RECORDS)) {
        db.createObjectStore(STORE_RECORDS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
        db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllLocalRecords(): Promise<VehicleRecord[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readonly');
    const req = tx.objectStore(STORE_RECORDS).getAll();
    req.onsuccess = () => {
      const items = (req.result as VehicleRecord[]) || [];
      items.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalRecordById(
  id: string
): Promise<VehicleRecord | null> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readonly');
    const req = tx.objectStore(STORE_RECORDS).get(id);
    req.onsuccess = () => resolve((req.result as VehicleRecord) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function putLocalRecord(record: VehicleRecord): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readwrite');
    tx.objectStore(STORE_RECORDS).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putManyLocalRecords(
  records: VehicleRecord[]
): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDS);
    for (const r of records) {
      store.put(r);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteLocalRecord(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RECORDS, 'readwrite');
    tx.objectStore(STORE_RECORDS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function putLocalMediaBlob(
  item: LocalMediaBlobRecord
): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getLocalMediaBlob(
  id: string
): Promise<LocalMediaBlobRecord | null> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const req = tx.objectStore(STORE_MEDIA).get(id);
    req.onsuccess = () => resolve((req.result as LocalMediaBlobRecord) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteLocalMediaBlob(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    tx.objectStore(STORE_MEDIA).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function replaceLocalMediaId(
  oldId: string,
  newAttachment: MediaAttachment
): Promise<void> {
  const existing = await getLocalMediaBlob(oldId);
  if (!existing) return;
  await putLocalMediaBlob({
    ...existing,
    id: newAttachment.id,
  });
  if (oldId !== newAttachment.id) {
    await deleteLocalMediaBlob(oldId);
  }
}

export async function getPendingSyncItems(): Promise<PendingSyncItem[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readonly');
    const req = tx.objectStore(STORE_SYNC_QUEUE).getAll();
    req.onsuccess = () =>
      resolve(((req.result as PendingSyncItem[]) || []).sort((a, b) => a.updatedAt - b.updatedAt));
    req.onerror = () => reject(req.error);
  });
}

export async function putPendingSyncItem(item: PendingSyncItem): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    tx.objectStore(STORE_SYNC_QUEUE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function removePendingSyncItem(id: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, 'readwrite');
    tx.objectStore(STORE_SYNC_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
