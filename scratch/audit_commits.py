import subprocess
import json
from datetime import datetime, timedelta, timezone

MSK = timezone(timedelta(hours=3))

def analyze_git():
    out = subprocess.check_output(
        ['git', 'log', '--reverse', '--format=%h|%aI|%s'],
        cwd=r'c:\Users\Keystone-Tech\Desktop\Домофондар'
    ).decode('utf-8')

    commits = []
    for line in out.strip().splitlines():
        if not line:
            continue
        parts = line.split('|', 2)
        if len(parts) < 3:
            continue
        h, dt_iso, subj = parts
        dt = datetime.fromisoformat(dt_iso).astimezone(MSK)
        commits.append({
            'hash': h,
            'dt': dt,
            'subject': subj
        })

    # Оценка времени сессий:
    # Если коммит сделан в пределах 120 минут от предыдущего того же дня, время = разница.
    # Если первый коммит сессии или пауза > 120 минут, оцениваем время работы в 60 минут.
    off_hours_minutes = 0
    work_hours_minutes = 0
    
    off_commits_count = 0
    work_commits_count = 0

    processed = []
    prev_dt = None

    day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
    full_day_names = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]

    for i, c in enumerate(commits):
        dt = c['dt']
        weekday = dt.weekday() # 0 = Пн, 6 = Вс
        is_weekend = weekday in (5, 6)
        minute_of_day = dt.hour * 60 + dt.minute

        # Рабочие часы: Будни с 09:00 (540 мин) до 17:00 (1020 мин)
        is_work_time = (not is_weekend) and (540 <= minute_of_day < 1020)

        # Вычисляем сессионное время (минуты)
        if prev_dt and (dt - prev_dt).total_seconds() <= 120 * 60 and dt.date() == prev_dt.date():
            session_mins = int((dt - prev_dt).total_seconds() / 60)
            if session_mins < 15:
                session_mins = 15 # минимум 15 минут
        else:
            session_mins = 60 # базовые 60 минут на задачу/коммит

        if is_work_time:
            work_hours_minutes += session_mins
            work_commits_count += 1
            category = "work_hours"
            cat_label = "Рабочие часы (Будни 09:00–17:00)"
        else:
            off_hours_minutes += session_mins
            off_commits_count += 1
            if is_weekend:
                category = "weekend"
                cat_label = "Выходной день (Сб/Вс)"
            elif dt.hour < 6:
                category = "night"
                cat_label = "Ночь (00:00–06:00)"
            elif dt.hour < 9:
                category = "morning"
                cat_label = "Раннее утро (06:00–09:00)"
            else:
                category = "evening"
                cat_label = "Поздний вечер (17:00–00:00)"

        prev_dt = dt

        processed.append({
            'hash': c['hash'],
            'datetime': dt.strftime('%Y-%m-%d %H:%M'),
            'date': dt.strftime('%Y-%m-%d'),
            'time': dt.strftime('%H:%M'),
            'dayOfWeek': full_day_names[weekday],
            'dayShort': day_names[weekday],
            'isWeekend': is_weekend,
            'isWorkTime': is_work_time,
            'category': category,
            'catLabel': cat_label,
            'sessionMins': session_mins,
            'subject': c['subject']
        })

    total_mins = off_hours_minutes + work_hours_minutes
    total_hours = round(total_mins / 60, 1)
    off_hours = round(off_hours_minutes / 60, 1)
    work_hours = round(work_hours_minutes / 60, 1)

    off_pct = round(off_hours / total_hours * 100, 1)
    work_pct = round(work_hours / total_hours * 100, 1)

    print(f"Всего коммитов: {len(commits)}")
    print(f"Первый коммит (МСК): {commits[0]['dt'].strftime('%Y-%m-%d %H:%M')} ({commits[0]['hash']})")
    print(f"Последний коммит (МСК): {commits[-1]['dt'].strftime('%Y-%m-%d %H:%M')} ({commits[-1]['hash']})")
    print("---")
    print(f"ВНЕРАБОЧЕЕ ВРЕМЯ (ночи, вечера, сб/вс): {off_hours} ч ({off_pct}%) | {off_commits_count} коммитов ({round(off_commits_count/len(commits)*100, 1)}%)")
    print(f"РАБОЧЕЕ ОКНО (пн-пт 09:00–17:00): {work_hours} ч ({work_pct}%) | {work_commits_count} коммитов ({round(work_commits_count/len(commits)*100, 1)}%)")
    print(f"ИТОГО учтенного времени: {total_hours} часов")

    return {
        'totalCommits': len(commits),
        'firstCommit': commits[0]['dt'].strftime('%Y-%m-%d %H:%M'),
        'firstHash': commits[0]['hash'],
        'lastCommit': commits[-1]['dt'].strftime('%Y-%m-%d %H:%M'),
        'lastHash': commits[-1]['hash'],
        'totalHours': total_hours,
        'offHours': off_hours,
        'workHours': work_hours,
        'offPct': off_pct,
        'workPct': work_pct,
        'offCommits': off_commits_count,
        'workCommits': work_commits_count,
        'commits': processed
    }

if __name__ == '__main__':
    data = analyze_git()
    # Сохраняем в JSON для генерации TS файла
    with open(r'c:\Users\Keystone-Tech\Desktop\Домофондар\scratch\audit_data.json', 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
