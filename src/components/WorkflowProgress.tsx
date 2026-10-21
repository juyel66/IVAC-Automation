import React from 'react';
import {
  CheckCircle2,
  ShieldAlert
} from 'lucide-react';
import { WorkflowSession } from '../types/workflow';
import { getCurrentStageIndex, getStageStatus } from '../utils/workflowProgressHelper';

interface WorkflowProgressProps {
  session: WorkflowSession;
}

const STAGES = [
  { id: 'LOGIN', label: 'Login Helper' },
  { id: 'AUTH', label: 'CAPTCHA & OTP' },
  { id: 'DOCS', label: 'PDF Uploads' },
  { id: 'CENTRE', label: 'Centre Select' },
  { id: 'SLOT', label: 'Slot Select' },
  { id: 'PAYMENT', label: 'Payment Handoff' },
];

const STAGE_ORDER: Record<string, number> = {
  LOGIN: 0,
  AUTH: 1,
  DOCS: 2,
  CENTRE: 3,
  SLOT: 4,
  PAYMENT: 5
};

export const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ session }) => {
  const currentStageIndex = getCurrentStageIndex(session);
  const getStageStatusForId = (stageId: string, idx: number): 'completed' | 'active' | 'pending' | 'error' => {
    const stageIndex = STAGE_ORDER[stageId] ?? idx;
    return getStageStatus(stageIndex, currentStageIndex, session.state);
  };

  return (
    <div className="space-y-3.5 text-xs">
      {/* Visual Pipeline Bar */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workflow Pipeline
        </h4>
        <div className="grid grid-cols-6 gap-1">
          {STAGES.map((stg, i) => {
            const status = getStageStatusForId(stg.id, i);
            return (
              <div key={stg.id} className="flex flex-col items-center text-center">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-all ${
                    status === 'completed'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : status === 'active'
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50 animate-pulse'
                      : status === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span
                  className={`text-[9px] leading-tight font-medium ${
                    status === 'active'
                      ? 'text-amber-300 font-semibold'
                      : status === 'completed'
                      ? 'text-emerald-400'
                      : 'text-slate-500'
                  }`}
                >
                  {stg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Note on Post Confirmation */}
      {session.state === 'POST_CONFIRMATION' && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-xs text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Workflow Completed up to Document Confirmation</span>
          </div>
          <p className="text-[11px] leading-relaxed text-emerald-200/90">
            All documents were uploaded and details confirmed via "Save & Continue". In accordance with the current scope, automation pauses at post-confirmation before appointment slot selection.
          </p>
        </div>
      )}

      {/* Security Note on Payment */}
      {session.state === 'PAYMENT_HANDOFF' && (
        <div className="p-3 bg-blue-950/60 border border-blue-800/80 rounded-xl text-blue-200 space-y-1">
          <div className="flex items-center gap-2 font-semibold text-xs text-blue-100">
            <ShieldAlert className="w-4 h-4 text-blue-400" />
            <span>Automated Flow Stopped for Payment</span>
          </div>
          <p className="text-[11px] leading-relaxed text-blue-200">
            You have reached the official payment gateway. Please review the appointment details and complete payment manually. The assistant will never touch payment forms.
          </p>
        </div>
      )}

      {/* Live Logs Stream */}
      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Activity Stream
          </h4>
          <span className="text-[10px] text-slate-500">
            {session.logs.length} events logged
          </span>
        </div>

        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[11px]">
          {session.logs.length === 0 ? (
            <p className="text-slate-500 text-center py-2">No events recorded yet</p>
          ) : (
            session.logs.map((log) => {
              const timeStr = new Date(log.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              });

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 p-1.5 rounded bg-slate-950/60 border border-slate-900"
                >
                  <span className="text-[10px] text-slate-500 font-mono shrink-0 mt-0.5">
                    {timeStr}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className={`break-words ${
                        log.type === 'error'
                          ? 'text-rose-400 font-medium'
                          : log.type === 'warning'
                          ? 'text-amber-300 font-medium'
                          : log.type === 'success'
                          ? 'text-emerald-400 font-medium'
                          : 'text-slate-300'
                      }`}
                    >
                      {log.message}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
