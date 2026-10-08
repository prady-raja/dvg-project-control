/**
 * The company's standard area vocabulary.
 *
 * These are labels, not mandatory rooms: every villa is customised, so an import
 * may name a room that no villa has registered, and two villas may use the same
 * word for different spaces. Nothing here ever creates a room, merges two rooms
 * or replaces what the file said — a label is only ever offered as a suggestion
 * beside the original wording, for a person to accept or ignore.
 *
 * The list is configuration: add a label or an alias here and the whole import
 * path picks it up.
 */

/** The standard labels, grouped the way the site talks about them. */
export const STANDARD_AREA_LABELS = [
  // Bedrooms
  'Master Bedroom',
  'Parents Bedroom',
  'Guest Bedroom',
  'Kids Bedroom',
  // Living and entertainment
  'Living Room',
  'Sunken Living',
  'Family Lounge',
  'Sports Lounge',
  'Home Theatre',
  'Bar Area',
  'Gym',
  'Office',
  // Kitchen and dining
  'Wet Kitchen',
  'Dry Kitchen',
  'Dining Room',
  'Store Room',
  'Utility Area',
  // Other interior spaces
  'Bathroom',
  'Powder Room',
  'Walk-in Wardrobe',
  'Pooja Room',
  'Foyer',
  'Corridor',
  'Staircase',
  // External and service spaces
  'Balcony',
  'Terrace',
  'Courtyard',
  'Garden',
  'Swimming Pool',
  'Pool Deck',
  'Plant Room',
  'Servant Quarters',
  'Service Yard',
];

/** Names the site uses that mean one of the labels above. */
export const STANDARD_AREA_ALIASES = {
  'mbr': 'Master Bedroom',
  'master bed': 'Master Bedroom',
  'master bedroom': 'Master Bedroom',
  'master br': 'Master Bedroom',
  'sunken lounge': 'Sunken Living',
  'sunken living': 'Sunken Living',
  'kids room': 'Kids Bedroom',
  'kids bedroom': 'Kids Bedroom',
  'children room': 'Kids Bedroom',
  'staff quarters': 'Servant Quarters',
  'servant quarter': 'Servant Quarters',
  'servants quarters': 'Servant Quarters',
  'servant room': 'Servant Quarters',
  'family room': 'Family Lounge',
  'wet kitchen': 'Wet Kitchen',
  'dry kitchen': 'Dry Kitchen',
  'utility': 'Utility Area',
  'store': 'Store Room',
  'stair': 'Staircase',
  'toilet': 'Bathroom',
  'wc': 'Bathroom',
  'washroom': 'Bathroom',
  'parking': 'Service Yard',
  'pool': 'Swimming Pool',
};

/** Matching key: lower case, punctuation removed, spacing collapsed. */
export const areaKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const LABEL_KEYS = new Map(STANDARD_AREA_LABELS.map((label) => [areaKey(label), label]));

/**
 * The standard label a piece of source text reads as, or '' when it does not
 * read as one. Only a whole-name match counts: a room the file calls something
 * else is left alone rather than being folded into the nearest label.
 */
export function standardLabelHint(text) {
  const key = areaKey(text);
  if (!key) return '';
  if (LABEL_KEYS.has(key)) return LABEL_KEYS.get(key);
  return STANDARD_AREA_ALIASES[key] || '';
}