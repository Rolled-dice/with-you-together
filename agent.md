# SomeoneNear Autonomous QA Browser Automation Agent Instruction (AGENT.md)

You are an **Autonomous Browser Automation Agent** tasked with executing a comprehensive End-to-End (E2E) quality assurance audit on the live SomeoneNear web application.

---

## 1. Mission & Operational Guidelines

- **Primary Target**: `https://someonenear.com` (Fallback: `https://www.someonenear.com`)
- **Primary Goal**: Validate all 8 core product surfaces, user flows, interactive widgets, forms, dialogs, and error handling.
- **Reporting Rule**: Log any broken links, unhandled console exceptions (`console.error`), network failures (HTTP 4xx/5xx), visual overlaps, or frozen states.

### Standard Execution Config
- **Viewports to Test**:
  1. **Desktop**: `1920 x 1080` (Standard Full Screen)
  2. **Mobile**: `390 x 844` (iPhone 14 / Pixel standard mobile emulation)
- **Timeouts**: Default element timeout: 8,000ms. Page load timeout: 20,000ms.
- **Test Data Hygiene**: Any newly created item (reminder, contact, circle, message) must include the prefix `[QA-Agent]` in its title/name so it can be distinguished or cleaned up.

---

## 2. Authentication Preconditions

For routes requiring login (`/_authenticated/*`):
1. Navigate to `https://someonenear.com/auth`
2. Test User Login:
   - Click "Sign in" tab
   - Email: Use configured test email (e.g. `test@someonenear.com` or create a new test account via "Create account" tab)
   - Password: Enter test password
   - Submit: Click `button:has-text("Sign in")`
3. Verify successful redirect to `/dashboard` or intended target route.

---

## 3. Detailed Test Suites by Surface

### Suite 1: Landing Page & Public Surfaces (`/`)
- [ ] **1.1 Hero Section**:
  - Open `https://someonenear.com/`
  - Verify `H1` contains `"SomeoneNear"` or `"Warm Family Presence"`
  - Verify logo squircle renders cleanly without broken image icon
  - Verify primary CTA button `"Start Care"` or `"Sign In"` is clickable
- [ ] **1.2 Pricing Section**:
  - Scroll to pricing card section (`#pricing` or `.sn-pricing`)
  - Verify India Pricing shows ₹3,000 / ₹5,000 with `"incl. 18% GST"` badge
  - Verify US / Global toggle shows $49 / $79
- [ ] **1.3 Footer & Legal Links**:
  - Verify `/terms`, `/privacy`, and `/safety` links load HTTP 200 with complete policy text.

---

### Suite 2: AI Companion Chat (`/companion`)
- [ ] **2.1 Chat Initialization**:
  - Navigate to `/companion`
  - Verify companion greeting message renders in chat bubble
  - Verify input box is focused and enabled: `textarea[placeholder*="message"]` or `input[placeholder*="message"]`
- [ ] **2.2 Message Dispatch & Streaming**:
  - Type: `"Hello! How can you support my family today? [QA-Agent]"`
  - Click Send button or press `Enter`
  - **Assertion**: Streaming response starts within 3 seconds; typing bubble resolves into markdown text.
- [ ] **2.3 Voice / Audio Mode**:
  - Verify microphone button is visible
  - Test audio player controls render if voice reply is enabled.

---

### Suite 3: Human Listeners & CRM Booking (`/listeners`)
- [ ] **3.1 Directory Render**:
  - Navigate to `/listeners`
  - Verify listener cards render with names, bios, badges, and high-contrast readable text.
- [ ] **3.2 Booking Dialog**:
  - Click `button:has-text("Book a call")` or `button:has-text("Schedule session")`
  - Modal opens:
    - Select Date (future date at least 2 hours ahead)
    - Select Time Slot
    - Enter Phone Number in E.164 format (e.g., `+91 98765 43210`)
    - Click submit
  - **Assertion**: Toast confirms `"Session booked"` or scheduling confirmation.
- [ ] **3.3 10-Min SLA Callback**:
  - Verify the emergency callback card displays with `"10-min SLA guarantee"`.

---

### Suite 4: Family Circle & 3D Interactive Globe (`/family`)
- [ ] **4.1 Canvas & WebGL Globe**:
  - Navigate to `/family`
  - Verify `<canvas>` element exists inside `.sn-family-globe`
  - Verify no WebGL runtime crashes in console
  - Simulate drag / rotate interaction on canvas
- [ ] **4.2 Circle Members**:
  - Verify member list cards render with avatars, timezones, and relationship badges.
- [ ] **4.3 Invite Flow**:
  - Click `button:has-text("Invite member")`
  - Enter test email `qa-member@test.com` and select role `Caregiver`
  - Verify invite link or toast is generated.

---

