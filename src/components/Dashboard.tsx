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
  FileCheck,
  ChevronDown,
  Check,
  Globe
} from 'lucide-react';
import { IvacProfile, OFFICIAL_IVAC_CENTRES, getMissionForCentre } from '../types/profile';
import { DocumentMetadata } from '../types/document';
import { WorkflowSession, WorkflowState } from '../types/workflow';
import { credentialManager } from '../features/security/credentialManager';
import { centreAdapter, matchCentreOption } from '../content/adapters/centreAdapter';
import {
  STAGES,
  getCurrentStageIndex,
  getStageStatus,
  getStageSummaryText
} from '../utils/workflowProgressHelper';

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
  onRequestOtp: () => Promise<{ success: boolean; manualRequired?: boolean; message: string }>;
  onVerifyOtp: (otp: string) => Promise<{ success: boolean; message: string }>;
  onUnlockProfile: (masterPin: string) => Promise<{ success: boolean; error?: string }>;
  onConfirmDocuments?: () => Promise<{ success: boolean; isBlocked?: boolean; message: string }>;
  onSaveAndContinue?: () => Promise<{ success: boolean; message: string }>;
  onUpdatePreferredCentre?: (centre: string) => Promise<void>;
<<<<<<< HEAD
  onSwitchTab: (tab: 'profiles' | 'documents' | 'workflow' | 'license' | 'settings') => void;
  isLicenseActive?: boolean;
  licenseDaysRemaining?: number;
=======
  onSwitchTab: (tab: 'profiles' | 'documents' | 'workflow' | 'settings') => void;
  licenseState?: import('../types/license').ClientLicenseState | null;
  onOpenLicenseModal?: () => void;
>>>>>>> a72a1774e3f6927d0d5f9b883876b2bfcaf6d06c
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
  onConfirmDocuments,
  onSaveAndContinue,
  onUpdatePreferredCentre,
  onSwitchTab,
<<<<<<< HEAD
  isLicenseActive = true,
  licenseDaysRemaining,
=======
  licenseState,
  onOpenLicenseModal,
