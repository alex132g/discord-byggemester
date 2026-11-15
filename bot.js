// Byggemester: keeps the bot online and answers slash commands. Run: node bot.js
const { Client, GatewayIntentBits, ActivityType, SlashCommandBuilder } = require('discord.js');
const { DISCORD_TOKEN, DISCORD_GUILD_ID } = require('./.mcp.json').mcpServers.discord.env;
const { LINKS_TEXT, isoWeek, weekText, upcomingDeadlines, uValue, parseLayers } = require('./be-data');

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
].map(c => c.toJSON());

const handlers = {
  uge(i) {
    const now = isoWeek(new Date());
    const week = i.options.getInteger('nummer') ?? now.week;
    const year = i.options.getInteger('nummer') ? (week >= 33 ? 2026 : 2027) : now.year;
    return weekText(week, year) ?? `Uge ${week} står ikke på årsplanen (ferie eller uden for skoleåret).`;
  },
  afleveringer() {
    const list = upcomingDeadlines(new Date(), 6);
    if (!list.length) return 'Ingen flere afleveringer på årsplanen 🎉';
    return '## 🔴 Næste afleveringer\n' + list.map(([w, , day, text]) => `• **Uge ${w} ${day}:** ${text}`).join('\n');
  },
  links: () => LINKS_TEXT,
  uvaerdi(i) {
    const layers = parseLayers(i.options.getString('lag'));
    if (!layers) return { content: 'Kunne ikke læse lagene. Skriv `tykkelse_mm lambda` adskilt med `;`, fx `108 0,037; 15 0,25`.', ephemeral: true };
    const part = i.options.getString('bygningsdel') ?? 'væg';
    const [rsi, rse] = RS[part];
    const { R, U } = uValue(layers, rsi, rse);
    const rows = layers.map(l => `• ${l.mm} mm, λ = ${n(l.lambda, 3)} → R = ${n(l.mm / 1000 / l.lambda, 3)} m²K/W`);
    return `## U-værdi (${part})\nRsi = ${n(rsi)} · Rse = ${n(rse)}\n${rows.join('\n')}\n**R_total = ${n(R, 3)} m²K/W → U = ${n(U, 3)} W/m²K**`;
  },
  varmetab(i) {
    const u = i.options.getNumber('u'), a = i.options.getNumber('areal');
    const ti = i.options.getNumber('inde') ?? 20, te = i.options.getNumber('ude') ?? -12;
    const phi = u * a * (ti - te);
    return `## Varmetab\nΦ = U · A · Δt = ${n(u, 3)} · ${n(a)} · (${n(ti)} − (${n(te)})) = **${n(phi, 1)} W**`;
  },
};

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  client.user.setPresence({ activities: [{ name: 'Byggeri & Energi · /uge', type: ActivityType.Watching }], status: 'online' });
  await client.guilds.cache.get(DISCORD_GUILD_ID).commands.set(commands); // guild commands update instantly
  console.log(`${new Date().toISOString()} online som ${client.user.tag}, ${commands.length} commands`);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() || !handlers[i.commandName]) return;
  try {
    const out = handlers[i.commandName](i);
    await i.reply(typeof out === 'string' ? { content: out, allowedMentions: { parse: [] } } : out);
  } catch (e) {
    console.error(e);
    if (!i.replied) await i.reply({ content: 'Noget gik galt 😬', ephemeral: true }).catch(() => {});
  }
});

client.on('error', e => console.error('client error:', e.message));
process.on('unhandledRejection', e => console.error('unhandled:', e));
client.login(DISCORD_TOKEN);