### Suite 5: Photo Meds & Reminders (`/reminders`)
- [ ] **5.1 Three-Subtab Navigation**:
  - Navigate to `/reminders`
  - Verify presence of 3 tabs:
    1. `① Medication Log`
    2. `② Parent & Self Reminders`
    3. `🔔 ③ Phone Alerts & Sync`
- [ ] **5.2 Medication Log**:
  - Under `① Medication Log`, verify list of medications
  - Click `"Log Dose"` on an existing medication
  - **Assertion**: Dose count increments with gentle check animation
- [ ] **5.3 Create Reminder**:
  - Switch to `② Parent & Self Reminders`
  - Fill Title: `"[QA-Agent] Morning Blood Pressure Check"`
  - Set Time: `"09:00"`
  - Select Category: `"Personal"` or `"Move / rest"`
  - Click `button:has-text("Add")`
  - **Assertion**: New reminder appears immediately in the reminders list.
- [ ] **5.4 Web Push & 1-Click Phone Alerts**:
  - Switch to `🔔 ③ Phone Alerts & Sync`
  - Card titled `"1-Click Phone & Device Alerts"` must be visible
  - Verify buttons:
    - `"Allow device notifications"`
    - `"Enable on this device"`
    - `"🔔 Send Test Phone Alert"`
  - Click `"🔔 Send Test Phone Alert"`
  - **Assertion**: Toast confirms push dispatch without throwing errors.
- [ ] **5.5 SMS Escalation Card**:
  - Verify Telnyx emergency fallback card renders with phone number input.

---

### Suite 6: Send Later Scheduled Messages (`/send-later`)
- [ ] **6.1 Schedule Message Composer**:
  - Navigate to `/send-later`
  - Enter recipient phone `+91 9876543210`
  - Enter body: `"[QA-Agent] Automated test scheduled reminder"`
  - Pick a delivery time 1 hour in the future
  - Click `button:has-text("Schedule message")`
  - **Assertion**: New item appears in the Scheduled Deliveries queue table with `pending` badge.

---

### Suite 7: Safety Hub, Crisis Lines & ICE Card (`/safety`)
- [ ] **7.1 Emergency Dialers**:
  - Navigate to `/safety`
  - Verify quick emergency links (`tel:112`, `tel:911`, `tel:999`, `tel:000`) exist with valid `tel:` schemas.
- [ ] **7.2 Box Breathing Widget (4-4-4-4)**:
  - Click `button:has-text("Start Breathing")`
  - Verify rhythm animation expands and text rotates between `"Inhale"`, `"Hold"`, `"Exhale"`, `"Hold"`.
- [ ] **7.3 5-4-3-2-1 Sensory Grounding**:
  - Check 5 sensory checklist items
  - **Assertion**: Progress reaches 100% and congratulatory badge appears.
- [ ] **7.4 ICE Emergency Medical Card**:
  - Click `button:has-text("Edit Card")`
  - Enter Blood Type `"O+"`, Emergency Contact `"Dr. Sharma (+91 98765 00000)"`
  - Click Save
  - **Assertion**: Card updates on screen; verify `"Print Care Card"` button triggers print preview.

---

### Suite 8: Mood Insights & Reflections (`/insights`)
- [ ] **8.1 Mood Logging**:
  - Navigate to `/insights`
  - Click one of the 5 mood emoji icons (`Peaceful`, `Good`, `Okay`, `Heavy`, `Overwhelmed`)
  - Enter note: `"[QA-Agent] Checking automated mood logging"`
  - Click `Save reflection`
  - **Assertion**: Mood graph / timeline updates with the new entry.

---

### Suite 9: Settings, HIPAA Privacy & Membership (`/settings`)
- [ ] **9.1 Lock Screen Privacy Mode**:
  - Navigate to `/settings`
  - Locate `"Lock Screen Health Privacy Mode"` toggle
  - Click toggle
  - **Assertion**: Toast confirms `"Health Privacy Mode Enabled (Sensitive medication and dose details hidden on lock screens)"`.
- [ ] **9.2 Account & Timezone**:
  - Verify user email and timezone display correctly.

---

## 4. Execution & Error Capture Rules for the Agent

When the browser automation agent encounters an error:
1. **Take a full-page screenshot**: Save to `./qa-reports/screenshots/<suite>-<step>-<timestamp>.png`
2. **Dump Console Logs**: Record all `console.error` and `console.warn` outputs.
3. **Capture Network Har/Failed Requests**: Log URL, HTTP status code, and response body for any failed API call.
4. **Format Summary Report**:
   ```json
   {
     "url": "https://someonenear.com",
     "timestamp": "2026-11-10T17:30:00Z",
     "suites_total": 9,
     "suites_passed": 9,
     "suites_failed": 0,
     "critical_bugs": [],
     "ux_notes": []
   }
   ```
