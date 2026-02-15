import { jest } from '@jest/globals';
import { BookingService } from '../booking-service.js';

describe('BookingService', () => {
  const mockConfig = {
    booking_url: 'https://test.com',
    preferences: ['tue 3pm', 'wed 4pm'],
    email: 'test@test.com',
    first_name: 'Test',
    last_name: 'User',
    phone: '555-1234',
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

  describe('scraper skips non-matching dates and finds match weeks later', () => {
    test('books 8:30pm slot when scraper returns it after skipping daytime-only dates', async () => {
      // Simulates: scraper checked March 5 (daytime only), skipped it,
      // found March 19 (8:30pm) — returns only the matching week's slots
      const mockScraper = {
        scrape: jest.fn().mockResolvedValue([
          { text: 'Thursday 8:30pm', normalized: 'thu 8:30pm', timestamp: 1742558400000 },
        ]),
        book: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(undefined),
      };

      const config = {
        ...mockConfig,
        preferences: ['Thu 8:30pm'],
      };

      const service = new BookingService({ dryRun: false, scraper: mockScraper });
      const result = await service.attemptBooking(config);

      expect(result.success).toBe(true);
      expect(result.slot.normalized).toBe('thu 8:30pm');
      expect(mockScraper.scrape).toHaveBeenCalledWith(config.booking_url, ['Thu 8:30pm']);
      expect(mockScraper.book).toHaveBeenCalled();
      expect(mockScraper.close).toHaveBeenCalled();
    });

    test('returns no_slots when scraper finds no matching slots across all months', async () => {
      // Scraper checked all available dates, none had 8:30pm
      const mockScraper = {
        scrape: jest.fn().mockResolvedValue([]),
        close: jest.fn().mockResolvedValue(undefined),
      };

      const config = {
        ...mockConfig,
        preferences: ['Thu 8:30pm'],
      };

      const service = new BookingService({ dryRun: false, scraper: mockScraper });
      const result = await service.attemptBooking(config);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_slots');
      expect(mockScraper.close).toHaveBeenCalled();
    });
  });

  describe('without scraper or mock slots', () => {
    test('throws when no scraper and no mock slots', async () => {
      const service = new BookingService({ dryRun: true });
      await expect(service.attemptBooking(mockConfig)).rejects.toThrow('No slots provided and no scraper configured');
    });
  });

  describe('with mock scraper', () => {
    test('calls scraper.book() and returns success on real booking', async () => {
      const mockScraper = {
        scrape: jest.fn().mockResolvedValue([
          { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm', timestamp: 123 }
        ]),
        book: jest.fn().mockResolvedValue(true),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const service = new BookingService({ dryRun: false, scraper: mockScraper });
      const result = await service.attemptBooking(mockConfig);

      expect(result.success).toBe(true);
      expect(result.slot.normalized).toBe('tue 3pm');
      expect(result.dryRun).toBeUndefined();
      expect(mockScraper.book).toHaveBeenCalled();
      expect(mockScraper.close).toHaveBeenCalled();
    });

    test('returns booking_failed when scraper.book() returns false', async () => {
      const mockScraper = {
        scrape: jest.fn().mockResolvedValue([
          { text: 'Tuesday 3:00 PM', normalized: 'tue 3pm', timestamp: 123 }
        ]),
        book: jest.fn().mockResolvedValue(false),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const service = new BookingService({ dryRun: false, scraper: mockScraper });
      const result = await service.attemptBooking(mockConfig);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('booking_failed');
      expect(mockScraper.close).toHaveBeenCalled();
    });

    test('does not call close if scrape throws (scraper handles own cleanup)', async () => {
      const mockScraper = {
        scrape: jest.fn().mockRejectedValue(new Error('scrape failed')),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const service = new BookingService({ dryRun: false, scraper: mockScraper });
      await expect(service.attemptBooking(mockConfig)).rejects.toThrow('scrape failed');
      expect(mockScraper.close).not.toHaveBeenCalled();
    });

    test('returns no_slots when scraper returns null', async () => {
      const mockScraper = {
        scrape: jest.fn().mockResolvedValue(null),
        close: jest.fn().mockResolvedValue(undefined),
      };
      const service = new BookingService({ dryRun: false, scraper: mockScraper });
      const result = await service.attemptBooking(mockConfig);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('no_slots');
      expect(mockScraper.close).toHaveBeenCalled();
    });
  });
});
