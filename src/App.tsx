import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Car,
  ChevronRight,
  Download,
  Image as ImageIcon,
  Layers,
  Moon,
  Plus,
  Search,
  Sun,
  Upload,
  Users,
  Video,
} from 'lucide-react';
import {
  getAllVehiclesLocal,
  importVehiclesBackupLocal,
} from './services/localLedgerService';
import { formatDisplayDateTime, type VehicleRecord } from './types';
import { PWAInstallButton } from './components/PWAInstallButton';
import { VehicleFormModal } from './components/VehicleFormModal';
import { VehicleDetailModal } from './components/VehicleDetailModal';

type NavView = 'records' | 'joint' | 'banks';
type ThemeMode = 'light' | 'dark';

export default function App() {

  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('vahanledger-theme', theme);
    } catch {
      // ignore storage failure
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#020617' : '#0F172A');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const [records, setRecords] = useState<VehicleRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<NavView>('records');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBankFilter, setSelectedBankFilter] = useState<string>('ALL');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VehicleRecord | null>(null);
  const [viewingRecordId, setViewingRecordId] = useState<string | null>(null);

  // Sync mobile hardware/swipe back button with tab/filter navigation
  useEffect(() => {
    const handlePop = () => {
      if (isFormOpen || viewingRecordId) return;
      if (selectedBankFilter !== 'ALL') {
        setSelectedBankFilter('ALL');
        return;
      }
      if (activeView !== 'records') {
        setActiveView('records');
      }
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [isFormOpen, viewingRecordId, selectedBankFilter, activeView]);

  const navigateToView = (nextView: NavView, bankFilter: string = 'ALL') => {
    if (nextView !== 'records' || bankFilter !== 'ALL') {
      window.history.pushState({ vahanTab: nextView, bankFilter }, '');
    }
    setActiveView(nextView);
    setSelectedBankFilter(bankFilter);
  };

  const handleMobileSubViewBack = () => {
    if (
      window.history.state &&
      (window.history.state.vahanTab || window.history.state.bankFilter)
    ) {
      window.history.back();
    } else {
      setSelectedBankFilter('ALL');
      setActiveView('records');
    }
  };

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

  const loadRecords = useCallback(async () => {
    try {
      setServerError(null);
      const list = await getAllVehiclesLocal();
      setRecords(list);
    } catch (err: unknown) {
      setServerError(
        err instanceof Error ? err.message : 'Failed to load local records.'
      );
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const viewingRecord = useMemo(
    () => records.find((r) => r.id === viewingRecordId) ?? null,
    [records, viewingRecordId]
  );

  const uniqueBanks = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      map.set(r.bankName, (map.get(r.bankName) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const stats = useMemo(() => {
    let jointCount = 0;
    let totalMedia = 0;
    for (const r of records) {
      if (r.partnerCount > 1) jointCount += 1;
      totalMedia += r.mediaAttachments.length;
    }
    return {
      total: records.length,
      banks: uniqueBanks.length,
      joint: jointCount,
      media: totalMedia,
    };
  }, [records, uniqueBanks]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (activeView === 'joint' && r.partnerCount < 2) return false;
      if (selectedBankFilter !== 'ALL' && r.bankName !== selectedBankFilter) {
        return false;
      }
      if (!q) return true;
      const inVehicle = r.vehicleNumber.toLowerCase().includes(q);
      const inCustomer = r.customerName.toLowerCase().includes(q);
      const inBank = r.bankName.toLowerCase().includes(q);
      const inPartner = r.partners.some((p) => p.name.toLowerCase().includes(q));
      return inVehicle || inCustomer || inBank || inPartner;
    });
  }, [records, activeView, selectedBankFilter, searchQuery]);

  const handleExportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      totalRecords: records.length,
      records,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vahanledger-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { records?: VehicleRecord[] } | VehicleRecord[];
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.records)
        ? parsed.records
        : [];
      const count = await importVehiclesBackupLocal(list);
      if (count === 0) {
        setServerError('No valid vehicle records found in that backup file.');
      } else {
        setServerError(null);
        setStatusMessage(`Restored ${count} vehicle record(s) locally.`);
        setTimeout(() => setStatusMessage(null), 4000);
        await loadRecords();
      }
    } catch {
      setServerError('Invalid JSON backup file.');
    }
  };

  const openNewForm = () => {
    setEditingRecord(null);
    setIsFormOpen(true);
  };

  const openEditForm = (rec: VehicleRecord) => {
    setViewingRecordId(null);
    setEditingRecord(rec);
    setIsFormOpen(true);
  };

  const isSubView = activeView !== 'records' || selectedBankFilter !== 'ALL';

  return (
    <div className="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      {/* Desktop Top Bar (3-zone contract) */}
      <header className="hidden md:flex sticky top-0 z-30 items-center justify-between gap-8 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 lg:px-10 h-16 no-print">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveView('records');
            setSelectedBankFilter('ALL');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
        >
          VahanLedger
        </a>

        <nav className="flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => {
              setActiveView('records');
              setSelectedBankFilter('ALL');
            }}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeView === 'records'
                ? 'border-blue-700 dark:border-blue-500 text-slate-900 dark:text-slate-100 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            All Vehicles
          </button>
          <button
            type="button"
            onClick={() => navigateToView('joint')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeView === 'joint'
                ? 'border-blue-700 dark:border-blue-500 text-slate-900 dark:text-slate-100 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Joint Partners
          </button>
          <button
            type="button"
            onClick={() => navigateToView('banks')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeView === 'banks'
                ? 'border-blue-700 dark:border-blue-500 text-slate-900 dark:text-slate-100 font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            Bank Summary
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={openNewForm}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 dark:bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 active:scale-[0.98] transition whitespace-nowrap shrink-0 min-h-[42px]"
          >
            <Plus className="h-4 w-4" />
            <span>Add Vehicle</span>
          </button>
        </div>
      </header>

      {/* Mobile Compact Top App Bar (48px height, includes mobile Back Arrow on sub-views + Dark/Light toggle) */}
      <header className="flex md:hidden sticky top-0 z-30 items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 h-12 no-print">
        <div className="flex items-center gap-1.5 min-w-0">
          {isSubView && (
            <button
              type="button"
              onClick={handleMobileSubViewBack}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <span className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            {activeView === 'banks'
              ? 'Bank Summary'
              : activeView === 'joint'
              ? 'Joint Partners'
              : selectedBankFilter !== 'ALL'
              ? selectedBankFilter
              : 'VahanLedger'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-700" />
            )}
          </button>
          <PWAInstallButton compact />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-5 md:py-8 pb-24 md:pb-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex items-start gap-3">
            {isSubView && (
              <button
                type="button"
                onClick={handleMobileSubViewBack}
                className="hidden md:flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0 mt-0.5"
                aria-label="Go back"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {activeView === 'banks'
                  ? 'Finance Bank Overview'
                  : activeView === 'joint'
                  ? 'Joint Ownership Vehicles'
                  : 'Vehicle Finance Ledger'}
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Track vehicle numbers, customers, bank finance, partner shares, and photos or videos — 100% offline on your device.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[40px] whitespace-nowrap"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-slate-700" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
            <PWAInstallButton />
            <input
              ref={restoreInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportJSON}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[40px] whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Restore JSON</span>
            </button>
            {records.length > 0 && (
              <button
                type="button"
                onClick={handleExportJSON}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors min-h-[40px] whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Backup JSON</span>
              </button>
            )}
          </div>
        </div>

        {statusMessage && (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300 break-words">
            {statusMessage}
          </div>
        )}

        {serverError && (
          <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-4 py-3 text-sm font-medium text-red-800 dark:text-red-300 break-words">
            {serverError}
          </div>
        )}

        {/* 4-Column Summary Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Vehicles
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {stats.total}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Finance Banks
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {stats.banks}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Joint Partnerships
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {stats.joint}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Photos &amp; Videos
            </p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
              {stats.media}
            </p>
          </div>
        </section>

        {activeView === 'banks' ? (
          <section className="space-y-4">
            {uniqueBanks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-10 text-center">
                <Building2 className="mx-auto h-9 w-9 text-slate-400" />
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                  No bank records yet
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Add a vehicle entry to see bank-wise finance distribution.
                </p>
                <button
                  type="button"
                  onClick={openNewForm}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 dark:bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors min-h-[44px]"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Vehicle Entry</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {uniqueBanks.map(([bank, count]) => (
                  <button
                    key={bank}
                    type="button"
                    onClick={() => navigateToView('records', bank)}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-700/40 dark:hover:border-blue-500/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 transition-colors min-h-[72px]"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {bank}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {count} {count === 1 ? 'vehicle' : 'vehicles'} financed
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search vehicle no., customer, partner, or bank..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-700/20 min-h-[46px]"
                />
              </div>

              <select
                value={selectedBankFilter}
                onChange={(e) => setSelectedBankFilter(e.target.value)}
                aria-label="Filter by finance bank"
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100 focus:border-blue-700 dark:focus:border-blue-500 focus:outline-none min-h-[46px] sm:w-56"
              >
                <option value="ALL">All Finance Banks</option>
                {uniqueBanks.map(([bank, count]) => (
                  <option key={bank} value={bank}>
                    {bank} ({count})
                  </option>
                ))}
              </select>
            </section>

            {loadingRecords ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-40 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-12 text-center">
                <Car className="mx-auto h-10 w-10 text-slate-400" />
                <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
                  {records.length === 0
                    ? 'No vehicle entries added yet'
                    : 'No matching vehicle records'}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  {records.length === 0
                    ? 'Tap below to save your first vehicle number, customer name, finance bank, partner shares, and photos or videos offline on this device.'
                    : 'Try clearing your search text or selecting All Finance Banks.'}
                </p>
                {records.length === 0 ? (
                  <button
                    type="button"
                    onClick={openNewForm}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-700 dark:bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors min-h-[48px]"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add First Vehicle</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedBankFilter('ALL');
                      setActiveView('records');
                    }}
                    className="mt-4 inline-flex items-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 min-h-[44px]"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRecords.map((record) => {
                  const images = record.mediaAttachments.filter(
                    (m) => m.type === 'image'
                  ).length;
                  const videos = record.mediaAttachments.filter(
                    (m) => m.type === 'video'
                  ).length;
                  return (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setViewingRecordId(record.id)}
                      className="group flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-blue-700/40 dark:hover:border-blue-500/50 hover:shadow-sm active:scale-[0.99] transition"
                    >
                      <div className="space-y-2.5 w-full">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-mono text-lg font-bold tracking-wider text-slate-900 dark:text-slate-100">
                            {record.vehicleNumber}
                          </span>
                          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors shrink-0" />
                        </div>

                        <div>
                          <p className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {record.customerName}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {record.bankName}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">
                              {record.partnerCount}{' '}
                              {record.partnerCount === 1 ? 'Partner' : 'Partners'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 w-full">
                        <span className="tabular-nums truncate">
                          {formatDisplayDateTime(record.dateTime)}
                        </span>

                        {(images > 0 || videos > 0) && (
                          <div className="flex items-center gap-2.5 shrink-0 font-medium text-slate-600 dark:text-slate-300 tabular-nums">
                            {images > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <ImageIcon className="h-3.5 w-3.5 text-slate-400" />
                                {images}
                              </span>
                            )}
                            {videos > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Video className="h-3.5 w-3.5 text-slate-400" />
                                {videos}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </section>
            )}
          </>
        )}

        {/* Mobile Offline Backup & Restore Utility Row */}
        <section className="flex md:hidden items-center justify-between gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 no-print">
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Restore Backup</span>
          </button>
          {records.length > 0 && (
            <button
              type="button"
              onClick={handleExportJSON}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 min-h-[44px]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export JSON</span>
            </button>
          )}
        </section>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe no-print"
      >
        <div className="grid grid-cols-4 items-center h-14">
          <button
            type="button"
            onClick={() => {
              setActiveView('records');
              setSelectedBankFilter('ALL');
            }}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] ${
              activeView === 'records'
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Layers className="h-5 w-5" />
            <span className="text-[10px] font-semibold mt-0.5">Records</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('joint')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] ${
              activeView === 'joint'
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Users className="h-5 w-5" />
            <span className="text-[10px] font-semibold mt-0.5">Partners</span>
          </button>

          <button
            type="button"
            onClick={() => navigateToView('banks')}
            className={`flex flex-col items-center justify-center h-full min-h-[44px] ${
              activeView === 'banks'
                ? 'text-blue-700 dark:text-blue-400'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Building2 className="h-5 w-5" />
            <span className="text-[10px] font-semibold mt-0.5">Banks</span>
          </button>

          <button
            type="button"
            onClick={openNewForm}
            className="flex flex-col items-center justify-center h-full min-h-[44px] text-blue-700 dark:text-blue-400"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-700 dark:bg-blue-600 text-white">
              <Plus className="h-4 w-4" />
            </div>
            <span className="text-[10px] font-semibold mt-0.5">Add</span>
          </button>
        </div>
      </nav>

      {isFormOpen && (
        <VehicleFormModal
          editingRecord={editingRecord}
          onClose={() => {
            setIsFormOpen(false);
            setEditingRecord(null);
          }}
          onSaved={loadRecords}
        />
      )}

      {viewingRecord && (
        <VehicleDetailModal
          record={viewingRecord}
          onClose={() => setViewingRecordId(null)}
          onEdit={openEditForm}
          onDeleted={loadRecords}
        />
      )}
    </div>
  );
}
