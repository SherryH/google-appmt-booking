/**
 * Google Apps Script for Booking Test Automation
 *
 * These functions block/unblock calendar times to create
 * test scenarios for the appointment booking scraper.
 *
 * Usage:
 *   1. Deploy this script to Google Apps Script
 *   2. Run functions via clasp: npm run test:setup:slots-visible
 *   3. Functions will manipulate your calendar to create test conditions
 */

/**
 * Block a specific time slot with a test event
 * @param {string} dateStr - ISO date string (e.g., "2026-01-30")
 * @param {number} startHour - Start hour (0-23)
 * @param {number} endHour - End hour (0-23)
 * @returns {string} Event ID of created block
 */
function blockSlot(dateStr, startHour, endHour) {
  const cal = CalendarApp.getDefaultCalendar();
  const date = new Date(dateStr);

  const start = new Date(date);
  start.setHours(startHour, 0, 0, 0);

  const end = new Date(date);
  end.setHours(endHour, 0, 0, 0);

  const event = cal.createEvent('[TEST BLOCK] Reserved', start, end);
  return event.getId();
}

/**
 * Block an entire day (9am-9pm business hours)
 * @param {string} dateStr - ISO date string
 * @returns {string} Event ID
 */
function blockDay(dateStr) {
  return blockSlot(dateStr, 9, 21);
}

/**
 * Block an entire week starting from the given date
 * @param {string} weekStartDate - ISO date string of week start (Monday)
 */
function blockWeek(weekStartDate) {
  const start = new Date(weekStartDate);
  const eventIds = [];

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const id = blockDay(day.toISOString().split('T')[0]);
    eventIds.push(id);
  }

  return eventIds.length + ' days blocked';
}

/**
 * Clear all test blocks from calendar
 * Removes events with "[TEST BLOCK]" in the title
 * @returns {string} Status message
 */
function clearAllTestBlocks() {
  const cal = CalendarApp.getDefaultCalendar();
  const now = new Date();
  const future = new Date();
  future.setMonth(future.getMonth() + 3); // Look 3 months ahead

  const events = cal.getEvents(now, future);
  let count = 0;

  events.forEach(event => {
    if (event.getTitle().includes('[TEST BLOCK]')) {
      event.deleteEvent();
      count++;
    }
  });

  return count + ' test blocks cleared';
}

/**
 * Get the Monday of the current week
 * @returns {Date}
 */
function getCurrentWeekMonday() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  const monday = new Date(now);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

// ==========================================
// TEST SCENARIO SETUP FUNCTIONS
// ==========================================

/**
 * Scenario: Slots visible this week
 * Clears all test blocks so slots are available
 * @returns {string} Status message
 */
function setupSlotsVisible() {
  const cleared = clearAllTestBlocks();
  return 'Scenario: Slots visible - ' + cleared;
}

/**
 * Scenario: No slots this week
 * Blocks current week so scraper must use "Jump to next bookable date"
 * @returns {string} Status message
 */
function setupNoSlotsThisWeek() {
  clearAllTestBlocks();

  const monday = getCurrentWeekMonday();
  blockWeek(monday.toISOString());

  return 'Scenario: No slots this week - current week blocked';
}

/**
 * Scenario: No availability anywhere
 * Blocks next 4 weeks so no slots are available
 * @returns {string} Status message
 */
function setupNoAvailability() {
  clearAllTestBlocks();

  const monday = getCurrentWeekMonday();

  for (let w = 0; w < 4; w++) {
    const weekStart = new Date(monday);
    weekStart.setDate(monday.getDate() + (w * 7));
    blockWeek(weekStart.toISOString());
  }

  return 'Scenario: No availability - 4 weeks blocked';
}

/**
 * Scenario: Specific slot available
 * Blocks most times but leaves specific slots open
 * @param {string} dayOfWeek - e.g., "tuesday"
 * @param {number} hour - e.g., 15 for 3pm
 * @returns {string} Status message
 */
function setupSpecificSlotAvailable(dayOfWeek, hour) {
  clearAllTestBlocks();

  const monday = getCurrentWeekMonday();
  const daysMap = {
    'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
    'friday': 4, 'saturday': 5, 'sunday': 6
  };

  // Block all days except the specific slot time
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = day.toISOString().split('T')[0];

    if (i === daysMap[dayOfWeek.toLowerCase()]) {
      // Block before and after the specific hour
      if (hour > 9) {
        blockSlot(dayStr, 9, hour);
      }
      if (hour < 20) {
        blockSlot(dayStr, hour + 1, 21);
      }
    } else {
      // Block entire day
      blockDay(dayStr);
    }
  }

  return 'Scenario: Only ' + dayOfWeek + ' ' + hour + ':00 available';
}

/**
 * Setup Tuesday 3pm as only available slot
 * (Matches common preference "Tue 3pm")
 */
function setupTuesday3pmOnly() {
  return setupSpecificSlotAvailable('tuesday', 15);
}

/**
 * Setup Thursday 2pm as only available slot
 */
function setupThursday2pmOnly() {
  return setupSpecificSlotAvailable('thursday', 14);
}

// ==========================================
// DIAGNOSTIC FUNCTIONS
// ==========================================

/**
 * List all test blocks currently in calendar
 * @returns {string} List of test blocks
 */
function listTestBlocks() {
  const cal = CalendarApp.getDefaultCalendar();
  const now = new Date();
  const future = new Date();
  future.setMonth(future.getMonth() + 3);

  const events = cal.getEvents(now, future);
  const testBlocks = events.filter(e => e.getTitle().includes('[TEST BLOCK]'));

  if (testBlocks.length === 0) {
    return 'No test blocks found';
  }

  const list = testBlocks.map(e => {
    const start = e.getStartTime();
    return start.toDateString() + ' ' + start.getHours() + ':00-' + e.getEndTime().getHours() + ':00';
  });

  return 'Test blocks:\n' + list.join('\n');
}
