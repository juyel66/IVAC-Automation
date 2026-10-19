# IVAC Booking Assistant — Chrome Extension

A clean, maintainable, production-minded Chrome Extension (Manifest V3) built with React, TypeScript, Vite, Tailwind CSS, and IndexedDB to assist users with their own IVAC (Indian Visa Application Center) appointment workflow on [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/).

---

## 🌟 Key Features

1. **Floating Assistant UI with Shadow DOM Isolation**:
   - Injected strictly into `appointment.ivacbd.com` using Manifest V3 content scripts.
   - Wrapped inside Shadow DOM to guarantee 100% CSS style isolation.
   - Draggable using the mouse, with viewport boundary constraints.
   - Remembers position locally across page reloads and SPA transitions.
   - Minimize to a sleek floating badge, restore, and close without data loss.

2. **Multi-Applicant Profile Management**:
   - Create, edit, switch, and delete multiple applicant profiles.
   - Fields: Profile Display Name, Legal Applicant Name, IVAC Mobile Number, Preferred Centre (Dhaka, Rajshahi, Chittagong, Sylhet, etc.).
   - Strict Bangladeshi mobile number format validation (`013-019`, 11 digits).
   - Duplicate profile detection.

3. **PDF Document Management & IndexedDB Persistence**:
   - Separate upload for Primary Applicant PDF (mandatory).
   - Dynamically add up to 3 Additional Applicant PDFs (strict 4 applicants limit).
   - Drag & drop and native file picker support.
   - PDF MIME & 5MB file size validation.
   - Complete document binaries persisted in local **IndexedDB**, surviving browser restarts.
   - Preserves upload sequence (Primary first, then additionals in order: #1 -> #2 -> #3 -> #4).

4. **Security & Privacy Guardrails**:
   - **Zero telemetry or external network calls** — 100% local operation.
   - **Zero plaintext password storage** — passwords are kept in-memory only for the active session.
   - **No CAPTCHA or OTP bypass** — respects human verification and security controls.
   - **Mandatory Payment Handoff Stop** — completely halts automation on the payment screen.

5. **Finite-State Workflow Engine**:
   - States: `IDLE` -> `PROFILE_SELECTED` -> `LOGIN_READY` -> `WAITING_FOR_USER_AUTHENTICATION` -> `DOCUMENT_UPLOAD` -> `CENTRE_SELECTION` -> `APPOINTMENT_SELECTION` -> `PAYMENT_HANDOFF`.
   - Explicit user click on **Start** required.
   - Pause, Resume, and Stop controls with duplicate prevention.
   - Real-time event log stream.

---

## 🚀 How to Load in Google Chrome

1. Build the production extension:
   ```bash
   npm run build
   ```
2. Open Google Chrome and navigate to:
   ```
   chrome://extensions/
   ```
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked**.
5. Select the `dist` directory of this repository:
   ```
   c:\Users\Md Juyel Rana\Desktop\IVAC-Automation\dist
   ```
6. Navigate to [https://appointment.ivacbd.com/](https://appointment.ivacbd.com/) to see the assistant automatically appear!

---

## 🧪 Testing

Run unit tests via Vitest:
```bash
npm test
```
- **29 passing tests** covering:
  - Phone format validation & normalization
  - Profile validation & duplicate detection
  - PDF MIME & size checks
  - 4-document applicant limits
  - Profile repository CRUD & storage fallback
  - IndexedDB document persistence, sequencing & Blob retrieval
  - WorkflowEngine state machine transitions, pause/resume, and safety stops

---

## 📁 Architecture Overview

```
src/
├── app/
│   └── App.tsx                 # Root React entry point
├── components/
│   ├── FloatingPanel.tsx       # Draggable container, viewport constraints, tab routing
│   ├── PanelHeader.tsx         # Header, status badge, drag handle, minimize/close
│   ├── MinimizedButton.tsx     # Floating button when minimized
│   ├── Dashboard.tsx           # Profile summary, readiness check, start/pause/stop
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
├── storage/
│   ├── profileRepository.ts    # Chrome Storage API + fallback for profiles
│   ├── documentRepository.ts   # Native IndexedDB wrapper for PDF binary storage
│   └── settingsRepository.ts   # Persistent settings (position, minimized, etc.)
├── types/
│   ├── profile.ts              # Profile interfaces and supported centres
│   ├── document.ts             # Document metadata & limits
│   └── workflow.ts             # Finite-state machine types
└── utils/
    ├── validation.ts           # Validation functions
    └── errors.ts               # Custom error classes
```

---

## 📝 Documented Website Adapters & Verification Notes

Selectors in `src/content/adapters/` use multi-signal heuristics (input names, IDs, placeholders, standard form element types, and text content).

- **Login Form**: Matches `input[type="tel"]`, `name="mobile"`, `name="phone"`, `type="password"`.
- **Document Upload**: Matches active `input[type="file"]`. Sequential uploads dispatch standard `change` and `input` events. If the live site uses a restricted drag-and-drop widget, a manual fallback notification is provided.
- **Centre Selection**: Matches `select[name*="center"]`, `select[name*="centre"]`, or interactive radio cards.
- **Slot Selection**: Selects only explicitly enabled, non-disabled slot buttons (`!disabled`, `aria-disabled="false"`).
- **Payment Handoff**: Detects `/payment`, SSLCommerz, bKash keywords, and halts immediately.
