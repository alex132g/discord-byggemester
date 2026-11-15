// Byggemester: keeps the bot online and answers slash commands. Run: node bot.js
const crypto = require('crypto');
const {
  Client, GatewayIntentBits, ActivityType, SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
  AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  GuildScheduledEventEntityType, GuildScheduledEventPrivacyLevel,
} = require('discord.js');
const { DISCORD_TOKEN, DISCORD_GUILD_ID } = require('./.mcp.json').mcpServers.discord.env;
const {
  LINKS_TEXT, DAYS, isoWeek, yearOf, weekText, upcomingDeadlines, uValue, parseLayers,
  deadlines, saveDeadlines, deadlineLine, planMessages, withEmojis, dateOf, ymd,
} = require('./be-data');
const { SCHOOL_MONTHS, MONTHS, renderCalendar } = require('./calendar');

// :name: -> the server's custom emoji
const emo = (guild, text) => withEmojis(text, Object.fromEntries(guild.emojis.cache.map(e => [e.name, e.id])));

const RS = { væg: [0.13, 0.04], tag: [0.10, 0.04], gulv: [0.17, 0.04] }; // DS 418: [Rsi, Rse]
const n = (x, d = 2) => x.toLocaleString('da-DK', { maximumFractionDigits: d });

const commands = [
  new SlashCommandBuilder().setName('uge').setDescription('Hvad står på årsplanen i en uge?')
    .addIntegerOption(o => o.setName('nummer').setDescription('Ugenummer (tom = denne uge)').setMinValue(1).setMaxValue(53)),
  new SlashCommandBuilder().setName('afleveringer').setDescription('De næste afleveringer og vigtige datoer'),
  new SlashCommandBuilder().setName('links').setDescription('BR18, anvisninger, Træindex, Revit m.m.'),
  new SlashCommandBuilder().setName('uvaerdi').setDescription('Beregn U-værdi for en konstruktion')
    .addStringOption(o => o.setName('lag').setRequired(true)
      .setDescription('tykkelse_mm lambda; ... fx "108 0,037; 15 0,25"'))
    .addStringOption(o => o.setName('bygningsdel').setDescription('Bestemmer Rsi/Rse (standard: væg)')
      .addChoices({ name: 'Væg', value: 'væg' }, { name: 'Loft/tag', value: 'tag' }, { name: 'Gulv', value: 'gulv' })),
  new SlashCommandBuilder().setName('varmetab').setDescription('Transmissionstab Φ = U · A · Δt')
    .addNumberOption(o => o.setName('u').setDescription('U-værdi [W/m²K]').setRequired(true).setMinValue(0))
    .addNumberOption(o => o.setName('areal').setDescription('Areal [m²]').setRequired(true).setMinValue(0))
    .addNumberOption(o => o.setName('inde').setDescription('Indetemperatur °C (standard 20)'))
    .addNumberOption(o => o.setName('ude').setDescription('Udetemperatur °C (standard -12)')),
  new SlashCommandBuilder().setName('kalender').setDescription('Vis kalenderen for en måned (kun synlig for dig)')
    .addStringOption(o => o.setName('maaned').setDescription('Måned (tom = denne måned)')
      .addChoices(...SCHOOL_MONTHS.map(([y, m]) => ({ name: `${MONTHS[m]} ${y}`, value: `${y}-${m}` })))),
  // Admin commands: hidden from everyone without Administrator, replies only visible to the admin
  new SlashCommandBuilder().setName('aflevering-ny').setDescription('Admin: tilføj en aflevering')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption(o => o.setName('uge').setDescription('Ugenummer').setRequired(true).setMinValue(1).setMaxValue(53))
    .addStringOption(o => o.setName('dag').setDescription('Ugedag').setRequired(true)
      .addChoices(...DAYS.map(d => ({ name: d, value: d }))))
    .addStringOption(o => o.setName('titel').setDescription('Hvad skal afleveres').setRequired(true).setMaxLength(150))
    .addStringOption(o => o.setName('link').setDescription('Link til opgaven (valgfri)'))
    .addStringOption(o => o.setName('linknavn').setDescription('Tekst på linket (standard: Opgave)').setMaxLength(40)),
  new SlashCommandBuilder().setName('aflevering-link').setDescription('Admin: tilføj et link til en aflevering')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('aflevering').setDescription('Vælg aflevering').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('link').setDescription('URL').setRequired(true))
    .addStringOption(o => o.setName('linknavn').setDescription('Tekst på linket (standard: Link)').setMaxLength(40)),
  new SlashCommandBuilder().setName('aflevering-slet').setDescription('Admin: slet en aflevering')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('aflevering').setDescription('Vælg aflevering').setRequired(true).setAutocomplete(true)),
].map(c => c.toJSON());

