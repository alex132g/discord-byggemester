// Sets up the "BYG OG HYG" Discord server for Byggeri & Energi (simple layout: few shared channels).
// Usage: node setup.js [--dry-run]   (safe to re-run: creates what is missing, removes what is not in LAYOUT)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { LINKS_TEXT } = require('./be-data');

const { DISCORD_TOKEN, DISCORD_GUILD_ID: G } = require('./.mcp.json').mcpServers.discord.env;
const DRY = process.argv.includes('--dry-run');
const OWNER_ID = '687290274094776365'; // Alexander

const SEND = 1n << 11n, PUB_THREADS = 1n << 35n, PRIV_THREADS = 1n << 36n, SEND_THREADS = 1n << 38n;
const READ_ONLY = SEND | PUB_THREADS | PRIV_THREADS | SEND_THREADS;
const TEXT = 0, VOICE = 2, CATEGORY = 4;

// ---------- Desired structure ----------
const ROLES = [
  { name: 'Gruppe 1', color: 0xf28c28 },
  { name: 'Gruppe 2', color: 0x3b82f6 },
];
const REMOVE_ROLES = ['BE-klassen'];

const LAYOUT = [
  { name: '📌 INFO', readOnly: true, channels: [
    { name: 'info', topic: 'Grupper, links og hvordan serveren bruges. Skriv /uge eller /afleveringer for årsplanen.' },
  ]},
  { name: '💬 FÆLLES', channels: [
    { name: 'general', topic: 'Snak om alt.' },
    { name: 'opgaver', topic: 'Spørgsmål og koordinering om opgaver og afleveringer - skriv hvilket modul det drejer sig om.' },
    { name: 'filer-og-billeder', topic: 'Billeder, skitser, Revit-filer og PDF\'er. Maks 10 MB - større filer som OneDrive-link.' },
  ]},
  { name: '🔊 VOICE', channels: [
    { name: 'Snak 1', type: VOICE },
    { name: 'Snak 2', type: VOICE },
    { name: '🖥️ Skærmdeling – Revit', type: VOICE },
  ]},
];

const INFO_MESSAGE = `# Velkommen til BYG OG HYG 🏗️⚡
Server til **Byggeri & Energi**.

🟧 **Gruppe 1:** Alexander, Niels, Marcus
🟦 **Gruppe 2:** Sohib, Royar, William

**Hvor skal det hen?**
• **#general** – snak om alt
• **#opgaver** – spørgsmål om opgaver og afleveringer
• **#filer-og-billeder** – billeder, tegninger, Revit og PDF (maks 10 MB, ellers OneDrive-link)
• **Voice** – Snak 1/2 til gruppearbejde, Skærmdeling til Revit

**Bot-kommandoer:** \`/uge\` · \`/afleveringer\` · \`/links\` · \`/uvaerdi\` · \`/varmetab\`

${LINKS_TEXT.replace(/\n\*Mangler[^\n]*/, '')}`;

// ---------- Self-check ----------
const wanted = new Set(LAYOUT.flatMap(c => [c.name, ...c.channels.map(ch => ch.name)]));
assert.strictEqual(wanted.size, LAYOUT.length + LAYOUT.reduce((n, c) => n + c.channels.length, 0), 'duplicate channel names');
assert(INFO_MESSAGE.length <= 2000, `info message too long (${INFO_MESSAGE.length})`);

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
const hasHumanMessages = async id => (await api('GET', `/channels/${id}/messages?limit=100`)).some(m => !m.author.bot);

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
  for (const name of REMOVE_ROLES) {
    const found = existingRoles.find(x => x.name === name);
    if (found) { await api('DELETE', `/guilds/${G}/roles/${found.id}`); console.log('  - rolle', name); }
  }

  // Categories + channels
  let channels = await api('GET', `/guilds/${G}/channels`);
  const keep = new Set();
  let infoId;
  for (const [ci, cat] of LAYOUT.entries()) {
    const overwrites = cat.readOnly ? [{ id: G, type: 0, allow: '0', deny: String(READ_ONLY) }] : [];
    let catCh = channels.find(x => x.type === CATEGORY && x.name.toUpperCase() === cat.name.toUpperCase());
    if (!catCh) catCh = await api('POST', `/guilds/${G}/channels`, { name: cat.name, type: CATEGORY, position: ci, permission_overwrites: overwrites });
    else await api('PATCH', `/channels/${catCh.id}`, { position: ci, permission_overwrites: overwrites });
    keep.add(catCh.id);
    console.log('  # kategori', cat.name);

    for (const [i, ch] of cat.channels.entries()) {
      const type = ch.type ?? TEXT;
      let c = channels.find(x => x.name === ch.name && x.type === type);
      const body = { name: ch.name, position: i, parent_id: catCh.id, permission_overwrites: overwrites };
      if (ch.topic) body.topic = ch.topic;
      if (!c) { c = await api('POST', `/guilds/${G}/channels`, { ...body, type }); console.log('    +', ch.name); }
      else { await api('PATCH', `/channels/${c.id}`, body); console.log('    =', ch.name); }
      keep.add(c.id);
      if (ch.name === 'info') infoId = c.id;
    }
  }

  // Remove everything not in LAYOUT (channels first, then categories); never delete human messages
  channels = await api('GET', `/guilds/${G}/channels`);
  const extra = channels.filter(c => !keep.has(c.id)).sort((a, b) => (a.type === CATEGORY) - (b.type === CATEGORY));
  for (const c of extra) {
    if (c.type === TEXT && await hasHumanMessages(c.id)) { console.log('  ! beholder', c.name, '(har beskeder fra medlemmer)'); continue; }
    if (c.type === CATEGORY && channels.some(x => x.parent_id === c.id && !extra.includes(x))) { console.log('  ! beholder kategori', c.name); continue; }
    await api('DELETE', `/channels/${c.id}`);
    console.log('  - slettet', c.name);
  }

  // Info message (only into an empty channel), pinned
  const existing = DRY && String(infoId).startsWith('dry') ? [] : await api('GET', `/channels/${infoId}/messages?limit=1`);
  if (existing.length) console.log('  = besked findes allerede i info');
  else {
    const m = await api('POST', `/channels/${infoId}/messages`, { content: INFO_MESSAGE, allowed_mentions: { parse: [] } });
    await api('PUT', `/channels/${infoId}/pins/${m.id}`);
    console.log('  + besked i info');
  }

  await api('PUT', `/guilds/${G}/members/${OWNER_ID}/roles/${role['Gruppe 1']}`);

  // Server icon + bot identity (only if missing; username changes are rate limited)
  const guild = await api('GET', `/guilds/${G}`);
  if (!guild.icon) { await api('PATCH', `/guilds/${G}`, { icon: png('server-icon.png') }); console.log('  + server-ikon'); }
  const me = await api('GET', '/users/@me');
  if (me.username !== 'Byggemester' || !me.avatar) {
    await api('PATCH', '/users/@me', { username: 'Byggemester', avatar: png('bot-avatar.png') });
    console.log('  + bot-profil');
  }

  // Invite link to #info
  const invites = await api('GET', `/guilds/${G}/invites`);
  const inv = invites.find(i => i.channel?.id === infoId)
    || await api('POST', `/channels/${infoId}/invites`, { max_age: 604800, unique: false });
  console.log('\nInvite-link:', DRY ? '(dry run)' : `https://discord.gg/${inv.code}`);
})().catch(e => { console.error('FEJL:', e.message); process.exit(1); });
