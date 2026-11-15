// Sets up the "BYG OG HYG" Discord server for Byggeri & Energi (simple layout: few shared channels).
// Usage: node setup.js [--dry-run]   (safe to re-run: creates what is missing, removes what is not in LAYOUT)
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { LINKS_TEXT, withEmojis } = require('./be-data');

const { DISCORD_TOKEN, DISCORD_GUILD_ID: G } = require('./.mcp.json').mcpServers.discord.env;
const DRY = process.argv.includes('--dry-run');
const OWNER_ID = '687290274094776365'; // Alexander

const VIEW = 1n << 10n, SEND = 1n << 11n, PUB_THREADS = 1n << 35n, PRIV_THREADS = 1n << 36n, SEND_THREADS = 1n << 38n;
const READ_ONLY = SEND | PUB_THREADS | PRIV_THREADS | SEND_THREADS;
const TEXT = 0, VOICE = 2, CATEGORY = 4;

// ---------- Desired structure ----------
const ROLES = [
  { name: 'Gruppe 1', color: 0xf28c28 },
  { name: 'Gruppe 2', color: 0x3b82f6 },
  { name: 'BE medlem', color: 0x1f8b4c }, // bot.js gives this to everyone who joins
];
const REMOVE_ROLES = ['BE-klassen'];

const LAYOUT = [
  { name: '📌 INFO', readOnly: true, channels: [
    { name: 'info', topic: ':byggemester: Grupper, links og hvordan serveren bruges.' },
    { name: 'årsplan-og-afleveringer', topic: ':gantt: Kalender over skoleåret 26-27 – brug knapperne under den for måned, uge og afleveringer.' },
    { name: 'medlemmer', topic: ':hjelm: Byggemester byder nye medlemmer velkommen her' },
  ]},
  { name: '💬 FÆLLES', channels: [
    { name: 'general', topic: ':grin: Snak om alt.' },
    { name: 'opgaver', topic: ':deadline: Spørgsmål og koordinering om opgaver og afleveringer - skriv hvilket modul det drejer sig om.' },
    { name: 'filer-og-billeder', topic: ':laptop: Billeder, skitser, Revit-filer og PDF\'er. Maks 10 MB - større filer som OneDrive-link.' },
  ]},
  { name: '🔨 VÆRKSTEDSUGE', channels: [
    { name: 'billeder', topic: ':hammer: Billeder fra værkstedsugen.' },
    { name: 'tegninger', topic: ':tegning: Tegninger og materialelister til værkstedsugen.' },
  ]},
  { name: '🔊 VOICE', channels: [
    { name: 'Snak 1', type: VOICE },
    { name: 'Snak 2', type: VOICE },
    { name: '🖥️ Skærmdeling – Revit', type: VOICE },
  ]},
  { name: '🔒 ADMIN', private: true, channels: [
    { name: 'admin', topic: ':vaerktoejskasse: Kun for admin. /aflevering-ny · /aflevering-link · /aflevering-slet (svar er kun synlige for dig).' },
  ]},
];

// c = { channelName: id } so the message can link the channels; :name: = custom emoji
const infoMessages = c => [`# :byggemester: Velkommen til BYG OG HYG!
Serveren til **Byggeri & Energi** – noter, tegninger, billeder og snak om opgaver. :hjelm:

## :vest: Grupperne
:hammer: **Gruppe 1:** Alexander, Niels, Marcus
:sav: **Gruppe 2:** Sohib, Royar, William

## :tegning: Hvor skal det hen?
:grin: <#${c.general}> – snak om alt
:deadline: <#${c.opgaver}> – spørgsmål om opgaver og afleveringer
:laptop: <#${c['filer-og-billeder']}> – billeder, tegninger, Revit og PDF (maks 10 MB, ellers OneDrive-link)
:vaerktoejskasse: <#${c.billeder}> · <#${c.tegninger}> – alt fra værkstedsugen
:gantt: <#${c['årsplan-og-afleveringer']}> – kalender med alle deadlines (klik på knapperne)
:kaffepause: **Voice** – Snak 1/2 til gruppearbejde, Skærmdeling til Revit

## :lommeregner: Bot-kommandoer
\`/uge\` · \`/afleveringer\` · \`/links\` · \`/uvaerdi\` · \`/varmetab\``,
LINKS_TEXT.replace(/\n\*Mangler[^\n]*/, '')];

// channel -> messages (the first one is pinned). #årsplan-og-afleveringer is kept up to date by bot.js (calendar image).
const messagesFor = c => ({ info: infoMessages(c) });

