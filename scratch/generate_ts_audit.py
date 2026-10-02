import json
import os

with open(r'c:\Users\Keystone-Tech\Desktop\Домофондар\scratch\audit_data.json', encoding='utf-8') as f:
    d = json.load(f)

# Официальный производственный календарь РФ (праздничные и перенесенные выходные дни)
RUSSIAN_PUBLIC_HOLIDAYS = {
    # 2025 год
    "2025-11-03": "Выходной день (перенос ко Дню народного единства)",
    "2025-11-04": "День народного единства",
    "2025-12-31": "Новогодний выходной день",
    
    # 2026 год
    "2026-01-01": "Новогодние каникулы",
    "2026-01-02": "Новогодние каникулы",
    "2026-01-03": "Новогодние каникулы",
    "2026-01-04": "Новогодние каникулы",
    "2026-01-05": "Новогодние каникулы",
    "2026-01-06": "Новогодние каникулы",
    "2026-01-07": "Рождество Христово",
    "2026-01-08": "Новогодние каникулы",
    "2026-02-23": "День защитника Отечества",
    "2026-03-08": "Международный женский день",
    "2026-03-09": "Выходной день (перенос с 8 марта)",
    "2026-05-01": "Праздник Весны и Труда",
    "2026-05-02": "Праздничный выходной день",
    "2026-05-03": "Праздничный выходной день",
    "2026-05-04": "Праздничный перенесенный выходной день",
    "2026-05-09": "День Победы",
    "2026-05-10": "Праздничный выходной день",
    "2026-05-11": "Выходной день (перенос с 9 мая)",
    "2026-06-12": "День России",
    "2026-06-13": "Праздничный выходной день",
    "2026-06-14": "Праздничный выходной день",
}

# 6 категорий аудита времени
cat_stats = {
    "holiday": {"count": 0, "minutes": 0, "label": "Гос. праздник РФ (Нерабочий день)"},
    "weekend": {"count": 0, "minutes": 0, "label": "Выходные дни (Суббота / Воскресенье)"},
    "night": {"count": 0, "minutes": 0, "label": "Глубокая ночь (00:00–06:00)"},
    "morning": {"count": 0, "minutes": 0, "label": "Раннее утро (06:00–09:00)"},
    "evening": {"count": 0, "minutes": 0, "label": "Поздний вечер (17:00–00:00)"},
    "work_hours": {"count": 0, "minutes": 0, "label": "Рабочие часы (Будни 09:00–17:00)"},
}

days_map = {}
recalculated_commits = []

off_hours_minutes = 0
work_hours_minutes = 0
off_commits_count = 0
work_commits_count = 0

