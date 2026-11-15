// Byggeri & Energi 26-27: year plan data + small helpers used by bot.js and setup.js.
// Run `node be-data.js` to self-test.

// [week, year, monday, tuesday, friday]; null tuesday/friday = same text for the whole week
const PLAN = [
  [33, 2026, 'Intro, weblager, Jensens første hus, lokalplan', 'Plan og styr + fam. ønsker', 'Ingen teknikfag (1.g intro)'],
  [34, 2026, 'Disp. af grund', 'Tung ydervæg, U-værdi og opst. rumfordeling', 'Rum og relationer + håndskitser af huse + BR18'],
  [35, 2026, 'Håndskitser af huse + BR18', 'Detalje 1 (fundament, ydermur, terrændæk)', 'Idrætsdag'],
  [36, 2026, 'Revit opsætning + opstart', 'Alle tegner egen plan i Revit', '🔴 Detalje 1 færdig – afleveres'],
  [37, 2026, 'Ingen teknikfag – 2.g studietur', null, null],
  [38, 2026, '🔴 Individuel afl. af egen plantegning', 'Skitseprojekt', 'Møde ml. "bygherre" og arkitekt'],
  [39, 2026, 'Skitseprojekt – tidsplan Gantt Project', 'Skitseprojekt', 'Ingen teknikfag (SOP)'],
  [40, 2026, '🔴 Afl. af skitseprojekt', 'Detalje 2 (tagdetalje)', 'Detalje 2 (tagdetalje)'],
  [41, 2026, 'Detalje 2 (tagdetalje)', 'Ingen teknikfag (SOP)', '🔴 Detalje 2 – gruppeaflevering (3 mod.)'],
  [42, 2026, 'Efterårsferie', null, null],
  [43, 2026, 'Afløbsinst. inkl. rensning af spildevand', 'Afløbsinstallation', 'Ingen teknikfag (brobygning 3.g)'],
  [44, 2026, 'Afløbsinstallation', '🔴 Afløbsinstallation – gruppeaflevering', 'Terminsprøve'],
  [45, 2026, 'Terminsprøve', 'Terminsprøve', '3 moduler: materialeliste til værksted'],
  [46, 2026, 'Dim. af bærende bygningsdel', 'Dim. af bærende bygningsdel', 'Dim. af bærende bygningsdel'],
  [47, 2026, 'Værksted (2.–4. modul)', 'Ingen teknikfag', 'Værksted (1.–3. modul)'],
  [48, 2026, 'Værksted (2.–4. modul)', 'Værksted (1.–3. modul)', 'Værksted (2.–3. modul)'],
  [49, 2026, 'SOP', null, null],
  [50, 2026, 'SOP', null, null],
  [51, 2026, 'Dim. af bærende bygningsdel', 'Dim. af bærende bygningsdel', 'Dim. af bærende bygningsdel'],
  [1, 2027, 'Dim. af bærende bygningsdel', '🔴 Oplæg til teknikfagspræsentation – afl.', '🔴 Teknikfagspræsentation'],
  [2, 2027, 'Vedvarende energi', 'Vedvarende energi', 'Detailprojekt'],
  [3, 2027, 'Ingen teknikfag (SOP-eksamen)', 'Ingen teknikfag (SOP-eksamen)', 'Energiforsyning og energiramme'],
  [4, 2027, 'U-værdiberegninger', 'Varmetabsberegninger', 'Detailprojekt'],
  [5, 2027, 'Ekskursion', 'Produktgennemgang', 'Ingen teknikfag'],
  [6, 2027, 'Eksamensprojekt (udlevering af oplæg)', 'Eksamensprojekt', '🔴 Eksamensprojekt – godkendt problemformulering'],
  [7, 2027, 'Vinterferie', null, null],
  [8, 2027, 'Eksamensprojekt', 'Ingen teknikfag', 'Ingen teknikfag'],
  [9, 2027, 'Terminsprøve', 'Terminsprøve', 'Eksamensprojekt'],
  [10, 2027, 'Eksamensprojekt', 'Eksamensprojekt', 'Eksamensprojekt'],
  [11, 2027, 'Eksamensprojekt', 'Eksamensprojekt', 'Eksamensprojekt'],
  [12, 2027, 'Påskeferie', null, null],
  [13, 2027, 'Påskeferie', 'Eksamensprojekt', 'Eksamensprojekt'],
  [14, 2027, 'Eksamensprojekt', 'Eksamensprojekt', 'Eksamensprojekt (3 moduler)'],
  [15, 2027, 'Ingen teknikfag', 'Værksted onsdag–fredag (1.–4. modul)', null],
  [16, 2027, 'Værksted mandag–onsdag (1.–4. modul)', null, null],
];

