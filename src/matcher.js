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
