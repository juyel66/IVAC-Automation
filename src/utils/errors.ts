export class IvacAssistantError extends Error {
  public readonly code: string;
  public readonly userMessage: string;
  public readonly isFatal: boolean;

  constructor(code: string, userMessage: string, originalMessage?: string, isFatal: boolean = false) {
    super(originalMessage || userMessage);
    this.name = 'IvacAssistantError';
    this.code = code;
    this.userMessage = userMessage;
    this.isFatal = isFatal;
  }
}

export const ErrorCodes = {
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_INVALID: 'PROFILE_INVALID',
  PRIMARY_DOC_MISSING: 'PRIMARY_DOC_MISSING',
  DOC_SIZE_EXCEEDED: 'DOC_SIZE_EXCEEDED',
  DOC_INVALID_TYPE: 'DOC_INVALID_TYPE',
  DOC_LIMIT_EXCEEDED: 'DOC_LIMIT_EXCEEDED',
  IDB_STORAGE_FAILED: 'IDB_STORAGE_FAILED',
  PAGE_DETECTION_TIMEOUT: 'PAGE_DETECTION_TIMEOUT',
  LOGIN_FIELD_NOT_FOUND: 'LOGIN_FIELD_NOT_FOUND',
  AUTHENTICATION_PENDING: 'AUTHENTICATION_PENDING',
  UPLOAD_INPUT_NOT_FOUND: 'UPLOAD_INPUT_NOT_FOUND',
  CENTRE_NOT_AVAILABLE: 'CENTRE_NOT_AVAILABLE',
  NO_SLOTS_AVAILABLE: 'NO_SLOTS_AVAILABLE',
  PAYMENT_HANDOFF_REQUIRED: 'PAYMENT_HANDOFF_REQUIRED',
} as const;

export function formatErrorMessage(error: unknown): string {
  if (error instanceof IvacAssistantError) {
    return error.userMessage;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'An unexpected error occurred. Please try again.';
}
