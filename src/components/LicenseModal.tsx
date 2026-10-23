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
  PaymentPlan,
  SubmitPaymentResult,
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

  // Dynamic subscription plans & instructions
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [planLoadError, setPlanLoadError] = useState<string | null>(null);

  const [paymentInstructions, setPaymentInstructions] = useState<PaymentInstructionsData | null>(null);
  const [trxIdInput, setTrxIdInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'BKASH' | 'NAGAD' | 'BANK'>('BKASH');
  const [payerContactInput, setPayerContactInput] = useState('');
  const [payerNameInput, setPayerNameInput] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentFeedback, setPaymentFeedback] = useState<string | null>(null);
  const [confirmedPayment, setConfirmedPayment] = useState<SubmitPaymentResult | null>(null);

  // Release confirmation
  const [isConfirmingRelease, setIsConfirmingRelease] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);

  // Load current license state and payment instructions
  useEffect(() => {
    async function loadData() {
      const stored = await licenseClient.getStoredLicense();
      setLicenseState(stored);

      if (!stored || stored.status !== 'ACTIVE') {
        setViewTab('payment');
        fetchPlans();
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

  // Close modal on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchPlans = async (forceRefresh = false) => {
    setIsLoadingPlans(true);
    setPlanLoadError(null);
    try {
      const [fetchedPlans, instructions] = await Promise.all([
        licenseClient.getPublicPlans(forceRefresh).catch((err) => {
          console.warn('[LicenseModal] /public/plans direct fetch notice:', err.message);
          return [] as PaymentPlan[];
        }),
        licenseClient.getPaymentInstructions(forceRefresh).catch((err) => {
          console.warn('[LicenseModal] /public/payment-instructions fetch notice:', err.message);
          return null;
        }),
      ]);

      if (instructions) {
        setPaymentInstructions(instructions);
      }

      const activePlans = fetchedPlans.length > 0
        ? fetchedPlans
        : (instructions?.plans || []);

      setPlans(activePlans);

      if (activePlans.length > 0) {
        setSelectedPlanId((prevId) => {
          const exists = activePlans.find((p) => p.id === prevId);
          return exists ? exists.id : activePlans[0].id;
        });
      } else {
        setSelectedPlanId('');
      }

      if (activePlans.length === 0 && !instructions) {
        setPlanLoadError('Unable to connect to license server. Please verify network or API URL and retry.');
      }
    } catch (err: any) {
      setPlanLoadError(err.message || 'Failed to load subscription plans.');
    } finally {
      setIsLoadingPlans(false);
    }
  };

  useEffect(() => {
    if (viewTab === 'payment' && plans.length === 0 && !isLoadingPlans && !planLoadError) {
      fetchPlans();
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
    if (!trxIdInput.trim() || !payerContactInput.trim() || !selectedPlanId) return;

    const selectedPlan = plans.find((p) => p.id === selectedPlanId);
    if (!selectedPlan) {
      setPaymentFeedback('Please select a valid subscription plan from the list.');
      return;
    }

    setIsSubmittingPayment(true);
    setPaymentFeedback(null);
    setConfirmedPayment(null);

    try {
      const res = await licenseClient.submitPaymentRequest({
        transactionId: trxIdInput.trim().toUpperCase(),
        paymentMethod,
        planId: selectedPlan.id,
        planCode: selectedPlan.code,
        payerContact: payerContactInput.trim(),
        payerName: payerNameInput.trim() || undefined,
        licenseId: licenseState?.licenseId || null,
      });

      // ONLY display pending-review confirmation message after backend confirms
      if (res && res.status === 'PENDING') {
        setConfirmedPayment(res);
        setTrxIdInput('');
        setPayerContactInput('');
        setPayerNameInput('');
      } else {
        setPaymentFeedback(res.message || 'Payment request submitted successfully.');
      }
    } catch (err: any) {
      const msg = err.message || 'Payment submission failed.';
      setPaymentFeedback(msg);
      // Auto-refresh dynamic plans if the selected plan is deactivated or invalid
      if (msg.toLowerCase().includes('no longer active') || msg.toLowerCase().includes('invalid')) {
        await fetchPlans(true);
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const isActive = licenseState?.status === 'ACTIVE';

  return (
    <div className="fixed inset-0 z-[2147483647] flex overflow-y-auto p-2 sm:p-4 bg-slate-950/85 backdrop-blur-sm">
      {/* Click outside to close backdrop overlay */}
      <div className="fixed inset-0 -z-10" onClick={onClose} />

      {/* Modal Dialog Box */}
      <div className="relative m-auto w-full max-w-lg rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl z-10 text-xs flex flex-col max-h-[min(90vh,760px)] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Sticky Header: ALWAYS visible at the top */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-900/95 shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm tracking-tight">IVAC Automation License</h3>
              <p className="text-[10px] text-slate-400">Secure Client Entitlement</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sticky Sub-navigation tabs: ALWAYS visible right below header */}
        <div className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-950/60 border-b border-slate-800/70 shrink-0 select-none">
          {isActive && (
            <button
              type="button"
              onClick={() => setViewTab('status')}
              className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                viewTab === 'status'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              Subscription Status
            </button>
          )}

          <button
            type="button"
            onClick={() => setViewTab('activate')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
              viewTab === 'activate'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {isActive ? 'Switch / Enter Key' : 'Activate License'}
          </button>

          <button
            type="button"
            onClick={() => setViewTab('payment')}
            className={`px-3 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
              viewTab === 'payment'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            Renew / Buy Access
          </button>
        </div>

        {/* Scrollable Content Body with smooth scrolling */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 overscroll-contain">

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
            {/* Header with live refresh button */}
            <div className="flex items-center justify-between pb-1 border-b border-slate-800/80">
              <div>
                <span className="font-bold text-slate-100 text-xs block">Choose Your Subscription Plan</span>
                <span className="text-[10px] text-slate-400">Dynamic pricing synced with IVAC License Authority</span>
              </div>
              <button
                type="button"
                onClick={() => fetchPlans(true)}
                disabled={isLoadingPlans}
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 text-[10px]"
                title="Refresh active plans from server"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPlans ? 'animate-spin text-emerald-400' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>

            {/* 1. Loading State */}
            {isLoadingPlans && plans.length === 0 && (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-emerald-400" />
                <p className="text-xs">Fetching active subscription plans from server...</p>
              </div>
            )}

            {/* 2. Error State */}
            {planLoadError && plans.length === 0 && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-2">
                <div className="flex items-start gap-2 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <p className="text-xs font-medium leading-tight">{planLoadError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => fetchPlans(true)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry Loading Plans</span>
                </button>
              </div>
            )}

            {/* 3. Empty State */}
            {!isLoadingPlans && !planLoadError && plans.length === 0 && (
              <div className="p-6 text-center bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                <p className="text-xs text-slate-300">No subscription plans are currently available.</p>
                <p className="text-[10px] text-slate-500">Please check back shortly or contact administration.</p>
                <button
                  type="button"
                  onClick={() => fetchPlans(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Refresh Plans
                </button>
              </div>
            )}

            {/* 4. Dynamic Active Plans Grid */}
            {plans.length > 0 && (
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {plans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <button
                        type="button"
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all relative ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/70 shadow-md shadow-emerald-500/10 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-xs text-slate-100">{plan.name}</span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          )}
                        </div>

                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="font-mono text-emerald-400 font-extrabold text-sm">
                            {plan.price} {plan.currency}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            • {plan.validityDays} Days
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Laptop className="w-3 h-3 text-slate-500" />
                          <span>
                            {plan.maxInstallations} Device${plan.maxInstallations > 1 ? 's' : ''} Slot
                          </span>
                        </div>

                        {plan.description && (
                          <p className="text-[10px] text-slate-400/90 italic mt-1 leading-tight line-clamp-2">
                            {plan.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Official Gateway Payment Numbers */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[10px] uppercase font-bold text-slate-500">
                Send Money Numbers (Personal/Merchant)
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-pink-400 font-bold">bKash:</span>
                <span className="text-white select-all font-bold">
                  {paymentInstructions?.settings?.bkashNumber || '01747498166'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-orange-400 font-bold">Nagad:</span>
                <span className="text-white select-all font-bold">
                  {paymentInstructions?.settings?.nagadNumber || '01747498166'}
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

            {/* 5. Confirmed Pending-Review Message Display */}
            {confirmedPayment ? (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/70 rounded-xl space-y-2.5 animate-in fade-in">
                <div className="flex items-start gap-2 text-emerald-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-bold text-white text-xs block">
                      Payment Request Awaiting Admin Review
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Ref ID: {confirmedPayment.requestId}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-emerald-200/90 leading-tight">
                  {confirmedPayment.message ||
                    'Payment request received successfully. It is now awaiting manual admin verification. Your license will be issued or renewed once payment is confirmed.'}
                </p>

                <div className="p-2 bg-slate-950/80 rounded-lg border border-emerald-800/40 text-[10px] space-y-1 font-mono text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Transaction ID:</span>
                    <span className="text-white font-bold">{confirmedPayment.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-amber-400 font-bold uppercase">{confirmedPayment.status}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setConfirmedPayment(null)}
                    className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-medium transition-colors"
                  >
                    Submit Another TrxID
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewTab('activate')}
                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-bold transition-colors"
                  >
                    Enter License Key
                  </button>
                </div>
              </div>
            ) : (
              /* 6. Submission Form */
              <form onSubmit={handlePaymentSubmit} className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                  <span>Submit Transaction for Verification</span>
                  {selectedPlanId && (() => {
                    const sel = plans.find((p) => p.id === selectedPlanId);
                    return sel ? (
                      <span className="text-emerald-400 font-mono lowercase tracking-normal">
                        ({sel.name} • {sel.price} {sel.currency})
                      </span>
                    ) : null;
                  })()}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="BKASH">bKash</option>
                      <option value="NAGAD">Nagad</option>
                      <option value="BANK">Bank Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Payer Name (Optional)</label>
                    <input
                      type="text"
                      value={payerNameInput}
                      onChange={(e) => setPayerNameInput(e.target.value)}
                      placeholder="Your Name"
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Payer Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={payerContactInput}
                      onChange={(e) => setPayerContactInput(e.target.value)}
                      placeholder="017XXXXXXXX"
                      className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Transaction ID (TrxID) *</label>
                    <input
                      type="text"
                      required
                      value={trxIdInput}
                      onChange={(e) => setTrxIdInput(e.target.value.toUpperCase())}
                      placeholder="e.g. BKA8792019"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono uppercase text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {paymentFeedback && (
                  <div className="p-2 bg-slate-950 border border-amber-500/40 rounded-lg text-amber-300 text-[10px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{paymentFeedback}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingPayment || !selectedPlanId || !trxIdInput.trim() || !payerContactInput.trim()}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-emerald-500/20 text-xs disabled:cursor-not-allowed"
                >
                  {isSubmittingPayment ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Submitting Payment Request...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3" />
                      <span>Submit Payment Request</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};
