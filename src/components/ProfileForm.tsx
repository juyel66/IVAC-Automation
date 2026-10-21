import React, { useState } from 'react';
import { Save, X, AlertTriangle, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { IvacProfile, ProfileFormData, SUPPORTED_IVAC_CENTRES, OFFICIAL_IVAC_CENTRES } from '../types/profile';
import { validateProfileForm } from '../utils/validation';

interface ProfileFormProps {
  initialProfile?: IvacProfile | null;
  existingProfiles: IvacProfile[];
  onSave: (data: ProfileFormData, profileId?: string) => Promise<void>;
  onCancel: () => void;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  initialProfile,
  existingProfiles,
  onSave,
  onCancel,
}) => {
  const hasExistingPassword = !!(initialProfile?.encryptedPassword);

  const [formData, setFormData] = useState<ProfileFormData>({
    displayName: initialProfile?.displayName || '',
    applicantName: initialProfile?.applicantName || '',
    mobileNumber: initialProfile?.mobileNumber || '',
    preferredCentre: initialProfile?.preferredCentre || 'IVAC, Dhaka (JFP)',
    password: '',
    masterPin: '',
    hasExistingPassword
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showMasterPin, setShowMasterPin] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: keyof ProfileFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateProfileForm(
      formData,
      existingProfiles,
      initialProfile ? initialProfile.id : undefined
    );

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave(formData, initialProfile?.id);
    } catch (err: any) {
      setErrors({ form: err.message || 'Failed to save profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <h3 className="font-semibold text-slate-100 text-sm">
          {initialProfile ? 'Edit Profile' : 'Create New Profile'}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 text-slate-400 hover:text-slate-200 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {errors.form && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      {/* Profile Display Name */}
      <div>
        <label className="block font-medium text-slate-200 mb-1">
          Profile Display Name <span className="text-emerald-400">*</span>
          <span className="text-[10px] text-slate-400 font-normal ml-1">
            (Internal label, e.g. "Family Trip - Rajshahi")
          </span>
        </label>
        <input
          type="text"
          value={formData.displayName}
          onChange={(e) => handleChange('displayName', e.target.value)}
          placeholder="e.g., Summer Visit 2026"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        {errors.displayName && (
          <p className="mt-1 text-[11px] text-rose-400">{errors.displayName}</p>
        )}
      </div>

      {/* Applicant Legal Name */}
      <div>
        <label className="block font-medium text-slate-200 mb-1">
          Applicant Full Legal Name
          <span className="text-[10px] text-slate-400 font-normal ml-1">
            (As per Passport, optional)
          </span>
        </label>
        <input
          type="text"
          value={formData.applicantName || ''}
          onChange={(e) => handleChange('applicantName', e.target.value)}
          placeholder="e.g., Mohammad Rahman"
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
        />
        {errors.applicantName && (
          <p className="mt-1 text-[11px] text-rose-400">{errors.applicantName}</p>
        )}
      </div>

      {/* Mobile Number & IVAC Password Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Mobile Number */}
        <div>
          <label className="block font-medium text-slate-200 mb-1">
            IVAC Mobile Number <span className="text-emerald-400">*</span>
          </label>
          <input
            type="tel"
            value={formData.mobileNumber}
            onChange={(e) => handleChange('mobileNumber', e.target.value)}
            placeholder="01712345678"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
          {errors.mobileNumber && (
            <p className="mt-1 text-[11px] text-rose-400">{errors.mobileNumber}</p>
          )}
        </div>

        {/* IVAC Account Password */}
        <div>
          <label className="block font-medium text-slate-200 mb-1">
            IVAC Password {!hasExistingPassword && <span className="text-emerald-400">*</span>}
            {hasExistingPassword && (
              <span className="text-[10px] text-slate-400 font-normal ml-1">
                (Leave blank to keep current)
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => handleChange('password', e.target.value)}
              placeholder={hasExistingPassword ? '•••••••• (encrypted)' : 'Enter IVAC password'}
              autoComplete="new-password"
              className="w-full pl-3 pr-8 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-[11px] text-rose-400">{errors.password}</p>
          )}
        </div>
      </div>

      {/* Master Security PIN / Passphrase */}
      <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-lg space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="font-medium text-slate-200 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Master Security PIN / Key</span>
            {(!hasExistingPassword || formData.password) && (
              <span className="text-emerald-400">*</span>
            )}
          </label>
          <span className="text-[10px] text-slate-400 font-mono">AES-256-GCM</span>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          Your IVAC password is encrypted client-side using this Master PIN. The PIN is <strong>never saved to disk</strong>.
        </p>
        <div className="relative">
          <input
            type={showMasterPin ? 'text' : 'password'}
            value={formData.masterPin}
            onChange={(e) => handleChange('masterPin', e.target.value)}
            placeholder="Set a 4-8 digit PIN or passphrase"
            className="w-full pl-8 pr-8 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 placeholder-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />
          <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <button
            type="button"
            onClick={() => setShowMasterPin(!showMasterPin)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
          >
            {showMasterPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        {errors.masterPin && (
          <p className="text-[11px] text-rose-400">{errors.masterPin}</p>
        )}
      </div>

      {/* Preferred Centre */}
      <div>
        <label className="block font-medium text-slate-200 mb-1">
          Preferred IVAC Centre <span className="text-emerald-400">*</span>
        </label>
        <select
          value={formData.preferredCentre}
          onChange={(e) => handleChange('preferredCentre', e.target.value)}
          className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
        >
          {OFFICIAL_IVAC_CENTRES.map((centre) => (
            <option key={centre} value={centre}>
              {centre}
            </option>
          ))}
          {/* Support legacy profile value if not in official list */}
          {!OFFICIAL_IVAC_CENTRES.includes(formData.preferredCentre as any) && (
            <option value={formData.preferredCentre}>{formData.preferredCentre}</option>
          )}
        </select>
        {errors.preferredCentre && (
          <p className="mt-1 text-[11px] text-rose-400">{errors.preferredCentre}</p>
        )}
      </div>

      {/* Form Action Buttons */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          <span>{isSubmitting ? 'Saving...' : 'Save Profile'}</span>
        </button>
      </div>
    </form>
  );
};
