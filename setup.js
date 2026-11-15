// Sets up the "BYG OG HYG" Discord server for Byggeri & Energi.
// Usage: node setup.js [--dry-run]   (safe to re-run: only creates what is missing)
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const { DISCORD_TOKEN, DISCORD_GUILD_ID: G } = require('./.mcp.json').mcpServers.discord.env;
const DRY = process.argv.includes('--dry-run');
const OWNER_ID = '687290274094776365'; // Alexander

// Permission bits
const VIEW = 1n << 10n, SEND = 1n << 11n, ADD_REACTIONS = 1n << 6n,
  PUB_THREADS = 1n << 35n, PRIV_THREADS = 1n << 36n, SEND_THREADS = 1n << 38n;
const READ_ONLY = SEND | PUB_THREADS | PRIV_THREADS | SEND_THREADS;
const TEXT = 0, VOICE = 2, CATEGORY = 4, FORUM = 15;

// ---------- Desired structure ----------
const ROLES = [
  { name: 'Gruppe 1', color: 0xf28c28 },
  { name: 'Gruppe 2', color: 0x3b82f6 },
  { name: 'BE-klassen', color: 0x22c55e },
];

// access: 'info' = everyone reads, nobody writes · 'class' = BE-klassen only · role name = private for that role
const LAYOUT = [
  { name: '📌 INFO', access: 'info', channels: [
    { name: 'velkommen', topic: 'Start her: regler, grupper og hvordan vi deler filer.' },
    { name: 'årsplan', topic: 'Årsplan for Byggeri & Energi 2026-2027 (ret til overraskelser forbeholdes).' },
    { name: 'afleveringer', topic: 'Deadlines og større afleveringer fra årsplanen.' },
    { name: 'links', topic: 'Nyttige links: BR18, Revit, Gantt Project m.m.' },
  ]},
  { name: '💬 FÆLLES', access: 'class', channels: [
    { name: 'general', topic: 'Fælles snak for hele BE-holdet.' },
    { name: 'spørgsmål-til-opgaver', topic: 'Spørg løs om opgaver og afleveringer - skriv hvilket modul det drejer sig om.' },
    { name: 'billeder-og-skitser', topic: 'Billeder af håndskitser, tavlen, modeller m.m.' },
    { name: 'off-topic', topic: 'Alt det der ikke handler om byggeri.' },
  ]},
  { name: '📚 FAGETS MODULER', access: 'class', channels: [
    { name: 'materialesamling', topic: 'Fagets materialesamling, intro og weblager.' },
    { name: 'plan-og-styr', topic: 'Plan og styr, tidsplaner (Gantt Project), familiens ønsker.' },
    { name: 'tegningsmaterialer', topic: 'Materialer til tegning: Revit-opsætning, plantegninger, BR18.' },
    { name: 'skitseprojekt', topic: 'Skitseprojekt: rum og relationer, håndskitser, møde med bygherre.' },
    { name: 'detaljesamlinger', topic: 'Detalje 1 (fundament, ydermur, terrændæk) og Detalje 2 (tagdetalje).' },
    { name: 'afløbsinstallation', topic: 'Afløbsinstallation inkl. rensning af spildevand.' },
    { name: 'værkstedsøvelse', topic: 'Værkstedsøvelse og materialeliste til værksted.' },
    { name: 'bærende-konstruktioner', topic: 'Dimensionering af bærende bygningsdele.' },
    { name: 'miljø-og-vedvarende-energi', topic: 'Miljø inkl. vedvarende energi, energiforsyning og energiramme.' },
    { name: 'varmetabsberegninger', topic: 'U-værdier og varmetabsberegninger.' },
    { name: 'detailprojekt', topic: 'Detailprojektet.' },
    { name: 'eksamensprojekt', topic: 'Eksamensprojekt: oplæg, problemformulering, aflevering.' },
  ]},
  { name: '🛠️ REVIT & FILER', access: 'class', channels: [
    { name: 'revit-hjælp', type: FORUM, topic: 'Ét opslag pr. Revit-problem. Vælg et tag og vedhæft screenshot.',
      tags: ['Familier', 'Plantegning', 'Snit', 'Render', 'Fejl'] },
    { name: 'revit-filer', topic: 'Del .rvt/.rfa-filer. Maks 10 MB pr. upload - større filer deles som OneDrive-link.' },
    { name: 'tegninger-og-pdf', topic: 'Færdige tegninger, PDF-eksporter og afleveringsfiler.' },
    { name: 'fotos-fra-værkstedet', topic: 'Billeder fra værkstedet og byggepladsen.' },
  ]},
  { name: 'GRUPPE 1', access: 'Gruppe 1', channels: [
    { name: 'snak', topic: 'Privat for Gruppe 1.' },
    { name: 'opgaver', topic: 'Fordeling af opgaver i Gruppe 1.' },
    { name: 'filer', topic: 'Gruppe 1s filer og tegninger (maks 10 MB, ellers link).' },
    { name: 'Gruppe 1 – møde', type: VOICE },
  ]},
  { name: 'GRUPPE 2', access: 'Gruppe 2', channels: [
    { name: 'snak', topic: 'Privat for Gruppe 2.' },
    { name: 'opgaver', topic: 'Fordeling af opgaver i Gruppe 2.' },
    { name: 'filer', topic: 'Gruppe 2s filer og tegninger (maks 10 MB, ellers link).' },
    { name: 'Gruppe 2 – møde', type: VOICE },
  ]},
  { name: '🔊 VOICE', access: 'class', channels: [
    { name: 'Studierum 1', type: VOICE },
    { name: 'Studierum 2', type: VOICE },
    { name: '🖥️ Skærmdeling – Revit', type: VOICE },
  ]},
];

