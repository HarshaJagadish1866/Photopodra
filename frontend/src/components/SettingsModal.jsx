import React, { useState, useEffect } from 'react';
import {
  X,
  Server,
  Activity,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
  Wifi,
  Smartphone,
  Globe,
  Loader2,
  Save
} from 'lucide-react';
import {
  getServerUrl,
  setServerUrl,
  resetServerUrl,
  getDefaultServerUrl,
  testServerConnection,
  cleanUrl
} from '../services/serverConfig';

/**
 * SettingsModal: Allows users to configure and test the backend server endpoint
 * for standalone web, desktop (macOS/Windows via Tauri/Electron), and mobile (Android/iOS via Capacitor).
 */
export default function SettingsModal({
  isOpen,
  onClose,
  onServerUrlSaved
}) {
  const [urlInput, setUrlInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(getServerUrl());
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async (targetUrl = urlInput) => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testServerConnection(targetUrl);
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        latencyMs: 0,
        error: err.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleaned = cleanUrl(urlInput);
    setServerUrl(cleaned);
    setSaveSuccess(true);

    if (onServerUrlSaved) {
      onServerUrlSaved(cleaned);
    }

    setTimeout(() => {
      onClose();
    }, 600);
  };

  const handleReset = () => {
    resetServerUrl();
    const defaultUrl = getDefaultServerUrl();
    setUrlInput(defaultUrl);
    handleTestConnection(defaultUrl);
  };

  const applyPreset = (presetUrl) => {
    setUrlInput(presetUrl);
    handleTestConnection(presetUrl);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden flex flex-col gap-5 text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 id="settings-modal-title" className="text-base font-bold text-white tracking-tight">
                Server Connection
              </h2>
              <p className="text-xs text-slate-400">
                Configure your Photopodra backend endpoint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close settings modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Server Endpoint Form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
              Server URL Endpoint
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="http://192.168.1.50:3001 or https://photos.mydomain.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/20 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={() => handleTestConnection()}
                disabled={isTesting || !urlInput.trim()}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-xs font-semibold text-white border border-slate-700 transition-colors cursor-pointer shrink-0"
              >
                {isTesting ? (
                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                ) : (
                  <Activity className="w-4 h-4 text-rose-400" />
                )}
                <span>Test</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 flex items-center justify-between">
              <span>Default: <code className="text-slate-400">{getDefaultServerUrl()}</code></span>
              <button
                type="button"
                onClick={handleReset}
                className="text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset Default
              </button>
            </p>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => applyPreset('http://localhost:3001')}
                className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer font-mono text-[11px]"
              >
                http://localhost:3001
              </button>
              {typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'http://localhost:3001' && (
                <button
                  type="button"
                  onClick={() => applyPreset(window.location.origin)}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer font-mono text-[11px]"
                >
                  This Origin ({window.location.origin})
                </button>
              )}
            </div>
          </div>

          {/* Test Result Indicator Banner */}
          {testResult && (
            <div
              className={`p-3.5 rounded-2xl border text-xs flex items-start gap-2.5 transition-all ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center justify-between font-semibold">
                  <span>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</span>
                  {testResult.latencyMs !== undefined && (
                    <span className="font-mono text-[11px] opacity-80">
                      {testResult.latencyMs} ms
                    </span>
                  )}
                </div>
                <p className="text-[11px] opacity-90">
                  {testResult.success
                    ? `Connected to Photopodra backend (${testResult.service}).`
                    : testResult.error}
                </p>
              </div>
            </div>
          )}

          {/* Cross-Platform Guidance Notes */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Decoupled Client Instructions</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li>
                <strong className="text-slate-300">Physical Android / iOS / LAN:</strong> Use your machine's local IP, e.g. <code className="text-rose-300 font-mono">http://192.168.1.X:3001</code>.
              </li>
              <li>
                <strong className="text-slate-300">Android Emulator:</strong> Use <code className="text-rose-300 font-mono">http://10.0.2.2:3001</code> to access host machine localhost.
              </li>
              <li>
                <strong className="text-slate-300">Desktop / Remote Cloud:</strong> Enter your domain, e.g. <code className="text-rose-300 font-mono">https://photos.mydomain.com</code>.
              </li>
            </ul>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
            }`}
          >
            {saveSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save & Connect</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
