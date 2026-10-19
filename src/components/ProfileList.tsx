import React, { useState } from 'react';
import {
  User,
  Plus,
  Edit2,
  Trash2,
  FileText,
  AlertCircle,
  MapPin
} from 'lucide-react';
import { IvacProfile } from '../types/profile';

interface ProfileListProps {
  profiles: IvacProfile[];
  selectedProfileId: string | null;
  onSelectProfile: (id: string) => void;
  onEditProfile: (profile: IvacProfile) => void;
  onDeleteProfile: (id: string) => void;
  onCreateNew: () => void;
}

export const ProfileList: React.FC<ProfileListProps> = ({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onEditProfile,
  onDeleteProfile,
  onCreateNew,
}) => {
  const [profileToDelete, setProfileToDelete] = useState<IvacProfile | null>(null);

  const confirmDelete = () => {
    if (profileToDelete) {
      onDeleteProfile(profileToDelete.id);
      setProfileToDelete(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Saved Profiles ({profiles.length})
        </h3>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Profile</span>
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-8 px-4 bg-slate-900/40 border border-slate-800 rounded-xl">
          <User className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-xs font-medium text-slate-300">No profiles created yet</p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-xs mx-auto">
            Create an applicant profile to save your IVAC mobile number, preferred centre, and applicant documents.
          </p>
          <button
            onClick={onCreateNew}
            className="mt-3 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Profile</span>
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {profiles.map((profile) => {
            const isSelected = profile.id === selectedProfileId;
            const hasPrimaryDoc = !!profile.primaryDocumentId;
            const additionalCount = profile.additionalDocumentIds?.length || 0;
            const totalDocs = (hasPrimaryDoc ? 1 : 0) + additionalCount;

            return (
              <div
                key={profile.id}
                className={`p-3 rounded-xl border transition-all ${
                  isSelected
                    ? 'bg-slate-900/90 border-emerald-500/60 shadow-sm'
                    : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-100 truncate">
                        {profile.displayName}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800/80 shrink-0">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                      <span>{profile.mobileNumber}</span>
                      <span className="flex items-center gap-1 text-slate-300">
                        <MapPin className="w-3 h-3 text-emerald-500" />
                        {profile.preferredCentre}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {totalDocs} / 4 PDFs
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!isSelected && (
                      <button
                        onClick={() => onSelectProfile(profile.id)}
                        className="px-2 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors"
                        title="Set as Active Profile"
                      >
                        Select
                      </button>
                    )}
                    <button
                      onClick={() => onEditProfile(profile)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setProfileToDelete(profile)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                      title="Delete Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {profileToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-w-xs w-full shadow-panel space-y-3">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h4 className="font-semibold text-xs text-slate-100">Delete Profile?</h4>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete profile <strong className="text-white">"{profileToDelete.displayName}"</strong>?
              All associated PDF documents in IndexedDB will also be deleted.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setProfileToDelete(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-500 rounded-lg"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
