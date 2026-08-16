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
  window: { open() {} },
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
const listenVerweise = markup.match(/\[[A-Za-zÄÖÜäöüß_][^\]]*\]/g) || [];
pruefe('keine eckigen Klammern im Markup (nur &#91; &#93;)', listenVerweise.length === 0, listenVerweise.join(' '));
const inlineWahl = markup.match(/\{[^}]*\}/g) || [];
pruefe('keine geschweiften Klammern im Markup', inlineWahl.length === 0, inlineWahl.join(' '));
pruefe('Klammer-Hinweis für den Spieler bleibt sichtbar', markup.includes('&#91;eckigen Klammern&#93;'));

// Perchance liest den Klammerinhalt als JS-Ausdruck — auch im <script>-Block.
// ['a','b'] und [i] sind gültiges JavaScript und stören nicht; zwei nackte
// Wörter wie [eckigen Klammern] sind ein Syntaxfehler und legen den
// Generator lahm. In Zeichenketten deshalb \x5B und \x5D schreiben.
const nackteWorte = (html.match(/\[[^\]\n]*\]/g) || []).filter(k =>
  /^\[\s*[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*(\s+[A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß0-9_]*)+\s*\]$/.test(k));
pruefe('keine nackten Wortfolgen in eckigen Klammern (ganze Datei)', nackteWorte.length === 0, nackteWorte.join(' '));
pruefe('Version im Startbildschirm ablesbar', /V\d+\.\d+/.test(markup));

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

console.log('\n' + (bad ? '✗ ' + bad + ' Fehler, ' : '✓ alles grün — ') + ok + ' Prüfungen bestanden');
process.exit(bad ? 1 : 0);
