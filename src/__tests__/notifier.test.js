import { shouldNotifyFailure, formatFailureEmail } from '../notifier.js';

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

    test('returns false for 0 failures', () => {
      expect(shouldNotifyFailure(0)).toBe(false);
    });
  });

  describe('formatFailureEmail', () => {
    test('formats failure email correctly', () => {
      const result = formatFailureEmail('no_match', 3, ['Mon 9am', 'Fri 5pm']);

      expect(result.subject).toContain('Issue');
      expect(result.html).toContain('no_match');
      expect(result.html).toContain('3');
    });

    test('does not include slots list section when availableSlots is empty', () => {
      const result = formatFailureEmail('no_slots', 3, []);

      expect(result.subject).toContain('Issue');
      expect(result.html).toContain('no_slots');
      expect(result.html).not.toContain('<ul>');
      expect(result.html).not.toContain('Available slots were');
    });
  });
});
