import json

with open(r'c:\Users\Keystone-Tech\Desktop\Домофондар\scratch\audit_data.json', encoding='utf-8') as f:
    d = json.load(f)

holidays = {
    '2025-11-03', '2025-11-04', '2025-12-31',
    '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08',
    '2026-02-23', '2026-03-08', '2026-03-09',
    '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04',
    '2026-05-09', '2026-05-10', '2026-05-11',
    '2026-06-12', '2026-06-13', '2026-06-14',
}

off_c = 0
work_c = 0
off_mins = 0
work_mins = 0

for c in d['commits']:
    dt_str = c['date']
    is_weekend = c['isWeekend']
    is_holiday = dt_str in holidays
    
    is_non_working_day = is_weekend or is_holiday
    
    hour = int(c['time'].split(':')[0])
    minute = int(c['time'].split(':')[1])
    tod = hour * 60 + minute
    
    is_work = (not is_non_working_day) and (540 <= tod < 1020)
    mins = c['sessionMins']
    
    if is_work:
        work_c += 1
        work_mins += mins
    else:
        off_c += 1
        off_mins += mins

total_mins = off_mins + work_mins
total_c = len(d['commits'])
print(f"Всего коммитов: {total_c}")
print(f"ВНЕРАБОЧЕЕ ВРЕМЯ (ночи, вечера, сб/вс, гос. праздники РФ): {round(off_mins/60, 1)} ч ({round(off_mins/total_mins*100, 1)}%) | {off_c} коммитов ({round(off_c/total_c*100, 1)}%)")
print(f"РАБОЧЕЕ ОКНО (обычные будни 09:00–17:00): {round(work_mins/60, 1)} ч ({round(work_mins/total_mins*100, 1)}%) | {work_c} коммитов ({round(work_c/total_c*100, 1)}%)")
