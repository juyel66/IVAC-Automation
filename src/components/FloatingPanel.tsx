import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Activity,
  Settings as SettingsIcon
} from 'lucide-react';
import { PanelHeader } from './PanelHeader';
import { MinimizedButton } from './MinimizedButton';
import { Dashboard } from './Dashboard';
import { ProfileList } from './ProfileList';
import { ProfileForm } from './ProfileForm';
import { PdfUploader } from './PdfUploader';
import { WorkflowProgress } from './WorkflowProgress';
import { Settings } from './Settings';

import { IvacProfile, ProfileFormData } from '../types/profile';
import { DocumentMetadata } from '../types/document';
import { WorkflowSession } from '../types/workflow';
import { ExtensionSettings, settingsRepository } from '../storage/settingsRepository';
import { profileRepository } from '../storage/profileRepository';
import { documentRepository } from '../storage/documentRepository';
import { workflowEngine } from '../features/workflow/workflowEngine';
import { loginAdapter } from '../content/adapters/loginAdapter';
import { encryptPassword } from '../utils/crypto';
import { credentialManager } from '../features/security/credentialManager';

type ActiveTab = 'dashboard' | 'profiles' | 'documents' | 'workflow' | 'settings';

export const FloatingPanel: React.FC = () => {
  // UI & Persistence States
  const [settings, setSettings] = useState<ExtensionSettings>({
    panelPosition: { x: 24, y: 24 },
    isMinimized: false,
    isClosed: false,
    autoFillEnabled: true,
    soundAlertsEnabled: true,
    stayWithinViewport: true
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [profiles, setProfiles] = useState<IvacProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [editingProfile, setEditingProfile] = useState<IvacProfile | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [workflowSession, setWorkflowSession] = useState<WorkflowSession>(workflowEngine.getSession());

  // Dragging States
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Load initial settings and profiles
  useEffect(() => {
    async function loadInitialData() {
      const storedSettings = await settingsRepository.getSettings();
      setSettings(storedSettings);

      const allProfiles = await profileRepository.getAllProfiles();
      setProfiles(allProfiles);

      const currentSelectedId = await profileRepository.getSelectedProfileId();
      if (currentSelectedId && allProfiles.some((p) => p.id === currentSelectedId)) {
        setSelectedProfileId(currentSelectedId);
      } else if (allProfiles.length > 0) {
        setSelectedProfileId(allProfiles[0].id);
        await profileRepository.setSelectedProfileId(allProfiles[0].id);
      }

      // Automatically dismiss any notice/advisory modals on page load
      loginAdapter.dismissNoticePopups();

      // Check if auto-start was pending across page navigation
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          const autoStartId = window.sessionStorage.getItem('ivac_auto_start_profile');
          const autoStartTs = parseInt(window.sessionStorage.getItem('ivac_auto_start_ts') || '0', 10);
          if (autoStartId && Date.now() - autoStartTs < 180000) {
            const targetProf = allProfiles.find((p) => p.id === autoStartId);
            if (targetProf && credentialManager.isProfileUnlocked(targetProf.id)) {
              setSelectedProfileId(targetProf.id);
              setTimeout(() => {
                workflowEngine.start(targetProf);
              }, 400);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    loadInitialData();

    // Subscribe to workflow changes
    const unsubscribeWorkflow = workflowEngine.subscribe((sess) => {
      setWorkflowSession(sess);
    });

    return () => {
      unsubscribeWorkflow();
    };
  }, []);

  // Reload documents when selected profile changes
  useEffect(() => {
    async function loadDocuments() {
      if (!selectedProfileId) {
        setDocuments([]);
        return;
      }
      const docs = await documentRepository.getDocumentsByProfileId(selectedProfileId);
      setDocuments(docs);
    }
    loadDocuments();
  }, [selectedProfileId]);

  // Handle Profile Selection
  const handleSelectProfile = async (id: string) => {
    setSelectedProfileId(id);
    await profileRepository.setSelectedProfileId(id);
    const selected = profiles.find((p) => p.id === id);
    if (selected) {
      workflowEngine.addLog('info', `Switched active profile to "${selected.displayName}"`);
    }
  };

  // Handle Profile Save (Create or Update)
  const handleSaveProfile = async (formData: ProfileFormData, profileId?: string) => {
    const now = Date.now();
    let targetProfile: IvacProfile;
    let encryptedCreds: { ciphertext: string; salt: string; iv: string } | null = null;

    if (formData.password && formData.masterPin) {
      encryptedCreds = await encryptPassword(formData.password, formData.masterPin);
    }

    if (profileId) {
      const existing = profiles.find((p) => p.id === profileId);
      targetProfile = {
        id: profileId,
        displayName: formData.displayName.trim(),
        applicantName: formData.applicantName?.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim(),
        preferredCentre: formData.preferredCentre,
        encryptedPassword: encryptedCreds ? encryptedCreds.ciphertext : existing?.encryptedPassword,
        passwordSalt: encryptedCreds ? encryptedCreds.salt : existing?.passwordSalt,
        passwordIv: encryptedCreds ? encryptedCreds.iv : existing?.passwordIv,
        primaryDocumentId: existing?.primaryDocumentId,
        additionalDocumentIds: existing?.additionalDocumentIds || [],
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };
    } else {
      const newId = `profile_${now}_${Math.random().toString(36).substring(2, 6)}`;
      targetProfile = {
        id: newId,
        displayName: formData.displayName.trim(),
        applicantName: formData.applicantName?.trim() || undefined,
        mobileNumber: formData.mobileNumber.trim(),
        preferredCentre: formData.preferredCentre,
        encryptedPassword: encryptedCreds?.ciphertext,
        passwordSalt: encryptedCreds?.salt,
        passwordIv: encryptedCreds?.iv,
        additionalDocumentIds: [],
        createdAt: now,
        updatedAt: now
      };
    }

    // Cache unlocked password in memory for active session
    if (formData.password) {
      credentialManager.setUnlockedPassword(targetProfile.id, formData.password);
    }

    await profileRepository.saveProfile(targetProfile);
    const updatedProfiles = await profileRepository.getAllProfiles();
    setProfiles(updatedProfiles);
    setSelectedProfileId(targetProfile.id);

    setIsCreatingProfile(false);
    setEditingProfile(null);
  };

  // Handle Master PIN unlock
  const handleUnlockProfile = async (pin: string) => {
    if (!selectedProfile) return { success: false, error: 'No profile selected.' };
    const res = await credentialManager.unlockWithPin(selectedProfile, pin);
    if (res.success) {
      workflowEngine.addLog('success', `Credentials unlocked for profile: "${selectedProfile.displayName}"`);
      // Trigger re-render
      setProfiles([...profiles]);
    }
    return res;
  };

  // Handle OTP Verification submission from assistant
  const handleVerifyOtp = async (otp: string) => {
    return await workflowEngine.submitOtpVerification(otp);
  };

  // Handle Continue / Request OTP after CAPTCHA
  const handleRequestOtp = async () => {
    return await workflowEngine.requestOtpAfterCaptcha();
  };

  // Handle "Confirm All Information is Correct"
  const handleConfirmDocuments = async () => {
    return await workflowEngine.confirmDocumentInformation();
  };

  // Handle "Save & Continue"
  const handleSaveAndContinue = async () => {
    return await workflowEngine.saveAndContinueConfirmation();
  };

  // Handle Profile Delete
  const handleDeleteProfile = async (id: string) => {
    credentialManager.lockProfile(id);
    await profileRepository.deleteProfile(id);
    const updatedProfiles = await profileRepository.getAllProfiles();
    setProfiles(updatedProfiles);
    const currentSelected = await profileRepository.getSelectedProfileId();
    setSelectedProfileId(currentSelected);
  };

  // Handle Refreshing Documents
  const handleDocumentsUpdated = async () => {
    if (!selectedProfileId) return;
    const docs = await documentRepository.getDocumentsByProfileId(selectedProfileId);
    setDocuments(docs);

    // Sync profile document IDs
    const currentProf = profiles.find((p) => p.id === selectedProfileId);
    if (currentProf) {
      const primary = docs.find((d) => d.role === 'primary');
      const additionals = docs
        .filter((d) => d.role === 'additional')
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((d) => d.id);

      const updated = {
        ...currentProf,
        primaryDocumentId: primary ? primary.id : undefined,
        additionalDocumentIds: additionals
      };

      await profileRepository.saveProfile(updated);
      const allProfs = await profileRepository.getAllProfiles();
      setProfiles(allProfs);
    }
  };

  const handleUpdatePreferredCentre = async (centre: string) => {
    if (!selectedProfileId) return;
    const targetProfile = profiles.find((p) => p.id === selectedProfileId);
    if (!targetProfile) return;

    const updated: IvacProfile = {
      ...targetProfile,
      preferredCentre: centre,
      updatedAt: Date.now()
    };

    await profileRepository.saveProfile(updated);
    const allProfs = await profileRepository.getAllProfiles();
    setProfiles(allProfs);

    if (workflowEngine.getActiveProfile()?.id === updated.id) {
      workflowEngine.setActiveProfile(updated);
    }
  };

  // Window drag logic
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.drag-handle')) return;
    if (target.closest('button, select, input, a')) return;

    setIsDragging(true);
    const rect = panelRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      let newX = window.innerWidth - (e.clientX - dragOffsetRef.current.x) - (panelRef.current?.offsetWidth || 380);
      let newY = e.clientY - dragOffsetRef.current.y;

      // Keep within viewport if requested
      if (settings.stayWithinViewport) {
        const panelWidth = panelRef.current?.offsetWidth || 380;
        const panelHeight = panelRef.current?.offsetHeight || 520;

        newX = Math.max(12, Math.min(newX, window.innerWidth - panelWidth - 12));
        newY = Math.max(12, Math.min(newY, window.innerHeight - panelHeight - 12));
      }

      setSettings((prev) => ({
        ...prev,
        panelPosition: { x: newX, y: newY }
      }));
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        settingsRepository.saveSettings({ panelPosition: settings.panelPosition });
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, settings.panelPosition, settings.stayWithinViewport]);

  const handleMinimize = () => {
    const nextState = !settings.isMinimized;
    setSettings((prev) => ({ ...prev, isMinimized: nextState }));
    settingsRepository.saveSettings({ isMinimized: nextState });
  };

  const handleClose = () => {
    setSettings((prev) => ({ ...prev, isClosed: true }));
    settingsRepository.saveSettings({ isClosed: true });
  };

  const handleRestore = () => {
    setSettings((prev) => ({ ...prev, isMinimized: false, isClosed: false }));
    settingsRepository.saveSettings({ isMinimized: false, isClosed: false });
  };

  const handleResetPosition = () => {
    const defaultPos = { x: 24, y: 24 };
    setSettings((prev) => ({ ...prev, panelPosition: defaultPos }));
    settingsRepository.saveSettings({ panelPosition: defaultPos });
  };

  const selectedProfile = profiles.find((p) => p.id === selectedProfileId) || null;

  // Render minimized floating pill button
  if (settings.isClosed || settings.isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          top: `${Math.max(12, settings.panelPosition.y)}px`,
          right: `${Math.max(12, settings.panelPosition.x)}px`,
          zIndex: 2147483647
        }}
      >
        <MinimizedButton
          workflowState={workflowSession.state}
          onRestore={handleRestore}
        />
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        top: `${Math.max(12, settings.panelPosition.y)}px`,
        right: `${Math.max(12, settings.panelPosition.x)}px`,
        width: '380px',
        maxHeight: 'calc(100vh - 32px)',
        zIndex: 2147483647
      }}
      className="panel-glass text-slate-100 rounded-xl shadow-panel border border-slate-800/90 flex flex-col overflow-hidden font-sans text-xs transition-shadow duration-200"
    >
      {/* 1. Header with Status & Window Controls */}
      <PanelHeader
        workflowState={workflowSession.state}
        onMinimize={handleMinimize}
        onClose={handleClose}
      />

      {/* 2. Navigation Tabs */}
      <div className="flex items-center px-2 py-1.5 bg-slate-950/80 border-b border-slate-800/70 select-none">
        <button
          onClick={() => {
            setActiveTab('dashboard');
            setIsCreatingProfile(false);
            setEditingProfile(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-[11px] transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('profiles');
            setIsCreatingProfile(false);
            setEditingProfile(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-[11px] transition-colors ${
            activeTab === 'profiles'
              ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Profiles</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('documents');
            setIsCreatingProfile(false);
            setEditingProfile(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-[11px] transition-colors ${
            activeTab === 'documents'
              ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>PDFs</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('workflow');
            setIsCreatingProfile(false);
            setEditingProfile(null);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-medium text-[11px] transition-colors ${
            activeTab === 'workflow'
              ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Logs</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('settings');
            setIsCreatingProfile(false);
            setEditingProfile(null);
          }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg font-medium text-[11px] transition-colors ml-auto ${
            activeTab === 'settings'
              ? 'bg-slate-800 text-emerald-400 font-semibold shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Settings"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Tab Content Viewport */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[460px]">
        {activeTab === 'dashboard' && (
          <Dashboard
            selectedProfile={selectedProfile}
            profiles={profiles}
            documents={documents}
            workflowSession={workflowSession}
            onSelectProfile={handleSelectProfile}
            onStartWorkflow={() => {
              if (selectedProfile) {
                workflowEngine.start(selectedProfile);
              }
            }}
            onPauseWorkflow={() => workflowEngine.pause()}
            onResumeWorkflow={() => workflowEngine.resume()}
            onStopWorkflow={() => workflowEngine.stop()}
            onRequestOtp={handleRequestOtp}
            onVerifyOtp={handleVerifyOtp}
            onUnlockProfile={handleUnlockProfile}
            onConfirmDocuments={handleConfirmDocuments}
            onSaveAndContinue={handleSaveAndContinue}
            onUpdatePreferredCentre={handleUpdatePreferredCentre}
            onSwitchTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === 'profiles' && (
          <>
            {isCreatingProfile || editingProfile ? (
              <ProfileForm
                initialProfile={editingProfile}
                existingProfiles={profiles}
                onSave={handleSaveProfile}
                onCancel={() => {
                  setIsCreatingProfile(false);
                  setEditingProfile(null);
                }}
              />
            ) : (
              <ProfileList
                profiles={profiles}
                selectedProfileId={selectedProfileId}
                onSelectProfile={handleSelectProfile}
                onEditProfile={(prof) => {
                  setEditingProfile(prof);
                  setIsCreatingProfile(false);
                }}
                onDeleteProfile={handleDeleteProfile}
                onCreateNew={() => {
                  setIsCreatingProfile(true);
                  setEditingProfile(null);
                }}
              />
            )}
          </>
        )}

        {activeTab === 'documents' && (
          <div>
            {selectedProfile ? (
              <PdfUploader
                profileId={selectedProfile.id}
                documents={documents}
                onDocumentsUpdated={handleDocumentsUpdated}
                disabled={workflowSession.state === 'DOCUMENT_UPLOAD'}
              />
            ) : (
              <div className="text-center py-6 text-slate-400">
                Please select or create a profile first to manage applicant documents.
              </div>
            )}
          </div>
        )}

        {activeTab === 'workflow' && (
          <WorkflowProgress session={workflowSession} />
        )}

        {activeTab === 'settings' && (
          <Settings
            settings={settings}
            onUpdateSettings={async (updated) => {
              const res = await settingsRepository.saveSettings(updated);
              setSettings(res);
            }}
            onResetPosition={handleResetPosition}
            profilesCount={profiles.length}
            documentsCount={documents.length}
          />
        )}
      </div>
    </div>
  );
};
