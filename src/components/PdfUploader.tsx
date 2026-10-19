import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Plus,
  Loader2,
  FileCheck
} from 'lucide-react';
import { DocumentMetadata } from '../types/document';
import { MAX_ADDITIONAL_DOCUMENTS } from '../types/profile';
import { validatePdfFile, formatBytes } from '../utils/validation';
import { documentRepository } from '../storage/documentRepository';

interface PdfUploaderProps {
  profileId: string;
  documents: DocumentMetadata[];
  onDocumentsUpdated: () => void;
  disabled?: boolean;
}

export const PdfUploader: React.FC<PdfUploaderProps> = ({
  profileId,
  documents,
  onDocumentsUpdated,
  disabled = false,
}) => {
  const [uploadingRole, setUploadingRole] = useState<'primary' | 'additional' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOverField, setDragOverField] = useState<string | null>(null);

  const primaryFileInputRef = useRef<HTMLInputElement>(null);
  const additionalFileInputRef = useRef<HTMLInputElement>(null);

  const primaryDoc = documents.find((d) => d.role === 'primary');
  const additionalDocs = documents
    .filter((d) => d.role === 'additional')
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const canAddMoreAdditional = additionalDocs.length < MAX_ADDITIONAL_DOCUMENTS;

  const handleFileUpload = async (
    file: File,
    role: 'primary' | 'additional',
    orderIndex: number
  ) => {
    setUploadError(null);
    const validation = validatePdfFile(file);
    if (!validation.isValid) {
      setUploadError(validation.error || 'Invalid file format.');
      return;
    }

    try {
      setUploadingRole(role);

      // If replacing an existing primary doc, remove previous one first
      if (role === 'primary' && primaryDoc) {
        await documentRepository.deleteDocument(primaryDoc.id);
      }

      await documentRepository.saveDocument(
        profileId,
        file,
        file.name,
        role,
        orderIndex
      );

      onDocumentsUpdated();
    } catch (err: any) {
      setUploadError(err.message || 'Failed to save PDF to IndexedDB.');
    } finally {
      setUploadingRole(null);
    }
  };

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    role: 'primary' | 'additional',
    orderIndex: number
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, role, orderIndex);
    }
    e.target.value = ''; // Reset input
  };

  const handleDelete = async (docId: string) => {
    if (disabled) return;
    try {
      await documentRepository.deleteDocument(docId);
      onDocumentsUpdated();
    } catch (err: any) {
      setUploadError('Failed to remove document.');
    }
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    role: 'primary' | 'additional',
    orderIndex: number
  ) => {
    e.preventDefault();
    setDragOverField(null);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file, role, orderIndex);
    }
  };

  return (
    <div className="space-y-4">
      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-start gap-2 p-2.5 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-200 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">{uploadError}</div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold"
          >
            ×
          </button>
        </div>
      )}

      {/* SECTION 1: PRIMARY APPLICANT PDF */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Primary Applicant PDF
            <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800/60">
              Required
            </span>
          </label>
          <span className="text-[11px] text-slate-400">Order #1</span>
        </div>

        {primaryDoc ? (
          <div className="flex items-center justify-between p-3 bg-slate-900/80 border border-emerald-700/50 rounded-lg group">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400 shrink-0">
                <FileCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-100 truncate" title={primaryDoc.fileName}>
                  {primaryDoc.fileName}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span>{formatBytes(primaryDoc.fileSize)}</span>
                  <span>•</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready in IndexedDB
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <input
                ref={primaryFileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'primary', 0)}
                disabled={disabled || uploadingRole === 'primary'}
              />
              <button
                type="button"
                onClick={() => primaryFileInputRef.current?.click()}
                disabled={disabled || uploadingRole === 'primary'}
                className="px-2 py-1 text-[11px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition-colors"
                title="Replace PDF"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => handleDelete(primaryDoc.id)}
                disabled={disabled}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                title="Delete Primary Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverField('primary');
            }}
            onDragLeave={() => setDragOverField(null)}
            onDrop={(e) => handleDrop(e, 'primary', 0)}
            onClick={() => !disabled && primaryFileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all ${
              dragOverField === 'primary'
                ? 'border-emerald-500 bg-emerald-950/20'
                : 'border-slate-700/80 hover:border-slate-500 bg-slate-900/40'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              ref={primaryFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'primary', 0)}
              disabled={disabled || uploadingRole === 'primary'}
            />
            {uploadingRole === 'primary' ? (
              <div className="flex flex-col items-center justify-center py-1">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mb-1" />
                <span className="text-xs text-slate-300">Saving to IndexedDB...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                <UploadCloud className="w-6 h-6 text-slate-400 mb-1 group-hover:text-emerald-400" />
                <span className="text-xs font-medium text-slate-200">
                  Select or drag & drop Primary PDF
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  PDF format only (Max 5MB)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 2: ADDITIONAL APPLICANT PDFS (UP TO 3) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Additional Applicant PDFs
            <span className="text-[10px] text-slate-400 font-normal">
              ({additionalDocs.length}/{MAX_ADDITIONAL_DOCUMENTS} added)
            </span>
          </label>
          <span className="text-[10px] text-slate-400">Order #2 - #4</span>
        </div>

        {/* Existing Additional Documents List */}
        <div className="space-y-2 mb-2">
          {additionalDocs.map((doc, idx) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-2.5 bg-slate-900/60 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-blue-400 shrink-0 text-xs font-bold">
                  {idx + 2}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200 truncate" title={doc.fileName}>
                    {doc.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatBytes(doc.fileSize)} • Additional Applicant #{idx + 1}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={disabled}
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                title="Remove Additional Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Add Additional PDF Dropzone / Button */}
        {canAddMoreAdditional ? (
          <div>
            <input
              ref={additionalFileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => handleFileChange(e, 'additional', additionalDocs.length + 1)}
              disabled={disabled || uploadingRole === 'additional'}
            />
            <button
              type="button"
              onClick={() => additionalFileInputRef.current?.click()}
              disabled={disabled || uploadingRole === 'additional'}
              className="w-full flex items-center justify-center gap-2 p-2.5 bg-slate-900/40 hover:bg-slate-900 border border-dashed border-slate-700 hover:border-blue-500/60 rounded-lg text-xs font-medium text-slate-300 hover:text-blue-300 transition-all"
            >
              {uploadingRole === 'additional' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span>Saving Additional Document...</span>
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5 text-blue-400" />
                  <span>Add Additional Applicant PDF ({additionalDocs.length + 1} of 3)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="p-2 text-center bg-slate-900/30 rounded border border-slate-800 text-[11px] text-slate-400">
            Maximum limit reached (1 Primary + 3 Additional applicants).
          </div>
        )}
      </div>
    </div>
  );
};
