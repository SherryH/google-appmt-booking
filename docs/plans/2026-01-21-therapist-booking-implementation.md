# Therapist Appointment Auto-Booking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an automated tool that books therapist appointments at midnight when new slots are released, with ranked preferences and email notifications.

**Architecture:** Node.js app with Puppeteer for browser automation, Resend for email, deployed to Replit with cron scheduling. Mobile trigger via Replit shell commands.

**Tech Stack:** Node.js, Puppeteer, Resend, Replit Deployments

---

## Phase 1: Project Setup

### Task 1: Initialize Project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `config/config.example.json`

**Step 1: Create package.json**

```bash
cd ~/Projects/google-appmt-booking
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install puppeteer resend
npm install --save-dev jest
```

**Step 3: Update package.json scripts**

Edit `package.json` to add scripts:

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

**Step 6: Create actual config from example**

```bash
cp config/config.example.json config/config.json
```

**Step 7: Commit**

```bash
git init
git add package.json package-lock.json .gitignore config/config.example.json
git commit -m "chore: initialize project with dependencies"
```

---

## Phase 2: Config Module

### Task 2: Build Config Loader

**Files:**
- Create: `src/config.js`
- Create: `src/__tests__/config.test.js`

**Step 1: Write failing test for config loader**

Create `src/__tests__/config.test.js`:

```javascript
import { jest } from '@jest/globals';
import { loadConfig, saveConfig, getConfigPath } from '../config.js';
import fs from 'fs/promises';
import path from 'path';

describe('Config Module', () => {
  const testConfigPath = path.join(process.cwd(), 'config/config.test.json');

  beforeEach(async () => {
    // Create test config
    await fs.writeFile(testConfigPath, JSON.stringify({
      booking_url: "https://test.com",
      preferences: ["Mon 9am"],
      active: false,
      email: "test@test.com",
      consecutive_failures: 0
    }));
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.unlink(testConfigPath);
    } catch (e) {}
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

**Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/config.test.js
```

Expected: FAIL with "Cannot find module '../config.js'"

**Step 3: Write minimal implementation**

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

**Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/config.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/config.js src/__tests__/config.test.js
git commit -m "feat: add config loader module"
```

---

## Phase 3: Notifier Module

### Task 3: Build Email Notifier

**Files:**
- Create: `src/notifier.js`
- Create: `src/__tests__/notifier.test.js`

**Step 1: Write failing test for notifier**

Create `src/__tests__/notifier.test.js`:

```javascript
import { jest } from '@jest/globals';
import { sendBookingSuccess, sendBookingError, shouldNotifyFailure } from '../notifier.js';

// Mock Resend
jest.unstable_mockModule('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'test-id' })
    }
  }))
}));

