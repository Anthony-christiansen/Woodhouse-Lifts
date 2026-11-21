"""Anthony's RP Hypertrophy history (AC IV, AC V), transcribed from the Woodhouse project logs.
Generates SQL that imports it into his Woodhouse Lifts account. Usage: python3 rp_history.py <user_uuid> > out.sql"""
import re, sys, uuid, datetime

CARDIO = {'Sprints', 'Zone 2 Cardio', 'Assault Bike'}
ISOLATION = {'Leg Extension', 'Leg Press Calves', 'Pec Dec Flye', 'Cable Overhead Triceps Extension', 'Machine Triceps Pushdown',
  'Machine Lateral Raise', 'Machine Crunch', 'Oblique Machine', 'Lying Dumbbell Curl', 'Machine Preacher Curl', 'Machine Reverse Flye',
  'Cable Wrist Curl', 'Machine Glute Kickback', 'Seated Leg Curl', 'Calf Machine', 'Machine Triceps Extension', 'Pallof Press', 'Dead Bug',
  'Standing Knee Drive', 'Incline EZ Bar Skull Crusher'}
EQUIP = {'Dumbbell': 'Dumbbell', 'Barbell': 'Barbell', 'Cable': 'Cable', 'Machine': 'Machine', 'Pec Dec': 'Machine', 'Leg Press': 'Machine',
  'Pulldown': 'Cable', 'Lying Dumbbell': 'Dumbbell', 'Bulgarian': 'Dumbbell', 'EZ Bar': 'Barbell'}

