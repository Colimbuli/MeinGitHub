// Prüft die reine Logik von proxima.html (Parser, Prompt-Bau, Befehle,
// Speicherstände) gegen einen minimalen DOM-Stub. Aufruf: node test/logik.test.js
// Das Skript wird direkt aus der HTML-Datei gezogen, damit der Test nicht
// gegen eine veraltete Kopie läuft.
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'proxima.html'), 'utf8');
const block = html.match(/<script>([\s\S]*)<\/script>/);
if (!block) { console.error('Kein <script>-Block in proxima.html gefunden.'); process.exit(1); }
const src = block[1];

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

console.log('\n— Perchance-Syntax im Markup —');
// Perchance wertet den HTML-Bereich als Vorlage aus: ein eingeklammertes Wort
// gilt dort als Listenverweis und lässt den Generator mit Syntaxfehler abbrechen.
// Das betrifft Attribute, Text UND Kommentare — nur <script> und <style> sind frei.
const markup = html.replace(/<script>[\s\S]*?<\/script>/g, '').replace(/<style>[\s\S]*?<\/style>/g, '');
// Entities wie der Browser auflösen: &#91; wird zu [, BEVOR Perchance abtastet.
// Ein Escape im Quelltext hilft hier also nicht — nur der Verzicht auf Klammern.
const dekodiert = markup
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&lsqb;|&lbrack;/g, '[').replace(/&rsqb;|&rbrack;/g, ']');
const listenVerweise = dekodiert.match(/\[[A-Za-zÄÖÜäöüß_][^\]]*\]/g) || [];
pruefe('keine eckigen Klammern im Start-Markup, auch nicht als Entity', listenVerweise.length === 0, listenVerweise.join(' '));
const inlineWahl = dekodiert.match(/\{[^}]*\}/g) || [];
pruefe('keine geschweiften Klammern im Start-Markup', inlineWahl.length === 0, inlineWahl.join(' '));
pruefe('Hinweis auf eckige Klammern bleibt als Wortlaut erhalten', markup.includes('in eckigen Klammern'));

// Perchance liest den Klammerinhalt als JS-Ausdruck — auch im <script>-Block.
// ['a','b'] und [i] sind gültiges JavaScript und stören nicht; zwei nackte
// Wörter wie [eckigen Klammern] sind ein Syntaxfehler und legen den
// Generator lahm. In Zeichenketten deshalb \x5B und \x5D schreiben.
const nackteWorte = (html.match(/\[[^\]\n]*\]/g) || []).filter(k =>
  /^\[\s*[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*(\s+[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*)+\s*\]$/.test(k));
pruefe('keine nackten Wortfolgen in eckigen Klammern (ganze Datei)', nackteWorte.length === 0, nackteWorte.join(' '));
pruefe('Version im Startbildschirm ablesbar', /V\d+\.\d+/.test(markup));

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

// Der asynchrone Teil (Quellenwechsel) laeuft zum Schluss, danach die Auswertung.
laufen().then(() => {
  console.log('\n' + (bad ? '✗ ' + bad + ' Fehler, ' : '✓ alles grün — ') + ok + ' Prüfungen bestanden');
  process.exit(bad ? 1 : 0);
}).catch(e => {
  console.log('\n✗ Test brach ab: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
