import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  LogOut,
  ExternalLink,
  MessageCircle,
  CreditCard,
  Clock,
  Laptop,
  Eye,
  EyeOff,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { ClientLicenseState, PaymentPlan, PaymentSettings, PaymentMethod } from '../types/license';
import { licenseService } from '../services/licenseService';

interface LicenseManagerProps {
  onLicenseChanged?: (license: ClientLicenseState | null) => void;
  onNavigateToDashboard?: () => void;
}

export const LicenseManager: React.FC<LicenseManagerProps> = ({
  onLicenseChanged,
  onNavigateToDashboard,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'purchase'>('status');

  // License Status States
  const [license, setLicense] = useState<ClientLicenseState | null>(null);
  const [keyInput, setKeyInput] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [showReleaseConfirm, setShowReleaseConfirm] = useState(false);
  const [licenseError, setLicenseError] = useState<string | null>(null);
  const [licenseSuccess, setLicenseSuccess] = useState<string | null>(null);
  const [isKeyRevealed, setIsKeyRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedInstId, setCopiedInstId] = useState(false);

  // Payment States
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [plans, setPlans] = useState<PaymentPlan[]>([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string>('PLAN_30D');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BKASH');
  const [senderContact, setSenderContact] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<{
    requestId: string;
    transactionId: string;
    message: string;
  } | null>(null);
  const [isLoadingPaymentInfo, setIsLoadingPaymentInfo] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // Load License & Payment data on mount
  useEffect(() => {
    loadLicense();
    loadPaymentInfo();

    const unsubscribe = licenseService.subscribe((updated) => {
      setLicense(updated);
      if (onLicenseChanged) {
        onLicenseChanged(updated);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const loadLicense = async () => {
    setIsValidating(true);
    try {
      const stored = await licenseService.getStoredLicense();
      setLicense(stored);
      if (stored?.licenseKey) {
        const valRes = await licenseService.validateLicense(false);
        if (valRes.data) {
          setLicense(valRes.data);
        }
      }
    } catch {
      // offline or error handled inside service
    } finally {
      setIsValidating(false);
    }
  };

  const loadPaymentInfo = async () => {
    setIsLoadingPaymentInfo(true);
    try {
      const info = await licenseService.getPaymentInstructions();
      setPaymentSettings(info.settings);
      setPlans(info.plans);
      if (info.plans.length > 0) {
        setSelectedPlanCode(info.plans[0].code);
      }
    } catch {
      // Backend may be offline or unseeded yet
    } finally {
      setIsLoadingPaymentInfo(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLicenseError(null);
    setLicenseSuccess(null);

    const key = keyInput.trim().toUpperCase();
    if (!key) {
      setLicenseError('Please enter a license key.');
      return;
    }

    setIsActivating(true);
    const res = await licenseService.activateLicense(key);
    setIsActivating(false);

    if (res.success && res.data) {
      setLicense(res.data);
      setKeyInput('');
      setLicenseSuccess('License activated successfully! Full automation unlocked.');
      if (onLicenseChanged) onLicenseChanged(res.data);
      setTimeout(() => setLicenseSuccess(null), 5000);
    } else {
      setLicenseError(res.error || 'Activation failed. Please check your key.');
    }
  };

  const handleValidateNow = async () => {
    setLicenseError(null);
    setLicenseSuccess(null);
    setIsValidating(true);
    const res = await licenseService.validateLicense(true);
    setIsValidating(false);

    if (res.success && res.data) {
      setLicense(res.data);
      setLicenseSuccess(`Verified: License is active with ${res.data.daysRemaining} days remaining.`);
      setTimeout(() => setLicenseSuccess(null), 4000);
    } else {
      setLicenseError(res.message || 'Validation failed. License may have expired.');
    }
  };

  const handleReleaseSlot = async () => {
    setIsReleasing(true);
    setLicenseError(null);
    const res = await licenseService.releaseInstallation();
    setIsReleasing(false);
    setShowReleaseConfirm(false);

    if (res.success) {
      setLicense(null);
      setLicenseSuccess('Browser slot released successfully. You can now use this key on another device.');
      if (onLicenseChanged) onLicenseChanged(null);
      setTimeout(() => setLicenseSuccess(null), 5000);
    } else {
      setLicenseError(res.error || 'Failed to release browser slot.');
    }
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    if (!transactionId.trim()) {
      setPaymentError('Please enter your Transaction ID (TrxID).');
      return;
    }
    if (!senderContact.trim()) {
      setPaymentError('Please enter your sender mobile / contact number.');
      return;
    }

    setIsSubmittingPayment(true);
    const res = await licenseService.submitPaymentRequest({
      transactionId: transactionId.trim().toUpperCase(),
      paymentMethod,
      planCode: selectedPlanCode,
      payerContact: senderContact.trim(),
      customerName: customerName.trim() || undefined,
      licenseId: license?.licenseId || undefined,
    });
    setIsSubmittingPayment(false);

    if (res.success && res.data) {
      setSubmittedRequest({
        requestId: res.data.requestId,
        transactionId: res.data.transactionId,
        message:
          'Payment request submitted successfully! Admin will verify and activate your license within 15-30 minutes.',
      });
      setTransactionId('');
      setSenderContact('');
    } else {
      setPaymentError(res.error || 'Failed to submit payment. Please verify the Transaction ID.');
    }
  };

  const copyToClipboard = (text: string, type: 'key' | 'inst' | 'bkash' | 'nagad') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === 'inst') {
      setCopiedInstId(true);
      setTimeout(() => setCopiedInstId(false), 2000);
    } else {
      setCopiedNumber(type);
      setTimeout(() => setCopiedNumber(null), 2000);
    }
  };

  const maskLicenseKey = (key: string) => {
    if (!key) return '';
    const parts = key.split('-');
    if (parts.length < 3) return key;
    return `${parts[0]}-••••-••••-${parts[parts.length - 1]}`;
  };

  const isLicenseActive =
    license?.status === 'ACTIVE' &&
    (!license.expiresAt || new Date(license.expiresAt).getTime() > Date.now());

  return (
    <div className="space-y-3.5 text-xs">
      {/* Sub-navigation tabs: License Status vs Buy / Renew */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveSubTab('status')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold text-[11px] transition-all ${
            activeSubTab === 'status'
              ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="w-3.5 h-3.5" />
          <span>License Status</span>
          {isLicenseActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('purchase')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold text-[11px] transition-all ${
            activeSubTab === 'purchase'
              ? 'bg-slate-800 text-amber-300 shadow-sm border border-slate-700/80'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>bKash / Nagad Pay</span>
          <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            Pass
          </span>
        </button>
      </div>

      {/* Global Alerts */}
      {licenseSuccess && (
        <div className="p-2.5 bg-emerald-950/60 border border-emerald-600/70 rounded-xl flex items-center gap-2 text-emerald-200 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-[11px] leading-tight flex-1">{licenseSuccess}</span>
        </div>
      )}

      {licenseError && (
        <div className="p-2.5 bg-rose-950/60 border border-rose-600/70 rounded-xl flex items-center gap-2 text-rose-200 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span className="text-[11px] leading-tight flex-1">{licenseError}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: LICENSE STATUS & ACTIVATION                                       */}
      {/* ========================================================================= */}
      {activeSubTab === 'status' && (
        <div className="space-y-3">
          {/* 1. Status Overview Card */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isLicenseActive
                ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/50 shadow-md'
                : 'bg-slate-900/90 border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    isLicenseActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isLicenseActive ? (
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <ShieldAlert className="w-4 h-4 text-rose-400" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-xs">IVAC Premium Edition</h4>
                  <p className="text-[10px] text-slate-400">
                    {isLicenseActive ? 'Full Automation Active' : 'Unlicensed / Expired'}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] border flex items-center gap-1.5 ${
                  isLicenseActive
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-700/80'
                    : 'bg-rose-950 text-rose-400 border-rose-700/80'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isLicenseActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                {isLicenseActive ? 'ACTIVE' : license?.status || 'UNLICENSED'}
              </span>
            </div>

            {/* Active License Details */}
            {license && (
              <div className="pt-2.5 space-y-2">
                {/* Metric Strip */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Clock className="w-3 h-3 text-emerald-400" /> Validity Remaining
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      {license.daysRemaining} <span className="text-[10px] font-normal text-slate-400">Days</span>
                    </span>
                  </div>

                  <div className="p-2 bg-slate-950/70 border border-slate-800 rounded-lg">
                    <span className="text-[10px] text-slate-400 block flex items-center gap-1">
                      <Laptop className="w-3 h-3 text-emerald-400" /> Permitted Slots
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      {license.activeInstallationsCount} / {license.maxInstallations}{' '}
                      <span className="text-[10px] font-normal text-slate-400">Browsers</span>
                    </span>
                  </div>
                </div>

                {/* License Key Display */}
                <div className="p-2 bg-slate-950/90 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>License Key</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsKeyRevealed(!isKeyRevealed)}
                        className="text-slate-400 hover:text-slate-200 flex items-center gap-0.5"
                      >
                        {isKeyRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{isKeyRevealed ? 'Hide' : 'Show'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(license.licenseKey, 'key')}
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                      >
                        {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                  <p className="font-mono text-xs font-semibold text-slate-200 tracking-wider">
                    {isKeyRevealed ? license.licenseKey : maskLicenseKey(license.licenseKey)}
                  </p>
                  {license.expiresAt && (
                    <p className="text-[10px] text-slate-500">
                      Expires: {new Date(license.expiresAt).toLocaleDateString()} at{' '}
                      {new Date(license.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Installation UUID Tag */}
                <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span className="truncate max-w-[200px]" title={license.installationId}>
                    Device ID: <span className="font-mono text-slate-300">{license.installationId.substring(0, 16)}...</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(license.installationId, 'inst')}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {copiedInstId ? 'Copied ID' : 'Copy ID'}
                  </button>
                </div>

                {/* Management Action Bar */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleValidateNow}
                    disabled={isValidating}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-[11px] transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isValidating ? 'animate-spin' : ''}`} />
                    <span>Check Server</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowReleaseConfirm(true)}
                    disabled={isReleasing}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 rounded-lg font-medium text-[11px] transition-colors"
                    title="Release installation slot to activate on another browser"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Release Slot</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Slot Release Confirmation Dialog */}
          {showReleaseConfirm && (
            <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2 text-rose-200">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-bold text-xs text-rose-100 block">
                    Release Browser Installation Slot?
                  </span>
                  <p className="text-[11px] text-rose-200/90 leading-tight">
                    This will disconnect your license from this browser and immediately free the slot on the server so you can activate it on another device.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleReleaseSlot}
                  disabled={isReleasing}
                  className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[11px] transition-all"
                >
                  {isReleasing ? 'Releasing Slot...' : 'Yes, Release Slot'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowReleaseConfirm(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* 3. Activation Form (Shown if no active license, or for key switching) */}
          {(!license || !isLicenseActive) && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-emerald-400" /> Activate License Key
                </span>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('purchase')}
                  className="text-[10px] text-amber-300 hover:text-amber-200 font-semibold"
                >
                  Need a key? Buy pass &rarr;
                </button>
              </div>

              <form onSubmit={handleActivate} className="space-y-2">
                <div className="relative">
                  <input
                    type="text"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
                    placeholder="IVAC-XXXX-XXXX-XXXX-XXXX"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 text-xs font-mono tracking-wider focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isActivating || !keyInput.trim()}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-lg transition-all shadow-sm"
                >
                  {isActivating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating with Server...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Activate License Key</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Return to Dashboard CTA */}
          {isLicenseActive && onNavigateToDashboard && (
            <button
              type="button"
              onClick={onNavigateToDashboard}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold rounded-xl text-xs transition-colors"
            >
              <span>Continue to Assistant Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW B: PURCHASE / RENEW (bKash & Nagad Pay)                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'purchase' && (
        <div className="space-y-3">
          {/* 1. Official Merchant / Personal Numbers */}
          <div className="p-3 bg-gradient-to-br from-slate-900 to-amber-950/30 border border-amber-500/40 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Official Payment Accounts
              </span>
              <span className="text-[9px] text-amber-400/80">Send Money / Merchant</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* bKash Box */}
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-pink-400 block">bKash Personal</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-100">
                    {paymentSettings?.bkashNumber || '01700000000'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(paymentSettings?.bkashNumber || '01700000000', 'bkash')
                    }
                    className="text-pink-400 hover:text-pink-300 text-[10px]"
                  >
                    {copiedNumber === 'bkash' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Nagad Box */}
              <div className="p-2 bg-slate-950/80 border border-slate-800 rounded-lg space-y-1">
                <span className="text-[10px] font-bold text-orange-400 block">Nagad Personal</span>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-slate-100">
                    {paymentSettings?.nagadNumber || '01800000000'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(paymentSettings?.nagadNumber || '01800000000', 'nagad')
                    }
                    className="text-orange-400 hover:text-orange-300 text-[10px]"
                  >
                    {copiedNumber === 'nagad' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            {/* Instruction Callout */}
            <p className="text-[10px] text-slate-400 leading-tight">
              {paymentSettings?.instructionText ||
                '1. Send Money via bKash or Nagad. 2. Note down TrxID. 3. Enter TrxID below to request activation.'}
            </p>
          </div>

          {/* 2. Subscription Plan Selector */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-300 block">Select Access Pass:</span>
            <div className="grid grid-cols-2 gap-2">
              {(plans.length > 0
                ? plans
                : [
                    { code: 'PLAN_7D', name: '7 Days Pass', validityDays: 7, price: 300, maxInstallations: 1, currency: 'BDT' },
                    { code: 'PLAN_15D', name: '15 Days Starter', validityDays: 15, price: 600, maxInstallations: 1, currency: 'BDT' },
                    { code: 'PLAN_30D', name: '30 Days Standard', validityDays: 30, price: 1000, maxInstallations: 1, currency: 'BDT' },
                    { code: 'PLAN_90D', name: '90 Days Agency', validityDays: 90, price: 2700, maxInstallations: 2, currency: 'BDT' },
                  ]
              ).map((plan) => {
                const isSelected = selectedPlanCode === plan.code;
                return (
                  <button
                    key={plan.code}
                    type="button"
                    onClick={() => setSelectedPlanCode(plan.code)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      isSelected
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[11px] text-slate-100">{plan.name}</span>
                      <span className="font-extrabold text-xs text-amber-400">
                        {plan.price} {plan.currency}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">
                      {plan.validityDays} Days • {plan.maxInstallations} Browser{plan.maxInstallations > 1 ? 's' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Payment Submission Form */}
          {submittedRequest ? (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500 rounded-xl space-y-2 animate-in fade-in">
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-bold text-xs">Payment Request Queued!</span>
              </div>
              <p className="text-[11px] text-emerald-200/90 leading-tight">
                {submittedRequest.message}
              </p>
              <div className="p-2 bg-slate-950/80 rounded border border-emerald-800/60 font-mono text-[10px] text-emerald-400 space-y-0.5">
                <div>TrxID: {submittedRequest.transactionId}</div>
                <div>Request ID: {submittedRequest.requestId}</div>
              </div>

              {paymentSettings?.whatsappNumber && (
                <a
                  href={`https://wa.me/${paymentSettings.whatsappNumber.replace(/\D/g, '')}?text=Hello%2C%20I%20have%20submitted%20payment%20for%20IVAC%20Automation%20TrxID%3A%20${submittedRequest.transactionId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-[11px] transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Contact WhatsApp for Instant Activation</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setSubmittedRequest(null)}
                className="w-full py-1 text-slate-400 hover:text-slate-200 text-[10px]"
              >
                Submit another transaction
              </button>
            </div>
          ) : (
            <form onSubmit={handlePaymentSubmit} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Submit Transaction Details
              </span>

              {/* Payment Method Selector */}
              <div className="flex items-center gap-2">
                {(['BKASH', 'NAGAD'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-1.5 rounded-lg font-bold text-xs border transition-colors ${
                      paymentMethod === m
                        ? m === 'BKASH'
                          ? 'bg-pink-950/60 border-pink-500 text-pink-300'
                          : 'bg-orange-950/60 border-orange-500 text-orange-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Sender Contact Number */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Your Mobile Number (Sender)</label>
                <input
                  type="text"
                  value={senderContact}
                  onChange={(e) => setSenderContact(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Transaction ID */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Transaction ID (TrxID)</label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                  placeholder="e.g. BLX9827361"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 font-mono text-xs uppercase focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Optional Name */}
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Your Name (Optional)</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Applicant or Agent Name"
                  className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              {paymentError && (
                <p className="text-[10px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{paymentError}</span>
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmittingPayment || !transactionId.trim() || !senderContact.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold rounded-lg transition-all shadow-sm"
              >
                {isSubmittingPayment ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Submit Payment for Approval</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* WhatsApp Support Button */}
          {paymentSettings?.whatsappNumber && (
            <div className="pt-1">
              <a
                href={`https://wa.me/${paymentSettings.whatsappNumber.replace(/\D/g, '')}?text=Hello%20IVAC%20Support%2C%20I%20have%20a%20question%20about%20license%20and%20payment.`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 hover:text-emerald-300 rounded-xl text-[11px] font-medium transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp Customer Support: {paymentSettings.whatsappNumber}</span>
                <ExternalLink className="w-3 h-3 text-slate-500" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
