// Findet die neueste Khutba auf khutba.alislam.pl und liest den Inhalt aus.
import { parse } from 'node-html-parser';

const BASE = 'https://khutba.alislam.pl';
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];

function plDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
const stripEmoji = (s) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️‍]/gu, '');
function clean(html) {
  return stripEmoji(String(html)
    .replace(/<sup[^>]*>(.*?)<\/sup>/gi, ' ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    .replace(/\s+/g, ' ').trim();
}
const stripTagsKeepSup = (html) => stripEmoji(String(html).replace(/<(?!\/?sup)[^>]+>/gi, '')).replace(/\s+/g, ' ').trim();

async function latestDate() {
  const html = await (await fetch(BASE + '/')).text();
  const dates = [...html.matchAll(/khutby\/khutba_(\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
  if (!dates.length) throw new Error('Keine Khutba-Links auf der Startseite gefunden');
  return dates.sort().at(-1);
}

export async function scrapeLatest() {
  const ymd = await latestDate();
  const url = `${BASE}/khutby/khutba_${ymd}`;
  const root = parse(await (await fetch(url)).text());

  const titleEl = root.querySelector('h1');
  const titleHtml = stripTagsKeepSup(titleEl.innerHTML);

  const summary = root.querySelectorAll('#panel-streszczenie h2').map((h) => {
    h.querySelector('.ico')?.remove();
    return { t: clean(h.innerHTML) };
  }).filter((x) => x.t);

  const tasks = root.querySelectorAll('#panel-nauki .act-card').map((c) => ({
    t: clean(c.querySelector('h3')?.innerHTML || ''),
    s: clean(c.querySelector('p')?.innerHTML || ''),
  })).filter((x) => x.t);

  const q0 = root.querySelector('#panel-quiz .quiz-q');
  const qText = clean(q0.querySelector('.q-text')?.innerHTML || '').replace(/^\d+\.\s*/, '');
  const options = q0.querySelectorAll('.quiz-opt').map((b) => {
    b.querySelector('.opt-letter')?.remove();
    return clean(b.innerHTML);
  }).slice(0, 3);

  const kid = root.querySelector('#panel-dzieci .kids-story');
  const kidTitle = (() => { const h = kid?.querySelector('h3'); h?.querySelector('.k-emoji')?.remove(); return clean(h?.innerHTML || ''); })();
  let kidText = (kid?.querySelectorAll('p') || []).map((p) => clean(p.innerHTML)).filter(Boolean).join(' ');
  if (kidText.length > 320) kidText = kidText.slice(0, 317).replace(/\s+\S*$/, '') + '...';

  return { ymd, date: plDate(ymd), url, titleHtml, summary, tasks, quiz: { q: qText, options }, kids: { title: kidTitle, text: kidText } };
}

if (process.argv[1] && process.argv[1].endsWith('khutba-scrape.js')) {
  scrapeLatest().then((d) => console.log(JSON.stringify(d, null, 2))).catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
}
