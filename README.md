# Aste Italia

Tutte le aste giudiziarie attive in Italia (immobili, veicoli, macchinari, arredi, aziende, crediti, marchi e brevetti) in un'unica pagina, con filtri per:

- **territorio**: regione, provincia, comune, oppure raggio in km da una città o dalla tua posizione
- **cosa**: tipo di bene, categoria, parole chiave
- **prezzo** base d'asta e **data** dell'asta

Ogni ricerca resta nell'indirizzo della pagina, quindi la puoi salvare nei preferiti o condividere.

## Come funziona

Non serve nessun server o hosting: è tutto su GitHub.

1. **GitHub Actions** (`.github/workflows/aggiorna.yml`) ogni 6 ore esegue `scripts/fetch-pvp.mjs`, che scarica tutte le aste attive dal [Portale delle Vendite Pubbliche](https://pvp.giustizia.it/pvp/) del Ministero della Giustizia e le salva in file JSON compatti.
2. Per gli annunci senza coordinate GPS la posizione viene stimata dal comune (media degli altri annunci dello stesso comune, oppure geocodifica OpenStreetMap/Nominatim). I risultati del geocoder sono salvati in `geo/comuni.json`, così ogni comune viene cercato una volta sola.
3. Il sito (`site/`) viene pubblicato su **GitHub Pages**. Filtri, ordinamento e mappa girano interamente nel browser.

Per aggiornare subito i dati: tab **Actions** → *Aggiorna aste e pubblica* → **Run workflow**.

## In locale

Richiede Node.js 20+ e nessuna dipendenza.

```
node scripts/fetch-pvp.mjs      # scarica i dati in site/data
node scripts/serve.mjs          # apre il sito su http://localhost:5173
```

## Note

- I dati sono degli annunci pubblici del PVP; l'annuncio ufficiale, linkato da ogni scheda, è l'unico riferimento valido.
- Il PVP non ha un'API pubblica documentata: lo script usa la stessa ricerca che il sito usa nel browser e potrebbe dover essere adattato se il portale cambia.
- Le posizioni stimate dal comune sono segnate in grigio sulla mappa.
