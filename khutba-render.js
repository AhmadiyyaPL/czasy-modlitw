// Rendert ein Khutba-Karussell (6 Slides, 1080x1080) im gruenen Marken-Stil
// aus einem gescrapten Khutba-Objekt (siehe khutba-scrape.js).
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrapeLatest } from './khutba-scrape.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const G_DARK = '#15603A', G_MED = '#2E8B57', G_SOFT = '#F1F8F3', G_LINE = '#DDEBE1';
const SPEAKER = 'Hazrat Mirza Masroor Ahmad (aba)';

function head() {
  return `<head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box;font-family:'Open Sans','Segoe UI',sans-serif;}sup{font-size:.5em;}</style></head>`;
}
const frame = (inner) => `<!doctype html><html>${head()}<body><div style="width:1080px;height:1080px;background:#fff;display:flex;flex-direction:column;">${inner}</div></body></html>`;
const eyebrow = (t) => `<div style="font-size:24px;font-weight:700;letter-spacing:5px;color:${G_MED};">${t}</div>`;
function topbar(logo, section, date) {
  return `<div style="display:flex;align-items:center;gap:18px;padding:54px 70px 0;">
    <img src="${logo}" style="width:66px;height:66px;"/>
    <div>${eyebrow(section)}<div style="font-size:19px;color:#8A968E;margin-top:2px;">Kazanie piątkowe · ${date}</div></div>
  </div><div style="height:3px;background:${G_LINE};margin:22px 70px 0;"></div>`;
}
function footer(page, total) {
  const dots = Array.from({ length: total }, (_, i) => `<span style="width:9px;height:9px;border-radius:50%;background:${i === page - 1 ? G_DARK : G_LINE};display:inline-block;"></span>`).join('');
  return `<div style="display:flex;align-items:center;justify-content:space-between;padding:0 70px 50px;">
    <div style="font-size:21px;font-weight:700;color:${G_DARK};">khutba.alislam.pl</div>
    <div style="display:flex;gap:8px;align-items:center;">${dots}</div></div>`;
}

const slideCover = (kh, logo) => frame(`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:70px;">
  <img src="${logo}" style="width:140px;height:140px;"/>
  <div style="margin-top:26px;">${eyebrow('KAZANIE PIĄTKOWE')}</div>
  <div style="font-size:26px;color:#8A968E;margin-top:10px;">${kh.date}</div>
  <div style="font-size:56px;font-weight:800;color:${G_DARK};line-height:1.18;margin-top:28px;max-width:900px;">${kh.titleHtml}</div>
  <div style="font-size:27px;color:${G_MED};font-weight:600;margin-top:24px;">${SPEAKER}</div>
  <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:38px;">
    ${['Streszczenie', 'Dla dzieci', 'Quiz', 'Zadania'].map((t) => `<span style="background:${G_SOFT};border:1px solid ${G_LINE};color:${G_DARK};font-size:22px;font-weight:600;padding:10px 22px;border-radius:30px;">${t}</span>`).join('')}
  </div>
  <div style="font-size:23px;color:#A6AFA8;margin-top:42px;">Przesuń, aby zobaczyć więcej →</div>
</div>`);

function slideList(kh, logo, opts) {
  const rows = opts.items.map((it, i) => `<div style="display:flex;align-items:flex-start;gap:20px;padding:15px 0;${i < opts.items.length - 1 ? `border-bottom:1px solid ${G_LINE};` : ''}">
    <div style="flex:none;width:46px;height:46px;border-radius:50%;background:${G_DARK};color:#fff;font-size:24px;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</div>
    <div><div style="font-size:30px;font-weight:700;color:#22332A;line-height:1.25;">${it.t}</div>
    ${it.s ? `<div style="font-size:22px;color:#5A6B60;margin-top:4px;line-height:1.3;">${it.s}</div>` : ''}</div></div>`).join('');
  return frame(`${topbar(logo, opts.section, kh.date)}
    <div style="flex:1;display:flex;align-items:center;padding:10px 70px;"><div style="width:100%;">${rows}</div></div>
    ${footer(opts.page, 6)}`);
}

