# IVAC Automation — Chrome Extension (Manifest V3)

A high-performance, privacy-first Chrome Extension built with React 18, TypeScript, Vite, Tailwind CSS, and IndexedDB to assist applicants with their IVAC (Indian Visa Application Center) appointment workflow on [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).

Equipped with a secure, backend-authorized license management client supporting multi-browser quota enforcement, installation release, and offline entitlement caching.

---

## 🌟 Key Features

1. **Server-Authoritative Licensing & Multi-Browser Support**:
   - Activate license keys (`IVAC-XXXX-XXXX-XXXX-XXXX`) directly in the extension.
   - Real-time display of license status, activation date, exact expiry date, and days remaining.
   - Installation slot counter (e.g. `1 / 2 registered browsers`, `1 available slot`).
   - **Release This Installation:** Instantly surrender this browser's active slot to free it up for another workstation or team member.
   - Built-in renewal & manual payment submission modal (bKash / Nagad / Bank transfer).
   - Tamper-proof workflow engine enforcement (`workflowEngine.start()` halts unauthorized runs).

2. **Floating Assistant UI with Shadow DOM Isolation**:
   - Injected strictly into `appointment.ivacbd.com` using Manifest V3 content scripts.
   - Wrapped inside Shadow DOM to guarantee 100% CSS style isolation.
   - Draggable using the mouse, with viewport boundary constraints.
   - Remembers position locally across page reloads and SPA transitions.
   - Minimize to a sleek floating badge, restore, and close without data loss.

3. **Multi-Applicant Profile Management**:
   - Create, edit, switch, and delete multiple applicant profiles.
   - Fields: Profile Display Name, Legal Applicant Name, IVAC Mobile Number, Preferred Centre (Dhaka, Rajshahi, Chittagong, Sylhet, etc.).
   - Strict Bangladeshi mobile number format validation (`013-019`, 11 digits).
   - Duplicate profile detection.

4. **PDF Document Management & IndexedDB Persistence**:
   - Separate upload for Primary Applicant PDF (mandatory).
   - Dynamically add up to 3 Additional Applicant PDFs (strict 4 applicants limit).
   - Drag & drop and native file picker support.
   - PDF MIME & 5MB file size validation.
   - Complete document binaries persisted in local **IndexedDB**, surviving browser restarts.
   - Preserves upload sequence (Primary first, then additionals in order: #1 -> #2 -> #3 -> #4).

5. **Security & Privacy Guardrails**:
   - **Zero telemetry or unauthorized data collection** — credentials and PDF documents are strictly local to the user's browser.
   - **Zero plaintext password storage** — passwords are encrypted via AES-256-GCM.
   - **No CAPTCHA or OTP bypass** — respects human verification and security controls.
   - **Mandatory Payment Handoff Stop** — completely halts automation on the payment screen.

6. **Finite-State Workflow Engine**:
   - States: `IDLE` -> `PROFILE_SELECTED` -> `LOGIN_READY` -> `WAITING_FOR_USER_AUTHENTICATION` -> `DOCUMENT_UPLOAD` -> `CENTRE_SELECTION` -> `APPOINTMENT_SELECTION` -> `PAYMENT_HANDOFF`.
   - Explicit user click on **Start** required.
   - Pause, Resume, and Stop controls with duplicate prevention.
   - Real-time event log stream.

---

## 🚀 How to Load in Google Chrome

1. **Install Dependencies & Build**:
   ```bash
   npm install
   npm run build
   ```
2. **Open Google Chrome Extensions**:
   - Navigate to `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
3. **Load the Unpacked Bundle**:
   - Click **Load unpacked**.
   - Select the `dist/` directory inside this repository.
4. **Usage**:
   - Navigate to [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).
   - Click the **License** pill button on the floating assistant to activate your license key.

---

## 🧪 Automated Testing

Run the full suite of unit and integration tests via Vitest:
```bash
npm test
```

- **13 test suites, 138 passing tests** covering:
  - Phone format validation & normalization
  - Profile validation & duplicate detection
  - PDF MIME & size checks (4-document applicant limits)
  - IndexedDB document persistence, sequencing & Blob retrieval
  - WorkflowEngine state machine transitions, pause/resume, and safety stops
  - License activation, multi-browser installation limits, slot release, offline caching, and server enforcement

---

## 📁 Project Structure

```text
src/
├── app/
│   └── App.tsx                 # Root React entry point
├── components/
│   ├── FloatingPanel.tsx       # Draggable container, viewport constraints, tab routing
│   ├── LicenseModal.tsx        # License activation, slot release, and manual payment modal
│   ├── PanelHeader.tsx         # Header, status badge, drag handle, minimize/close
│   ├── MinimizedButton.tsx     # Floating button when minimized
│   ├── Dashboard.tsx           # Profile summary, license banner, readiness check, start/stop
│   ├── ProfileList.tsx         # Profile CRUD and active profile switcher
│   ├── ProfileForm.tsx         # Profile form with live validation
│   ├── PdfUploader.tsx         # PDF upload, drag-and-drop, IndexedDB sync
│   ├── WorkflowProgress.tsx    # Visual pipeline and live event stream
│   └── Settings.tsx            # Viewport bounds, reset position, privacy status
├── content/
│   ├── index.tsx               # Shadow DOM injection and React mounting
│   ├── pageDetector.ts         # Route detection, SPA history hooks, MutationObserver
│   └── adapters/
│       ├── loginAdapter.ts      # Safe credential filling without CAPTCHA bypass
│       ├── documentAdapter.ts   # Sequential PDF upload handler with fallback
│       ├── centreAdapter.ts     # Preferred centre dropdown selector
│       ├── appointmentAdapter.ts# Slot scanner with anti-loop safeguards
│       └── paymentAdapter.ts    # Enforces hard stop at payment gateway
├── background/
│   └── serviceWorker.ts        # Manifest V3 service worker lifecycle
├── features/
│   ├── license/
│   │   └── licenseClient.ts    # Client license API, installation identity, entitlement cache
│   └── workflow/
│       └── workflowEngine.ts   # Workflow finite-state engine with license security gate
├── storage/
│   ├── profileRepository.ts    # Chrome Storage API + fallback for profiles
│   ├── documentRepository.ts   # Native IndexedDB wrapper for PDF binary storage
│   └── settingsRepository.ts   # Persistent settings (position, minimized, etc.)
├── types/
│   ├── license.ts              # License state and payment types
│   ├── profile.ts              # Profile interfaces and supported centres
│   ├── document.ts             # Document metadata & limits
│   └── workflow.ts             # Finite-state machine types
└── utils/
    ├── validation.ts           # Validation functions
    └── errors.ts               # Custom error classes
```
