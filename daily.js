// Orchestrator fuer den taeglichen Auto-Post (GitHub Actions oder lokal).
// 1) heutiges Bild rendern  2) oeffentlich ablegen  3) Caption bauen  4) auf FB + IG posten
// ENV: GUARD=midnight -> nur posten, wenn es in Warschau gerade 00:xx Uhr ist
//      DRY_RUN=1      -> alles vorbereiten, aber NICHT wirklich posten (zum Testen)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TZ = 'Europe/Warsaw';

// --- Mitternachts-Wache (DST-sicher: Cron feuert 22:00 UTC im Sommer, 23:00 UTC im Winter) ---
if (process.env.GUARD === 'midnight') {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(new Date()));
  if (hour !== 0) {
    console.log(`Warschau ist gerade ${hour}:xx Uhr — kein Mitternachts-Lauf, ueberspringe.`);
    process.exit(0);
  }
}

function todayParts() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { ymd: `${p.year}-${p.month}-${p.day}` };
}
function dateLabel() {
  return new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

async function uploadCatbox(file) {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('fileToUpload', new Blob([fs.readFileSync(file)]), path.basename(file));
  const r = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: fd });
  const url = (await r.text()).trim();
  if (!/^https?:\/\//.test(url)) throw new Error('Catbox-Upload fehlgeschlagen: ' + url);
  return url;
}

async function main() {
  const { ymd } = todayParts();

  // 1) heutiges Bild rendern
  execSync('node render.js 0 1', { cwd: __dirname, stdio: 'inherit' });
  const file = path.join(__dirname, 'out', `czasy-${ymd}.png`);
  if (!fs.existsSync(file)) throw new Error('Bild nicht gefunden: ' + file);

  // 2) Caption (Datum dynamisch; Zeiten stehen im Bild)
  const caption =
    `🕌 Czasy modlitw — Warszawa\n${dateLabel()}\n\n` +
    `📍 Czasy dla innych miast: khutba.alislam.pl/czas-modlitwy\n\n` +
    `#Ahmadiyya #Islam #Warszawa #Modlitwa #CzasModlitwy`;
  const capFile = path.join(__dirname, 'caption.txt');
  fs.writeFileSync(capFile, caption);

  // 3) oeffentlich ablegen
  const url = await uploadCatbox(file);
  console.log('Bild-URL:', url);

  // 4) posten
  if (process.env.DRY_RUN === '1') {
    console.log('DRY_RUN — es wird NICHT gepostet. Alles bereit fuer', ymd);
    return;
  }
  execSync(`node post-meta.js --image-url "${url}" --caption-file "${capFile}"`, { cwd: __dirname, stdio: 'inherit' });
  console.log('Fertig fuer', ymd);
}
main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
