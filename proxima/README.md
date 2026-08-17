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
| **Pollinations** | nein | Offener Dienst, Bild kommt als URL. Anderes Modell als Perchance — dieselbe Beschreibung ergibt sichtbar andere Bilder. Negativprompt wird mitgeschickt, aber nicht von jedem Modell dort beachtet. |
| **AI Horde** | nein (`0000000000`) | Gratis über freiwillige Rechner; anonym langsam, mit eigenem Schlüssel von [aihorde.net](https://aihorde.net) deutlich schneller. Bei hoher Auslastung sperrt sie alles über 907×907 und über 50 Schritte — die Bildgröße wird automatisch darunter gehalten (1024×1024 wird zu 896×896). |
| **OpenAI-kompatible API** | ja | Alles, was `POST {basis}/images/generations` versteht. |
| **Hugging-Face-Space (Gradio)** | meist ja | Spricht einen Space ueber seine Warteschlange an. Endpunkt und Parameter holt **API ERKUNDEN** beim Space ab. ZeroGPU-Spaces brauchen ein Token und haben ein Kontingent. |
| **Eigene URL-Vorlage** | je nachdem | Platzhalter `{prompt}` `{negativ}` `{seed}` `{breite}` `{hoehe}`. |

Zwei Dinge, die man wissen sollte:

* **Alles außer Perchance läuft über fremde Server.** Prompt und Bild gehen aus dem Browser direkt
  dorthin. Wenn ein Dienst keine Anfragen aus dem Browser erlaubt (CORS) oder Perchance den Aufruf
  blockt, bleibt das Bild leer — dafür gibt es in den Einstellungen den Knopf **QUELLE TESTEN**, der
  ein einzelnes Testbild anfordert und die genaue Fehlermeldung anzeigt.
* **API-Schlüssel liegen unverschlüsselt im Browser** (`localStorage`, Schlüssel `proxima_cfg_v1`)
  und gehen bei jedem Bild an den Dienst. Nur eigene Schlüssel mit Ausgabenlimit verwenden, keine
  geteilten.

### Wohin mit einem Schlüssel

In den Generator, **nie in den Code**: ⚙ EINSTELLUNGEN → Bildquelle wählen → Feld *API-Schlüssel*
→ ÜBERNEHMEN → QUELLE TESTEN.

Der Quelltext eines Perchance-Generators ist für alle einsehbar. Ein dort eingetragener Schlüssel
ist damit veröffentlicht — dasselbe gilt für diese Datei im Repository.

Was das Feld dagegen sicher trennt:

| | |
|---|---|
| Spielstand-Export, Speicherplätze | enthalten **keinen** Schlüssel — die Konfiguration liegt getrennt davon |
| `proxima.html` | enthält keinen Schlüssel, kann also bedenkenlos geteilt werden |
| Browserdaten löschen | löscht auch den Schlüssel — er muss dann neu eingetragen werden |
| anderes Gerät oder anderer Browser | kennt ihn nicht, dort erneut eintragen |

### Modelle auswählen

Für **Pollinations** und **AI Horde** holt der Knopf ⟳ neben *Verfügbare Modelle* die aktuelle
Liste beim Dienst ab. Bei der Horde steht dabei, wie viele Rechner ein Modell gerade anbieten und
wie viele Aufträge warten — sortiert ist nach Rechnerzahl, oben stehen also die schnellsten.

Die Liste ist nur eine Hilfe: Das Textfeld darunter bleibt maßgeblich, ein Modellname lässt sich
also weiterhin von Hand eintragen. Ist der Dienst gerade nicht erreichbar, sagt die Statuszeile das
und ändert sonst nichts.

### Einen Gradio-Space anbinden

1. Bildquelle **Hugging-Face-Space (Gradio)** waehlen.
2. **Space-Adresse** eintragen: `https://<besitzer>-<spacename>.hf.space`, alles klein, Sonderzeichen
   werden zu Bindestrichen.
3. Bei ZeroGPU-Spaces ein **Token** von huggingface.co/settings/tokens hinterlegen.
4. **API ERKUNDEN** druecken. Der Generator holt `/gradio_api/info` und `/config`, waehlt den
   Endpunkt mit Bildausgabe, traegt `fn_index` ein und baut die **Parameter-Vorlage**.
5. Vorlage kurz pruefen, **UEBERNEHMEN**, dann **QUELLE TESTEN**.

**API ERKUNDEN** baut die Vorlage aus den echten Vorgabewerten des Space (`props.value` der
zugehoerigen Bedienelemente), nicht aus geratenen Zahlen. Zwei Feinheiten dabei:

* Ein `aspect_ratio_selector` wird auf **Custom** gestellt, sofern der Space diese Auswahl
  anbietet -- sonst bleiben `custom_width` und `custom_height` wirkungslos und der Space rechnet
  mit seiner eigenen Groesse.
* Die Bildgroesse fuer Spaces steht in eigenen Feldern (Vorgabe 1024x1024). Viele SDXL-Spaces
  lehnen alles darunter ab, waehrend fuer andere Quellen 512 sinnvoll sein kann.

Die Vorlage ist die Parameterliste des Space in seiner Reihenfolge, mit Platzhaltern:
`"{prompt}"` `"{negativ}"` `{seed}` `{breite}` `{hoehe}`. Alles andere sind feste Werte, die aus den
Vorgaben des Space uebernommen werden. Ein `randomize_seed` wird bewusst auf `false` gesetzt --
sonst wuerfelt der Space seinen eigenen Seed und die Figuren sehen von Bild zu Bild anders aus.

Laesst sich die API nicht abfragen, stehen dieselben Angaben auf der Space-Seite unter
*Use via API* und koennen von Hand eingetragen werden.

Steht im API-Feld nichts Brauchbares, bricht der Generator nicht ab: er sucht sich aus `/config`
den plausibelsten Endpunkt (`generate`, `infer`, `predict` und Aehnliches), sagt im Dialog welchen
er genommen hat und merkt ihn sich. Hilfsendpunkte wie `lambda` oder `load_example` waehlt er nie.

Anime-Modelle vom Typ Illustrious oder Pony reagieren auf **Tag-Ketten** deutlich besser als auf
Prosa. Dafuer gibt es im Menue 🎬 den Stil *Illustrious / Anime-Tags*.

### Wenn eine Quelle nichts liefert

Der Generator holt jedes Bild zuerst per `fetch` und erst danach klassisch über ein `<img>`.
Der erste Weg nennt den **echten Grund**, der zweite lädt auch dann noch, wenn CORS den ersten
blockiert. Die Fehlerzeile im Dialog zeigt deshalb, woran es liegt:

| Meldung | Bedeutung |
|---|---|
| `Dienst antwortete HTTP 4xx/5xx` | Der Dienst wurde erreicht und hat abgelehnt — falscher Modellname, Prompt zu lang, Limit erschöpft. |
| `Failed to fetch` / `NetworkError` | Gar nicht erst hingekommen: Adresse falsch, Dienst tot, oder Perchance lässt den Aufruf nicht zu. |
| `Antwort war kein Bild, sondern text/html` | Der Dienst schickt eine Fehlerseite statt eines Bildes. |
| `HTTP 429` | **Drosselung** — zu viele Anfragen in kurzer Zeit. Kein Fehler der Anfrage. |
| `HTTP 403` bei AI Horde | Auftrag zu groß oder zu aufwendig für das vorhandene Kudos-Guthaben. Die Meldung nennt die geltende Grenze und die tatsächlich angefragten Maße. |
| `Zeitüberschreitung` | Dienst überlastet — bei AI Horde anonym normal. |

Erste Handgriffe: **Modellfeld leeren** (ein nicht mehr existierender Modellname ist die häufigste
Ursache), Bildgröße auf 512×512 stellen, in den Einstellungen **QUELLE TESTEN** drücken — der
schickt einen kurzen Testprompt und schließt damit die Prompt-Länge als Ursache aus.

**HTTP 429** trifft anonyme Nutzung offener Dienste schnell — Pollinations zählt Anfragen pro
Adresse, und im Auto-Modus entsteht alle paar Züge ein Bild. Der Generator klopft dann nicht
weiter an: er legt eine Pause ein (Länge aus dem `Retry-After` des Dienstes, sonst 60 Sekunden),
setzt in dieser Zeit den Bildtakt aus und sagt es im Dialog. Dauerhaft hilft nur, seltener zu
fragen — **Bild-Takt in ⚙ erhöhen** (etwa 5 statt 2) oder auf `0` stellen und Bilder nur noch per
`/bild:` anfordern.

Bei **HTTP 500** fasst der Generator einmal selbst nach: kurze Pause, benachbarter Seed, zweiter
Versuch. Seeds werden für alle externen Dienste auf 32 Bit gefaltet — Bild-Backends rechnen mit
`uint32`, und die zwölfstelligen Seeds älterer Spielstände quittieren manche mit genau diesem 500.

Bleibt es bei `Failed to fetch` für *jede* externe Quelle, während Perchance selbst zeichnet, dann
lässt die Perchance-Umgebung keine fremden Bild-Aufrufe zu; dann hilft nur die eingebaute Quelle.

### Warum dieselbe Szene je nach Quelle anders aussieht

Jede Quelle rechnet mit einem **anderen Bildmodell**. Gleicher Prompt, gleicher Seed, trotzdem ein
deutlich anderes Bild — das ist normal und nicht abstellbar. Wer einen bestimmten Look will, bleibt
bei einer Quelle oder passt den Stiltext per `/stil:` an die gewählte Quelle an.

Der Prompt selbst **bleibt beim Wechsel erhalten**: Was im Bildmenü von Hand geschrieben wurde,
gilt weiter und wandert in die nächste Engine — nur die Längengrenze der neuen Quelle wird noch
angewandt.

Wie lange er gilt, entscheidet der Haken **„Prompt festhalten"** im Bildmenü:

| | |
|---|---|
| **ohne Haken** (Standard) | Der Prompt überlebt Quellenwechsel und sofortige Neuzeichnungen. Beim nächsten Bildtakt übernimmt wieder die Handlung — das Bild folgt also weiter der Geschichte. |
| **mit Haken** | Der Prompt bleibt, bis du ihn änderst. Der Bildtakt zeichnet nicht neu, statt dieselbe Anfrage zu wiederholen. |

Zurück zur Automatik geht es jederzeit über **↺ AUS SZENE** im Bildmenü oder über `/bild: …`.

Zwei Unterschiede sind dagegen hausgemacht und behoben:

* **Negativprompt.** Perchance bekommt ihn schon immer. An Pollinations geht er jetzt als
  `negative_prompt` mit; lehnt der Dienst ab, wird ohne ihn nachgefasst. Nicht jedes Modell dort
  wertet ihn aus.
* **Prompt-Länge.** Quellen mit Längengrenze (`maxPrompt`) bekamen den Prompt vorher stumpf
  abgeschnitten — und weil Stil und Bildaufbau am **Ende** stehen, fiel bei zwei Figuren genau der
  Look weg. Gekürzt wird jetzt in der Mitte, Stil und Bildaufbau bleiben immer erhalten.

Eine weitere Quelle hinzufügen heißt: einen Eintrag in `BILDQUELLEN` ergänzen. Jede Quelle bekommt
`{prompt, negativ, seed, breite, hoehe}` und gibt eine Bildadresse zurück — mehr ist der Vertrag nicht.

## Fallstrick beim Bearbeiten

Perchance tastet den HTML-Bereich **einmal beim Laden** ab und liest jeden Klammerinhalt als
Ausdruck. Entscheidend ist deshalb der *Zeitpunkt*, nicht der Ort:

| | |
|---|---|
| **Beim Laden vorhanden** — Markup, Attribute, Kommentare | wird geprüft → hier keine eckigen Klammern um Wörter |
| **Erst zur Laufzeit erzeugt** — per JavaScript ins DOM geschrieben | wird nicht mehr geprüft → unbedenklich |

Darum laufen die Dialogzeilen mit ihren `[Handlungen]` und der ausführliche Platzhalter des
Eingabefelds problemlos: die entstehen erst nach dem Laden. Ein Platzhalter-Attribut im
Start-Markup dagegen legt den Generator lahm.

**HTML-Entities helfen nicht.** `&#91;` wird vom Browser beim Parsen zu `[` aufgelöst — und erst
danach schaut Perchance hin. Im Start-Markup hilft nur, die Klammern wegzulassen.

Ob der Inhalt gültiges JavaScript ist, entscheidet über den Fehler: `['a','b']` und `[i]` gehen
durch, zwei nackte Wörter wie `[eckigen Klammern]` ergeben *„Unexpected identifier"*. Der Abbruch
zieht Folgefehler nach sich — ohne aufgebaute Generator-Struktur findet das KI-Plugin sein Iframe
nicht mehr (*„Cannot read properties of null (reading 'contentWindow')"*).

`node test/logik.test.js` prüft das Start-Markup **nach** dem Auflösen der Entities und schlägt
fehl, bevor es in Perchance auffällt.

## Wenn das Text-Plugin klemmt

Meldet Perchance *„Cannot read properties of null (reading 'contentWindow')"* **ohne** vorherigen
Syntaxfehler, dann kommt das aus Perchances eigenem Text-Plugin: es spricht über ein verstecktes
Iframe, und das war beim Aufruf noch nicht da. Beobachtet vor allem, wenn der Generator aus einem
Elternfenster initialisiert wird (`?__initWithDataFromParentWindow=1`) und gleich die erste
Anfrage rausgeht.

Der Generator fängt das ab: Anfragen, die daran scheitern, werden bis zu dreimal mit wachsender
Pause wiederholt. Erst danach erscheint eine verständliche Meldung im Dialog statt eines
unbehandelten Fehlers. Bleibt es dabei, hilft die Seite neu zu laden — direkt über
`perchance.org/<generator>`, nicht aus der Editor-Vorschau heraus.

Behebbar ist die Ursache von hier aus nicht: das Iframe gehört dem Plugin, nicht diesem Code.

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
| `/stil: …` | Bildstil wechseln (`manga`, `comic`, `aquarell`, `oel`, `realistisch`, `pixel` oder freier Text) — dasselbe geht im Menü 🎬 |
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
* **Spielstände und Einstellungen sind schon vom Startbildschirm aus erreichbar.** Die Menüs
  öffneten sich hinter dem Startbildschirm, weil dieser höher lag — sichtbar wurden sie erst,
  sobald ein Spiel lief.

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
* **Bildstil auch im laufenden Spiel wählbar** — im Menü 🎬 (Szene & Stil), mit denselben
  Vorgaben wie auf dem Startbildschirm plus eigenem Text. Vorher ging das nur über `/stil:`.
* **Einklappbare Kopfleiste**: Der Schalter unter der Titelzeile fährt Werkzeuge, Figurenanzeige
  und Titel nach oben aus dem Bild — das Szenenbild bleibt unverdeckt. Der Zustand wird gemerkt.
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
