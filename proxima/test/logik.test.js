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
pruefe('fünf Quellen registriert', Object.keys(ctx.BILDQUELLEN).length === 5, Object.keys(ctx.BILDQUELLEN).join(','));
pruefe('jede hat label/info/zeichne', Object.values(ctx.BILDQUELLEN).every(q => q.label && q.info && typeof q.zeichne === 'function'));
pruefe('auf64 rundet', ctx.auf64(1000) === 1024 && ctx.auf64(100) === 256 && ctx.auf64(9000) === 2048);
ctx.CFG.urlVorlage = 'https://x.test/i?p={prompt}&n={negativ}&s={seed}&w={breite}&h={hoehe}';
let gebaut = null;
ctx.ladeBildUrl = u => { gebaut = u; return Promise.resolve(u); };
ctx.BILDQUELLEN.url.zeichne({ prompt: 'a cat & dog', negativ: 'blurry', seed: 42, breite: 512, hoehe: 512 });
pruefe('URL-Vorlage füllt Platzhalter', gebaut === 'https://x.test/i?p=a%20cat%20%26%20dog&n=blurry&s=42&w=512&h=512', gebaut);

console.log('\n— Seeds für externe Dienste —');
pruefe('zwölfstelliger Seed wird auf 32 Bit gefaltet', ctx.seedFuerDienst(777777777777) <= 2147483647);
pruefe('gefalteter Seed bleibt stabil', ctx.seedFuerDienst(777777777777) === ctx.seedFuerDienst(777777777777));
pruefe('Null wird nie durchgereicht', ctx.seedFuerDienst(0) >= 1 && ctx.seedFuerDienst('') >= 1);
pruefe('kleiner Seed bleibt unverändert', ctx.seedFuerDienst(4242) === 4242);
let seedsOk = true;
for (let i = 0; i < 500; i++) { const n = ctx.neuerSeed(); if (!(n >= 1 && n <= 2147483647)) seedsOk = false; }
pruefe('neue Seeds liegen im 32-Bit-Bereich', seedsOk);

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
