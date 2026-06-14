// Holt aus EINEM kurzlebigen User-Token automatisch:
//  - langlebigen Seiten-Token (laeuft nicht ab)
//  - Page-ID
//  - Instagram-Business-ID
// und schreibt sie in secrets.env.
// Voraussetzung in secrets.env: META_APP_ID, META_APP_SECRET, META_USER_TOKEN_SHORT
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV = path.join(__dirname, 'secrets.env');
const V = 'v21.0';

function readEnv() {
  const o = {};
  if (fs.existsSync(ENV)) for (const l of fs.readFileSync(ENV, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m) o[m[1]] = m[2];
  }
  return o;
}
function upsertEnv(updates) {
  let lines = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8').split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(updates)) {
    const i = lines.findIndex((l) => l.match(new RegExp(`^\\s*${k}\\s*=`)));
    if (i !== -1) lines[i] = `${k}=${v}`; else lines.push(`${k}=${v}`);
  }
  fs.writeFileSync(ENV, lines.join('\n'));
}
async function g(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(JSON.stringify(j.error || j));
  return j;
}

async function main() {
  const e = readEnv();
  for (const k of ['META_APP_ID', 'META_APP_SECRET', 'META_USER_TOKEN_SHORT'])
    if (!e[k]) throw new Error(`Fehlt in secrets.env: ${k}`);

  // 1) kurzlebigen -> langlebigen User-Token tauschen
  const ll = await g(`https://graph.facebook.com/${V}/oauth/access_token?grant_type=fb_exchange_token` +
    `&client_id=${e.META_APP_ID}&client_secret=${e.META_APP_SECRET}&fb_exchange_token=${e.META_USER_TOKEN_SHORT}`);
  const userLong = ll.access_token;

  // 2) Seiten des Nutzers holen (Page-Token daraus ist langlebig)
  const acc = await g(`https://graph.facebook.com/${V}/me/accounts?fields=name,access_token&access_token=${userLong}`);
  if (!acc.data || !acc.data.length) throw new Error('Keine Facebook-Seite gefunden (ist der Nutzer Admin der Seite?)');
  if (acc.data.length > 1) {
    console.log('Mehrere Seiten gefunden:');
    acc.data.forEach((p, i) => console.log(`  [${i}] ${p.name} (${p.id})`));
    console.log('Setze META_PAGE_PICK=<index> in secrets.env und starte erneut.');
  }
  const pick = e.META_PAGE_PICK ? Number(e.META_PAGE_PICK) : 0;
  const page = acc.data[pick];

  // 3) Instagram-Business-Konto der Seite holen
  const ig = await g(`https://graph.facebook.com/${V}/${page.id}?fields=instagram_business_account{id,username}&access_token=${page.access_token}`);
  const igId = ig.instagram_business_account ? ig.instagram_business_account.id : '';
  const igName = ig.instagram_business_account ? ig.instagram_business_account.username : '(keins verknuepft!)';

  upsertEnv({
    META_PAGE_ID: page.id,
    META_PAGE_TOKEN: page.access_token,
    META_IG_USER_ID: igId,
    META_GRAPH_VERSION: V,
  });

  console.log('\nFERTIG & gespeichert in secrets.env:');
  console.log('  Facebook-Seite :', page.name, `(${page.id})`);
  console.log('  Instagram      :', igName, igId ? `(${igId})` : '');
  console.log('  Seiten-Token   : gespeichert (langlebig)');
  if (!igId) console.log('\nWARNUNG: Kein Instagram-Business-Konto an der Seite gefunden. IG-Verknuepfung pruefen.');
}
main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
