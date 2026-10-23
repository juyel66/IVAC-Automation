var v = Object.defineProperty;
var b = (o, e, t) => e in o ? v(o, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : o[e] = t;
var h = (o, e, t) => b(o, typeof e != "symbol" ? e + "" : e, t);
const S = {
  panelPosition: { x: 24, y: 24 },
  // Top-right offset default
  isMinimized: !1,
  isClosed: !1,
  autoFillEnabled: !0,
  soundAlertsEnabled: !0,
  stayWithinViewport: !0,
  licenseApiUrl: "http://localhost:5000/api/v1"
}, I = "ivac_assistant_settings";
class C {
  isChromeStorage() {
    return typeof chrome < "u" && !!chrome.storage && !!chrome.storage.local;
  }
  async getSettings() {
    if (this.isChromeStorage())
      return new Promise((e) => {
        chrome.storage.local.get([I], (t) => {
          e({ ...S, ...t[I] || {} });
        });
      });
    try {
      const e = localStorage.getItem(I);
      return e ? { ...S, ...JSON.parse(e) } : S;
    } catch {
      return S;
    }
  }
  async saveSettings(e) {
    const s = { ...await this.getSettings(), ...e };
    if (this.isChromeStorage())
      return new Promise((i) => {
        chrome.storage.local.set({ [I]: s }, () => {
          i(s);
        });
      });
    try {
      localStorage.setItem(I, JSON.stringify(s));
    } catch {
    }
    return s;
  }
}
const _ = new C(), d = "ivac_client_license_state", u = "ivac_assistant_license", y = "ivac_installation_id", T = 1440 * 60 * 1e3;
class N {
  constructor() {
    h(this, "listeners", /* @__PURE__ */ new Set());
    h(this, "cachedLicense", null);
    h(this, "isLoaded", !1);
    h(this, "strictModeInTests", !1);
    h(this, "cachedInstallationId", null);
    h(this, "installationIdPromise", null);
    this.setupStorageListener();
  }
  isChromeStorage() {
    return typeof chrome < "u" && !!chrome.storage && !!chrome.storage.local;
  }
  setupStorageListener() {
    typeof chrome < "u" && chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener((e, t) => {
      if (t === "local" && (e[d] || e[u])) {
        const i = (e[d] || e[u]).newValue || null;
        this.cachedLicense = i, this.notify();
      }
    });
  }
  /**
   * For testing: enforce strict license check even in test runners
   */
  setStrictMode(e) {
    this.strictModeInTests = e;
  }
  isStrictModeActive() {
    return this.strictModeInTests;
  }
  /**
   * Subscribe to license changes (reactive UI updates)
   */
  subscribe(e) {
    return this.listeners.add(e), this.isLoaded && e(this.cachedLicense), () => {
      this.listeners.delete(e);
    };
  }
  notify() {
    for (const e of this.listeners)
      try {
        e(this.cachedLicense);
      } catch (t) {
        console.error("[LicenseService] Listener notification error:", t);
      }
  }
  /**
   * Returns a persistent UUID for this browser installation.
   * Concurrency-safe: memoizes in memory and avoids duplicate generation during race conditions.
   */
  async getInstallationId() {
    return this.cachedInstallationId ? this.cachedInstallationId : this.installationIdPromise ? this.installationIdPromise : (this.installationIdPromise = (async () => {
      let e = null;
      if (this.isChromeStorage())
        e = await new Promise((t) => {
          chrome.storage.local.get([y], (s) => {
            let i = s == null ? void 0 : s[y];
            i || (i = this.generateInstallationId(), chrome.storage.local.set({ [y]: i })), t(i);
          });
        });
      else
        try {
          e = localStorage.getItem(y), e || (e = this.generateInstallationId(), localStorage.setItem(y, e));
        } catch {
          e = this.generateInstallationId();
        }
      return this.cachedInstallationId = e, this.installationIdPromise = null, e;
    })(), this.installationIdPromise);
  }
  generateInstallationId() {
    if (typeof crypto < "u" && crypto.randomUUID)
      return `inst_${crypto.randomUUID()}`;
    const e = Math.random().toString(36).substring(2, 12);
    return `inst_${Date.now().toString(36)}_${e}`;
  }
  /**
   * Human-friendly installation device label
   */
  getInstallationLabel() {
    const e = typeof navigator < "u" ? navigator.userAgent : "Unknown";
    let t = "Desktop";
    return e.includes("Win") ? t = "Windows" : e.includes("Mac") ? t = "macOS" : e.includes("Linux") && (t = "Linux"), `Chrome on ${t}`;
  }
  /**
   * Retrieves currently stored license info from primary or legacy storage
   */
  async getStoredLicense() {
    if (this.cachedLicense) return { ...this.cachedLicense };
    if (this.isChromeStorage())
      return new Promise((e) => {
        chrome.storage.local.get(
          [d, u],
          (t) => {
            const s = (t == null ? void 0 : t[d]) || (t == null ? void 0 : t[u]) || null;
            this.cachedLicense = s, this.isLoaded = !0, s && !(t != null && t[d]) && chrome.storage.local.set({ [d]: s }), e(this.cachedLicense ? { ...this.cachedLicense } : null);
          }
        );
      });
    try {
      const e = localStorage.getItem(d) || localStorage.getItem(u);
      return this.cachedLicense = e ? JSON.parse(e) : null, this.isLoaded = !0, this.cachedLicense ? { ...this.cachedLicense } : null;
    } catch {
      return this.cachedLicense = null, this.isLoaded = !0, null;
    }
  }
  /**
   * Saves or clears license info in local storage (dual-written to both keys)
   */
  async saveStoredLicense(e) {
    if (this.cachedLicense = e ? { ...e } : null, this.isLoaded = !0, this.isChromeStorage())
      await new Promise((t) => {
        e ? chrome.storage.local.set(
          {
            [d]: e,
            [u]: e
          },
          () => t()
        ) : chrome.storage.local.remove(
          [d, u],
          () => t()
        );
      });
    else
      try {
        if (e) {
          const t = JSON.stringify(e);
          localStorage.setItem(d, t), localStorage.setItem(u, t);
        } else
          localStorage.removeItem(d), localStorage.removeItem(u);
      } catch {
      }
    this.notify();
  }
  /**
   * Retrieves base API URL from settings
   */
  async getApiBaseUrl() {
    var t;
    return ((t = (await _.getSettings()).licenseApiUrl) == null ? void 0 : t.replace(/\/+$/, "")) || "http://localhost:5000/api/v1";
  }
  /**
   * Centralized network request execution.
   * If running in a Chrome Extension content script on an HTTPS page (appointment.ivacbd.com),
   * delegates the request through the background service worker to prevent CORS and Mixed Content blocks.
   * Falls back to direct fetch in test and standalone environments.
   */
  async fetchApi(e, t = {}) {
    const s = await this.getApiBaseUrl(), i = e.startsWith("/") ? e : `/${e}`, n = `${s}${i}`, r = {
      method: t.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...t.headers || {}
      },
      body: t.body ? JSON.stringify(t.body) : void 0
    };
    if (typeof chrome < "u" && chrome.runtime && typeof chrome.runtime.sendMessage == "function" && chrome.runtime.id)
      try {
        const a = await new Promise((c) => {
          chrome.runtime.sendMessage(
            {
              type: "LICENSE_API_FETCH",
              payload: {
                url: n,
                options: {
                  method: r.method,
                  headers: r.headers,
                  body: r.body
                }
              }
            },
            (l) => {
              chrome.runtime.lastError ? c({ ok: !1, status: 0, body: {}, error: chrome.runtime.lastError.message }) : c(l || { ok: !1, status: 0, body: {}, error: "No response from background service worker" });
            }
          );
        });
        if (a && a.status > 0)
          return a;
      } catch (a) {
        console.warn("[LicenseService] Background delegation failed, falling back to direct fetch:", a);
      }
    try {
      const a = await fetch(n, r), c = await a.json().catch(() => ({}));
      return {
        ok: a.ok,
        status: a.status,
        body: c
      };
    } catch (a) {
      return {
        ok: !1,
        status: 0,
        body: {},
        error: a.message || "Network request failed"
      };
    }
  }
  /**
   * Fast check: returns true if local license exists and is actively valid
   */
  async hasActiveLicense() {
    const e = await this.getStoredLicense();
    if (!e)
      return typeof process < "u" && process.env.VITEST === "true" && !this.strictModeInTests;
    if (e.expiresAt) {
      const t = new Date(e.expiresAt).getTime();
      if (Date.now() > t)
        return !1;
    }
    return e.status === "ACTIVE";
  }
  /**
   * Activates a license key on this browser installation slot
   */
  async activateLicense(e) {
    var l;
    const t = e.trim().toUpperCase();
    if (!t)
      return { success: !1, error: "Please enter a valid license key" };
    const s = await this.getInstallationId(), i = this.getInstallationLabel(), n = await this.fetchApi("/licenses/activate", {
      method: "POST",
      body: {
        licenseKey: t,
        installationId: s,
        installationLabel: i
      }
    }), r = n.body || {};
    if (!n.ok || !r.success)
      return { success: !1, error: r.message || ((l = r.error) == null ? void 0 : l.message) || n.error || (n.status === 409 ? "Installation slot limit reached. Please release an existing installation first." : "License activation failed. Please verify your license key.") };
    const a = r.data, c = {
      licenseKey: t,
      licenseId: a.licenseId || a.id,
      status: a.status || "ACTIVE",
      activatedAt: a.activatedAt,
      expiresAt: a.expiresAt,
      daysRemaining: a.daysRemaining ?? 30,
      maxInstallations: a.maxInstallations ?? 1,
      activeInstallationsCount: a.activeInstallationsCount ?? 1,
      availableSlots: a.availableSlots ?? 0,
      installationId: s,
      installationLabel: i,
      lastValidatedAt: Date.now(),
      customerName: a.customerName,
      customerContact: a.customerContact
    };
    return await this.saveStoredLicense(c), {
      success: !0,
      data: c,
      message: r.message || "License successfully activated on this browser."
    };
  }
  /**
   * Validates the currently registered license against the backend.
   * Handles offline tolerance gracefully up to 24 hours.
   */
  async validateLicense(e = !1) {
    var l, m, E;
    const t = await this.getStoredLicense();
    if (!t || !t.licenseKey)
      return { success: !0, isValid: !1, message: "No license key found" };
    const s = Date.now();
    if (!e && t.lastValidatedAt && s - t.lastValidatedAt < 600 * 1e3)
      return { success: !0, isValid: t.status === "ACTIVE" && (!t.expiresAt || new Date(t.expiresAt).getTime() > s), data: t };
    const i = await this.getInstallationId(), n = await this.fetchApi("/licenses/validate", {
      method: "POST",
      body: {
        licenseKey: t.licenseKey,
        installationId: i
      }
    }), r = n.body || {};
    if (!n.ok || !r.success) {
      if (n.status === 0 || n.error)
        return t.status === "ACTIVE" && t.expiresAt && new Date(t.expiresAt).getTime() > s && s - (t.lastValidatedAt || 0) < T ? {
          success: !0,
          isValid: !0,
          data: t,
          message: "Server unreachable. Running with offline grace period."
        } : {
          success: !1,
          isValid: !1,
          data: t,
          message: "Server unreachable and offline grace period expired. Internet connection required to verify license."
        };
      const f = (l = r.error) == null ? void 0 : l.code;
      let g = "EXPIRED";
      f === "LICENSE_REVOKED" || f === "INSTALLATION_REVOKED" ? g = "REVOKED" : f === "LICENSE_SUSPENDED" ? g = "SUSPENDED" : f === "INVALID_LICENSE" || n.status === 404 ? g = "UNLICENSED" : (m = r.data) != null && m.status && (g = r.data.status);
      const A = {
        ...t,
        status: g,
        daysRemaining: ((E = r.data) == null ? void 0 : E.daysRemaining) ?? (g === "ACTIVE" ? t.daysRemaining : 0),
        lastValidatedAt: s
      };
      return await this.saveStoredLicense(A), {
        success: !1,
        isValid: !1,
        data: A,
        message: r.message || n.error || "License validation failed or expired."
      };
    }
    const a = r.data, c = {
      ...t,
      licenseId: a.licenseId || t.licenseId,
      status: a.status || "ACTIVE",
      activatedAt: a.activatedAt || t.activatedAt,
      expiresAt: a.expiresAt || t.expiresAt,
      daysRemaining: a.daysRemaining ?? t.daysRemaining,
      maxInstallations: a.maxInstallations ?? t.maxInstallations,
      activeInstallationsCount: a.activeInstallationsCount ?? t.activeInstallationsCount,
      availableSlots: a.availableSlots ?? t.availableSlots,
      lastValidatedAt: s
    };
    return await this.saveStoredLicense(c), { success: !0, isValid: c.status === "ACTIVE", data: c };
  }
  /**
   * Voluntarily releases this browser installation slot on the backend
   */
  async releaseInstallation() {
    const e = await this.getStoredLicense();
    if (!e || !e.licenseKey)
      return await this.saveStoredLicense(null), { success: !0, message: "Local installation cleared." };
    const t = await this.getInstallationId(), s = await this.fetchApi("/licenses/release-installation", {
      method: "POST",
      body: {
        licenseKey: e.licenseKey,
        installationId: t
      }
    }), i = s.body || {};
    return !s.ok || !i.success ? {
      success: !1,
      error: i.message || s.error || "Failed to release slot on server."
    } : (await this.saveStoredLicense(null), {
      success: !0,
      message: i.message || "Browser installation slot successfully released."
    });
  }
  /**
   * Heartbeat to record active usage presence
   */
  async heartbeat() {
    const e = await this.getStoredLicense();
    if (!e || !e.licenseId) return;
    const t = await this.getInstallationId();
    await this.fetchApi("/licenses/heartbeat", {
      method: "POST",
      body: {
        licenseId: e.licenseId,
        installationId: t
      }
    });
  }
  /**
   * Fetches dynamic active subscription plans from GET /api/v1/public/plans
   */
  async getPublicPlans() {
    const e = await this.fetchApi("/public/plans", { method: "GET" }), t = e.body || {};
    if (!e.ok || !t.success)
      throw new Error(t.message || e.error || "Failed to fetch subscription plans");
    return t.data || [];
  }
  /**
   * Fetches official payment numbers, pricing, and instructions
   */
  async getPaymentInstructions() {
    const e = await this.fetchApi("/public/payment-instructions", { method: "GET" }), t = e.body || {};
    if (!e.ok || !t.success)
      throw new Error(t.message || e.error || "Failed to fetch payment instructions");
    return t.data;
  }
  /**
   * Submits a bKash / Nagad payment request
   */
  async submitPaymentRequest(e) {
    var i, n, r, a, c, l, m;
    const t = await this.fetchApi("/payments/requests", {
      method: "POST",
      body: {
        transactionId: e.transactionId.trim().toUpperCase(),
        paymentMethod: e.paymentMethod,
        planId: e.planId || void 0,
        planCode: e.planCode,
        payerContact: e.payerContact.trim(),
        payerName: ((i = e.payerName) == null ? void 0 : i.trim()) || ((n = e.customerName) == null ? void 0 : n.trim()) || void 0,
        licenseId: e.licenseId || void 0,
        customerName: ((r = e.customerName) == null ? void 0 : r.trim()) || ((a = e.payerName) == null ? void 0 : a.trim()) || void 0
      }
    }), s = t.body || {};
    return !t.ok || !s.success ? { success: !1, error: s.message || ((m = (l = (c = s.error) == null ? void 0 : c.details) == null ? void 0 : l[0]) == null ? void 0 : m.message) || t.error || "Failed to submit payment request. Please check your transaction ID." } : {
      success: !0,
      data: s.data
    };
  }
  /**
   * Tests connectivity to the licensing server
   */
  async testServerConnection() {
    try {
      const e = await this.fetchApi("/health", { method: "GET" });
      return e.ok ? { success: !0, message: "Server reached successfully!" } : { success: !1, message: `Server error: HTTP ${e.status}` };
    } catch (e) {
      return { success: !1, message: e.message || "Connection failed" };
    }
  }
}
const L = new N(), w = "ivac_periodic_license_check";
async function p() {
  try {
    await L.hasActiveLicense() ? (chrome.action.setBadgeText({ text: "PRO" }), chrome.action.setBadgeBackgroundColor({ color: "#16a34a" })) : (chrome.action.setBadgeText({ text: "FREE" }), chrome.action.setBadgeBackgroundColor({ color: "#64748b" }));
  } catch {
    chrome.action.setBadgeText({ text: "IVAC" }), chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  }
}
chrome.runtime.onInstalled.addListener(async (o) => {
  o.reason === "install" ? console.log("[IVAC Assistant] Extension installed successfully.") : o.reason === "update" && console.log("[IVAC Assistant] Extension updated to new version."), typeof chrome.alarms < "u" && chrome.alarms.create(w, {
    delayInMinutes: 5,
    periodInMinutes: 360
  }), await p();
});
typeof chrome < "u" && chrome.storage && chrome.storage.onChanged && chrome.storage.onChanged.addListener((o, e) => {
  e === "local" && (o.ivac_client_license_state || o.ivac_assistant_license) && p();
});
typeof chrome.alarms < "u" && chrome.alarms.onAlarm.addListener(async (o) => {
  if (o.name === w)
    try {
      await L.validateLicense(!1), await L.heartbeat(), await p();
    } catch (e) {
      console.warn("[IVAC Assistant] Background license check warning:", e);
    }
});
chrome.runtime.onMessage.addListener((o, e, t) => {
  if (o.type === "PING")
    return t({ status: "PONG", timestamp: Date.now() }), !0;
  if (o.type === "GET_EXTENSION_INFO")
    return t({
      name: "IVAC Booking Assistant",
      version: chrome.runtime.getManifest().version,
      targetDomain: "appointment.ivacbd.com"
    }), !0;
  if (o.type === "REFRESH_LICENSE_BADGE")
    return p().then(() => t({ success: !0 })), !0;
  if (o.type === "LICENSE_API_FETCH") {
    const { url: s, options: i } = o.payload || {};
    return fetch(s, i).then(async (n) => {
      const r = await n.json().catch(() => ({}));
      t({
        ok: n.ok,
        status: n.status,
        body: r
      });
    }).catch((n) => {
      t({
        ok: !1,
        status: 0,
        body: {},
        error: n.message || "Network request failed"
      });
    }), !0;
  }
});
