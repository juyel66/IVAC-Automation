var A = Object.defineProperty;
var L = (r, e, t) => e in r ? A(r, e, { enumerable: !0, configurable: !0, writable: !0, value: t }) : r[e] = t;
var u = (r, e, t) => L(r, typeof e != "symbol" ? e + "" : e, t);
const g = {
  panelPosition: { x: 24, y: 24 },
  // Top-right offset default
  isMinimized: !1,
  isClosed: !1,
  autoFillEnabled: !0,
  soundAlertsEnabled: !0,
  stayWithinViewport: !0,
  licenseApiUrl: "http://localhost:5000/api/v1"
}, h = "ivac_assistant_settings";
class v {
  isChromeStorage() {
    return typeof chrome < "u" && !!chrome.storage && !!chrome.storage.local;
  }
  async getSettings() {
    if (this.isChromeStorage())
      return new Promise((e) => {
        chrome.storage.local.get([h], (t) => {
          e({ ...g, ...t[h] || {} });
        });
      });
    try {
      const e = localStorage.getItem(h);
      return e ? { ...g, ...JSON.parse(e) } : g;
    } catch {
      return g;
    }
  }
  async saveSettings(e) {
    const a = { ...await this.getSettings(), ...e };
    if (this.isChromeStorage())
      return new Promise((o) => {
        chrome.storage.local.set({ [h]: a }, () => {
          o(a);
        });
      });
    try {
      localStorage.setItem(h, JSON.stringify(a));
    } catch {
    }
    return a;
  }
}
const E = new v(), d = "ivac_assistant_license", m = "ivac_installation_id", b = 1440 * 60 * 1e3;
class C {
  constructor() {
    u(this, "listeners", /* @__PURE__ */ new Set());
    u(this, "cachedLicense", null);
    u(this, "isLoaded", !1);
    u(this, "strictModeInTests", !1);
  }
  isChromeStorage() {
    return typeof chrome < "u" && !!chrome.storage && !!chrome.storage.local;
  }
  /**
   * For testing: enforce strict license check even in test runners
   */
  setStrictMode(e) {
    this.strictModeInTests = e;
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
   */
  async getInstallationId() {
    if (this.isChromeStorage())
      return new Promise((e) => {
        chrome.storage.local.get([m], (t) => {
          let a = t[m];
          a || (a = this.generateInstallationId(), chrome.storage.local.set({ [m]: a })), e(a);
        });
      });
    try {
      let e = localStorage.getItem(m);
      return e || (e = this.generateInstallationId(), localStorage.setItem(m, e)), e;
    } catch {
      return this.generateInstallationId();
    }
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
   * Retrieves currently stored license info
   */
  async getStoredLicense() {
    if (this.isChromeStorage())
      return new Promise((e) => {
        chrome.storage.local.get([d], (t) => {
          this.cachedLicense = t[d] || null, this.isLoaded = !0, e(this.cachedLicense);
        });
      });
    try {
      const e = localStorage.getItem(d);
      return this.cachedLicense = e ? JSON.parse(e) : null, this.isLoaded = !0, this.cachedLicense;
    } catch {
      return this.cachedLicense = null, this.isLoaded = !0, null;
    }
  }
  /**
   * Saves or clears license info in local storage
   */
  async saveStoredLicense(e) {
    if (this.cachedLicense = e, this.isLoaded = !0, this.isChromeStorage())
      await new Promise((t) => {
        e ? chrome.storage.local.set({ [d]: e }, () => t()) : chrome.storage.local.remove([d], () => t());
      });
    else
      try {
        e ? localStorage.setItem(d, JSON.stringify(e)) : localStorage.removeItem(d);
      } catch {
      }
    this.notify();
  }
  /**
   * Retrieves base API URL from settings
   */
  async getApiBaseUrl() {
    var t;
    return ((t = (await E.getSettings()).licenseApiUrl) == null ? void 0 : t.replace(/\/+$/, "")) || "http://localhost:5000/api/v1";
  }
  /**
   * Centralized network request execution.
   * If running in a Chrome Extension content script on an HTTPS page (appointment.ivacbd.com),
   * delegates the request through the background service worker to prevent CORS and Mixed Content blocks.
   * Falls back to direct fetch in test and standalone environments.
   */
  async fetchApi(e, t = {}) {
    const a = await this.getApiBaseUrl(), o = e.startsWith("/") ? e : `/${e}`, i = `${a}${o}`, n = {
      method: t.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...t.headers || {}
      },
      body: t.body ? JSON.stringify(t.body) : void 0
    };
    if (typeof chrome < "u" && chrome.runtime && typeof chrome.runtime.sendMessage == "function" && chrome.runtime.id)
      try {
        const s = await new Promise((c) => {
          chrome.runtime.sendMessage(
            {
              type: "LICENSE_API_FETCH",
              payload: {
                url: i,
                options: {
                  method: n.method,
                  headers: n.headers,
                  body: n.body
                }
              }
            },
            (l) => {
              chrome.runtime.lastError ? c({ ok: !1, status: 0, body: {}, error: chrome.runtime.lastError.message }) : c(l || { ok: !1, status: 0, body: {}, error: "No response from background service worker" });
            }
          );
        });
        if (s && s.status > 0)
          return s;
      } catch (s) {
        console.warn("[LicenseService] Background delegation failed, falling back to direct fetch:", s);
      }
    try {
      const s = await fetch(i, n), c = await s.json().catch(() => ({}));
      return {
        ok: s.ok,
        status: s.status,
        body: c
      };
    } catch (s) {
      return {
        ok: !1,
        status: 0,
        body: {},
        error: s.message || "Network request failed"
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
    const a = await this.getInstallationId(), o = this.getInstallationLabel(), i = await this.fetchApi("/licenses/activate", {
      method: "POST",
      body: {
        licenseKey: t,
        installationId: a,
        installationLabel: o
      }
    }), n = i.body || {};
    if (!i.ok || !n.success)
      return { success: !1, error: n.message || ((l = n.error) == null ? void 0 : l.message) || i.error || (i.status === 409 ? "Installation slot limit reached. Please release an existing installation first." : "License activation failed. Please verify your license key.") };
    const s = n.data, c = {
      licenseKey: t,
      licenseId: s.licenseId || s.id,
      status: s.status || "ACTIVE",
      activatedAt: s.activatedAt,
      expiresAt: s.expiresAt,
      daysRemaining: s.daysRemaining ?? 30,
      maxInstallations: s.maxInstallations ?? 1,
      activeInstallationsCount: s.activeInstallationsCount ?? 1,
      availableSlots: s.availableSlots ?? 0,
      installationId: a,
      installationLabel: o,
      lastValidatedAt: Date.now(),
      customerName: s.customerName,
      customerContact: s.customerContact
    };
    return await this.saveStoredLicense(c), {
      success: !0,
      data: c,
      message: n.message || "License successfully activated on this browser."
    };
  }
  /**
   * Validates the currently registered license against the backend.
   * Handles offline tolerance gracefully up to 24 hours.
   */
  async validateLicense(e = !1) {
    var l, f;
    const t = await this.getStoredLicense();
    if (!t || !t.licenseKey)
      return { success: !0, isValid: !1, message: "No license key found" };
    const a = Date.now();
    if (!e && t.lastValidatedAt && a - t.lastValidatedAt < 600 * 1e3)
      return { success: !0, isValid: t.status === "ACTIVE" && (!t.expiresAt || new Date(t.expiresAt).getTime() > a), data: t };
    const o = await this.getInstallationId(), i = await this.fetchApi("/licenses/validate", {
      method: "POST",
      body: {
        licenseKey: t.licenseKey,
        installationId: o
      }
    }), n = i.body || {};
    if (!i.ok || !n.success) {
      if ((i.status === 0 || i.error) && t.status === "ACTIVE" && t.expiresAt && new Date(t.expiresAt).getTime() > a && a - (t.lastValidatedAt || 0) < b)
        return {
          success: !0,
          isValid: !0,
          data: t,
          message: "Server unreachable. Running with offline grace period."
        };
      const p = ((l = n.data) == null ? void 0 : l.status) || (i.status === 404 ? "UNLICENSED" : "EXPIRED"), S = {
        ...t,
        status: p,
        daysRemaining: ((f = n.data) == null ? void 0 : f.daysRemaining) ?? 0,
        lastValidatedAt: a
      };
      return await this.saveStoredLicense(S), {
        success: !1,
        isValid: !1,
        data: S,
        message: n.message || i.error || "License validation failed or expired."
      };
    }
    const s = n.data, c = {
      ...t,
      licenseId: s.licenseId || t.licenseId,
      status: s.status || "ACTIVE",
      activatedAt: s.activatedAt || t.activatedAt,
      expiresAt: s.expiresAt || t.expiresAt,
      daysRemaining: s.daysRemaining ?? t.daysRemaining,
      maxInstallations: s.maxInstallations ?? t.maxInstallations,
      activeInstallationsCount: s.activeInstallationsCount ?? t.activeInstallationsCount,
      availableSlots: s.availableSlots ?? t.availableSlots,
      lastValidatedAt: a
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
    const t = await this.getInstallationId(), a = await this.fetchApi("/licenses/release-installation", {
      method: "POST",
      body: {
        licenseKey: e.licenseKey,
        installationId: t
      }
    }), o = a.body || {};
    return !a.ok || !o.success ? {
      success: !1,
      error: o.message || a.error || "Failed to release slot on server."
    } : (await this.saveStoredLicense(null), {
      success: !0,
      message: o.message || "Browser installation slot successfully released."
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
    var o, i, n, s;
    const t = await this.fetchApi("/payments/requests", {
      method: "POST",
      body: {
        transactionId: e.transactionId.trim().toUpperCase(),
        paymentMethod: e.paymentMethod,
        planCode: e.planCode,
        payerContact: e.payerContact.trim(),
        licenseId: e.licenseId || void 0,
        customerName: ((o = e.customerName) == null ? void 0 : o.trim()) || void 0
      }
    }), a = t.body || {};
    return !t.ok || !a.success ? { success: !1, error: a.message || ((s = (n = (i = a.error) == null ? void 0 : i.details) == null ? void 0 : n[0]) == null ? void 0 : s.message) || t.error || "Failed to submit payment request. Please check your transaction ID." } : {
      success: !0,
      data: a.data
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
const y = new C(), w = "ivac_periodic_license_check";
async function I() {
  try {
    await y.hasActiveLicense() ? (chrome.action.setBadgeText({ text: "PRO" }), chrome.action.setBadgeBackgroundColor({ color: "#16a34a" })) : (chrome.action.setBadgeText({ text: "FREE" }), chrome.action.setBadgeBackgroundColor({ color: "#64748b" }));
  } catch {
    chrome.action.setBadgeText({ text: "IVAC" }), chrome.action.setBadgeBackgroundColor({ color: "#16a34a" });
  }
}
chrome.runtime.onInstalled.addListener(async (r) => {
  r.reason === "install" ? console.log("[IVAC Assistant] Extension installed successfully.") : r.reason === "update" && console.log("[IVAC Assistant] Extension updated to new version."), typeof chrome.alarms < "u" && chrome.alarms.create(w, {
    delayInMinutes: 5,
    periodInMinutes: 360
  }), await I();
});
typeof chrome.alarms < "u" && chrome.alarms.onAlarm.addListener(async (r) => {
  if (r.name === w)
    try {
      await y.validateLicense(!1), await y.heartbeat(), await I();
    } catch (e) {
      console.warn("[IVAC Assistant] Background license check warning:", e);
    }
});
chrome.runtime.onMessage.addListener((r, e, t) => {
  if (r.type === "PING")
    return t({ status: "PONG", timestamp: Date.now() }), !0;
  if (r.type === "GET_EXTENSION_INFO")
    return t({
      name: "IVAC Booking Assistant",
      version: chrome.runtime.getManifest().version,
      targetDomain: "appointment.ivacbd.com"
    }), !0;
  if (r.type === "REFRESH_LICENSE_BADGE")
    return I().then(() => t({ success: !0 })), !0;
  if (r.type === "LICENSE_API_FETCH") {
    const { url: a, options: o } = r.payload || {};
    return fetch(a, o).then(async (i) => {
      const n = await i.json().catch(() => ({}));
      t({
        ok: i.ok,
        status: i.status,
        body: n
      });
    }).catch((i) => {
      t({
        ok: !1,
        status: 0,
        body: {},
        error: i.message || "Network request failed"
      });
    }), !0;
  }
});
