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
