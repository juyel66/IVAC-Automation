import React from 'react';
import {
  RotateCcw,
  ShieldCheck,
  HardDrive,
  Server
} from 'lucide-react';
import { ExtensionSettings } from '../storage/settingsRepository';
import { licenseService } from '../services/licenseService';

interface SettingsProps {
  settings: ExtensionSettings;
  onUpdateSettings: (newSettings: Partial<ExtensionSettings>) => void;
  onResetPosition: () => void;
  profilesCount: number;
  documentsCount: number;
}

export const Settings: React.FC<SettingsProps> = ({
  settings,
  onUpdateSettings,
  onResetPosition,
  profilesCount,
  documentsCount,
}) => {
  return (
    <div className="space-y-4 text-xs">
      {/* Panel Position & Window Controls */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Assistant Window & Position
        </h4>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-200">Reset Floating Position</span>
            <p className="text-[10px] text-slate-400">
              Restore the assistant panel to the default top-right corner.
            </p>
          </div>
          <button
            onClick={onResetPosition}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors font-medium text-[11px]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-200">Keep Within Screen Viewport</span>
            <p className="text-[10px] text-slate-400">
              Constrain draggable panel inside visible browser window.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.stayWithinViewport}
            onChange={(e) => onUpdateSettings({ stayWithinViewport: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Preferences */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2.5">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Automation Preferences
        </h4>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-200">Autofill Credentials on Login</span>
            <p className="text-[10px] text-slate-400">
              Populate mobile number and session password on login route.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.autoFillEnabled}
            onChange={(e) => onUpdateSettings({ autoFillEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="space-y-0.5">
            <span className="font-medium text-slate-200">Audio Feedback Alerts</span>
            <p className="text-[10px] text-slate-400">
              Play subtle tone when OTP or slot is detected.
            </p>
          </div>
          <input
            type="checkbox"
            checked={settings.soundAlertsEnabled}
            onChange={(e) => onUpdateSettings({ soundAlertsEnabled: e.target.checked })}
            className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-emerald-600 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Licensing Server Endpoint */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-emerald-400" />
          <span>License Backend API</span>
        </h4>
        <p className="text-[10px] text-slate-400">
          The endpoint URL for license activation, verification, and payment requests.
        </p>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={settings.licenseApiUrl || 'http://localhost:5000/api/v1'}
            onChange={(e) => onUpdateSettings({ licenseApiUrl: e.target.value.trim() })}
            placeholder="http://localhost:5000/api/v1"
            className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-[11px] focus:outline-none focus:border-emerald-500"
          />
          <button
            type="button"
            onClick={async () => {
              const res = await licenseService.testServerConnection();
              if (res.success) {
                alert('Backend server connection successful! API is active.');
              } else {
                alert(`Backend connection failed: ${res.message}`);
              }
            }}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium text-[11px] transition-colors shrink-0"
          >
            Test
          </button>
        </div>
      </div>

      {/* Local Storage & Security Guarantee */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Local Data & Privacy Guarantee</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          All your applicant data and PDF files remain strictly local:
        </p>
        <ul className="list-disc list-inside text-[10px] text-slate-400 space-y-1">
          <li>Profiles stored in local <code className="text-slate-300">chrome.storage.local</code></li>
          <li>PDF documents stored in local browser <code className="text-slate-300">IndexedDB</code></li>
          <li>Zero external servers or telemetry</li>
          <li>Passwords never stored in plaintext on disk</li>
        </ul>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <HardDrive className="w-3.5 h-3.5 text-slate-500" />
            Storage usage:
          </span>
          <span className="font-medium text-slate-300">
            {profilesCount} Profiles • {documentsCount} Stored PDFs
          </span>
        </div>
      </div>
    </div>
  );
};
