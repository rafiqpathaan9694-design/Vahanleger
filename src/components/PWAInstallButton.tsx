import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!showGuide) return;
    window.history.pushState({ vahanOverlay: 'install-guide' }, '');
    const handlePop = () => setShowGuide(false);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [showGuide]);

  const closeGuide = () => {
    if (window.history.state?.vahanOverlay === 'install-guide') {
      window.history.back();
    } else {
      setShowGuide(false);
    }
  };

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 min-h-[36px]'
            : 'inline-flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 min-h-[40px]'
        }
        title="Install on Phone Home Screen"
      >
        <Download className="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
        <span>{isInstallable ? 'Install App' : 'Get App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
          onClick={closeGuide}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-200 dark:border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700 sm:hidden" />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeGuide}
                  className="flex sm:hidden h-10 w-10 items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Install VahanLedger on Phone
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Works like a native mobile app
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeGuide}
                className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Close install guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">01</span>
                  <span>Open this link in <strong>Safari</strong> on your iPhone or iPad.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">02</span>
                  <span>Tap the <strong>Share</strong> button in Safari toolbar.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">03</span>
                  <span>Scroll down and tap <strong>Add to Home Screen</strong>.</span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-2.5 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">01</span>
                  <span>Open the app URL directly in <strong>Google Chrome</strong> on Android.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">02</span>
                  <span>Tap the <strong>3-dots menu</strong> (top-right) and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-400 mt-0.5">03</span>
                  <span>VahanLedger will appear on your home screen and run 100% offline on your device.</span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={closeGuide}
              className="mt-6 w-full rounded-xl bg-slate-900 dark:bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors min-h-[44px]"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
