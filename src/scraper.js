import puppeteer from 'puppeteer';
import { normalizeSlot } from './matcher.js';
import fs from 'fs';

/**
 * GoogleCalendarScraper - Extracts appointment slots from Google Calendar booking page
 *
 * Handles:
 * - Slot extraction from week view
 * - "Jump to next bookable date" navigation
 * - Multi-week search
 * - Form filling and booking submission
 */
export class GoogleCalendarScraper {
  constructor(options = {}) {
    this.headless = options.headless !== false; // Default: true (headless)
    this.debug = options.debug || false;
    this.maxWeeks = options.maxWeeks || 4;
    this.browser = null;
    this.page = null;
  }

  /**
   * Initialize browser and page
   */
  async init() {
    this.browser = await puppeteer.launch({
      headless: this.headless ? 'new' : false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    });
    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 800 });

    // Set a reasonable timeout
    this.page.setDefaultTimeout(30000);
  }

  /**
   * Close browser
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  /**
   * Log debug information
   */
  log(message, data = null) {
    if (this.debug) {
      console.log(`[Scraper] ${message}`);
      if (data) console.log(data);
    }
  }

  /**
   * Save debug screenshot
   */
  async saveDebugScreenshot(filename = 'debug-page.png') {
    if (this.debug && this.page) {
      await this.page.screenshot({ path: filename, fullPage: true });
      this.log(`Screenshot saved: ${filename}`);
    }
  }

  /**
   * Save page HTML for debugging
   */
  async saveDebugHtml(filename = 'debug-page.html') {
    if (this.debug && this.page) {
      const html = await this.page.content();
      fs.writeFileSync(filename, html);
      this.log(`HTML saved: ${filename}`);
    }
  }

  /**
   * Wait for page to be ready (calendar loaded)
   */
  async waitForCalendarLoad() {
    try {
      // Wait for the main content to load
      // Google Calendar booking page typically has appointment slots or a message
      await this.page.waitForFunction(
        () => {
          // Look for time slot buttons OR "no availability" message
          const timeButtons = document.querySelectorAll('button[data-time], [role="button"]');
          const noAvailMsg = document.body.innerText.includes('No availability') ||
                            document.body.innerText.includes('no availability');
          return timeButtons.length > 0 || noAvailMsg;
        },
        { timeout: 15000 }
      );
      return true;
    } catch {
      this.log('Calendar load timeout - page may still be loading');
      return false;
    }
  }

  /**
   * Extract available time slots from current view
   * @returns {Array<{text: string, normalized: string, element: object}>}
   */
  async extractSlots() {
    const slots = await this.page.evaluate(() => {
      const results = [];

      // Strategy 1: Look for buttons with time patterns (e.g., "3:30 pm", "3:30pm")
      const buttons = document.querySelectorAll('button, [role="button"]');
      const timePattern = /^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i;

      buttons.forEach((btn, index) => {
        const text = btn.textContent?.trim();
        if (text && timePattern.test(text)) {
          results.push({
            text: text,
            index: index,
            selector: `button:nth-of-type(${index + 1})`,
          });
        }
      });

      // Strategy 2: Look for elements with aria-label containing time
      if (results.length === 0) {
        const ariaElements = document.querySelectorAll('[aria-label*="pm"], [aria-label*="am"]');
        ariaElements.forEach((el, index) => {
          const label = el.getAttribute('aria-label');
          if (label) {
            results.push({
              text: label,
              index: index,
              selector: `[aria-label="${label}"]`,
            });
          }
        });
      }

      return results;
    });

    // Process and normalize slots
    const processedSlots = [];
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-US', { weekday: 'long' });

    for (const slot of slots) {
      // Try to determine the day from context or assume current week view
      // For now, we'll extract date context from the page if possible
      const dateContext = await this.getDateContext();

      const fullText = dateContext ? `${dateContext} ${slot.text}` : slot.text;
      const normalized = normalizeSlot(fullText);

      if (normalized) {
        processedSlots.push({
          text: slot.text,
          normalized: normalized,
          selector: slot.selector,
          index: slot.index,
        });
      }
    }

    return processedSlots;
  }

  /**
   * Try to extract date context from the calendar view
   */
  async getDateContext() {
    try {
      // Look for date headers in the calendar week view
      const dateContext = await this.page.evaluate(() => {
        // Google Calendar week view often has day headers
        const headers = document.querySelectorAll('[role="columnheader"], .day-header, [data-date]');
        const days = [];

        headers.forEach(h => {
          const text = h.textContent?.trim();
          const date = h.getAttribute('data-date');
          if (text || date) {
            days.push(text || date);
          }
        });

        return days.length > 0 ? days : null;
      });

      return dateContext;
    } catch {
      return null;
    }
  }

  /**
   * Extract slots with day association from the calendar grid
   * Uses data-date-time attribute to get accurate date/time info
   */
  async extractSlotsWithDays() {
    const slots = await this.page.evaluate(() => {
      const results = [];
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // Find all buttons with data-date-time attribute (Google Calendar appointment slots)
      const buttons = document.querySelectorAll('button[data-date-time]');

      buttons.forEach((btn, index) => {
        const timestamp = parseInt(btn.getAttribute('data-date-time'));
        if (!timestamp || isNaN(timestamp)) return;

        const date = new Date(timestamp);
        const dayName = dayNames[date.getDay()];
        const timeText = btn.textContent?.trim() || btn.getAttribute('aria-label');

        if (timeText) {
          results.push({
            text: timeText,
            day: dayName,
            date: date.toISOString().split('T')[0],
            timestamp: timestamp,
            index: index,
          });
        }
      });

      return results;
    });

    this.log(`Found ${slots.length} slots with data-date-time`);

    if (slots.length === 0) {
      // Fallback to flat extraction
      return this.extractSlotsFlat();
    }

    return slots.map(slot => ({
      text: `${slot.day} ${slot.text}`,
      normalized: normalizeSlot(`${slot.day} ${slot.text}`),
      date: slot.date,
      timestamp: slot.timestamp,
      index: slot.index,
    })).filter(s => s.normalized);
  }

  /**
   * Flat extraction - just get all time buttons without day context
   */
  async extractSlotsFlat() {
    return this.page.evaluate(() => {
      const results = [];
      const timePattern = /^(\d{1,2}):?(\d{2})?\s*(am|pm)$/i;

      // Get all clickable elements that look like times
      document.querySelectorAll('button, [role="button"], [role="option"]').forEach((el, index) => {
        const text = el.textContent?.trim();
        if (text && timePattern.test(text)) {
          // Try to find day context by looking at nearby elements
          let dayContext = '';
          let parent = el.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            const possibleDay = parent.querySelector('[role="columnheader"], .day-header');
            if (possibleDay) {
              dayContext = possibleDay.textContent?.trim() || '';
              break;
            }
            parent = parent.parentElement;
          }

          results.push({
            text: text,
            day: dayContext,
            index: index,
          });
        }
      });

      return results;
    });
  }

  /**
   * Check if "Jump to next bookable date" link exists and click it
   * @returns {boolean} True if jumped, false if link not found
   */
  async tryJumpToNextDate() {
    try {
      const jumpLink = await this.page.$('a[href*="jump"], button:has-text("Jump"), [role="link"]:has-text("Jump")');

      if (!jumpLink) {
        // Try text-based search
        const jumped = await this.page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('a, button, [role="link"], [role="button"]'));
          const jumpEl = elements.find(el =>
            el.textContent?.toLowerCase().includes('jump to') ||
            el.textContent?.toLowerCase().includes('next bookable')
          );

          if (jumpEl) {
            jumpEl.click();
            return true;
          }
          return false;
        });

        if (jumped) {
          this.log('Clicked "Jump to next bookable date" via text search');
          await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 2000)); // Wait for content to load
          return true;
        }

        return false;
      }

      await jumpLink.click();
      this.log('Clicked "Jump to next bookable date"');
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 2000));
      return true;
    } catch (error) {
      this.log('Jump link not found or click failed', error.message);
      return false;
    }
  }

  /**
   * Check if "No availability" message is shown
   */
  async hasNoAvailability() {
    return this.page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('no availability') ||
             text.includes('no times available') ||
             text.includes('fully booked');
    });
  }

  /**
   * Navigate to next week in calendar
   */
  async navigateToNextWeek() {
    try {
      // Look for next week navigation button
      const clicked = await this.page.evaluate(() => {
        const nextButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const nextBtn = nextButtons.find(btn => {
          const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
          const text = btn.textContent?.toLowerCase() || '';
          return label.includes('next') || text.includes('next') || text.includes('→') || text.includes('>');
        });

        if (nextBtn) {
          nextBtn.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        this.log('Navigated to next week');
        await new Promise(r => setTimeout(r, 2000)); // Wait for content
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Main scrape function - extracts all available slots
   * @param {string} bookingUrl - The Google Calendar booking URL
   * @returns {Array<{text: string, normalized: string, date?: string}>}
   */
  async scrape(bookingUrl) {
    try {
      await this.init();
      this.log(`Navigating to: ${bookingUrl}`);

      await this.page.goto(bookingUrl, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      await this.saveDebugScreenshot('debug-initial.png');

      // Wait for calendar to load
      await this.waitForCalendarLoad();
      await this.saveDebugScreenshot('debug-loaded.png');

      let allSlots = [];
      let weekCount = 0;

      while (weekCount < this.maxWeeks) {
        this.log(`Checking week ${weekCount + 1}/${this.maxWeeks}`);

        // Try to extract slots with day context
        let slots = await this.extractSlotsWithDays();

        if (slots.length === 0) {
          // Fallback to flat extraction
          const flatSlots = await this.extractSlotsFlat();
          slots = flatSlots.map((s, i) => ({
            text: s.day ? `${s.day} ${s.text}` : s.text,
            normalized: s.day ? normalizeSlot(`${s.day} ${s.text}`) : null,
            index: s.index,
          })).filter(s => s.normalized);
        }

        this.log(`Found ${slots.length} slots in current view`);

        if (slots.length > 0) {
          allSlots = [...allSlots, ...slots];
          // If we found slots, we might still want to check more weeks
          // But for efficiency, return what we found
          break;
        }

        // No slots found - check for "no availability" or try to jump/navigate
        if (await this.hasNoAvailability()) {
          this.log('No availability message detected');

          // Try to jump to next bookable date
          const jumped = await this.tryJumpToNextDate();
          if (jumped) {
            weekCount++; // Count as advancing
            await this.saveDebugScreenshot(`debug-week-${weekCount}.png`);
            continue;
          }

          // If no jump link, try navigating to next week
          const navigated = await this.navigateToNextWeek();
          if (navigated) {
            weekCount++;
            await this.saveDebugScreenshot(`debug-week-${weekCount}.png`);
            continue;
          }

          // Can't advance - no more slots
          break;
        }

        // Try to advance to next week
        const advanced = await this.navigateToNextWeek() || await this.tryJumpToNextDate();
        if (!advanced) {
          break;
        }

        weekCount++;
        await this.saveDebugScreenshot(`debug-week-${weekCount}.png`);
      }

      await this.saveDebugHtml('debug-final.html');
      await this.saveDebugScreenshot('debug-final.png');

      this.log(`Total slots found: ${allSlots.length}`);
      return allSlots;

    } catch (error) {
      this.log('Scrape error', error.message);
      await this.saveDebugScreenshot('debug-error.png');
      throw error;
    } finally {
      if (!this.debug) {
        await this.close();
      }
    }
  }

  /**
   * Book a specific slot
   * @param {object} slot - The slot to book {text, normalized, timestamp, index}
   * @param {object} userInfo - User information {email, firstName, lastName, phone?}
   * @returns {boolean} Success status
   */
  async book(slot, userInfo) {
    try {
      if (!this.page) {
        throw new Error('Browser not initialized. Call scrape() first.');
      }

      this.log(`Attempting to book slot: ${slot.text}`);

      // Click the slot button using timestamp (most reliable) or fallback methods
      const clicked = await this.page.evaluate((slotData) => {
        // Method 1: Use data-date-time timestamp (most reliable)
        if (slotData.timestamp) {
          const btn = document.querySelector(`button[data-date-time="${slotData.timestamp}"]`);
          if (btn) {
            btn.click();
            return true;
          }
        }

        // Method 2: Find by index in buttons with data-date-time
        const buttons = Array.from(document.querySelectorAll('button[data-date-time]'));
        if (typeof slotData.index === 'number' && buttons[slotData.index]) {
          buttons[slotData.index].click();
          return true;
        }

        // Method 3: Find button by text content
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        const timeMatch = slotData.text.match(/(\d{1,2}:\d{2}(?:am|pm))/i);
        if (timeMatch) {
          const timeStr = timeMatch[1].toLowerCase();
          const targetBtn = allButtons.find(btn =>
            btn.textContent?.toLowerCase().includes(timeStr)
          );
          if (targetBtn) {
            targetBtn.click();
            return true;
          }
        }

        return false;
      }, slot);

      if (!clicked) {
        this.log('Failed to click slot button');
        return false;
      }

      this.log('Clicked slot, waiting for form...');
      // Wait for the form modal to appear
      await this.page.waitForSelector('input', { timeout: 10000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 1500)); // Extra wait for form to fully render
      await this.saveDebugScreenshot('debug-form.png');
      await this.saveDebugHtml('debug-form.html');

      // Fill the booking form
      const formFilled = await this.fillBookingForm(userInfo);
      this.log(`Form fill result: ${formFilled}`);

      if (!formFilled) {
        this.log('Failed to fill booking form');
        await this.saveDebugScreenshot('debug-form-failed.png');
        return false;
      }

      await this.saveDebugScreenshot('debug-form-filled.png');
      await new Promise(r => setTimeout(r, 500)); // Let validation run

      // Submit the form
      const submitted = await this.submitBookingForm();
      this.log(`Form submit result: ${submitted}`);

      if (!submitted) {
        this.log('Failed to submit booking form');
        await this.saveDebugScreenshot('debug-submit-failed.png');
        return false;
      }

      // Verify success
      await new Promise(r => setTimeout(r, 3000));
      await this.saveDebugScreenshot('debug-confirmation.png');
      await this.saveDebugHtml('debug-confirmation.html');

      const success = await this.verifyBookingSuccess();
      this.log(success ? 'Booking confirmed!' : 'Booking may have failed');

      return success;

    } catch (error) {
      this.log('Booking error', error.message);
      await this.saveDebugScreenshot('debug-booking-error.png');
      return false;
    }
  }

  /**
   * Fill the booking form with user information
   */
  async fillBookingForm(userInfo) {
    // First, let's debug what inputs are on the page
    const inputInfo = await this.page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      return inputs.map(inp => ({
        type: inp.type,
        name: inp.name,
        id: inp.id,
        placeholder: inp.placeholder,
        ariaLabel: inp.getAttribute('aria-label'),
        parentText: inp.parentElement?.textContent?.substring(0, 50),
        visible: inp.offsetParent !== null,
      }));
    });

    this.log('Found inputs:', inputInfo);

    // Try using Puppeteer's native input methods for reliability
    const result = await this.page.evaluate((info) => {
      const { email, firstName, lastName, phone } = info;
      const log = [];

      // Get all visible inputs
      const inputs = Array.from(document.querySelectorAll('input')).filter(
        inp => inp.offsetParent !== null && inp.type !== 'hidden'
      );

      log.push(`Found ${inputs.length} visible inputs`);

      // Helper to find input by looking at nearby text
      const findInputByNearbyText = (patterns) => {
        for (const input of inputs) {
          // Check parent elements for label text
          let el = input.parentElement;
          for (let i = 0; i < 4 && el; i++) {
            const text = el.textContent?.toLowerCase() || '';
            for (const pattern of patterns) {
              if (text.includes(pattern.toLowerCase()) && !text.includes('email') || pattern.toLowerCase() === 'email' && text.includes('email')) {
                // Make sure this is the most specific match
                if (pattern.toLowerCase() !== 'email' && text.includes('email')) continue;
                if (pattern.toLowerCase() === 'first' && text.includes('last')) continue;
                return input;
              }
            }
            el = el.parentElement;
          }
        }
        return null;
      };

      // Helper to set input value with proper events
      const setInputValue = (input, value, fieldName) => {
        if (!input) {
          log.push(`${fieldName}: input not found`);
          return false;
        }
        // Clear existing value first
        input.value = '';
        input.focus();

        // Set value
        input.value = value;

        // Dispatch events
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        log.push(`${fieldName}: set to "${value}"`);
        return true;
      };

      let filled = 0;

      // Try to fill inputs in order they appear (usually: first name, last name, email, phone)
      if (inputs.length >= 4) {
        // Assume fixed order based on form layout
        if (setInputValue(inputs[0], firstName, 'First name (by position)')) filled++;
        if (setInputValue(inputs[1], lastName, 'Last name (by position)')) filled++;
        if (setInputValue(inputs[2], email, 'Email (by position)')) filled++;
        if (phone && inputs[3]) {
          setInputValue(inputs[3], phone, 'Phone (by position)');
        }
      } else {
        // Try pattern matching
        const firstNameInput = findInputByNearbyText(['first name', 'first', 'given']);
        const lastNameInput = findInputByNearbyText(['last name', 'last', 'surname', 'family']);
        const emailInput = findInputByNearbyText(['email']);
        const phoneInput = findInputByNearbyText(['phone', 'tel']);

        if (setInputValue(firstNameInput, firstName, 'First name')) filled++;
        if (setInputValue(lastNameInput, lastName, 'Last name')) filled++;
        if (setInputValue(emailInput, email, 'Email')) filled++;
        if (phone && phoneInput) {
          setInputValue(phoneInput, phone, 'Phone');
        }
      }

      return { success: filled >= 3, filled, log };
    }, userInfo);

    this.log('Fill result:', result);
    return result.success;
  }

  /**
   * Submit the booking form
   */
  async submitBookingForm() {
    return this.page.evaluate(() => {
      // Look for submit/book button
      const buttons = Array.from(document.querySelectorAll('button, [role="button"], input[type="submit"]'));
      const submitBtn = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || '';
        const value = btn.value?.toLowerCase() || '';
        return text.includes('book') ||
               text.includes('confirm') ||
               text.includes('submit') ||
               text.includes('schedule') ||
               value.includes('book') ||
               value.includes('submit');
      });

      if (submitBtn) {
        submitBtn.click();
        return true;
      }

      return false;
    });
  }

  /**
   * Verify booking was successful
   */
  async verifyBookingSuccess() {
    return this.page.evaluate(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes('confirmed') ||
             text.includes('booked') ||
             text.includes('scheduled') ||
             text.includes('thank you') ||
             text.includes('success');
    });
  }
}

export default GoogleCalendarScraper;
