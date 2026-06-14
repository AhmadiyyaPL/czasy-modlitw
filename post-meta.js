// Postet ein Bild auf die Facebook-Seite UND Instagram (Meta Graph API, kostenlos).
// Beide brauchen eine OEFFENTLICHE Bild-URL (image_url).
// Aufruf: node post-meta.js --image-url "https://..." --caption-file caption.txt
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  // GitHub Actions liefert Werte als echte ENV; lokal lesen wir secrets.env
  const f = path.join(__dirname, 'secrets.env');
  if (fs.existsSync(f)) {
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}
function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
async function gpost(url, params) {
  const body = new URLSearchParams(params);
  const r = await fetch(url, { method: 'POST', body });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(`${r.status} ${JSON.stringify(j.error || j)}`);
  return j;
}

async function postFacebook(V, pageId, token, imageUrl, caption) {
  const j = await gpost(`https://graph.facebook.com/${V}/${pageId}/photos`, {
    url: imageUrl, caption, access_token: token,
  });
  console.log('FB OK  post_id =', j.post_id || j.id);
}

async function postInstagram(V, igId, token, imageUrl, caption) {
  const c = await gpost(`https://graph.facebook.com/${V}/${igId}/media`, {
    image_url: imageUrl, caption, access_token: token,
  });
  const pub = await gpost(`https://graph.facebook.com/${V}/${igId}/media_publish`, {
    creation_id: c.id, access_token: token,
  });
  console.log('IG OK  media_id =', pub.id);
}

async function main() {
  loadEnv();
  const V = process.env.META_GRAPH_VERSION || 'v21.0';
  const pageId = process.env.META_PAGE_ID;
  const token = process.env.META_PAGE_TOKEN;
  const igId = process.env.META_IG_USER_ID;

  const imageUrl = arg('image-url');
  const captionFile = arg('caption-file');
  const caption = captionFile ? fs.readFileSync(captionFile, 'utf8') : (arg('caption') || '');
  const only = arg('only'); // 'fb' | 'ig' | null(beide)

  if (!imageUrl) throw new Error('Fehlt: --image-url "https://..."');
  if (!pageId || !token) throw new Error('Fehlt: META_PAGE_ID / META_PAGE_TOKEN in secrets.env');

  if (only !== 'ig') await postFacebook(V, pageId, token, imageUrl, caption);
  if (only !== 'fb') {
    if (!igId) throw new Error('Fehlt: META_IG_USER_ID in secrets.env');
    await postInstagram(V, igId, token, imageUrl, caption);
  }
}
main().catch((e) => { console.error('FEHLER:', e.message); process.exit(1); });
