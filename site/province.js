// Provincia → Regione. Chiavi normalizzate (minuscolo, senza accenti/spazi/punteggiatura).
const P = {
  'Abruzzo': ["Chieti", "L'Aquila", 'Pescara', 'Teramo'],
  'Basilicata': ['Matera', 'Potenza'],
  'Calabria': ['Catanzaro', 'Cosenza', 'Crotone', 'Reggio Calabria', 'Reggio di Calabria', 'Vibo Valentia'],
  'Campania': ['Avellino', 'Benevento', 'Caserta', 'Napoli', 'Salerno'],
  'Emilia-Romagna': ['Bologna', 'Ferrara', 'Forlì-Cesena', 'Forli', 'Modena', 'Parma', 'Piacenza', 'Ravenna', "Reggio nell'Emilia", 'Reggio Emilia', 'Rimini'],
  'Friuli-Venezia Giulia': ['Gorizia', 'Pordenone', 'Trieste', 'Udine'],
  'Lazio': ['Frosinone', 'Latina', 'Rieti', 'Roma', 'Viterbo'],
  'Liguria': ['Genova', 'Imperia', 'La Spezia', 'Savona'],
  'Lombardia': ['Bergamo', 'Brescia', 'Como', 'Cremona', 'Lecco', 'Lodi', 'Mantova', 'Milano', 'Monza e della Brianza', 'Monza e Brianza', 'Monza', 'Pavia', 'Sondrio', 'Varese'],
  'Marche': ['Ancona', 'Ascoli Piceno', 'Fermo', 'Macerata', 'Pesaro e Urbino', 'Pesaro-Urbino', 'Pesaro'],
  'Molise': ['Campobasso', 'Isernia'],
  'Piemonte': ['Alessandria', 'Asti', 'Biella', 'Cuneo', 'Novara', 'Torino', 'Verbano-Cusio-Ossola', 'Verbania', 'Vercelli'],
  'Puglia': ['Bari', 'Barletta-Andria-Trani', 'Barletta', 'Brindisi', 'Foggia', 'Lecce', 'Taranto'],
  'Sardegna': ['Cagliari', 'Nuoro', 'Oristano', 'Sassari', 'Sud Sardegna', 'Carbonia-Iglesias', 'Medio Campidano', 'Ogliastra', 'Olbia-Tempio', 'Gallura Nord-Est Sardegna', 'Sulcis Iglesiente'],
  'Sicilia': ['Agrigento', 'Caltanissetta', 'Catania', 'Enna', 'Messina', 'Palermo', 'Ragusa', 'Siracusa', 'Trapani'],
  'Toscana': ['Arezzo', 'Firenze', 'Grosseto', 'Livorno', 'Lucca', 'Massa-Carrara', 'Massa Carrara', 'Pisa', 'Pistoia', 'Prato', 'Siena'],
  'Trentino-Alto Adige': ['Bolzano', 'Bolzano/Bozen', 'Bozen', 'Trento'],
  'Umbria': ['Perugia', 'Terni'],
  "Valle d'Aosta": ['Aosta', "Valle d'Aosta", "Valle d'Aosta/Vallée d'Aoste"],
  'Veneto': ['Belluno', 'Padova', 'Rovigo', 'Treviso', 'Venezia', 'Verona', 'Vicenza'],
};
const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
export const REGIONE_DI = {};
for (const [reg, list] of Object.entries(P)) for (const p of list) REGIONE_DI[norm(p)] = reg;
export const REGIONI = Object.keys(P);
