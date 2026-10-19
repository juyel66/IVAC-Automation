import React from 'react';
import { ShieldCheck, Maximize2 } from 'lucide-react';
import { WorkflowState } from '../types/workflow';

interface MinimizedButtonProps {
  workflowState: WorkflowState;
  onRestore: () => void;
}

export const MinimizedButton: React.FC<MinimizedButtonProps> = ({
  workflowState,
  onRestore,
}) => {
  const isRunning = [
    'LOGIN_READY',
    'WAITING_FOR_USER_AUTHENTICATION',
    'DOCUMENT_UPLOAD',
    'CENTRE_SELECTION',
    'APPOINTMENT_SELECTION'
  ].includes(workflowState);

  return (
    <div
      onClick={onRestore}
      className="group flex items-center gap-2.5 px-3 py-2 bg-slate-900/95 hover:bg-slate-850 text-slate-100 border border-emerald-500/30 hover:border-emerald-500/70 rounded-full shadow-floating cursor-pointer transition-all duration-200 transform hover:scale-105 active:scale-95 select-none"
      title="Click to restore IVAC Booking Assistant"
    >
      <div className="relative">
        <div className="w-6 h-6 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm">
          <ShieldCheck className="w-3.5 h-3.5" />
        </div>
        {isRunning && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        )}
      </div>

      <div className="flex flex-col">
        <span className="text-xs font-semibold leading-tight text-slate-200 group-hover:text-white">
          IVAC Assistant
        </span>
        <span className="text-[10px] text-emerald-400 font-medium">
          {isRunning ? 'Active Workflow' : 'Click to Open'}
        </span>
      </div>

      <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 ml-1 transition-colors" />
    </div>
  );
};
