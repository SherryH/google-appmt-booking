# Therapist Appointment Auto-Booking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an automated tool that books therapist appointments at midnight when new slots are released, with ranked preferences and email notifications.

**Architecture:** Node.js app with Puppeteer for browser automation, Resend for email, deployed to Replit with cron scheduling. Mobile trigger via Replit shell commands.

**Tech Stack:** Node.js, Puppeteer, Resend, Replit Deployments

**Development Strategy:** Vertical slices with mocked dependencies first, real integrations last. Each slice is independently verifiable.

---

## Slice Overview

| Slice | What's Built | Automated Test | Human Verification |
|-------|--------------|----------------|-------------------|
| **1** | CLI + Config | ✅ Config load/save | `npm run status` works |
| **2** | Booking flow (mocked) | ✅ Preference matching | `npm run book --dry-run` |
| **3** | Email notifications | ✅ Mocked Resend | Receive real email |
| **4** | Real scraper | ❌ (unknown structure) | Book on test calendar |
| **5** | Replit deployment | ❌ | Full flow on Replit |

---

## Slice 1: CLI + Config (Foundation)

**Goal:** Working CLI that can activate/deactivate/show status.

**Checkpoint:** `npm run status` displays config correctly.

---

### Task 1.1: Initialize Project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `config/config.example.json`
- Create: `config/config.json`

**Step 1: Initialize npm project**

```bash
cd ~/Projects/google-appmt-booking
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install puppeteer resend
npm install --save-dev jest
```

**Step 3: Update package.json**

Edit `package.json`:

```json
{
  "name": "google-appmt-booking",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "activate": "node src/index.js activate",
    "status": "node src/index.js status",
    "deactivate": "node src/index.js deactivate",
    "book": "node src/index.js book",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 4: Create .gitignore**

Create `.gitignore`:

```
node_modules/
config/config.json
.env
*.log
```

**Step 5: Create example config**

Create `config/config.example.json`:

```json
{
  "booking_url": "https://calendar.google.com/calendar/appointments/YOUR_LINK",
  "preferences": ["Tue 3pm", "Thu 2pm", "Wed 4pm"],
  "active": false,
  "email": "your@email.com",
  "consecutive_failures": 0
}
```

**Step 6: Create actual config**

```bash
cp config/config.example.json config/config.json
```

**Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore config/config.example.json
git commit -m "chore: initialize project with dependencies"
```

---

### Task 1.2: Config Module with Tests

**Files:**
- Create: `src/config.js`
- Create: `src/__tests__/config.test.js`

**Step 1: Write failing test**

Create `src/__tests__/config.test.js`:

```javascript
import { loadConfig, saveConfig } from '../config.js';
import fs from 'fs/promises';
import path from 'path';

describe('Config Module', () => {
  const testConfigPath = path.join(process.cwd(), 'config/config.test.json');

  beforeEach(async () => {
    await fs.writeFile(testConfigPath, JSON.stringify({
      booking_url: "https://test.com",
      preferences: ["Mon 9am"],
      active: false,
      email: "test@test.com",
      consecutive_failures: 0
    }));
  });

  afterEach(async () => {
    try { await fs.unlink(testConfigPath); } catch (e) {}
  });

  test('loadConfig returns config object', async () => {
    const config = await loadConfig(testConfigPath);
    expect(config.booking_url).toBe("https://test.com");
    expect(config.preferences).toEqual(["Mon 9am"]);
    expect(config.active).toBe(false);
  });

  test('saveConfig persists changes', async () => {
    const config = await loadConfig(testConfigPath);
    config.active = true;
    await saveConfig(config, testConfigPath);

    const reloaded = await loadConfig(testConfigPath);
    expect(reloaded.active).toBe(true);
  });
});
```

**Step 2: Run test - expect FAIL**

```bash
npm test -- src/__tests__/config.test.js
```

Expected: FAIL - "Cannot find module"

**Step 3: Write implementation**

Create `src/config.js`:

```javascript
import fs from 'fs/promises';
import path from 'path';

const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'config/config.json');

export function getConfigPath() {
  return DEFAULT_CONFIG_PATH;
}

export async function loadConfig(configPath = DEFAULT_CONFIG_PATH) {
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

export async function saveConfig(config, configPath = DEFAULT_CONFIG_PATH) {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}
```

**Step 4: Run test - expect PASS**

```bash
npm test -- src/__tests__/config.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/config.js src/__tests__/config.test.js
git commit -m "feat: add config module with tests"
```

---

### Task 1.3: CLI Entry Point (Status Only)

**Files:**
- Create: `src/index.js`

**Step 1: Create minimal CLI**

Create `src/index.js`:

```javascript
import { loadConfig, saveConfig } from './config.js';
import readline from 'readline';

const COMMANDS = {
  activate: activateJob,
  deactivate: deactivateJob,
  status: showStatus,
  menu: showMenu,
};

async function main() {
  const command = process.argv[2];

  if (command && COMMANDS[command]) {
    await COMMANDS[command]();
  } else {
    await showMenu();
  }
}

async function showMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n📅 Therapist Appointment Booker\n');
  console.log('What would you like to do?');
  console.log('[1] Activate booking job');
  console.log('[2] Check status');
  console.log('[3] Deactivate booking job');
  console.log('[4] Run booking now');
  console.log('[5] Exit\n');

  rl.question('Enter choice: ', async (answer) => {
    rl.close();

    switch (answer) {
      case '1': await activateJob(); break;
      case '2': await showStatus(); break;
      case '3': await deactivateJob(); break;
      case '4': console.log('⚠️  Booking not implemented yet'); break;
      case '5': process.exit(0);
      default: console.log('Invalid choice');
    }
  });
}

async function activateJob() {
  const config = await loadConfig();
  config.active = true;
  config.consecutive_failures = 0;
  await saveConfig(config);
  console.log('✅ Booking job activated! Will attempt booking at midnight.');
}

async function deactivateJob() {
  const config = await loadConfig();
  config.active = false;
  await saveConfig(config);
  console.log('🛑 Booking job deactivated.');
}

async function showStatus() {
  const config = await loadConfig();
  console.log('\n📊 Current Status:');
  console.log(`   Active: ${config.active ? '✅ Yes' : '❌ No'}`);
  console.log(`   Booking URL: ${config.booking_url.substring(0, 50)}...`);
  console.log(`   Preferences: ${config.preferences.join(', ')}`);
  console.log(`   Email: ${config.email}`);
  console.log(`   Consecutive failures: ${config.consecutive_failures}\n`);
}

main().catch(console.error);
```

**Step 2: Test CLI manually**

```bash
npm run status
```

Expected output:
```
📊 Current Status:
   Active: ❌ No
   Booking URL: https://calendar.google.com/calendar/appointme...
   Preferences: Tue 3pm, Thu 2pm, Wed 4pm
   Email: your@email.com
   Consecutive failures: 0
```

**Step 3: Test activate/deactivate**

```bash
npm run activate
npm run status
npm run deactivate
npm run status
```

**Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat: add CLI with activate/deactivate/status"
```

---

### ✅ Slice 1 Checkpoint

**Automated:** `npm test` passes (config tests)

**Human verification:**
- [ ] `npm run status` shows config
- [ ] `npm run activate` sets active to true
- [ ] `npm run deactivate` sets active to false

---

## Slice 2: Booking Flow with Mocks

**Goal:** Complete booking flow using mocked slot data. No real browser automation yet.

**Checkpoint:** `npm run book --dry-run` selects correct slot based on preferences.

---

### Task 2.1: Slot Matching Logic with Tests

**Files:**
- Create: `src/matcher.js`
- Create: `src/__tests__/matcher.test.js`

**Step 1: Write failing tests**

Create `src/__tests__/matcher.test.js`:

```javascript
import { normalizeSlot, matchPreferences } from '../matcher.js';

describe('Matcher Module', () => {
  describe('normalizeSlot', () => {
    test('normalizes various formats', () => {
      expect(normalizeSlot('Tuesday 3:00 PM')).toBe('tue 3pm');
      expect(normalizeSlot('Wed 2:00pm')).toBe('wed 2pm');
      expect(normalizeSlot('THURSDAY 10:00 AM')).toBe('thu 10am');
      expect(normalizeSlot('Tue 3pm')).toBe('tue 3pm');
    });
  });

  describe('matchPreferences', () => {
    const availableSlots = [
      { text: 'Monday 9:00 AM', normalized: 'mon 9am' },
      { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
      { text: 'Wednesday 4:00 PM', normalized: 'wed 4pm' },
    ];

    test('returns first matching preference', () => {
      const preferences = ['thu 2pm', 'tue 3pm', 'wed 4pm'];
      const match = matchPreferences(availableSlots, preferences);
      expect(match.normalized).toBe('tue 3pm');
    });

    test('returns null when no match', () => {
      const preferences = ['fri 5pm'];
      const match = matchPreferences(availableSlots, preferences);
      expect(match).toBeNull();
    });

    test('respects preference order (first pref wins)', () => {
      const preferences = ['wed 4pm', 'tue 3pm'];
      const match = matchPreferences(availableSlots, preferences);
      expect(match.normalized).toBe('wed 4pm');
    });

    test('handles empty available slots', () => {
      const match = matchPreferences([], ['tue 3pm']);
      expect(match).toBeNull();
    });

    test('handles empty preferences', () => {
      const match = matchPreferences(availableSlots, []);
      expect(match).toBeNull();
    });
  });
});
```

**Step 2: Run test - expect FAIL**

```bash
npm test -- src/__tests__/matcher.test.js
```

**Step 3: Write implementation**

Create `src/matcher.js`:

```javascript
const DAY_MAP = {
  'sunday': 'sun', 'sun': 'sun',
  'monday': 'mon', 'mon': 'mon',
  'tuesday': 'tue', 'tue': 'tue',
  'wednesday': 'wed', 'wed': 'wed',
  'thursday': 'thu', 'thu': 'thu',
  'friday': 'fri', 'fri': 'fri',
  'saturday': 'sat', 'sat': 'sat',
};

export function normalizeSlot(slotText) {
  if (!slotText) return null;
  const text = slotText.toLowerCase();

  // Extract day
  let day = null;
  for (const [full, short] of Object.entries(DAY_MAP)) {
    if (text.includes(full)) {
      day = short;
      break;
    }
  }
  if (!day) return null;

  // Extract time - match patterns like "3:00 PM", "3pm", "15:00"
  const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1]);
  let period = timeMatch[3]?.toLowerCase();

  // Infer period if not provided (assume 24h format)
  if (!period) {
    period = hour >= 12 ? 'pm' : 'am';
    if (hour > 12) hour -= 12;
  }

  return `${day} ${hour}${period}`;
}