const DELETE_DEFAULTS = [ // voice channel first so its category is empty
  { name: 'General', type: VOICE },
  { name: 'Text Channels', type: CATEGORY },
  { name: 'Voice Channels', type: CATEGORY },
];

const MESSAGES = {
  velkommen: [`# Velkommen til BYG OG HYG 🏗️⚡
Serveren for **Byggeri & Energi** – her samler vi noter, billeder, tegninger og Revit-filer.

**Grupper**
🟧 **Gruppe 1** – Alexander, Niels, Marcus
🟦 **Gruppe 2** – Sohib, Royar, William
Hver gruppe har sin egen private kategori (tekst, opgaver, filer og voice).

**Sådan bruger du serveren**
• 📚 *Fagets moduler* – én kanal pr. forløb fra kursussiden. Læg noter og spørgsmål i den rigtige kanal.
• 🛠️ *Revit & filer* – Revit-problemer i forum-kanalen **#revit-hjælp** (ét opslag pr. problem), filer i **#revit-filer** og **#tegninger-og-pdf**.
• Uploads er maks **10 MB**. Store .rvt-filer deles som OneDrive-link.
• 🔊 *Skærmdeling – Revit* til at vise modeller live.

**Regler**
1. Hold det venligt og fagligt i fælleskanalerne.
2. Navngiv filer: \`modul_emne_navn_dato\` (fx \`detalje2_tagdetalje_gruppe1_2026-10-09.pdf\`).
3. Afleveringer laves selv – del idéer, ikke færdige besvarelser.`],
  årsplan: [
`## Årsplan BE 26-27 · Uge 33–41
**Uge 33** Intro, weblager, Jensens første hus, lokalplan · Plan og styr + fam. ønsker
**Uge 34** Disp. af grund · Tung ydervæg, U-værdi og rumfordeling · Rum og relationer + håndskitser + BR18
**Uge 35** Håndskitser af huse + BR18 · Detalje 1 (fundament, ydermur, terrændæk) · Idrætsdag
**Uge 36** Revit opsætning + opstart · Alle tegner egen plan i Revit · 🔴 Detalje 1 færdig – afleveres
**Uge 37** Ingen teknikfag – 2.g studietur
**Uge 38** 🔴 Individuel afl. af egen plantegning · Skitseprojekt · Møde ml. bygherre og arkitekt
**Uge 39** Skitseprojekt – tidsplan Gantt Project · Skitseprojekt · Ingen teknikfag (SOP)
**Uge 40** 🔴 Afl. af skitseprojekt · Detalje 2 (tagdetalje) · Detalje 2
**Uge 41** Detalje 2 · Ingen teknikfag (SOP) · 🔴 Detalje 2 – gruppeaflevering`,
`## Årsplan BE 26-27 · Uge 42–51
**Uge 42** Efterårsferie
**Uge 43** Afløbsinst. inkl. rensning af spildevand · Afløbsinstallation · Ingen teknikfag (brobygning)
**Uge 44** Afløbsinstallation · 🔴 Afløbsinstallation – gruppeaflevering · Terminsprøve
**Uge 45** Terminsprøve · Terminsprøve · Materialeliste til værksted (3 mod.)
**Uge 46** Dim. af bærende bygningsdel (alle tre dage)
**Uge 47** Værksted (man 2.–4. mod., fre 1.–3. mod.)
**Uge 48** Værksted (man, tir, fre)
**Uge 49–50** SOP
**Uge 51** Dim. af bærende bygningsdel (alle tre dage)`,
`## Årsplan BE 26-27 · Uge 1–16
**Uge 1** Dim. af bærende bygningsdel · 🔴 Oplæg til teknikfagspræsentation – afl. · 🔴 Teknikfagspræsentation
**Uge 2** Vedvarende energi · Vedvarende energi · Detailprojekt
**Uge 3** SOP-eksamen · SOP-eksamen · Energiforsyning og energiramme
**Uge 4** U-værdiberegninger · Varmetabsberegninger · Detailprojekt
**Uge 5** Ekskursion · Produktgennemgang · Ingen teknikfag
**Uge 6** Eksamensprojekt (udlevering af oplæg) · Eksamensprojekt · 🔴 Godkendt problemformulering
**Uge 7** Vinterferie
**Uge 8** Eksamensprojekt
**Uge 9** Terminsprøve · Terminsprøve · Eksamensprojekt
**Uge 10–14** Eksamensprojekt (uge 12 påskeferie)
**Uge 15** Værksted onsdag–fredag (1.–4. modul)
**Uge 16** Værksted mandag–onsdag (1.–4. modul)
*Eksamensprojekt = 51 moduler · Mandag 12:05–15:45 · Tirsdag 12:05–13:50 · Fredag 9:55–13:50*`,
  ],
  afleveringer: [`## 🔴 Afleveringer og vigtige datoer
✅ Uge 36 fre – Detalje 1 (fundament, ydermur, terrændæk)
✅ Uge 38 man – Individuel aflevering af egen plantegning
✅ Uge 40 man – Skitseprojekt
✅ Uge 41 fre – Detalje 2 (tagdetalje), gruppeaflevering
✅ Uge 44 tir – Afløbsinstallation, gruppeaflevering
⬜ **Uge 1 tir – Oplæg til teknikfagspræsentation**
⬜ **Uge 1 fre – Teknikfagspræsentation**
⬜ **Uge 6 man – Udlevering af oplæg til eksamensprojekt**
⬜ **Uge 6 fre – Godkendt problemformulering**
⬜ Uge 9 – Terminsprøve
⬜ Uge 6–16 – Eksamensprojekt (51 moduler)`],
  links: [require('./be-data').LINKS_TEXT],
};

