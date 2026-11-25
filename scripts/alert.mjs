// Avvisi Telegram per le nuove aste che corrispondono alle ricerche salvate.
// Va eseguito dopo fetch-pvp.mjs. Legge (tutto da variabili d'ambiente / Secrets di GitHub):
//   ALERTS              JSON con una o più ricerche, es.
//                       [{"nome":"Ascoli","tipo":"IMMOBILI","provincia":"Ascoli Piceno","prezzoMax":150000}]
//                       Campi possibili: nome, tipo, categoria, regione, provincia, comune,
//                       centro [lat,lng] + raggioKm, prezzoMin, prezzoMax, parole
//   TELEGRAM_BOT_TOKEN  token del bot (da @BotFather)
//   TELEGRAM_CHAT_ID    il tuo ID Telegram (da @userinfobot)
// Senza token/chat stampa solo il riepilogo (prova a secco). Le ricerche non vengono mai stampate nei log.
// Le aste già viste sono salvate in state/visti.json (solo ID numerici pubblici del PVP).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DATA = process.argv[2] || 'site/data';
const STATE = 'state/visti.json';
const FILES = ['immobili', 'mobili', 'aziende', 'crediti', 'altro'];
const { ALERTS, TELEGRAM_BOT_TOKEN: TOKEN, TELEGRAM_CHAT_ID: CHAT, GITHUB_REPOSITORY } = process.env;
const SITO = GITHUB_REPOSITORY ? `https://${GITHUB_REPOSITORY.split('/')[0].toLowerCase()}.github.io/${GITHUB_REPOSITORY.split('/')[1]}/` : 'http://localhost:5173/';

const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const km = (a, b, c, d) => { const r = Math.PI / 180, x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 12742 * Math.asin(Math.sqrt(x)); };
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const eur = n => n == null ? 'n.d.' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const pretty = s => s ? s.toLowerCase().replace(/_/g, ' ').replace(/^altra categoria.*/, 'altra categoria').replace(/^\w/, c => c.toUpperCase()) : '';