for c in d['commits']:
    date_str = c['date']
    is_weekend = c['isWeekend']
    holiday_name = RUSSIAN_PUBLIC_HOLIDAYS.get(date_str, None)
    is_holiday = holiday_name is not None
    is_non_working_day = is_weekend or is_holiday

    hour = int(c['time'].split(':')[0])
    minute = int(c['time'].split(':')[1])
    tod = hour * 60 + minute

    # Строгое рабочее время: НЕ выходной, НЕ праздник и строго с 09:00 (540 мин) до 17:00 (1020 мин)
    is_work_time = (not is_non_working_day) and (540 <= tod < 1020)
    mins = c['sessionMins']

    if is_holiday:
        category = "holiday"
        cat_label = f"Гос. праздник РФ: {holiday_name}"
    elif is_weekend:
        category = "weekend"
        cat_label = "Выходной день (Сб/Вс)"
    elif is_work_time:
        category = "work_hours"
        cat_label = "Рабочие часы (Будни 09:00–17:00)"
    elif hour < 6:
        category = "night"
        cat_label = "Глубокая ночь (00:00–06:00)"
    elif hour < 9:
        category = "morning"
        cat_label = "Раннее утро (06:00–09:00)"
    else:
        category = "evening"
        cat_label = "Поздний вечер (17:00–00:00)"

    cat_stats[category]['count'] += 1
    cat_stats[category]['minutes'] += mins

    if is_work_time:
        work_hours_minutes += mins
        work_commits_count += 1
    else:
        off_hours_minutes += mins
        off_commits_count += 1

    commit_obj = {
        "hash": c['hash'],
        "datetime": c['datetime'],
        "date": c['date'],
        "time": c['time'],
        "dayOfWeek": c['dayOfWeek'],
        "dayShort": c['dayShort'],
        "isWeekend": is_weekend,
        "isHoliday": is_holiday,
        "holidayName": holiday_name,
        "isWorkTime": is_work_time,
        "category": category,
        "catLabel": cat_label,
        "sessionMins": mins,
        "subject": c['subject']
    }
    recalculated_commits.append(commit_obj)

    if date_str not in days_map:
        days_map[date_str] = {
            "date": date_str,
            "dayOfWeek": c['dayOfWeek'],
            "dayShort": c['dayShort'],
            "isWeekend": is_weekend,
            "isHoliday": is_holiday,
            "holidayName": holiday_name,
            "totalCommits": 0,
            "offCommits": 0,
            "workCommits": 0,
            "offMinutes": 0,
            "workMinutes": 0,
            "commits": []
        }
    days_map[date_str]["totalCommits"] += 1
    days_map[date_str]["commits"].append({
        "hash": c['hash'],
        "time": c['time'],
        "datetime": c['datetime'],
        "category": category,
        "catLabel": cat_label,
        "isWorkTime": is_work_time,
        "sessionMins": mins,
        "subject": c['subject']
    })
    if is_work_time:
        days_map[date_str]["workCommits"] += 1
        days_map[date_str]["workMinutes"] += mins
    else:
        days_map[date_str]["offCommits"] += 1
        days_map[date_str]["offMinutes"] += mins

by_cat_export = {}
for k, v in cat_stats.items():
    by_cat_export[k] = {
        "count": v["count"],
        "hours": round(v["minutes"] / 60, 1),
        "label": v["label"]
    }

calendar_export = []
for date in sorted(days_map.keys()):
    dm = days_map[date]
    calendar_export.append({
        "date": dm["date"],
        "dayOfWeek": dm["dayOfWeek"],
        "dayShort": dm["dayShort"],
        "isWeekend": dm["isWeekend"],
        "isHoliday": dm["isHoliday"],
        "holidayName": dm["holidayName"],
        "totalCommits": dm["totalCommits"],
        "offCommits": dm["offCommits"],
        "workCommits": dm["workCommits"],
        "offHours": round(dm["offMinutes"] / 60, 1),
        "workHours": round(dm["workMinutes"] / 60, 1),
        "hasWorkCommits": dm["workCommits"] > 0,
        "commits": dm["commits"]
    })

total_mins = off_hours_minutes + work_hours_minutes
total_hours = round(total_mins / 60, 1)
off_hours = round(off_hours_minutes / 60, 1)
work_hours = round(work_hours_minutes / 60, 1)
total_commits = len(recalculated_commits)

off_pct = round(off_hours / total_hours * 100, 1)
work_pct = round(work_hours / total_hours * 100, 1)