const ADMIN_COMMANDS = new Set(['aflevering-ny', 'aflevering-link', 'aflevering-slet']);
const eph = content => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
const label = d => `Uge ${d.week} ${d.day} – ${d.text}`.slice(0, 100);

function validUrl(s) {
  try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
// Link names go inside [..] in markdown, so strip brackets that would break the link
const cleanName = (s, fallback) => (s ?? fallback).replace(/[[\]()<>]/g, '').trim() || fallback;

function findDeadline(i) {
  const id = Number(i.options.getString('aflevering'));
  return deadlines().find(d => d.id === id);
}

const CAL_VERSION = 1; // bump when the calendar design changes so the image gets redrawn
const todayCph = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Copenhagen' }); // YYYY-MM-DD

// Makes #årsplan-og-afleveringer = [year calendar image, ...planMessages()]: edit, add or remove the bot's messages.
// The image message carries a hash of its inputs, so it is only redrawn when the deadlines or the date change.
async function syncPlanChannel(guild) {
  const ch = guild.channels.cache.find(c => c.name === 'årsplan-og-afleveringer');
  if (!ch) return;
  const today = todayCph(), list = deadlines();
  const hash = crypto.createHash('sha1').update(JSON.stringify([CAL_VERSION, today, list])).digest('hex').slice(0, 8);
  const want = [`-# :gantt: Kalenderen opdaterer sig selv · ${hash}`, ...planMessages(list)].map(m => emo(guild, m));
  const mine = [...(await ch.messages.fetch({ limit: 50 })).values()]
    .filter(m => m.author.id === client.user.id && m.type === 0).reverse();
  for (let k = 0; k < Math.max(want.length, mine.length); k++) {
    const old = mine[k];
    if (k === 0) {
      if (old && old.content === want[0] && old.attachments.size) continue;
      const files = [new AttachmentBuilder(await renderCalendar({ view: 'year', today, list }), { name: 'kalender.png' })];
      if (old) await old.edit({ content: want[0], files, attachments: [] });
      else await ch.send({ content: want[0], files, allowedMentions: { parse: [] } });
    } else if (old && k < want.length) {
      if (old.content !== want[k] || old.attachments.size) await old.edit({ content: want[k], attachments: [] });
    } else if (k < want.length) await ch.send({ content: want[k], allowedMentions: { parse: [] } });
    else await old.delete();
  }
}

// Danish wall-clock time on a YYYY-MM-DD date -> Date (handles summer/winter time)
function cphTime(day, hh, mm) {
  const guess = new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Copenhagen', timeZoneName: 'shortOffset' })
    .formatToParts(guess).find(p => p.type === 'timeZoneName').value; // e.g. "GMT+1"
  return new Date(guess - Number(off.replace('GMT', '') || 0) * 3600e3);
}

// One Discord event per upcoming deadline, found again via the [aflevering:id] marker in its description
async function syncEvents(guild) {
  const now = Date.now(), want = new Map();
  for (const d of deadlines()) {
    const day = ymd(dateOf(d.year, d.week, d.day)), end = cphTime(day, 23, 59);
    if (end <= now) continue;
    const start = cphTime(day, 8, 0);
    const body = `:deadline: Aflevering uge ${d.week} (${d.day})${d.links.map(l => `\n${l.name}: ${l.url}`).join('')}`;
    want.set(`[aflevering:${d.id}]`, {
      name: `📌 ${d.text}`.slice(0, 100), end, start: start > now + 60e3 ? start : new Date(now + 5 * 60e3),
      description: `${body.slice(0, 950)}\n\n[aflevering:${d.id}]`.replace(/:deadline: /, '📌 '),
    });
  }
  let made = 0, changed = 0, removed = 0;
  for (const ev of (await guild.scheduledEvents.fetch()).values()) {
    const mark = ev.description?.match(/\[aflevering:\d+\]/)?.[0];
    if (!mark) continue; // not one of ours
    const w = want.get(mark);
    want.delete(mark);
    if (!w) { await ev.delete(); removed++; continue; }
    if (ev.name !== w.name || ev.description !== w.description || ev.scheduledEndTimestamp !== w.end.getTime()) {
      await ev.edit({ name: w.name, description: w.description, scheduledEndTime: w.end,
        ...(ev.isScheduled() && w.start > now ? { scheduledStartTime: w.start } : {}) });
      changed++;
    }
  }
  for (const w of want.values()) {
    await guild.scheduledEvents.create({
      name: w.name, description: w.description, scheduledStartTime: w.start, scheduledEndTime: w.end,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly, entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location: 'Byggeri & Energi' },
    });
    made++;
  }
  if (made || changed || removed) console.log(`${new Date().toISOString()} events: +${made} ~${changed} -${removed}`);
}

