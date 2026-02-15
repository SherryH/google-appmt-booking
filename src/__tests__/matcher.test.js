import { normalizeSlot, matchPreferences, extractDayOfWeek } from '../matcher.js';

describe('Matcher Module', () => {
  describe('normalizeSlot', () => {
    test('normalizes various formats', () => {
      expect(normalizeSlot('Tuesday 3:00 PM')).toBe('tue 3pm');
      expect(normalizeSlot('Wed 2:00pm')).toBe('wed 2pm');
      expect(normalizeSlot('THURSDAY 10:00 AM')).toBe('thu 10am');
      expect(normalizeSlot('Tue 3pm')).toBe('tue 3pm');
    });

    test('preserves non-zero minutes (half-hour times)', () => {
      expect(normalizeSlot('Tuesday 8:30pm')).toBe('tue 8:30pm');
      expect(normalizeSlot('Wed 9:30 AM')).toBe('wed 9:30am');
      expect(normalizeSlot('Thursday 8:30pm')).toBe('thu 8:30pm');
      expect(normalizeSlot('Fri 2:15pm')).toBe('fri 2:15pm');
      expect(normalizeSlot('Sat 11:45am')).toBe('sat 11:45am');
    });

    test('drops :00 minutes for cleaner matching', () => {
      // "3:00pm" should normalize to "3pm" so user can enter either
      expect(normalizeSlot('Monday 9:00am')).toBe('mon 9am');
      expect(normalizeSlot('Tuesday 3:00 PM')).toBe('tue 3pm');
    });

    test('returns null for null input', () => {
      expect(normalizeSlot(null)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(normalizeSlot('')).toBeNull();
    });

    test('returns null when no day is present', () => {
      expect(normalizeSlot('3:00pm')).toBeNull();
    });

    test('returns null when no time is present', () => {
      expect(normalizeSlot('Tuesday')).toBeNull();
    });

    test('handles 24h format', () => {
      expect(normalizeSlot('Tuesday 20:30')).toBe('tue 8:30pm');
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

    test('matches half-hour time preferences', () => {
      const slotsWithHalfHour = [
        { text: 'Tuesday 8:00pm', normalized: 'tue 8pm' },
        { text: 'Tuesday 8:30pm', normalized: 'tue 8:30pm' },
        { text: 'Wednesday 8:30pm', normalized: 'wed 8:30pm' },
        { text: 'Thursday 8:30pm', normalized: 'thu 8:30pm' },
      ];
      const preferences = ['Tue 8:30pm', 'Wed 8:30pm', 'Thu 8:30pm'];
      const match = matchPreferences(slotsWithHalfHour, preferences);
      expect(match.normalized).toBe('tue 8:30pm');
    });

    test('does not match 8pm when looking for 8:30pm', () => {
      const slotsOnlyFullHour = [
        { text: 'Tuesday 8:00pm', normalized: 'tue 8pm' },
        { text: 'Wednesday 8:00pm', normalized: 'wed 8pm' },
      ];
      const preferences = ['Tue 8:30pm', 'Wed 8:30pm'];
      const match = matchPreferences(slotsOnlyFullHour, preferences);
      expect(match).toBeNull(); // Should NOT match 8pm when looking for 8:30pm
    });
  });

  describe('extractDayOfWeek', () => {
    test('extracts full day name from abbreviated day', () => {
      expect(extractDayOfWeek('Thu 8:30pm')).toBe('Thursday');
    });

    test('extracts day from full day name', () => {
      expect(extractDayOfWeek('Monday 9am')).toBe('Monday');
    });

    test('handles lowercase input', () => {
      expect(extractDayOfWeek('wed 2pm')).toBe('Wednesday');
    });

    test('extracts day from Saturday slot', () => {
      expect(extractDayOfWeek('Sat 11:45am')).toBe('Saturday');
    });

    test('returns null for null input', () => {
      expect(extractDayOfWeek(null)).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(extractDayOfWeek('')).toBeNull();
    });

    test('returns null when no day is present', () => {
      expect(extractDayOfWeek('8:30pm')).toBeNull();
    });
  });
});