IV = [
 [('Quads','Standing Knee Drive',['9, 8 @ 135','9, 9 @ 145','9, 9 @ 147.5','9, 9 @ 160','13, 11 @ 160','8 @ 145']),
  ('Quads','Leg Press',['13, 12 @ 235','13, 12 @ 240','12, 11 @ 250','11, 10 @ 260','14, 13 @ 250','9 @ 225']),
  ('Calves','Leg Press Calves',['10, 10 @ 235','10, 10 @ 240','10, 10 @ 245','10, 10 @ 250','10, 10 @ 255','7, 7 @ 230']),
  ('Quads','Leg Extension',['12, 12 @ 137.5','13, 13 @ 137.5','10, 10 @ 150','11, 11 @ 150','9, 9 @ 162.5','-']),
  ('Glutes','Bulgarian Split Squat (Glute-Focused)',['8, 8 @ 45','8, 8 @ 50','9, 9 @ 50','10, 10 @ 50','11, 11 @ 50','7, 7 @ 45']),
  ('Hamstrings','Weighted Glute Deck Raise',['16 @ 230','14 @ 245','13 @ 255','14 @ 255','14 @ 262.5','10, 10 @ 230']),
  ('Abs','Pallof Press',['-','-','-','16, 16 @ 20','18, 17 @ 20','11 @ 17.5']),
  ('Abs','Dead Bug',['-','-','-','14, 14 @ 198','16, 16 @ 195','9 @ 185'])],
 [('Chest','Dumbbell Press (Low Incline)',['12, 10 @ 60','13, 11 @ 60','14, 12 @ 60','12, 10, 8 @ 65','13, 11, 9 @ 65','8 @ 60']),
  ('Chest','Pec Dec Flye',['6, 6 @ 145','7, 7 @ 150','8, 8 @ 155','8, 8, 8 @ 160','8, 8, 8 @ 165','6 @ 147.5']),
  ('Triceps','Cable Overhead Triceps Extension',['8, 8 @ 25','9, 9 @ 25','10, 10 @ 25','11, 11 @ 25','12, 12, 12 @ 25','8 @ 22.5']),
  ('Triceps','Machine Triceps Pushdown',['8, 8 @ 160','8, 8 @ 165','8, 8 @ 170','8, 8, 8 @ 175','8, 8 @ 180','6 @ 162.5']),
  ('Shoulders','Machine Lateral Raise',['11, 11, 11 @ 75','12, 12, 12 @ 75','10, 10, 10 @ 80','9, 9, 9 @ 85','8, 8, 8 @ 90','6, 6 @ 80']),
  ('Abs','Machine Crunch',['7, 7 @ 105','12, 12 @ 95','12, 12 @ 110','12, 12 @ 112.5','12, 12 @ 115','8 @ 102.5']),
  ('Abs','Oblique Machine',['7, 7 @ 105','12, 12 @ 95','12, 12 @ 110','12, 12 @ 112.5','12, 12 @ 115','8 @ 102.5']),
  ('Cardio','Sprints',['2, 2 @ 10','2, 2 @ 10','2, 2 @ 10','2, 2 @ 10','3, 3 @ 10','2, 2 @ 6.5'])],
 [('Back','Assisted Pullup (Underhand Grip)',['10, 8 @ 175','10, 8 @ 180','10, 8 @ 185','11, 9 @ 185','12, 10 @ 185','8 @ 167.5']),
  ('Back','Barbell Bent Over Row',['11, 11 @ 60','12, 12 @ 60','13, 13 @ 60','11, 11 @ 65','12, 12 @ 65','7 @ 60']),
  ('Biceps','Lying Dumbbell Curl',['9, 9, 9 @ 25','6, 6, 6 @ 30','7, 7, 7 @ 30','8, 8, 8 @ 30','9, 9, 9 @ 30','6 @ 27.5']),
  ('Biceps','Machine Preacher Curl',['9, 9, 8 @ 30','10, 10, 9 @ 30','11, 11, 10 @ 30','12, 12, 11 @ 30','13, 13, 12 @ 30','8 @ 27.5']),
  ('Shoulders','Machine Reverse Flye',['8, 8, 8 @ 85','8, 8, 8 @ 90','8, 8, 8 @ 95','8, 8, 8 @ 97.5','8, 8, 8 @ 100','6, 6 @ 90']),
  ('Forearms','Cable Wrist Curl',['10, 10, 10 @ 50','11, 11, 11 @ 50','12, 12, 12 @ 50','13, 13, 13 @ 50','14, 14, 14 @ 50','-']),
  ('Abs','Machine Crunch',['10, 10 @ 100','10, 10 @ 102.5','10, 10 @ 105','10, 10 @ 107.5','10, 10 @ 110','7 @ 100']),
  ('Abs','Oblique Machine',['10, 10 @ 100','10, 10 @ 102.5','10, 10 @ 105','10, 10 @ 107.5','10, 10 @ 110','7 @ 100']),
  ('Cardio','Zone 2 Cardio',['12, 12 @ 185','13, 13 @ 185','14, 14 @ 185','15, 15 @ 185','16, 16 @ 185','8, 8 @ 185'])],
 [('Quads','Standing Knee Drive',['6, 6 @ 145','8, 8 @ 150','8, 8 @ 155','8, 8 @ 160','8, 8 @ 165','5 @ 82.5']),
  ('Quads','Sled Pull to Body Squat',['22, 19 @ 475','22, 19 @ 485','23, 20 @ 485','24, 21 @ 485','25, 22 @ 485','9 @ 242.5']),
  ('Glutes','Machine Glute Kickback',['9, 9 @ 67.5','9, 9 @ 70','9, 9 @ 72.5','9, 9 @ 75','9, 9 @ 77.5','5, 5 @ 40']),
  ('Hamstrings','Seated Leg Curl',['10 @ 150','15 @ 135','15, 15 @ 137.5','15, 15 @ 140','15, 15 @ 142.5','7, 7 @ 72.5']),
  ('Quads','Leg Extension',['10, 10 @ 162.5','11, 11 @ 162.5','11, 11 @ 167.5','11, 11 @ 175','11, 11 @ 180','-']),
  ('Calves','Calf Machine',['8, 8 @ 130','9, 9 @ 130','12, 12 @ 130','13, 13 @ 130','13, 13 @ 132.5','6, 6 @ 67.5']),
  ('Abs','Pallof Press',['-','-','16, 16 @ 30','18, 18 @ 20','19, 19 @ 20','7 @ 10']),
  ('Abs','Dead Bug',['-','-','16, 16 @ 195','24, 24 @ 195','24, 24 @ 200','5 @ 185'])],
 [('Shoulders','Machine Lateral Raise',['10, 7, 7 @ 80','11, 8, 8 @ 80','12, 9, 9 @ 80','12, 9, 9 @ 82.5','12, 9, 9 @ 85','6, 5 @ 42.5']),
  ('Triceps','Cable Overhead Triceps Extension',['17, 15 @ 15','18, 16 @ 15','19, 17 @ 15','20, 18 @ 15','21, 19 @ 15','8 @ 7.5']),
  ('Triceps','Machine Triceps Extension',['16, 14 @ 75','17, 15 @ 75','18, 16 @ 75','18, 16 @ 77.5','18, 16 @ 80','8 @ 40']),
  ('Chest','Dumbbell Press (Low Incline)',['7, 5 @ 60','8, 6 @ 60','9, 7 @ 60','10, 8 @ 60','11, 9 @ 60','6, 5 @ 30']),
  ('Biceps','Lying Dumbbell Curl',['9, 9, 9 @ 25','6, 6, 6 @ 30','7, 7, 7 @ 30','8, 8, 8 @ 30','9, 9, 9 @ 30','5 @ 15']),
  ('Biceps','Machine Preacher Curl',['8, 8, 8 @ 30','9, 9, 9 @ 30','10, 10, 10 @ 30','11, 11, 11 @ 30','12, 12, 12 @ 30','6 @ 15']),
  ('Back','Pulldown (Single-Arm)',['16, 14 @ 55','17, 15 @ 55','14, 12 @ 60','15, 13 @ 60','16, 14 @ 60','7, 6 @ 30']),
  ('Forearms','Cable Wrist Curl',['9, 9, 9 @ 50','10, 10, 10 @ 50','11, 11, 11 @ 50','12, 12, 12 @ 50','13, 13, 13 @ 50','-']),
  ('Abs','Machine Crunch',['8, 8 @ 107.5','8, 8 @ 110','8, 8 @ 112.5','8, 8 @ 115','8, 8 @ 117.5','5 @ 60']),
  ('Abs','Oblique Machine',['8, 8 @ 107.5','8, 8 @ 110','8, 8 @ 112.5','8, 8 @ 115','8, 8 @ 117.5','5 @ 60']),
  ('Cardio','Assault Bike',['3 @ 22.5; 3 @ 20','2, 2 @ 40','3, 2 @ 35','3, 2 @ 32.5','3, 3 @ 30','-'])],
]
V = [
 [('Quads','Standing Knee Drive',['7, 7 @ 160','7, 7 @ 165','7, 7 @ 170','7, 7 @ 175','7, 7 @ 180','5 @ 162.5']),
  ('Quads','Leg Press',['11, 10 @ 245','11, 10 @ 250','14, 12 @ 245','13, 11 @ 255','13, 11 @ 260','12 @ 210']),
  ('Calves','Leg Press Calves',['9, 9 @ 245','9, 9 @ 250','11, 11 @ 245','10, 10 @ 255','10, 10 @ 260','11, 11 @ 210']),
  ('Quads','Leg Extension',['9, 9 @ 150','9, 9 @ 162.5','7, 7 @ 175','7, 7 @ 180','12, 12 @ 162.5','-']),
  ('Glutes','Bulgarian Split Squat (Glute-Focused)',['8, 8 @ 50','9, 9 @ 50','10, 10 @ 50','11, 11 @ 50','12, 12 @ 50','8, 8 @ 45']),
  ('Hamstrings','Weighted Glute Deck Raise',['12, 11 @ 255','11, 10 @ 265','11, 9 @ 275','12, 10 @ 274','13, 11 @ 274','11, 10 @ 229']),
  ('Abs','Pallof Press',['14, 14 @ 20','15, 15 @ 20','20, 20 @ 25','21, 21 @ 25','22, 22 @ 25','13 @ 22.5']),
  ('Abs','Dead Bug',['16, 12 @ 198','16, 12 @ 202.5','16, 12 @ 207.5','18, 14 @ 204','18, 14 @ 209','11 @ 189'])],
 [('Chest','Dumbbell Press (Low Incline)',['10, 8 @ 65','11, 9 @ 65','12, 11 @ 65','13, 12 @ 65','14, 13, 8 @ 65','8 @ 60']),
  ('Chest','Pec Dec Flye',['8, 8 @ 160','8, 8 @ 165','8, 8, 8 @ 170','8, 8, 8 @ 175','8, 8, 8 @ 180','6 @ 162.5']),
  ('Triceps','Cable Overhead Triceps Extension',['9, 9 @ 25','10, 10 @ 25','11, 11, 11 @ 25','12, 12, 12 @ 25','13, 13, 13 @ 25','12 @ 20']),
  ('Triceps','Machine Triceps Pushdown',['8, 8 @ 175','8, 8 @ 180','8, 8 @ 185','8, 8 @ 190','8, 8 @ 195','6 @ 175']),
  ('Shoulders','Machine Lateral Raise',['7, 7, 7 @ 85','10, 10, 10 @ 80','9, 9, 9 @ 85','10, 10, 10 @ 85','9, 9, 9 @ 90','6, 6 @ 80']),
  ('Abs','Machine Crunch',['10, 10 @ 112.5','10, 10 @ 115','10, 10 @ 120','10, 10 @ 122.5','10, 10 @ 125','7 @ 112.5']),
  ('Abs','Oblique Machine',['10, 10 @ 112.5','10, 10 @ 115','10, 10 @ 120','10, 10 @ 122.5','10, 10 @ 125','7 @ 112.5']),
  ('Cardio','Sprints',['2, 2 @ 7.5','2, 2 @ 10','2, 2 @ 10','3, 2 @ 10','3, 2 @ 10','6, 6 @ 7.5'])],
 [('Back','Assisted Pullup (Underhand Grip)',['11, 9 @ 175','11, 9 @ 180','11, 9 @ 184','12, 10, 8 @ 184','13, 11, 9 @ 184','8 @ 166.5']),
  ('Back','Barbell Bent Over Row',['9, 9 @ 65','10, 10 @ 65','11, 11 @ 65','12, 12 @ 65','13, 13 @ 65','8 @ 60']),
  ('Biceps','Lying Dumbbell Curl',['6, 6, 6 @ 30','7, 7, 7 @ 30','8, 8, 8 @ 30','9, 9, 9 @ 30','10, 10, 10 @ 30','6 @ 27.5']),
  ('Biceps','Machine Preacher Curl',['10, 10, 9 @ 30','11, 11, 10 @ 30','8, 8, 7 @ 33','7, 7, 6 @ 35','8, 8, 7 @ 35','5 @ 32.5']),
  ('Shoulders','Machine Reverse Flye',['6, 6, 6 @ 100','8, 7, 6 @ 105','11, 10, 9 @ 100','10, 9, 8 @ 105','10, 9, 8 @ 107.5','7, 6 @ 97.5']),
  ('Forearms','Cable Wrist Curl',['11, 11, 11 @ 50','12, 12, 12 @ 50','13, 13, 13 @ 50','9, 9, 9 @ 56','9, 9, 9 @ 57.5','-']),
  ('Abs','Machine Crunch',['8, 8 @ 110','8, 8 @ 112.5','8, 8 @ 115','8, 8 @ 117.5','8, 8 @ 120','6 @ 107.5']),
  ('Abs','Oblique Machine',['8, 8 @ 110','8, 8 @ 112.5','8, 8 @ 115','8, 8 @ 117.5','8, 8 @ 120','6 @ 107.5']),
  ('Cardio','Zone 2 Cardio',['13, 13 @ 185','14, 14 @ 185','15, 15 @ 184','16, 16 @ 184','17, 17 @ 184','8, 8 @ 184'])],
 [('Quads','Standing Knee Drive',['6, 6 @ 160','6, 6 @ 165','6, 6 @ 170','6, 6 @ 175','6, 6 @ 180','5 @ 90']),
  ('Quads','Sled Pull to Body Squat',['22, 19 @ 480','23, 20 @ 485','24, 21 @ 484','25, 22 @ 484','26, 23 @ 484','9 @ 241.5']),
  ('Glutes','Machine Glute Kickback',['8, 8 @ 72.5','8, 8 @ 75','6, 6 @ 80','6, 6 @ 82.5','6, 6 @ 85','5, 5 @ 42.5']),
  ('Hamstrings','Seated Leg Curl',['13, 13 @ 140','13, 13 @ 145','13, 13 @ 150','18, 18 @ 135','18, 18 @ 137.5','7, 7 @ 70']),
  ('Quads','Leg Extension',['9, 9 @ 175','7, 7 @ 187.5','11, 11 @ 175','11, 11 @ 180','11, 11 @ 185','-']),
  ('Calves','Calf Machine',['8, 8 @ 140','8, 8 @ 142.5','13, 13 @ 130','14, 14 @ 130','14, 14 @ 132.5','6, 6 @ 67.5']),
  ('Abs','Pallof Press',['16, 16 @ 20','17, 17 @ 20','18, 18 @ 20','19, 19 @ 20','20, 20 @ 20','8 @ 10']),
  ('Abs','Dead Bug',['22, 22 @ 195','22, 22 @ 200','22, 22 @ 204','22, 22 @ 209','22, 22 @ 214','5 @ 184'])],
 [('Shoulders','Machine Lateral Raise',['10, 7 @ 85','11, 8 @ 85','11, 8 @ 87.5','13, 10 @ 85','13, 10 @ 87.5','6 @ 45']),
  ('Shoulders','Machine Reverse Flye',['8, 8 @ 90','9, 9 @ 90','10, 10 @ 90','10, 10 @ 92.5','10, 10 @ 95','6 @ 47.5']),
  ('Triceps','Cable Overhead Triceps Extension',['18, 16 @ 15','19, 17 @ 15','20, 18 @ 15','21, 19 @ 15','22, 20 @ 15','8 @ 7.5']),
  ('Triceps','Machine Triceps Extension',['17, 15 @ 75','17, 15 @ 77.5','17, 15 @ 80','14, 12 @ 87.5','14, 12 @ 90','16 @ 45']),
  ('Chest','Dumbbell Press (Low Incline)',['8, 6 @ 60','12, 10 @ 55','9, 7 @ 60','10, 8 @ 60','11, 9 @ 60','6, 5 @ 30']),
  ('Biceps','Lying Dumbbell Curl',['6, 6, 6 @ 30','7, 7, 7 @ 30','8, 8, 8 @ 30','9, 9, 9 @ 30','10, 10, 10 @ 30','6 @ 15']),
  ('Biceps','Machine Preacher Curl',['6, 6, 6 @ 32.5','7, 7, 7 @ 32.5','5, 5, 5 @ 34.75','6, 6, 6 @ 35','7, 7, 7 @ 35','5 @ 17.5']),
  ('Back','Pulldown (Single-Arm)',['8, 6 @ 70','8, 8 @ 75','6, 6 @ 80','8, 6 @ 85','8, 6 @ 87.5','5, 5 @ 45']),
  ('Forearms','Cable Wrist Curl',['10, 10, 10 @ 50','11, 11, 11 @ 50','12, 12, 12 @ 50','13, 13, 13 @ 50','14, 14, 14 @ 50','-']),
  ('Abs','Machine Crunch',['6, 6 @ 115','6, 6 @ 117.5','6, 6 @ 120','6, 6 @ 122.5','6, 6 @ 125','5 @ 62.5']),
  ('Abs','Oblique Machine',['6, 6 @ 115','6, 6 @ 117.5','6, 6 @ 120','6, 6 @ 122.5','6, 6 @ 125','5 @ 62.5']),
  ('Cardio','Assault Bike',['3, 3 @ 27.5','2, 2 @ 25','4, 4 @ 22.5','2, 2 @ 40','5, 3 @ 35','-'])],
]