describe('Notifier Module', () => {
  test('shouldNotifyFailure returns true after 3 failures', () => {
    expect(shouldNotifyFailure(2)).toBe(false);
    expect(shouldNotifyFailure(3)).toBe(true);
    expect(shouldNotifyFailure(6)).toBe(true); // every 3rd
    expect(shouldNotifyFailure(4)).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/notifier.test.js
```

Expected: FAIL with "Cannot find module '../notifier.js'"

**Step 3: Write minimal implementation**

Create `src/notifier.js`:

```javascript
import { Resend } from 'resend';

let resend = null;

export function initNotifier(apiKey) {
  resend = new Resend(apiKey);
}

export function shouldNotifyFailure(consecutiveFailures) {
  return consecutiveFailures > 0 && consecutiveFailures % 3 === 0;
}

export async function sendBookingSuccess(email, slotDetails) {
  if (!resend) throw new Error('Notifier not initialized');

  await resend.emails.send({
    from: 'Booking Bot <onboarding@resend.dev>',
    to: email,
    subject: '🎉 Appointment Booked Successfully!',
    html: `
      <h1>Your appointment has been booked!</h1>
      <p><strong>Time:</strong> ${slotDetails.time}</p>
      <p><strong>Date:</strong> ${slotDetails.date}</p>
      <p>See you there!</p>
    `
  });
}

export async function sendBookingError(email, error, consecutiveFailures) {
  if (!resend) throw new Error('Notifier not initialized');

  await resend.emails.send({
    from: 'Booking Bot <onboarding@resend.dev>',
    to: email,
    subject: `⚠️ Booking Issue (${consecutiveFailures} consecutive failures)`,
    html: `
      <h1>Booking encountered an issue</h1>
      <p><strong>Error:</strong> ${error}</p>
      <p><strong>Consecutive failures:</strong> ${consecutiveFailures}</p>
      <p>The bot will retry tomorrow at midnight.</p>
    `
  });
}

export async function sendNoMatchNotification(email, availableSlots, preferences) {
  if (!resend) throw new Error('Notifier not initialized');

  await resend.emails.send({
    from: 'Booking Bot <onboarding@resend.dev>',
    to: email,
    subject: 'ℹ️ No matching slots found today',
    html: `
      <h1>No matching slots available</h1>
      <p><strong>Your preferences:</strong> ${preferences.join(', ')}</p>
      <p><strong>Available slots:</strong> ${availableSlots.length > 0 ? availableSlots.join(', ') : 'None'}</p>
      <p>Will retry tomorrow.</p>
    `
  });
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/notifier.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/notifier.js src/__tests__/notifier.test.js
git commit -m "feat: add email notifier module"
```

---

## Phase 4: Scraper Module

### Task 4: Build Slot Parser and Matcher

**Files:**
- Create: `src/scraper.js`
- Create: `src/__tests__/scraper.test.js`

**Step 1: Write failing tests for slot matching**

Create `src/__tests__/scraper.test.js`:

```javascript
import { parseSlotText, matchPreferences, normalizeSlot } from '../scraper.js';

describe('Scraper Module', () => {
  describe('normalizeSlot', () => {
    test('normalizes day and time formats', () => {
      expect(normalizeSlot('Tuesday 3:00 PM')).toBe('tue 3pm');
      expect(normalizeSlot('Wed 2:00pm')).toBe('wed 2pm');
      expect(normalizeSlot('THURSDAY 10:00 AM')).toBe('thu 10am');
    });
  });

  describe('parseSlotText', () => {
    test('extracts day and time from slot text', () => {
      const result = parseSlotText('Tuesday, January 15 at 3:00 PM');
      expect(result.day).toBe('tue');
      expect(result.time).toBe('3pm');
      expect(result.normalized).toBe('tue 3pm');
    });
  });

  describe('matchPreferences', () => {
    const availableSlots = [
      { text: 'Monday 9am', normalized: 'mon 9am', element: null },
      { text: 'Tuesday 3pm', normalized: 'tue 3pm', element: null },
      { text: 'Wednesday 4pm', normalized: 'wed 4pm', element: null },
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

    test('respects preference order', () => {
      const preferences = ['wed 4pm', 'tue 3pm'];
      const match = matchPreferences(availableSlots, preferences);
      expect(match.normalized).toBe('wed 4pm');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- src/__tests__/scraper.test.js
```

Expected: FAIL with "Cannot find module '../scraper.js'"

**Step 3: Write minimal implementation**

Create `src/scraper.js`:

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
  const text = slotText.toLowerCase();

  // Extract day
  let day = null;
  for (const [full, short] of Object.entries(DAY_MAP)) {
    if (text.includes(full)) {
      day = short;
      break;
    }
  }

  // Extract time - match patterns like "3:00 PM", "3pm", "15:00"
  const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hour = parseInt(timeMatch[1]);
  const period = timeMatch[3]?.toLowerCase();

  // Convert to 12-hour format with am/pm
  let normalizedPeriod = period;
  if (!period) {
    normalizedPeriod = hour >= 12 ? 'pm' : 'am';
    if (hour > 12) hour -= 12;
  }

  return `${day} ${hour}${normalizedPeriod}`;
}

export function parseSlotText(slotText) {
  const normalized = normalizeSlot(slotText);
  if (!normalized) return null;

  const [day, time] = normalized.split(' ');
  return {
    text: slotText,
    day,
    time,
    normalized
  };
}

export function matchPreferences(availableSlots, preferences) {
  // Normalize preferences for comparison
  const normalizedPrefs = preferences.map(p => normalizeSlot(p) || p.toLowerCase());

  // Find first preference that has an available slot
  for (const pref of normalizedPrefs) {
    const match = availableSlots.find(slot => slot.normalized === pref);
    if (match) return match;
  }

  return null;
}

export async function scrapeAvailableSlots(page) {
  // Wait for slots to load - selector may need adjustment based on actual page
  await page.waitForSelector('[data-slot]', { timeout: 10000 }).catch(() => null);

  // Extract slot information from the page
  const slots = await page.evaluate(() => {
    const slotElements = document.querySelectorAll('[data-slot], [role="button"][aria-label*="appointment"]');
    return Array.from(slotElements).map(el => ({
      text: el.textContent || el.getAttribute('aria-label') || '',
      dataSlot: el.getAttribute('data-slot'),
    }));
  });

  // Parse and normalize each slot
  return slots
    .map(slot => {
      const parsed = parseSlotText(slot.text);
      if (!parsed) return null;
      return { ...parsed, rawData: slot };
    })
    .filter(Boolean);
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- src/__tests__/scraper.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/scraper.js src/__tests__/scraper.test.js
git commit -m "feat: add slot scraper and preference matcher"
```

---

## Phase 5: Booker Module

### Task 5: Build Puppeteer Booking Logic

**Files:**
- Create: `src/booker.js`

**Note:** This module is harder to unit test due to Puppeteer. We'll test it manually with the test calendar.

**Step 1: Create booker module**

Create `src/booker.js`:

```javascript
import puppeteer from 'puppeteer';
import { scrapeAvailableSlots, matchPreferences } from './scraper.js';

export async function createBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage', // For Replit compatibility
    ]
  });
}

export async function attemptBooking(config) {
  const { booking_url, preferences, email } = config;

  const browser = await createBrowser();
  const page = await browser.newPage();

  try {
    console.log(`📅 Navigating to booking page...`);
    await page.goto(booking_url, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log(`🔍 Scraping available slots...`);
    const availableSlots = await scrapeAvailableSlots(page);
    console.log(`   Found ${availableSlots.length} slots`);

    if (availableSlots.length === 0) {
      return {
        success: false,
        reason: 'no_slots_available',
        availableSlots: []
      };
    }

    console.log(`🎯 Matching against preferences: ${preferences.join(', ')}`);
    const matchedSlot = matchPreferences(availableSlots, preferences);

    if (!matchedSlot) {
      return {
        success: false,
        reason: 'no_match',
        availableSlots: availableSlots.map(s => s.text)
      };
    }

    console.log(`✅ Found matching slot: ${matchedSlot.text}`);

    // Click the slot
    console.log(`👆 Clicking slot...`);
    await clickSlot(page, matchedSlot);

    // Fill booking form
    console.log(`📝 Filling booking form...`);
    await fillBookingForm(page, email);

    // Submit
    console.log(`🚀 Submitting booking...`);
    await submitBooking(page);

    // Verify confirmation
    console.log(`🔍 Verifying confirmation...`);
    const confirmed = await verifyConfirmation(page);

    if (confirmed) {
      return {
        success: true,
        slot: matchedSlot
      };
    } else {
      return {
        success: false,
        reason: 'confirmation_failed',
        slot: matchedSlot
      };
    }

  } finally {
    await browser.close();
  }
}

async function clickSlot(page, slot) {
  // Strategy 1: Click by text content
  const clicked = await page.evaluate((slotText) => {
    const elements = document.querySelectorAll('[data-slot], [role="button"], button');
    for (const el of elements) {
      if (el.textContent?.includes(slotText) || el.getAttribute('aria-label')?.includes(slotText)) {
        el.click();
        return true;
      }
    }
    return false;
  }, slot.text);

  if (!clicked) {
    throw new Error(`Could not click slot: ${slot.text}`);
  }

  // Wait for form to appear
  await page.waitForSelector('form, [role="dialog"]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function fillBookingForm(page, email) {
  // Look for email input field
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email"]');
  if (emailInput) {
    await emailInput.type(email);
  }

  // Look for name field (might be required)
  const nameInput = await page.$('input[name="name"], input[placeholder*="name"]');
  if (nameInput) {
    await nameInput.type('Appointment Booking');
  }

  await page.waitForTimeout(500);
}

async function submitBooking(page) {
  // Look for submit button
  const submitButton = await page.$('button[type="submit"], button:has-text("Book"), button:has-text("Confirm"), button:has-text("Schedule")');

  if (submitButton) {
    await submitButton.click();
  } else {
    // Try clicking any primary button
    await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        if (text.includes('book') || text.includes('confirm') || text.includes('schedule') || text.includes('submit')) {
          btn.click();
          return;
        }
      }
    });
  }

  // Wait for submission to complete
  await page.waitForTimeout(3000);
}

async function verifyConfirmation(page) {
  // Check for confirmation indicators
  const pageContent = await page.content();
  const confirmationIndicators = [
    'confirmed',
    'booked',
    'scheduled',
    'success',
    'thank you',
    'confirmation'
  ];

  const hasConfirmation = confirmationIndicators.some(indicator =>
    pageContent.toLowerCase().includes(indicator)
  );

  return hasConfirmation;
}
```

**Step 2: Commit**

```bash
git add src/booker.js
git commit -m "feat: add puppeteer booking logic"
```

---

## Phase 6: CLI Entry Point

### Task 6: Build CLI Interface

**Files:**
- Create: `src/index.js`

**Step 1: Create entry point with CLI menu**

Create `src/index.js`:

```javascript
import { loadConfig, saveConfig } from './config.js';
import { attemptBooking } from './booker.js';
import { initNotifier, sendBookingSuccess, sendBookingError, sendNoMatchNotification, shouldNotifyFailure } from './notifier.js';
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
  console.log('[4] Run booking now (test)');
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
  console.log(`   Consecutive failures: ${config.consecutive_failures}`);
}

async function runBooking() {
  console.log('\n🚀 Starting booking attempt...\n');

  const config = await loadConfig();

  if (!config.active) {
    console.log('⚠️  Job is not active. Use "activate" first or run with --force');
    if (!process.argv.includes('--force')) {
      return;
    }
  }

  // Initialize notifier if API key available
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    initNotifier(resendKey);
  } else {
    console.log('⚠️  RESEND_API_KEY not set - email notifications disabled');
  }

  try {
    const result = await attemptBooking(config);

    if (result.success) {
      console.log(`\n🎉 SUCCESS! Booked: ${result.slot.text}`);

      // Send success email
      if (resendKey) {
        await sendBookingSuccess(config.email, {
          time: result.slot.time,
          date: result.slot.text
        });
        console.log('📧 Confirmation email sent!');
      }

      // Reset failure counter
      config.consecutive_failures = 0;
      await saveConfig(config);

    } else {
      config.consecutive_failures += 1;
      await saveConfig(config);

      console.log(`\n❌ Booking failed: ${result.reason}`);
      console.log(`   Consecutive failures: ${config.consecutive_failures}`);

      if (result.availableSlots?.length > 0) {
        console.log(`   Available slots: ${result.availableSlots.join(', ')}`);
      }

      // Send failure notification if threshold reached
      if (resendKey && shouldNotifyFailure(config.consecutive_failures)) {
        await sendBookingError(config.email, result.reason, config.consecutive_failures);
        console.log('📧 Failure notification sent');
      }
    }

  } catch (error) {
    console.error(`\n💥 Error: ${error.message}`);

    config.consecutive_failures += 1;
    await saveConfig(config);

    if (resendKey && shouldNotifyFailure(config.consecutive_failures)) {
      await sendBookingError(config.email, error.message, config.consecutive_failures);
    }
  }
}

// Run if called directly
main().catch(console.error);

// Export for cron
export { runBooking };
```

**Step 2: Test the CLI**

```bash
node src/index.js status
```

Expected: Shows current config status

**Step 3: Commit**

```bash
git add src/index.js
git commit -m "feat: add CLI entry point with menu"
```

---

## Phase 7: Test Calendar Setup

### Task 7: Create Test Google Calendar

**This is a manual step - no code required**

**Step 1: Create test calendar**

1. Go to https://calendar.google.com
2. Create a new calendar called "Test Appointments"
3. Go to Settings → Settings for my calendars → Test Appointments
4. Enable "Appointment schedules" (or use Google Calendar Appointment Scheduling)

**Step 2: Create test appointment slots**

1. Create appointment schedule with slots like:
   - Tuesday 3:00 PM
   - Thursday 2:00 PM
   - Wednesday 4:00 PM
2. Get the public booking link

**Step 3: Update config with test URL**

Edit `config/config.json`:

```json
{
  "booking_url": "YOUR_TEST_CALENDAR_BOOKING_LINK",
  "preferences": ["Tue 3pm", "Thu 2pm", "Wed 4pm"],
  "active": false,
  "email": "your@email.com",
  "consecutive_failures": 0
}
```

**Step 4: Test locally**

```bash
node src/index.js book --force
```

Watch the output and adjust selectors in `booker.js` and `scraper.js` as needed based on the actual page structure.

---

## Phase 8: Replit Deployment

### Task 8: Configure for Replit

**Files:**
- Create: `.replit`
- Create: `replit.nix`

**Step 1: Create .replit configuration**

Create `.replit`:

```toml
run = "npm start"
entrypoint = "src/index.js"

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "npm run book"]
deploymentTarget = "scheduled"

[[ports]]
localPort = 3000
externalPort = 80
```

**Step 2: Create replit.nix for Puppeteer dependencies**

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

**Step 3: Update booker.js for Replit compatibility**

Edit `src/booker.js` - update `createBrowser` function:

```javascript
export async function createBrowser() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || null;

  return puppeteer.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
    ]
  });
}
```

**Step 4: Commit**

```bash
git add .replit replit.nix
git commit -m "chore: add Replit deployment configuration"
```

**Step 5: Push to GitHub**

```bash
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

**Step 6: Import to Replit**

1. Go to replit.com
2. Create new Repl → Import from GitHub
3. Select your repository
4. Wait for import to complete

**Step 7: Configure Replit Secrets**

In Replit, go to Secrets tab and add:
- `RESEND_API_KEY`: Your Resend API key

**Step 8: Test in Replit**

In Replit Shell:
```bash
npm run status
npm run activate
npm run book
```

**Step 9: Configure Scheduled Deployment**

1. In Replit, go to Deployments
2. Create new Scheduled Deployment
3. Set schedule to `0 0 * * *` (midnight daily)
4. Deploy

---

## Phase 9: Final Integration Test

### Task 9: End-to-End Test

**Step 1: Activate via Replit mobile app**

1. Open Replit app on phone
2. Open your project
3. Go to Shell tab
4. Run `npm run activate`
5. Verify "Booking job activated!" message

**Step 2: Manually trigger booking**

```bash
npm run book
```

**Step 3: Verify email notification**

Check your email for either:
- Success confirmation with booking details
- Failure notification (if no match)

**Step 4: Check status**

```bash
npm run status
```

**Step 5: Wait for midnight cron (or adjust schedule for testing)**

For testing, temporarily set cron to run soon:
- Change schedule to `*/5 * * * *` (every 5 minutes)
- Watch logs in Replit Deployments
- Revert to `0 0 * * *` after testing

---

## Summary

| Phase | Task | Status |
|-------|------|--------|
| 1 | Project Setup | ⬜ |
| 2 | Config Module | ⬜ |
| 3 | Notifier Module | ⬜ |
| 4 | Scraper Module | ⬜ |
| 5 | Booker Module | ⬜ |
| 6 | CLI Entry Point | ⬜ |
| 7 | Test Calendar Setup | ⬜ |
| 8 | Replit Deployment | ⬜ |
| 9 | Final Integration Test | ⬜ |

**Total estimated tasks:** 9 phases, ~30 bite-sized steps

**Key files to create:**
- `src/index.js` - CLI entry point
- `src/config.js` - Config loader
- `src/booker.js` - Puppeteer booking logic
- `src/scraper.js` - Slot parsing and matching
- `src/notifier.js` - Email notifications
- `config/config.json` - Your preferences (git-ignored)
- `.replit` - Replit configuration
- `replit.nix` - Replit dependencies
