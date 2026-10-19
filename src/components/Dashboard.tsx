import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  AlertTriangle,
  FileText,
  MapPin,
  Lock,
  Unlock,
  KeyRound,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
  ChevronRight,
  FileCheck
} from 'lucide-react';
import { IvacProfile } from '../types/profile';
import { DocumentMetadata } from '../types/document';
import { WorkflowSession, WorkflowState } from '../types/workflow';
import { credentialManager } from '../features/security/credentialManager';

interface DashboardProps {
  selectedProfile: IvacProfile | null;
  profiles: IvacProfile[];
  documents: DocumentMetadata[];
  workflowSession: WorkflowSession;
  onSelectProfile: (id: string) => void;
  onStartWorkflow: () => void;
  onPauseWorkflow: () => void;
  onResumeWorkflow: () => void;
  onStopWorkflow: () => void;
  onVerifyOtp: (otp: string) => Promise<{ success: boolean; message: string }>;
  onUnlockProfile: (masterPin: string) => Promise<{ success: boolean; error?: string }>;
  onSwitchTab: (tab: 'profiles' | 'documents' | 'workflow' | 'settings') => void;
}

const STAGES = [
  { id: 'LOGIN', label: 'Login' },
  { id: 'AUTH', label: 'OTP' },
  { id: 'DOCS', label: 'Docs' },
  { id: 'CENTRE', label: 'Centre' },
  { id: 'SLOT', label: 'Slot' },
  { id: 'PAYMENT', label: 'Pay' },
];

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
  onVerifyOtp,
  onUnlockProfile,
  onSwitchTab,
}) => {
  const [masterPin, setMasterPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [otpInput, setOtpInput] = useState('');
  const [otpLocalError, setOtpLocalError] = useState<string | null>(null);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  const primaryDoc = documents.find((d) => d.role === 'primary');
  const additionalDocs = documents.filter((d) => d.role === 'additional');
  const hasRequiredDocs = !!primaryDoc;

  const isUnlocked = selectedProfile ? credentialManager.isProfileUnlocked(selectedProfile.id) : false;
  const hasEncryptedCreds = !!(selectedProfile?.encryptedPassword);
  const isProfileReady = !!selectedProfile && hasRequiredDocs && isUnlocked;

  const isRunning = [
    'LOGIN_READY',
    'WAITING_FOR_USER_AUTHENTICATION',
    'DOCUMENT_UPLOAD',
    'CENTRE_SELECTION',
    'APPOINTMENT_SELECTION'
  ].includes(workflowSession.state);

  const isPaused = workflowSession.state === 'PAUSED';
  const isAwaitingOtp = workflowSession.detectedPage === 'OTP_VERIFICATION' || workflowSession.otpState.isRequired;
  const isAwaitingCaptcha = workflowSession.state === 'WAITING_FOR_USER_AUTHENTICATION' && !isAwaitingOtp;

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!masterPin) {
      setUnlockError('Enter Master PIN.');
      return;
    }
    setUnlockError(null);
    setIsUnlocking(true);
    try {
      const res = await onUnlockProfile(masterPin);
      if (!res.success) {
        setUnlockError(res.error || 'Incorrect PIN.');
      } else {
        setMasterPin('');
      }
    } catch (err: any) {
      setUnlockError(err.message || 'Unlock failed.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpInput.trim();
    if (!cleanOtp) {
      setOtpLocalError('Please enter OTP.');
      return;
    }
    if (!/^\d{4,8}$/.test(cleanOtp)) {
      setOtpLocalError('OTP must be 4–8 digits.');
      return;
    }

    setOtpLocalError(null);
    setIsSubmittingOtp(true);
    try {
      const res = await onVerifyOtp(cleanOtp);
      if (!res.success) {
        setOtpLocalError(res.message);
      } else {
        setOtpInput('');
      }
    } finally {
      setIsSubmittingOtp(false);
    }
  };

  const getStageStatus = (stageId: string): 'completed' | 'active' | 'pending' | 'error' => {
    if (workflowSession.state === 'ERROR') return 'error';

    switch (stageId) {
      case 'LOGIN':
        if (['IDLE', 'PROFILE_SELECTED'].includes(workflowSession.state)) return 'pending';
        if (workflowSession.state === 'LOGIN_READY') return 'active';
        return 'completed';

      case 'AUTH':
        if (['IDLE', 'PROFILE_SELECTED', 'LOGIN_READY'].includes(workflowSession.state)) return 'pending';
        if (workflowSession.state === 'WAITING_FOR_USER_AUTHENTICATION') return 'active';
        return 'completed';

      case 'DOCS':
        if (['IDLE', 'PROFILE_SELECTED', 'LOGIN_READY', 'WAITING_FOR_USER_AUTHENTICATION'].includes(workflowSession.state)) return 'pending';
        if (workflowSession.state === 'DOCUMENT_UPLOAD') return 'active';
        return 'completed';

      case 'CENTRE':
        if (['CENTRE_SELECTION'].includes(workflowSession.state)) return 'active';
        if (['APPOINTMENT_SELECTION', 'PAYMENT_HANDOFF', 'COMPLETED'].includes(workflowSession.state)) return 'completed';
        return 'pending';

      case 'SLOT':
        if (['APPOINTMENT_SELECTION'].includes(workflowSession.state)) return 'active';
        if (['PAYMENT_HANDOFF', 'COMPLETED'].includes(workflowSession.state)) return 'completed';
        return 'pending';

      case 'PAYMENT':
        if (workflowSession.state === 'PAYMENT_HANDOFF') return 'active';
        if (workflowSession.state === 'COMPLETED') return 'completed';
        return 'pending';

      default:
        return 'pending';
    }
  };

  const getCurrentStageSummary = (state: WorkflowState): string => {
    switch (state) {
      case 'IDLE':
      case 'PROFILE_SELECTED':
        return 'Ready to start';
      case 'LOGIN_READY':
        return '1/6: Filling Login Form';
      case 'WAITING_FOR_USER_AUTHENTICATION':
        return isAwaitingOtp ? '2/6: Enter SMS OTP' : '2/6: Solve CAPTCHA on page';
      case 'DOCUMENT_UPLOAD':
        return '3/6: Uploading Documents';
      case 'CENTRE_SELECTION':
        return '4/6: Selecting Centre';
      case 'APPOINTMENT_SELECTION':
        return '5/6: Selecting Slot';
      case 'PAYMENT_HANDOFF':
        return '6/6: Payment Handoff (Manual)';
      case 'PAUSED':
        return 'Flow Paused';
      case 'ERROR':
        return 'Action Required';
      case 'STOPPED':
        return 'Stopped';
      case 'COMPLETED':
        return 'Finished';
      default:
        return state;
    }
  };

  // Missing requirements helper text
  const getDisabledReason = (): string | null => {
    if (!selectedProfile) return 'Please select or create an applicant profile.';
    if (!hasRequiredDocs) return 'Primary PDF is missing. Upload in PDFs tab.';
    if (!hasEncryptedCreds) return 'Profile has no password set. Edit profile to add password.';
    if (!isUnlocked) return 'Enter Master PIN above to unlock credentials.';
    return null;
  };

  const disabledReason = getDisabledReason();
  const latestLog = workflowSession.logs[0];

  return (
    <div className="space-y-3 text-xs">
      {/* 1. COMPACT INLINE PROGRESS BAR */}
      <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Booking Progress
          </span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
            {getCurrentStageSummary(workflowSession.state)}
          </span>
        </div>

        {/* 6-Step Compact Horizontal Pipeline */}
        <div className="grid grid-cols-6 gap-1">
          {STAGES.map((stg, i) => {
            const status = getStageStatus(stg.id);
            return (
              <div
                key={stg.id}
                className={`py-1 px-1 rounded-md border flex flex-col items-center text-center transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                    : status === 'active'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-400/50 animate-pulse'
                    : status === 'error'
                    ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-500'
                }`}
              >
                <div className="text-[9px] font-bold flex items-center justify-center">
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className="text-[9px] font-semibold truncate w-full">
                  {stg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. UNIFIED PROFILE & CREDENTIALS CARD */}
      <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Applicant Profile
          </span>
          <button
            onClick={() => onSwitchTab('profiles')}
            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-0.5"
          >
            Manage Profiles <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {profiles.length > 0 ? (
          <select
            value={selectedProfile?.id || ''}
            onChange={(e) => onSelectProfile(e.target.value)}
            disabled={isRunning}
            className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-medium text-xs focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName} ({p.preferredCentre})
              </option>
            ))}
          </select>
        ) : (
          <div className="text-center py-2">
            <button
              onClick={() => onSwitchTab('profiles')}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs"
            >
              + Create Profile
            </button>
          </div>
        )}

        {selectedProfile && (
          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            {/* Quick Status Badges */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                <MapPin className="w-3 h-3 text-emerald-500" />
                {selectedProfile.preferredCentre}
              </span>

              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300">
                {selectedProfile.mobileNumber}
              </span>

              {/* Document Readiness Pill */}
              <button
                type="button"
                onClick={() => onSwitchTab('documents')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${
                  hasRequiredDocs
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400 hover:bg-emerald-900/60'
                    : 'bg-rose-950/60 border-rose-800/60 text-rose-300 hover:bg-rose-900/60 animate-pulse'
                }`}
                title="Manage PDFs"
              >
                {hasRequiredDocs ? (
                  <>
                    <FileCheck className="w-3 h-3 text-emerald-400" />
                    <span>{1 + additionalDocs.length} PDFs Ready</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3 h-3 text-rose-400" />
                    <span>Upload PDF</span>
                  </>
                )}
              </button>

              {/* Credential Status Pill */}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${
                  isUnlocked
                    ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-400'
                    : hasEncryptedCreds
                    ? 'bg-amber-950/60 border-amber-800/60 text-amber-300'
                    : 'bg-rose-950/60 border-rose-800/60 text-rose-400'
                }`}
              >
                {isUnlocked ? (
                  <>
                    <Unlock className="w-3 h-3 text-emerald-400" />
                    <span>Unlocked</span>
                  </>
                ) : hasEncryptedCreds ? (
                  <>
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>PIN Needed</span>
                  </>
                ) : (
                  <span>No Password</span>
                )}
              </span>
            </div>

            {/* Inline Master PIN Unlock Form (Shown only if locked) */}
            {!isUnlocked && hasEncryptedCreds && (
              <form onSubmit={handleUnlock} className="flex items-center gap-1.5 pt-1">
                <div className="relative flex-1">
                  <input
                    type="password"
                    value={masterPin}
                    onChange={(e) => setMasterPin(e.target.value)}
                    placeholder="Enter Master PIN to unlock"
                    className="w-full pl-7 pr-2 py-1 bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <KeyRound className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                </div>
                <button
                  type="submit"
                  disabled={isUnlocking}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  {isUnlocking ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                  <span>Unlock</span>
                </button>
                {unlockError && (
                  <span className="text-[10px] text-rose-400 shrink-0">{unlockError}</span>
                )}
              </form>
            )}
          </div>
        )}
      </div>

      {/* 3. CONTEXTUAL OTP CARD (Shown ONLY when OTP screen is detected) */}
      {isAwaitingOtp && (
        <div className="p-3 bg-emerald-950/50 border-2 border-emerald-500/80 rounded-xl space-y-2 shadow-floating animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-300 text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Enter SMS OTP
            </span>
            <span className="text-[10px] text-emerald-400 font-mono">
              {selectedProfile?.mobileNumber}
            </span>
          </div>

          <form onSubmit={handleOtpSubmit} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={otpInput}
                onChange={(e) => {
                  setOtpInput(e.target.value.replace(/\D/g, ''));
                  setOtpLocalError(null);
                }}
                placeholder="4-6 digit code"
                autoFocus
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-emerald-500 rounded-lg text-slate-100 font-mono text-center tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                type="submit"
                disabled={isSubmittingOtp || !otpInput.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                {isSubmittingOtp ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify OTP</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {(otpLocalError || workflowSession.otpState.errorMessage) && (
              <p className="text-[10px] text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{otpLocalError || workflowSession.otpState.errorMessage}</span>
              </p>
            )}
          </form>
        </div>
      )}

      {/* 4. CONTEXTUAL CAPTCHA ALERT (Shown ONLY when waiting for CAPTCHA) */}
      {isAwaitingCaptcha && (
        <div className="p-2.5 bg-amber-950/60 border border-amber-600/80 rounded-xl flex items-center gap-2 text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[11px] leading-tight flex-1">
            Credentials filled. <strong>Solve the CAPTCHA</strong> and click Login on the page.
          </p>
        </div>
      )}

      {/* 5. CONTEXTUAL PAYMENT ALERT (Shown ONLY on Payment) */}
      {workflowSession.state === 'PAYMENT_HANDOFF' && (
        <div className="p-2.5 bg-blue-950/60 border border-blue-600/80 rounded-xl flex items-center gap-2 text-blue-200">
          <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-[11px] leading-tight flex-1">
            Payment gateway reached. Please complete payment manually on the official IVAC site.
          </p>
        </div>
      )}

      {/* 6. PRIMARY WORKFLOW ACTION BUTTON & LIVE STATUS */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          {!isRunning && !isPaused ? (
            <button
              onClick={onStartWorkflow}
              disabled={!isProfileReady}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-sm transition-all transform active:scale-98"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Start Assistant</span>
            </button>
          ) : isPaused ? (
            <button
              onClick={onResumeWorkflow}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm transition-all"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Resume Flow</span>
            </button>
          ) : (
            <button
              onClick={onPauseWorkflow}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 bg-amber-700 hover:bg-amber-600 text-white font-semibold rounded-lg shadow-sm transition-all"
            >
              <Pause className="w-4 h-4" />
              <span>Pause</span>
            </button>
          )}

          {(isRunning || isPaused) && (
            <button
              onClick={onStopWorkflow}
              className="px-3 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-semibold rounded-lg transition-colors"
              title="Stop Automation"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          )}
        </div>

        {/* Clear, single-line disabled reason or recent event pill */}
        {!isRunning && disabledReason ? (
          <p className="text-[10px] text-amber-400/90 text-center font-medium">
            {disabledReason}
          </p>
        ) : latestLog ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/70 border border-slate-800 text-[10px] text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                latestLog.type === 'error'
                  ? 'bg-rose-400'
                  : latestLog.type === 'warning'
                  ? 'bg-amber-400'
                  : latestLog.type === 'success'
                  ? 'bg-emerald-400'
                  : 'bg-slate-400'
              }`}
            />
            <span className="truncate">{latestLog.message}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};
