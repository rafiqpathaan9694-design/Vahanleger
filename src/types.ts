export interface PartnerShare {
  id: string;
  name: string;
  percentage: number;
}

export interface MediaAttachment {
  id: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface VehicleRecord {
  id: string;
  vehicleNumber: string;
  customerName: string;
  customerPhone?: string;
  bankName: string;
  notes?: string;
  partnerCount: number;
  partners: PartnerShare[];
  dateTime: string; // ISO local datetime string YYYY-MM-DDTHH:mm
  mediaAttachments: MediaAttachment[];
  createdAt: number;
  updatedAt: number;
}

export interface DraftLocalMedia {
  id: string;
  type: 'image' | 'video';
  name: string;
  mimeType: string;
  size: number;
  file?: File;
  existingAttachment?: MediaAttachment;
}

export const BANKS_LIST = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India (SBI)',
  'Axis Bank',
  'Mahindra Finance',
  'Bajaj Finserv',
  'Cholamandalam Finance',
  'Kotak Mahindra Bank',
  'IndusInd Bank',
  'Tata Motors Finance',
  'Shriram Finance',
  'AU Small Finance Bank',
  'Sundaram Finance',
  'Cash / Self Financed',
] as const;

export function getCurrentLocalDateTime(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function formatDisplayDateTime(isoLocal: string): string {
  if (!isoLocal) return '—';
  const date = new Date(isoLocal);
  if (Number.isNaN(date.getTime())) return isoLocal;
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
