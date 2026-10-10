import type { Track } from './types';

export interface Session {
  group: 'A' | 'B';
  day: 0 | 1 | 2 | 3 | 4;
  start: string;
  end: string;
  slug: string;
  track: Track;
  room?: string;
}

export const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

export const SCHEDULE: Session[] = [
  // ===== شعبة A =====
  { group: 'A', day: 0, start: '08:30', end: '10:30', slug: 'biomedical-sensors', track: 'theory', room: 'BME 5' },
  { group: 'A', day: 0, start: '10:30', end: '12:30', slug: 'artificial-limbs', track: 'main', room: 'BME 4' },
  { group: 'A', day: 1, start: '08:30', end: '10:30', slug: 'biomedical-sensors', track: 'lab', room: 'مختبر الأجهزة' },
  { group: 'A', day: 1, start: '10:30', end: '12:30', slug: 'control-systems', track: 'theory', room: 'BME 4' },
  { group: 'A', day: 2, start: '08:30', end: '10:30', slug: 'control-systems', track: 'lab', room: 'مختبر الحاسوب' },
  { group: 'A', day: 2, start: '10:30', end: '12:30', slug: 'control-systems', track: 'theory', room: 'BME 5' },
  { group: 'A', day: 2, start: '12:30', end: '14:30', slug: 'microcontroller', track: 'theory', room: 'BME 5' },
  { group: 'A', day: 3, start: '08:30', end: '11:30', slug: 'dynamics-of-human', track: 'main', room: 'BME 5' },
  { group: 'A', day: 3, start: '11:30', end: '13:30', slug: 'biomedical-sensors', track: 'theory', room: 'BME 4' },
  { group: 'A', day: 4, start: '08:30', end: '09:30', slug: 'medical-measurements', track: 'theory', room: 'م. الأجهزة الطبية' },
  { group: 'A', day: 4, start: '09:30', end: '11:30', slug: 'medical-measurements', track: 'lab', room: 'م. الأجهزة الطبية' },
  { group: 'A', day: 4, start: '11:30', end: '13:30', slug: 'microcontroller', track: 'lab', room: 'مختبر الحاسوب' },

  // ===== شعبة B =====
  { group: 'B', day: 0, start: '08:30', end: '10:30', slug: 'artificial-limbs', track: 'main', room: 'BME 4' },
  { group: 'B', day: 0, start: '10:30', end: '12:30', slug: 'biomedical-sensors', track: 'theory', room: 'BME 5' },
  { group: 'B', day: 1, start: '08:30', end: '10:30', slug: 'control-systems', track: 'theory', room: 'BME 4' },
  { group: 'B', day: 1, start: '10:30', end: '12:30', slug: 'biomedical-sensors', track: 'lab', room: 'مختبر الأجهزة' },
  { group: 'B', day: 2, start: '08:30', end: '10:30', slug: 'control-systems', track: 'theory', room: 'BME 5' },
  { group: 'B', day: 2, start: '10:30', end: '12:30', slug: 'microcontroller', track: 'theory', room: 'مختبر الحاسوب' },
  { group: 'B', day: 2, start: '12:30', end: '14:30', slug: 'control-systems', track: 'lab', room: 'مختبر الحاسوب' },
  { group: 'B', day: 3, start: '08:30', end: '10:30', slug: 'biomedical-sensors', track: 'theory', room: 'BME 4' },
  { group: 'B', day: 3, start: '10:30', end: '13:30', slug: 'dynamics-of-human', track: 'main', room: 'BME 5' },
  { group: 'B', day: 4, start: '08:30', end: '10:30', slug: 'microcontroller', track: 'lab', room: 'مختبر الحاسوب' },
  // Thursday B (fourth year) has exactly THREE sessions, per the college timetable:
  // Microcontroller Lab 08:30–10:30; break 10:30–11:30;
  // Medical Measurements theory 11:30–12:30; Medical Measurements Lab 12:30–14:30.
  { group: 'B', day: 4, start: '11:30', end: '12:30', slug: 'medical-measurements', track: 'theory', room: 'م. الأجهزة الطبية' },
  { group: 'B', day: 4, start: '12:30', end: '14:30', slug: 'medical-measurements', track: 'lab', room: 'م. الأجهزة الطبية' },
];
