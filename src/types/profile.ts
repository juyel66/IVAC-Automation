export interface IvacProfile {
  id: string;
  displayName: string;
  applicantName?: string;
  mobileNumber: string;
  preferredCentre: string;
  // Encrypted IVAC password payload (AES-256-GCM + PBKDF2)
  // Plaintext password is NEVER stored persistently
  encryptedPassword?: string;
  passwordSalt?: string;
  passwordIv?: string;
  primaryDocumentId?: string;
  additionalDocumentIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ProfileFormData {
  displayName: string;
  applicantName?: string;
  mobileNumber: string;
  preferredCentre: string;
  // IVAC portal login password (required on creation)
  password: string;
  // Master Security PIN used to encrypt the IVAC password client-side
  masterPin: string;
  hasExistingPassword?: boolean;
}

export const SUPPORTED_IVAC_CENTRES = [
  'Dhaka',
  'Rajshahi',
  'Chittagong',
  'Sylhet',
  'Khulna',
  'Barishal',
  'Rangpur',
  'Mymensingh',
  'Cumilla',
  'Noakhali',
  'Brahmanbaria',
  'Bogura',
  'Thakurgaon',
  'Satkhira',
  'Jashore'
] as const;

export type IvacCentre = typeof SUPPORTED_IVAC_CENTRES[number];

export const MAX_ADDITIONAL_DOCUMENTS = 3;
export const MAX_TOTAL_DOCUMENTS = 4; // 1 primary + 3 additional
