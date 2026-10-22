export type LicenseClientStatus =
  | 'UNLICENSED'
  | 'PENDING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'SUSPENDED'
  | 'REVOKED';

export interface ClientLicenseState {
  licenseKey: string;
  licenseId: string;
  status: LicenseClientStatus;
  activatedAt: string | null;
  expiresAt: string | null;
  daysRemaining: number;
  maxInstallations: number;
  activeInstallationsCount: number;
  availableSlots: number;
  signature?: string;
  lastCheckedAt: number;
}

export interface PaymentInstructionsData {
  settings: {
    bkashNumber: string;
    nagadNumber: string;
    bankInstructions?: string | null;
    whatsappNumber: string;
    instructionText?: string | null;
  };
  plans: Array<{
    code: string;
    name: string;
    validityDays: number;
    maxInstallations: number;
    price: number;
    currency: string;
  }>;
}

export interface PaymentSubmissionInput {
  transactionId: string;
  paymentMethod: 'BKASH' | 'NAGAD' | 'ROCKET' | 'UPAY' | 'BANK';
  planCode: string;
  payerContact: string;
  licenseId?: string | null;
}
