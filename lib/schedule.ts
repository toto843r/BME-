import type { Track } from './types';

// day: 0 = Sunday ... 4 = Thursday (Iraqi academic week). Times are 24h, device-local.
// !!! SAMPLE DATA - replace with the real timetable of each group. !!!
export interface Session {
  group: 'A' | 'B';
  day: 0 | 1 | 2 | 3 | 4;
  start: string;
  end: string;
  slug: string;
  track: Track; // 'main' for non-split courses
  room?: string;
}

export const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export const SCHEDULE: Session[] = [
  { group: 'A', day: 0, start: '08:30', end: '10:30', slug: 'biomedical-sensors', track: 'theory' },
  { group: 'A', day: 0, start: '10:30', end: '12:30', slug: 'control-systems', track: 'theory' },
  { group: 'A', day: 1, start: '08:30', end: '11:30', slug: 'microcontroller', track: 'lab' },
  { group: 'A', day: 2, start: '08:30', end: '10:30', slug: 'artificial-limbs', track: 'main' },
  { group: 'A', day: 3, start: '09:30', end: '11:30', slug: 'engineering-analysis', track: 'main' },
  { group: 'B', day: 0, start: '08:30', end: '10:30', slug: 'control-systems', track: 'theory' },
  { group: 'B', day: 0, start: '10:30', end: '12:30', slug: 'biomedical-sensors', track: 'theory' },
  { group: 'B', day: 1, start: '08:30', end: '11:30', slug: 'medical-measurements', track: 'lab' },
  { group: 'B', day: 2, start: '10:30', end: '12:30', slug: 'dynamics-of-human', track: 'main' },
  { group: 'B', day: 3, start: '09:30', end: '11:30', slug: 'engineering-analysis', track: 'main' },
];
