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

export const OFFICIAL_IVAC_CENTRES = [
  'IVAC, Dhaka (JFP)',
  'IVAC, Rajshahi',
  'IVAC, Chittagong',
  'IVAC, Sylhet',
  'IVAC, Khulna',
  'IVAC, Barishal',
  'IVAC, Rangpur',
  'IVAC, Mymensingh',
  'IVAC, Cumilla',
  'IVAC, Noakhali',
  'IVAC, Brahmanbaria',
  'IVAC, Bogura',
  'IVAC, Thakurgaon',
  'IVAC, Satkhira',
  'IVAC, Jashore',
  'IVAC, Kushtia'
] as const;

export type OfficialIvacCentre = typeof OFFICIAL_IVAC_CENTRES[number];

export const IVAC_CENTRE_TO_MISSION: Record<string, string> = {
  'IVAC, Dhaka (JFP)': 'Dhaka',
  'IVAC, Rajshahi': 'Rajshahi',
  'IVAC, Chittagong': 'Chittagong',
  'IVAC, Sylhet': 'Sylhet',
  'IVAC, Khulna': 'Khulna',
  'IVAC, Barishal': 'Dhaka',
  'IVAC, Rangpur': 'Rajshahi',
  'IVAC, Mymensingh': 'Dhaka',
  'IVAC, Cumilla': 'Dhaka',
  'IVAC, Noakhali': 'Dhaka',
  'IVAC, Brahmanbaria': 'Dhaka',
  'IVAC, Bogura': 'Rajshahi',
  'IVAC, Thakurgaon': 'Rajshahi',
  'IVAC, Satkhira': 'Khulna',
  'IVAC, Jashore': 'Khulna',
  'IVAC, Kushtia': 'Khulna',
  'Dhaka': 'Dhaka',
  'Rajshahi': 'Rajshahi',
  'Chittagong': 'Chittagong',
  'Sylhet': 'Sylhet',
  'Khulna': 'Khulna',
  'Barishal': 'Dhaka',
  'Rangpur': 'Rajshahi',
  'Mymensingh': 'Dhaka',
  'Cumilla': 'Dhaka',
  'Noakhali': 'Dhaka',
  'Brahmanbaria': 'Dhaka',
  'Bogura': 'Rajshahi',
  'Thakurgaon': 'Rajshahi',
  'Satkhira': 'Khulna',
  'Jashore': 'Khulna',
  'Kushtia': 'Khulna'
};

export function getMissionForCentre(centre: string): string {
  if (!centre) return 'Dhaka';
  if (IVAC_CENTRE_TO_MISSION[centre]) {
    return IVAC_CENTRE_TO_MISSION[centre];
  }
  const lower = centre.toLowerCase();
  for (const [key, mission] of Object.entries(IVAC_CENTRE_TO_MISSION)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return mission;
    }
  }
  return 'Dhaka';
}

export const SUPPORTED_IVAC_CENTRES = [
  ...OFFICIAL_IVAC_CENTRES,
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
  'Jashore',
  'Kushtia'
] as const;

export type IvacCentre = typeof SUPPORTED_IVAC_CENTRES[number];

export const MAX_ADDITIONAL_DOCUMENTS = 3;
export const MAX_TOTAL_DOCUMENTS = 4; // 1 primary + 3 additional