const DEADLINES = [
  [36, 2026, 'fre', 'Detalje 1 (fundament, ydermur, terrændæk)'],
  [38, 2026, 'man', 'Individuel aflevering af egen plantegning'],
  [40, 2026, 'man', 'Skitseprojekt'],
  [41, 2026, 'fre', 'Detalje 2 (tagdetalje) – gruppeaflevering'],
  [44, 2026, 'tir', 'Afløbsinstallation – gruppeaflevering'],
  [1, 2027, 'tir', 'Oplæg til teknikfagspræsentation'],
  [1, 2027, 'fre', 'Teknikfagspræsentation'],
  [6, 2027, 'man', 'Udlevering af oplæg til eksamensprojekt'],
  [6, 2027, 'fre', 'Godkendt problemformulering'],
  [9, 2027, 'man', 'Terminsprøve'],
];

const LINKS_TEXT = `## 🔗 Links
• **BR18 – Bygningsreglementet:** https://bygningsreglementet.dk
• **Revit (gratis studielicens):** https://www.autodesk.com/education/edu-software/overview
• **Gantt Project (tidsplaner):** https://www.ganttproject.biz
• **Anvisninger (BUILD/SBi):** https://anvisninger.dk – den side vi bruger til anvisninger 🔒
• **Træindex (gratis træbøger):** https://træindex.dk 🔒
🔒 = kræver at du er på **skolens VPN**
*Mangler der et link (fx weblager eller kursussiden)? Skriv det i #general.*`;

// ISO 8601 week number + week-year
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  return { week: Math.ceil(((t - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7), year };
}

const key = (w, y) => y * 100 + w;

function weekText(week, year) {
  const row = PLAN.find(r => r[0] === week && r[1] === year);
  if (!row) return null;
  const [, , man, tir, fre] = row;
  if (tir === null && fre === null) return `**Uge ${week}:** ${man}`;
  return `**Uge ${week}**\n• Mandag 12:05–15:45: ${man}\n• Tirsdag 12:05–13:50: ${tir ?? '—'}\n• Fredag 9:55–13:50: ${fre ?? '—'}`;
}

function upcomingDeadlines(date, n = 5) {
  const now = isoWeek(date);
  return DEADLINES.filter(d => key(d[0], d[1]) >= key(now.week, now.year)).slice(0, n);
}

// U = 1 / (Rsi + Σ d/λ + Rse); layers: [{ mm, lambda }]
function uValue(layers, rsi, rse) {
  const R = layers.reduce((s, l) => s + l.mm / 1000 / l.lambda, rsi + rse);
  return { R, U: 1 / R };
}

// "108 0,037; 15 0.25" -> [{mm:108, lambda:0.037}, ...]  (';' separates layers, ',' may be a decimal)
function parseLayers(str) {
  const layers = str.split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const [mm, lambda] = s.replace(/,/g, '.').split(/\s+/).map(Number);
    return { mm, lambda };
  });
  if (!layers.length || layers.some(l => !(l.mm > 0) || !(l.lambda > 0))) return null;
  return layers;
}

module.exports = { PLAN, DEADLINES, LINKS_TEXT, isoWeek, weekText, upcomingDeadlines, uValue, parseLayers };

if (require.main === module) {
  const assert = require('assert');
  assert.deepStrictEqual(isoWeek(new Date(2026, 10, 15)), { week: 46, year: 2026 });
  assert.deepStrictEqual(isoWeek(new Date(2027, 0, 4)), { week: 1, year: 2027 });
  assert.deepStrictEqual(isoWeek(new Date(2021, 0, 1)), { week: 53, year: 2020 });
  assert.match(weekText(46, 2026), /bærende/);
  assert.strictEqual(weekText(30, 2026), null);
  assert.strictEqual(upcomingDeadlines(new Date(2026, 10, 15))[0][3], 'Oplæg til teknikfagspræsentation');
  assert.deepStrictEqual(parseLayers('108 0.037; 15 0,25'), [{ mm: 108, lambda: 0.037 }, { mm: 15, lambda: 0.25 }]);
  assert.strictEqual(parseLayers('abc'), null);
  const { U } = uValue([{ mm: 200, lambda: 0.037 }], 0.13, 0.04); // 0.17 + 5.405 = 5.575
  assert(Math.abs(U - 0.1794) < 0.001, U);
  console.log('be-data ok');
}