// Runs one sync at a time (admin commands and the 30-min timer can overlap)
let syncing = Promise.resolve();
const syncAll = guild => (syncing = syncing.then(async () => {
  await syncPlanChannel(guild).catch(e => console.error('kalender/årsplan fejlede:', e.message));
  await syncEvents(guild).catch(e => console.error('events fejlede:', e.message));
}));

// Month calendar reply with ◀ ▶ buttons; key = "YYYY-M" (month index 0-11)
async function calendarReply(key) {
  const keys = SCHOOL_MONTHS.map(([y, m]) => `${y}-${m}`);
  const idx = Math.max(0, keys.indexOf(key));
  const [y, m] = SCHOOL_MONTHS[idx];
  const png = await renderCalendar({ view: 'month', month: [y, m], today: todayCph() });
  const btn = (k, label, id) => new ButtonBuilder().setStyle(ButtonStyle.Secondary).setLabel(label)
    .setCustomId(k ? `kal:${k}` : `kal:none-${id}`).setDisabled(!k);
  const prev = keys[idx - 1], next = keys[idx + 1];
  return {
    content: '', attachments: [],
    files: [new AttachmentBuilder(png, { name: `kalender-${y}-${m + 1}.png` })],
    components: [new ActionRowBuilder().addComponents(
      btn(prev, `◀ ${prev ? MONTHS[SCHOOL_MONTHS[idx - 1][1]] : ''}`.trim(), 'prev'),
      btn(next, `${next ? MONTHS[SCHOOL_MONTHS[idx + 1][1]] : ''} ▶`.trim(), 'next'))],
  };
}
const currentMonthKey = () => { const [y, m] = todayCph().split('-').map(Number); return `${y}-${m - 1}`; };