// ---------- Self-check of the structure ----------
for (const cat of LAYOUT) {
  const names = cat.channels.map(c => c.name);
  assert.strictEqual(new Set(names).size, names.length, `duplicate channel in ${cat.name}`);
  assert(['info', 'class', ...ROLES.map(r => r.name)].includes(cat.access), `bad access ${cat.access}`);
}
for (const k of Object.keys(MESSAGES)) {
  assert(LAYOUT[0].channels.some(c => c.name === k), `message target #${k} missing`);
  for (const m of MESSAGES[k]) assert(m.length <= 2000, `message for #${k} too long (${m.length})`);
}

// ---------- API ----------
async function api(method, p, body) {
  if (DRY && method !== 'GET') { console.log('  [dry]', method, p); return { id: `dry-${Math.random()}` }; }
  for (;;) {
    const r = await fetch('https://discord.com/api/v10' + p, {
      method,
      headers: { Authorization: 'Bot ' + DISCORD_TOKEN, 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    if (r.status === 429) {
      const wait = ((await r.json()).retry_after || 1) * 1000 + 100;
      await new Promise(s => setTimeout(s, wait)); continue;
    }
    if (r.status === 204) return null;
    const data = await r.json();
    if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(data)}`);
    return data;
  }
}
const png = f => 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'assets', f)).toString('base64');
const ow = (id, type, allow = 0n, deny = 0n) => ({ id, type, allow: String(allow), deny: String(deny) });

(async () => {
  console.log(DRY ? '== DRY RUN ==' : '== SETUP ==');

  // Roles
  const existingRoles = await api('GET', `/guilds/${G}/roles`);
  const role = {};
  for (const r of ROLES) {
    const found = existingRoles.find(x => x.name === r.name);
    role[r.name] = found ? found.id : (await api('POST', `/guilds/${G}/roles`, { ...r, hoist: true, mentionable: true })).id;
    console.log(found ? '  = rolle' : '  + rolle', r.name);
  }
  const everyone = G; // @everyone role id == guild id

  // Delete empty defaults
  let channels = await api('GET', `/guilds/${G}/channels`);
  for (const d of DELETE_DEFAULTS) {
    const c = channels.find(x => x.name === d.name && x.type === d.type);
    if (!c) continue;
    if (d.type === CATEGORY && channels.some(x => x.parent_id === c.id && x.name !== 'general')) {
      console.log('  ! springer over ikke-tom kategori', d.name); continue;
    }
    await api('DELETE', `/channels/${c.id}`); console.log('  - slettet', d.name);
    channels = channels.filter(x => x.id !== c.id);
  }
  channels = await api('GET', `/guilds/${G}/channels`);

  // Categories + channels
  const msgTargets = {};
  for (const [ci, cat] of LAYOUT.entries()) {
    let overwrites;
    if (cat.access === 'info') overwrites = [ow(everyone, 0, VIEW | ADD_REACTIONS, READ_ONLY)];
    else if (cat.access === 'class') overwrites = [ow(everyone, 0, 0n, VIEW), ow(role['BE-klassen'], 0, VIEW)];
    else overwrites = [ow(everyone, 0, 0n, VIEW), ow(role[cat.access], 0, VIEW)];

    let catCh = channels.find(x => x.type === CATEGORY && x.name.toUpperCase() === cat.name.toUpperCase());
    if (!catCh) catCh = await api('POST', `/guilds/${G}/channels`, { name: cat.name, type: CATEGORY, position: ci, permission_overwrites: overwrites });
    else await api('PATCH', `/channels/${catCh.id}`, { position: ci, permission_overwrites: overwrites });
    console.log('  # kategori', cat.name);

    for (const [i, ch] of cat.channels.entries()) {
      const type = ch.type ?? TEXT;
      // match by name inside this category, or (for #general) anywhere
      let c = channels.find(x => x.name === ch.name && x.type === type && (x.parent_id === catCh.id || ch.name === 'general'));
      const body = { name: ch.name, position: i, parent_id: catCh.id };
      if (ch.topic && type !== VOICE) body.topic = ch.topic;
      if (type === FORUM && ch.tags) body.available_tags = ch.tags.map(name => ({ name }));
      if (!c) {
        try { c = await api('POST', `/guilds/${G}/channels`, { ...body, type }); }
        catch (e) {
          if (type !== FORUM) throw e;
          console.log('  ! forum ikke tilladt, laver tekstkanal i stedet');
          delete body.available_tags;
          c = await api('POST', `/guilds/${G}/channels`, { ...body, type: TEXT });
        }
        console.log('    +', ch.name);
      } else {
        if (type === FORUM) delete body.available_tags; // keep existing tags
        await api('PATCH', `/channels/${c.id}`, { ...body, lock_permissions: true });
        console.log('    =', ch.name);
      }
      // sync to category permissions (creating with parent_id does not copy overwrites)
      if (!DRY) await api('PATCH', `/channels/${c.id}`, { permission_overwrites: overwrites });
      if (cat.access === 'info') msgTargets[ch.name] = c.id;
    }
  }

  // Info messages (only into empty channels), årsplan pinned
  for (const [name, msgs] of Object.entries(MESSAGES)) {
    const id = msgTargets[name];
    const existing = DRY || String(id).startsWith('dry') ? [] : await api('GET', `/channels/${id}/messages?limit=1`);
    if (existing.length) { console.log('  = beskeder findes allerede i', name); continue; }
    for (const content of msgs) {
      const m = await api('POST', `/channels/${id}/messages`, { content, allowed_mentions: { parse: [] } });
      if (name === 'årsplan' || name === 'afleveringer') await api('PUT', `/channels/${id}/pins/${m.id}`);
    }
    console.log('  + beskeder i', name);
  }

  // Give Alexander his roles
  for (const r of ['Gruppe 1', 'BE-klassen']) await api('PUT', `/guilds/${G}/members/${OWNER_ID}/roles/${role[r]}`);
  console.log('  + Alexander har Gruppe 1 + BE-klassen');

  // Server icon + bot identity
  await api('PATCH', `/guilds/${G}`, { icon: png('server-icon.png') });
  console.log('  + server-ikon');
  try {
    await api('PATCH', '/users/@me', { username: 'Byggemester', avatar: png('bot-avatar.png') });
    console.log('  + bot hedder nu Byggemester');
  } catch (e) { console.log('  ! bot-profil fejlede (prøv igen senere):', e.message); }

  // Invite link (reuse an existing permanent-ish one)
  const invites = await api('GET', `/guilds/${G}/invites`);
  const inv = invites.find(i => i.channel?.id === msgTargets.velkommen)
    || await api('POST', `/channels/${msgTargets.velkommen}/invites`, { max_age: 604800, unique: false });
  console.log('\nInvite-link:', DRY ? '(dry run)' : `https://discord.gg/${inv.code}`);
})().catch(e => { console.error('FEJL:', e.message); process.exit(1); });
