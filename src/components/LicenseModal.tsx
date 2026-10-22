import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Laptop,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  CreditCard,
  MessageCircle,
  RefreshCw,
  LogOut,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { licenseClient } from '../features/license/licenseClient';
import {
  ClientLicenseState,
  PaymentInstructionsData,
} from '../types/license';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseUpdated: (state: ClientLicenseState) => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({
  isOpen,
  onClose,
  onLicenseUpdated,
}) => {
  const [licenseState, setLicenseState] = useState<ClientLicenseState | null>(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // View tabs inside modal: 'status' | 'activate' | 'payment'
  const [viewTab, setViewTab] = useState<'status' | 'activate' | 'payment'>('status');

  // Payment instructions and submission
  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructionsData | null>(null);
  const [isLoadingPaymentInfo, setIsLoadingPaymentInfo] = useState(false);
  const [trxIdInput, setTrxIdInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'BANK'>('BKASH');
  const [selectedPlanCode, setSelectedPlanCode] = useState('PLAN_30D');
  const [payerContactInput, setPayerContactInput] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);

  // Release confirmation
  const [isConfirmingRelease, setIsConfirmingRelease] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Load current license state and payment instructions
  useEffect(() => {
    async function loadData() {
      const stored = await licenseClient.getStoredLicense();
      setLicenseState(stored);

      if (!stored || stored.status !== 'ACTIVE') {
        setViewTab(stored?.status === 'EXPIRED' ? 'payment' : 'activate');
      } else {
        setViewTab('status');
      }
    }
    if (isOpen) {
      loadData();
      setError(null);
      setSuccessMessage(null);
      setPaymentFeedback(null);
      setIsConfirmingRelease(false);
    }
  }, [isOpen]);

  const fetchPaymentInfo = async () => {
    setIsLoadingPaymentInfo(true);
    try {
      const data = await licenseClient.getPaymentInstructions();
      setPaymentInstructions(data);
      if (data.plans.length > 0 && !selectedPlanCode) {
        setSelectedPlanCode(data.plans[0].code);
      }
    } catch {
      // offline or server error
    } finally {
      setIsLoadingPaymentInfo(false);
    }
  };

  useEffect(() => {
    if (viewTab === 'payment' && !paymentInstructions) {
      fetchPaymentInfo();
    }
  }, [viewTab]);

  if (!isOpen) return null;

  // Activation Handler
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) return;

    setError(null);
    setSuccessMessage(null);
    setIsActivating(true);

    try {
      const updated = await licenseClient.activateLicense(licenseKeyInput.trim());
      setLicenseState(updated);
      onLicenseUpdated(updated);
      setSuccessMessage('License activated successfully! Full automation features unlocked.');
      setViewTab('status');
      setLicenseKeyInput('');
    } catch (err: any) {
      setError(err.message || 'Activation failed. Please check your key and network.');
    } finally {
      setIsActivating(false);
    }
  };

  // Revalidate Handler
  const handleRevalidate = async () => {
    setError(null);
    setIsActivating(true);
    try {
      const updated = await licenseClient.validateLicense(true);
      setLicenseState(updated);
      onLicenseUpdated(updated);
      setSuccessMessage('License status verified with server.');
    } catch (err: any) {
      setError(err.message || 'Validation error.');
    } finally {
      setIsActivating(false);
    }
  };

  // Release Installation Handler
  const handleConfirmRelease = async () => {
    setIsReleasing(true);
    setError(null);
    try {
      const res = await licenseClient.releaseInstallation();
      const updated = await licenseClient.getStoredLicense();
      if (updated) {
        setLicenseState(updated);
        onLicenseUpdated(updated);
      }
      setIsConfirmingRelease(false);
      setViewTab('activate');
      setSuccessMessage(res.message);
    } catch (err: any) {
      setError(err.message || 'Failed to release installation slot.');
    } finally {
      setIsReleasing(false);
    }
  };

  // Payment Request Submission Handler
  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trxIdInput.trim() || !payerContactInput.trim()) return;

    setIsSubmittingPayment(true);
    setPaymentFeedback(null);
    try {
      const res = await licenseClient.submitPaymentRequest({
        transactionId: trxIdInput.trim(),
        paymentMethod,
        planCode: selectedPlanCode,
        payerContact: payerContactInput.trim(),
        licenseId: licenseState?.licenseId || null,
      });

      setPaymentFeedback(res.message);
      setTrxIdInput('');
      setPayerContactInput('');
    } catch (err: any) {
      setPaymentFeedback(`Error: ${err.message || 'Submission failed'}`);
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const isActive = licenseState?.status === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900 p-5 shadow-2xl z-10 text-xs animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">IVAC Automation License</h3>
              <p className="text-[10px] text-slate-400">Secure Client Entitlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-navigation tabs */}
        <div className="flex items-center gap-1.5 pt-3 pb-2">
          {isActive && (
            <button
              onClick={() => setViewTab('status')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                viewTab === 'status'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              Subscription Status
            </button>
          )}

          <button
            onClick={() => setViewTab('activate')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
              viewTab === 'activate'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            {isActive ? 'Switch / Enter Key' : 'Activate License'}
          </button>

          <button
            onClick={() => setViewTab('payment')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
              viewTab === 'payment'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            Renew / Buy Access
          </button>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mt-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-[11px] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-[11px] flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* 1. STATUS TAB */}
        {viewTab === 'status' && licenseState && (
          <div className="space-y-3.5 mt-3">
            {/* Status Card */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">License Status</span>
                <span
                  className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                    licenseState.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {licenseState.status}
                </span>
              </div>

              {/* Masked Key */}
              <div>
                <span className="text-[10px] text-slate-500 block">Registered Key</span>
                <span className="font-mono text-xs font-bold text-white tracking-wider">
                  {licenseState.licenseKey ? `IVAC-****-****-${licenseState.licenseKey.slice(-4)}` : '—'}
                </span>
              </div>

              {/* Dates & Time Remaining */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Activated</span>
                  <span className="text-slate-200 font-medium">
                    {licenseState.activatedAt
                      ? new Date(licenseState.activatedAt).toLocaleDateString()
                      : 'Pending'}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 block text-[10px]">Expires On</span>
                  <span className="text-slate-200 font-medium">
                    {licenseState.expiresAt
                      ? new Date(licenseState.expiresAt).toLocaleDateString()
                      : 'Pending'}
                  </span>
                </div>
              </div>

              {/* Time Remaining Pill */}
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-emerald-300">Time Remaining:</span>
                <span className="font-mono font-extrabold text-emerald-400">
                  {licenseState.daysRemaining} Days
                </span>
              </div>
            </div>

            {/* Browser Installations Quota Card */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-slate-400" />
                  Browser Installations
                </span>
                <span className="font-mono text-xs font-bold text-white">
                  <span className="text-emerald-400">{licenseState.activeInstallationsCount}</span> /{' '}
                  {licenseState.maxInstallations}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Available Device Slots:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {licenseState.availableSlots} available
                </span>
              </div>

              <div className="text-[10px] text-slate-500">
                Current browser installation is active and registered.
              </div>
            </div>

            {/* Action Buttons: Revalidate, Renew, Deactivate */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRevalidate}
                  disabled={isActivating}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isActivating ? 'animate-spin' : ''}`} />
                  <span>Verify Status</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewTab('payment')}
                  className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Renew Subscription</span>
                </button>
              </div>

              {/* Deactivate / Release Installation button */}
              {!isConfirmingRelease ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingRelease(true)}
                  className="w-full py-1.5 text-center text-[11px] text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  Release This Browser Installation Slot
                </button>
              ) : (
                <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl space-y-2 animate-in fade-in">
                  <p className="text-[11px] text-rose-300 leading-tight">
                    Confirm release? This will unbind this browser on the server and free 1 slot for use on another computer.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingRelease(false)}
                      className="flex-1 py-1 bg-slate-800 text-slate-300 rounded-lg text-[10px] font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmRelease}
                      disabled={isReleasing}
                      className="flex-1 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[10px] font-bold"
                    >
                      {isReleasing ? 'Releasing...' : 'Yes, Release Slot'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. ACTIVATE TAB */}
        {viewTab === 'activate' && (
          <form onSubmit={handleActivate} className="space-y-3.5 mt-3">
            <p className="text-slate-300 text-xs">
              Enter your premium license key to unlock automated appointment and document booking features.
            </p>

            <div>
              <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
                License Key
              </label>
              <input
                type="text"
                required
                value={licenseKeyInput}
                onChange={(e) => setLicenseKeyInput(e.target.value.toUpperCase())}
                placeholder="IVAC-XXXX-XXXX-XXXX-XXXX"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-emerald-400 font-mono text-center text-xs tracking-wider font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={isActivating || !licenseKeyInput.trim()}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
            >
              {isActivating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Validating Key with Server...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Activate License</span>
                </>
              )}
            </button>

            <div className="pt-2 border-t border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-400">Don't have a license key yet? </span>
              <button
                type="button"
                onClick={() => setViewTab('payment')}
                className="text-[11px] font-bold text-emerald-400 hover:underline"
              >
                View Payment & Plans
              </button>
            </div>
          </form>
        )}

        {/* 3. PAYMENT INSTRUCTIONS & SUBMISSION TAB */}
        {viewTab === 'payment' && (
          <div className="space-y-3.5 mt-3">
            {isLoadingPaymentInfo ? (
              <div className="py-8 text-center text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                Loading official payment instructions...
              </div>
            ) : (
              <>
                {/* Available Plans */}
                {paymentInstructions?.plans && (
                  <div>
                    <label className="block text-slate-400 font-semibold mb-1.5 text-[11px]">
                      Select Subscription Duration
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {paymentInstructions.plans.map((plan) => (
                        <button
                          type="button"
                          key={plan.code}
                          onClick={() => setSelectedPlanCode(plan.code)}
                          className={`p-2.5 rounded-xl border text-left transition-all ${
                            selectedPlanCode === plan.code
                              ? 'bg-emerald-500/15 border-emerald-500/50 text-white'
                              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-bold text-xs">{plan.name}</div>
                          <div className="font-mono text-emerald-400 font-bold text-[11px]">
                            {plan.price} {plan.currency}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gateway Numbers */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-500">
                    Send Money Numbers (Personal/Merchant)
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-pink-400 font-bold">bKash:</span>
                    <span className="text-white select-all font-bold">
                      {paymentInstructions?.settings?.bkashNumber || '01700000000'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-orange-400 font-bold">Nagad:</span>
                    <span className="text-white select-all font-bold">
                      {paymentInstructions?.settings?.nagadNumber || '01800000000'}
                    </span>
                  </div>

                  {paymentInstructions?.settings?.whatsappNumber && (
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800">
                      <span className="text-slate-400 flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-emerald-400" /> WhatsApp:
                      </span>
                      <a
                        href={`https://wa.me/${paymentInstructions.settings.whatsappNumber.replace(/\+/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline font-mono"
                      >
                        {paymentInstructions.settings.whatsappNumber}
                      </a>
                    </div>
                  )}
                </div>

                {/* Submission Form */}
                <form onSubmit={handlePaymentSubmit} className="space-y-2.5">
                  <div className="text-[10px] uppercase font-bold text-slate-400">
                    Submit Transaction for Manual Verification
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white"
                      >
                        <option value="BKASH">bKash</option>
                        <option value="NAGAD">Nagad</option>
                        <option value="BANK">Bank Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-0.5">Payer Phone</label>
                      <input
                        type="text"
                        required
                        value={payerContactInput}
                        onChange={(e) => setPayerContactInput(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Transaction ID (TrxID)</label>
                    <input
                      type="text"
                      required
                      value={trxIdInput}
                      onChange={(e) => setTrxIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. BKA8792019"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase"
                    />
                  </div>

                  {paymentFeedback && (
                    <div className="p-2 bg-slate-950 border border-emerald-500/40 rounded-lg text-emerald-300 text-[10px]">
                      {paymentFeedback}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmittingPayment}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {isSubmittingPayment ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3 h-3" />
                        <span>Submit Payment Request</span>
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