const handlers = {
  uge(i) {
    const now = isoWeek(new Date());
    const week = i.options.getInteger('nummer') ?? now.week;
    const year = i.options.getInteger('nummer') ? yearOf(week) : now.year;
    return weekText(week, year) ?? `Uge ${week} står ikke på årsplanen (ferie eller uden for skoleåret).`;
  },
  afleveringer() {
    const list = upcomingDeadlines(new Date(), 6);
    if (!list.length) return 'Ingen flere afleveringer på årsplanen 🎉';
    return '## :deadline: Næste afleveringer\n' + list.map(deadlineLine).join('\n');
  },
  async 'aflevering-ny'(i) {
    const rawLink = i.options.getString('link');
    const url = rawLink && validUrl(rawLink);
    if (rawLink && !url) return eph(':afvist: Linket skal starte med http:// eller https://');
    const list = deadlines();
    const week = i.options.getInteger('uge');
    const d = {
      id: Math.max(0, ...list.map(x => x.id)) + 1, week, year: yearOf(week), day: i.options.getString('dag'),
      text: i.options.getString('titel').trim(),
      links: url ? [{ name: cleanName(i.options.getString('linknavn'), 'Opgave'), url }] : [],
    };
    saveDeadlines([...list, d]);
    return eph(`:godkendt: Tilføjet – kalender, liste og events opdateres om et øjeblik:\n${deadlineLine(d)}`);
  },
  async 'aflevering-link'(i) {
    const d = findDeadline(i);
    if (!d) return eph(':afvist: Fandt ikke afleveringen – vælg den fra listen.');
    const url = validUrl(i.options.getString('link'));
    if (!url) return eph(':afvist: Linket skal starte med http:// eller https://');
    const list = deadlines();
    list.find(x => x.id === d.id).links.push({ name: cleanName(i.options.getString('linknavn'), 'Link'), url });
    saveDeadlines(list);
    return eph(`:godkendt: Link tilføjet – opdateres om et øjeblik:\n${deadlineLine(list.find(x => x.id === d.id))}`);
  },
  async 'aflevering-slet'(i) {
    const d = findDeadline(i);
    if (!d) return eph(':afvist: Fandt ikke afleveringen – vælg den fra listen.');
    saveDeadlines(deadlines().filter(x => x.id !== d.id));
    return eph(`:afvist: Slettet – opdateres om et øjeblik: ${label(d)}`);
  },
  links: () => LINKS_TEXT,
  uvaerdi(i) {
    const layers = parseLayers(i.options.getString('lag'));
    if (!layers) return { content: ':afvist: Kunne ikke læse lagene. Skriv `tykkelse_mm lambda` adskilt med `;`, fx `108 0,037; 15 0,25`.', flags: MessageFlags.Ephemeral };
    const part = i.options.getString('bygningsdel') ?? 'væg';
    const [rsi, rse] = RS[part];
    const { R, U } = uValue(layers, rsi, rse);
    const rows = layers.map(l => `• ${l.mm} mm, λ = ${n(l.lambda, 3)} → R = ${n(l.mm / 1000 / l.lambda, 3)} m²K/W`);
    return `## :uvaerdi: U-værdi (${part})\nRsi = ${n(rsi)} · Rse = ${n(rse)}\n${rows.join('\n')}\n**R_total = ${n(R, 3)} m²K/W → U = ${n(U, 3)} W/m²K**`;
  },
  varmetab(i) {
    const u = i.options.getNumber('u'), a = i.options.getNumber('areal');
    const ti = i.options.getNumber('inde') ?? 20, te = i.options.getNumber('ude') ?? -12;
    const phi = u * a * (ti - te);
    return `## :flamme: Varmetab\nΦ = U · A · Δt = ${n(u, 3)} · ${n(a)} · (${n(ti)} − (${n(te)})) = **${n(phi, 1)} W**`;
  },
};

const WELCOMES = [
  ':kran: {u} er lige landet på byggepladsen! Husk sikkerhedshjelmen.',
  ':mursten: Nyt fundament er støbt: {u} er med! Serverens U-værdi er lige blevet bedre.',
  ':energi: {u} er tilsluttet nettet – energirammen er stadig overholdt.',
  ':tegning: {u} er tegnet ind på plantegningen. Velkommen!',
  ':hammer: Byggemester melder: {u} er mødt op. Hent en hammer og find en stige!',
  ':planke: {u} er spærret inde hos os nu. Der er ingen vej ud. Velkommen! :hus:',
  ':termometer: Varmetabet faldt lige: {u} er kommet ind i varmen!',
  ':vest: Hjelm på, {u}! Du er nu officielt en del af byggeholdet.',
  ':maalebaand: {u} er målt op og godkendt efter BR18. Velkommen indenfor!',
  ':kegle: Pas på! {u} er kørt ind på byggepladsen med fuld fart.',
];
const welcomeText = (userId, rnd = Math.random()) =>
  WELCOMES[Math.floor(rnd * WELCOMES.length)].replace('{u}', `<@${userId}>`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildExpressions] });

const welcomed = new Set(); // user ids that already have a welcome in #medlemmer
const findChannel = (guild, name) => guild.channels.cache.find(c => c.name === name);

async function welcome(member) {
  const ch = findChannel(member.guild, 'medlemmer');
  if (!ch) return console.error('kanal #medlemmer mangler');
  if (member.user.bot || welcomed.has(member.id)) return;
  welcomed.add(member.id); // mark first so the join event and the sweep never both post
  await ch.send({
    content: emo(member.guild, `${welcomeText(member.id)}\nFind din gruppe i ${findChannel(member.guild, 'info') ?? '#info'} og sig hej i #general :grin:`),
    allowedMentions: { users: [member.id] },
  }).catch(e => { welcomed.delete(member.id); console.error('velkomst fejlede:', e.message); });
}

