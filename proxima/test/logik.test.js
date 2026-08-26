// Prüft die Logik von proxima.app.html (Parser, Prompt-Bau, Befehle,
// Speicherstände) und die Ladeschale proxima.html gegen einen minimalen
// DOM-Stub. Aufruf: node test/logik.test.js
// Beide Skripte werden direkt aus den HTML-Dateien gezogen, damit der Test nie
// gegen eine veraltete Kopie läuft.
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'proxima.app.html'), 'utf8');
const laderHtml = fs.readFileSync(path.join(__dirname, '..', 'proxima.html'), 'utf8');
const block = html.match(/<script>([\s\S]*)<\/script>/);
if (!block) { console.error('Kein <script>-Block in proxima.app.html gefunden.'); process.exit(1); }
const src = block[1];
const laderBlock = laderHtml.match(/<script>([\s\S]*)<\/script>/);
if (!laderBlock) { console.error('Kein <script>-Block in proxima.html gefunden.'); process.exit(1); }
const laderSrc = laderBlock[1];

function fakeEl(id) {
  return {
    id, value: '', textContent: '', innerHTML: '', className: '', style: {}, disabled: false,
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    appendChild() {}, remove() {}, querySelector() { return fakeEl('sub'); },
    setAttribute() {}, addEventListener() {}, focus() {}, select() {}, onclick: null
  };
}
const store = {};
const ctx = {
  console,
  setTimeout, clearTimeout, setInterval, clearInterval,
  localStorage: {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  },
  document: {
    getElementById: fakeEl,
    createElement: fakeEl,
    createTextNode: (t) => ({ nodeValue: t }),
    querySelectorAll: () => [],
    addEventListener() {}
  },
  window: { open() {}, addEventListener() {} },
  Image: function () { this.src = ''; },
  URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
  fetch: () => Promise.reject(new Error('kein Netz im Test')),
  Date, Math, JSON, Object, Array, String, Number, RegExp, Promise, isNaN, parseInt, parseFloat, encodeURIComponent
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(src, ctx);

let ok = 0, bad = 0;
function pruefe(name, bedingung, extra) {
  if (bedingung) { ok++; console.log('  ok   ' + name); }
  else { bad++; console.log('  FAIL ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('\n— Perchance-Syntax in der Ladeschale —');
// Beim Laden steht nur proxima.html im HTML-Bereich. Diesen Bereich wertet
// Perchance als Vorlage aus: ein eingeklammertes Wort gilt dort als
// Listenverweis und lässt den Generator mit Syntaxfehler abbrechen. Das
// betrifft Attribute, Text UND Kommentare — nur <script> und <style> sind frei.
// proxima.app.html kommt erst zur Laufzeit ins DOM und wird nicht mehr
// abgetastet; dort sind eckige Klammern wieder erlaubt.
const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
const laderMarkup = laderHtml.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
// Entities wie der Browser auflösen: &#91; wird zu [, BEVOR Perchance abtastet.
// Ein Escape im Quelltext hilft hier also nicht — nur der Verzicht auf Klammern.
const dekodiert = laderMarkup
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&lsqb;|&lbrack;/g, '[').replace(/&rsqb;|&rbrack;/g, ']');
const listenVerweise = dekodiert.match(/\[[A-Za-zÄÖÜäöüß_][^\]]*\]/g) || [];
pruefe('keine eckigen Klammern im Start-Markup, auch nicht als Entity', listenVerweise.length === 0, listenVerweise.join(' '));
const inlineWahl = dekodiert.match(/\{[^}]*\}/g) || [];
pruefe('keine geschweiften Klammern im Start-Markup', inlineWahl.length === 0, inlineWahl.join(' '));

// Perchance liest den Klammerinhalt als JS-Ausdruck — auch im <script>-Block.
// ['a','b'] und [i] sind gültiges JavaScript und stören nicht; zwei nackte
// Wörter wie [eckigen Klammern] sind ein Syntaxfehler und legen den
// Generator lahm. In Zeichenketten deshalb \x5B und \x5D schreiben.
const nackteWorte = (laderHtml.match(/\[[^\]\n]*\]/g) || []).filter(k =>
  /^\[\s*[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*(\s+[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*)+\s*\]$/.test(k));
pruefe('keine nackten Wortfolgen in eckigen Klammern (Ladeschale)', nackteWorte.length === 0, nackteWorte.join(' '));
pruefe('Ladeschale zeigt auf proxima.app.html', laderHtml.includes("pfad: 'proxima/proxima.app.html'"));
pruefe('Hinweis auf eckige Klammern bleibt als Wortlaut erhalten', markup.includes('in eckigen Klammern'));
pruefe('Version im Startbildschirm ablesbar', /V\d+\.\d+/.test(markup));

// Schriften von fremden Servern schicken die IP jedes Besuchers dorthin; das
// soll nicht unbemerkt zurueckkommen.
const externeSchrift = /@import\s+url\(\s*['"]?https?:|<link[^>]+fonts\./i;
pruefe('Generator laedt keine externe Schrift', !externeSchrift.test(html), (html.match(externeSchrift) || [''])[0]);
pruefe('Ladeschale laedt keine externe Schrift', !externeSchrift.test(laderHtml), (laderHtml.match(externeSchrift) || [''])[0]);
pruefe('Herkunftsblock steht in den Einstellungen',
  /function herkunftHtml/.test(html) && /herkunftHtml\(\)/.test(html));
pruefe('Datenschutzblock steht in den Einstellungen',
  /function datenschutzHtml/.test(html) && /datenschutzHtml\(\);/.test(html));

console.log('\n— Stapelreihenfolge —');
// Modale müssen über dem Startbildschirm liegen, sonst öffnen sich
// Spielstand- und Einstellungsmenü unsichtbar dahinter.
const css = (html.match(/<style>([\s\S]*)<\/style>/) || ['', ''])[1];
const zIndex = (sel) => {
  const block = css.match(new RegExp(sel.replace(/[.#]/g, '\\$&') + '\\s*\\{[^}]*\\}'));
  const z = block && block[0].match(/z-index:\s*(\d+)/);
  return z ? Number(z[1]) : null;
};
const zStart = zIndex('#start'), zModal = zIndex('.modal');
pruefe('Startbildschirm hat einen z-index', zStart !== null, String(zStart));
pruefe('Modale liegen über dem Startbildschirm', zModal !== null && zModal > zStart, `modal ${zModal} vs start ${zStart}`);

console.log('\n— Version und Herkunft —');
// Der Block in den Einstellungen beantwortet die Frage, welcher Stand laeuft
// und woher er kam — sonst ist bei automatischem Nachladen nicht mehr
// erkennbar, was man vor sich hat.
pruefe('Version im Skript und im Startbildschirm stimmen ueberein',
  markup.includes(ctx.VERSION), ctx.VERSION);
pruefe('die Plugin-Lage steht ohne Ladeschale sauber da', ctx.pluginLage() === 'ohne Ladeschale', ctx.pluginLage());
store['proxima.quelltext'] = JSON.stringify({ zweig: 'main', zeit: Date.now(), text: 'x' });
ctx.window.PROXIMA_LADER = { cfg: {} };
ctx.window.PROXIMA_LADER.version = 'V2';
ctx.window.PROXIMA_LADER.plugins = () => ({ ai: 'direkt vorhanden', image: 'Weiche gesetzt, Plugin noch nicht da' });
const lageMitSchale = ctx.pluginLage();
pruefe('die Plugin-Lage nennt Fassung und Befund',
  lageMitSchale.includes('Ladeschale V2') && lageMitSchale.includes('Weiche gesetzt') && lageMitSchale.includes('ai() '),
  lageMitSchale);
const mitSchale = ctx.herkunftHtml();
pruefe('mit Ladeschale nennt Zweig und Zeitpunkt',
  mitSchale.includes('aus GitHub') && mitSchale.includes('Zweig main') && mitSchale.includes('zuletzt geladen'), mitSchale);
delete ctx.window.PROXIMA_LADER;
const ohneSchale = ctx.herkunftHtml();
pruefe('ohne Ladeschale wird das klar gesagt', ohneSchale.includes('Ohne Ladeschale'), ohneSchale);
pruefe('beide Fassungen nennen die Version',
  mitSchale.includes(ctx.VERSION) && ohneSchale.includes(ctx.VERSION));
delete store['proxima.quelltext'];

console.log('\n— jsonAus —');
pruefe('sauberes JSON', ctx.jsonAus('{"a":1}').a === 1);
pruefe('JSON in Codeblock', ctx.jsonAus('```json\n{"a":2}\n```').a === 2);
pruefe('JSON mit Geschwätz drumherum', ctx.jsonAus('Klar! {"a":3} — viel Spaß.').a === 3);
pruefe('kein JSON → null', ctx.jsonAus('WER: NPC1') === null);
pruefe('kaputtes JSON → null', ctx.jsonAus('{"a":}') === null);

console.log('\n— felderAus (Rückfallebene) —');
const f1 = ctx.felderAus('WER: NPC2\nANTWORT: Na so was.\nSTIMMUNG: heiter\nWEITER: JA');
pruefe('einfache Felder', f1.WER === 'NPC2' && f1.ANTWORT === 'Na so was.' && f1.WEITER === 'JA');
const f2 = ctx.felderAus('**NAME:** Anna\n- ROLLE: Wirtin\n### STADT: Wien');
pruefe('Markdown-Müll wird abgestreift', f2.NAME === 'Anna' && f2.ROLLE === 'Wirtin' && f2.STADT === 'Wien', JSON.stringify(f2));
const f3 = ctx.felderAus('RAHMENHANDLUNG: Erster Satz.\nZweiter Satz folgt.\nDritter auch.\nSTADT: Prag');
pruefe('Umbrüche im Fließtext gehen nicht verloren',
  f3.RAHMENHANDLUNG === 'Erster Satz. Zweiter Satz folgt. Dritter auch.' && f3.STADT === 'Prag', JSON.stringify(f3));
const f4 = ctx.felderAus('ANTWORT: Sie lachte und sagte: das glaube ich nicht.');
pruefe('Doppelpunkt im Satz zerlegt den Wert nicht',
  f4.ANTWORT === 'Sie lachte und sagte: das glaube ich nicht.', JSON.stringify(f4));

console.log('\n— hole / entkleide / einWort —');
pruefe('verschachtelter Zugriff', ctx.hole({ npc: { name: 'Ida' } }, ['npc', 'name'], 'x') === 'Ida');
pruefe('Ersatzwert bei Lücke', ctx.hole({ npc: {} }, ['npc', 'name'], 'x') === 'x');
pruefe('Array wird zusammengefügt', ctx.hole({ a: ['x', 'y'] }, ['a'], '') === 'x, y');
pruefe('Anführungszeichen weg', ctx.entkleide('"Hallo"') === 'Hallo');
pruefe('ein Wort aus Satzrest', ctx.einWort('Heiter, gelöst.') === 'heiter');

console.log('\n— Gedächtnis —');
ctx.S.fakten = [];
ctx.merkeFakt('Ida hat einen Bruder.');
ctx.merkeFakt('Ida hat einen Bruder.');
ctx.merkeFakt('keine');
ctx.merkeFakt('Es regnet seit Tagen.');
pruefe('Doubletten und Leerfakten gefiltert', ctx.S.fakten.length === 2, JSON.stringify(ctx.S.fakten));
for (let i = 0; i < 40; i++) ctx.merkeFakt('Fakt Nummer ' + i);
pruefe('Gedächtnis gedeckelt', ctx.S.fakten.length === ctx.MAX_FAKTEN);

console.log('\n— Bildprompt —');
ctx.W.npcs = [{ name: 'Ida', rolle: 'Wirtin', aussehen: 'a woman in her forties, sharp green eyes.', kleidung: 'a linen apron.' }];
ctx.S.stimmung = ['heiter']; ctx.S.kleidung = ['a linen apron.'];
ctx.W.protagonist = { name: 'Egon', aussehen: '', kleidung: '' };
ctx.S.szeneGlobal = 'a candlelit tavern';
ctx.S.stil = ''; ctx.S.stilLabel = '';
let p = ctx.bauePrompt({ szene: 'she pours wine, medium shot' });
pruefe('Identität steht vorn', p.indexOf('a woman in her forties') === 0, p.slice(0, 60));
pruefe('Outfit angehängt', p.includes('wearing a linen apron'));
pruefe('Kulisse enthalten', p.includes('Setting: a candlelit tavern'));
pruefe('Szene enthalten', p.includes('Scene: she pours wine'));
pruefe('eine Figur → single character', p.includes('single character'));
ctx.W.npcs.push({ name: 'Bo', rolle: 'Gast', aussehen: 'an old man', kleidung: 'a coat' });
ctx.S.stimmung.push('müde'); ctx.S.kleidung.push('a coat');
p = ctx.bauePrompt({});
pruefe('zwei Figuren → 2 distinct characters', p.includes('2 distinct characters'), p.slice(-90));
pruefe('Figuren mit AND verbunden', p.includes(' AND '));

console.log('\n— Prompt-Kürzung mit Budget —');
// Der Stil steht am Ende des Prompts. Blindes Abschneiden entfernt genau ihn,
// und das Bild sieht dann völlig anders aus als bei einer Quelle ohne Grenze.
ctx.W.npcs = [
  { name: 'Ida', rolle: 'Wirtin', aussehen: 'a woman in her forties with sharp green eyes, freckles across the nose, unruly copper hair tied back loosely, tall and broad-shouldered, an old scar along her left jaw'.repeat(3), kleidung: 'a heavy linen apron over a patched woolen dress, brass rings on every finger'.repeat(2) },
  { name: 'Bo', rolle: 'Gast', aussehen: 'an elderly man, deeply lined face, thin white beard, stooped posture, milky left eye'.repeat(3), kleidung: 'a threadbare travelling coat and muddy boots'.repeat(2) }
];
ctx.S.stimmung = ['heiter', 'müde'];
ctx.S.kleidung = [ctx.W.npcs[0].kleidung, ctx.W.npcs[1].kleidung];
ctx.S.szeneGlobal = 'a dim candlelit tavern with low wooden beams and rain against the windows';
ctx.S.stil = ctx.STILE.manga; ctx.S.stilLabel = 'manga';
const lang = ctx.bauePrompt({ szene: 'she leans over the table pouring wine while he watches, medium shot, warm candlelight' });
pruefe('ohne Grenze bleibt der Prompt vollständig', lang.length > 1200, String(lang.length));
const kurz = ctx.bauePrompt({ szene: 'she leans over the table pouring wine while he watches, medium shot, warm candlelight' }, 1200);
pruefe('mit Grenze wird das Budget eingehalten', kurz.length <= 1200, String(kurz.length));
pruefe('Stil überlebt die Kürzung', kurz.includes('anime manga style'), kurz.slice(-120));
pruefe('Bildaufbau überlebt die Kürzung', kurz.includes('comic panel composition'));
pruefe('Figurenzahl überlebt die Kürzung', kurz.includes('2 distinct characters'));
pruefe('Identität ist noch vertreten', kurz.includes('a woman in her forties'));
pruefe('Szene ist noch vertreten', kurz.includes('Scene:') || kurz.includes('Setting:'));
pruefe('kein Wort mittendrin zerrissen', !/[a-zäöü]\.\.\.$/.test(kurz));
// Extremfall: winziges Budget darf nicht zu Bruchstücken führen
const winzig = ctx.bauePrompt({ szene: 'x' }, 120);
pruefe('auch bei winzigem Budget bleibt der Stil erhalten', winzig.includes('anime manga style'));

console.log('\n— Eigener Prompt überlebt den Quellenwechsel —');
// Stellt nach, was beim Umschalten zwischen den Engines passiert: zeichneBild
// baut normalerweise neu aus der Szene — ein von Hand geschriebener Prompt
// darf dabei nicht verlorengehen.
const gesendet = [];
const laufen = async () => {
  // Attrappen erst hier setzen, sonst treffen sie die synchronen Tests weiter unten.
  Object.keys(ctx.BILDQUELLEN).forEach(k => {
    ctx.BILDQUELLEN[k].zeichne = async (a) => { gesendet.push({ quelle: k, prompt: a.prompt, negativ: a.negativ }); return 'data:image/png;base64,xx'; };
  });
  ctx.S.imSpiel = true;
  ctx.S.eigenerPrompt = ''; ctx.S.eigenerNegativ = '';
  ctx.CFG.quelle = 'perchance';
  await ctx.zeichneBild({});
  const auto = gesendet.at(-1).prompt;
  pruefe('ohne eigenen Prompt wird aus der Szene gebaut', auto.includes('anime manga style'));

  // Nutzer bearbeitet den Prompt im Bildmenü
  ctx.S.eigenerPrompt = 'ein ganz eigener prompt, handgeschrieben, mit eigenem stil';
  ctx.S.eigenerNegativ = 'nur mein negativ';
  await ctx.zeichneBild({});
  pruefe('eigener Prompt wird verwendet', gesendet.at(-1).prompt === ctx.S.eigenerPrompt);
  pruefe('eigener Negativprompt wird verwendet', gesendet.at(-1).negativ === 'nur mein negativ');

  // Engine-Wechsel — genau hier wurde der Prompt bisher zurückgesetzt
  ctx.CFG.quelle = 'pollinations';
  await ctx.zeichneBild({});
  pruefe('nach Wechsel zu Pollinations bleibt er erhalten', gesendet.at(-1).prompt === ctx.S.eigenerPrompt, gesendet.at(-1).prompt);
  pruefe('Quelle hat tatsächlich gewechselt', gesendet.at(-1).quelle === 'pollinations');
  ctx.CFG.quelle = 'perchance';
  await ctx.zeichneBild({});
  pruefe('und beim Zurückwechseln ebenfalls', gesendet.at(-1).prompt === ctx.S.eigenerPrompt);

  // Zu langer eigener Prompt wird für Quellen mit Grenze gekappt
  ctx.S.eigenerPrompt = 'sehr lang, '.repeat(300);
  ctx.CFG.quelle = 'pollinations';
  await ctx.zeichneBild({});
  pruefe('eigener Prompt respektiert die Längengrenze der Quelle', gesendet.at(-1).prompt.length <= 1200, String(gesendet.at(-1).prompt.length));
  ctx.CFG.quelle = 'perchance';
  await ctx.zeichneBild({});
  pruefe('ohne Grenze bleibt er ungekürzt', gesendet.at(-1).prompt.length > 1200);

  // Zurück zur Automatik
  ctx.S.eigenerPrompt = ''; ctx.S.eigenerNegativ = '';
  await ctx.zeichneBild({});
  pruefe('nach dem Zurücksetzen greift wieder die Szene', gesendet.at(-1).prompt.includes('anime manga style'));

  console.log('\n— Bildtakt gegen festgehaltenen Prompt —');
  // Ein bearbeiteter Prompt darf den Wechsel der Bildquelle überleben, aber das
  // Bild nicht für immer einfrieren — sonst zeigt der Generator ewig dasselbe.
  ctx.CFG.bildTakt = 1;
  ctx.S.eigenerPrompt = 'mein prompt'; ctx.S.eigenerNegativ = ''; ctx.S.promptFesthalten = false;
  ctx.S.bildZaehler = 0;
  const vorher = gesendet.length;
  ctx.bildTakt();
  await new Promise(r => setTimeout(r, 30));
  pruefe('ohne Haken übernimmt beim Bildtakt wieder die Handlung', ctx.S.eigenerPrompt === '');
  pruefe('und es wird tatsächlich neu gezeichnet', gesendet.length > vorher);

  ctx.S.eigenerPrompt = 'mein prompt'; ctx.S.promptFesthalten = true; ctx.S.bildZaehler = 0;
  const vorher2 = gesendet.length;
  ctx.bildTakt();
  await new Promise(r => setTimeout(r, 30));
  pruefe('mit Haken bleibt der Prompt stehen', ctx.S.eigenerPrompt === 'mein prompt');
  pruefe('und es wird keine gleiche Anfrage wiederholt', gesendet.length === vorher2);

  // Der Quellenwechsel muss ihn in beiden Fällen weiterreichen
  ctx.CFG.quelle = 'pollinations';
  await ctx.zeichneBild({});
  pruefe('Quellenwechsel reicht den festgehaltenen Prompt weiter', gesendet.at(-1).prompt === 'mein prompt');
  ctx.CFG.quelle = 'perchance';
  ctx.S.eigenerPrompt = ''; ctx.S.promptFesthalten = false; ctx.CFG.bildTakt = 2;

  console.log('\n— Modell-Listen der Dienste —');
  // Die Listen kommen vom jeweiligen Dienst. Pollinations antwortet mal mit
  // Namen, mal mit Objekten; die Horde liefert Rechnerzahlen zum Sortieren.
  const antworte = (daten) => { ctx.fetch = async () => ({ ok: true, json: async () => daten }); };

  antworte(['flux', 'turbo', 'kontext']);
  let liste = await ctx.BILDQUELLEN.pollinations.modelle();
  pruefe('Pollinations: reine Namensliste', liste.length === 3 && liste[0].wert === 'flux', JSON.stringify(liste[0]));

  antworte([{ name: 'flux', description: 'schnell' }, { id: 'sdxl' }, { name: '' }]);
  liste = await ctx.BILDQUELLEN.pollinations.modelle();
  pruefe('Pollinations: Objektliste mit Beschreibung', liste.length === 2 && liste[0].label === 'flux — schnell', JSON.stringify(liste));
  pruefe('Pollinations: namenlose Einträge fliegen raus', !liste.some(m => !m.wert));

  antworte([{ name: 'klein', count: 2 }, { name: 'gross', count: 40, queued: 17.4 }, { name: 'mittel', count: 9 }]);
  liste = await ctx.BILDQUELLEN.horde.modelle();
  pruefe('Horde: nach Rechnerzahl sortiert', liste.map(m => m.wert).join(',') === 'gross,mittel,klein', liste.map(m => m.wert).join(','));
  pruefe('Horde: Rechner und Warteschlange im Text', liste[0].label === 'gross — 40 Rechner, 17 wartend', liste[0].label);

  ctx.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
  let fehler = '';
  try { await ctx.BILDQUELLEN.horde.modelle(); } catch (e) { fehler = e.message; }
  pruefe('Fehlerstatus wird gemeldet', /503/.test(fehler), fehler);
  ctx.fetch = () => Promise.reject(new Error('kein Netz im Test'));

  console.log('\n— Besetzung folgt der Handlung —');
  // Kuendigt die Regie jemanden an oder laesst jemanden gehen, soll die
  // Besetzung nachziehen - aber nur, wenn wirklich etwas geschieht.
  ctx.W.npcs = [
    { name: 'Ida Berger', rolle: 'Wirtin', aussehen: 'a', kleidung: 'b', person: 'c', grundstimmung: 'heiter' },
    { name: 'Marcelle', rolle: 'Gast', aussehen: 'd', kleidung: 'e', person: 'f', grundstimmung: 'müde' }
  ];
  ctx.S.stimmung = ['heiter', 'müde']; ctx.S.kleidung = ['b', 'e']; ctx.S.regieAnweisung = ['', ''];
  ctx.S.verlauf = []; ctx.S.imSpiel = true; ctx.CFG.autoBesetzung = true;

  pruefe('Figur am vollen Namen gefunden', ctx.findeNpc('Ida Berger') === 0);
  pruefe('Figur am Vornamen gefunden', ctx.findeNpc('Ida') === 0);
  pruefe('Figur im Satz gefunden', ctx.findeNpc('Marcelle verlässt den Raum') === 1);
  pruefe('Unbekannte ergibt -1', ctx.findeNpc('Konrad') === -1);
  pruefe('Leerangaben werden erkannt', ctx.leerAngabe('') && ctx.leerAngabe('keine') && ctx.leerAngabe('niemand') && ctx.leerAngabe('-'));
  pruefe('echter Name ist keine Leerangabe', !ctx.leerAngabe('Marcelle'));

  await ctx.besetzungAendern({ abgang: 'Marcelle', auftritt: '' });
  pruefe('angekündigter Abgang entfernt die Figur', ctx.W.npcs.length === 1 && ctx.W.npcs[0].name === 'Ida Berger',
    ctx.W.npcs.map(n => n.name).join(','));
  pruefe('Stimmungen und Kleidung ziehen mit', ctx.S.stimmung.length === 1 && ctx.S.kleidung.length === 1);
  pruefe('der Abgang steht im Gedächtnis', ctx.faktenTexte().some(f => /Marcelle/.test(f)), ctx.faktenTexte().slice(-2).join(' | '));

  await ctx.besetzungAendern({ abgang: 'Ida', auftritt: '' });
  pruefe('die letzte Figur bleibt', ctx.W.npcs.length === 1);

  // Auftritt: erscheineNPC fragt die KI, deshalb eine Attrappe
  ctx.ai = () => JSON.stringify({ name: 'Konrad Steiner', rolle: 'Kutscher', aussehen: 'x', kleidung: 'y',
    person: 'z', stimmung: 'neugierig', eroeffnung: 'Verzeihung, ist hier noch frei?' });
  await ctx.besetzungAendern({ abgang: '', auftritt: 'ein Kutscher, der Schutz vor dem Regen sucht' });
  pruefe('angekündigter Auftritt bringt die Figur herein', ctx.W.npcs.length === 2 && ctx.W.npcs[1].name === 'Konrad Steiner',
    ctx.W.npcs.map(n => n.name).join(','));
  pruefe('die neue Figur sagt ihren ersten Satz', ctx.S.verlauf.some(v => /noch frei/.test(v.text || '')));

  const besetzungVorher = ctx.W.npcs.length;
  await ctx.besetzungAendern({ abgang: 'niemand', auftritt: 'keine' });
  pruefe('Leerangaben ändern nichts', ctx.W.npcs.length === besetzungVorher);

  ctx.CFG.autoBesetzung = false;
  await ctx.besetzungAendern({ abgang: 'Konrad', auftritt: '' });
  pruefe('abgeschaltet passiert nichts', ctx.W.npcs.length === besetzungVorher);
  ctx.CFG.autoBesetzung = true;

  console.log('\n— Kleidung folgt der Handlung —');
  // Bisher blieb ein in der Handlung erzaehlter Kleiderwechsel ohne Wirkung:
  // Figurenmenue, Chronik und Bild zeigten weiter das alte Outfit.
  ctx.W.protagonist = { name: 'Julian Voss', herkunft: 'Wien', beruf: 'Apotheker', eigenart: 'summt',
                        aussehen: 'a tall man', kleidung: 'a grey suit' };
  ctx.W.npcs = [
    { name: 'Ida Berger', rolle: 'Wirtin', aussehen: 'a', kleidung: 'a linen apron', person: 'c', grundstimmung: 'heiter' },
    { name: 'Marcelle', rolle: 'Gast', aussehen: 'd', kleidung: 'a travelling coat', person: 'f', grundstimmung: 'müde' }
  ];
  ctx.S.kleidung = ['a linen apron', 'a travelling coat'];
  ctx.S.stimmung = ['heiter', 'müde']; ctx.S.regieAnweisung = ['', ''];

  pruefe('Wechsel wird übernommen', ctx.kleidungAendern('Ida: a red silk dress') === true);
  pruefe('S.kleidung aktualisiert', ctx.S.kleidung[0] === 'a red silk dress', ctx.S.kleidung[0]);
  pruefe('auch am NPC selbst — dadurch im Figurenmenü sichtbar', ctx.W.npcs[0].kleidung === 'a red silk dress', ctx.W.npcs[0].kleidung);
  pruefe('die andere Figur bleibt unberührt', ctx.S.kleidung[1] === 'a travelling coat');

  pruefe('unveränderte Angabe ändert nichts', ctx.kleidungAendern('Ida: a red silk dress') === false);
  pruefe('Groß- und Kleinschreibung zählt dabei nicht', ctx.kleidungAendern('Ida: A RED SILK DRESS') === false);

  pruefe('mehrere auf einmal', ctx.kleidungAendern('Ida: a black cloak; Marcelle: a wet shawl') === true);
  pruefe('beide übernommen', ctx.S.kleidung[0] === 'a black cloak' && ctx.S.kleidung[1] === 'a wet shawl',
    ctx.S.kleidung.join(' | '));

  pruefe('der Held kann sich auch umziehen', ctx.kleidungAendern('Julian: a borrowed evening coat') === true);
  pruefe('beim Helden gespeichert', ctx.W.protagonist.kleidung === 'a borrowed evening coat', ctx.W.protagonist.kleidung);

  pruefe('unbekannter Name wird verworfen', ctx.kleidungAendern('Konrad: a hat') === false);
  pruefe('ohne Doppelpunkt wird verworfen', ctx.kleidungAendern('irgendein Fließtext ohne Trenner') === false);
  pruefe('Leerangabe wird verworfen', ctx.kleidungAendern('Ida: keine') === false);
  pruefe('zu kurze Angabe wird verworfen', ctx.kleidungAendern('Ida: x') === false);

  // Das neue Outfit muss im Bildprompt landen
  ctx.S.szeneGlobal = 'a tavern'; ctx.S.stil = ctx.STILE.manga; ctx.S.stilLabel = 'manga';
  ctx.W.perspektive = 'er';
  const pK = ctx.bauePrompt({ szene: 'they stand together' });
  pruefe('neues Outfit steht im Bildprompt', pK.includes('a black cloak'), pK.slice(0, 120));
  pruefe('altes Outfit ist verschwunden', !pK.includes('a linen apron'));

  console.log('\n— Ort folgt der Handlung —');
  // Genau der gemeldete Fall: die Regie schickt die Figuren in den naechsten
  // Raum. Vorher blieb der Schauplatz stehen und die Erzaehlung lief davon.
  ctx.W.ort = { name: 'Die Taverne', geschichte: 'Ein enger Schankraum.', bildPrompt: 'alt' };
  ctx.S.szeneGlobal = 'a dim tavern';
  ctx.W.npcs = [{ name: 'Ida', rolle: 'Wirtin', aussehen: 'a', kleidung: 'b', person: 'c', grundstimmung: 'heiter' }];
  ctx.S.stimmung = ['heiter']; ctx.S.kleidung = ['b']; ctx.S.regieAnweisung = [''];
  ctx.S.imSpiel = true; ctx.S.ortLaeuft = false; ctx.CFG.autoBesetzung = true;

  ctx.ai = () => JSON.stringify({ name: 'Der Innenhof', geschichte: 'Wilder Wein rankt an den Mauern.',
    kulisse: 'an overgrown courtyard at night, ivy, wet cobblestones', bild: 'they step out into the cool air' });
  await ctx.folgeHandlung({ ortwechsel: 'der verwilderte Innenhof hinter der Küche', abgang: '', auftritt: '' });
  pruefe('Ortsname übernommen', ctx.W.ort.name === 'Der Innenhof', ctx.W.ort.name);
  pruefe('Beschreibung übernommen', /Wilder Wein/.test(ctx.W.ort.geschichte), ctx.W.ort.geschichte);
  pruefe('Kulisse für Bilder mitgewechselt', /overgrown courtyard/.test(ctx.S.szeneGlobal), ctx.S.szeneGlobal);
  pruefe('Ankunftsszene gesetzt', /step out/.test(ctx.S.szeneText), ctx.S.szeneText);
  pruefe('Ortswechsel steht im Gedächtnis', ctx.faktenTexte().some(f => /Innenhof/.test(f)));

  // Der gemeldete Ablauf komplett: Ort wechseln, Alte bleibt zurück, Neue kommt dazu
  ctx.W.npcs.push({ name: 'Marcelle', rolle: 'Gast', aussehen: 'd', kleidung: 'e', person: 'f', grundstimmung: 'müde' });
  ctx.S.stimmung.push('müde'); ctx.S.kleidung.push('e'); ctx.S.regieAnweisung.push('');
  let ruf = 0;
  ctx.ai = () => {
    ruf++;
    return ruf === 1
      ? JSON.stringify({ name: 'Die Bibliothek', geschichte: 'Staub auf den Rücken.', kulisse: 'a dusty library', bild: 'a door swings open' })
      : JSON.stringify({ name: 'Konrad', rolle: 'Archivar', aussehen: 'x', kleidung: 'y', person: 'z', stimmung: 'neugierig', eroeffnung: 'Sie sind spät dran.' });
  };
  await ctx.folgeHandlung({ ortwechsel: 'die Bibliothek nebenan', abgang: 'Ida', auftritt: 'ein Archivar' });
  pruefe('neuer Ort gesetzt', ctx.W.ort.name === 'Die Bibliothek', ctx.W.ort.name);
  pruefe('Zurückbleibende ist weg', !ctx.W.npcs.some(n => n.name === 'Ida'), ctx.W.npcs.map(n => n.name).join(','));
  pruefe('neue Figur ist da', ctx.W.npcs.some(n => n.name === 'Konrad'), ctx.W.npcs.map(n => n.name).join(','));
  pruefe('Mitgekommene bleibt', ctx.W.npcs.some(n => n.name === 'Marcelle'));

  // Veränderung ohne Wechsel
  const vorText = ctx.W.ort.geschichte;
  await ctx.folgeHandlung({ ortaenderung: 'Die Kerzen erlöschen eine nach der anderen.', ortwechsel: '', abgang: '', auftritt: '' });
  pruefe('Veränderung wird in den Ort geschrieben', ctx.W.ort.geschichte.length > vorText.length && /Kerzen/.test(ctx.W.ort.geschichte));
  pruefe('Ortsname bleibt dabei', ctx.W.ort.name === 'Die Bibliothek');
  const nochmalGleich = ctx.W.ort.geschichte;
  await ctx.folgeHandlung({ ortaenderung: 'Die Kerzen erlöschen eine nach der anderen.', ortwechsel: '', abgang: '', auftritt: '' });
  pruefe('dieselbe Veränderung nicht doppelt', ctx.W.ort.geschichte === nochmalGleich);

  const ortVorher = ctx.W.ort.name;
  await ctx.folgeHandlung({ ortwechsel: 'keine', ortaenderung: '-', abgang: '', auftritt: '' });
  pruefe('Leerangaben lassen den Ort in Ruhe', ctx.W.ort.name === ortVorher);

  console.log('\n— Drosselung (HTTP 429) —');
  // 429 heißt: zu viele Anfragen. Weiter anzuklopfen macht es schlimmer, also
  // muss der Generator eine Pause einlegen statt im Takt weiterzufragen.
  ctx.S.bildPauseBis = 0; ctx.S.eigenerPrompt = ''; ctx.S.promptFesthalten = false;
  ctx.BILDQUELLEN.pollinations.zeichne = async () => { throw new Error('Dienst antwortete HTTP 429 Too Many Requests, frühestens in 45s wieder'); };
  ctx.CFG.quelle = 'pollinations';
  await ctx.zeichneBild({});
  pruefe('429 löst eine Pause aus', ctx.S.bildPauseBis > Date.now(), String(ctx.S.bildPauseBis - Date.now()));
  pruefe('Retry-After wird übernommen (~45s)', Math.abs((ctx.S.bildPauseBis - Date.now()) - 45000) < 2000,
    String(Math.round((ctx.S.bildPauseBis - Date.now()) / 1000)) + 's');

  // Ein erschöpftes ZeroGPU-Kontingent kommt nicht als HTTP 429, sondern als
  // Text in der Antwort — auch dann muss der Generator eine Pause einlegen.
  ctx.S.bildPauseBis = 0;
  ctx.BILDQUELLEN.gradio.zeichne = async () => { throw new Error('You have exceeded your ZeroGPU runs limit. Authenticate with a Hugging Face token for more quota'); };
  ctx.CFG.quelle = 'gradio';
  await ctx.zeichneBild({});
  pruefe('erschöpftes Kontingent löst ebenfalls eine Pause aus', ctx.S.bildPauseBis > Date.now(),
    String(Math.round((ctx.S.bildPauseBis - Date.now()) / 1000)) + 's');
  pruefe('Pause dabei länger als bei einer Drosselung', (ctx.S.bildPauseBis - Date.now()) > 120000);

  // GPU-Panne auf der Serverseite: eigene Klasse, kuerzere Pause, klare Ansage.
  ctx.S.bildPauseBis = 0;
  ctx.BILDQUELLEN.gradio.zeichne = async () => {
    throw new Error('Generation failed: NVML_SUCCESS == r INTERNAL ASSERT FAILED at "/pytorch/c10/cuda/CUDACachingAllocator.cpp":1154');
  };
  ctx.CFG.quelle = 'gradio';
  await ctx.zeichneBild({});
  const pauseGpu = ctx.S.bildPauseBis - Date.now();
  pruefe('GPU-Panne des Dienstes löst eine Pause aus', pauseGpu > 0, String(Math.round(pauseGpu / 1000)) + 's');
  pruefe('kürzer als bei erschöpftem Kontingent', pauseGpu < 120000, String(Math.round(pauseGpu / 1000)) + 's');
  pruefe('CUDA-Assert wird als Serverpanne erkannt',
    ctx.istServerPanne('NVML_SUCCESS == r INTERNAL ASSERT FAILED at CUDACachingAllocator.cpp'));
  pruefe('Speichermangel ebenso', ctx.istServerPanne('torch.cuda.OutOfMemoryError: CUDA out of memory'));
  pruefe('ein Kontingentfehler ist keine Serverpanne', !ctx.istServerPanne('You have exceeded your ZeroGPU runs limit'));
  pruefe('ein Zeitablauf ist keine Serverpanne', !ctx.istServerPanne('Zeitüberschreitung nach 120s'));

  ctx.CFG.quelle = 'perchance';
  ctx.CFG.bildTakt = 1; ctx.S.bildZaehler = 0;
  ctx.S.bildPauseBis = Date.now() + 60000;   // laufende Pause, unabhängig vom Block davor
  const vorPause = gesendet.length;
  ctx.bildTakt();
  await new Promise(r => setTimeout(r, 30));
  pruefe('während der Pause wird nicht angefragt', gesendet.length === vorPause);

  ctx.S.bildPauseBis = Date.now() - 1;   // Pause abgelaufen
  ctx.S.bildZaehler = 0;
  ctx.bildTakt();
  await new Promise(r => setTimeout(r, 30));
  pruefe('nach der Pause geht es weiter', gesendet.length > vorPause);
  ctx.CFG.bildTakt = 2; ctx.S.bildPauseBis = 0;

  console.log('\n— Text-Plugin noch nicht bereit —');
  // Perchance meldet "Cannot read properties of null (reading 'contentWindow')",
  // wenn ai() gerufen wird, bevor das Plugin sein Iframe hat. Das ist kein
  // Fehler der Anfrage: kurz warten und erneut fragen.
  pruefe('contentWindow-Fehler gilt als "noch nicht bereit"',
    ctx.kiNochNichtBereit(new Error("Cannot read properties of null (reading 'contentWindow')")));
  pruefe('echter Fehler gilt nicht als "noch nicht bereit"',
    !ctx.kiNochNichtBereit(new Error('KI-Timeout (90s)')));

  let versuche = 0;
  ctx.ai = () => { versuche++; if (versuche < 3) throw new Error("Cannot read properties of null (reading 'contentWindow')"); return 'endlich da'; };
  const antwort = await ctx.frageKI('test');
  pruefe('nach zwei Fehlversuchen kommt die Antwort durch', antwort === 'endlich da', antwort);
  // Hinweis: frageKIEinmal ruft ai() zweimal je Anlauf — erst direkt, dann in
  // der Objektform als Rückfallebene. Zwei Anläufe sind also drei Aufrufe,
  // weil der dritte bereits gelingt.
  pruefe('es wurde genau dreimal aufgerufen', versuche === 3, String(versuche));

  versuche = 0;
  ctx.ai = () => { versuche++; throw new Error("Cannot read properties of null (reading 'contentWindow')"); };
  let meldung = '';
  try { await ctx.frageKI('test'); } catch (e) { meldung = e.message; }
  pruefe('bleibt es dabei, gibt es eine verständliche Meldung', /nicht bereit/.test(meldung) && /neu laden/.test(meldung), meldung);
  pruefe('und es wird nicht endlos wiederholt', versuche === 6, String(versuche));   // 3 Anläufe à 2 Aufrufe

  versuche = 0;
  ctx.ai = () => { versuche++; throw new Error('irgendein anderer Fehler'); };
  meldung = '';
  try { await ctx.frageKI('test'); } catch (e) { meldung = e.message; }
  // Kein zweiter Anlauf, nur die Objektform-Rückfallebene innerhalb desselben Anlaufs.
  pruefe('andere Fehler werden sofort durchgereicht', versuche === 2 && /anderer Fehler/.test(meldung), meldung + ' / ' + versuche);
};

console.log('\n— Erzählweise —');
ctx.W.protagonist = { name: 'Julian', herkunft: 'Wien', beruf: 'Apotheker', eigenart: 'summt beim Denken',
                      aussehen: 'a tall man in his thirties, dark hair', kleidung: 'a grey suit' };
ctx.W.npcs = [{ name: 'Ida', rolle: 'Wirtin', aussehen: 'a woman in her forties', kleidung: 'an apron' }];
ctx.S.stimmung = ['heiter']; ctx.S.kleidung = ['an apron'];
ctx.S.szeneGlobal = 'a candlelit tavern'; ctx.S.stil = ctx.STILE.manga; ctx.S.stilLabel = 'manga';

ctx.W.perspektive = 'er';
let pEr = ctx.bauePrompt({ szene: 'they talk across the table' });
pruefe('Er-Perspektive: Held ist im Bild', pEr.includes('a tall man in his thirties'), pEr.slice(0, 60));
pruefe('Er-Perspektive: zwei Figuren', pEr.includes('2 distinct characters'));
pruefe('Er-Perspektive: keine Ich-Kamera', !pEr.includes('first person point of view'));

ctx.W.perspektive = 'ich';
let pIch = ctx.bauePrompt({ szene: 'they talk across the table' });
pruefe('Ich-Perspektive: Held nicht im Bild', !pIch.includes('a tall man in his thirties'), pIch.slice(0, 60));
pruefe('Ich-Perspektive: Kamera ist sein Blick', pIch.includes('first person point of view'));
pruefe('Ich-Perspektive: nur die Gegenüber im Bild', pIch.includes('single character'));
pruefe('Stil bleibt in beiden erhalten', pEr.includes('anime manga style') && pIch.includes('anime manga style'));

// Der Weltkontext muss die Erzählweise an die KI weitergeben
ctx.W.stadt = 'Wien'; ctx.W.rahmenhandlung = '';
const kIch = ctx.weltKontext();
pruefe('Kontext nennt die Ich-Form', /ICH-Form/.test(kIch), kIch.split('\n').filter(z => /ERZAEHLWEISE/.test(z))[0]);
ctx.W.perspektive = 'er';
const kEr = ctx.weltKontext();
pruefe('Kontext nennt in der Er-Form den Namen', /Julian greift/.test(kEr), kEr.split('\n').filter(z => /ERZAEHLWEISE/.test(z))[0]);

console.log('\n— Welterschaffung —');
// Alle Antwortformen, die in der Praxis vorkommen, muessen zu einer
// spielbaren Welt fuehren - und eine unvollstaendige darf nicht stillschweigend
// zu Platzhaltern werden.
const frischeWelt = () => {
  ctx.W = { protagonist: { name: '', herkunft: '', beruf: '', eigenart: '', aussehen: '', kleidung: '' },
            stadt: '', rahmenhandlung: '', rahmenhandlungOriginal: '', perspektive: 'er', ort: null, npcs: [] };
};
const weltJson = JSON.stringify({
  held: { name: 'Julian Voss', herkunft: 'Graz', beruf: 'Apotheker', eigenart: 'summt' },
  stadt: 'Wien', rahmenhandlung: 'Julian kommt nach Wien.',
  ort: { name: 'Das Kabinett', geschichte: 'Spiegel und Staub.', bild: 'she looks up' },
  npc: { name: 'Marcelle', rolle: 'Gastgeberin', aussehen: 'dark hair', kleidung: 'a silk robe',
         person: 'Elegant.', stimmung: 'verspielt', eroeffnung: 'Sie sind spät.' }
});

frischeWelt(); ctx.verarbeiteWelt(weltJson);
pruefe('JSON: Held übernommen', ctx.W.protagonist.name === 'Julian Voss');
pruefe('JSON: Ort übernommen', ctx.W.ort.name === 'Das Kabinett');
pruefe('JSON: Person übernommen', ctx.W.npcs[0].name === 'Marcelle');
pruefe('JSON: Stimmung und Kleidung gesetzt', ctx.S.stimmung[0] === 'verspielt' && ctx.S.kleidung[0] === 'a silk robe');
pruefe('JSON: Seed gesetzt', ctx.S.seed >= 1);
pruefe('JSON: Verlauf und Gedächtnis leer', ctx.S.verlauf.length === 0 && ctx.S.fakten.length === 0);

frischeWelt(); ctx.verarbeiteWelt('```json\n' + weltJson + '\n```');
pruefe('JSON im Codeblock geht auch', ctx.W.npcs[0].name === 'Marcelle');

frischeWelt();
ctx.verarbeiteWelt('NAME: Egon\nSTADT: Prag\nORT_NAME: Der Hof\nNPC_NAME: Ida\nNPC_EROEFFNUNG: Hallo!');
pruefe('altes KEY-Format wird noch verstanden', ctx.W.protagonist.name === 'Egon' && ctx.W.npcs[0].name === 'Ida');

// Abgeschnittene Antwort: Platzhalter, aber sichtbar gemacht
frischeWelt();
ctx.verarbeiteWelt(weltJson.substring(0, 150));
pruefe('abgeschnittene Antwort ergibt trotzdem eine spielbare Welt',
  !!ctx.W.ort && ctx.W.npcs.length === 1);
pruefe('und sie fällt auf Platzhalter zurück', ctx.W.npcs[0].name === 'Ein Fremder', ctx.W.npcs[0].name);

// Die angeforderte Textmenge bestimmt die Erzeugungsdauer
pruefe('Welt-Prompt fordert keine überlangen Texte mehr',
  !/mindestens 8 vollstaendige|5 bis 10 Saetze/.test(src));
const zeitgrenzen = [...src.matchAll(/frageKI\([^,)]*,\s*(\d{4,6})\)/g)].map(m => Number(m[1]));
pruefe('kein Textaufruf wartet länger als 150s', Math.max(...zeitgrenzen) <= 150000, zeitgrenzen.join(', '));
pruefe('Welterschaffung meldet vergangene Sekunden', /Erfinde Welt… '\+Math\.round/.test(src));

console.log('\n— Größe der Anweisung —');
// Die Anweisung an die KI wuchs mit jedem gespielten Zug, bis der Dienst in
// die Zeitueberschreitung lief. Verlauf und Gedaechtnis sind jetzt gedeckelt.
ctx.W.protagonist = { name: 'Julian', herkunft: 'Wien', beruf: 'Apotheker', eigenart: 'summt', aussehen: '', kleidung: '' };
ctx.W.npcs = [{ name: 'Ida', rolle: 'Wirtin', aussehen: 'a', kleidung: 'b', person: 'c', grundstimmung: 'heiter' }];
ctx.S.verlauf = Array.from({ length: 60 }, (_, i) => ({ rolle: 'npc', idx: 0, name: 'Ida', text: 'x'.repeat(900) }));
ctx.S.kurzKontext = false;
const vLang = ctx.verlaufText(10);
pruefe('lange Zeilen werden gekappt', vLang.split('\n').every(z => z.length < 300), String(Math.max(...vLang.split('\n').map(z => z.length))));
pruefe('nur die angeforderten Zeilen', vLang.split('\n').length === 10);
ctx.S.kurzKontext = true;
const vKurz = ctx.verlaufText(10);
pruefe('im gekürzten Modus noch knapper', vKurz.length < vLang.length, `${vKurz.length} statt ${vLang.length}`);

ctx.S.fakten = Array.from({ length: 24 }, (_, i) => 'Fakt ' + i + ' ' + 'y'.repeat(300));
ctx.W.rahmenhandlung = 'z'.repeat(3000);
ctx.W.stadt = 'Wien'; ctx.W.perspektive = 'er';
ctx.S.handlung = 'h'.repeat(2000);
const kKurz = ctx.weltKontext();
ctx.S.kurzKontext = false;
const kLang = ctx.weltKontext();
pruefe('Weltkontext ist gedeckelt', kLang.length < 3500, String(kLang.length));
pruefe('gekürzt ist er kleiner', kKurz.length < kLang.length, `${kKurz.length} statt ${kLang.length}`);
pruefe('nicht alle 24 Fakten wandern mit', (kLang.match(/Fakt \d+/g) || []).length <= 14,
  String((kLang.match(/Fakt \d+/g) || []).length));
pruefe('die jüngsten Fakten sind dabei', kLang.indexOf('Fakt 23') >= 0);
pruefe('kappe kürzt und markiert', ctx.kappe('abcdefghij', 4) === 'abcd…' && ctx.kappe('ab', 4) === 'ab');

console.log('\n— Zeitüberschreitung heilt sich selbst —');
ctx.S.kurzKontext = false;
pruefe('KI-Timeout wird erkannt', ctx.pruefeZeitueberschreitung(new Error('KI-Timeout (90s)')) === true);
pruefe('und schaltet den kurzen Kontext ein', ctx.S.kurzKontext === true);
pruefe('ein zweiter Timeout bleibt dabei', ctx.pruefeZeitueberschreitung(new Error('KI-Timeout (150s)')) === true && ctx.S.kurzKontext === true);
ctx.S.kurzKontext = false;
pruefe('andere Fehler lösen das nicht aus', ctx.pruefeZeitueberschreitung(new Error('Dienst antwortete HTTP 500')) === false && ctx.S.kurzKontext === false);

console.log('\n— Reihenfolge der Antwortfelder —');
// Bricht eine Antwort ab, faellt weg was hinten steht. Die Felder, die den
// Spielzustand aendern, muessen deshalb VOR den langen Fliesstextfeldern stehen.
const spec = src.match(/Antworte NUR mit einem gueltigen JSON-Objekt[\s\S]*?veraendern das Spiel wirklich/);
pruefe('Feldliste gefunden', !!spec);
const pos = f => spec[0].indexOf('"' + f + '"');
['auftritt', 'abgang', 'ortwechsel', 'kleidung', 'ortaenderung'].forEach(f => {
  pruefe(`"${f}" steht vor "bild" und "handlung"`, pos(f) > 0 && pos(f) < pos('bild') && pos(f) < pos('handlung'),
    `${f} bei ${pos(f)}, bild bei ${pos('bild')}`);
});
pruefe('"antwort" steht ganz vorn', pos('antwort') < pos('auftritt'));
pruefe('Nachdruck auf den Zustandsfeldern vorhanden', /MUSST du "auftritt" ausfuellen/.test(src));

console.log('\n— Hilfe-Fenster —');
// Die Hilfe baut sich aus der Registry auf: ein neuer Befehl steht damit
// automatisch drin, ohne dass jemand die Hilfe nachpflegen muss.
let hilfeHtml = '';
const echterInhalt = ctx.document.getElementById;
ctx.document.getElementById = (id) => {
  const e = echterInhalt(id);
  if (id === 'hilfeInhalt') { Object.defineProperty(e, 'innerHTML', { set(v) { hilfeHtml = v; }, get() { return hilfeHtml; } }); }
  return e;
};
ctx.oeffneHilfe();
ctx.document.getElementById = echterInhalt;

pruefe('Hilfe wird gefüllt', hilfeHtml.length > 200, String(hilfeHtml.length));
const fehlend = ctx.BEFEHLE.map(b => b.hilfe[0]).filter(n => hilfeHtml.indexOf(n.split(' ')[0].replace(/…/g, '')) < 0);
pruefe('jeder Befehl aus der Registry steht drin', fehlend.length === 0, fehlend.join(' '));
pruefe('auch die Beschreibungen', ctx.BEFEHLE.every(b => hilfeHtml.indexOf(b.hilfe[1].substring(0, 20)) >= 0));
pruefe('erklärt Sprechen und Handeln', /sagt deine Figur/.test(hilfeHtml) && /Handlung/.test(hilfeHtml));
pruefe('erklärt den Auto-Modus', /stehenden? Regie/i.test(hilfeHtml) && /\/sag:/.test(hilfeHtml));
pruefe('nennt die Knöpfe der Kopfleiste', /Chronik/.test(hilfeHtml) && /Spielstände/.test(hilfeHtml));
pruefe('eckige Klammern erscheinen als Zeichen, nicht als Perchance-Ausdruck',
  hilfeHtml.indexOf('[eckigen Klammern]') >= 0);

console.log('\n— Befehl /roh —');
const treffRoh = t => { for (const b of ctx.BEFEHLE) { const m = t.match(b.muster); if (m) return b; } return null; };
pruefe('/roh erkannt', treffRoh('/roh') && treffRoh('/roh').hilfe[0] === '/roh');
pruefe('kollidiert nicht mit /regie', treffRoh('/regie: x').hilfe[0] === '/regie: …');
pruefe('kollidiert nicht mit /ort', treffRoh('/ort: x').hilfe[0] === '/ort: …');

console.log('\n— Befehl /perspektive —');
const treff = t => { for (const b of ctx.BEFEHLE) { const m = t.match(b.muster); if (m) return { b, m }; } return null; };
pruefe('/perspektive: ich erkannt', treff('/perspektive: ich').m[1] === 'ich');
pruefe('/perspektive ohne Angabe erkannt', !!treff('/perspektive'));
pruefe('kollidiert nicht mit anderen Befehlen', treff('/perspektive: er').b.hilfe[0].indexOf('/perspektive') === 0);

console.log('\n— Mission und Beziehungen —');
// Eine Szene braucht ein Ziel und klare Haltungen, sonst laeuft jedes Gespraech
// in dieselbe Richtung. Beides steht im Zustand und geht in jede Anweisung ein.
const weltMitDreien = JSON.stringify({
  held: { name: 'Julian Voss', herkunft: 'Graz', beruf: 'Apotheker', eigenart: 'summt' },
  stadt: 'Wien',
  mission: 'Julian will vor Mitternacht die Unterschrift seines Bruders bekommen.',
  rahmenhandlung: 'Julian kommt mit seiner Frau ins Kino.',
  ort: { name: 'Kino Urania', geschichte: 'Roter Samt.', bild: 'they wait in the foyer' },
  npcs: [
    { name: 'Marlene', rolle: 'Ehefrau des Helden', aussehen: 'dark hair', kleidung: 'a wool coat',
      person: 'Trocken.', stimmung: 'gelassen', beziehung: 'vertraut, seit zwölf Jahren',
      beziehungen: 'Konrad: alte Rivalin', eroeffnung: 'Zwei Karten, wie immer?' },
    { name: 'Konrad', rolle: 'Bruder', aussehen: 'grey beard', kleidung: 'a suit',
      person: 'Ausweichend.', stimmung: 'nervoes', beziehung: 'schuldbewusst',
      beziehungen: 'Marlene: skeptisch', eroeffnung: 'Ich habe wenig Zeit.' }
  ]
});
frischeWelt(); ctx.verarbeiteWelt(weltMitDreien);
pruefe('genannte Personen treten sofort auf', ctx.W.npcs.length === 2 &&
  ctx.W.npcs[0].name === 'Marlene' && ctx.W.npcs[1].name === 'Konrad',
  ctx.W.npcs.map(x => x.name).join(','));
pruefe('der genannte Ort wird uebernommen', ctx.W.ort.name === 'Kino Urania');
pruefe('die Mission steht in der Welt', /Unterschrift/.test(ctx.W.mission));
pruefe('Stimmungen gehoeren zur richtigen Figur', ctx.S.stimmung[1] === 'nervoes', ctx.S.stimmung.join(','));
pruefe('Haltung zum Helden aus der Welterschaffung',
  ctx.beziehungZu('Marlene', 'Julian Voss') === 'vertraut, seit zwölf Jahren', JSON.stringify(ctx.S.beziehungen));
pruefe('Haltung zwischen zwei Figuren', ctx.beziehungZu('Konrad', 'Marlene') === 'skeptisch');
pruefe('mehr als MAX_NPCS werden nicht aufgestellt', (function(){
  const viele = JSON.parse(weltMitDreien);
  viele.npcs = Array.from({ length: ctx.MAX_NPCS + 3 }, (_, i) => ({ name: 'P' + i, rolle: 'Gast', stimmung: 'ruhig' }));
  frischeWelt(); ctx.verarbeiteWelt(JSON.stringify(viele));
  return ctx.W.npcs.length === ctx.MAX_NPCS;
})(), String(ctx.W.npcs.length));

frischeWelt(); ctx.verarbeiteWelt(weltMitDreien);
pruefe('Register nennt Ziel und Haltung fuer jede Figur', (function(){
  const t = ctx.beziehungText();
  return /Marlene → Julian Voss: vertraut/.test(t) && /Konrad → Julian Voss: schuldbewusst/.test(t) &&
         /Marlene: skeptisch/.test(t);
})(), ctx.beziehungText());
// Fehlt eine Haltung, soll das Register das zeigen statt sie zu erfinden.
delete ctx.S.beziehungen.Konrad.Marlene;
pruefe('offene Haltungen werden als offen ausgewiesen',
  /Konrad → Julian Voss: schuldbewusst \| Marlene: noch unbestimmt/.test(ctx.beziehungText()), ctx.beziehungText());
ctx.setzeBeziehung('Konrad', 'Marlene', 'skeptisch');
const kontext = ctx.weltKontext();
pruefe('Mission steht im Weltkontext', /MISSION \(das uebergeordnete Ziel/.test(kontext));
pruefe('Beziehungen stehen im Weltkontext', /BEZIEHUNGEN/.test(kontext) && /Marlene →/.test(kontext));

// Der Held fuehrt kein Register ueber sich selbst, und Unsinn faellt durch.
pruefe('Haltung des Helden wird nicht gespeichert', !ctx.setzeBeziehung('Julian Voss', 'Marlene', 'verliebt'));
pruefe('unbekannte Figur wird abgewiesen', !ctx.setzeBeziehung('Niemand', 'Marlene', 'neugierig'));
pruefe('Haltung zu sich selbst wird abgewiesen', !ctx.setzeBeziehung('Marlene', 'Marlene', 'zufrieden'));
pruefe('leere Angabe aendert nichts', !ctx.setzeBeziehung('Marlene', 'Konrad', 'keine'));

// Antwortformat der Regie: "Figur > Ziel: Haltung", mehrere mit Semikolon.
const gelesen = ctx.beziehungenAus('Marlene > HELD: belustigt; Konrad -> Marlene : versoehnlich');
pruefe('Zeile mit > wird gelesen', gelesen.length === 2 && gelesen[0].zu.trim() === 'HELD', JSON.stringify(gelesen));
ctx.uebernimmBeziehungen('Marlene > HELD: belustigt; Konrad > Marlene: versoehnlich');
pruefe('HELD trifft den Helden', ctx.beziehungZu('Marlene', 'Julian Voss') === 'belustigt');
pruefe('Haltung zwischen Figuren wird fortgeschrieben', ctx.beziehungZu('Konrad', 'Marlene') === 'versoehnlich');
ctx.uebernimmBeziehungen([{ von: 'Konrad', zu: 'HELD', wert: 'offener' }]);
pruefe('auch eine Liste von Objekten wird verstanden', ctx.beziehungZu('Konrad', 'Julian Voss') === 'offener');
ctx.uebernimmBeziehungen('Bo: neugierig', 'Marlene');
pruefe('abwesende Ziele werden nicht eingetragen', !ctx.beziehungZu('Marlene', 'Bo'));

ctx.S.missionStand = '';
ctx.folgeBeziehungen('Marlene > Konrad: eisig', 'Konrad hat die Unterschrift verweigert.');
pruefe('der Missionsstand wird fortgeschrieben', /verweigert/.test(ctx.S.missionStand));
pruefe('und die Haltung gleich mit', ctx.beziehungZu('Marlene', 'Konrad') === 'eisig');
ctx.folgeBeziehungen('', 'keine');
pruefe('Leerangaben lassen den Stand stehen', /verweigert/.test(ctx.S.missionStand));

// Geht jemand, verschwindet er auch aus dem Register.
ctx.W.npcs = ctx.W.npcs.slice(0, 1);
ctx.beziehungenAufraeumen();
pruefe('Abgegangene stehen nicht mehr im Register',
  !ctx.S.beziehungen.Konrad && !ctx.beziehungZu('Marlene', 'Konrad'), JSON.stringify(ctx.S.beziehungen));

// Die Anweisung an die KI muss das Tempo der Annaeherung vorgeben.
pruefe('die Zug-Anweisung bremst den Sprung ins Amouroese',
  /ANNAEHERUNG/.test(html) && /Ueberspringe keine Stufe/.test(html) && /nur, wenn BEIDE Seiten/.test(html));
pruefe('die Zug-Anweisung fragt Beziehungen und Mission ab',
  /"beziehungen": "nur was sich JETZT/.test(html) && /"mission": "ein kurzer Satz/.test(html));
pruefe('die Welt-Anweisung verlangt genannte Personen und den genannten Ort',
  /Nennt sie PERSONEN/.test(html) && /Nennt sie einen ORT/.test(html));
pruefe('die Mission darf kein Liebesziel sein', /KEIN Liebesziel/.test(html));

// Alte Spielstaende kennen weder Mission noch Register.
const altStand = ctx.migriere({
  welt: { protagonist: { name: 'Egon' }, ort: { name: 'Taverne' }, npcs: [{ name: 'Ida', grundstimmung: 'heiter', kleidung: 'apron' }] },
  stand: { verlauf: [], imSpiel: false }
});
pruefe('alter Stand bekommt ein leeres Register', altStand.stand.beziehungen && !Object.keys(altStand.stand.beziehungen).length);
pruefe('alter Stand bekommt Mission und Stand als Text',
  altStand.welt.mission === '' && altStand.stand.missionStand === '');

console.log('\n— Charakterblatt —');
// Ein Portraet je Figur mit eigenem, aber aus der Partie abgeleitetem Seed.
frischeWelt(); ctx.verarbeiteWelt(weltJson);
ctx.S.seed = 12345;
pruefe('jede Figur hat einen eigenen Seed', ctx.figurSeed(0) !== ctx.figurSeed(1));
pruefe('derselbe Seed bei derselben Partie', ctx.figurSeed(0) === (12345 + 7919) % 2147483647);
const bp = ctx.blattPrompt(0);
pruefe('das Blatt zeigt Identität und Kleidung', /dark hair/.test(bp) && /wearing a silk robe/.test(bp), bp);
pruefe('es ist ein Porträt, keine Szene', /character reference sheet/.test(bp) && /neutral grey background/.test(bp));
pruefe('der Bildstil gilt auch hier', /manga|anime|comic|watercolor|oil|photo|pixel/i.test(bp), bp);
pruefe('Blätter liegen neben dem Spielstand, nicht darin',
  ctx.blattSchreiben('Marcelle', 'data:image/png;base64,AAA') === true &&
  ctx.blattLesen('Marcelle') === 'data:image/png;base64,AAA' &&
  !JSON.stringify(ctx.standObjekt()).includes('data:image/png;base64,AAA'));
pruefe('ein zu großes Blatt wird abgelehnt', ctx.blattSchreiben('Marcelle', 'x'.repeat(700001)) === false);
ctx.blattSchreiben('Marcelle', '');
pruefe('und lässt sich wieder löschen', ctx.blattLesen('Marcelle') === '');
pruefe('/blatt ist ein Befehl', !!ctx.BEFEHLE.find(b => /blatt/.test(String(b.muster))));

console.log('\n— Lektor —');
// Ein zweiter Aufruf prueft die Zeile. Er darf nur eingreifen, wenn er etwas
// findet — und niemals einen Aufsatz daraus machen.
ctx.W.mission = 'Die Unterschrift bekommen.';
ctx.S.aktZiel = 'Konrad ansprechen.';
ctx.S.probe = { gelungen: false, versuch: 'nach dem Stift greifen' };
const lAnw = ctx.baueLektorAnweisung('Sie lächelt und reicht ihm den Stift.', 'Marcelle');
pruefe('die Anweisung nennt Mission, Etappe und Probe',
  /Die Unterschrift/.test(lAnw) && /Konrad ansprechen/.test(lAnw) && /MISSLUNGEN/.test(lAnw));
pruefe('sie prüft genau vier Dinge', /1\. Wiederholung/.test(lAnw) && /4\. Probe/.test(lAnw));
pruefe('OK lässt die Zeile stehen', ctx.lektorAntwort('OK', 'Der Originalsatz.') === '');
pruefe('auch mit Beiwerk', ctx.lektorAntwort('ok\n', 'Der Originalsatz.') === '');
pruefe('eine Korrektur kommt durch',
  ctx.lektorAntwort('Sie zieht die Hand zurück.', 'Sie lächelt und reicht ihm den Stift.') === 'Sie zieht die Hand zurück.');
pruefe('Codeblöcke fallen weg',
  ctx.lektorAntwort('```\nSie zieht die Hand zurück.\n```', 'Sie lächelt.') === 'Sie zieht die Hand zurück.');
pruefe('ein Aufsatz wird verworfen', ctx.lektorAntwort('x'.repeat(400), 'kurze Zeile') === '');
pruefe('dieselbe Zeile gilt als keine Korrektur', ctx.lektorAntwort('Gleiche Zeile.', 'gleiche zeile.') === '');
pruefe('Leeres ändert nichts', ctx.lektorAntwort('', 'Original') === '' && ctx.lektorAntwort(null, 'Original') === '');
pruefe('der Schalter steht in den Einstellungen', html.includes('id="cfgLektor"') && html.includes('CFG.lektor=!!lk.checked'));

console.log('\n— Geschlecht des Helden —');
// Es steht in der Anweisung, damit die Figuren richtig ansprechen, und im
// Bildprompt, damit der Held nicht in jedem Panel wechselt.
pruefe('gängige Schreibweisen werden verstanden',
  ctx.geschlechtSchluessel('männlich') === 'maennlich' && ctx.geschlechtSchluessel('W') === 'weiblich' &&
  ctx.geschlechtSchluessel('nichtbinär') === 'divers' && ctx.geschlechtSchluessel('Kürbis') === '',
  ctx.geschlechtSchluessel('Kürbis'));
frischeWelt(); ctx.verarbeiteWelt(weltJson);
ctx.W.protagonist.geschlecht = 'weiblich';
pruefe('es steht in der Anweisung', /weiblich/.test(ctx.weltKontext()), ctx.weltKontext().split('\n')[1]);
pruefe('es wird zum Bildwort', ctx.geschlechtFuerBild() === 'a woman');
ctx.W.protagonist.geschlecht = '';
pruefe('ohne Festlegung steht nichts da', !/nicht festgelegt/.test(ctx.weltKontext()) && ctx.geschlechtFuerBild() === '');
ctx.W.protagonist.geschlecht = 'maennlich';
ctx.W.protagonist.aussehen = 'in his forties, grey at the temples';
ctx.W.perspektive = 'er';
const heldBild = ctx.bauePrompt({});
pruefe('der Held erscheint mit Geschlecht im Bild', /a man, in his forties/.test(heldBild), heldBild.slice(0, 80));
ctx.W.protagonist.aussehen = 'a man with a beard';
pruefe('doppelt wird es nicht gesetzt', !/a man, a man/.test(ctx.bauePrompt({})));
ctx.W.protagonist.aussehen = '';
pruefe('fehlt die Beschreibung, entsteht eine aus Beruf und Geschlecht',
  /a man/.test(ctx.heldAussehen(false)) && /apotheker/i.test(ctx.heldAussehen(false)), ctx.heldAussehen(false));
pruefe('lesen allein schreibt sie nicht fest', ctx.W.protagonist.aussehen === '');
ctx.heldAussehen(true);
pruefe('beim Zeichnen wird sie festgehalten', ctx.W.protagonist.aussehen.length > 0);
pruefe('die Wahl steht auf dem Startbildschirm', html.includes('id="geschlechtwahl"') && html.includes('CFG.geschlecht'));
pruefe('und im Figurenmenü', html.includes('id="fig_held_geschlecht"'));

console.log('\n— Charakterblatt des Helden —');
ctx.S.seed = 12345;
pruefe('der Held hat einen eigenen Seed',
  ctx.heldSeed() !== ctx.figurSeed(0) && ctx.heldSeed() !== ctx.figurSeed(1));
ctx.W.protagonist.aussehen = 'in his forties, grey at the temples';
ctx.W.protagonist.kleidung = 'a worn linen jacket';
const hb = ctx.blattPrompt('held');
pruefe('sein Blatt nennt Geschlecht, Identität und Kleidung',
  /a man/.test(hb) && /grey at the temples/.test(hb) && /wearing a worn linen jacket/.test(hb), hb);
pruefe('es ist derselbe Rahmen wie bei den Figuren',
  /character reference sheet/.test(hb) && /neutral grey background/.test(hb));
pruefe('/blatt held ist ein Weg dorthin', /held\|ich\|0/.test(html));

console.log('\n— Verdeckte Absichten —');
// Jede Figur will etwas fuer sich und verbirgt etwas. Der Spieler sieht das
// nicht, die KI schon.
const weltMitGeheimnis = JSON.stringify({
  held: { name: 'Julian Voss', herkunft: 'Graz', beruf: 'Apotheker', eigenart: 'summt' },
  stadt: 'Wien', mission: 'Die Unterschrift bekommen.', etappe: 'Konrad überhaupt ansprechen.',
  rahmenhandlung: 'Im Kino.',
  ort: { name: 'Kino Urania', geschichte: 'Roter Samt.', bild: 'they wait', zeit: '20:05', wetter: 'Schneeregen' },
  frist: 45,
  npcs: [
    { name: 'Marlene', rolle: 'Ehefrau', aussehen: 'dark hair', kleidung: 'a coat', person: 'Trocken.',
      stimmung: 'gelassen', beziehung: 'vertraut', ziel: 'Den Abend retten.', geheimnis: 'Sie hat die Karten verfallen lassen.',
      eroeffnung: 'Zwei Karten?' },
    { name: 'Konrad', rolle: 'Bruder', aussehen: 'grey beard', kleidung: 'a suit', person: 'Ausweichend.',
      stimmung: 'nervoes', beziehung: 'schuldbewusst', ziel: 'Nicht unterschreiben.', geheimnis: 'Er hat das Geld längst ausgegeben.',
      eroeffnung: 'Wenig Zeit.' }
  ]
});
frischeWelt(); ctx.verarbeiteWelt(weltMitGeheimnis);
pruefe('Ziel und Geheimnis werden übernommen',
  ctx.W.npcs[1].ziel === 'Nicht unterschreiben.' && /Geld längst ausgegeben/.test(ctx.W.npcs[1].geheimnis));
const absicht = ctx.absichtenText();
pruefe('die Absichten stehen nur in der Anweisung', /NUR FUER DICH/.test(absicht) && /verbirgt: Sie hat die Karten/.test(absicht));
pruefe('sie werden nicht geradeheraus gespielt', /Andeutungen, Ausweichen/.test(absicht));
pruefe('eine Aufdeckung setzt das Geheimnis offen',
  ctx.deckeAuf('Konrad: Er gesteht, dass das Geld weg ist.') === true && ctx.W.npcs[1].aufgedeckt === true);
pruefe('sie landet als schwerer Fakt im Gedächtnis',
  ctx.S.fakten.some(f => f.g === 3 && /offengelegt/.test(f.t)), ctx.faktenTexte().join(' | '));
pruefe('zweimal aufdecken ändert nichts', ctx.deckeAuf('Konrad: nochmal') === false);
pruefe('unbekannte Namen werden abgewiesen', ctx.deckeAuf('Niemand: irgendwas') === false);
pruefe('nach der Aufdeckung steht es als offen in der Anweisung', /bereits offen/.test(ctx.absichtenText()));
pruefe('der Regie-Blick ist ein Befehl, kein Knopf', /\/gedanken/.test(html) && /REGIE-BLICK/.test(html));

console.log('\n— Akte —');
// Die Mission zerfaellt in Etappen; erreichte werden abgeschlossen.
frischeWelt(); ctx.verarbeiteWelt(weltMitGeheimnis);
pruefe('die erste Etappe kommt aus der Welterschaffung', ctx.S.aktZiel === 'Konrad überhaupt ansprechen.' && ctx.S.akt === 1);
pruefe('die Uhrzeit der Welt wird übernommen', ctx.uhrzeit() === '20:05', ctx.uhrzeit());
pruefe('Wetter und Frist ebenso', ctx.S.wetter === 'Schneeregen' && ctx.S.frist === 45);
pruefe('der Akt steht in der Anweisung', /AKT 1 — JETZT ANSTEHENDE ETAPPE: Konrad/.test(ctx.aktText()), ctx.aktText());
pruefe('eine neue Etappe zählt den Akt hoch',
  ctx.naechsteEtappe('Ihn zum Reden bringen.') === true && ctx.S.akt === 2 && ctx.S.aktZiel === 'Ihn zum Reden bringen.');
pruefe('die erledigte Etappe wird aufbewahrt', ctx.S.akteVorbei.length === 1 && /ansprechen/.test(ctx.S.akteVorbei[0]));
pruefe('sie steht als schwerer Fakt im Gedächtnis', ctx.S.fakten.some(f => f.g === 3 && /^Erledigt:/.test(f.t)));
pruefe('das nächste Bild kommt sofort', ctx.S.bildZaehler === 0);
pruefe('leere Angaben ändern den Akt nicht', ctx.naechsteEtappe('') === false && ctx.naechsteEtappe('keine') === false && ctx.S.akt === 2);
pruefe('erledigte Etappen stehen in der Anweisung', /ERLEDIGTE ETAPPEN/.test(ctx.aktText()));
pruefe('ohne Mission gibt es keine Akte', (function(){ const m = ctx.W.mission; ctx.W.mission = ''; const t = ctx.aktText(); ctx.W.mission = m; return t === ''; })());

console.log('\n— Gedaechtnis mit Gewicht —');
// Frueher fiel der aelteste Fakt heraus. Jetzt zaehlt Gewicht mal Frische:
// ein Versprechen ueberlebt zwanzig Belanglosigkeiten.
ctx.S.fakten = []; ctx.S.zug = 0;
ctx.merkeFakt('Ida hat versprochen, den Schlüssel zu bringen.');
ctx.merkeFakt('Es regnet draußen.');
pruefe('ein Versprechen wiegt schwer', ctx.S.fakten[0].g === 3, JSON.stringify(ctx.S.fakten[0]));
pruefe('Beiläufiges wiegt leicht', ctx.S.fakten[1].g === 1, JSON.stringify(ctx.S.fakten[1]));
ctx.S.zug = 30;
for (let i = 0; i < ctx.MAX_FAKTEN + 6; i++) ctx.merkeFakt('Belangloser Fakt Nummer ' + i);
pruefe('das Gedächtnis bleibt gedeckelt', ctx.S.fakten.length === ctx.MAX_FAKTEN);
pruefe('das Versprechen hat überlebt', ctx.faktenTexte().some(t => /versprochen/.test(t)), ctx.faktenTexte().join(' | '));
pruefe('das Beiläufige ist verdrängt', !ctx.faktenTexte().some(t => /Es regnet/.test(t)));
ctx.S.fakten = []; ctx.S.zug = 5;
ctx.merkeFakt('Konrad schuldet dem Wirt Geld.');
ctx.S.zug = 40;
ctx.frischeFakten('Der Wirt fragte, ob Konrad das Geld nun bringe.');
pruefe('eine Erwähnung frischt den Fakt auf', ctx.S.fakten[0].z === 40, JSON.stringify(ctx.S.fakten[0]));
ctx.merkeFakt('Konrad schuldet dem Wirt Geld.', 3);
pruefe('derselbe Fakt wird nicht doppelt abgelegt', ctx.S.fakten.length === 1);
pruefe('ein schwereres Gewicht setzt sich durch', ctx.S.fakten[0].g === 3);

console.log('\n— Uhr, Wetter und Frist —');
ctx.S.startUhr = 19 * 60 + 30; ctx.S.minuten = 0; ctx.S.wetter = 'Nieselregen'; ctx.S.frist = 0;
pruefe('die Uhr beginnt beim Startwert', ctx.uhrzeit() === '19:30');
ctx.zeitWeiter(45);
pruefe('Minuten laufen weiter', ctx.uhrzeit() === '20:15');
ctx.zeitWeiter('unsinn');
pruefe('unlesbare Angaben gelten als drei Minuten', ctx.uhrzeit() === '20:18');
ctx.zeitWeiter(-5);
pruefe('die Uhr läuft nie rückwärts', ctx.uhrzeit() === '20:21');
pruefe('Abend wird als Abend gemalt', /evening/.test(ctx.tageszeit()), ctx.tageszeit());
ctx.S.minuten = 0; ctx.S.startUhr = 7 * 60;
pruefe('Morgen wird als Morgen gemalt', /morning/.test(ctx.tageszeit()), ctx.tageszeit());
pruefe('Wetter geht ins Bild', /nieselregen/.test(ctx.zeitFuerBild()), ctx.zeitFuerBild());
ctx.S.frist = 60; ctx.S.minuten = 42;
pruefe('die Restfrist wird gerechnet', ctx.restFrist() === 18);
pruefe('die Frist steht in der Anweisung', /noch 18 Minuten/.test(ctx.zeitText()), ctx.zeitText());
ctx.S.minuten = 75;
pruefe('abgelaufene Frist wird deutlich benannt', /ABGELAUFEN/.test(ctx.zeitText()));
ctx.S.frist = 0; ctx.S.minuten = 0; ctx.S.startUhr = 19 * 60 + 30;
pruefe('ohne Frist steht keine in der Anweisung', !/FRIST/.test(ctx.zeitText()));

console.log('\n— Würfelproben —');
// Eine Handlung in eckigen Klammern wird gewürfelt, blosses Reden nicht.
pruefe('Handlung in Klammern wird erkannt', ctx.wagnisAus('Ich sage nichts. \x5Bgreife nach dem Schlüssel\x5D') === 'greife nach dem Schlüssel');
pruefe('blosses Reden ist kein Wagnis', ctx.wagnisAus('Guten Abend, wie geht es dir?') === '');
pruefe('zu kurze Klammern zählen nicht', ctx.wagnisAus('\x5Bhm\x5D') === '');
ctx.W.npcs = [{ name: 'Ida', rolle: 'Wirtin', aussehen: 'a woman', kleidung: 'apron' }];
ctx.S.stimmung = ['heiter']; ctx.S.beziehungen = {};
ctx.setzeBeziehung('Ida', ctx.heldName(), 'verliebt');
pruefe('Zuneigung hilft', ctx.beziehungsBonus('Ida') === 4, String(ctx.beziehungsBonus('Ida')));
ctx.setzeBeziehung('Ida', ctx.heldName(), 'eisig');
pruefe('Ablehnung steht im Weg', ctx.beziehungsBonus('Ida') === -4);
ctx.setzeBeziehung('Ida', ctx.heldName(), 'nachdenklich');
pruefe('Unbekanntes ist neutral', ctx.beziehungsBonus('Ida') === 0);
const echterZufall = ctx.Math.random;
ctx.Math.random = () => 0.999;                    // Wurf 20
let p20 = ctx.wuerfle('den Schlüssel nehmen', 0);
pruefe('die Zwanzig gelingt immer', p20.gelungen && p20.glanz && p20.wurf === 20, JSON.stringify(p20));
ctx.Math.random = () => 0;                        // Wurf 1
ctx.setzeBeziehung('Ida', ctx.heldName(), 'verliebt');
let p1 = ctx.wuerfle('den Schlüssel nehmen', 0);
pruefe('die Eins misslingt auch mit Bonus', !p1.gelungen && p1.patzer, JSON.stringify(p1));
ctx.Math.random = () => 0.45;                     // Wurf 10
let p10 = ctx.wuerfle('den Schlüssel nehmen', 0);
pruefe('Bonus entscheidet den Grenzfall', p10.wurf === 10 && p10.bonus === 4 && p10.gelungen, JSON.stringify(p10));
ctx.setzeBeziehung('Ida', ctx.heldName(), 'eisig');
let pMinus = ctx.wuerfle('den Schlüssel nehmen', 0);
pruefe('Ablehnung kippt denselben Wurf', !pMinus.gelungen, JSON.stringify(pMinus));
ctx.Math.random = echterZufall;
const text = ctx.probeText(p10);
pruefe('das Ergebnis steht in der Anweisung fest', /GELUNGEN/.test(text) && /Erfinde keinen anderen Ausgang/.test(text));
pruefe('Misserfolg wird nicht abgemildert', /MISSLINGT spuerbar/.test(ctx.probeText(pMinus)));
pruefe('der Schalter steht in den Einstellungen', html.includes('id="cfgWuerfel"') && html.includes('CFG.wuerfel=!!wf.checked'));

console.log('\n— Mission von Hand —');
// Das Ziel gehoert dem Spieler: per Befehl und ueber ein eigenes Fenster,
// erreichbar aus der Chronik.
// Eigener Sucher: die Befehlstabelle wird weiter unten noch einmal geprueft.
const befehlZu = t => { for (const b of ctx.BEFEHLE) { const m = t.match(b.muster); if (m) return { b, m }; } return null; };
pruefe('/mission ist ein eigener Befehl', !!befehlZu('/mission: Den Brief finden'));
pruefe('/mission kollidiert nicht mit anderen Befehlen',
  befehlZu('/mission: x').b.hilfe[0] === '/mission: …' && befehlZu('/mission').b.hilfe[0] === '/mission: …');
ctx.S.imSpiel = true;
ctx.W.mission = '';
ctx.S.missionStand = 'alter Stand';
ctx.missionBefehl('Den Brief vor Mitternacht finden');
pruefe('Text setzt das Ziel', ctx.W.mission === 'Den Brief vor Mitternacht finden');
pruefe('ein neues Ziel setzt den Stand zurueck', ctx.S.missionStand === '');
pruefe('das neue Ziel steht im Gedaechtnis', ctx.faktenTexte().some(f => /Das Ziel lautet jetzt/.test(f)), ctx.faktenTexte().join(' | '));
pruefe('das Ziel steht danach im Weltkontext', /Den Brief vor Mitternacht/.test(ctx.weltKontext()));
ctx.missionBefehl('weg');
pruefe('„weg" streicht das Ziel', ctx.W.mission === '' && ctx.S.missionStand === '');
pruefe('ohne Ziel steht keine Mission im Weltkontext', !/MISSION \(das uebergeordnete/.test(ctx.weltKontext()));
ctx.W.mission = 'Vorheriges Ziel';
ctx.missionBefehl('');
pruefe('ohne Text bleibt das Ziel stehen (das Fenster oeffnet sich)', ctx.W.mission === 'Vorheriges Ziel');
// kappe() haengt ein Auslassungszeichen an, deshalb 401 statt 400.
pruefe('ein sehr langes Ziel wird gekappt',
  (ctx.missionBefehl('x'.repeat(900)), ctx.W.mission.length === 401 && ctx.W.mission.endsWith('…')),
  String(ctx.W.mission.length));
pruefe('das Missions-Fenster steht im Markup',
  html.includes('id="mMission"') && html.includes('id="missionZiel"') && html.includes('id="missionStandFeld"'));
pruefe('die Chronik fuehrt ins Bearbeiten', /ZIEL SETZEN|BEARBEITEN/.test(html) && /oeffneMissionMenu\(\)/.test(html));
ctx.W.mission = '';
ctx.S.missionStand = '';

console.log('\n— Werkzeugleiste und Bildmenue —');
// Bildstil und Bildbearbeitung sind ein Fenster. Zwei Untermenues fuer dieselbe
// Sache waren einmal zu viel.
pruefe('kein eigenes Bildstil-Fenster mehr', !html.includes('id="mSzene"') && !html.includes('id="szenebtn"'));
pruefe('die Stilwahl steht im Bildmenue',
  html.indexOf('id="szeneStil"') > html.indexOf('id="mBild"') &&
  html.indexOf('id="szeneStil"') < html.indexOf('id="bildPromptFeld"'));
pruefe('der alte Aufruf fuehrt ins Bildmenue', /function oeffneSzeneMenu\(\)\{\s*oeffneBildModal\(\);\s*\}/.test(html));
pruefe('das Bildmenue fuellt die Stilwahl und uebernimmt sie',
  /fuelleStilWahl\(\);/.test(html) && /if\(uebernehmeStil\(\)\)/.test(html));
// Die Knoepfe sollen 1:1 oder 1:2 stehen, sonst tanzt die Leiste.
const werkzeugCss = (html.match(/#werkzeuge button\{[^}]*\}/) || [''])[0];
const breitCss = (html.match(/#werkzeuge button\.breit\{[^}]*\}/) || [''])[0];
const hoehe = (werkzeugCss.match(/height:(\d+)px/) || [])[1];
const breite = (werkzeugCss.match(/width:(\d+)px/) || [])[1];
const breit = (breitCss.match(/width:(\d+)px/) || [])[1];
pruefe('Icon-Knopf steht 1:1', hoehe && breite && +hoehe === +breite, breite + 'x' + hoehe);
pruefe('beschrifteter Knopf steht 1:2', breit && +breit === 2 * +hoehe, breit + 'x' + hoehe);
pruefe('kein Padding zieht die Breite auseinander', /padding:0/.test(werkzeugCss), werkzeugCss);
pruefe('der beschriftete Knopf ist als breit markiert',
  /id="autobtn" class="breit"/.test(html) && !/id="npcbtn" class="breit"/.test(html));

// Alle Symbole kommen aus einem Satz und nehmen die Farbe des Knopfes an.
console.log('\n— Referenzbild (img2img) —');
// Kohaerenz entsteht nur an einem FESTEN Anker. Das letzte Szenenbild taugt
// nicht dafuer, sonst entsteht jedes Bild aus dem vorigen.
frischeWelt(); ctx.verarbeiteWelt(weltJson);
ctx.S.imSpiel = true;
ctx.blattSchreiben('Marcelle', '');
ctx.blattSchreiben(ctx.heldName(), '');
ctx.S.aktBild = '';
pruefe('ohne Blatt und ohne Aktbild gibt es keinen Anker', ctx.referenzQuelle() === null);
ctx.S.aktBild = 'data:image/jpeg;base64,AKT';
pruefe('das erste Bild des Akts ist die Rückfallebene',
  ctx.referenzQuelle().url === 'data:image/jpeg;base64,AKT' && /Akts/.test(ctx.referenzQuelle().woher));
ctx.blattSchreiben(ctx.heldName(), 'data:image/jpeg;base64,HELD');
pruefe('das Blatt des Helden schlägt das Aktbild', ctx.referenzQuelle().url === 'data:image/jpeg;base64,HELD');
ctx.S.verlauf = [{ rolle: 'npc', idx: 0, text: 'Hallo.', name: 'Marcelle' }];
ctx.blattSchreiben('Marcelle', 'data:image/jpeg;base64,MARCELLE');
pruefe('das Blatt der zuletzt sprechenden Figur schlägt beides',
  ctx.referenzQuelle().url === 'data:image/jpeg;base64,MARCELLE' && /Marcelle/.test(ctx.referenzQuelle().woher));
pruefe('das letzte Szenenbild wird bewusst NICHT genommen',
  !/letzteBildUrl/.test((ctx.referenzQuelle.toString() + ctx.referenzBild.toString())));

// Die Vorlage darf nicht daran zerbrechen, wie jemand sie getippt hat.
const mitAnf = ctx.gradioDaten('["{prompt}", "{negativ}", {seed}, "{referenz}", {staerke}]',
  { prompt: 'p', negativ: 'n', seed: 7, referenz: 'data:bild', staerke: 0.4 });
pruefe('Referenz in Anführungszeichen wird ersetzt', mitAnf[3] === 'data:bild' && mitAnf[4] === 0.4, JSON.stringify(mitAnf));
const ohneAnf = ctx.gradioDaten('["{prompt}", {referenz}, {staerke}]',
  { prompt: 'p', referenz: 'data:bild', staerke: 0.4 });
pruefe('auch ohne Anführungszeichen', ohneAnf[1] === 'data:bild' && ohneAnf[2] === 0.4, JSON.stringify(ohneAnf));
const ohneBild = ctx.gradioDaten('["{prompt}", "{referenz}", {staerke}]', { prompt: 'p' });
pruefe('fehlt das Bild, steht dort null', ohneBild[1] === null, JSON.stringify(ohneBild));
pruefe('fehlt die Stärke, gilt der Standard und kein "undefined"', ohneBild[2] === 0.65, JSON.stringify(ohneBild));
const objektForm = (function(){ ctx.CFG.gradioReferenzForm = 'datei'; const w = ctx.referenzWert('data:bild'); ctx.CFG.gradioReferenzForm = 'roh'; return w; })();
pruefe('als Dateiobjekt bekommt Gradio den erwarteten Aufbau',
  objektForm.path === 'data:bild' && objektForm.meta._type === 'gradio.FileData', JSON.stringify(objektForm));
pruefe('roh bleibt die Data-URL', ctx.referenzWert('data:bild') === 'data:bild');
pruefe('ohne Bild bleibt es null', ctx.referenzWert(null) === null);

// Das Charakterblatt darf nie auf einem anderen Bild aufbauen.
pruefe('das Blatt geht ohne Referenz in die Quelle', /ohneReferenz:true/.test(html));
pruefe('die Quelle beachtet das', /CFG\.gradioReferenz&&!a\.ohneReferenz/.test(html));
pruefe('ein neuer Akt setzt den Rückfall-Anker zurück', (function(){
  ctx.W.mission = 'Ziel'; ctx.S.aktZiel = 'Etappe eins'; ctx.S.aktBild = 'data:alt';
  ctx.naechsteEtappe('Etappe zwei');
  return ctx.S.aktBild === '';
})());
pruefe('Schalter und Stärke stehen bei der Bildquelle',
  html.includes("k:'gradioReferenz'") && html.includes("k:'gradioStaerke'") && html.includes("typ:'schalter'"));
ctx.blattSchreiben('Marcelle', ''); ctx.blattSchreiben(ctx.heldName(), '');

console.log('\n— Goldener Symbolsatz —');
pruefe('jeder Knopf holt sein Symbol aus dem Satz',
  ['chronik','figuren','ort','bild','einstellungen','speichern','npcplus'].every(k => html.includes('data-sym="' + k + '"')),
  ['chronik','figuren','ort','bild','einstellungen','speichern','npcplus'].filter(k => !html.includes('data-sym="' + k + '"')).join(','));
pruefe('der Satz kennt jedes davon',
  ['chronik','figuren','ort','bild','einstellungen','speichern','npcplus','mission','wuerfel','regie'].every(k => ctx.SYM[k]),
  Object.keys(ctx.SYM).join(','));
pruefe('gezeichnet wird in der Farbe des Knopfes', /fill="currentColor"/.test(ctx.sym('chronik')));
pruefe('unbekannte Namen ergeben ein leeres, aber gültiges Symbol',
  /<svg[\s\S]*<\/svg>/.test(ctx.sym('gibtsnicht')));
pruefe('die Größe lässt sich vorgeben', /width="22"/.test(ctx.sym('bild', 22)));
pruefe('die Symbole werden beim Start eingesetzt', /symboleEinsetzen\(\);/.test(html));
// Farbige Emoji haben in einer goldenen Leiste nichts verloren.
const emoji = (html.match(/[\u{1F300}-\u{1FAFF}]/gu) || []);
pruefe('kein farbiges Emoji mehr im Generator', emoji.length === 0, emoji.join(' '));

console.log('\n— Formular für neue Figuren —');
// Der Knopf fuehrt zuerst in ein leeres Formular.
pruefe('der Knopf öffnet das Formular', /id="npcbtn"[^>]*onclick="oeffneNeueFigur\(\)"/.test(html));
pruefe('das Formular steht im Markup',
  html.includes('id="mNeueFigur"') && ['name','rolle','aussehen','kleidung','person','stimmung','beziehung','ziel','geheimnis','eroeffnung','hinweis']
    .every(k => html.includes('id="nf_' + k + '"')));
pruefe('es führt beide Wege', /neueFigurUebernehmen\(false\)/.test(html) && /neueFigurUebernehmen\(true\)/.test(html));
const vorgabe = { name: 'Elsa Brandt', rolle: 'Platzanweiserin', aussehen: '', kleidung: '', person: '',
  stimmung: 'genervt', beziehung: 'misstrauisch', ziel: 'Feierabend machen.', geheimnis: '', eroeffnung: '', hinweis: 'kommt mit Taschenlampe' };
const vt = ctx.vorgabeText(vorgabe);
pruefe('die Vorgaben stehen als verbindlich in der Anweisung',
  /VORGABEN DES SPIELERS/.test(vt) && /WOERTLICH/.test(vt) && /Elsa Brandt/.test(vt) && /Taschenlampe/.test(vt), vt);
pruefe('leere Felder tauchen dort nicht auf', !/Aussehen/.test(vt) && !/Was sie verbirgt/.test(vt));
pruefe('ohne jede Eingabe bleibt die Anweisung frei', ctx.vorgabeText({}) === '' && ctx.vorgabeText(null) === '');
const gemischt = ctx.mischeFigur(vorgabe, {
  name: 'Frei Erfunden', rolle: 'Gast', aussehen: 'a tall woman', kleidung: 'a uniform',
  person: 'knapp', grundstimmung: 'heiter', ziel: 'etwas anderes', geheimnis: 'ein Geheimnis', eroeffnung: 'Hallo.'
});
pruefe('eingetragene Angaben schlagen die KI',
  gemischt.name === 'Elsa Brandt' && gemischt.grundstimmung === 'genervt' && gemischt.ziel === 'Feierabend machen.');
pruefe('für leere Felder gilt die KI',
  gemischt.aussehen === 'a tall woman' && gemischt.person === 'knapp' && gemischt.geheimnis === 'ein Geheimnis');
pruefe('die Stimmung wird auf ein Wort gebracht',
  ctx.mischeFigur({ stimmung: 'ziemlich genervt heute' }, { grundstimmung: 'heiter' }).grundstimmung === 'ziemlich');

console.log('\n— Bildregie-Bot —');
// Der Bot ist ein zweiter KI-Aufruf, der nur nach dem Bild fragt. Er darf die
// Figuren nicht neu erfinden und muss ausfallen koennen, ohne das Bild zu
// verhindern.
pruefe('ist ab Werk aus', ctx.CFG.bildBot === false);
pruefe('Schalter steht in den Einstellungen', html.includes('id="cfgBildBot"') && html.includes("CFG.bildBot=!!bb.checked"));
ctx.W.ort = { name: 'Taverne', geschichte: '…', bildPrompt: 'a candlelit tavern' };
ctx.W.npcs = [{ name: 'Ida', rolle: 'Wirtin', aussehen: 'a woman', kleidung: 'an apron' }];
ctx.S.stimmung = ['heiter'];
ctx.S.szeneGlobal = 'a candlelit tavern';
ctx.S.handlung = 'Ida hat dem Helden Wein eingeschenkt.';
ctx.S.verlauf = [
  { rolle: 'npc', idx: 0, text: 'Setz dich, Fremder.', name: 'Ida' },
  { rolle: 'ich', text: 'Ich setze mich ans Feuer.' }
];
const anweisung = ctx.baueBildRegieAnweisung();
pruefe('nennt den Schauplatz', anweisung.includes('a candlelit tavern'));
pruefe('nennt die anwesenden Figuren mit Stimmung', anweisung.includes('Ida') && anweisung.includes('heiter'), anweisung.slice(0, 200));
pruefe('gibt die letzten Zuege mit', anweisung.includes('Setz dich, Fremder.') && anweisung.includes('ans Feuer'));
pruefe('verbietet Aussehen und Stil', /KEINE Namen/.test(anweisung) && /Kein Bildstil/.test(anweisung));
pruefe('verlangt einen englischen Satz', /englischen Satz/.test(anweisung));

pruefe('Anfuehrungszeichen fallen weg', ctx.saeubereBildIdee('"she leans over the table, medium shot"') === 'she leans over the table, medium shot');
pruefe('Codeblock faellt weg', ctx.saeubereBildIdee('```\nwide shot of the tavern\n```') === 'wide shot of the tavern');
pruefe('Vorrede faellt weg', ctx.saeubereBildIdee('Sure! Here it is:\nScene: close-up of her hands') === 'close-up of her hands');
pruefe('leere Antwort bleibt leer', ctx.saeubereBildIdee('') === '' && ctx.saeubereBildIdee(null) === '');
pruefe('zu lange Antwort wird gekuerzt', ctx.saeubereBildIdee('x'.repeat(600)).length <= ctx.BILDBOT_MAX);

console.log('\n— Negativprompt —');
ctx.S.stilLabel = 'realistisch'; ctx.S.stil = ctx.STILE.realistisch;
pruefe('Stil-Negativ ergänzt', ctx.baueNegativ().includes('airbrushed skin'));
ctx.S.stilLabel = 'manga'; ctx.S.stil = ctx.STILE.manga;
pruefe('Basis-Negativ immer dabei', ctx.baueNegativ().includes('bad anatomy'));

console.log('\n— Befehlserkennung —');
const treffer = t => { for (const b of ctx.BEFEHLE) { const m = t.match(b.muster); if (m) return { b, m }; } return null; };
pruefe('/npc2: erkannt', treffer('/npc2: sei frech').m[1] === '2');
pruefe('/npc 2 : mit Leerzeichen', treffer('/npc 2 : sei frech').m[1] === '2');
pruefe('/kleidung1:', treffer('/kleidung1: a red dress').m[2] === 'a red dress');
pruefe('/sag: vor /stil:', treffer('/sag: hallo').m[1] === 'hallo');
pruefe('/hilfe', !!treffer('/hilfe'));
pruefe('/nochmal kollidiert nicht mit /npc', treffer('/nochmal') && treffer('/nochmal').b.hilfe[0] === '/nochmal');
pruefe('normaler Text ist kein Befehl', treffer('Guten Abend!') === null);
pruefe('Text mit Schrägstrich im Satz', treffer('Ich gehe zum Markt/Hafen') === null);

console.log('\n— Bildquellen-Registry —');
['perchance', 'pollinations', 'horde', 'api', 'gradio', 'url'].forEach(k =>
  pruefe(`Quelle "${k}" registriert`, !!ctx.BILDQUELLEN[k]));
pruefe('jede hat label/info/zeichne', Object.values(ctx.BILDQUELLEN).every(q => q.label && q.info && typeof q.zeichne === 'function'));
pruefe('auf64 rundet', ctx.auf64(1000) === 1024 && ctx.auf64(100) === 256 && ctx.auf64(9000) === 2048);
ctx.CFG.urlVorlage = 'https://x.test/i?p={prompt}&n={negativ}&s={seed}&w={breite}&h={hoehe}';
let gebaut = null;
ctx.ladeBildUrl = u => { gebaut = u; return Promise.resolve(u); };
ctx.BILDQUELLEN.url.zeichne({ prompt: 'a cat & dog', negativ: 'blurry', seed: 42, breite: 512, hoehe: 512 });
pruefe('URL-Vorlage füllt Platzhalter', gebaut === 'https://x.test/i?p=a%20cat%20%26%20dog&n=blurry&s=42&w=512&h=512', gebaut);

console.log('\n— Gradio-Space —');
// Die Parameterliste eines Space ist von Space zu Space verschieden, deshalb
// eine Vorlage. Platzhalter in Anführungszeichen werden zu Zeichenketten,
// die anderen zu Zahlen.
const daten = ctx.gradioDaten('["{prompt}", "{negativ}", {seed}, false, {breite}, {hoehe}, 7, 28]',
  { prompt: 'ein "Test" mit Anführungszeichen', negativ: 'blurry', seed: 42, breite: 1024, hoehe: 1024 });
pruefe('Vorlage ergibt eine Liste', Array.isArray(daten) && daten.length === 8, JSON.stringify(daten));
pruefe('Anführungszeichen im Prompt zerlegen die Liste nicht', daten[0] === 'ein "Test" mit Anführungszeichen', daten[0]);
pruefe('Zahlen bleiben Zahlen', daten[2] === 42 && daten[4] === 1024 && typeof daten[3] === 'boolean');
let vFehler = '';
try { ctx.gradioDaten('{"a":1}', { prompt: 'x', seed: 1, breite: 512, hoehe: 512 }); } catch (e) { vFehler = e.message; }
pruefe('Vorlage ohne Liste wird abgelehnt', /Liste/.test(vFehler), vFehler);

const H = 'https://beispiel.hf.space';
pruefe('Bild als data-Adresse', ctx.bildAusGradio(['data:image/png;base64,xx'], H) === 'data:image/png;base64,xx');
pruefe('Bild als Objekt mit url', ctx.bildAusGradio([{ url: 'https://x.test/a.png', path: '/tmp/a.png' }], H) === 'https://x.test/a.png');
pruefe('Bild als Objekt mit path', ctx.bildAusGradio([{ path: '/tmp/a.png' }], H) === H + '/gradio_api/file=/tmp/a.png');
pruefe('Bild tief verschachtelt', ctx.bildAusGradio({ a: { b: [null, { c: [{ path: '/tmp/z.webp' }] }] } }, H) === H + '/gradio_api/file=/tmp/z.webp');
pruefe('nichts Brauchbares ergibt null', ctx.bildAusGradio([null, 3, { seed: 7 }], H) === null);

pruefe('Antwortstrom: letzte Datenzeile gewinnt',
  JSON.stringify(ctx.sseDaten('event: generating\ndata: null\n\nevent: complete\ndata: [{"path":"/tmp/f.png"}]\n')) === '[{"path":"/tmp/f.png"}]',
  JSON.stringify(ctx.sseDaten('event: complete\ndata: [{"path":"/tmp/f.png"}]')));
pruefe('Antwortstrom ohne Daten ergibt null', ctx.sseDaten('event: heartbeat\n\n') === null);

console.log('\n— Gradio: Warteschlange und Vorlagenbau —');
// Der Space nutzt queue/join + queue/data. Der Strom endet mit
// process_completed; darin stecken die Ausgabedaten.
const strom = [
  'data: {"msg":"estimation","rank":3}',
  'data: {"msg":"process_starts"}',
  'data: {"msg":"process_completed","success":true,"output":{"data":[{"path":"/tmp/gradio/abc.png","url":"https://x.hf.space/gradio_api/file=/tmp/gradio/abc.png"},1234]}}',
  'data: {"msg":"close_stream"}'
].join('\n');
const aus = ctx.gradioQueueErgebnis(strom);
pruefe('Ausgabedaten aus process_completed', Array.isArray(aus) && aus[0].path === '/tmp/gradio/abc.png', JSON.stringify(aus));
pruefe('Bild daraus gefunden', ctx.bildAusGradio(aus, 'https://x.hf.space') === 'https://x.hf.space/gradio_api/file=/tmp/gradio/abc.png');
pruefe('Zwischenmeldungen stören nicht', ctx.gradioQueueErgebnis('data: {"msg":"estimation"}\n') === null);

let qFehler = '';
try { ctx.gradioQueueErgebnis('data: {"msg":"process_completed","success":false,"output":{"error":"GPU quota exceeded"}}'); }
catch (e) { qFehler = e.message; }
pruefe('Fehlschlag wird zur Meldung', /GPU quota/.test(qFehler), qFehler);
qFehler = '';
try { ctx.gradioQueueErgebnis('data: {"msg":"queue_full","message":"Warteschlange voll"}'); } catch (e) { qFehler = e.message; }
pruefe('volle Warteschlange wird gemeldet', /voll/.test(qFehler), qFehler);

// Vorlagenbau aus der Parameterliste von /gradio_api/info
const vorlage = ctx.gradioVorlageAus([
  { parameter_name: 'prompt', python_type: { type: 'str' } },
  { parameter_name: 'negative_prompt', python_type: { type: 'str' } },
  { parameter_name: 'seed', python_type: { type: 'float' } },
  { parameter_name: 'randomize_seed', python_type: { type: 'bool' }, parameter_has_default: true, parameter_default: true },
  { parameter_name: 'width', python_type: { type: 'float' } },
  { parameter_name: 'height', python_type: { type: 'float' } },
  { parameter_name: 'guidance_scale', python_type: { type: 'float' }, parameter_has_default: true, parameter_default: 7 },
  { parameter_name: 'num_inference_steps', python_type: { type: 'float' }, parameter_has_default: true, parameter_default: 28 }
]);
pruefe('Vorlage aus Parameterliste',
  vorlage === '["{prompt}", "{negativ}", {seed}, false, {breite}, {hoehe}, 7, 28]', vorlage);
pruefe('negative_prompt wird nicht als prompt erkannt', vorlage.indexOf('"{negativ}"') > vorlage.indexOf('"{prompt}"'));
// Wichtig: randomize_seed muss aus bleiben, sonst würfelt der Space selbst
// und die Figuren verlieren ihre Wiedererkennbarkeit.
pruefe('randomize_seed wird abgeschaltet, trotz Vorgabewert true', /\{seed\}, false,/.test(vorlage), vorlage);
const gefuellt = ctx.gradioDaten(vorlage, { prompt: 'a', negativ: 'b', seed: 7, breite: 1024, hoehe: 768 });
pruefe('gebaute Vorlage lässt sich füllen', gefuellt.length === 8 && gefuellt[2] === 7 && gefuellt[5] === 768, JSON.stringify(gefuellt));

console.log('\n— Vorlage aus den Vorgaben des Space —');
// Genau die 14 Parameter, die der Space laut Erkundung anbietet.
const spaceParams = [
  { parameter_name: 'prompt', python_type: { type: 'str' } },
  { parameter_name: 'negative_prompt', python_type: { type: 'str' } },
  { parameter_name: 'seed', python_type: { type: 'float' } },
  { parameter_name: 'custom_width', python_type: { type: 'float' } },
  { parameter_name: 'custom_height', python_type: { type: 'float' } },
  { parameter_name: 'guidance_scale', python_type: { type: 'float' } },
  { parameter_name: 'num_inference_steps', python_type: { type: 'float' } },
  { parameter_name: 'sampler', python_type: { type: 'str' } },
  { parameter_name: 'model_name', python_type: { type: 'str' } },
  { parameter_name: 'aspect_ratio_selector', python_type: { type: 'str' } },
  { parameter_name: 'use_upscaler', python_type: { type: 'bool' } },
  { parameter_name: 'upscaler_strength', python_type: { type: 'float' } },
  { parameter_name: 'upscale_by', python_type: { type: 'float' } },
  { parameter_name: 'add_quality_tags', python_type: { type: 'bool' } }
];
const spaceDep = { api_name: 'generate', id: 5, inputs: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] };
const spaceComps = [
  { id: 10, props: { value: '' } }, { id: 11, props: { value: '' } },
  { id: 12, props: { value: 0, minimum: 0 } },
  { id: 13, props: { value: 1024, minimum: 1024 } }, { id: 14, props: { value: 1024, minimum: 1024 } },
  { id: 15, props: { value: 7 } }, { id: 16, props: { value: 28 } },
  { id: 17, props: { value: 'Euler a', choices: [['Euler a', 'Euler a'], ['DPM++ 2M', 'DPM++ 2M']] } },
  { id: 18, props: { value: 'WAI-illustrious', choices: [['WAI-illustrious', 'WAI-illustrious']] } },
  { id: 19, props: { value: '1024 x 1024', choices: [['1024 x 1024', '1024 x 1024'], ['Custom', 'Custom']] } },
  { id: 20, props: { value: false } }, { id: 21, props: { value: 0.55 } },
  { id: 22, props: { value: 1.5 } }, { id: 23, props: { value: true } }
];
const v = ctx.gradioVorlageAusConfig(spaceParams, spaceDep, spaceComps);
const geparst = JSON.parse(v.replace(/"\{prompt\}"/, '"P"').replace(/"\{negativ\}"/, '"N"')
  .replace(/\{seed\}/, '1').replace(/\{breite\}/, '2').replace(/\{hoehe\}/, '3'));
pruefe('alle 14 Parameter in der Vorlage', geparst.length === 14, String(geparst.length));
pruefe('Platzhalter an den richtigen Stellen', geparst[0] === 'P' && geparst[1] === 'N' && geparst[2] === 1 && geparst[3] === 2 && geparst[4] === 3, JSON.stringify(geparst.slice(0, 5)));
pruefe('sampler kommt aus der Vorgabe des Space', geparst[7] === 'Euler a', String(geparst[7]));
pruefe('model_name kommt aus der Vorgabe', geparst[8] === 'WAI-illustrious', String(geparst[8]));
// Ohne "Custom" bleiben custom_width und custom_height wirkungslos.
pruefe('aspect_ratio_selector wird auf Custom gestellt', geparst[9] === 'Custom', String(geparst[9]));
pruefe('Wahrheitswerte übernommen', geparst[10] === false && geparst[13] === true);
pruefe('Kommazahlen übernommen', geparst[11] === 0.55 && geparst[12] === 1.5);
const gef = ctx.gradioDaten(v, { prompt: 'x', negativ: 'y', seed: 99, breite: 1024, hoehe: 1024 });
pruefe('Vorlage lässt sich füllen', gef.length === 14 && gef[3] === 1024 && gef[9] === 'Custom', JSON.stringify(gef.slice(0, 5)));

console.log('\n— Endpunktwahl im Space —');
// Genau die Endpunkte, die der Space laut Fehlermeldung anbietet.
const deps = [
  { api_name: 'load_example', id: 0 },
  { api_name: 'lambda', id: 1 },
  { api_name: 'generate', id: 2 },
  { api_name: 'lambda_1', id: 3 },
  { api_name: null, id: 4 }
];
pruefe('genauer Treffer gewinnt', ctx.waehleEndpunkt(deps, '/generate').id === 2);
pruefe('führender Schrägstrich egal', ctx.waehleEndpunkt(deps, 'generate').id === 2);
pruefe('leeres Feld findet generate', ctx.waehleEndpunkt(deps, '').id === 2);
pruefe('Unsinn im Feld findet generate statt abzubrechen', ctx.waehleEndpunkt(deps, 'False').id === 2, 'False');
pruefe('undefined ebenso', ctx.waehleEndpunkt(deps, undefined).id === 2);
pruefe('Tippfehler fällt auf generate zurück', ctx.waehleEndpunkt(deps, '/genrate').id === 2);
pruefe('Hilfsendpunkte werden nie blind genommen',
  ctx.waehleEndpunkt([{ api_name: 'lambda', id: 0 }, { api_name: 'load_example', id: 1 }], 'False') === null);
pruefe('ohne Endpunkte null', ctx.waehleEndpunkt([], 'x') === null);
pruefe('Alternativname infer wird erkannt', ctx.waehleEndpunkt([{ api_name: 'infer', id: 7 }], '').id === 7);
pruefe('id wird gegenüber der Position bevorzugt', ctx.waehleEndpunkt([{ api_name: 'generate', id: 42 }], '').id === 42);
pruefe('ohne id zählt die Position', ctx.waehleEndpunkt([{ api_name: 'a' }, { api_name: 'generate' }], '').id === 1);

console.log('\n— Seeds für externe Dienste —');
pruefe('zwölfstelliger Seed wird auf 32 Bit gefaltet', ctx.seedFuerDienst(777777777777) <= 2147483647);
pruefe('gefalteter Seed bleibt stabil', ctx.seedFuerDienst(777777777777) === ctx.seedFuerDienst(777777777777));
pruefe('Null wird nie durchgereicht', ctx.seedFuerDienst(0) >= 1 && ctx.seedFuerDienst('') >= 1);
pruefe('kleiner Seed bleibt unverändert', ctx.seedFuerDienst(4242) === 4242);
let seedsOk = true;
for (let i = 0; i < 500; i++) { const n = ctx.neuerSeed(); if (!(n >= 1 && n <= 2147483647)) seedsOk = false; }
pruefe('neue Seeds liegen im 32-Bit-Bereich', seedsOk);

console.log('\n— Maße für die AI Horde —');
// Die Horde lehnt bei hoher Auslastung alles über 907×907 ab (HTTP 403).
const GRENZE = 907 * 907;
[[1024, 1024], [1024, 768], [768, 1024], [2048, 2048], [512, 512], [256, 256]].forEach(([b, h]) => {
  const m = ctx.hordeMasse(b, h);
  const passt = m.breite * m.hoehe <= GRENZE;
  const raster = m.breite % 64 === 0 && m.hoehe % 64 === 0;
  pruefe(`${b}×${h} → ${m.breite}×${m.hoehe} liegt unter der Grenze und im 64er-Raster`, passt && raster,
    `${m.breite * m.hoehe} Pixel`);
});
const klein = ctx.hordeMasse(512, 512);
pruefe('kleine Maße bleiben unangetastet', klein.breite === 512 && klein.hoehe === 512);
const quer = ctx.hordeMasse(1024, 768);
pruefe('Seitenverhältnis bleibt ungefähr erhalten', Math.abs((quer.breite / quer.hoehe) - (1024 / 768)) < 0.12,
  `${(quer.breite / quer.hoehe).toFixed(2)} statt ${(1024 / 768).toFixed(2)}`);

console.log('\n— Kopfleiste ein-/ausklappen —');
const vorZustand = ctx.CFG.kopfOffen;
ctx.kopfUmschalten();
pruefe('Umschalten kehrt den Zustand um', ctx.CFG.kopfOffen === !vorZustand);
ctx.kopfUmschalten();
pruefe('zweimal Umschalten stellt ihn wieder her', ctx.CFG.kopfOffen === vorZustand);
pruefe('Zustand landet in der Konfiguration', JSON.parse(store['proxima_cfg_v1']).kopfOffen === vorZustand);

console.log('\n— Speicherstand —');
ctx.W.ort = { name: 'Taverne', geschichte: '…', bildPrompt: '…' };
ctx.S.rueckgaengig = ['grosser schnappschuss'];
ctx.S.verlauf = Array.from({ length: 700 }, (_, i) => ({ rolle: 'ich', text: 'z' + i }));
const so = ctx.standObjekt();
pruefe('Undo-Puffer wird nicht mitgespeichert', so.stand.rueckgaengig.length === 0);
pruefe('Verlauf gedeckelt', so.stand.verlauf.length === 600);
pruefe('Original bleibt unangetastet', ctx.S.verlauf.length === 700 && ctx.S.rueckgaengig.length === 1);
pruefe('Stand gilt als gültig', ctx.pruefeStand(so) === true);
pruefe('halber Stand wird abgelehnt', ctx.pruefeStand({ welt: {}, stand: {} }) === false);

console.log('\n— Migration eines V6-Stands —');
const alt = {
  welt: { protagonist: { name: 'Egon' }, ort: { name: 'Taverne', seed: '777777777777' }, npcs: [{ name: 'Ida', grundstimmung: 'heiter', kleidung: 'apron' }] },
  stand: { verlauf: [], bildVersion: 3, imSpiel: false }
};
const neu = ctx.migriere(alt);
pruefe('Seed vom Ort übernommen', neu.stand.seed === 777777777777, String(neu.stand.seed));
pruefe('Fakten-Feld angelegt', Array.isArray(neu.stand.fakten));
pruefe('Stimmungen aus NPCs abgeleitet', neu.stand.stimmung[0] === 'heiter');
pruefe('transiente Flags zurückgesetzt', neu.stand.bildLaeuft === false && neu.stand.autoAktiv === false && neu.stand.imSpiel === true);
pruefe('Held-Aussehen ergänzt', neu.welt.protagonist.aussehen === '');

// ── Ladeschale ────────────────────────────────────────────────────────────
// Die Schale wird im selben Verfahren geprüft wie der Generator: Skript aus
// der HTML-Datei ziehen, in einen DOM-Stub setzen, Netz durch einen Stummel
// ersetzen. Sie startet beim Auswerten von selbst — deshalb erst warten,
// dann prüfen.
function netzStummel(routen) {
  const rufe = [];
  const f = async (adresse) => {
    rufe.push(String(adresse));
    for (const r of routen) {
      if (String(adresse).includes(r.wenn)) {
        if (r.fehler) throw new Error(r.fehler);
        if (r.status && r.status >= 400) return { ok: false, status: r.status, text: async () => '' };
        return { ok: true, status: 200, text: async () => r.text };
      }
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  f.rufe = rufe;
  return f;
}

function ladeUmgebung(fetchStummel, opt) {
  opt = opt || {};
  const elemente = {}, angehaengt = [];
  const mk = id => (elemente[id] = elemente[id] || {
    id, tag: '', textContent: '', innerHTML: '', className: '', style: {}, parentNode: null,
    addEventListener(_, f) { this.klick = f; },
    appendChild(kind) { angehaengt.push(kind); return kind; },
    removeChild() {}
  });
  ['prx-app', 'prx-lade', 'prx-status', 'prx-hinweis', 'prx-knopf', 'prx-balken', 'prx-quelle', 'head', 'body'].forEach(mk);
  const speicher = Object.assign({}, opt.speicher || {});
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    setTimeout, clearTimeout, Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp, Promise, Error,
    encodeURIComponent, decodeURIComponent, isNaN, parseInt, parseFloat,
    fetch: fetchStummel,
    location: { search: opt.search || '', hash: opt.hash || '' },
    localStorage: {
      getItem: k => (k in speicher ? speicher[k] : null),
      setItem: (k, v) => { speicher[k] = String(v); },
      removeItem: k => { delete speicher[k]; }
    },
    document: {
      getElementById: id => elemente[id] || null,
      createElement: tag => { const e = mk('neu-' + tag + '-' + angehaengt.length); e.tag = tag; return e; },
      get head() { return elemente.head; },
      get body() { return elemente.body; }
    }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(laderSrc, ctx);
  return { ctx, elemente, angehaengt, speicher, rufe: fetchStummel.rufe };
}

const warte = () => new Promise(r => setTimeout(r, 20));
const eingehaengt = (angehaengt, tag) => angehaengt.filter(e => e.tag === tag);

// Der Bot haengt an frageKI und ist damit asynchron: Faellt der Aufruf aus,
// muss null herauskommen — dann zeichnet der Generator wie bisher aus der
// Dialogregie weiter.
// Der Lektor ist asynchron: eingeschaltet fragt er, ausgeschaltet nicht, und
// ein Ausfall darf die Zeile nicht kosten.
async function lektorPruefen() {
  console.log('\n— Lektor: Aufruf —');
  const echtLekt = ctx.frageKI;
  ctx.CFG.lektor = false;
  pruefe('ausgeschaltet fragt er gar nicht',
    (await ctx.lektor('Originalzeile.', 'Marcelle')) === 'Originalzeile.');
  ctx.CFG.lektor = true;
  ctx.frageKI = () => Promise.resolve('OK');
  pruefe('sagt er OK, bleibt die Zeile', (await ctx.lektor('Originalzeile.', 'Marcelle')) === 'Originalzeile.');
  ctx.frageKI = () => Promise.resolve('Bessere Zeile.');
  pruefe('sonst schreibt er sie neu', (await ctx.lektor('Originalzeile.', 'Marcelle')) === 'Bessere Zeile.');
  const stillLekt = ctx.console.warn; ctx.console.warn = function(){};
  ctx.frageKI = () => Promise.reject(new Error('kein Plugin'));
  pruefe('faellt er aus, bleibt die Zeile unangetastet', (await ctx.lektor('Originalzeile.', 'Marcelle')) === 'Originalzeile.');
  ctx.console.warn = stillLekt;
  ctx.frageKI = echtLekt; ctx.CFG.lektor = false; ctx.S.probe = null;
}

async function bildRegiePruefen() {
  console.log('\n— Bildregie-Bot: Aufruf —');
  const echteFrage = ctx.frageKI, echteWarnung = ctx.console.warn;
  ctx.console.warn = function(){};   // der erwartete Ausfall soll den Bericht nicht zumuellen
  ctx.frageKI = () => Promise.reject(new Error('kein Text-Plugin'));
  pruefe('Ausfall des Bots gibt null zurueck, statt zu werfen', (await ctx.bildRegie()) === null);
  ctx.frageKI = () => Promise.resolve('  "a wide shot of the smoky tavern, warm firelight"  ');
  pruefe('Antwort wird sauber uebernommen',
    (await ctx.bildRegie()) === 'a wide shot of the smoky tavern, warm firelight');
  ctx.frageKI = () => Promise.resolve('ok');
  pruefe('zu kurze Antwort gilt als nichts', (await ctx.bildRegie()) === null);
  ctx.frageKI = echteFrage;
  ctx.console.warn = echteWarnung;
}

async function ladeschalePruefen() {
  console.log('\n— Ladeschale: Aufteilen —');
  const nur = ladeUmgebung(netzStummel([]), {});
  await warte();
  const teile = nur.ctx.PROXIMA_LADER.teile(html);
  pruefe('Stil, Markup und Skript werden getrennt', !!teile.stil.trim() && !!teile.markup.trim() && !!teile.skript.trim());
  pruefe('Markup enthält keine Blöcke mehr', !/<script|<style/i.test(teile.markup));
  pruefe('Skript ist der Generator', teile.skript.includes('function weltErstellen'));
  pruefe('Stil ist das Stylesheet', teile.stil.includes('#start'));

  console.log('\n— Ladeschale: Normalfall —');
  const gut = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]), {});
  await warte();
  pruefe('holt von raw.githubusercontent.com',
    gut.rufe[0].startsWith('https://raw.githubusercontent.com/Colimbuli/MeinGitHub/main/proxima/proxima.app.html?v='), gut.rufe[0]);
  pruefe('genau ein Netzaufruf', gut.rufe.length === 1, gut.rufe.join(' '));
  pruefe('Markup eingebaut', gut.elemente['prx-app'].innerHTML.includes('id="start"'));
  pruefe('Stil eingehängt', eingehaengt(gut.angehaengt, 'style').some(e => e.textContent.includes('#start')));
  pruefe('Generator als script-Element eingehängt, nicht per eval',
    eingehaengt(gut.angehaengt, 'script').some(e => e.textContent.includes('function weltErstellen')));
  pruefe('Ladeschirm verschwindet', gut.elemente['prx-lade'].className === 'aus');
  pruefe('Fassung wird gemerkt', JSON.parse(gut.speicher['proxima.quelltext']).text.includes('weltErstellen'));

  console.log('\n— Ladeschale: Zweig umschalten —');
  const zweig = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]), { hash: '#prx-zweig=probe' });
  await warte();
  pruefe('Zweig aus der Adresszeile wird benutzt', zweig.rufe[0].includes('/MeinGitHub/probe/'), zweig.rufe[0]);
  pruefe('Zweig bleibt gemerkt', zweig.speicher['proxima.zweig'] === 'probe');
  const zurueck = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]),
    { hash: '#prx-zweig=standard', speicher: { 'proxima.zweig': 'probe' } });
  await warte();
  pruefe('standard schaltet zurück', zurueck.rufe[0].includes('/MeinGitHub/main/'), zurueck.rufe[0]);

  console.log('\n— Ladeschale: Rückfallebenen —');
  const spiegel = ladeUmgebung(netzStummel([
    { wenn: 'raw.githubusercontent.com', fehler: 'Netzfehler' },
    { wenn: 'cdn.jsdelivr.net', text: html }
  ]), {});
  await warte();
  pruefe('fällt auf jsDelivr zurück', spiegel.rufe.length === 2 && spiegel.rufe[1].includes('cdn.jsdelivr.net'), spiegel.rufe.join(' '));
  pruefe('Generator läuft trotzdem', eingehaengt(spiegel.angehaengt, 'script').length === 1);

  const gemerkt = ladeUmgebung(netzStummel([{ wenn: 'http', fehler: 'kein Netz' }]),
    { speicher: { 'proxima.quelltext': JSON.stringify({ zweig: 'main', zeit: Date.now(), text: html }) } });
  await warte();
  pruefe('ohne Netz läuft die gemerkte Fassung', eingehaengt(gemerkt.angehaengt, 'script').length === 1);
  pruefe('Ladeschirm verschwindet auch dann', gemerkt.elemente['prx-lade'].className === 'aus');

  console.log('\n— Ladeschale: Plugin-Bruecke —');
  // Perchance reicht ai() und image() im Geltungsbereich des HTML-Bereichs
  // durch, und oft erst Sekunden nach dem Laden. Der als script-Element
  // eingehaengte Generator sieht nur den globalen Namensraum — die Schale muss
  // die Namen also dorthin nachreichen, und zwar auch dann noch, wenn das
  // Plugin sich erst spaeter meldet.
  const echtesImage = () => 'bild';
  const schon = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]), {});
  schon.ctx.image = echtesImage;
  await warte();
  pruefe('vorhandenes image bleibt unangetastet', schon.ctx.image === echtesImage);

  const ausRoot = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]), {});
  ausRoot.ctx.root = { image: echtesImage };
  await warte();
  pruefe('image aus root wird gebrueckt', typeof ausRoot.ctx.image === 'function');
  pruefe('die Bruecke ruft die echte Funktion', ausRoot.ctx.image && ausRoot.ctx.image({}) === 'bild');

  const spaet = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]), {});
  await warte();
  pruefe('fehlendes Plugin fuehrt nicht in eine Endlosschleife', spaet.ctx.image === undefined);
  spaet.ctx.root = { image: echtesImage };
  pruefe('spaeter nachgeladenes Plugin wird ohne Zutun gefunden', spaet.ctx.image && spaet.ctx.image({}) === 'bild');
  pruefe('die Schale nennt ihre Fassung', typeof spaet.ctx.PROXIMA_LADER.version === 'string');
  const lage = spaet.ctx.PROXIMA_LADER.plugins();
  pruefe('die Schale sagt, was sie gefunden hat', typeof lage.ai === 'string' && typeof lage.image === 'string',
    JSON.stringify(lage));

  const meldetSich = ladeUmgebung(netzStummel([{ wenn: 'raw.githubusercontent.com', text: html }]), {});
  await warte();
  meldetSich.ctx.image = echtesImage;   // Plugin traegt sich selbst ein
  pruefe('meldet das Plugin sich selbst an, gilt sein Eintrag', meldetSich.ctx.image === echtesImage);

  console.log('\n— Ladeschale: Fehlerfall —');
  const weg = ladeUmgebung(netzStummel([{ wenn: 'http', status: 404 }]), {});
  await warte();
  pruefe('nichts wird eingebaut', eingehaengt(weg.angehaengt, 'script').length === 0);
  pruefe('Hinweis wird sichtbar', weg.elemente['prx-hinweis'].style.display === 'block');
  pruefe('404 erklärt das private Repository', weg.elemente['prx-hinweis'].textContent.includes('privat'),
    weg.elemente['prx-hinweis'].textContent);
  pruefe('Knopf zum erneuten Versuch erscheint', weg.elemente['prx-knopf'].style.display === 'inline-block');

}

// Der asynchrone Teil (Quellenwechsel, dann die Ladeschale) laeuft zum Schluss,
// danach die Auswertung.
laufen().then(lektorPruefen).then(bildRegiePruefen).then(ladeschalePruefen).then(() => {
  console.log('\n' + (bad ? '✗ ' + bad + ' Fehler, ' : '✓ alles grün — ') + ok + ' Prüfungen bestanden');
  process.exit(bad ? 1 : 0);
}).catch(e => {
  console.log('\n✗ Test brach ab: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
