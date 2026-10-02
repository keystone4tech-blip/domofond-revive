import json
import os

with open(r'c:\Users\Keystone-Tech\Desktop\Домофондар\scratch\audit_data.json', encoding='utf-8') as f:
    d = json.load(f)

# Группируем по категориям
cat_stats = {
    "weekend": {"count": 0, "minutes": 0, "label": "Выходные дни (Суббота / Воскресенье)"},
    "night": {"count": 0, "minutes": 0, "label": "Глубокая ночь (00:00–06:00)"},
    "morning": {"count": 0, "minutes": 0, "label": "Раннее утро (06:00–09:00)"},
    "evening": {"count": 0, "minutes": 0, "label": "Поздний вечер (17:00–00:00)"},
    "work_hours": {"count": 0, "minutes": 0, "label": "Рабочие часы (Будни 09:00–17:00)"},
}

# Дни для календаря
days_map = {}

for c in d['commits']:
    cat = c['category']
    mins = c['sessionMins']
    cat_stats[cat]['count'] += 1
    cat_stats[cat]['minutes'] += mins

    date = c['date']
    if date not in days_map:
        days_map[date] = {
            "date": date,
            "dayOfWeek": c['dayOfWeek'],
            "dayShort": c['dayShort'],
            "isWeekend": c['isWeekend'],
            "totalCommits": 0,
            "offCommits": 0,
            "workCommits": 0,
            "offMinutes": 0,
            "workMinutes": 0,
            "commits": []
        }
    days_map[date]["totalCommits"] += 1
    days_map[date]["commits"].append({
        "hash": c['hash'],
        "time": c['time'],
        "datetime": c['datetime'],
        "category": c['category'],
        "catLabel": c['catLabel'],
        "isWorkTime": c['isWorkTime'],
        "sessionMins": c['sessionMins'],
        "subject": c['subject']
    })
    if c['isWorkTime']:
        days_map[date]["workCommits"] += 1
        days_map[date]["workMinutes"] += mins
    else:
        days_map[date]["offCommits"] += 1
        days_map[date]["offMinutes"] += mins

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
        "totalCommits": dm["totalCommits"],
        "offCommits": dm["offCommits"],
        "workCommits": dm["workCommits"],
        "offHours": round(dm["offMinutes"] / 60, 1),
        "workHours": round(dm["workMinutes"] / 60, 1),
        "hasWorkCommits": dm["workCommits"] > 0,
        "commits": dm["commits"]
    })

ts_content = f'''/**
 * ==============================================================================
 * ЮРИДИЧЕСКИЙ АУДИТ РАБОЧЕГО И ВНЕРАБОЧЕГО ВРЕМЕНИ РАЗРАБОТКИ
 * ==============================================================================
 * Платформа: «Домофондар»
 * Автор и разработчик: Можнов Владимир Сергеевич
 * Дата и время старта: 14 октября 2025 г. 02:26 (МСК, первый коммит {d['firstHash']})
 * 
 * КРИТЕРИИ АУДИТА:
 * 1. Рабочее время: Понедельник — Пятница с 09:00 до 17:00 (МСК).
 * 2. Внерабочее (личное) время разработчика:
 *    - Все субботы и воскресенья (полные сутки).
 *    - Будни: Глубокая ночь (00:00–06:00), Раннее утро (06:00–09:00), Поздний вечер (17:00–00:00).
 * ==============================================================================
 */

export type TimeCategory = 
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

export const GIT_AUDIT_SUMMARY = {{
  totalCommits: {d['totalCommits']},
  firstCommitDate: "{d['firstCommit']}",
  firstCommitHash: "{d['firstHash']}",
  lastCommitDate: "{d['lastCommit']}",
  lastCommitHash: "{d['lastHash']}",
  
  totalHours: {d['totalHours']},
  offHours: {d['offHours']},
  workHours: {d['workHours']},
  offPct: {d['offPct']},
  workPct: {d['workPct']},
  
  offCommits: {d['offCommits']},
  workCommits: {d['workCommits']},
  offCommitsPct: {round(d['offCommits']/d['totalCommits']*100, 1)},
  workCommitsPct: {round(d['workCommits']/d['totalCommits']*100, 1)},
  
  byCategory: {json.dumps(by_cat_export, ensure_ascii=False, indent=2)} as Record<TimeCategory, {{ count: number; hours: number; label: string }}>
}};

export const CALENDAR_DAYS: DayAudit[] = {json.dumps(calendar_export, ensure_ascii=False, indent=2)};

export const ALL_AUDIT_COMMITS: CommitAuditItem[] = {json.dumps(d['commits'], ensure_ascii=False, indent=2)};
'''

target_path = r'c:\Users\Keystone-Tech\Desktop\Домофондар\src\data\gitCommitAudit.ts'
with open(target_path, 'w', encoding='utf-8') as f:
    f.write(ts_content)

print(f"Файл успешно создан: {target_path}")
print(f"Размер: {os.path.getsize(target_path)} байт")
