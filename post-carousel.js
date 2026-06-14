// Postet MEHRERE Bilder als Karussell auf Facebook-Seite + Instagram.
// Alle Bilder muessen unter oeffentlichen URLs liegen.
// CLI: node post-carousel.js --images "url1,url2,..." --caption-file caption.txt [--only fb|ig]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function loadEnv() {
  const f = path.join(__dirname, 'secrets.env');
  if (fs.existsSync(f)) for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const arg = (n, d = null) => { const i = process.argv.indexOf(`--${n}`); return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function gpost(url, params) {
  const r = await fetch(url, { method: 'POST', body: new URLSearchParams(params) });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`${r.status} ${JSON.stringify(j.error || j)}`);
  return j;
}

export async function postFacebookCarousel(V, pageId, token, images, caption) {
  const ids = [];
  for (const url of images) {
    const j = await gpost(`https://graph.facebook.com/${V}/${pageId}/photos`, { url, published: 'false', access_token: token });
    ids.push(j.id);
  }
  const params = { message: caption, access_token: token };
  ids.forEach((id, i) => { params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id }); });
  const post = await gpost(`https://graph.facebook.com/${V}/${pageId}/feed`, params);
  console.log('FB OK  post_id =', post.id);
}

export async function postInstagramCarousel(V, igId, token, images, caption) {
  const children = [];
  for (const url of images) {
    const j = await gpost(`https://graph.facebook.com/${V}/${igId}/media`, { image_url: url, is_carousel_item: 'true', access_token: token });
    children.push(j.id);
  }
  const cont = await gpost(`https://graph.facebook.com/${V}/${igId}/media`, {
    media_type: 'CAROUSEL', caption, children: children.join(','), access_token: token,
  });
  await wait(3000); // Container kurz verarbeiten lassen
  const pub = await gpost(`https://graph.facebook.com/${V}/${igId}/media_publish`, { creation_id: cont.id, access_token: token });
  console.log('IG OK  media_id =', pub.id);
}

async function main() {
  loadEnv();
  const V = process.env.META_GRAPH_VERSION || 'v21.0';
  const pageId = process.env.META_PAGE_ID, token = process.env.META_PAGE_TOKEN, igId = process.env.META_IG_USER_ID;
  const images = (arg('images') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const caption = arg('caption-file') ? fs.readFileSync(arg('caption-file'), 'utf8') : (arg('caption') || '');
  const only = arg('only');
  if (images.length < 2) throw new Error('Mindestens 2 Bild-URLs noetig (--images "u1,u2,...")');

  if (only !== 'ig') await postFacebookCarousel(V, pageId, token, images, caption);
  if (only !== 'fb') await postInstagramCarousel(V, igId, token, images, caption);
}
if (process.argv[1] && process.argv[1].endsWith('post-carousel.js')) {
  main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
}