// ---------- Self-check (with worst-case long ids, as emojis and channel links make messages longer) ----------
const wanted = new Set(LAYOUT.flatMap(c => [c.name, ...c.channels.map(ch => ch.name)]));
assert.strictEqual(wanted.size, LAYOUT.length + LAYOUT.reduce((n, c) => n + c.channels.length, 0), 'duplicate channel names');
{
  const longId = '1'.repeat(20), anyName = new Proxy({}, { get: () => longId });
  for (const [k, msgs] of Object.entries(messagesFor(anyName))) {
    assert(wanted.has(k), `message target #${k} missing`);
    for (const m of msgs) assert(withEmojis(m, anyName).length <= 2000, `message for #${k} too long`);
  }
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
const hasHumanMessages = async id => (await api('GET', `/channels/${id}/messages?limit=100`)).some(m => !m.author.bot);

(async () => {
  console.log(DRY ? '== DRY RUN ==' : '== SETUP ==');

  // Roles
  const existingRoles = await api('GET', `/guilds/${G}/roles`);
  const role = {};
  for (const r of ROLES) {
    const found = existingRoles.find(x => x.name.toLowerCase() === r.name.toLowerCase());
    role[r.name] = found ? found.id : (await api('POST', `/guilds/${G}/roles`, { hoist: true, mentionable: true, ...r })).id;
    console.log(found ? '  = rolle' : '  + rolle', r.name);
  }
  for (const name of REMOVE_ROLES) {
    const found = existingRoles.find(x => x.name === name);
    if (found) { await api('DELETE', `/guilds/${G}/roles/${found.id}`); console.log('  - rolle', name); }
  }

  const emojiIds = Object.fromEntries((await api('GET', `/guilds/${G}/emojis`)).map(e => [e.name, e.id]));
  const emo = text => withEmojis(text, emojiIds);

  // Categories + channels
  let channels = await api('GET', `/guilds/${G}/channels`);
  const keep = new Set();
  const ids = {};
  for (const [ci, cat] of LAYOUT.entries()) {
    const overwrites = cat.readOnly ? [{ id: G, type: 0, allow: '0', deny: String(READ_ONLY) }]
      : cat.private ? [{ id: G, type: 0, allow: '0', deny: String(VIEW) }] : []; // private: only owner/admins see it
    let catCh = channels.find(x => x.type === CATEGORY && x.name.toUpperCase() === cat.name.toUpperCase());
    if (!catCh) catCh = await api('POST', `/guilds/${G}/channels`, { name: cat.name, type: CATEGORY, position: ci, permission_overwrites: overwrites });
    else await api('PATCH', `/channels/${catCh.id}`, { position: ci, permission_overwrites: overwrites });
    keep.add(catCh.id);
    console.log('  # kategori', cat.name);

    for (const [i, ch] of cat.channels.entries()) {
      const type = ch.type ?? TEXT;
      let c = channels.find(x => x.name === ch.name && x.type === type);
      const body = { name: ch.name, position: i, parent_id: catCh.id, permission_overwrites: overwrites };
      if (ch.topic) body.topic = emo(ch.topic);
      if (!c) { c = await api('POST', `/guilds/${G}/channels`, { ...body, type }); console.log('    +', ch.name); }
      else { await api('PATCH', `/channels/${c.id}`, body); console.log('    =', ch.name); }
      keep.add(c.id);
      ids[ch.name] = c.id;
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

  // Messages: make the bot's own messages match (edit in place, add or remove at the end); first one pinned.
  // Channels with messages from anyone else are left alone.
  const self = await api('GET', '/users/@me');
  for (const [name, raw] of Object.entries(messagesFor(ids))) {
    const id = ids[name], msgs = raw.map(emo);
    const existing = String(id).startsWith('dry') ? [] : (await api('GET', `/channels/${id}/messages?limit=50`))
      .filter(m => m.type === 0).reverse(); // oldest first, skip "pinned a message" notices
    if (existing.some(m => m.author.id !== self.id)) { console.log('  ! rører ikke', name, '(andres beskeder i kanalen)'); continue; }
    let changed = 0;
    for (let k = 0; k < Math.max(msgs.length, existing.length); k++) {
      if (k < existing.length && k < msgs.length) {
        if (existing[k].content !== msgs[k]) { await api('PATCH', `/channels/${id}/messages/${existing[k].id}`, { content: msgs[k] }); changed++; }
      } else if (k < msgs.length) {
        const m = await api('POST', `/channels/${id}/messages`, { content: msgs[k], allowed_mentions: { parse: [] } });
        if (k === 0) await api('PUT', `/channels/${id}/pins/${m.id}`);
        changed++;
      } else { await api('DELETE', `/channels/${id}/messages/${existing[k].id}`); changed++; }
    }
    console.log(changed ? '  ~ opdateret' : '  = uændret', name);
  }

  await api('PUT', `/guilds/${G}/members/${OWNER_ID}/roles/${role['Gruppe 1']}`);

  // Server icon + bot identity (only if missing; username changes are rate limited)
  const guild = await api('GET', `/guilds/${G}`);
  if (!guild.icon) { await api('PATCH', `/guilds/${G}`, { icon: png('server-icon.png') }); console.log('  + server-ikon'); }
  // bot.js welcomes new members in #medlemmer, so turn off Discord's own join messages (flag 1)
  if (!(guild.system_channel_flags & 1)) {
    await api('PATCH', `/guilds/${G}`, { system_channel_flags: guild.system_channel_flags | 1 });
    console.log('  + Discords egne join-beskeder slået fra');
  }
  const me = await api('GET', '/users/@me');
  if (me.username !== 'Byggemester' || !me.avatar) {
    await api('PATCH', '/users/@me', { username: 'Byggemester', avatar: png('bot-avatar.png') });
    console.log('  + bot-profil');
  }

  // Invite link to #info
  const invites = await api('GET', `/guilds/${G}/invites`);
  const inv = invites.find(i => i.channel?.id === ids.info)
    || await api('POST', `/channels/${ids.info}/invites`, { max_age: 604800, unique: false });
  console.log('\nInvite-link:', DRY ? '(dry run)' : `https://discord.gg/${inv.code}`);
})().catch(e => { console.error('FEJL:', e.message); process.exit(1); });
