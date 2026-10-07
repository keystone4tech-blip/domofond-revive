import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  SUPERADMIN_EMAIL, OWNER,
  JUNIOR_HOURLY_RATE, MARKET_HOURLY_RATE, HOURLY_RATE_OFFICE, MEDIAN_FULLSTACK_SALARY,
  STAGE_PRICE_LIST, TOTAL_MY_MIN_PRICE, TOTAL_STUDIO_PRICE, TOTAL_PRICE_SAVINGS,
  EXPENSES_CLAUDE_MONTHLY, EXPENSES_GEMINI_MONTHLY, EXPENSES_VPN_SERVER_MONTHLY,
  EXPENSES_TOTAL_PERIOD, TOTAL_MONTHS_DEV,
} from "@/data/projectChangelog";
import { GIT_AUDIT_SUMMARY } from "@/data/gitCommitAudit";

// Форматирование рублей
const rub = (n: number) => Math.round(n).toLocaleString("ru-RU") + " ₽";

// Короткие подписи категорий времени
const CAT_LABELS: Record<string, string> = {
  weekend: "Выходные дни",
  work_hours: "Рабочие часы",
  evening: "Вечер (16:00–00:00)",
  night: "Глубокая ночь",
  holiday: "Гос. праздники РФ",
  transit_free: "В пути / обед",
  morning: "Раннее утро",
};

