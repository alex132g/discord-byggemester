// Custom server stickers (320x320 PNG) built from the emoji drawings in emojis.js, with a white sticker outline.
// Writes SVG + PNG to "Billeder og Årsplan/stickers" and uploads the ones the server doesn't have yet.
// Usage: node stickers.js [--no-upload]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ICONS, CHROME } = require('./emojis');

const DIR = path.join(__dirname, 'Billeder og Årsplan', 'stickers');
const O = '#14213D';

// icons: [emoji name, x, y, size, rotation]; lines: caption (1-2 lines)
const STICKERS = [
  { file: 'deadline', name: 'Deadline?!', tags: '😱', description: 'Når afleveringen er i morgen',
    icons: [['panik', 30, 14, 180], ['deadline', 168, 56, 130, 12]], lines: ['DEADLINE?!'], color: '#E5484D' },
  { file: 'baerende', name: 'Det er bærende', tags: '💪', description: 'Konstruktionen holder',
    icons: [['spaer', 54, 0, 190], ['sej', 120, 64, 130]], lines: ['DET ER', 'BÆRENDE!'], color: '#F28C28' },
  { file: 'revit', name: 'Revit crashede', tags: '🔥', description: 'Revit crashede igen',
    icons: [['laptop', 40, 30, 190], ['flamme', 182, 12, 100, 10]], lines: ['REVIT', 'CRASHEDE...'], color: '#2F6FD6' },
  { file: 'godkendt', name: 'BR18 godkendt', tags: '✅', description: 'Overholder bygningsreglementet',
    icons: [['hus', 50, 4, 190], ['godkendt', 186, 100, 104]], lines: ['BR18', 'GODKENDT'], color: '#22C55E' },
  { file: 'kaffepause', name: 'Kaffepause', tags: '☕', description: 'Tid til en pause på byggepladsen',
    icons: [['kaffepause', 24, 20, 180], ['byggemester', 176, 70, 120, -8]], lines: ['KAFFEPAUSE!'], color: '#A0622D' },
];

function stickerSvg(s) {
  const icons = s.icons.map(([name, x, y, size, rot = 0]) =>
    `<g transform="rotate(${rot} ${x + size / 2} ${y + size / 2})"><svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 128 128" overflow="visible">${ICONS[name]}</svg></g>`).join('');
  const fs1 = 46, ys = s.lines.length === 1 ? [282] : [250, 298];
  const text = s.lines.map((l, k) => {
    const fit = l.length * fs1 * 0.72 > 296 ? ' textLength="296" lengthAdjust="spacingAndGlyphs"' : ''; // squeeze long words
    return `<text x="160" y="${ys[k]}" text-anchor="middle"${fit} font-family="Arial Black, Segoe UI Black, sans-serif" font-weight="900" font-size="${fs1}" fill="${s.color}" stroke="${O}" stroke-width="7" paint-order="stroke" stroke-linejoin="round">${l}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" width="320" height="320">
<filter id="kant" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="6" result="d"/>
<feFlood flood-color="#fff"/><feComposite in2="d" operator="in" result="w"/><feMerge><feMergeNode in="w"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<g filter="url(#kant)">${icons}${text}</g></svg>\n`;
}

async function main() {
  for (const s of STICKERS) {
    for (const [name] of s.icons) if (!ICONS[name]) throw new Error('ukendt ikon: ' + name);
    if (s.name.length < 2 || s.name.length > 30) throw new Error('navn skal være 2-30 tegn: ' + s.name);
  }
  fs.mkdirSync(DIR, { recursive: true });
  for (const s of STICKERS) {
    const svgPath = path.join(DIR, s.file + '.svg'), pngPath = path.join(DIR, s.file + '.png');
    fs.writeFileSync(svgPath, stickerSvg(s));
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
      '--window-size=320,320', '--screenshot=' + pngPath, 'file:///' + svgPath.replace(/\\/g, '/')], { stdio: 'ignore' });
    if (fs.statSync(pngPath).size > 512 * 1024) throw new Error('PNG over 512 KB: ' + s.file);
  }
  console.log(`${STICKERS.length} stickers skrevet til ${DIR}`);
  if (process.argv.includes('--no-upload')) return;

  const { DISCORD_TOKEN, DISCORD_GUILD_ID: G } = require('./.mcp.json').mcpServers.discord.env;
  const call = async (method, p, body) => {
    for (;;) {
      const r = await fetch('https://discord.com/api/v10' + p, { method, body, headers: { Authorization: 'Bot ' + DISCORD_TOKEN } });
      if (r.status === 429) { const w = ((await r.json()).retry_after || 1) * 1000 + 100; await new Promise(x => setTimeout(x, w)); continue; }
      const data = await r.json();
      if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(data)}`);
      return data;
    }
  };
  const have = new Set((await call('GET', `/guilds/${G}/stickers`)).map(s => s.name));
  for (const s of STICKERS) {
    if (have.has(s.name)) { console.log('  =', s.name); continue; }
    const form = new FormData(); // stickers are uploaded as multipart, not JSON
    form.append('name', s.name);
    form.append('description', s.description);
    form.append('tags', s.tags);
    form.append('file', new Blob([fs.readFileSync(path.join(DIR, s.file + '.png'))], { type: 'image/png' }), s.file + '.png');
    try { await call('POST', `/guilds/${G}/stickers`, form); console.log('  +', s.name); }
    catch (e) { console.log('  !', s.name, e.message); }
  }
}
main().catch(e => { console.error('FEJL:', e.message); process.exit(1); });
