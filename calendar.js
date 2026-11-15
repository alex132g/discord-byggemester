// Draws the school-year calendar (whole year or one month) as a PNG with headless Chrome.
// Run `node calendar.js` to save example images to "Billeder og Årsplan/kalender".
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { ICONS, CHROME } = require('./emojis');
const { PLAN, deadlines, dateOf, ymd, planDays } = require('./be-data');

const MONTHS = ['Januar', 'Februar', 'Marts', 'April', 'Maj', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'];
// School year 26-27: August 2026 .. April 2027 as [year, monthIndex]
const SCHOOL_MONTHS = Array.from({ length: 9 }, (_, i) => [2026 + Math.floor((7 + i) / 12), (7 + i) % 12]);
const KIND = { // colour + label per kind of day
  undervisning: ['#5B8DEF', 'Undervisning'], vaerksted: ['#F28C28', 'Værksted'], eksamen: ['#22C55E', 'Eksamensprojekt'],
  proeve: ['#A855F7', 'Terminsprøve'], fri: ['#6B7280', 'Ingen BE'], ferie: ['#38BDF8', 'Ferie'],
};
// month height grows with the number of week rows (4-6) so nothing is cut off
const size = opts => (opts.view === 'year' ? [1500, 1240] : [1280, 290 + monthWeeks(...opts.month).length * 134]);

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (name, px) => `<svg width="${px}" height="${px}" viewBox="0 0 128 128">${ICONS[name]}</svg>`;
const fmtDay = s => { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCDate()}. ${MONTHS[d.getUTCMonth()].toLowerCase()}`; };

// Mon-Sun rows covering the month, as Date objects (UTC midnight)
function monthWeeks(y, m) {
  const first = Date.UTC(y, m, 1), last = Date.UTC(y, m + 1, 0);
  const weeks = [];
  for (let t = first - ((new Date(first).getUTCDay() + 6) % 7) * 864e5; t <= last; t += 7 * 864e5) {
    weeks.push(Array.from({ length: 7 }, (_, i) => new Date(t + i * 864e5)));
  }
  return weeks;
}
const isoWeekNo = d => { const t = new Date(d); t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7)); return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };

function dayCell(d, m, ctx, big) {
  const key = ymd(d), inMonth = d.getUTCMonth() === m, wd = (d.getUTCDay() + 6) % 7;
  if (!inMonth) return '<td class="out"></td>';
  const p = ctx.plan[key], dls = ctx.byDate[key] || [];
  const cls = ['day', wd >= 5 ? 'we' : '', p ? 'k-' + p.kind : '', dls.length ? 'dl' : '', key === ctx.today ? 'today' : ''].join(' ');
  const bar = p ? `<i class="bar" style="background:${KIND[p.kind][0]}"></i>` : '';
  if (!big) {
    return `<td class="${cls}"><span class="n">${d.getUTCDate()}</span>${bar}${dls.length ? `<b class="dlic">${icon('deadline', 18)}</b>` : ''}</td>`;
  }
  const planTxt = p ? `<div class="pt" style="border-color:${KIND[p.kind][0]}">${esc(p.text)}</div>` : '';
  const chips = dls.map(x => `<div class="chip">${icon('deadline', 18)}<span>${esc(x.text)}</span></div>`).join('');
  return `<td class="${cls}"><div class="top"><span class="n">${d.getUTCDate()}</span>${key === ctx.today ? icon('hjelm', 22) : ''}</div>${planTxt}${chips}</td>`;
}

function monthTable(y, m, ctx, big) {
  const head = `<tr><th class="wk">${big ? 'Uge' : 'U'}</th>${['ma', 'ti', 'on', 'to', 'fr', 'lø', 'sø'].map(x => `<th>${x}</th>`).join('')}</tr>`;
  const rows = monthWeeks(y, m).map(week => {
    const wn = isoWeekNo(week[0]);
    const row = PLAN.find(r => r[0] === wn && r[1] === (wn >= 33 ? 2026 : 2027));
    const label = big ? `<td class="wk"><b>${wn}</b>${row ? `<small>${esc(row[2])}</small>` : ''}</td>` : `<td class="wk">${wn}</td>`;
    return `<tr>${label}${week.map(d => dayCell(d, m, ctx, big)).join('')}</tr>`;
  }).join('');
  return `<table>${head}${rows}</table>`;
}

const legend = () => `<footer>${Object.values(KIND).map(([c, l]) => `<span><i style="background:${c}"></i>${l}</span>`).join('')}
  <span>${icon('deadline', 22)} Aflevering</span><span class="lt">${icon('hjelm', 22)} I dag</span></footer>`;

const CSS = `*{box-sizing:border-box;margin:0}body{background:#1e1f22;font-family:'Segoe UI',Arial,sans-serif;color:#dbdee1}
.page{padding:24px 28px;height:100vh;display:flex;flex-direction:column;gap:18px}
header{display:flex;align-items:center;gap:16px}header h1{font-size:34px;font-weight:800;color:#fff;letter-spacing:.5px}
header p{color:#949ba4;font-size:16px}.todaybox{margin-left:auto;display:flex;align-items:center;gap:10px;background:#2b2d31;border:2px solid #FFC83D;border-radius:14px;padding:8px 16px;font-weight:700;color:#FFC83D;font-size:18px}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;flex:1}
section{background:#2b2d31;border-radius:16px;padding:14px 16px;box-shadow:0 2px 0 #111214}
h2{font-size:22px;color:#fff;margin-bottom:8px;font-weight:800}h2 span{color:#949ba4;font-weight:600;font-size:16px;margin-left:6px}
table{width:100%;border-collapse:separate;border-spacing:4px;table-layout:fixed}
th{font-size:13px;color:#949ba4;font-weight:700;text-transform:uppercase}th.wk,td.wk{width:34px;color:#6d717a;font-size:13px;text-align:center;font-weight:700}
td.day{position:relative;height:40px;background:#313338;border-radius:9px;text-align:center;vertical-align:middle}
td.out{background:transparent}.n{font-size:16px;font-weight:700;color:#dbdee1;position:relative;z-index:1}
td.we{background:#26272b}td.we .n{color:#6d717a}
td.k-ferie{background:rgba(56,189,248,.18)}td.k-fri .n{color:#8b9099}
.bar{position:absolute;left:6px;right:6px;bottom:4px;height:4px;border-radius:2px}
td.dl{background:#E5484D}td.dl .n{color:#fff}.dlic{position:absolute;top:-7px;right:-6px;z-index:2}
td.today{outline:3px solid #FFC83D;outline-offset:-1px}
footer{display:flex;flex-wrap:wrap;gap:22px;align-items:center;justify-content:center;font-size:15px;color:#b5bac1;font-weight:600}
footer span{display:flex;align-items:center;gap:7px}footer i{width:16px;height:16px;border-radius:4px;display:inline-block}
/* month view */
.month section{flex:1;padding:18px 20px}.month td.day{height:auto;vertical-align:top;text-align:left;padding:8px;min-height:120px}
.month tr{height:128px}.month tr:first-child{height:auto}.month th{font-size:15px}
.month .n{font-size:20px}.month .top{display:flex;justify-content:space-between;align-items:center}
.month th.wk{width:120px;text-align:left;padding-left:6px}.month td.wk{text-align:left;vertical-align:top;padding:8px 6px}.month td.wk b{display:block;font-size:18px;color:#dbdee1}
.month td.wk small{display:block;font-size:12px;color:#949ba4;font-weight:600;line-height:1.25;margin-top:3px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical}
.pt{font-size:12.5px;line-height:1.25;margin-top:5px;border-left:4px solid;padding-left:6px;color:#c4c9ce;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}
.month td.dl{background:#3a2526;box-shadow:inset 0 0 0 2px #E5484D}.month td.dl .n{color:#fff}
.chip{display:flex;gap:5px;align-items:flex-start;margin-top:6px;background:#E5484D;color:#fff;border-radius:7px;padding:4px 6px;font-size:12.5px;font-weight:700;line-height:1.2}
.chip svg{flex:none}.chip span{overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical}`;

/** opts: { view: 'year' | 'month', month: [year, monthIndex], today: 'YYYY-MM-DD', list?: deadlines } */
function calendarHtml({ view, month, today, list = deadlines() }) {
  const byDate = {};
  for (const d of list) (byDate[ymd(dateOf(d.year, d.week, d.day))] ||= []).push(d);
  const ctx = { plan: planDays(), byDate, today };
  const todayBox = `<div class="todaybox">${icon('hjelm', 30)} I dag: ${fmtDay(today)}</div>`;
  const body = view === 'year'
    ? `<div class="page year"><header>${icon('gantt', 58)}<div><h1>Byggeri &amp; Energi 26-27</h1><p>Årskalender · afleveringer, værksted, ferier og eksamensprojekt</p></div>${todayBox}</header>
       <div class="grid">${SCHOOL_MONTHS.map(([y, m]) => `<section><h2>${MONTHS[m]}<span>${y}</span></h2>${monthTable(y, m, ctx, false)}</section>`).join('')}</div>${legend()}</div>`
    : `<div class="page month"><header>${icon('gantt', 58)}<div><h1>${MONTHS[month[1]]} ${month[0]}</h1><p>Byggeri &amp; Energi 26-27 · mandag, tirsdag og fredag er BE-dage</p></div>${todayBox}</header>
       <section>${monthTable(month[0], month[1], ctx, true)}</section>${legend()}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`;
}

/** Renders the calendar to a PNG buffer */
async function renderCalendar(opts) {
  const [w, h] = size(opts);
  const base = path.join(os.tmpdir(), `byggemester-kalender-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(base + '.html', calendarHtml(opts));
  try {
    await promisify(execFile)(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`,
      '--screenshot=' + base + '.png', 'file:///' + (base + '.html').replace(/\\/g, '/')]);
    return fs.readFileSync(base + '.png');
  } finally {
    for (const ext of ['.html', '.png']) fs.rmSync(base + ext, { force: true });
  }
}

module.exports = { SCHOOL_MONTHS, MONTHS, calendarHtml, renderCalendar };

if (require.main === module) {
  (async () => {
    const out = path.join(__dirname, 'Billeder og Årsplan', 'kalender');
    fs.mkdirSync(out, { recursive: true });
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' });
    // a hostile title must be escaped, not rendered as HTML
    if (!calendarHtml({ view: 'month', month: [2026, 10], today, list: [{ week: 46, year: 2026, day: 'fre', text: '<b>x</b>', links: [] }] })
      .includes('&lt;b&gt;x&lt;/b&gt;')) throw new Error('titles are not escaped');
    fs.writeFileSync(path.join(out, 'aar.png'), await renderCalendar({ view: 'year', today }));
    fs.writeFileSync(path.join(out, 'november.png'), await renderCalendar({ view: 'month', month: [2026, 10], today }));
    fs.writeFileSync(path.join(out, 'april.png'), await renderCalendar({ view: 'month', month: [2027, 3], today }));
    console.log('kalender-eksempler gemt i', out);
  })().catch(e => { console.error('FEJL:', e.message); process.exit(1); });
}