// Welcomes everyone who joined after #medlemmer was created but has no welcome yet (e.g. joined while the PC was off)
async function sweep() {
  const guild = client.guilds.cache.get(DISCORD_GUILD_ID);
  const ch = findChannel(guild, 'medlemmer');
  if (!ch) return;
  for (let before; ;) {
    const batch = await ch.messages.fetch({ limit: 100, before });
    for (const m of batch.values()) if (m.author.id === client.user.id) m.mentions.users.forEach(u => welcomed.add(u.id));
    if (batch.size < 100) break;
    before = batch.last().id;
  }
  const members = await guild.members.fetch();
  for (const m of members.values()) await giveMemberRole(m); // also catches joins while the bot was offline
  const missing = members
    .filter(m => !m.user.bot && !welcomed.has(m.id) && m.joinedTimestamp > ch.createdTimestamp);
  for (const m of missing.values()) await welcome(m);
  console.log(`${new Date().toISOString()} tjek af nye medlemmer: ${missing.size} velkomst(er) sendt`);
}

const MEMBER_ROLE = 'BE medlem';
async function giveMemberRole(member) {
  const r = member.guild.roles.cache.find(x => x.name.toLowerCase() === MEMBER_ROLE.toLowerCase());
  if (!r) return console.error(`rollen "${MEMBER_ROLE}" mangler - kør node setup.js`);
  if (member.user.bot || member.roles.cache.has(r.id)) return;
  await member.roles.add(r).catch(e => console.error('rolle fejlede:', member.user.tag, e.message));
}

client.on('guildMemberAdd', async member => {
  await giveMemberRole(member);
  await welcome(member);
});

client.once('clientReady', async () => {
  client.user.setPresence({ activities: [{ name: 'Byggeri & Energi · /uge', type: ActivityType.Watching }], status: 'online' });
  await client.guilds.cache.get(DISCORD_GUILD_ID).commands.set(commands); // guild commands update instantly
  console.log(`${new Date().toISOString()} online som ${client.user.tag}, ${commands.length} commands`);
  const every30 = async () => {
    await sweep().catch(e => console.error('tjek fejlede:', e.message));
    await syncAll(client.guilds.cache.get(DISCORD_GUILD_ID)); // redraws the calendar when the day changes
  };
  every30();
  setInterval(every30, 30 * 60 * 1000); // every 30 min
});

client.on('interactionCreate', async i => {
  if (i.isAutocomplete()) {
    const q = i.options.getFocused().toLowerCase();
    const choices = deadlines().filter(d => label(d).toLowerCase().includes(q)).slice(0, 25)
      .map(d => ({ name: label(d), value: String(d.id) }));
    return i.respond(choices).catch(() => {});
  }
  // /kalender and its ◀ ▶ buttons: drawing takes a moment, so defer first (Discord wants an answer within 3 s)
  const isCalCmd = i.isChatInputCommand() && i.commandName === 'kalender';
  const isCalBtn = i.isButton() && i.customId.startsWith('kal:');
  if (isCalCmd || isCalBtn) {
    try {
      if (isCalCmd) await i.deferReply({ flags: MessageFlags.Ephemeral }); else await i.deferUpdate();
      return await i.editReply(await calendarReply(isCalCmd ? (i.options.getString('maaned') ?? currentMonthKey()) : i.customId.slice(4)));
    } catch (e) {
      console.error('kalender-kommando fejlede:', e);
      return i.editReply({ content: emo(i.guild, ':panik: Kunne ikke tegne kalenderen'), files: [], components: [] }).catch(() => {});
    }
  }
  if (!i.isChatInputCommand() || !handlers[i.commandName]) return;
  // Discord hides admin commands already; check again here so a misconfigured permission can't open them up
  if (ADMIN_COMMANDS.has(i.commandName) && !i.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return i.reply(eph(emo(i.guild, 'Kun for admins :vaerktoejskasse:')));
  }
  try {
    const out = await handlers[i.commandName](i);
    const reply = typeof out === 'string' ? { content: out, allowedMentions: { parse: [] } } : out;
    await i.reply({ ...reply, content: emo(i.guild, reply.content) });
    if (ADMIN_COMMANDS.has(i.commandName)) syncAll(i.guild); // after replying, so the command never times out
  } catch (e) {
    console.error(e);
    if (!i.replied) await i.reply({ content: emo(i.guild, ':panik: Noget gik galt'), flags: MessageFlags.Ephemeral }).catch(() => {});
  }
});

client.on('error', e => console.error('client error:', e.message));
process.on('unhandledRejection', e => console.error('unhandled:', e));
client.login(DISCORD_TOKEN);
