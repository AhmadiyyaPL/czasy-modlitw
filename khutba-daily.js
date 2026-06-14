// Taeglicher Khutba-Check: neueste Khutba finden, und falls neu (noch nicht gepostet)
// -> Karussell rendern, oeffentlich ablegen, auf FB + IG posten, Status merken.
// ENV: GUARD=khutba (nur 13:xx Warschau) · DRY_RUN=1 (nicht posten/Status nicht merken)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeLatest } from './khutba-scrape.js';
import { renderCarousel } from './khutba-render.js';
import { postFacebookCarousel, postInstagramCarousel } from './post-carousel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TZ = 'Europe/Warsaw';
const STATE = path.join(__dirname, 'khutba-state.json');

function loadEnv() {
  const f = path.join(__dirname, 'secrets.env');
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const plainTitle = (html) => html.replace(/<sup[^>]*>(.*?)<\/sup>/gi, ' ($1)').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

async function uploadCatbox(file) {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', new Blob([fs.readFileSync(file)]), path.basename(file));
  return (await (await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd })).text()).trim();
}

async function publishImages(files) {
  if (!process.env.GITHUB_ACTIONS) return Promise.all(files.map(uploadCatbox));
  const pubDir = path.join(__dirname, 'obrazy');
  fs.mkdirSync(pubDir, { recursive: true });
  for (const f of files) fs.copyFileSync(f, path.join(pubDir, path.basename(f)));
  execSync('git config user.name "Ahmadiyya PL Automation"', { cwd: __dirname });
  execSync('git config user.email "automation@ahmadiyya.pl"', { cwd: __dirname });
  execSync('git add obrazy', { cwd: __dirname });
  try { execSync('git commit -m "Khutba: obrazy karuzeli"', { cwd: __dirname, stdio: 'inherit' }); } catch {}
  try { execSync('git push', { cwd: __dirname, stdio: 'inherit' }); }
  catch { execSync('git pull --rebase', { cwd: __dirname }); execSync('git push', { cwd: __dirname, stdio: 'inherit' }); }
  const repo = process.env.GITHUB_REPOSITORY;
  const urls = files.map((f) => `https://raw.githubusercontent.com/${repo}/main/obrazy/${path.basename(f)}`);
  for (const u of urls) { for (let i = 0; i < 20; i++) { try { if ((await fetch(u, { method: 'HEAD' })).ok) break; } catch {} await wait(3000); } }
  return urls;
}

function saveState(ymd) {
  fs.writeFileSync(STATE, JSON.stringify({ lastYmd: ymd, postedAt: new Date().toISOString() }, null, 2));
  if (process.env.GITHUB_ACTIONS) {
    execSync('git add khutba-state.json', { cwd: __dirname });
    try { execSync(`git commit -m "Khutba: zapisano stan ${ymd}"`, { cwd: __dirname, stdio: 'inherit' }); } catch {}
    try { execSync('git push', { cwd: __dirname, stdio: 'inherit' }); }
    catch { execSync('git pull --rebase', { cwd: __dirname }); execSync('git push', { cwd: __dirname, stdio: 'inherit' }); }
  }
}

async function main() {
  loadEnv();
  if (process.env.GUARD === 'khutba') {
    const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
    if (h !== 13) { console.log(`Warschau ${h}:xx — nicht 13 Uhr, ueberspringe.`); return; }
  }

  const kh = await scrapeLatest();
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : {};
  if (state.lastYmd && kh.ymd <= state.lastYmd) {
    console.log(`Keine neue Khutba (neueste ${kh.ymd}, bereits gepostet ${state.lastYmd}).`);
    return;
  }
  console.log('Neue Khutba gefunden:', kh.ymd, '-', plainTitle(kh.titleHtml));

  const files = await renderCarousel(kh, path.join(__dirname, 'out'));
  const urls = await publishImages(files);
  console.log('Bilder online:', urls.length);

  const caption =
    `📖 Kazanie piątkowe — ${kh.date}\n${plainTitle(kh.titleHtml)}\n\n` +
    `W tym tygodniu: streszczenie, część dla dzieci, quiz i zadania na cały tydzień. 🤲\n\n` +
    `👉 khutba.alislam.pl\n\n#Ahmadiyya #Islam #Kazanie #Khutba #Warszawa`;
  fs.writeFileSync(path.join(__dirname, 'khutba-caption.txt'), caption);

  if (process.env.DRY_RUN === '1') {
    console.log('DRY_RUN — nicht gepostet. Karussell + URLs bereit fuer', kh.ymd);
    return;
  }
  const V = process.env.META_GRAPH_VERSION || 'v21.0';
  const pageId = process.env.META_PAGE_ID, token = process.env.META_PAGE_TOKEN, igId = process.env.META_IG_USER_ID;
  await postFacebookCarousel(V, pageId, token, urls, caption);
  await postInstagramCarousel(V, igId, token, urls, caption);
  saveState(kh.ymd);
  console.log('Khutba gepostet & Status gespeichert:', kh.ymd);
}
main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