const slideKids = (kh, logo) => frame(`${topbar(logo, 'DLA DZIECI', kh.date)}
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:20px 70px;">
    <div style="background:${G_SOFT};border:1px solid ${G_LINE};border-radius:26px;padding:44px;">
      <div style="font-size:33px;font-weight:800;color:${G_DARK};line-height:1.25;">${kh.kids.title}</div>
      <div style="font-size:27px;color:#22332A;line-height:1.5;margin-top:22px;">${kh.kids.text}</div>
    </div>
    <div style="font-size:24px;color:#8A968E;margin-top:26px;text-align:center;">...więcej historii i zadań dla dzieci na stronie</div>
  </div>${footer(3, 6)}`);

function slideQuiz(kh, logo) {
  const opts = kh.quiz.options.map((o, i) => `<div style="display:flex;align-items:center;gap:18px;background:${G_SOFT};border:1px solid ${G_LINE};border-radius:16px;padding:18px 24px;margin-top:14px;">
    <div style="flex:none;width:42px;height:42px;border-radius:50%;background:#fff;border:2px solid ${G_MED};color:${G_DARK};font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;">${'ABC'[i]}</div>
    <div style="font-size:24px;color:#22332A;line-height:1.3;">${o}</div></div>`).join('');
  return frame(`${topbar(logo, 'QUIZ', kh.date)}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:10px 70px;">
      <div style="font-size:24px;color:${G_MED};font-weight:700;">Pytanie 1 z 10</div>
      <div style="font-size:33px;font-weight:700;color:#22332A;line-height:1.3;margin-top:12px;">${kh.quiz.q}</div>
      ${opts}
      <div style="font-size:24px;color:#8A968E;margin-top:24px;text-align:center;">Rozwiąż cały quiz (10 pytań) na stronie →</div>
    </div>${footer(4, 6)}`);
}

const slideCTA = (kh, logo) => frame(`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:70px;">
  <img src="${logo}" style="width:130px;height:130px;"/>
  <div style="font-size:46px;font-weight:800;color:${G_DARK};line-height:1.25;margin-top:34px;max-width:840px;">Przeczytaj całe kazanie</div>
  <div style="background:${G_DARK};color:#fff;font-size:34px;font-weight:700;padding:18px 40px;border-radius:18px;margin-top:34px;">khutba.alislam.pl</div>
  <div style="font-size:25px;color:#5A6B60;margin-top:30px;">Streszczenie · Dla dzieci · Quiz · Plan dla rodzin</div>
  <div style="font-size:23px;color:#8A968E;margin-top:44px;">Stowarzyszenie Muzułmańskie Ahmadiyya</div>
</div>`);

export async function renderCarousel(kh, outDir) {
  const logo = `data:image/jpeg;base64,${fs.readFileSync(path.join(__dirname, 'logo.jpg')).toString('base64')}`;
  const slides = [
    slideCover(kh, logo),
    slideList(kh, logo, { section: 'STRESZCZENIE', items: kh.summary, page: 2 }),
    slideKids(kh, logo),
    slideQuiz(kh, logo),
    slideList(kh, logo, { section: 'ZADANIA NA TEN TYDZIEŃ', items: kh.tasks, page: 5 }),
    slideCTA(kh, logo),
  ];
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1080, deviceScaleFactor: 1 });
  const files = [];
  for (let i = 0; i < slides.length; i++) {
    await page.setContent(slides[i], { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const f = path.join(outDir, `khutba-${kh.ymd}-${i + 1}.png`);
    await page.screenshot({ path: f, type: 'png', clip: { x: 0, y: 0, width: 1080, height: 1080 } });
    files.push(f);
  }
  await browser.close();
  return files;
}

if (process.argv[1] && process.argv[1].endsWith('khutba-render.js')) {
  const kh = await scrapeLatest();
  const files = await renderCarousel(kh, path.join(__dirname, 'out'));
  files.forEach((f) => console.log('WROTE', f));
}
