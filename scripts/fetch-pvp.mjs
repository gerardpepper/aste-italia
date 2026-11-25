// Scarica tutte le aste attive dal Portale delle Vendite Pubbliche e le salva in JSON compatti.
// Uso:  node scripts/fetch-pvp.mjs [cartella_output] [max_geocodifiche]
//       default: site/data, 400
// Gira in GitHub Actions a orari fissi; si può lanciare anche a mano.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REGIONE_DI } from '../site/province.js';

const ENDPOINT = 'https://pvp.giustizia.it/ric-496b258c-986a1b71/ric-ms/ricerca/vendite';
const TIPI = ['IMMOBILI', 'MOBILI', 'AZIENDE', 'CREDITI', 'ALTRO'];
const PAGE_SIZE = 200;
const PAUSA_MS = 700; // pausa tra richieste, per non sovraccaricare il portale
const OUT = process.argv[2] || 'site/data';
const MAX_GEO = Number(process.argv[3] ?? 400);
const GEOCACHE = 'geo/comuni.json';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const cityKey = x => `${(x.ci || '').trim().toLowerCase()}|${(x.pr || '').trim().toLowerCase()}`;
const round = n => Math.round(n * 1e5) / 1e5;
// Riquadro geografico dell'Italia: coordinate fuori da qui sono errori di inserimento nel PVP
const inItalia = (la, lo) => la != null && lo != null && la > 35.2 && la < 47.2 && lo > 6.5 && lo < 18.6;

async function pagina(tipo, page, tentativo = 1) {
  const qs = new URLSearchParams({ language: 'it', page: String(page), size: String(PAGE_SIZE) });
  qs.append('sort', 'dataOraVendita,asc');
  qs.append('sort', 'id,asc'); // ordinamento stabile tra le pagine
  try {
    const res = await fetch(`${ENDPOINT}?${qs}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'aste-italia/1.0 (aggiornamento periodico)' },
      body: JSON.stringify({ tipoLotto: tipo, flagRicerca: 0, coordIndirizzo: '', raggioIndirizzo: '25', filtroAnnunci: 1 }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).body;
  } catch (e) {
    if (tentativo >= 4) throw new Error(`${tipo} pagina ${page}: ${e.message}`);
    await sleep(3000 * tentativo);
    return pagina(tipo, page, tentativo + 1);
  }
}

const DISP = { LIBER: 'Libero', OCCUP: 'Occupato', OCCST: 'Occupato senza titolo', INCOR: 'In corso di liberazione' };

// Formato compatto: chiavi corte per ridurre la dimensione dei file
function compatta(c) {
  const ind = c.indirizzo || {};
  const prov = ind.provincia || null;
  const tr = c.tribunale ? c.tribunale.replace(/^Tribunale di /i, '') : null;
  const la = ind.coordinate?.latitudine ?? null, lo = ind.coordinate?.longitudine ?? null;
  const coordOk = inItalia(la, lo);
  return {
    i: c.id,
    t: c.tipoLotto,
    c: c.categoriaLotto,
    s: c.categoriaBene || [],
    d: (c.descLotto || '').replace(/\s+/g, ' ').trim().slice(0, 400),
    p: c.prezzoBaseAsta || null,
    o: c.offertaMinima || null,
    ci: ind.citta || null,
    pr: prov,
    // regione dalla provincia; in mancanza, dalla sede del tribunale (se è un capoluogo)
    r: (prov && REGIONE_DI[norm(prov)]) || (tr && REGIONE_DI[norm(tr)]) || null,
    v: ind.via ? ind.via.slice(0, 120) : null,
    la: coordOk ? la : null,
    lo: coordOk ? lo : null,
    dt: c.dataOraVendita || null,
    tr,
    di: [...new Set(c.disponibilita || [])].map(x => DISP[x]).filter(Boolean).join(', ') || null,
  };
}

// --- 1. Scarico ---
const oggi = new Date().toISOString().slice(0, 10);
const perTipo = {};
for (const tipo of TIPI) {
  const visti = new Map();
  let page = 0, totPages = 1;
  do {
    const b = await pagina(tipo, page);
    totPages = b.totalPages ?? 0;
    for (const c of b.content || []) visti.set(c.id, compatta(c));
    page++;
    await sleep(PAUSA_MS);
  } while (page < totPages);
  perTipo[tipo] = [...visti.values()].filter(x => !x.dt || x.dt.slice(0, 10) >= oggi);
  console.log(`${tipo}: ${perTipo[tipo].length} aste (${page} pagine)`);
}
const tutti = Object.values(perTipo).flat();

// --- 2. Coordinate mancanti: prima media degli annunci dello stesso comune, poi geocoder con cache ---
const somme = {};
for (const x of tutti) if (x.la != null && x.ci) {
  const s = somme[cityKey(x)] ??= { la: 0, lo: 0, n: 0 };
  s.la += x.la; s.lo += x.lo; s.n++;
}
let cache = {};
try { cache = JSON.parse(await readFile(GEOCACHE, 'utf8')); } catch { /* prima esecuzione */ }

async function geocodifica(ci, pr) {
  const qs = new URLSearchParams({ city: ci, countrycodes: 'it', format: 'json', limit: '1', 'accept-language': 'it' });
  if (pr) qs.set('county', pr);
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, {
    headers: { 'User-Agent': 'aste-italia/1.0 (geocodifica comuni, con cache)' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
  const j = await res.json();
  if (j[0] && inItalia(+j[0].lat, +j[0].lon)) return [round(+j[0].lat), round(+j[0].lon)];
  if (pr) { await sleep(1100); return geocodifica(ci, null); } // riprova senza provincia
  return null;
}

let daComune = 0, daCache = 0, nuove = 0;
const daCercare = new Set();
for (const x of tutti) {
  if (x.la != null || !x.ci) continue;
  const k = cityKey(x), s = somme[k];
  if (s) { x.la = round(s.la / s.n); x.lo = round(s.lo / s.n); x.ap = 1; daComune++; }
  else if (k in cache) { if (cache[k]) { [x.la, x.lo] = cache[k]; x.ap = 1; daCache++; } }
  else daCercare.add(k);
}
for (const k of [...daCercare].slice(0, MAX_GEO)) {
  const [ci, pr] = k.split('|');
  try { cache[k] = await geocodifica(ci, pr); nuove++; }
  catch (e) { console.warn('Geocodifica interrotta:', e.message); break; }
  await sleep(1100); // limite d'uso Nominatim: max 1 richiesta al secondo
}
for (const x of tutti) if (x.la == null && x.ci && cache[cityKey(x)]) { [x.la, x.lo] = cache[cityKey(x)]; x.ap = 1; }
await mkdir('geo', { recursive: true });
await writeFile(GEOCACHE, JSON.stringify(cache, Object.keys(cache).sort(), 0).replace(/],"/g, '],\n"'));
console.log(`Coordinate: ${daComune} dal comune, ${daCache} da cache, ${nuove} nuove geocodifiche, ${Math.max(0, daCercare.size - nuove)} comuni rimandati al prossimo giro`);

// --- 3. Scrivo ---
await mkdir(OUT, { recursive: true });
const meta = { aggiornato: new Date().toISOString(), fonte: 'pvp.giustizia.it', tipi: {}, senzaPosizione: tutti.filter(x => x.la == null).length };
for (const [tipo, items] of Object.entries(perTipo)) {
  await writeFile(join(OUT, `${tipo.toLowerCase()}.json`), JSON.stringify(items));
  meta.tipi[tipo] = items.length;
}
await writeFile(join(OUT, 'meta.json'), JSON.stringify(meta, null, 1));
console.log('Fatto:', meta);
