/**
 * The menu in five sections (N-01). The same list drives the desktop sidebar, the
 * phone menu and the bottom tab bar, so a screen can never be reachable from one
 * and missing from another.
 *
 *  - `badge` names a count from the one countsView on the server.
 *  - `admin` items are for the application administrator only.
 *  - `requires` is a capability a person must hold on at least one project.
 *
 * All five staff hold the same Project Editor level, so the menu differs only
 * between the administrator and everyone else.
 */
export const NAV_SECTIONS = [
  {
    label: 'Home',
    items: [
      { label: 'Today', to: '/today', icon: 'Sun', badge: 'today' },
      { label: 'Overview', to: '/overview', icon: 'LayoutDashboard' },
      { label: 'Villa matrix', to: '/matrix', icon: 'Grid3x3' },
    ],
  },
  {
    label: 'Villas',
    items: [
      { label: 'Villas', to: '/locations', icon: 'MapPin' },
      { label: 'Common areas', to: '/site-wide', icon: 'Construction' },
    ],
  },
  {
    label: 'Work',
    items: [
      { label: 'Tasks', to: '/tasks', icon: 'ClipboardList' },
      { label: 'Planning', to: '/planning', icon: 'CalendarRange' },
      { label: 'Daily activity', to: '/daily', icon: 'CalendarCheck' },
      { label: 'Blockers', to: '/blockers', icon: 'ShieldAlert', badge: 'blockers' },
      { label: 'Snags', to: '/handover', icon: 'ListChecks', badge: 'snags' },
      { label: 'Needs attention', to: '/attention', icon: 'ClipboardCheck', badge: 'attention' },
      { label: 'Ask DVG AI', to: '/ai', icon: 'Bot' },
    ],
  },
  {
    label: 'Teams',
    items: [
      { label: 'Contractors', to: '/contractors', icon: 'UsersRound' },
      { label: 'Contractor board', to: '/contractor-board', icon: 'HardHat' },
      { label: 'Meetings', to: '/meetings', icon: 'CalendarClock' },
    ],
  },
  {
    label: 'Setup',
    items: [
      { label: 'Projects', to: '/projects', icon: 'Building2', admin: true },
      { label: 'Users & access', to: '/access', icon: 'UserCog', admin: true },
      { label: 'Catalogues & data', to: '/admin', icon: 'Settings2', admin: true },
      { label: 'Import works', to: '/import', icon: 'Upload', requires: 'manage_project' },
      { label: 'Import history', to: '/import/history', icon: 'History', requires: 'manage_project' },
    ],
  },
  {
    label: 'Help',
    items: [{ label: 'Help & guides', to: '/help', icon: 'CircleHelp' }],
  },
];

/** The sections a person sees, with items they may not use left out. */
export function visibleSections(sections, { appAdmin = false, canAnywhere = () => false } = {}) {
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.admin) return appAdmin;
        if (item.requires) return appAdmin || canAnywhere(item.requires);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

/* ------------------------------------------------------------ the home screen */

export const HOME_CHOICES = { today: '/today', overview: '/overview' };
const MANAGEMENT = /manag|director|owner|executive|head|chief|\bmd\b|\bceo\b|\bgm\b/i;

/**
 * Where a person lands. A choice they made wins; otherwise the designation picks:
 * Today for site, MEP, procurement and planning staff, Overview for management
 * and the administrator.
 */
export function defaultHome({ designation = '', appAdmin = false, preference = '' } = {}) {
  if (HOME_CHOICES[preference]) return HOME_CHOICES[preference];
  if (appAdmin || MANAGEMENT.test(designation)) return HOME_CHOICES.overview;
  return HOME_CHOICES.today;
}

const PREF_KEY = 'dvg.home';
export const savedHomePreference = () => {
  try {
    return window.localStorage.getItem(PREF_KEY) || '';
  } catch {
    return '';
  }
};
export const saveHomePreference = (value) => {
  try {
    window.localStorage.setItem(PREF_KEY, value);
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
};