def parse(cell):
    if cell.strip() == '-': return []
    out = []
    for part in cell.split(';'):
        reps, w = part.split('@')
        out += [(int(r), float(w)) for r in re.findall(r'\d+', reps)]
    return out

def rir(week, weeks=6):
    if week == weeks: return 4
    n = weeks - 1
    return max(0, 3 - round((week - 1) * 3 / (n - 1)))

q = lambda s: "'" + s.replace("'", "''") + "'"

def main(user):
    out = ['begin;']
    names = {}
    for meso in (IV, V):
        for wk in meso:
            for mg, name, _ in wk: names[name] = mg
    names['Incline EZ Bar Skull Crusher'] = 'Triceps'
    for name, mg in sorted(names.items()):
        lt = 'cardio' if name in CARDIO else 'weighted'
        kind = 'isolation' if name in ISOLATION else 'compound'
        eq = next((v for k, v in EQUIP.items() if k in name), 'Machine' if lt != 'cardio' else 'Bike' if 'Bike' in name else 'Bodyweight')
        out.append(f"insert into public.exercises (owner_id,name,muscle_group,equipment,kind,load_type,rep_min,rep_max,notes) values "
                   f"({q(user)},{q(name)},{q(mg)},{q(eq)},{q(kind)},{q(lt)},{1 if lt=='cardio' else 6},{60 if lt=='cardio' else 20},'Imported from RP Hypertrophy') "
                   f"on conflict do nothing;")
    plans = [('Whole Body Split AC IV', IV, datetime.date(2026, 6, 1)), ('Whole Body Split AC V', V, datetime.date(2026, 7, 20))]
    for title, meso, start in plans:
        mid = str(uuid.uuid4())
        out.append(f"insert into public.mesocycles (id,user_id,name,weeks,days_per_week,status,source,focus,started_on,notes) values "
                   f"({q(mid)},{q(user)},{q(title)},6,5,'completed','rp_import','whole',{q(start.isoformat())},"
                   f"'Imported from RP Hypertrophy logs; dates approximate.');")
        for week in range(1, 7):
            for di, rows in enumerate(meso, start=1):
                did = str(uuid.uuid4())
                day = start + datetime.timedelta(days=(week - 1) * 7 + [0, 1, 3, 4, 5][di - 1])
                ts = f"{day.isoformat()}T18:00:00Z"
                out.append(f"insert into public.workout_days (id,user_id,mesocycle_id,week,day_index,label,started_at,completed_at) values "
                           f"({q(did)},{q(user)},{q(mid)},{week},{di},'Workout {di}',{q(ts)},{q(ts)});")
                for pos, (mg, name, cells) in enumerate(rows, start=1):
                    sets = parse(cells[week - 1]); weid = str(uuid.uuid4())
                    out.append(f"insert into public.workout_exercises (id,user_id,workout_day_id,exercise_id,position,target_sets,target_rir) "
                               f"select {q(weid)},{q(user)},{q(did)},id,{pos},{len(sets)},{rir(week)} from public.exercises where owner_id={q(user)} and name={q(name)};")
                    for si, (reps, w) in enumerate(sets, start=1):
                        out.append(f"insert into public.sets (user_id,workout_exercise_id,set_index,weight,reps,rir,completed_at) values "
                                   f"({q(user)},{q(weid)},{si},{w},{reps},{rir(week)},{q(ts)});")
    out.append('commit;')
    print('\n'.join(out))

if __name__ == '__main__':
    main(sys.argv[1])
