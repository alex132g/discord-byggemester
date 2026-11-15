// Custom server emojis: writes SVG icons to "Billeder og Årsplan/icons", renders 128x128 PNGs with Chrome
// (Discord only accepts PNG/GIF/JPG emojis) and uploads the ones the server doesn't have yet.
// Usage: node emojis.js [--no-upload]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const DIR = path.join(__dirname, 'Billeder og Årsplan', 'icons');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const O = '#14213D'; // outline colour used by every icon
const ln = `stroke="${O}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"`;
// double stroke = thick outlined line (dark under, colour on top)
const thick = (d, color, w = 12) =>
  `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 8}" stroke-linecap="round" stroke-linejoin="round"/>`
  + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

const ICONS = {
  hjelm: `<path d="M18 86C18 46 40 26 64 26s46 20 46 60Z" fill="#FFC83D" ${ln}/>
    <path d="M54 30v54M74 30v54" stroke="#E0A800" stroke-width="7"/>
    <rect x="8" y="80" width="112" height="20" rx="10" fill="#FFC83D" ${ln}/>`,
  hammer: `<g transform="rotate(-40 64 64)"><rect x="55" y="42" width="18" height="80" rx="7" fill="#C98A4B" ${ln}/>
    <path d="M26 16h62a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H26c-6 0-10-6-10-16s4-16 10-16Z" fill="#9AA4B2" ${ln}/></g>`,
  energi: `<polygon points="76,6 24,72 58,72 46,122 104,50 68,50 88,6" fill="#FFC83D" ${ln}/>`,
  hus: `<rect x="26" y="58" width="76" height="56" fill="#F4F1EA" ${ln}/>
    <rect x="56" y="80" width="20" height="34" fill="#C98A4B" ${ln}/>
    <rect x="34" y="68" width="16" height="16" fill="#7CC4FA" stroke="${O}" stroke-width="5"/>
    <polygon points="10,64 64,16 118,64" fill="#E5484D" ${ln}/>`,
  mursten: `<rect x="8" y="22" width="112" height="84" rx="6" fill="#D9623B" ${ln}/>
    <path d="M11 50h106M11 78h106M40 25v25M88 25v25M64 50v28M24 78v25M104 78v25" stroke="#F4E3D7" stroke-width="5"/>
    <rect x="8" y="22" width="112" height="84" rx="6" fill="none" ${ln}/>`,
  spaer: thick('M12 100 L64 24 L116 100 Z', '#C98A4B', 11) + thick('M64 24 V100 M38 100 L64 62 L90 100', '#E0B07A', 8),
  tommestok: thick('M14 104 L44 36 L76 104 L108 36', '#FFC83D', 16)
    + `<path d="M24 92l6 3M32 74l6 3M54 60l6-3M62 78l6-3M86 92l6-3M94 74l6-3" stroke="${O}" stroke-width="4"/>`,
  vaterpas: `<rect x="6" y="46" width="116" height="36" rx="8" fill="#FFC83D" ${ln}/>
    <rect x="46" y="52" width="36" height="24" rx="12" fill="#9BE07A" stroke="${O}" stroke-width="5"/>
    <circle cx="64" cy="64" r="6" fill="#fff"/><path d="M56 52v24M72 52v24" stroke="${O}" stroke-width="3"/>
    <circle cx="20" cy="64" r="5" fill="${O}"/><circle cx="108" cy="64" r="5" fill="${O}"/>`,
  skrue: `<circle cx="64" cy="64" r="50" fill="#B8C2CF" ${ln}/><circle cx="64" cy="64" r="38" fill="#D5DCE5"/>
    <path d="M64 34v60M34 64h60" stroke="${O}" stroke-width="14" stroke-linecap="round"/>`,
  sav: `<path d="M36 34 L122 78 L114 98 L36 62 Z" fill="#C9D1DB" ${ln}/>
    <path d="M40 62l6 8 6-4 6 8 6-4 6 8 6-4 6 8 6-4 6 8 6-4 6 8" fill="none" stroke="${O}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M6 28h34v44H14Z" fill="#C98A4B" ${ln}/><rect x="16" y="40" width="14" height="18" rx="6" fill="#7A4A22"/>`,
  kran: `<rect x="34" y="30" width="18" height="88" fill="#FFC83D" ${ln}/>
    <path d="M36 46l14 14M50 46l-14 14M36 76l14 14M50 76l-14 14" stroke="${O}" stroke-width="4"/>
    <rect x="8" y="20" width="112" height="14" fill="#FFC83D" ${ln}/><rect x="52" y="34" width="20" height="16" fill="#F28C28" ${ln}/>
    <path d="M100 34v38" stroke="${O}" stroke-width="4"/><path d="M100 72c0 10-12 10-12 2" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
    <rect x="22" y="112" width="44" height="10" rx="3" fill="#9AA4B2" ${ln}/>`,
  tegning: `<rect x="12" y="16" width="104" height="96" rx="8" fill="#2F6FD6" ${ln}/>
    <path d="M28 34h72v58H28Z M28 60h40v32 M68 34v18 M84 60h16 M46 92v-14" fill="none" stroke="#fff" stroke-width="4"/>
    <path d="M90 100l14-14" stroke="#fff" stroke-width="3" stroke-dasharray="4 3"/>`,
  model3d: `<polygon points="64,12 112,38 64,64 16,38" fill="#7CC4FA" ${ln}/>
    <polygon points="16,38 64,64 64,118 16,92" fill="#2F6FD6" ${ln}/><polygon points="112,38 64,64 64,118 112,92" fill="#1D4E9E" ${ln}/>`,
  uvaerdi: `<rect x="8" y="8" width="112" height="112" rx="26" fill="#F28C28" ${ln}/>
    <text x="64" y="92" text-anchor="middle" font-family="Arial Black, Segoe UI, sans-serif" font-weight="900" font-size="78" fill="#fff" stroke="${O}" stroke-width="3">U</text>`,
  termometer: `<rect x="50" y="10" width="28" height="82" rx="14" fill="#fff" ${ln}/><circle cx="64" cy="98" r="22" fill="#E5484D" ${ln}/>
    <rect x="58" y="40" width="12" height="58" fill="#E5484D"/><path d="M78 30h10M78 46h10M78 62h10" stroke="${O}" stroke-width="4"/>`,
  solcelle: `<circle cx="100" cy="26" r="16" fill="#FFC83D" ${ln}/>
    <polygon points="28,54 108,54 120,110 8,110" fill="#2F6FD6" ${ln}/>
    <path d="M18 82h92M54 54l-6 56M82 54l6 56" stroke="#9EC5FF" stroke-width="4"/>
    <polygon points="28,54 108,54 120,110 8,110" fill="none" ${ln}/>`,
  vindmoelle: `<path d="M58 60h12l6 62H52Z" fill="#E9EEF5" ${ln}/>
    <g fill="#fff" stroke="${O}" stroke-width="5" stroke-linejoin="round">
      <path d="M64 56 L58 8 Q64 4 70 8 Z"/><path d="M64 56 L58 8 Q64 4 70 8 Z" transform="rotate(120 64 56)"/>
      <path d="M64 56 L58 8 Q64 4 70 8 Z" transform="rotate(240 64 56)"/></g>
    <circle cx="64" cy="56" r="9" fill="#9AA4B2" ${ln}/>`,
  deadline: `<rect x="14" y="20" width="100" height="96" rx="10" fill="#fff" ${ln}/>
    <path d="M14 30a10 10 0 0 1 10-10h80a10 10 0 0 1 10 10v16H14Z" fill="#E5484D" ${ln}/>
    <path d="M40 10v20M88 10v20" stroke="${O}" stroke-width="8" stroke-linecap="round"/>
    <rect x="58" y="56" width="12" height="34" rx="6" fill="#E5484D"/><circle cx="64" cy="102" r="7" fill="#E5484D"/>`,
  godkendt: `<circle cx="64" cy="64" r="54" fill="#22C55E" ${ln}/>
    <path d="M36 66l18 18 38-40" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`,
  afvist: `<circle cx="64" cy="64" r="54" fill="#E5484D" ${ln}/>
    <path d="M42 42l44 44M86 42l-44 44" stroke="#fff" stroke-width="14" stroke-linecap="round"/>`,
  byggemester: `<circle cx="64" cy="74" r="44" fill="#FFD7A8" ${ln}/>
    <circle cx="48" cy="76" r="6" fill="${O}"/><circle cx="80" cy="76" r="6" fill="${O}"/>
    <path d="M46 94q18 14 36 0" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
    <path d="M24 58C24 28 42 14 64 14s40 14 40 44Z" fill="#FFC83D" ${ln}/><rect x="12" y="52" width="104" height="14" rx="7" fill="#FFC83D" ${ln}/>
    <polygon points="68,22 56,40 64,40 58,52 72,34 64,34 70,22" fill="#1D3B6B"/>`,
  kaffepause: `<path d="M22 50h66v42a20 20 0 0 1-20 20H42a20 20 0 0 1-20-20Z" fill="#fff" ${ln}/>
    <path d="M88 60h8a14 14 0 0 1 0 28h-10" fill="none" ${ln}/><rect x="28" y="56" width="54" height="10" fill="#7A4A22"/>
    <path d="M40 40c-6-8 6-12 0-22M56 40c-6-8 6-12 0-22M72 40c-6-8 6-12 0-22" fill="none" stroke="#9AA4B2" stroke-width="5" stroke-linecap="round"/>`,
  stige: thick('M36 8 L28 120 M92 8 L100 120', '#F28C28', 10) + thick('M34 30H94 M32 58H96 M30 86H98 M28 112H100', '#F28C28', 7),
  planke: `<rect x="8" y="38" width="112" height="52" rx="6" fill="#E0B07A" ${ln}/>
    <path d="M18 52c20-6 40 6 60 0s28-4 32 0M18 72c22 6 44-6 66 0 10 2 18 2 26-2" fill="none" stroke="#B07A45" stroke-width="4"/>
    <ellipse cx="52" cy="62" rx="10" ry="6" fill="none" stroke="#B07A45" stroke-width="4"/>`,
  beton: `<polygon points="14,40 64,16 114,40 64,64" fill="#C5CBD3" ${ln}/>
    <polygon points="14,40 64,64 64,114 14,90" fill="#9AA4B2" ${ln}/><polygon points="114,40 64,64 64,114 114,90" fill="#7D8794" ${ln}/>
    <g fill="#5B6573"><circle cx="30" cy="62" r="3"/><circle cx="44" cy="80" r="4"/><circle cx="28" cy="84" r="2.5"/>
    <circle cx="84" cy="74" r="3"/><circle cx="98" cy="62" r="4"/><circle cx="92" cy="92" r="2.5"/>
    <circle cx="54" cy="34" r="3"/><circle cx="76" cy="40" r="2.5"/></g>`,
  isolering: `<rect x="10" y="26" width="108" height="76" rx="14" fill="#FFB3C7" ${ln}/>
    <path d="M18 46q12-10 23 0t23 0 23 0 23 0M18 64q12-10 23 0t23 0 23 0 23 0M18 82q12-10 23 0t23 0 23 0 23 0" fill="none" stroke="#E8708F" stroke-width="5" stroke-linecap="round"/>`,
  ide: `<path d="M64 14a36 36 0 0 1 22 64c-4 4-6 8-6 14H48c0-6-2-10-6-14a36 36 0 0 1 22-64Z" fill="#FFE066" ${ln}/>
    <rect x="46" y="92" width="36" height="22" rx="6" fill="#9AA4B2" ${ln}/><path d="M48 103h32" stroke="${O}" stroke-width="4"/>
    <path d="M10 44h10M108 44h10M22 14l8 8M106 14l-8 8" stroke="#FFC83D" stroke-width="7" stroke-linecap="round"/>`,
  grin: `<circle cx="64" cy="70" r="50" fill="#FFD43B" ${ln}/>
    <path d="M38 64q8-10 16 0M74 64q8-10 16 0" fill="none" stroke="${O}" stroke-width="6" stroke-linecap="round"/>
    <path d="M36 80h56a28 28 0 0 1-56 0Z" fill="#fff" ${ln}/>
    <path d="M22 50C22 22 40 10 64 10s42 12 42 40Z" fill="#FFC83D" ${ln}/><rect x="12" y="44" width="104" height="12" rx="6" fill="#FFC83D" ${ln}/>`,
};

