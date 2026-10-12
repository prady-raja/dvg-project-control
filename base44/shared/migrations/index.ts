import { actualDates } from './actualDates.ts';
import { delayCategories } from './delayCategories.ts';
import { latestReportDate } from './latestReportDate.ts';
import { legacyRoles } from './legacyRoles.ts';
import { userMatching } from './userMatching.ts';

export const MIGRATIONS = [legacyRoles, latestReportDate, actualDates, delayCategories, userMatching];

export const migrationById = (id) => MIGRATIONS.find((m) => m.id === id) || null;