>>>>>>> a72a1774e3f6927d0d5f9b883876b2bfcaf6d06c
}) => {
  const [masterPin, setMasterPin] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const [otpInput, setOtpInput] = useState('');
  const [otpLocalError, setOtpLocalError] = useState<string | null>(null);
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);

  const [isConfirmingDocuments, setIsConfirmingDocuments] = useState(false);
  const [confirmDocError, setConfirmDocError] = useState<string | null>(null);

  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [saveConfirmError, setSaveConfirmError] = useState<string | null>(null);

  const [isCentreDropdownOpen, setIsCentreDropdownOpen] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState<{ message: string; isError?: boolean } | null>(null);

  const primaryDoc = documents.find((d) => d.role === 'primary');
  const additionalDocs = documents.filter((d) => d.role === 'additional');
  const hasRequiredDocs = !!primaryDoc;

  const isUnlocked = selectedProfile ? credentialManager.isProfileUnlocked(selectedProfile.id) : false;
  const hasEncryptedCreds = !!(selectedProfile?.encryptedPassword);
  const isLicenseActive = !licenseState || licenseState.status === 'ACTIVE';
  const isProfileReady = !!selectedProfile && hasRequiredDocs && isUnlocked && isLicenseActive;

  const currentMission = selectedProfile ? getMissionForCentre(selectedProfile.preferredCentre) : 'Dhaka';

  const handleCentreChange = async (centre: string) => {
    setIsCentreDropdownOpen(false);
    if (onUpdatePreferredCentre) {
      await onUpdatePreferredCentre(centre);
    }
    setSessionFeedback({ message: `Auto-fill IVAC Center set to: "${centre}"` });
    setTimeout(() => setSessionFeedback(null), 4000);
  };

  const handleLoadSessionCentres = () => {
    const sessionData = centreAdapter.detectSessionCentres();
    if (sessionData.centres.length > 0) {
      const detected = sessionData.centres[0];
      handleCentreChange(detected);
      setSessionFeedback({ message: `Loaded "${detected}" from active portal session!` });
    } else if (sessionData.mission) {
      const match = OFFICIAL_IVAC_CENTRES.find((c) => matchCentreOption(c, sessionData.mission!));
      if (match) {
        handleCentreChange(match);
        setSessionFeedback({ message: `Matched "${match}" for mission "${sessionData.mission}"!` });
      } else {
        setSessionFeedback({ message: `Mission "${sessionData.mission}" detected on portal.` });
      }
    } else {
      setSessionFeedback({
        message: 'Portal mission dropdown not detected on current page. Open mission page to load.',
        isError: true
      });
    }
    setTimeout(() => setSessionFeedback(null), 5000);
  };

  const isRunning = [
    'LOGIN_READY',
    'WAITING_FOR_CAPTCHA',
    'LOGIN_SUBMISSION_PENDING',
    'OTP_REQUEST_PENDING',
    'WAITING_FOR_OTP',
    'OTP_SUBMISSION_PENDING',
    'AUTHENTICATION_PENDING',
    'WAITING_FOR_USER_AUTHENTICATION',
    'DOCUMENT_UPLOAD',
    'DOCUMENT_UPLOAD_VERIFICATION',
    'WAITING_FOR_DOCUMENT_CONFIRMATION',
    'DETAILS_CONFIRMATION_MODAL',
    'SAVE_AND_CONTINUE_PENDING',
    'CENTRE_SELECTION',
    'APPOINTMENT_SELECTION'
  ].includes(workflowSession.state);

  const isPaused = workflowSession.state === 'PAUSED';
  const isAwaitingOtp =
    workflowSession.state === 'WAITING_FOR_OTP' ||
    workflowSession.state === 'OTP_SUBMISSION_PENDING' ||
    workflowSession.otpState.isRequired ||
    workflowSession.detectedPage === 'OTP_VERIFICATION';

  const isAuthenticating = workflowSession.state === 'AUTHENTICATION_PENDING';

  const handleConfirmDocumentsSubmit = async () => {
    if (!onConfirmDocuments) return;
    setConfirmDocError(null);
    setIsConfirmingDocuments(true);
    try {
      const res = await onConfirmDocuments();
      if (!res.success) {
        setConfirmDocError(res.message);
      }
    } catch (err: any) {
      setConfirmDocError(err.message || 'Failed to submit document confirmation.');
    } finally {
      setIsConfirmingDocuments(false);
    }
  };

  const handleSaveAndContinueSubmit = async () => {
    if (!onSaveAndContinue) return;
    setSaveConfirmError(null);
    setIsConfirmingSave(true);
    try {
      const res = await onSaveAndContinue();
      if (!res.success) {
        setSaveConfirmError(res.message);
      }
    } catch (err: any) {
      setSaveConfirmError(err.message || 'Failed to confirm details.');
    } finally {
      setIsConfirmingSave(false);
    }
  };

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

  const currentStageIndex = getCurrentStageIndex(workflowSession);
  const currentStageStatus = (stageIndex: number) =>
    getStageStatus(stageIndex, currentStageIndex, workflowSession.state);
  const currentStageSummary = getStageSummaryText(workflowSession, currentStageIndex);

  // Missing requirements helper text
  const getDisabledReason = (): string | null => {
    if (licenseState && licenseState.status !== 'ACTIVE') {
      return `License status is "${licenseState.status}". Active subscription required to start.`;
    }
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
<<<<<<< HEAD
      {/* 0. LICENSE REQUIRED / EXPIRED ALERT BANNER */}
      {!isLicenseActive && (
        <div className="p-2.5 bg-gradient-to-r from-amber-950/70 to-rose-950/60 border border-amber-500/70 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-[11px] text-amber-200 block">License Required</span>
              <p className="text-[10px] text-amber-300/80">Activate key or purchase pass to run automation.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSwitchTab('license')}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-[10px] shrink-0 transition-colors shadow-sm"
          >
            Activate
          </button>
=======
      {/* 0. LICENSE ENTITLEMENT BANNER */}
      {onOpenLicenseModal && (
        <div
          onClick={onOpenLicenseModal}
          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
            licenseState?.status === 'ACTIVE'
              ? 'bg-slate-900/90 border-emerald-500/30 hover:border-emerald-500/60'
              : 'bg-amber-950/40 border-amber-500/40 hover:border-amber-500/70'
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                licenseState?.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span className="font-bold text-white text-xs">
              {licenseState?.status === 'ACTIVE' ? 'Premium License Active' : 'License Activation Required'}
            </span>
            {licenseState?.status === 'ACTIVE' ? (
              <span className="text-[10px] text-emerald-400 font-mono">
                ({licenseState.daysRemaining} days left • {licenseState.activeInstallationsCount}/{licenseState.maxInstallations} slots)
              </span>
            ) : (
              <span className="text-[10px] text-amber-300 font-medium">
                ({licenseState?.status || 'UNLICENSED'} • Click to Activate)
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 hover:text-white font-medium flex items-center gap-0.5">
            <span>License</span>
            <ChevronRight className="w-3 h-3" />
          </span>
>>>>>>> a72a1774e3f6927d0d5f9b883876b2bfcaf6d06c
        </div>
      )}

      {/* 1. COMPACT INLINE PROGRESS BAR */}
      <div className="p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Booking Progress
          </span>
          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60">
            {currentStageSummary}
          </span>
        </div>

        {/* 6-Step Compact Horizontal Pipeline */}
        <div className="grid grid-cols-6 gap-1">
          {STAGES.map((stg, i) => {
            const status = currentStageStatus(i);
            const isCurrentlyRunning = isRunning && status === 'active';
            return (
              <div
                key={stg.id}
                className={`py-1 px-1 rounded-md border flex flex-col items-center text-center transition-all ${
                  status === 'completed'
                    ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-300'
                    : status === 'active'
                    ? isCurrentlyRunning
                      ? 'bg-amber-500/20 border-amber-500 text-amber-200 ring-1 ring-amber-400/50 animate-pulse'
                      : 'bg-amber-950/40 border-amber-500/80 text-amber-200 ring-1 ring-amber-500/30'
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

      {/* 2.5 BOOKING: MISSION & IVAC CENTER CARD */}
      {selectedProfile && (
        <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Booking
            </span>
            <span className="text-[10px] text-slate-400">Auto-fill on IVAC portal</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Mission Display */}
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                Mission
              </label>
              <div className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700/80 rounded-lg text-slate-200 font-medium text-xs flex items-center justify-between">
                <span>{currentMission}</span>
                <span className="text-[10px] text-slate-500 font-mono">Jurisdiction</span>
              </div>
            </div>

            {/* IVAC Center Dropdown */}
            <div className="relative">
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                IVAC Center
              </label>
              <button
                type="button"
                onClick={() => setIsCentreDropdownOpen(!isCentreDropdownOpen)}
                disabled={isRunning}
                className="w-full px-2.5 py-1.5 bg-slate-950 border border-emerald-500/80 hover:border-emerald-400 rounded-lg text-slate-100 font-medium text-xs flex items-center justify-between transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              >
                <span className="truncate">{selectedProfile.preferredCentre}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-emerald-400 transition-transform ${
                    isCentreDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Custom Dropdown Menu matching portal screenshot */}
              {isCentreDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsCentreDropdownOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-2xl border border-gray-200 max-h-60 overflow-y-auto py-1 text-slate-900 text-xs">
                    {OFFICIAL_IVAC_CENTRES.map((centre) => {
                      const isSelected =
                        centre === selectedProfile.preferredCentre ||
                        matchCentreOption(centre, selectedProfile.preferredCentre);
                      return (
                        <button
                          key={centre}
                          type="button"
                          onClick={() => handleCentreChange(centre)}
                          className={`w-full px-3 py-2 text-left transition-colors flex items-center justify-between ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-900 font-semibold'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <span>{centre}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Load Centers from Session Button */}
          <button
            type="button"
            onClick={handleLoadSessionCentres}
            disabled={isRunning}
            className="w-full py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-lg text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Globe className="w-3 h-3 text-emerald-400" />
            <span>Load Centers From Session</span>
          </button>

          {sessionFeedback && (
            <p
              className={`text-[10px] text-center ${
                sessionFeedback.isError ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {sessionFeedback.message}
            </p>
          )}
        </div>
      )}

      {/* 4. CONTEXTUAL OTP CARD (Shown ONLY when OTP screen is detected or required) */}
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
                  const val = e.target.value.replace(/\D/g, '');
                  setOtpInput(val);
                  setOtpLocalError(null);
                  if (val.length === 6 && !isSubmittingOtp && workflowSession.state !== 'OTP_SUBMISSION_PENDING') {
                    setTimeout(() => {
                      onVerifyOtp(val);
                    }, 50);
                  }
                }}
                placeholder="4-6 digit code"
                autoFocus
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-emerald-500 rounded-lg text-slate-100 font-mono text-center tracking-widest text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <button
                type="submit"
                disabled={
                  isSubmittingOtp ||
                  workflowSession.state === 'OTP_SUBMISSION_PENDING' ||
                  !otpInput.trim()
                }
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-semibold rounded-lg transition-all"
              >
                {isSubmittingOtp || workflowSession.state === 'OTP_SUBMISSION_PENDING' ? (
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

      {/* 5. AUTHENTICATION PENDING NOTIFICATION */}
      {isAuthenticating && (
        <div className="p-2.5 bg-emerald-950/60 border border-emerald-600/80 rounded-xl flex items-center gap-2 text-emerald-200 animate-pulse">
          <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
          <p className="text-[11px] leading-tight flex-1">
            Verifying authentication with IVAC portal...
          </p>
        </div>
      )}

      {/* 5.1 CONTEXTUAL DOCUMENT CONFIRMATION CARD */}
      {(workflowSession.state === 'WAITING_FOR_DOCUMENT_CONFIRMATION' ||
        workflowSession.state === 'DOCUMENT_UPLOAD_VERIFICATION') && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/70 rounded-xl space-y-2.5 shadow-floating animate-in fade-in duration-200">
          <div className="flex items-start gap-2 text-emerald-200">
            <FileCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-bold text-xs text-emerald-300 block">
                All Documents Uploaded & Verified
              </span>
              <p className="text-[11px] leading-tight text-emerald-200/90">
                Primary and additional applicant PDFs are attached. Ensure any website verification is satisfied, then confirm information.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmDocumentsSubmit}
            disabled={isConfirmingDocuments}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-lg shadow-sm transition-all"
          >
            {isConfirmingDocuments ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Confirming Information...</span>
              </>
            ) : (
              <>
                <span>Confirm All Information is Correct</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {(confirmDocError || workflowSession.errorMessage) && (
            <p className="text-[10px] text-amber-300 flex items-center gap-1 bg-amber-950/60 p-1.5 rounded border border-amber-800/60">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{confirmDocError || workflowSession.errorMessage}</span>
            </p>
          )}
        </div>
      )}

      {/* 5.2 MODAL DETAILS CONFIRMATION CARD */}
      {(workflowSession.state === 'DETAILS_CONFIRMATION_MODAL' ||
        workflowSession.state === 'SAVE_AND_CONTINUE_PENDING') && (
        <div className="p-3 bg-amber-950/40 border-2 border-amber-500 rounded-xl space-y-2.5 shadow-floating animate-in fade-in duration-200">
          <div className="flex items-start gap-2 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <span className="font-bold text-xs text-amber-300 block">
                {workflowSession.confirmationDetails?.heading || 'Please Confirm Your Details'}
              </span>
              <p className="text-[11px] leading-tight text-amber-200/90">
                {workflowSession.confirmationDetails?.description ||
                  'Make sure all the information is correct before saving and continuing.'}
              </p>
            </div>
          </div>

          <div className="p-2 bg-slate-950/60 rounded border border-amber-800/50 text-[10px] text-slate-300 space-y-1">
            <p className="text-amber-200 font-medium">Explicit Authorization Required:</p>
            <p>
              Please inspect the portal modal on your screen. The assistant will not click until you explicitly confirm.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveAndContinueSubmit}
            disabled={isConfirmingSave || workflowSession.state === 'SAVE_AND_CONTINUE_PENDING'}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 bg-[#f25822] hover:bg-[#ff6832] disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-lg shadow-md transition-all text-xs"
          >
            {isConfirmingSave || workflowSession.state === 'SAVE_AND_CONTINUE_PENDING' ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving & Continuing...</span>
              </>
            ) : (
              <>
                <span>Save & Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>

          {(saveConfirmError || workflowSession.errorMessage) && (
            <p className="text-[10px] text-rose-300 flex items-center gap-1 bg-rose-950/60 p-1.5 rounded border border-rose-800/60">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{saveConfirmError || workflowSession.errorMessage}</span>
            </p>
          )}
        </div>
      )}

      {/* 5.3 POST-CONFIRMATION COMPLETED CARD */}
      {workflowSession.state === 'POST_CONFIRMATION' && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-500 rounded-xl space-y-2 shadow-floating animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold text-xs text-emerald-300">
              Details Confirmed Successfully
            </span>
          </div>
          <p className="text-[11px] leading-tight text-emerald-200/90">
            Document upload and applicant details have been verified and confirmed with the IVAC portal.
          </p>
          <div className="pt-1 border-t border-emerald-800/60 flex items-center justify-between text-[10px] text-emerald-400">
            <span>Workflow stopped at document confirmation.</span>
            <span className="font-semibold px-2 py-0.5 rounded bg-emerald-900/60">Done</span>
          </div>
        </div>
      )}

      {/* 6. CONTEXTUAL PAYMENT ALERT (Shown ONLY on Payment) */}
      {workflowSession.state === 'PAYMENT_HANDOFF' && (
        <div className="p-2.5 bg-blue-950/60 border border-blue-600/80 rounded-xl flex items-center gap-2 text-blue-200">
          <ShieldAlert className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-[11px] leading-tight flex-1">
            Payment gateway reached. Please complete payment manually on the official IVAC site.
          </p>
        </div>
      )}

      {/* 7. PRIMARY WORKFLOW ACTION BUTTON & LIVE STATUS */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center gap-2">
          {!isRunning && !isPaused ? (
            <button
              onClick={isLicenseActive ? onStartWorkflow : () => onSwitchTab('license')}
              disabled={isLicenseActive && !isProfileReady}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 font-semibold rounded-lg shadow-sm transition-all transform active:scale-98 ${
                !isLicenseActive
                  ? 'bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold cursor-pointer'
                  : 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white'
              }`}
            >
              {!isLicenseActive ? (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Activate License to Start</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Assistant</span>
                </>
              )}
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