export function matchPreferences(availableSlots, preferences) {
  if (!availableSlots.length || !preferences.length) return null;

  // Normalize preferences for comparison
  const normalizedPrefs = preferences.map(p => normalizeSlot(p) || p.toLowerCase());

  // Find first preference that has an available slot
  for (const pref of normalizedPrefs) {
    const match = availableSlots.find(slot => slot.normalized === pref);
    if (match) return match;
  }

  return null;
}
```

**Step 4: Run test - expect PASS**

```bash
npm test -- src/__tests__/matcher.test.js
```

**Step 5: Commit**

```bash
git add src/matcher.js src/__tests__/matcher.test.js
git commit -m "feat: add slot matching logic with tests"
```

---

### Task 2.2: Booking Service with Mock Support

**Files:**
- Create: `src/booking-service.js`
- Create: `src/__tests__/booking-service.test.js`

**Step 1: Write failing tests**

Create `src/__tests__/booking-service.test.js`:

```javascript
import { BookingService } from '../booking-service.js';

describe('BookingService', () => {
  const mockConfig = {
    booking_url: 'https://test.com',
    preferences: ['tue 3pm', 'wed 4pm'],
    email: 'test@test.com',
    active: true,
    consecutive_failures: 0
  };

  describe('with mocked slots', () => {
    test('returns success when preference matches', async () => {
      const mockSlots = [
        { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
        { text: 'Friday 5:00 PM', normalized: 'fri 5pm' },
      ];

      const service = new BookingService({ dryRun: true });
      const result = await service.attemptBooking(mockConfig, mockSlots);

      expect(result.success).toBe(true);
      expect(result.slot.normalized).toBe('tue 3pm');
      expect(result.dryRun).toBe(true);
    });

    test('returns no_match when no preference available', async () => {
      const mockSlots = [
        { text: 'Friday 5:00 PM', normalized: 'fri 5pm' },
      ];

      const service = new BookingService({ dryRun: true });
      const result = await service.attemptBooking(mockConfig, mockSlots);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_match');
      expect(result.availableSlots).toContain('Friday 5:00 PM');
    });

    test('returns no_slots when empty', async () => {
      const service = new BookingService({ dryRun: true });
      const result = await service.attemptBooking(mockConfig, []);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_slots');
    });

    test('respects preference order', async () => {
      const mockSlots = [
        { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
        { text: 'Wednesday 4:00 PM', normalized: 'wed 4pm' },
      ];

      const configWithDifferentOrder = {
        ...mockConfig,
        preferences: ['wed 4pm', 'tue 3pm'] // Wed first
      };

      const service = new BookingService({ dryRun: true });
      const result = await service.attemptBooking(configWithDifferentOrder, mockSlots);

      expect(result.slot.normalized).toBe('wed 4pm');
    });
  });
});
```

**Step 2: Run test - expect FAIL**

```bash
npm test -- src/__tests__/booking-service.test.js
```

**Step 3: Write implementation**

Create `src/booking-service.js`:

```javascript
import { matchPreferences, normalizeSlot } from './matcher.js';

export class BookingService {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.scraper = options.scraper || null; // Injected for real scraping
  }

  async attemptBooking(config, mockSlots = null) {
    const { preferences } = config;

    // Get available slots (mocked or real)
    let availableSlots;
    if (mockSlots !== null) {
      availableSlots = mockSlots;
      console.log(`🧪 Using ${mockSlots.length} mocked slots`);
    } else if (this.scraper) {
      console.log(`🔍 Scraping real slots from: ${config.booking_url}`);
      availableSlots = await this.scraper.scrape(config.booking_url);
    } else {
      throw new Error('No slots provided and no scraper configured');
    }

    // Check if any slots available
    if (!availableSlots || availableSlots.length === 0) {
      return {
        success: false,
        reason: 'no_slots',
        availableSlots: []
      };
    }

    console.log(`📋 Found ${availableSlots.length} available slots`);
    console.log(`🎯 Matching against preferences: ${preferences.join(', ')}`);

    // Match preferences
    const matchedSlot = matchPreferences(availableSlots, preferences);

    if (!matchedSlot) {
      return {
        success: false,
        reason: 'no_match',
        availableSlots: availableSlots.map(s => s.text)
      };
    }

    console.log(`✅ Matched slot: ${matchedSlot.text}`);

    // Dry run - don't actually book
    if (this.dryRun) {
      console.log(`🧪 DRY RUN - would book: ${matchedSlot.text}`);
      return {
        success: true,
        slot: matchedSlot,
        dryRun: true
      };
    }

    // Real booking (to be implemented with Puppeteer)
    if (this.scraper && this.scraper.book) {
      const booked = await this.scraper.book(matchedSlot, config.email);
      return {
        success: booked,
        slot: matchedSlot,
        reason: booked ? null : 'booking_failed'
      };
    }

    return {
      success: true,
      slot: matchedSlot,
      dryRun: true
    };
  }
}
```

**Step 4: Run test - expect PASS**

```bash
npm test -- src/__tests__/booking-service.test.js
```

**Step 5: Commit**

```bash
git add src/booking-service.js src/__tests__/booking-service.test.js
git commit -m "feat: add booking service with mock support"
```

---

### Task 2.3: Integrate Booking into CLI

**Files:**
- Modify: `src/index.js`

**Step 1: Update CLI with booking command**

Update `src/index.js`:

```javascript
import { loadConfig, saveConfig } from './config.js';
import { BookingService } from './booking-service.js';
import readline from 'readline';

const COMMANDS = {
  activate: activateJob,
  deactivate: deactivateJob,
  status: showStatus,
  book: runBooking,
  menu: showMenu,
};

async function main() {
  const command = process.argv[2];

  if (command && COMMANDS[command]) {
    await COMMANDS[command]();
  } else {
    await showMenu();
  }
}

async function showMenu() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n📅 Therapist Appointment Booker\n');
  console.log('What would you like to do?');
  console.log('[1] Activate booking job');
  console.log('[2] Check status');
  console.log('[3] Deactivate booking job');
  console.log('[4] Run booking now');
  console.log('[5] Exit\n');

  rl.question('Enter choice: ', async (answer) => {
    rl.close();

    switch (answer) {
      case '1': await activateJob(); break;
      case '2': await showStatus(); break;
      case '3': await deactivateJob(); break;
      case '4': await runBooking(); break;
      case '5': process.exit(0);
      default: console.log('Invalid choice');
    }
  });
}