function corrisponde(x, a) {
  if (a.tipo && x.t !== a.tipo) return false;
  if (a.categoria && x.c !== a.categoria) return false;
  if (a.regione && norm(x.r) !== norm(a.regione)) return false;
  if (a.provincia && norm(x.pr) !== norm(a.provincia)) return false;
  if (a.comune && !norm(x.ci).includes(norm(a.comune))) return false;
  if (a.prezzoMin != null && (x.p ?? 0) < a.prezzoMin) return false;
  if (a.prezzoMax != null && (x.p == null || x.p > a.prezzoMax)) return false;
  if (a.centro) { if (x.la == null || km(a.centro[0], a.centro[1], x.la, x.lo) > (a.raggioKm || 25)) return false; }
  if (a.parole) {
    const hay = norm([x.d, x.ci, x.pr, x.v, pretty(x.c), ...(x.s || []).map(pretty)].join(' '));
    if (!norm(a.parole).split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  return true;
}

// Link al sito con la stessa ricerca già impostata
function linkSito(a) {
  const p = new URLSearchParams();
  if (a.tipo) p.set('tipo', a.tipo);
  if (a.categoria) p.set('categoria', a.categoria);
  if (a.parole) p.set('q', a.parole);
  if (a.prezzoMin != null) p.set('pmin', a.prezzoMin);
  if (a.prezzoMax != null) p.set('pmax', a.prezzoMax);
  if (a.regione || a.provincia || a.comune) {
    p.set('dove', 'regione');
    if (a.regione) p.set('regione', a.regione);
    if (a.provincia) p.set('provincia', a.provincia);
    if (a.comune) p.set('comune', a.comune);
  }
  return SITO + (p.toString() ? '?' + p : '');
}

const ANTEPRIMA = process.env.ALERT_PREVIEW === '1'; // solo per prove in locale: stampa i messaggi invece di inviarli

async function telegram(text) {
  if (ANTEPRIMA) { console.log('----- messaggio -----\n' + text); return; }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.ok) throw new Error(`Telegram: ${j.description || 'HTTP ' + res.status}`);
  await new Promise(r => setTimeout(r, 1100)); // limiti di invio di Telegram
}

// Telegram accetta al massimo 4096 caratteri per messaggio: divido in blocchi
async function inviaBlocchi(intestazione, righe, coda) {
  let buf = intestazione;
  for (const r of righe) {
    if ((buf + '\n\n' + r).length > 3800) { await telegram(buf); buf = '(continua)'; }
    buf += '\n\n' + r;
  }
  await telegram(buf + (coda ? '\n\n' + coda : ''));
}

function riga(x) {
  const d = x.dt ? new Date(x.dt) : null;
  const quando = d ? d.toLocaleString('it-IT', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : 'data n.d.';
  const desc = (x.d || pretty(x.c)).slice(0, 160);
  return `🏠 <b>${esc(eur(x.p))}</b>${x.o && x.o !== x.p ? ` (offerta min. ${esc(eur(x.o))})` : ''} · ${esc(x.ci || 'comune n.d.')}\n` +
    `${esc(desc)}${(x.d || '').length > 160 ? '…' : ''}\n` +
    `📅 Asta: ${esc(quando)}${x.di ? ' · ' + esc(x.di) : ''}\n` +
    `<a href="https://pvp.giustizia.it/pvp/it/detail_annuncio.page?idAnnuncio=${x.i}">Apri annuncio ufficiale</a>`;
}

// ---- main ----
let ricerche = [];
try { ricerche = ALERTS ? JSON.parse(ALERTS) : []; } catch { console.error('ALERTS non è un JSON valido: nessun avviso inviato.'); process.exit(0); }
if (!Array.isArray(ricerche)) ricerche = [ricerche];

const tutti = (await Promise.all(FILES.map(async f => { try { return JSON.parse(await readFile(join(DATA, f + '.json'), 'utf8')); } catch { return []; } }))).flat();
if (tutti.length < 1000) { console.error(`Solo ${tutti.length} aste nei dati: salto gli avvisi per sicurezza.`); process.exit(0); }

let visti = null;
try { visti = new Set(JSON.parse(await readFile(STATE, 'utf8'))); } catch { /* prima esecuzione */ }
const primaVolta = visti === null;
const invio = Boolean(TOKEN && CHAT) || ANTEPRIMA;

for (const [n, a] of ricerche.entries()) {
  const nome = a.nome || `Ricerca ${n + 1}`;
  const match = tutti.filter(x => corrisponde(x, a)).sort((p, q) => (p.dt || '9').localeCompare(q.dt || '9'));
  const nuove = primaVolta ? [] : match.filter(x => !visti.has(x.i));
  console.log(`Ricerca ${n + 1}: ${match.length} aste corrispondenti, ${nuove.length} nuove${primaVolta ? ' (prima esecuzione)' : ''}`);
  if (!invio) continue;
  try {
    if (primaVolta) {
      await telegram(`✅ <b>Avvisi attivi: ${esc(nome)}</b>\nOggi ci sono <b>${match.length}</b> aste che corrispondono alla ricerca.\nD'ora in poi riceverai un messaggio solo per quelle <b>nuove</b>.\n\n<a href="${esc(linkSito(a))}">Vedi le aste attuali sul sito</a>`);
    } else if (nuove.length) {
      await inviaBlocchi(`🔔 <b>${nuove.length} ${nuove.length === 1 ? 'nuova asta' : 'nuove aste'} · ${esc(nome)}</b>`, nuove.map(riga), `<a href="${esc(linkSito(a))}">Tutte le aste di questa ricerca</a>`);
    }
  } catch (e) { console.error(`Ricerca ${n + 1}: invio non riuscito (${e.message})`); process.exitCode = 1; }
}
if (!invio) console.log('TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID mancanti: prova a secco, nessun messaggio inviato.');

// Aggiorno l'elenco delle aste viste solo se tutti gli invii sono riusciti, così non perdo avvisi
if (invio && !ANTEPRIMA && !process.exitCode) {
  await mkdir('state', { recursive: true });
  await writeFile(STATE, JSON.stringify(tutti.map(x => x.i).sort((a, b) => a - b)));
}