const Project: React.FC = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // Доступ строго для суперпользователя-разработчика
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const email = (user?.email || "").toLowerCase().trim();
        let isSuperadmin = email === SUPERADMIN_EMAIL;
        if (!isSuperadmin && user) {
          try {
            const { data } = await supabase
              .from("user_roles").select("role")
              .eq("user_id", user.id).eq("role", "superadmin").limit(1);
            isSuperadmin = !!(data && data.length > 0);
          } catch { isSuperadmin = false; }
        }
        if (cancelled) return;
        if (!isSuperadmin) { navigate("/", { replace: true }); return; }
        setAllowed(true);
      } catch (e) {
        if (!cancelled) navigate("/", { replace: true });
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const S = GIT_AUDIT_SUMMARY;

  // Производные величины (авто-расчёт из констант)
  const data = useMemo(() => {
    const hours = S.fullDevHoursTotal;              // 877 ч
    const studioMax = Math.max(...STAGE_PRICE_LIST.map((s) => s.studioPrice));
    const cats = Object.entries(S.byCategory)
      .map(([key, v]: any) => ({ key, label: CAT_LABELS[key] || v.label, hours: v.hours, count: v.count }))
      .sort((a, b) => b.hours - a.hours);
    const catMax = Math.max(...cats.map((c) => c.hours));
    const valuations = [
      { label: `Junior, ${JUNIOR_HOURLY_RATE} ₽/ч`, value: hours * JUNIOR_HOURLY_RATE, kind: "mine" },
      { label: `Медиана рынка, ${HOURLY_RATE_OFFICE} ₽/ч`, value: hours * HOURLY_RATE_OFFICE, kind: "mine" },
      { label: `Senior / студия, ${MARKET_HOURLY_RATE} ₽/ч`, value: hours * MARKET_HOURLY_RATE, kind: "mine" },
      { label: "Студия под ключ", value: TOTAL_STUDIO_PRICE, kind: "studio" },
    ];
    const valMax = Math.max(...valuations.map((v) => v.value));
    // Кольцо: доля личного времени
    const C = 2 * Math.PI * 66;
    const personalArc = (C * S.fullDevOffPct) / 100;
    return { hours, studioMax, cats, catMax, valuations, valMax, C, personalArc };
  }, [S]);

  if (checking) {
    return (
      <div className="dd-boot">
        <style>{`.dd-boot{min-height:100vh;display:grid;place-items:center;background:#f5f7fa}
          @media (prefers-color-scheme:dark){.dd-boot{background:#0e1217}} html.dark .dd-boot{background:#0e1217}
          .dd-boot i{width:30px;height:30px;border:3px solid #cbd5e1;border-top-color:#0276c4;border-radius:50%;display:block;animation:ddspin .8s linear infinite}
          @keyframes ddspin{to{transform:rotate(360deg)}}`}</style>
        <i />
      </div>
    );
  }
  if (!allowed) return null;

  const css = `
  .ddr {
    --bg:#f5f7fa; --surface:#fff; --surface-2:#eef2f7; --border:#e1e7ef;
    --ink:#0f1b2d; --ink-2:#47566b; --muted:#8696aa;
    --brand:#0276c4; --brand-strong:#015a97; --accent:#d97706; --good:#0f8a5f; --good-soft:#e6f6ef;
    --mine:#0276c4; --studio:#d97706;
    --shadow:0 1px 2px rgba(15,27,45,.06),0 8px 24px rgba(15,27,45,.05);
    --display:"Manrope",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    --body:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
    min-height:100vh; background:var(--bg); color:var(--ink); font-family:var(--body); font-size:15px; line-height:1.55;
  }
  @media (prefers-color-scheme:dark){ .ddr:not(.dd-force-light){
    --bg:#0e1217;--surface:#161c24;--surface-2:#1c242e;--border:#2a3542;--ink:#e8eef5;--ink-2:#a6b6c7;--muted:#6a7a8c;
    --brand:#38bdf8;--brand-strong:#7cc9f5;--accent:#f0a033;--good:#34d399;--good-soft:#10241c;--mine:#1e90d8;--studio:#cf7a12;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35); color-scheme:dark; } }
  html.dark .ddr{
    --bg:#0e1217;--surface:#161c24;--surface-2:#1c242e;--border:#2a3542;--ink:#e8eef5;--ink-2:#a6b6c7;--muted:#6a7a8c;
    --brand:#38bdf8;--brand-strong:#7cc9f5;--accent:#f0a033;--good:#34d399;--good-soft:#10241c;--mine:#1e90d8;--studio:#cf7a12;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px rgba(0,0,0,.35); color-scheme:dark; }
  .ddr * { box-sizing:border-box; }
  .ddr .wrap { max-width:920px; margin:0 auto; padding:28px 20px 72px; }
  .ddr h1,.ddr h2,.ddr h3 { font-family:var(--display); margin:0; letter-spacing:-0.01em; text-wrap:balance; }
  .ddr h1 { font-size:clamp(25px,4.6vw,38px); font-weight:800; line-height:1.1; }
  .ddr h2 { font-size:clamp(19px,3vw,24px); font-weight:700; }
  .ddr p { margin:0; color:var(--ink-2); }
  .ddr .num { font-variant-numeric:tabular-nums; }
  .ddr .eyebrow { font-family:var(--display); text-transform:uppercase; letter-spacing:.12em; font-size:11.5px; font-weight:700; color:var(--brand); }
  .ddr section { margin-top:42px; }
  .ddr .sechead { display:flex; align-items:baseline; gap:12px; margin-bottom:16px; }
  .ddr .sechead .n { font-family:var(--display); font-weight:800; color:var(--muted); font-size:14px; font-variant-numeric:tabular-nums; }
  .ddr .card { background:var(--surface); border:1px solid var(--border); border-radius:16px; box-shadow:var(--shadow); }
  .ddr .pad { padding:clamp(16px,3vw,26px); }
  .ddr .topbar { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:24px; flex-wrap:wrap; }
  .ddr .brandline { display:flex; align-items:center; gap:10px; min-width:0; }
  .ddr .logo { width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--brand),var(--brand-strong));display:grid;place-items:center;color:#fff;font-family:var(--display);font-weight:800;flex:none; }
  .ddr .brandline .nm { font-family:var(--display); font-weight:700; font-size:14px; }
  .ddr .brandline .nm small { display:block; color:var(--muted); font-weight:600; font-size:11.5px; }
  .ddr .btns { display:flex; gap:8px; flex-wrap:wrap; }
  .ddr .btn { font-family:var(--display); font-weight:600; font-size:12.5px; border-radius:999px; padding:8px 14px; cursor:pointer; border:1px solid var(--border); background:var(--surface); color:var(--ink-2); }
  .ddr .btn:hover { border-color:var(--brand); color:var(--brand); }
  .ddr .btn.primary { background:linear-gradient(135deg,var(--brand),var(--brand-strong)); color:#fff; border-color:transparent; }
  .ddr .valueband { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:22px; }
  .ddr .vb { border-radius:14px; padding:18px 20px; border:1px solid var(--border); }
  .ddr .vb.market { background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 12%,var(--surface)),var(--surface)); }
  .ddr .vb.ask { background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 14%,var(--surface)),var(--surface)); }
  .ddr .vb .lbl { font-size:12.5px; font-weight:700; color:var(--ink-2); font-family:var(--display); }
  .ddr .vb .big { font-family:var(--display); font-weight:800; font-size:clamp(22px,4.4vw,34px); margin-top:4px; letter-spacing:-0.02em; }
  .ddr .vb.market .big { color:var(--accent); } .ddr .vb.ask .big { color:var(--brand); }
  .ddr .vb .sub { font-size:12px; color:var(--muted); margin-top:3px; }
  .ddr .stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
  .ddr .stat { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:16px; box-shadow:var(--shadow); }
  .ddr .stat .v { font-family:var(--display); font-weight:800; font-size:clamp(20px,3.4vw,27px); font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
  .ddr .stat .k { font-size:12.5px; color:var(--ink-2); margin-top:2px; }
  .ddr .note { font-size:12px; color:var(--muted); line-height:1.5; }
  .ddr .modlist { columns:2; column-gap:24px; margin:0; padding:0; list-style:none; }
  .ddr .modlist li { break-inside:avoid; padding:7px 0 7px 22px; position:relative; font-size:13.5px; color:var(--ink-2); border-bottom:1px solid var(--border); }
  .ddr .modlist li:before { content:""; position:absolute; left:4px; top:13px; width:7px; height:7px; border-radius:2px; background:var(--brand); }
  .ddr .modlist li b { color:var(--ink); font-weight:600; }
  .ddr .donutrow { display:flex; gap:24px; align-items:center; flex-wrap:wrap; }
  .ddr .legend { display:flex; flex-direction:column; gap:10px; min-width:200px; flex:1; }
  .ddr .lg { display:flex; align-items:center; gap:10px; font-size:13.5px; color:var(--ink-2); }
  .ddr .lg .sw { width:12px; height:12px; border-radius:3px; flex:none; }
  .ddr .lg .val { margin-left:auto; font-family:var(--display); font-weight:700; font-variant-numeric:tabular-nums; color:var(--ink); }
  .ddr .stage { padding:13px 0; border-bottom:1px solid var(--border); }
  .ddr .stage:last-child { border-bottom:0; }
  .ddr .st-top { display:flex; justify-content:space-between; gap:12px; align-items:baseline; }
  .ddr .st-title { font-size:13.5px; font-weight:600; color:var(--ink); min-width:0; }
  .ddr .st-save { font-size:11.5px; color:var(--good); font-weight:700; font-family:var(--display); white-space:nowrap; }
  .ddr .bars { margin-top:9px; display:flex; flex-direction:column; gap:6px; }
  .ddr .barrow { display:flex; align-items:center; gap:10px; }
  .ddr .barrow .tag { width:56px; font-size:10.5px; color:var(--muted); font-weight:600; flex:none; text-transform:uppercase; letter-spacing:.04em; }
  .ddr .track { flex:1; height:16px; background:var(--surface-2); border-radius:6px; overflow:hidden; min-width:0; }
  .ddr .fill { display:block; height:100%; border-radius:6px; }
  .ddr .fill.mine { background:var(--mine); } .ddr .fill.studio { background:var(--studio); }
  .ddr .barrow .amt { width:92px; text-align:right; font-family:var(--display); font-weight:700; font-size:12.5px; font-variant-numeric:tabular-nums; flex:none; }
  .ddr .amt.mine { color:var(--brand); } .ddr .amt.studio { color:var(--accent); }
  .ddr .totalrow { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-top:16px; padding-top:16px; border-top:2px solid var(--border); flex-wrap:wrap; }
  .ddr .totalrow .tt { font-family:var(--display); font-weight:800; font-size:15px; }
  .ddr .tvals { display:flex; gap:18px; flex-wrap:wrap; }
  .ddr .tval { font-family:var(--display); font-weight:800; font-variant-numeric:tabular-nums; }
  .ddr .tval small { display:block; font-weight:600; font-size:10.5px; color:var(--muted); }
  .ddr .vrow { display:flex; align-items:center; gap:12px; padding:9px 0; }
  .ddr .vrow .vlbl { width:176px; font-size:13px; color:var(--ink-2); flex:none; }
  .ddr .vtrack { flex:1; height:22px; background:var(--surface-2); border-radius:7px; overflow:hidden; min-width:0; }
  .ddr .vfill { height:100%; border-radius:7px; display:flex; align-items:center; justify-content:flex-end; padding-right:8px; color:#fff; font-family:var(--display); font-weight:700; font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .ddr .catrow { display:flex; align-items:center; gap:10px; padding:5px 0; }
  .ddr .catrow .cl { width:150px; font-size:12px; color:var(--ink-2); flex:none; }
  .ddr .catrow .ct { flex:1; height:14px; background:var(--surface-2); border-radius:5px; overflow:hidden; min-width:0; }
  .ddr .catrow .cf { display:block; height:100%; background:var(--brand); border-radius:5px; }
  .ddr .catrow .cv { width:52px; text-align:right; font-family:var(--display); font-weight:700; font-size:12px; font-variant-numeric:tabular-nums; flex:none; color:var(--ink-2); }
  .ddr table.exp { width:100%; border-collapse:collapse; font-size:13.5px; }
  .ddr table.exp td { padding:9px 0; border-bottom:1px solid var(--border); color:var(--ink-2); }
  .ddr table.exp td:last-child { text-align:right; font-family:var(--display); font-weight:700; color:var(--ink); font-variant-numeric:tabular-nums; }
  .ddr table.exp tr.sum td { border-bottom:0; border-top:2px solid var(--border); color:var(--ink); font-weight:700; padding-top:12px; }
  .ddr .pts { list-style:none; margin:0; padding:0; display:grid; gap:11px; }
  .ddr .pts li { display:flex; gap:11px; font-size:13.5px; color:var(--ink-2); }
  .ddr .pts li .ic { width:22px; height:22px; border-radius:7px; background:var(--good-soft); color:var(--good); display:grid; place-items:center; flex:none; font-weight:800; font-size:13px; }
  .ddr .pts li b { color:var(--ink); font-weight:600; }
  .ddr .askf { background:linear-gradient(135deg,color-mix(in srgb,var(--brand) 10%,var(--surface)),var(--surface)); border:1px solid color-mix(in srgb,var(--brand) 30%,var(--border)); }
  .ddr .askf .big { font-family:var(--display); font-weight:800; font-size:clamp(26px,5vw,38px); color:var(--brand); letter-spacing:-0.02em; }
  .ddr .divider { height:1px; background:var(--border); margin:14px 0; }
  .ddr .srcs { font-size:12px; color:var(--ink-2); display:grid; gap:7px; }
  .ddr .srcs a { color:var(--brand); text-decoration:none; }
  @media (max-width:680px){
    .ddr .valueband,.ddr .grid2 { grid-template-columns:1fr; }
    .ddr .stats { grid-template-columns:1fr 1fr; }
    .ddr .modlist { columns:1; }
    .ddr .barrow .tag { width:44px; } .ddr .barrow .amt { width:76px; }
    .ddr .vrow .vlbl { width:120px; font-size:12px; } .ddr .catrow .cl { width:112px; }
  }
  @media print {
    .ddr .no-print { display:none !important; }
    .ddr { background:#fff !important; color:#000 !important; }
    .ddr .card { box-shadow:none !important; }
  }
  `;

  return (
    <div className="ddr">
      <style>{css}</style>
      <div className="wrap">

        <div className="topbar no-print">
          <div className="brandline">
            <div className="logo">Д</div>
            <div className="nm">ДомофонДар<small>Паспорт разработки · {OWNER}</small></div>
          </div>
          <div className="btns">
            <button className="btn" type="button" onClick={() => window.print()}>Печать в PDF</button>
            <button className="btn primary" type="button" onClick={() => navigate("/cabinet")}>В кабинет</button>
          </div>
        </div>

        <header>
          <div className="eyebrow">Технический паспорт и оценка стоимости</div>
          <h1 style={{ marginTop: 8 }}>Платформа «ДомофонДар»: что сделано и сколько это стоит</h1>
          <p style={{ marginTop: 14, maxWidth: "62ch", fontSize: "clamp(15px,2.2vw,17px)" }}>
            Единая цифровая платформа для домофонной компании: сайт, личные кабинеты жильцов, приём платежей,
            диспетчеризация выездной службы, электронные голосования и мобильный кабинет мастера. Ниже — объём
            выполненной работы, прямые затраты разработчика и обоснование стоимости в сравнении с рынком РФ.
          </p>
          <div className="valueband">
            <div className="vb market">
              <div className="lbl">Стоимость под ключ у IT-студии</div>
              <div className="big num">{rub(TOTAL_STUDIO_PRICE)}</div>
              <div className="sub">Рыночная оценка 12 этапов (среднерыночный сегмент)</div>
            </div>
            <div className="vb ask">
              <div className="lbl">Предлагаемая цена платформы</div>
              <div className="big num">{rub(TOTAL_MY_MIN_PRICE)}</div>
              <div className="sub">Ниже рынка в {(TOTAL_STUDIO_PRICE / TOTAL_MY_MIN_PRICE).toFixed(1)} раза — минимальная себестоимость</div>
            </div>
          </div>
        </header>

        <section>
          <div className="sechead"><span className="n">01</span><h2>Объём выполненной работы</h2></div>
          <div className="stats">
            <div className="stat"><div className="v num">{S.totalCommits}</div><div className="k">коммитов в Git за год</div></div>
            <div className="stat"><div className="v num">{data.hours} ч</div><div className="k">инженерной работы (разработка, БД, тесты)</div></div>
            <div className="stat"><div className="v num">96 477</div><div className="k">строк чистого кода</div></div>
            <div className="stat"><div className="v num">{TOTAL_MONTHS_DEV} мес</div><div className="k">непрерывной разработки</div></div>
            <div className="stat"><div className="v num">50+</div><div className="k">таблиц базы данных PostgreSQL</div></div>
            <div className="stat"><div className="v num">{STAGE_PRICE_LIST.length}</div><div className="k">функциональных модулей</div></div>
          </div>
          <p className="note" style={{ marginTop: 12 }}>
            Период: первый коммит <b className="num">{S.firstCommitDate}</b> ({S.firstCommitHash}), последний на дату отчёта{" "}
            <b className="num">{S.lastCommitDate}</b> ({S.lastCommitHash}). Данные выгружены из истории Git репозитория.
          </p>
        </section>

        <section>
          <div className="sechead"><span className="n">02</span><h2>Что входит в платформу</h2></div>
          <div className="card pad">
            <p style={{ marginBottom: 14, fontSize: 13.5 }}>Одна система закрывает задачи, под которые обычно покупают несколько отдельных сервисов:</p>
            <ul className="modlist">
              {STAGE_PRICE_LIST.map((s) => (
                <li key={s.id}><b>{s.title.replace(/^\d+\.\s*/, "")}</b></li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">03</span><h2>Когда велась работа</h2></div>
          <div className="card pad">
            <div className="donutrow">
              <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label={`${S.fullDevOffPct}% работы в личное время`}>
                <circle cx="90" cy="90" r="66" fill="none" stroke="var(--surface-2)" strokeWidth="26" />
                <circle cx="90" cy="90" r="66" fill="none" stroke="var(--mine)" strokeWidth="26"
                  strokeDasharray={`${data.personalArc} ${data.C - data.personalArc}`}
                  transform="rotate(-90 90 90)" />
                <text x="90" y="84" textAnchor="middle" fontFamily="Manrope,sans-serif" fontWeight="800" fontSize="30" fill="var(--ink)" style={{ fontVariantNumeric: "tabular-nums" }}>{S.fullDevOffPct}%</text>
                <text x="90" y="104" textAnchor="middle" fontFamily="Manrope,sans-serif" fontWeight="600" fontSize="12" fill="var(--ink-2)">личное время</text>
              </svg>
              <div className="legend">
                <div className="lg"><span className="sw" style={{ background: "var(--mine)" }} /> Личное время (ночи, вечера, выходные, праздники, дорога) <span className="val num">{S.fullDevOffHours} ч</span></div>
                <div className="lg"><span className="sw" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }} /> Рабочие часы офиса <span className="val num">{S.fullDevWorkHours} ч</span></div>
                <p className="note" style={{ marginTop: 4 }}>Почти вся платформа ({S.fullDevOffPct}% времени) разработана вне оплачиваемых рабочих часов — в личное время разработчика.</p>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">04</span><h2>Распределение активности по времени</h2></div>
          <div className="card pad">
            {data.cats.map((c) => (
              <div className="catrow" key={c.key}>
                <span className="cl">{c.label}</span>
                <span className="ct"><span className="cf" style={{ width: `${(c.hours / data.catMax) * 100}%` }} /></span>
                <span className="cv num">{c.hours.toLocaleString("ru-RU")} ч</span>
              </div>
            ))}
            <p className="note" style={{ marginTop: 12 }}>
              Хронометраж фиксаций и деплоев ({S.deployHoursTotal} ч). Учёт по производственному календарю РФ:
              праздники, выходные, ночи и вечера отнесены к личному времени.
            </p>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">05</span><h2>Сколько это стоит на рынке</h2></div>
          <div className="card pad">
            <div className="donutrow" style={{ marginBottom: 6, gap: 16 }}>
              <div className="lg"><span className="sw" style={{ background: "var(--mine)" }} /> Минимальная себестоимость (моя цена)</div>
              <div className="lg"><span className="sw" style={{ background: "var(--studio)" }} /> Цена IT-студии под ключ</div>
            </div>
            <div className="divider" />
            {STAGE_PRICE_LIST.map((s, i) => (
              <div className="stage" key={s.id}>
                <div className="st-top">
                  <span className="st-title">{i + 1}. {s.title.replace(/^\d+\.\s*/, "")}</span>
                  <span className="st-save">экономия {rub(s.savings)}</span>
                </div>
                <div className="bars">
                  <div className="barrow">
                    <span className="tag">моя</span>
                    <span className="track"><span className="fill mine" style={{ width: `${(s.myMinPrice / data.studioMax) * 100}%` }} /></span>
                    <span className="amt mine num">{s.myMinPrice.toLocaleString("ru-RU")}</span>
                  </div>
                  <div className="barrow">
                    <span className="tag">студия</span>
                    <span className="track"><span className="fill studio" style={{ width: `${(s.studioPrice / data.studioMax) * 100}%` }} /></span>
                    <span className="amt studio num">{s.studioPrice.toLocaleString("ru-RU")}</span>
                  </div>
                </div>
              </div>
            ))}
            <div className="totalrow">
              <span className="tt">Итого за {STAGE_PRICE_LIST.length} этапов</span>
              <div className="tvals">
                <span className="tval" style={{ color: "var(--brand)" }}>{rub(TOTAL_MY_MIN_PRICE)}<small>моя цена</small></span>
                <span className="tval" style={{ color: "var(--accent)" }}>{rub(TOTAL_STUDIO_PRICE)}<small>цена студии</small></span>
                <span className="tval" style={{ color: "var(--good)" }}>{rub(TOTAL_PRICE_SAVINGS)}<small>экономия компании</small></span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">06</span><h2>Оценка по трудозатратам</h2></div>
          <div className="card pad">
            <p style={{ fontSize: 13.5, marginBottom: 14 }}>
              {data.hours} часов инженерной работы, оценённые по разным рыночным ставкам РФ. По медианной ставке
              рынка стоимость труда превышает предлагаемую цену платформы.
            </p>
            {data.valuations.map((v, i) => (
              <div className="vrow" key={i}>
                <span className="vlbl">{v.label}</span>
                <span className="vtrack">
                  <span className="vfill num" style={{ width: `${(v.value / data.valMax) * 100}%`, background: v.kind === "studio" ? "var(--studio)" : "var(--mine)" }}>{rub(v.value)}</span>
                </span>
              </div>
            ))}
            <div className="divider" />
            <div className="vrow">
              <span className="vlbl" style={{ color: "var(--brand)", fontWeight: 700 }}>Предлагаемая цена</span>
              <span className="vtrack">
                <span className="vfill num" style={{ width: `${(TOTAL_MY_MIN_PRICE / data.valMax) * 100}%`, background: "linear-gradient(90deg,var(--brand),var(--brand-strong))" }}>{rub(TOTAL_MY_MIN_PRICE)}</span>
              </span>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              Ставки: медиана фуллстек-разработчика РФ {MEDIAN_FULLSTACK_SALARY.toLocaleString("ru-RU")} ₽/мес (≈{HOURLY_RATE_OFFICE} ₽/ч),
              рыночная ставка студии {MARKET_HOURLY_RATE} ₽/ч.
            </p>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">07</span><h2>Прямые расходы разработчика</h2></div>
          <div className="card pad">
            <p style={{ fontSize: 13.5, marginBottom: 12 }}>Оплачено из личных средств за весь период разработки ({TOTAL_MONTHS_DEV} месяцев):</p>
            <table className="exp">
              <tbody>
                <tr><td>Подписка Claude AI (разработка)</td><td className="num">{EXPENSES_CLAUDE_MONTHLY.toLocaleString("ru-RU")} ₽/мес</td></tr>
                <tr><td>Подписка Gemini AI (разработка)</td><td className="num">{EXPENSES_GEMINI_MONTHLY.toLocaleString("ru-RU")} ₽/мес</td></tr>
                <tr><td>Аренда выделенного сервера (инфраструктура)</td><td className="num">{EXPENSES_VPN_SERVER_MONTHLY.toLocaleString("ru-RU")} ₽/мес</td></tr>
                <tr className="sum"><td>Итого за {TOTAL_MONTHS_DEV} месяцев</td><td className="num">≈ {rub(EXPENSES_TOTAL_PERIOD)}</td></tr>
              </tbody>
            </table>
            <p className="note" style={{ marginTop: 10 }}>Это прямые денежные затраты, не включающие стоимость труда. Понесены разработчиком лично.</p>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">08</span><h2>Что платформа автоматизирует</h2></div>
          <div className="card pad">
            <ul className="pts">
              <li><span className="ic">✓</span><span><b>Приём платежей онлайн</b> с автоматическим погашением долга и электронными чеками 54-ФЗ — без ручного разнесения оплат и бумажных квитанций.</span></li>
              <li><span className="ic">✓</span><span><b>Автоплатёж абонентской платы</b> — ежемесячное списание по сохранённой карте, снижает просрочки и ручной обзвон должников.</span></li>
              <li><span className="ic">✓</span><span><b>CRM и FSM диспетчеризация</b> — заявки, наряды и выезды мастеров в одной системе вместо таблиц и мессенджеров.</span></li>
              <li><span className="ic">✓</span><span><b>Личные кабинеты жильцов</b> — снижают нагрузку на диспетчеров: баланс, история и заявки доступны абоненту самостоятельно.</span></li>
              <li><span className="ic">✓</span><span><b>Электронные голосования ОСС</b> — расчёт кворума и протоколы по 217-ФЗ без сторонних платных сервисов.</span></li>
              <li><span className="ic">✓</span><span><b>Собственная платформа</b> вместо набора внешних SaaS-подписок — без ежемесячной абонентской платы за них.</span></li>
            </ul>
            <p className="note" style={{ marginTop: 12 }}>Экономический эффект автоматизации зависит от объёма абонентской базы и оценивается отдельно по фактическим данным компании.</p>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">09</span><h2>Предложение</h2></div>
          <div className="card pad askf">
            <div className="lbl" style={{ fontFamily: "var(--display)", fontWeight: 700, color: "var(--ink-2)", fontSize: 13 }}>Предлагаемая стоимость платформы</div>
            <div className="big num" style={{ marginTop: 4 }}>{rub(TOTAL_MY_MIN_PRICE)}</div>
            <p style={{ marginTop: 10, fontSize: 14, maxWidth: "60ch" }}>
              Это минимальная себестоимость {STAGE_PRICE_LIST.length} этапов — в {(TOTAL_STUDIO_PRICE / TOTAL_MY_MIN_PRICE).toFixed(1)} раза ниже оценки IT-студии
              ({rub(TOTAL_STUDIO_PRICE)}) и ниже стоимости труда по медианной ставке рынка. Цена отражает уже
              работающий, развёрнутый и поддерживаемый продукт, а не разработку с нуля.
            </p>
            <div className="divider" />
            <p style={{ fontSize: 13.5 }}><b style={{ color: "var(--ink)" }}>В стоимость входит:</b> передача исходного кода и прав на использование, документация архитектуры, развёртывание и запуск. Сопровождение и доработки — по отдельному соглашению.</p>
          </div>
        </section>

        <section>
          <div className="sechead"><span className="n">10</span><h2>Методика и источники</h2></div>
          <div className="card pad">
            <p style={{ fontSize: 13.5, marginBottom: 12 }}>
              Фактические данные (твёрдые): число коммитов, даты, объём кода — выгружены напрямую из истории Git.
              Оценка часов рассчитана по времени между коммитами с учётом производственного календаря РФ.
              Рыночные цены этапов взяты из открытых отраслевых источников:
            </p>
            <div className="srcs">
              <div>• Рейтинг Рунета — <a href="https://ratingruneta.ru/" target="_blank" rel="noopener noreferrer">ratingruneta.ru</a></div>
              <div>• Хабр Фриланс — <a href="https://freelance.habr.com/" target="_blank" rel="noopener noreferrer">freelance.habr.com</a></div>
              <div>• Kwork — <a href="https://kwork.ru/" target="_blank" rel="noopener noreferrer">kwork.ru</a></div>
              <div>• ЮKassa API — <a href="https://yookassa.ru/developers/api" target="_blank" rel="noopener noreferrer">yookassa.ru/developers</a></div>
              <div>• Медиана зарплат — Хабр Карьера (фуллстек-разработчик РФ, 2026)</div>
            </div>
            <p className="note" style={{ marginTop: 14 }}>
              Оценка часов и ставки — расчётные величины и служат ориентиром. История Git (коммиты, даты, объём кода)
              документирует сам факт и объём выполненной работы. Отчёт подготовил: {OWNER}.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Project;
