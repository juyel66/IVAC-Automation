import { WorkflowSession, WorkflowState, IvacPageType } from '../types/workflow';
import { ivacPageDetector } from '../content/pageDetector';

export const STAGES = [
  { id: 'LOGIN', label: 'Login' },
  { id: 'AUTH', label: 'OTP' },
  { id: 'DOCS', label: 'Docs' },
  { id: 'CENTRE', label: 'Centre' },
  { id: 'SLOT', label: 'Slot' },
  { id: 'PAYMENT', label: 'Pay' },
] as const;

export type StageId = typeof STAGES[number]['id'];

export const STAGE_NAME_MAP: Record<number, string> = {
  0: 'Login',
  1: 'OTP',
  2: 'Documents',
  3: 'Centre',
  4: 'Slot',
  5: 'Payment'
};

/**
 * Returns current active stage index (0: Login, 1: OTP, 2: Docs, 3: Centre, 4: Slot, 5: Pay, 6: All Completed).
 * Resolves ground truth by inspecting active window URL pathname, detected portal page, and workflow session state.
 */
export function getCurrentStageIndex(
  session: Pick<WorkflowSession, 'state' | 'detectedPage'>,
  currentPathname?: string
): number {
  const pathname = (
    currentPathname !== undefined
      ? currentPathname
      : typeof window !== 'undefined'
      ? window.location.pathname || ''
      : ''
  ).toLowerCase();

  const detected: IvacPageType =
    session.detectedPage && session.detectedPage !== 'UNKNOWN'
      ? session.detectedPage
      : typeof window !== 'undefined'
      ? ivacPageDetector.detect().pageType
      : 'UNKNOWN';

  // 1. All completed
  if (session.state === 'COMPLETED') {
    return 6;
  }

  // 2. Step 6: Payment (index 5)
  if (
    pathname.includes('/payment') ||
    pathname.includes('/pay') ||
    detected === 'PAYMENT' ||
    session.state === 'PAYMENT_HANDOFF'
  ) {
    return 5;
  }

  // 3. Step 5: Slot Selection (index 4)
  if (
    pathname.includes('/time-slot') ||
    (pathname.includes('/slot') && !pathname.includes('/file-upload') && !pathname.includes('/mission')) ||
    detected === 'APPOINTMENT_CALENDAR' ||
    session.state === 'APPOINTMENT_SELECTION'
  ) {
    return 4;
  }

  // 4. Step 4: Centre Selection (index 3)
  if (
    pathname.includes('/mission') ||
    pathname.includes('/centre') ||
    pathname.includes('/center') ||
    detected === 'CENTRE_SELECTION' ||
    session.state === 'CENTRE_SELECTION'
  ) {
    return 3;
  }

  // 5. Step 3: Document Upload (index 2)
  if (
    pathname.includes('/file-upload') ||
    pathname.includes('/document') ||
    pathname.includes('/upload') ||
    detected === 'DOCUMENT_UPLOAD' ||
    [
      'DOCUMENT_UPLOAD',
      'DOCUMENT_UPLOAD_VERIFICATION',
      'WAITING_FOR_DOCUMENT_CONFIRMATION',
      'DETAILS_CONFIRMATION_MODAL',
      'SAVE_AND_CONTINUE_PENDING',
      'POST_CONFIRMATION'
    ].includes(session.state)
  ) {
    return 2;
  }

  // 6. Step 2: OTP Verification (index 1)
  // NOTE: WAITING_FOR_CAPTCHA is part of login (index 0), NOT OTP (index 1).
  if (
    pathname.includes('/otp') ||
    pathname.includes('/verify') ||
    detected === 'OTP_VERIFICATION' ||
    [
      'OTP_REQUEST_PENDING',
      'WAITING_FOR_OTP',
      'OTP_SUBMISSION_PENDING',
      'AUTHENTICATION_PENDING',
      'WAITING_FOR_USER_AUTHENTICATION'
    ].includes(session.state)
  ) {
    return 1;
  }

  // 7. Step 1: Login (index 0 - default fallback)
  return 0;
}

/**
 * Returns progress status for a given stage index (0 to 5):
 * - 'completed': genuinely passed stages (< currentStageIndex)
 * - 'active': current stage (= currentStageIndex)
 * - 'pending': future stages (> currentStageIndex)
 * - 'error': if current stage encounters error
 */
export function getStageStatus(
  stageIndex: number,
  currentStageIndex: number,
  sessionState: WorkflowState
): 'completed' | 'active' | 'pending' | 'error' {
  if (stageIndex < currentStageIndex) {
    return 'completed';
  }

  if (stageIndex === currentStageIndex) {
    if (sessionState === 'ERROR') {
      return 'error';
    }
    return 'active';
  }

  return 'pending';
}

/**
 * Generates user-friendly summary text for the current stage badge.
 */
export function getStageSummaryText(
  session: Pick<WorkflowSession, 'state' | 'detectedPage' | 'otpState'>,
  currentStageIndex: number
): string {
  const stgNum = Math.min(currentStageIndex + 1, 6);
  const stageName = STAGE_NAME_MAP[Math.min(currentStageIndex, 5)] || 'Login';

  if (session.state === 'COMPLETED') {
    return '6/6: All Completed';
  }

  if (session.state === 'PAUSED') {
    return `Paused at ${stageName}`;
  }

  if (session.state === 'STOPPED') {
    return `${stgNum}/6: ${stageName} (Stopped)`;
  }

  if (session.state === 'IDLE' || session.state === 'PROFILE_SELECTED') {
    return `${stgNum}/6: Ready at ${stageName}`;
  }

  if (session.state === 'ERROR') {
    return `${stgNum}/6: Action Required (${stageName})`;
  }

  // Actively running states
  switch (session.state) {
    case 'LOGIN_READY':
      return '1/6: Filling Login Form';
    case 'LOGIN_SUBMISSION_PENDING':
      return '1/6: Submitting Sign In...';
    case 'WAITING_FOR_CAPTCHA':
      return '1/6: Verifying Turnstile...';
    case 'OTP_REQUEST_PENDING':
      return '2/6: Requesting OTP...';
    case 'WAITING_FOR_OTP':
      return '2/6: Enter SMS OTP';
    case 'OTP_SUBMISSION_PENDING':
      return '2/6: Submitting OTP...';
    case 'AUTHENTICATION_PENDING':
      return '2/6: Verifying Auth...';
    case 'WAITING_FOR_USER_AUTHENTICATION':
      return session.otpState?.isRequired ? '2/6: Enter SMS OTP' : '2/6: Verifying Auth...';
    case 'DOCUMENT_UPLOAD':
      return '3/6: Uploading Documents';
    case 'DOCUMENT_UPLOAD_VERIFICATION':
      return '3/6: Verifying Uploads';
    case 'WAITING_FOR_DOCUMENT_CONFIRMATION':
      return '3/6: Ready to Confirm';
    case 'DETAILS_CONFIRMATION_MODAL':
      return '3/6: Modal Details Review';
    case 'SAVE_AND_CONTINUE_PENDING':
      return '3/6: Saving Details...';
    case 'POST_CONFIRMATION':
      return '3/6: Documents Confirmed';
    case 'CENTRE_SELECTION':
      return '4/6: Selecting Centre';
    case 'APPOINTMENT_SELECTION':
      return '5/6: Selecting Slot';
    case 'PAYMENT_HANDOFF':
      return '6/6: Payment Handoff (Manual)';
    default:
      return `${stgNum}/6: ${stageName}`;
  }
}
