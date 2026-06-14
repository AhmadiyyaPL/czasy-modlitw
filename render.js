import * as adhan from 'adhan';
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- EXACT config mirrored from czas-modlitwy-standalone.html (khutba.alislam.pl) ---
const CONFIG = { fajrOffsetMinutes: 90, ishaAngle: 17, madhab: 'shafi' };
const CITY = { label: 'Warszawa', lat: 52.2297, lon: 21.0122, tz: 'Europe/Warsaw' };

function calcParams() {
  const p = adhan.CalculationMethod.MuslimWorldLeague();
  p.ishaAngle = CONFIG.ishaAngle;
  p.madhab = CONFIG.madhab === 'hanafi' ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;
  p.highLatitudeRule = adhan.HighLatitudeRule.SeventhOfTheNight;
  return p;
}
function cityYMD(tz, offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { y: +p.year, m: +p.month, d: +p.day };
}
const fmt = (date) => new Intl.DateTimeFormat('pl-PL', { timeZone: CITY.tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(date);

// Tabular Islamic (Hijri) date
function toHijri(gy, gm, gd) {
  const a = Math.floor((14 - gm) / 12), y = gy + 4800 - a, m = gm + 12 * a - 3;
  let jd = gd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  let l = jd - 1948440 + 10632;
  const n = Math.floor((l - 1) / 10631); l = l - 10631 * n + 354;
  const j = Math.floor((10985 - l) / 5316) * Math.floor((50 * l) / 17719) + Math.floor(l / 5670) * Math.floor((43 * l) / 15238);
  l = l - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const month = Math.floor((24 * l) / 709), day = l - Math.floor((709 * month) / 24), year = 30 * n + j - 30;
  const months = ['Muharram', 'Safar', 'Rabi al-Awwal', 'Rabi as-Sani', 'Dżumada al-Ula', 'Dżumada as-Sani', 'Radżab', 'Szaban', 'Ramadan', 'Szawwal', 'Zu al-Kada', 'Zu al-Hidżdża'];
  return `${day} ${months[month - 1]} ${year}`;
}

function computeDay(offset = 0) {
  const { y, m, d } = cityYMD(CITY.tz, offset);
  const pt = new adhan.PrayerTimes(new adhan.Coordinates(CITY.lat, CITY.lon), new Date(y, m - 1, d, 12), calcParams());
  const fajr = new Date(pt.sunrise.getTime() - CONFIG.fajrOffsetMinutes * 60000);
  const noon = new Date(y, m - 1, d, 12);
  const dateLabel = new Intl.DateTimeFormat('pl-PL', { timeZone: CITY.tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(noon);
  return {
    ymd: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    dateLabel, hijri: toHijri(y, m, d),
    rows: [
      { name: 'Fadżr', time: fmt(fajr), muted: false },
      { name: 'Zuhr', time: fmt(pt.dhuhr), muted: false },
      { name: 'Asar', time: fmt(pt.asr), muted: false },
      { name: 'Maghrib', time: fmt(pt.maghrib), muted: false },
      { name: 'Isza', time: fmt(pt.isha), muted: false },
    ],
  };
}

function buildHTML(data, logoDataUri) {
  const rowsHtml = data.rows.map((r, i) => {
    const last = i === data.rows.length - 1;
    const nameColor = r.muted ? '#9AA8A0' : '#22332A';
    const timeColor = r.muted ? '#9AA8A0' : '#15603A';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 30px;${last ? '' : 'border-bottom:1px solid #E1EEE6;'}">
      <span style="font-size:35px;font-weight:500;color:${nameColor};">${r.name}</span>
      <span style="font-size:39px;font-weight:700;color:${timeColor};font-variant-numeric:tabular-nums;letter-spacing:1px;">${r.time}</span>
    </div>`;
  }).join('');

  return `<!doctype html><html><head><meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Open Sans','Segoe UI',system-ui,-apple-system,sans-serif;}
  </style></head><body>
  <div style="width:1080px;height:1080px;background:#FFFFFF;padding:48px 64px;display:flex;flex-direction:column;">
    <div style="text-align:center;">
      <img src="${logoDataUri}" style="width:132px;height:132px;display:inline-block;"/>
      <div style="font-size:60px;font-weight:700;color:#15603A;margin-top:12px;letter-spacing:0.5px;">Czasy modlitw</div>
      <div style="font-size:30px;font-weight:600;color:#2E8B57;letter-spacing:7px;margin-top:8px;">WARSZAWA</div>
      <div style="font-size:25px;color:#5A6B60;margin-top:16px;">${data.dateLabel}</div>
      <div style="font-size:21px;color:#A6AFA8;margin-top:3px;">${data.hijri}</div>
    </div>
    <div style="flex:1;display:flex;align-items:center;margin:18px 0;">
      <div style="width:100%;background:#F1F8F3;border:1px solid #DDEBE1;border-radius:26px;padding:8px 14px;">
        ${rowsHtml}
      </div>
    </div>
    <div style="background:#15603A;border-radius:20px;padding:22px 26px;text-align:center;">
      <div style="font-size:25px;font-weight:600;color:#FFFFFF;">Stowarzyszenie Muzułmańskie Ahmadiyya</div>
      <div style="font-size:21px;color:#C7E3D2;margin-top:7px;">Inne miasta → khutba.alislam.pl/czas-modlitwy</div>
    </div>
  </div>
  </body></html>`;
}

async function main() {
  // node render.js [startOffset] [count]   e.g. "0 7" = today + next 6 days
  const start = Number(process.argv[2] || 0);
  const count = Number(process.argv[3] || 1);

  const logoBuf = fs.readFileSync(path.join(__dirname, 'logo.jpg'));
  const logoDataUri = `data:image/jpeg;base64,${logoBuf.toString('base64')}`;

  const outDir = path.join(__dirname, 'out');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });

  const written = [];
  for (let k = 0; k < count; k++) {
    const data = computeDay(start + k);
    const html = buildHTML(data, logoDataUri);
    const outFile = path.join(outDir, `czasy-${data.ymd}.png`);
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: outFile, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    written.push({ ymd: data.ymd, dateLabel: data.dateLabel, file: outFile });
    console.log('WROTE', outFile);
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(written, null, 2));
  console.log('OK', written.length, 'images');
}
main();
