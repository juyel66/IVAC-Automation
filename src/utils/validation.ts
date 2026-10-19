import {
  IvacProfile,
  ProfileFormData,
  SUPPORTED_IVAC_CENTRES,
  MAX_ADDITIONAL_DOCUMENTS
} from '../types/profile';
import { MAX_PDF_FILE_SIZE_BYTES } from '../types/document';

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates a Bangladeshi mobile phone number (e.g., 01712345678, +8801712345678, 8801712345678)
 */
export function isValidBdMobile(mobile: string): boolean {
  if (!mobile) return false;
  const cleanMobile = mobile.trim().replace(/[\s-]/g, '');
  // Matches 013-019 followed by 8 digits (total 11 digits), optionally prefixed by +88 or 88
  const bdMobileRegex = /^(?:\+?88)?01[3-9]\d{8}$/;
  return bdMobileRegex.test(cleanMobile);
}

/**
 * Standardizes BD mobile number to 11-digit 01XXXXXXXXX format
 */
export function normalizeBdMobile(mobile: string): string {
  const cleanMobile = mobile.trim().replace(/[\s-]/g, '');
  if (cleanMobile.startsWith('+88')) {
    return cleanMobile.slice(3);
  }
  if (cleanMobile.startsWith('88') && cleanMobile.length === 13) {
    return cleanMobile.slice(2);
  }
  return cleanMobile;
}

/**
 * Validates profile form data including required IVAC login password and Master PIN
 */
export function validateProfileForm(
  data: ProfileFormData,
  existingProfiles: IvacProfile[] = [],
  editingProfileId?: string
): ValidationResult {
  const errors: Record<string, string> = {};

  // 1. Display Name validation
  if (!data.displayName || data.displayName.trim().length < 2) {
    errors.displayName = 'Profile display name must be at least 2 characters.';
  } else if (data.displayName.trim().length > 50) {
    errors.displayName = 'Profile display name must not exceed 50 characters.';
  }

  // 2. Applicant Full Name (optional field, but if provided, must be valid)
  if (data.applicantName && data.applicantName.trim().length < 2) {
    errors.applicantName = 'Applicant full name must be at least 2 characters if provided.';
  }

  // 3. Mobile Number validation
  if (!data.mobileNumber || !data.mobileNumber.trim()) {
    errors.mobileNumber = 'IVAC mobile number is required.';
  } else if (!isValidBdMobile(data.mobileNumber)) {
    errors.mobileNumber = 'Please enter a valid 11-digit Bangladeshi mobile number (e.g., 01712345678).';
  }

  // 4. Preferred Centre validation
  if (!data.preferredCentre) {
    errors.preferredCentre = 'Preferred IVAC centre is required.';
  } else if (!SUPPORTED_IVAC_CENTRES.includes(data.preferredCentre as any)) {
    errors.preferredCentre = `Unsupported centre selected: ${data.preferredCentre}`;
  }

  // 5. IVAC Password validation
  // If creating new profile, password is required
  const isEditing = !!editingProfileId;
  const isPasswordEmpty = !data.password || !data.password.trim();

  if (!isEditing && isPasswordEmpty) {
    errors.password = 'IVAC password is required.';
  } else if (!isPasswordEmpty && data.password.trim().length < 4) {
    errors.password = 'IVAC password must be at least 4 characters.';
  }

  // 6. Master PIN validation (required if setting a password)
  const isSettingPassword = !isPasswordEmpty;
  if (isSettingPassword) {
    if (!data.masterPin || data.masterPin.trim().length < 4) {
      errors.masterPin = 'Master Security PIN must be at least 4 characters to encrypt the password.';
    }
  }

  // 7. Duplicate Profile Check
  const normalizedInputMobile = isValidBdMobile(data.mobileNumber) ? normalizeBdMobile(data.mobileNumber) : '';
  if (normalizedInputMobile) {
    const duplicate = existingProfiles.find(p => {
      if (editingProfileId && p.id === editingProfileId) return false;
      return normalizeBdMobile(p.mobileNumber) === normalizedInputMobile &&
             p.displayName.trim().toLowerCase() === data.displayName.trim().toLowerCase();
    });

    if (duplicate) {
      errors.displayName = 'A profile with this exact display name and mobile number already exists.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Validates OTP code format (typically 4 to 6 numeric digits on IVAC)
 */
export function validateOtpFormat(otp: string): { isValid: boolean; error?: string } {
  if (!otp || !otp.trim()) {
    return { isValid: false, error: 'OTP code is required.' };
  }

  const cleanOtp = otp.trim();
  const digitRegex = /^\d+$/;

  if (!digitRegex.test(cleanOtp)) {
    return { isValid: false, error: 'OTP must contain numbers only.' };
  }

  if (cleanOtp.length < 4 || cleanOtp.length > 8) {
    return { isValid: false, error: 'OTP must be between 4 and 8 digits (typically 4 or 6).' };
  }

  return { isValid: true };
}

/**
 * Validates a PDF file before upload and persistence
 */
export function validatePdfFile(file: File): { isValid: boolean; error?: string } {
  if (!file) {
    return { isValid: false, error: 'No file was provided.' };
  }

  const isPdfMime = file.type === 'application/pdf';
  const isPdfExt = file.name.toLowerCase().endsWith('.pdf');

  if (!isPdfMime && !isPdfExt) {
    return {
      isValid: false,
      error: `Invalid file type "${file.type || 'unknown'}". Only PDF documents are supported.`
    };
  }

  if (file.size === 0) {
    return { isValid: false, error: 'The selected PDF file is empty (0 bytes).' };
  }

  if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const maxMb = (MAX_PDF_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(0);
    return {
      isValid: false,
      error: `File size (${sizeMb} MB) exceeds maximum allowed size of ${maxMb} MB.`
    };
  }

  return { isValid: true };
}

/**
 * Validates document limits for a profile
 */
export function validateDocumentAddition(
  isPrimary: boolean,
  existingPrimaryDocId?: string,
  existingAdditionalDocCount: number = 0
): { canAdd: boolean; error?: string } {
  if (isPrimary && existingPrimaryDocId) {
    return {
      canAdd: true
    };
  }

  if (!isPrimary && existingAdditionalDocCount >= MAX_ADDITIONAL_DOCUMENTS) {
    return {
      canAdd: false,
      error: `Maximum of ${MAX_ADDITIONAL_DOCUMENTS} additional applicants allowed (total 4 applicants).`
    };
  }

  return { canAdd: true };
}

/**
 * Format bytes into human readable format (KB / MB)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