const svg = inner => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">${inner}</svg>\n`;

async function main() {
  // names must be 2-32 chars of letters, digits or _ (Discord rule)
  for (const name of Object.keys(ICONS)) if (!/^\w{2,32}$/.test(name)) throw new Error('ugyldigt navn: ' + name);
  fs.mkdirSync(DIR, { recursive: true });
  for (const [name, inner] of Object.entries(ICONS)) {
    const s = path.join(DIR, name + '.svg'), p = path.join(DIR, name + '.png');
    fs.writeFileSync(s, svg(inner));
    execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
      '--window-size=128,128', '--screenshot=' + p, 'file:///' + s.replace(/\\/g, '/')], { stdio: 'ignore' });
    if (!fs.existsSync(p)) throw new Error('PNG blev ikke lavet: ' + name);
  }
  console.log(`${Object.keys(ICONS).length} ikoner skrevet til ${DIR}`);
  if (process.argv.includes('--no-upload')) return;

  const { DISCORD_TOKEN, DISCORD_GUILD_ID: G } = require('./.mcp.json').mcpServers.discord.env;
  const api = async (method, p, body) => {
    for (;;) {
      const r = await fetch('https://discord.com/api/v10' + p, { method, body: body && JSON.stringify(body),
        headers: { Authorization: 'Bot ' + DISCORD_TOKEN, 'Content-Type': 'application/json' } });
      if (r.status === 429) { const w = ((await r.json()).retry_after || 1) * 1000 + 100; await new Promise(s => setTimeout(s, w)); continue; }
      const data = await r.json();
      if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(data)}`);
      return data;
    }
  };
  const have = new Set((await api('GET', `/guilds/${G}/emojis`)).map(e => e.name));
  for (const name of Object.keys(ICONS)) {
    if (have.has(name)) { console.log('  =', name); continue; }
    const image = 'data:image/png;base64,' + fs.readFileSync(path.join(DIR, name + '.png')).toString('base64');
    try { await api('POST', `/guilds/${G}/emojis`, { name, image }); console.log('  +', name); }
    catch (e) { console.log('  !', name, e.message); }
  }
}
main().catch(e => { console.error('FEJL:', e.message); process.exit(1); });
