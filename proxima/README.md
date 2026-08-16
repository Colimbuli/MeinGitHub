# PROXIMA

Ein Dialog-Abenteuer für [perchance.org](https://perchance.org): Der Held kommt an **einen** Ort,
trifft dort Menschen und redet mit ihnen. Keine Rätsel, kein Spielziel — Begegnungen, Gespräche,
Stimmungen. Zu jedem Moment zeichnet der Generator ein Comic-Panel.

`proxima.html` ist der komplette Generator in einer Datei — Inhalt in den HTML-Bereich deines
Perchance-Generators kopieren, fertig.

## Voraussetzungen

Der Generator erwartet zwei globale Funktionen aus deinem Perchance-Setup, unverändert zur
bisherigen Fassung:

| Funktion | wofür |
|---|---|
| `ai(prompt)` bzw. `ai({instruction, onFinish})` | Text: Welt, Dialog, Regie |
| `image({prompt})` → `{dataUrl}` | Bilder, wenn die Bildquelle **Perchance** gewählt ist |

Ohne `image()` läuft der Generator weiter — dann muss nur eine der anderen Bildquellen eingestellt
werden (siehe unten).

## Bildquellen

Unter **⚙ EINSTELLUNGEN** (oder auf dem Startbildschirm) lässt sich einstellen, wer die Bilder malt.
Die Auswahl gilt generatorweit und überlebt Spielstände.

| Quelle | Schlüssel nötig | Anmerkung |
|---|---|---|
| **Perchance** | nein | Das eingebaute Plugin. Nichts verlässt Perchance. Standard. |
| **Pollinations** | nein | Offener Dienst, Bild kommt als URL. Ignoriert den Negativprompt. |
| **AI Horde** | nein (`0000000000`) | Gratis über freiwillige Rechner; anonym langsam, mit eigenem Schlüssel von [aihorde.net](https://aihorde.net) deutlich schneller. |
| **OpenAI-kompatible API** | ja | Alles, was `POST {basis}/images/generations` versteht. |
| **Eigene URL-Vorlage** | je nachdem | Platzhalter `{prompt}` `{negativ}` `{seed}` `{breite}` `{hoehe}`. |

Zwei Dinge, die man wissen sollte:

* **Alles außer Perchance läuft über fremde Server.** Prompt und Bild gehen aus dem Browser direkt
  dorthin. Wenn ein Dienst keine Anfragen aus dem Browser erlaubt (CORS) oder Perchance den Aufruf
  blockt, bleibt das Bild leer — dafür gibt es in den Einstellungen den Knopf **QUELLE TESTEN**, der
  ein einzelnes Testbild anfordert und die genaue Fehlermeldung anzeigt.
* **API-Schlüssel liegen unverschlüsselt im Browser** (`localStorage`) und gehen bei jedem Bild an
  den Dienst. Nur eigene Schlüssel mit Ausgabenlimit verwenden, keine geteilten.

Eine weitere Quelle hinzufügen heißt: einen Eintrag in `BILDQUELLEN` ergänzen. Jede Quelle bekommt
`{prompt, negativ, seed, breite, hoehe}` und gibt eine Bildadresse zurück — mehr ist der Vertrag nicht.

## Fallstrick beim Bearbeiten

Perchance wertet den **kompletten HTML-Bereich als Vorlage** aus, bevor der Browser ihn sieht —
Markup, HTML-Kommentare **und den `<script>`-Block**. Was in eckigen Klammern steht, wird als
Ausdruck gelesen.

Entscheidend ist, ob der Klammerinhalt als JavaScript durchgeht:

| im Quelltext | Ergebnis |
|---|---|
| `S.stimmung[i]`, `z['NPC_NAME']`, `['a','b']`, `[]` | gültiger Ausdruck — unproblematisch |
| `[eckigen Klammern]`, `[tritt ein]` | zwei nackte Bezeichner → **Syntaxfehler**, der Generator startet nicht |

Der Fehler lautet *„There's a problem with the syntax of this expression"* und zieht Folgefehler
nach sich: ohne aufgebaute Generator-Struktur findet das KI-Plugin sein Iframe nicht mehr
(*„Cannot read properties of null (reading 'contentWindow')"*).

Deshalb:

* im **Markup** `&#91;` und `&#93;` schreiben — sieht im Browser aus wie eckige Klammern,
* in **JavaScript-Zeichenketten** `'\x5B…\x5D'` — ergibt zur Laufzeit dieselben Zeichen,
* in **Kommentaren** gar keine Klammern um Wortfolgen.

`node test/logik.test.js` prüft beides und schlägt fehl, bevor es in Perchance auffällt.

## Befehle im Spiel

| Befehl | Wirkung |
|---|---|
| *(einfach schreiben)* | Der Held spricht. Text in `[eckigen Klammern]` ist eine Handlung. |
| `/hilfe` | Liste aller Befehle im Dialogfenster |
| `/sag: …` | selbst sprechen, auch während der Auto-Modus läuft |
| `/npcN: …` | verdeckte Regie an Figur N. Die nächste freie Nummer lässt eine **neue** Figur auftreten. |
| `/kleidungN: …` | dauerhaftes Outfit für Figur N (englisch) |
| `/regie: …` | stehende Regie für die ganze Szene, leer = löschen |
| `/bild: …` | neues Bild aus eigener Beschreibung |
| `/stil: …` | Bildstil wechseln (`manga`, `comic`, `aquarell`, `oel`, `realistisch`, `pixel` oder freier Text) |
| `/quelle` | Bildquelle wechseln |
| `/undo` | letzten Zug zurücknehmen |
| `/nochmal` | letzten Zug verwerfen und die Antwort neu würfeln |
| `/speichern` | Spielstände öffnen |

## Was gegenüber V6 anders ist

**Behobene Fehler**

* Bild-Aktualisierungen werden **vorgemerkt statt verworfen**, wenn gerade eines entsteht. Vorher
  verfiel der Takt und das Bild stand bei langsamen Diensten minutenlang still.
* Der **Auto-Modus** bleibt nach einem KI-Fehler nicht mehr eingeschaltet, ohne zu laufen: zwei
  Wiederholungen mit Pause, danach schaltet er sichtbar ab.
* Der **Startbildschirm scrollt**. Vorher konnte der Startknopf auf kleinen Displays unerreichbar
  hinter der bearbeitbaren Vorgeschichte verschwinden. Dazu `dvh` statt `vh` gegen die
  iOS-Adressleiste.
* Der **Schreibmaschinen-Effekt** stellt die vorherige Zeile sauber fertig, statt sie halb getippt
  stehenzulassen. Klick ins Dialogfenster überspringt die Animation, `0` als Tempo schaltet sie ab.
* Ein **manuell bearbeiteter Prompt** verliert den Negativprompt nicht mehr.

**Aufgeräumt**

* Reste der alten Mehrraum-Fassung entfernt (Navigationspfeile, Raumpunkte, Blende,
  Vorschlagsknöpfe, `--gruen`, `setNpcStatus`, `aktiv-raum`).
* Vier fast identische Modal-Blöcke sind ein `.modal`-Bauplan mit `oeffneModal()`/`schliesseModal()`.
  Escape und Klick auf den Hintergrund schließen jetzt jedes Menü.
* Die Werkzeugknöpfe sitzen in einer Flex-Leiste statt auf gezählten Pixel-Abständen.

**Neu**

* **Ein KI-Aufruf pro Zug statt zwei.** Regie (Bildidee, Handlungsfortschreibung) kommt jetzt im
  selben Aufruf wie die Dialogzeile.
* **JSON statt `KEY: wert`**, mit dem alten Zeilenparser als Rückfallebene — der verkraftet jetzt
  auch `**NAME:**`, Aufzählungszeichen und umgebrochene Fließtexte.
* **Langzeitgedächtnis**: Neben der fortgeschriebenen Handlung sammelt der Generator harte Fakten
  (max. 24) und legt sie jedem Zug bei, damit sich die Figuren nicht widersprechen.
* **Bis zu vier Figuren** gleichzeitig statt zwei.
* **Undo und /nochmal** für misslungene Antworten.
* **Vier Spielstand-Plätze** (einer automatisch) mit Export/Import als Textblock, Versionsfeld und
  Migration alter V6-Stände.
* **Fester Seed** über die ganze Partie, damit Figuren sich ähnlich bleiben; nur per 🎲 im Bildmenü
  neu gewürfelt.
* **Einstellbar**: Bildquelle, Bildgröße, Negativprompt, Bild-Takt (alle N Züge, 0 = nur auf Zuruf),
  Schreibtempo.
* Der Fotorealismus-Stil ist von einem Absatz auf eine Zeile gekürzt; die Verneinungen daraus
  („no retouching", „zero idealization") stehen jetzt im Negativprompt, wo Bildmodelle sie
  tatsächlich verarbeiten.
* `aria-live` auf dem Dialogfenster, sichtbare Fokusrahmen.

**Bewusst unverändert**

Der Bildstil wird weiterhin beim Zeichnen aus der Startauswahl gelesen und nicht im Spielstand
festgehalten. Nach dem Laden eines Standes steht die Auswahl deshalb wieder auf *Manga*, solange
der Stil nicht per `/stil:` gesetzt wurde. (Ausdrücklich so gewünscht.)

## Test

```
node test/logik.test.js
```

Prüft Parser, Prompt-Bau, Befehlserkennung, Bildquellen-Registry, Spielstände und die
V6-Migration gegen einen minimalen DOM-Stub — ohne Netz und ohne Browser. Das Skript wird direkt
aus `proxima.html` gezogen, läuft also nie gegen eine veraltete Kopie.
