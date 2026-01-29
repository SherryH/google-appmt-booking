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

    // Real booking with Puppeteer
    if (this.scraper && this.scraper.book) {
      const userInfo = {
        email: config.email,
        firstName: config.first_name || '',
        lastName: config.last_name || '',
        phone: config.phone || null,
      };

      console.log(`📝 Booking slot: ${matchedSlot.text}`);
      const booked = await this.scraper.book(matchedSlot, userInfo);

      // Close the browser after booking attempt
      if (this.scraper.close) {
        await this.scraper.close();
      }

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
