import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  AlertTriangle,
  FileText,
  MapPin,
  User,
  Shield,
  ChevronRight
} from 'lucide-react';
import { IvacProfile } from '../types/profile';
import { DocumentMetadata } from '../types/document';
import { WorkflowSession } from '../types/workflow';

interface DashboardProps {
  selectedProfile: IvacProfile | null;
  profiles: IvacProfile[];
  documents: DocumentMetadata[];
  workflowSession: WorkflowSession;
  onSelectProfile: (id: string) => void;
  onStartWorkflow: (sessionPassword?: string) => void;
  onPauseWorkflow: () => void;
  onResumeWorkflow: () => void;
  onStopWorkflow: () => void;
  onSwitchTab: (tab: 'profiles' | 'documents' | 'workflow' | 'settings') => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  selectedProfile,
  profiles,
  documents,
  workflowSession,
  onSelectProfile,
  onStartWorkflow,
  onPauseWorkflow,
  onResumeWorkflow,
  onStopWorkflow,
  onSwitchTab,
}) => {
  const [sessionPassword, setSessionPassword] = useState('');

  const primaryDoc = documents.find((d) => d.role === 'primary');
  const additionalDocs = documents.filter((d) => d.role === 'additional');
  const hasRequiredDocs = !!primaryDoc;
  const isProfileReady = !!selectedProfile && hasRequiredDocs;

  const isRunning = [
    'LOGIN_READY',
    'WAITING_FOR_USER_AUTHENTICATION',
    'DOCUMENT_UPLOAD',
    'CENTRE_SELECTION',
    'APPOINTMENT_SELECTION'
  ].includes(workflowSession.state);

  const isPaused = workflowSession.state === 'PAUSED';

  // Validation messages for user guidance
  const getValidationWarnings = () => {
    const warnings: string[] = [];
    if (!selectedProfile) {
      warnings.push('Please select or create an applicant profile.');
      return warnings;
    }
    if (!primaryDoc) {
      warnings.push('Primary Applicant PDF is missing. Please upload it in the Documents tab.');
    }
    return warnings;
  };

  const warnings = getValidationWarnings();

  return (
    <div className="space-y-3.5 text-xs">
      {/* 1. Profile Selector Banner */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Active Applicant Profile
          </span>
          <button
            onClick={() => onSwitchTab('profiles')}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
          >
            Manage Profiles <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {profiles.length > 0 ? (
          <div className="flex items-center gap-2">
            <select
              value={selectedProfile?.id || ''}
              onChange={(e) => onSelectProfile(e.target.value)}
              disabled={isRunning}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-medium focus:outline-none focus:border-emerald-500 disabled:opacity-50"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName} ({p.preferredCentre})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-slate-400 text-xs">No profile available</p>
            <button
              onClick={() => onSwitchTab('profiles')}
              className="mt-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs"
            >
              Create Profile
            </button>
          </div>
        )}

        {selectedProfile && (
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
            <div className="flex items-center gap-1.5 text-slate-300">
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              <span>Centre: <strong>{selectedProfile.preferredCentre}</strong></span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-300">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Mobile: <strong>{selectedProfile.mobileNumber}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Document Readiness Card */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Document Readiness
          </span>
          <button
            onClick={() => onSwitchTab('documents')}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
          >
            Manage PDFs <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <div>
              <p className="font-medium text-slate-200">
                {primaryDoc ? 'Primary PDF Ready' : 'Primary PDF Missing'}
              </p>
              <p className="text-[10px] text-slate-400">
                {additionalDocs.length} additional applicant PDF(s) attached
              </p>
            </div>
          </div>
          <div>
            {primaryDoc ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                Ready
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-950 text-rose-400 border border-rose-800/80">
                Incomplete
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Session Password (Optional) */}
      {!isRunning && (
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-1.5">
          <div className="flex items-center gap-1 text-slate-300 font-medium text-[11px]">
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Optional: Session IVAC Password</span>
          </div>
          <input
            type="password"
            value={sessionPassword}
            onChange={(e) => setSessionPassword(e.target.value)}
            placeholder="Enter password for automated fill (in-memory)"
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      )}

      {/* 4. Validation Warnings */}
      {warnings.length > 0 && !isRunning && (
        <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 rounded-xl space-y-1 text-amber-200 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-amber-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Requirements Needed to Start</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-300/90 pl-1">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Workflow Execution Controls */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Workflow Control
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            State: {workflowSession.state}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isRunning && !isPaused ? (
            <button
              onClick={() => onStartWorkflow(sessionPassword)}
              disabled={!isProfileReady}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-all transform active:scale-98"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Assistant</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={onResumeWorkflow}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Flow</span>
            </button>
          ) : (
            <button
              onClick={onPauseWorkflow}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-700 hover:bg-amber-600 text-white font-semibold rounded-lg shadow-sm transition-all"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              onClick={onStopWorkflow}
              className="px-3.5 py-2.5 bg-rose-600/90 hover:bg-rose-500 text-white font-semibold rounded-lg transition-colors"
              title="Stop Automation"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-500 text-center">
          Starting requires explicit click. The extension will assist page-by-page without bypassing security.
        </p>
      </div>
    </div>
  );
};