async function activateJob() {
  const config = await loadConfig();
  config.active = true;
  config.consecutive_failures = 0;
  await saveConfig(config);
  console.log('✅ Booking job activated! Will attempt booking at midnight.');
}

async function deactivateJob() {
  const config = await loadConfig();
  config.active = false;
  await saveConfig(config);
  console.log('🛑 Booking job deactivated.');
}

async function showStatus() {
  const config = await loadConfig();
  console.log('\n📊 Current Status:');
  console.log(`   Active: ${config.active ? '✅ Yes' : '❌ No'}`);
  console.log(`   Booking URL: ${config.booking_url.substring(0, 50)}...`);
  console.log(`   Preferences: ${config.preferences.join(', ')}`);
  console.log(`   Email: ${config.email}`);
  console.log(`   Consecutive failures: ${config.consecutive_failures}\n`);
}

async function runBooking() {
  const isDryRun = process.argv.includes('--dry-run');
  const useMock = process.argv.includes('--mock');

  console.log('\n🚀 Starting booking attempt...\n');

  const config = await loadConfig();

  if (!config.active && !process.argv.includes('--force')) {
    console.log('⚠️  Job is not active. Use --force to run anyway.');
    return;
  }

  // Mock slots for testing
  const mockSlots = useMock ? [
    { text: 'Monday 9:00 AM', normalized: 'mon 9am' },
    { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
    { text: 'Wednesday 4:00 PM', normalized: 'wed 4pm' },
    { text: 'Thursday 2:00 PM', normalized: 'thu 2pm' },
    { text: 'Friday 11:00 AM', normalized: 'fri 11am' },
  ] : null;

  const service = new BookingService({ dryRun: isDryRun || useMock });

  try {
    const result = await service.attemptBooking(config, mockSlots);

    if (result.success) {
      console.log(`\n🎉 SUCCESS! ${result.dryRun ? '(DRY RUN) Would book' : 'Booked'}: ${result.slot.text}`);
      config.consecutive_failures = 0;
    } else {
      config.consecutive_failures += 1;
      console.log(`\n❌ Booking failed: ${result.reason}`);
      console.log(`   Consecutive failures: ${config.consecutive_failures}`);

      if (result.availableSlots?.length > 0) {
        console.log(`   Available slots: ${result.availableSlots.join(', ')}`);
      }
    }

    await saveConfig(config);

  } catch (error) {
    console.error(`\n💥 Error: ${error.message}`);
    config.consecutive_failures += 1;
    await saveConfig(config);
  }
}

main().catch(console.error);

export { runBooking };
```

**Step 2: Test with mock data**

```bash
npm run book -- --mock --force
```

Expected output:
```
🚀 Starting booking attempt...

🧪 Using 5 mocked slots
📋 Found 5 available slots
🎯 Matching against preferences: Tue 3pm, Thu 2pm, Wed 4pm
✅ Matched slot: Tuesday 3:00 PM
🧪 DRY RUN - would book: Tuesday 3:00 PM

🎉 SUCCESS! (DRY RUN) Would book: Tuesday 3:00 PM
```

**Step 3: Test with different preferences**

Edit `config/config.json` to change preference order, run again, verify correct slot selected.

**Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat: integrate booking service into CLI"
```

---

### ✅ Slice 2 Checkpoint

**Automated:** `npm test` passes (all tests)

**Human verification:**
- [ ] `npm run book -- --mock --force` shows correct slot based on preferences
- [ ] Changing preference order in config changes selected slot
- [ ] `npm run book -- --mock --force` with no matching prefs shows "no_match"

---

## Slice 3: Email Notifications

**Goal:** Send real emails on booking success/failure.

**Checkpoint:** Receive actual email in your inbox.

---

### Task 3.1: Notifier Module with Tests

**Files:**
- Create: `src/notifier.js`
- Create: `src/__tests__/notifier.test.js`

**Step 1: Write failing tests**

Create `src/__tests__/notifier.test.js`:

```javascript
import { shouldNotifyFailure, formatSuccessEmail, formatFailureEmail } from '../notifier.js';

describe('Notifier Module', () => {
  describe('shouldNotifyFailure', () => {
    test('returns false for 1-2 failures', () => {
      expect(shouldNotifyFailure(1)).toBe(false);
      expect(shouldNotifyFailure(2)).toBe(false);
    });

    test('returns true at 3 failures', () => {
      expect(shouldNotifyFailure(3)).toBe(true);
    });

    test('returns true every 3rd failure', () => {
      expect(shouldNotifyFailure(6)).toBe(true);
      expect(shouldNotifyFailure(9)).toBe(true);
    });

    test('returns false for non-3rd failures', () => {
      expect(shouldNotifyFailure(4)).toBe(false);
      expect(shouldNotifyFailure(5)).toBe(false);
      expect(shouldNotifyFailure(7)).toBe(false);
    });
  });

  describe('formatSuccessEmail', () => {
    test('formats success email correctly', () => {
      const result = formatSuccessEmail({
        text: 'Tuesday 3:00 PM',
        normalized: 'tue 3pm'
      });

      expect(result.subject).toContain('Booked');
      expect(result.html).toContain('Tuesday 3:00 PM');
    });
  });

  describe('formatFailureEmail', () => {
    test('formats failure email correctly', () => {
      const result = formatFailureEmail('no_match', 3, ['Mon 9am', 'Fri 5pm']);

      expect(result.subject).toContain('Issue');
      expect(result.html).toContain('no_match');
      expect(result.html).toContain('3');
    });
  });
});
```

**Step 2: Run test - expect FAIL**

```bash
npm test -- src/__tests__/notifier.test.js
```

**Step 3: Write implementation**

Create `src/notifier.js`:

```javascript
import { Resend } from 'resend';

let resend = null;

export function initNotifier(apiKey) {
  if (!apiKey) {
    console.warn('⚠️  No Resend API key provided - emails disabled');
    return;
  }
  resend = new Resend(apiKey);
}

export function isNotifierReady() {
  return resend !== null;
}

export function shouldNotifyFailure(consecutiveFailures) {
  return consecutiveFailures > 0 && consecutiveFailures % 3 === 0;
}

export function formatSuccessEmail(slot) {
  return {
    subject: '🎉 Appointment Booked Successfully!',
    html: `
      <h1>Your appointment has been booked!</h1>
      <p><strong>Time:</strong> ${slot.text}</p>
      <p><strong>Normalized:</strong> ${slot.normalized}</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        Sent by Therapist Appointment Booker
      </p>
    `
  };
}

export function formatFailureEmail(reason, consecutiveFailures, availableSlots = []) {
  return {
    subject: `⚠️ Booking Issue (${consecutiveFailures} consecutive failures)`,
    html: `
      <h1>Booking encountered an issue</h1>
      <p><strong>Reason:</strong> ${reason}</p>
      <p><strong>Consecutive failures:</strong> ${consecutiveFailures}</p>
      ${availableSlots.length > 0 ? `
        <p><strong>Available slots were:</strong></p>
        <ul>
          ${availableSlots.map(s => `<li>${s}</li>`).join('')}
        </ul>
      ` : ''}
      <p>The bot will retry tomorrow at midnight.</p>
      <hr>
      <p style="color: #666; font-size: 12px;">
        Sent by Therapist Appointment Booker
      </p>
    `
  };
}

export async function sendEmail(to, { subject, html }) {
  if (!resend) {
    console.log(`📧 [MOCK] Would send email to ${to}: ${subject}`);
    return { success: true, mock: true };
  }

  try {
    const result = await resend.emails.send({
      from: 'Booking Bot <onboarding@resend.dev>',
      to,
      subject,
      html
    });
    console.log(`📧 Email sent: ${subject}`);
    return { success: true, id: result.id };
  } catch (error) {
    console.error(`📧 Email failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function sendBookingSuccess(email, slot) {
  const content = formatSuccessEmail(slot);
  return sendEmail(email, content);
}

export async function sendBookingFailure(email, reason, consecutiveFailures, availableSlots) {
  const content = formatFailureEmail(reason, consecutiveFailures, availableSlots);
  return sendEmail(email, content);
}
```

**Step 4: Run test - expect PASS**

```bash
npm test -- src/__tests__/notifier.test.js
```

**Step 5: Commit**

```bash
git add src/notifier.js src/__tests__/notifier.test.js
git commit -m "feat: add email notifier module"
```

---

### Task 3.2: Integrate Notifications into CLI

**Files:**
- Modify: `src/index.js`

**Step 1: Update CLI with notifications**

Update the `runBooking` function in `src/index.js`:

```javascript
import { loadConfig, saveConfig } from './config.js';
import { BookingService } from './booking-service.js';
import {
  initNotifier,
  isNotifierReady,
  sendBookingSuccess,
  sendBookingFailure,
  shouldNotifyFailure
} from './notifier.js';
import readline from 'readline';

// ... keep existing COMMANDS, main, showMenu, activateJob, deactivateJob, showStatus ...

async function runBooking() {
  const isDryRun = process.argv.includes('--dry-run');
  const useMock = process.argv.includes('--mock');

  console.log('\n🚀 Starting booking attempt...\n');

  const config = await loadConfig();

  if (!config.active && !process.argv.includes('--force')) {
    console.log('⚠️  Job is not active. Use --force to run anyway.');
    return;
  }

  // Initialize notifier
  initNotifier(process.env.RESEND_API_KEY);

  // Mock slots for testing
  const mockSlots = useMock ? [
    { text: 'Monday 9:00 AM', normalized: 'mon 9am' },
    { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
    { text: 'Wednesday 4:00 PM', normalized: 'wed 4pm' },
    { text: 'Thursday 2:00 PM', normalized: 'thu 2pm' },
    { text: 'Friday 11:00 AM', normalized: 'fri 11am' },
  ] : null;

  const service = new BookingService({ dryRun: isDryRun || useMock });

  try {
    const result = await service.attemptBooking(config, mockSlots);

    if (result.success) {
      console.log(`\n🎉 SUCCESS! ${result.dryRun ? '(DRY RUN) Would book' : 'Booked'}: ${result.slot.text}`);
      config.consecutive_failures = 0;

      // Send success email
      if (!result.dryRun) {
        await sendBookingSuccess(config.email, result.slot);
      }

    } else {
      config.consecutive_failures += 1;
      console.log(`\n❌ Booking failed: ${result.reason}`);
      console.log(`   Consecutive failures: ${config.consecutive_failures}`);

      if (result.availableSlots?.length > 0) {
        console.log(`   Available slots: ${result.availableSlots.join(', ')}`);
      }

      // Send failure email if threshold reached
      if (shouldNotifyFailure(config.consecutive_failures)) {
        await sendBookingFailure(
          config.email,
          result.reason,
          config.consecutive_failures,
          result.availableSlots
        );
      }
    }

    await saveConfig(config);

  } catch (error) {
    console.error(`\n💥 Error: ${error.message}`);
    config.consecutive_failures += 1;
    await saveConfig(config);

    if (shouldNotifyFailure(config.consecutive_failures)) {
      await sendBookingFailure(
        config.email,
        error.message,
        config.consecutive_failures,
        []
      );
    }
  }
}

main().catch(console.error);

export { runBooking };
```

**Step 2: Test without API key (mock mode)**

```bash
npm run book -- --mock --force
```

Expected: Shows "[MOCK] Would send email" message

**Step 3: Test with real Resend API key**

```bash
# Get free API key from https://resend.com
export RESEND_API_KEY=re_xxxxx
npm run book -- --force
```

Note: Without real scraper, this will fail. For now, manually test email:

```bash
node -e "
import { initNotifier, sendBookingSuccess } from './src/notifier.js';
initNotifier(process.env.RESEND_API_KEY);
sendBookingSuccess('YOUR_EMAIL', { text: 'Tuesday 3pm', normalized: 'tue 3pm' });
"
```

**Step 4: Commit**

```bash
git add src/index.js
git commit -m "feat: integrate email notifications into booking flow"
```

---

### ✅ Slice 3 Checkpoint

**Automated:** `npm test` passes (all tests)

**Human verification:**
- [ ] `npm run book -- --mock --force` shows mock email log
- [ ] With `RESEND_API_KEY` set, receive actual email (test manually)

---

## Slice 4: Real Scraper (The Unknown)

**Goal:** Scrape actual Google Calendar appointment page and book real slots.

**Checkpoint:** Successfully book an appointment on your test Google Calendar.

**⚠️ This slice requires iteration** - page structure is unknown until we inspect it.

---

### Task 4.1: Set Up Test Google Calendar

**Manual step - no code**

1. Go to https://calendar.google.com
2. Create appointment schedule with test slots
3. Get public booking link
4. Update `config/config.json` with the URL

---

### Task 4.2: Build Puppeteer Scraper (Iterative)

**Files:**
- Create: `src/scraper.js`

**Step 1: Create basic scraper**

Create `src/scraper.js`:

```javascript
import puppeteer from 'puppeteer';
import { normalizeSlot } from './matcher.js';

export class GoogleCalendarScraper {
  constructor(options = {}) {
    this.headless = options.headless ?? true;
    this.debug = options.debug ?? false;
  }

  async createBrowser() {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || null;

    return puppeteer.launch({
      headless: this.headless ? 'new' : false,
      executablePath,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
    });
  }

  async scrape(bookingUrl) {
    const browser = await this.createBrowser();
    const page = await browser.newPage();

    try {
      console.log(`🌐 Navigating to: ${bookingUrl}`);
      await page.goto(bookingUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      if (this.debug) {
        // Take screenshot for debugging
        await page.screenshot({ path: 'debug-page.png', fullPage: true });
        console.log('📸 Screenshot saved to debug-page.png');

        // Log page HTML structure
        const html = await page.content();
        console.log('📄 Page HTML (first 2000 chars):', html.substring(0, 2000));
      }

      // Wait for slots to load
      // ⚠️ ADJUST SELECTOR based on actual page structure
      await page.waitForSelector('[role="button"], button, [data-time]', { timeout: 10000 })
        .catch(() => console.log('⚠️ No slot elements found with default selectors'));

      // Extract slot information
      // ⚠️ ADJUST based on actual page structure
      const slots = await page.evaluate(() => {
        const results = [];

        // Strategy 1: Look for time buttons
        const buttons = document.querySelectorAll('[role="button"], button');
        buttons.forEach(btn => {
          const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';
          // Filter for time-like patterns
          if (text.match(/\d{1,2}:\d{2}|am|pm/i)) {
            results.push({ text, type: 'button' });
          }
        });

        // Strategy 2: Look for data attributes
        const dataSlots = document.querySelectorAll('[data-time], [data-slot]');
        dataSlots.forEach(el => {
          results.push({
            text: el.textContent?.trim() || el.getAttribute('data-time') || '',
            type: 'data-attr'
          });
        });

        return results;
      });

      console.log(`📋 Raw slots found: ${slots.length}`);
      if (this.debug) {
        console.log('Raw slots:', slots);
      }

      // Parse and normalize slots
      const parsedSlots = slots
        .map(slot => {
          const normalized = normalizeSlot(slot.text);
          if (!normalized) return null;
          return {
            text: slot.text,
            normalized,
            type: slot.type
          };
        })
        .filter(Boolean);

      console.log(`✅ Parsed slots: ${parsedSlots.length}`);
      return parsedSlots;

    } finally {
      await browser.close();
    }
  }

  async book(slot, email) {
    // TODO: Implement actual booking
    // This will need to:
    // 1. Click the slot
    // 2. Fill in the form (email, name, etc.)
    // 3. Submit
    // 4. Verify confirmation
    console.log(`⚠️ Real booking not implemented yet. Would book: ${slot.text}`);
    return false;
  }
}
```

**Step 2: Test scraper in debug mode**

```bash
node -e "
import { GoogleCalendarScraper } from './src/scraper.js';
const scraper = new GoogleCalendarScraper({ headless: false, debug: true });
const slots = await scraper.scrape('YOUR_TEST_CALENDAR_URL');
console.log('Found slots:', slots);
"
```

**Step 3: Iterate on selectors**

Based on debug output, adjust the selectors in `scraper.js` to match the actual page structure.

**Step 4: Commit working scraper**

```bash
git add src/scraper.js
git commit -m "feat: add Google Calendar scraper (WIP)"
```

---

### Task 4.3: Integrate Real Scraper into CLI

**Files:**
- Modify: `src/index.js`

**Step 1: Update CLI to use real scraper when not mocking**

Add to `src/index.js`:

```javascript
import { GoogleCalendarScraper } from './scraper.js';

// In runBooking function, update the service creation:
async function runBooking() {
  const isDryRun = process.argv.includes('--dry-run');
  const useMock = process.argv.includes('--mock');
  const debug = process.argv.includes('--debug');

  console.log('\n🚀 Starting booking attempt...\n');

  const config = await loadConfig();

  if (!config.active && !process.argv.includes('--force')) {
    console.log('⚠️  Job is not active. Use --force to run anyway.');
    return;
  }

  initNotifier(process.env.RESEND_API_KEY);

  let mockSlots = null;
  let scraper = null;

  if (useMock) {
    mockSlots = [
      { text: 'Monday 9:00 AM', normalized: 'mon 9am' },
      { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm' },
      { text: 'Wednesday 4:00 PM', normalized: 'wed 4pm' },
      { text: 'Thursday 2:00 PM', normalized: 'thu 2pm' },
      { text: 'Friday 11:00 AM', normalized: 'fri 11am' },
    ];
  } else {
    scraper = new GoogleCalendarScraper({
      headless: !debug,
      debug
    });
  }

  const service = new BookingService({
    dryRun: isDryRun,
    scraper
  });

  // ... rest of the function stays the same, but pass null for mockSlots when using scraper
  const result = await service.attemptBooking(config, mockSlots);
  // ...
}
```

**Step 2: Test with real calendar**

```bash
npm run book -- --debug --force
```

**Step 3: Iterate until working**

Repeat debug → adjust selectors → test until slots are correctly scraped.

**Step 4: Implement actual booking**

Once scraping works, implement the `book()` method to actually click and submit.

**Step 5: Commit**

```bash
git add src/index.js src/scraper.js
git commit -m "feat: integrate real scraper into booking flow"
```

---

### ✅ Slice 4 Checkpoint

**Human verification:**
- [ ] `npm run book -- --debug --force` shows real slots from test calendar
- [ ] Slots are correctly normalized and matched
- [ ] (Optional) Real booking completes on test calendar

---

## Slice 5: Replit Deployment

**Goal:** Deploy to Replit with cron scheduling.

**Checkpoint:** Full flow works when triggered from Replit mobile app.

---

### Task 5.1: Replit Configuration

**Files:**
- Create: `.replit`
- Create: `replit.nix`

**Step 1: Create .replit**

Create `.replit`:

```toml
run = "npm start"
entrypoint = "src/index.js"

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "npm run book -- --force"]
deploymentTarget = "scheduled"
```

**Step 2: Create replit.nix**

Create `replit.nix`:

```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs-18_x
    pkgs.chromium
    pkgs.nodePackages.npm
  ];
  env = {
    PUPPETEER_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
  };
}
```

**Step 3: Commit**

```bash
git add .replit replit.nix
git commit -m "chore: add Replit deployment configuration"
```

---

### Task 5.2: Deploy to Replit

**Manual steps:**

1. Push to GitHub
2. Import repo to Replit
3. Add secrets: `RESEND_API_KEY`
4. Test in Replit shell: `npm run book -- --mock --force`
5. Configure scheduled deployment (cron: `0 0 * * *`)

---

### ✅ Slice 5 Checkpoint

**Human verification:**
- [ ] Project runs in Replit
- [ ] `npm run status` works in Replit shell
- [ ] `npm run book -- --mock --force` works in Replit
- [ ] Scheduled deployment configured for midnight

---

## Summary

| Slice | Status | Automated Tests | Human Verification |
|-------|--------|-----------------|-------------------|
| 1. CLI + Config | ⬜ | config.test.js | npm run status |
| 2. Booking Flow (mocked) | ⬜ | matcher.test.js, booking-service.test.js | npm run book --mock |
| 3. Email Notifications | ⬜ | notifier.test.js | Receive email |
| 4. Real Scraper | ⬜ | (manual) | Book on test calendar |
| 5. Replit Deployment | ⬜ | (manual) | Full flow on Replit |

**Key files:**
```
src/
├── index.js           # CLI entry point
├── config.js          # Config loader
├── matcher.js         # Slot matching logic
├── booking-service.js # Booking orchestration
├── notifier.js        # Email notifications
├── scraper.js         # Puppeteer scraper (Slice 4)
└── __tests__/
    ├── config.test.js
    ├── matcher.test.js
    ├── booking-service.test.js
    └── notifier.test.js
```

**Run all tests:** `npm test`

**Development workflow:**
1. Complete slice
2. Run `npm test` (automated)
3. Run human verification command
4. Commit
5. Move to next slice
