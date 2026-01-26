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
