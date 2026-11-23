// The shared exercise library from supabase/seed/exercises.sql, as objects (for engine tests; no personal data).
import { readFileSync } from 'node:fs';
const AXIAL = /^(Barbell Row|Pendlay Row|T-Bar Row|Deadlift|Sumo Deadlift|Good Morning|Romanian Deadlift|Stiff-Leg Deadlift|Back Squat|Front Squat|Hack Squat|Pendulum Squat|Smith Machine Squat|Overhead Press|Barbell Shrug)$/;
export function seedLibrary() {
  const sql = readFileSync(new URL('../supabase/seed/exercises.sql', import.meta.url), 'utf8');
  return [...sql.matchAll(/\(null,'((?:[^']|'')*)','([^']*)','([^']*)','([^']*)','([^']*)',(\d+),(\d+)/g)].map((m, i) => {
    const name = m[1].replace(/''/g, "'");
    return { id: 's' + i, name, muscle_group: m[2], equipment: m[3], kind: m[4], load_type: m[5], rep_min: +m[6], rep_max: +m[7], tags: AXIAL.test(name) ? ['axial'] : [] };
  });
}
