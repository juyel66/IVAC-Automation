import React from 'react';
import { Minus, X, GripHorizontal, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { WorkflowState } from '../types/workflow';

interface PanelHeaderProps {
  workflowState: WorkflowState;
  onMinimize: () => void;
  onClose: () => void;
  isLicenseActive?: boolean;
  daysRemaining?: number;
  onOpenLicense?: () => void;
}

export const PanelHeader: React.FC<PanelHeaderProps> = ({
  workflowState,
  onMinimize,
  onClose,
  isLicenseActive,
  daysRemaining,
  onOpenLicense,
}) => {
  const getStatusBadge = () => {
    switch (workflowState) {
      case 'IDLE':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">Idle</span>;
      case 'LOGIN_READY':
      case 'LOGIN_SUBMISSION_PENDING':
      case 'WAITING_FOR_CAPTCHA':
      case 'OTP_REQUEST_PENDING':
      case 'DOCUMENT_UPLOAD':
      case 'DOCUMENT_UPLOAD_VERIFICATION':
      case 'CENTRE_SELECTION':
      case 'APPOINTMENT_SELECTION':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Running
          </span>
        );
      case 'WAITING_FOR_OTP':
      case 'WAITING_FOR_USER_AUTHENTICATION':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            Awaiting OTP
          </span>
        );
      case 'OTP_SUBMISSION_PENDING':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Submitting OTP
          </span>
        );
      case 'AUTHENTICATION_PENDING':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Verifying Auth
          </span>
        );
      case 'WAITING_FOR_DOCUMENT_CONFIRMATION':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
            Confirm Ready
          </span>
        );
      case 'DETAILS_CONFIRMATION_MODAL':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-950 text-amber-300 border border-amber-800/60 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
            Review Modal
          </span>
        );
      case 'SAVE_AND_CONTINUE_PENDING':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Saving Details
          </span>
        );
      case 'POST_CONFIRMATION':
        return (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Confirmed
          </span>
        );
      case 'PAUSED':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-950 text-amber-300 border border-amber-800/60">Paused</span>;
      case 'PAYMENT_HANDOFF':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-950 text-blue-300 border border-blue-800/60">Payment Handoff</span>;
      case 'ERROR':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-rose-950 text-rose-300 border border-rose-800/60">Error</span>;
      case 'STOPPED':
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-400 border border-slate-700">Stopped</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">{workflowState}</span>;
    }
  };

  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 border-b border-slate-800/80 rounded-t-xl select-none drag-handle">
      <div className="flex items-center gap-2">
        <GripHorizontal className="w-4 h-4 text-slate-500 hover:text-slate-300 transition-colors" />
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-xs font-semibold tracking-wide text-slate-100">
            IVAC Booking Assistant
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onOpenLicense && (
          <button
            type="button"
            onClick={onOpenLicense}
            className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors ${
              isLicenseActive
                ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900'
                : 'bg-amber-950/80 text-amber-300 border-amber-800/80 hover:bg-amber-900 animate-pulse'
            }`}
            title="Click to view License & Subscription"
          >
            {isLicenseActive ? `PRO${daysRemaining !== undefined ? ` • ${daysRemaining}d` : ''}` : 'UNLICENSED'}
          </button>
        )}
        {getStatusBadge()}
        <button
          onClick={onMinimize}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          title="Minimize to Floating Button"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
          title="Close Assistant Panel"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