ts_content = f'''/**
 * ==============================================================================
 * ЮРИДИЧЕСКИЙ АУДИТ РАБОЧЕГО И ВНЕРАБОЧЕГО ВРЕМЕНИ РАЗРАБОТКИ
 * С УЧЕТОМ ОФИЦИАЛЬНОГО ПРОИЗВОДСТВЕННОГО КАЛЕНДАРЯ РФ (2025–2026)
 * ==============================================================================
 * Платформа: «Домофондар»
 * Автор и разработчик: Можнов Владимир Сергеевич
 * Дата и время старта: 14 октября 2025 г. 02:26 (МСК, первый коммит {d['firstHash']})
 * 
 * КРИТЕРИИ АУДИТА:
 * 1. Рабочее время: Обычные будние дни (Пн–Пт) строго с 09:00 до 17:00 (МСК).
 * 2. Внерабочее (личное) время разработчика:
 *    - Все государственные праздники и перенесенные выходные дни РФ (1–8 января, 23 фев, 8–9 мар, 1–4 мая, 9–11 мая, 12 июня, 3–4 ноя, 31 дек).
 *    - Все субботы и воскресенья (полные 24 часа).
 *    - Будни: Глубокая ночь (00:00–06:00), Раннее утро (06:00–09:00), Поздний вечер (17:00–00:00).
 * ==============================================================================
 */

export type TimeCategory = 
  | "holiday"       // Государственный праздник РФ (Нерабочий день)
  | "weekend"       // Выходной день (Суббота / Воскресенье)
  | "night"         // Глубокая ночь (00:00–06:00)
  | "morning"       // Раннее утро (06:00–09:00)
  | "evening"       // Поздний вечер (17:00–00:00)
  | "work_hours";   // Рабочие часы (Будни 09:00–17:00)

export interface CommitAuditItem {{
  hash: string;
  datetime: string;      // YYYY-MM-DD HH:mm (МСК)
  date: string;          // YYYY-MM-DD
  time: string;          // HH:mm
  dayOfWeek: string;
  dayShort: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  isWorkTime: boolean;
  category: TimeCategory;
  catLabel: string;
  sessionMins: number;
  subject: string;
}}

export interface DayAudit {{
  date: string;
  dayOfWeek: string;
  dayShort: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName: string | null;
  totalCommits: number;
  offCommits: number;
  workCommits: number;
  offHours: number;
  workHours: number;
  hasWorkCommits: boolean;
  commits: Array<{{
    hash: string;
    time: string;
    datetime: string;
    category: TimeCategory;
    catLabel: string;
    isWorkTime: boolean;
    sessionMins: number;
    subject: string;
  }}>;
}}

export const RUSSIAN_HOLIDAYS_MAP: Record<string, string> = {json.dumps(RUSSIAN_PUBLIC_HOLIDAYS, ensure_ascii=False, indent=2)};

export const GIT_AUDIT_SUMMARY = {{
  totalCommits: {total_commits},
  firstCommitDate: "{d['firstCommit']}",
  firstCommitHash: "{d['firstHash']}",
  lastCommitDate: "{d['lastCommit']}",
  lastCommitHash: "{d['lastHash']}",
  
  totalHours: {total_hours},
  offHours: {off_hours},
  workHours: {work_hours},
  offPct: {off_pct},
  workPct: {work_pct},
  
  offCommits: {off_commits_count},
  workCommits: {work_commits_count},
  offCommitsPct: {round(off_commits_count / total_commits * 100, 1)},
  workCommitsPct: {round(work_commits_count / total_commits * 100, 1)},
  
  byCategory: {json.dumps(by_cat_export, ensure_ascii=False, indent=2)} as Record<TimeCategory, {{ count: number; hours: number; label: string }}>
}};

export const CALENDAR_DAYS: DayAudit[] = {json.dumps(calendar_export, ensure_ascii=False, indent=2)};

export const ALL_AUDIT_COMMITS: CommitAuditItem[] = {json.dumps(recalculated_commits, ensure_ascii=False, indent=2)};
'''

target_path = r'c:\Users\Keystone-Tech\Desktop\Домофондар\src\data\gitCommitAudit.ts'
with open(target_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print("Успешно сгенерирован gitCommitAudit.ts с праздничными днями!")
print(f"Внерабочее время: {off_hours} ч ({off_pct}%) | {off_commits_count} коммитов ({round(off_commits_count / total_commits * 100, 1)}%)")
print(f"Рабочее окно: {work_hours} ч ({work_pct}%) | {work_commits_count} коммитов ({round(work_commits_count / total_commits * 100, 1)}%)")
