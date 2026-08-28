# PROXIMA

Ein Dialog-Abenteuer für [perchance.org](https://perchance.org): Der Held kommt an **einen** Ort,
trifft dort Menschen und redet mit ihnen. Keine Rätsel, kein Spielziel — Begegnungen, Gespräche,
Stimmungen. Zu jedem Moment zeichnet der Generator ein Comic-Panel.

Der Generator holt seinen Quelltext bei jedem Seitenaufruf aus diesem Repository:
**push nach `main` → beim nächsten Laden steht die Änderung in Perchance.** Kein Kopieren mehr.

| Datei | Rolle |
|---|---|
| `proxima.html` | Die **Ladeschale**. Einmal in den HTML-Bereich des Perchance-Generators kopieren, danach praktisch nie wieder anfassen. |
| `proxima.app.html` | Der **komplette Generator** — Stil, Markup, Skript. Hier wird gearbeitet. |
| `test/logik.test.js` | Prüft beides ohne Netz und ohne Browser. |

## Wie der Abgleich läuft

Die Ladeschale holt beim Start

```
https://raw.githubusercontent.com/Colimbuli/MeinGitHub/main/proxima/proxima.app.html
```

zerlegt die Datei in `<style>`, Markup und `<script>` und hängt die drei Teile in die Seite. Das
Skript kommt als echtes `script`-Element ins DOM und nicht durch `eval` — nur so landen die
Funktionen wieder im globalen Namensraum, wo die `onclick`-Attribute des Markups und die
Perchance-Plugins `ai()` und `image()` sie erwarten. Für den laufenden Generator ist das
ununterscheidbar von der früheren Fassung aus einer Datei.

**Die Plugin-Brücke.** Perchance stellt `ai()` und `image()` im Geltungsbereich des HTML-Bereichs
bereit — nicht zwingend als Eigenschaft von `window`. Die Ladeschale steht selbst in diesem
Bereich und sieht die Namen; der eingehängte Generator läuft im globalen Geltungsbereich und sähe
sie dort nicht. Deshalb reicht die Schale beide Namen vor dem Start nach `window` durch. Ist ein
Plugin noch nicht geladen, setzt sie einen Platzhalter, der beim ersten Aufruf noch einmal
nachsieht und sich dann selbst austauscht. `PROXIMA_LADER.plugins()` in der Browserkonsole sagt,
was gefunden wurde — steht dort *„Platzhalter gesetzt"*, fehlt das Plugin wirklich im Generator.

Vier weitere Dinge, die mitgedacht sind:

* **Wie schnell eine Änderung ankommt.** `raw.githubusercontent.com` erlaubt fünf Minuten Cache.
  Die Ladeschale hängt einen Zeitstempel im Minutentakt an die Adresse, damit es bei einer Minute
  bleibt. Sofort geht auch: `PROXIMA_LADER.neu()` in der Browserkonsole lädt am Cache vorbei.
* **Wenn `raw` nicht durchkommt** (Netzsperre, Schulnetz), versucht die Schale denselben Stand über
  `cdn.jsdelivr.net`. Der hält Zweig-Stände länger vor, taugt also nur als Rückfallebene.
* **Wenn GitHub gar nicht erreichbar ist**, läuft die zuletzt geladene Fassung aus dem
  `localStorage` weiter, statt dass der Generator schwarz bleibt. `PROXIMA_LADER.vergiss()` wirft
  sie weg.
* **Zum Ausprobieren ohne `main` anzufassen**: `#prx-zweig=mein-zweig` an die Generator-Adresse
  hängen. Die Wahl bleibt gemerkt, `#prx-zweig=standard` schaltet zurück.

Wer den Generator forkt, ändert nur den Block `CFG` oben im Skript von `proxima.html`
(`besitzer`, `repo`, `zweig`, `pfad`, `taktSekunden`).

## Voraussetzung: öffentliches Repository

`raw.githubusercontent.com` liefert aus einem **privaten** Repository nichts — für alle 404, auch
für dich. Ein Token, das das ändern würde, stünde im HTML-Bereich des Generators und damit für
jeden lesbar da. Das Repository muss also öffentlich sein.

Umstellen: Repository → **Settings** → **General** → ganz unten **Danger Zone** →
*Change repository visibility* → **Make public**.

Vorher einmal durchsehen, denn veröffentlicht wird auch die **gesamte Historie**: API-Schlüssel,
Zugangsdaten, private Notizen in alten Commits sind danach draußen. (Die Schlüssel der Bildquellen
sind davon nicht betroffen — die liegen im Browser des Spielers, nicht im Repository.) Soll der
Rest privat bleiben, ist der saubere Weg ein zweites, öffentliches Repository, das nur `proxima/`
enthält; dann in `CFG` `besitzer`/`repo` darauf zeigen lassen.

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
Prosa. Dafuer gibt es im Bildmenue 🖼 den Stil *Illustrious / Anime-Tags*.

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
| `exceeded your ZeroGPU runs limit` | Kontingent des Space aufgebraucht. Ein Hugging-Face-Token im Token-Feld hebt es deutlich an. |
| `INTERNAL ASSERT FAILED`, `CUDA`, `NVML`, `out of memory` | Panne auf der GPU des Dienstes, nicht in der Anfrage. Der Generator fasst einmal nach und pausiert dann 90 Sekunden. |
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

Nicht jeder Dienst meldet ein erschoepftes Kontingent als 429 -- ZeroGPU schreibt es als Text
in die Antwort. Auch das erkennt der Generator und legt dann eine laengere Pause ein (fuenf
Minuten), statt bei jedem Bildtakt erneut anzuklopfen.

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

### Mission, Beziehungen und wer von Anfang an da ist

Drei Dinge halten die Geschichte zusammen, seit V7.31.

**Die Mission.** Die Welterschaffung setzt ein übergeordnetes Ziel: etwas Konkretes, das an diesem
Tag erreicht, herausgefunden oder geklärt werden soll — und an dem man scheitern kann. Verlieben,
Erobern und Verführen sind ausdrücklich **keine** Mission. Das Ziel steht in jeder Anweisung an die
KI, und jeder Zug soll es voranbringen, verzögern oder zeigen, was ihm im Weg steht. Der Stand
wandert mit; nachzulesen in der Chronik unter **MISSION**.

Das Ziel gehört dem Spieler, nicht der KI: **`/mission: …`** setzt es jederzeit neu, **`/mission: weg`**
streicht es (dann verfolgt jede Figur eigene Absichten), und **`/mission`** ohne Text öffnet ein
eigenes Fenster mit Ziel und Stand. Dorthin führt auch die Chronik: 📖 → **MISSION** → *✎ BEARBEITEN*.
Ein neu gesetztes Ziel landet zugleich im Langzeitgedächtnis, damit die Figuren es nicht übersehen.

**Die Beziehungen.** Jede Figur führt eine eigene Haltung zu jeder anderen und zum Helden:

```
Marlene → Julian Voss: vertraut, seit zwölf Jahren | Konrad: alte Rivalin
Konrad  → Julian Voss: schuldbewusst               | Marlene: skeptisch
```

Das Register geht in jede Anweisung ein und wird nach jedem Zug fortgeschrieben — die Regie meldet
nur, was sich *wirklich* geändert hat, im Format `Figur > Ziel: Haltung`. Der Held führt kein
Register über sich selbst: was er empfindet, spielt der Mensch vor dem Bildschirm. Wer den Ort
verlässt, verschwindet auch aus dem Register. Nachzulesen in der Chronik unter **BEZIEHUNGEN** und
auf jeder Figurenseite.

**Das Tempo der Annäherung.** Zuneigung, Flirt und Begehren dürfen entstehen — aber sie sind weder
das Thema noch eine Abkürzung. Sie wachsen aus gemeinsamem Tun und Vertrauen, in kleinen Schritten,
und nur wenn beide Seiten sie tragen. Aus *höflich* wird nicht im nächsten Zug *verliebt*. Nimmt die
Szene eine amouröse Wendung, läuft alles andere trotzdem weiter: die Mission, die übrigen
Anwesenden, der Ort.

**Genannte Personen treten sofort auf.** Steht in der Ausgangsidee „ich bin mit meiner Frau im
Kino", dann ist die Frau von Anfang an als Figur da — mit Namen, mit der Rolle *Ehefrau des Helden*
und mit einer entsprechend vertrauten Haltung. Und der Ort ist das Kino, nicht irgendein erfundener
anderer. Bis zu vier so genannte Personen stehen von der ersten Zeile an im Raum; weitere können
später dazustoßen.

### Widerstand: Akte, Absichten, Proben

Eine Geschichte ohne Widerstand läuft in die bequemste Richtung. Vier Dinge halten dagegen.

**Akte.** Die Mission zerfällt in Etappen. Die Welterschaffung setzt die erste; ist sie erreicht — oder
endgültig gescheitert — ruft die Regie die nächste aus, der Akt zählt hoch, ein neues Bild entsteht
sofort und die erledigte Etappe wandert als schwerer Fakt ins Gedächtnis. Nachzulesen unter 📖 → MISSION.

**Verdeckte Absichten.** Jede Figur will etwas für sich und verbirgt etwas. Beides steht in der
Anweisung an die KI, nicht auf dem Schirm: gespielt wird es als Andeutung, Ausweichen, kleiner
Widerspruch. Wird ein Geheimnis wirklich ausgesprochen, gilt es als aufgedeckt und steht ab dann in
der Chronik. **`/gedanken`** zeigt dir alles auf einmal — bewusst ein Befehl und kein Knopf: wer ihn
tippt, nimmt sich die Überraschung.

**Würfelproben.** Steht in deiner Eingabe eine Handlung in eckigen Klammern, entscheidet ein Wurf
gegen 11, ob sie gelingt. Wie die angesprochene Figur zu dir steht, gibt bis zu vier Punkte dazu oder
ab — aus dem Beziehungsregister, keine zweite Buchhaltung. Die 20 gelingt immer, die 1 nie. Das
Ergebnis steht in der Anweisung fest, damit die KI keinen anderen Ausgang erfindet. Abschaltbar.

**Zeit und Frist.** Eine Uhr läuft mit den Zügen; die Regie meldet, wie viele Minuten ein Moment
gekostet hat. Tageszeit und Wetter stehen im Bildprompt und im Raumtitel. Legt die Ausgangsidee eine
Frist nahe (letzte Vorstellung, Zug, Ladenschluss), setzt die Welterschaffung sie — und „noch 18
Minuten" steht ab dann in jeder Anweisung.

### Gedächtnis mit Gewicht

Früher fiel der älteste Fakt heraus, egal wie wichtig er war. Jetzt trägt jeder Fakt ein Gewicht —
Versprechen, Konflikte und Vereinbarungen schwer, Small Talk leicht — und den Zug seiner letzten
Erwähnung. Verdrängt wird der mit dem kleinsten Wert aus `Gewicht × 40 − Alter`; ein Versprechen
überlebt damit rund achtzig Züge Vernachlässigung, eine Beiläufigkeit rund vierzig. Wird ein Fakt im
Gespräch berührt, altert er nicht weiter. In die Anweisung gehen die wichtigsten, aber in
Erzählreihenfolge.

### Eine neue Figur von Hand

Der Knopf **+ NPC** führt jetzt zuerst in ein leeres Formular: Name, Rolle, Aussehen, Kleidung,
Persönlichkeit, Stimmung, Haltung zum Helden, was sie will, was sie verbirgt, ihr erster Satz — und
ein freies Feld für alles, was sonst nirgends hinpasst. Alles ist freiwillig.

Zwei Wege hinaus: **✦ ERSCHEINEN LASSEN** gibt deine Angaben als verbindliche Vorgabe an die KI, die
nur die Lücken füllt — was du eingetragen hast, wird wörtlich übernommen. **NUR MEINE ANGABEN**
kommt ganz ohne KI-Aufruf aus und nimmt genau das, was dasteht.

Der alte Weg bleibt: `/npc3: kommt mit einer Taschenlampe` erfindet die Figur wie bisher direkt.

### Alle Symbole in einem Stil

Emoji malt jedes Gerät in eigenen Farben — mitten in einer goldenen Leiste sehen sie aus wie
hineingefallen. Alle Symbole sind deshalb gezeichnet (Inline-SVG mit `fill="currentColor"`) und
nehmen die Farbe des Knopfes an, auch beim Überfahren. Sie stehen genau einmal im Quelltext, im
Objekt `SYM`; jedes Element mit `data-sym="chronik"` bekommt seines beim Start eingesetzt. Ein Test
schlägt an, sobald wieder ein farbiges Emoji in die Datei gerät.

### Wer der Held ist

Auf dem Startbildschirm steht neben Bildstil und Erzählweise **DU BIST**: männlich, weiblich, divers
oder *egal — die KI entscheidet*. Die Wahl bleibt gemerkt, geht in die Welterschaffung ein und steht
danach in jeder Anweisung (damit die Figuren richtig ansprechen) und im Bildprompt (damit der Held
nicht von Panel zu Panel wechselt). Ändern lässt sie sich jederzeit im Figurenmenü 👤.

Der Held hat dort auch ein Feld **Aussehen**. Bleibt es leer, baut PROXIMA beim ersten Charakterblatt
eine Beschreibung aus Geschlecht und Beruf — und hält sie fest, damit sie nicht bei jedem Bild anders
ausfällt.

### Referenzbild (img2img) für Gradio-Spaces

Spricht dein Space auch img2img, kann PROXIMA ein **Referenzbild** mitschicken. Der Anker ist
bewusst **fest**, nicht das zuletzt gezeichnete Bild: sonst entstünde jedes Bild aus dem vorigen und
nach zehn Zügen wäre es die Fotokopie einer Fotokopie. Gewählt wird in dieser Reihenfolge:

1. das **Charakterblatt der zuletzt sprechenden Figur**,
2. sonst das **Charakterblatt des Helden**,
3. sonst das **erste Bild des laufenden Akts** — das mit jedem neuen Akt zurückgesetzt wird.

Einstellbar bei der Bildquelle *Hugging-Face-Space*: **Referenzbild mitschicken** (aus ab Werk),
**Stärke 0–1** (0.65 ist ein guter Start — darunter bleibt die alte Szene stehen, darüber verliert
sich die Ähnlichkeit) und die **Form** des Bildes: `roh` schickt die Data-URL, `datei` das
Gradio-Dateiobjekt. Welche von beiden geht, hängt am Space.

In der Parameter-Vorlage stehen dafür zwei neue Platzhalter, `"{referenz}"` und `{staerke}` — beide
werden mit **und** ohne Anführungszeichen erkannt, damit die Vorlage nicht daran zerbricht, wie man
sie getippt hat. Fehlt ein Bild, steht dort `null`; fehlt die Stärke, der Standardwert.

Zwei Dinge, die eingebaut sind, weil sie sonst weh tun: Das Bild wird vor dem Senden auf 512 Pixel
verkleinert und als JPEG kodiert (ein 1024er-PNG wären als Base64 schnell zwei Megabyte an jedem
einzelnen Bild). Und das **Charakterblatt selbst wird nie mit Referenz gezeichnet** — sonst zeichnete
sich der Anker aus dem, was er festhalten soll.

### Ein Chat aus einem anderen Generator

Ein Gespräch, das im Perchance-Generator **AI Character Chat** begonnen hat, kann hier weitergehen.
Dessen Export kennt zwei Formen, PROXIMA liest beide:

* **Textblock** — vor jeder Zeile steht `[USER]`, `[AI]` oder `[SYSTEM]`, dahinter der Text.
* **JSON des ganzen Stranges** — die vollständige Ausfuhr mit Figuren, Strang und Nachrichten.

Der Weg: das Fenster **SPIELSTÄNDE** öffnen — im Spiel über das Disketten-Symbol, auf dem Startbildschirm
über den Knopf **↥ CHAT ÜBERNEHMEN** —, dann **↥ IMPORT** drücken und die heruntergeladene Datei
auswählen. Derselbe Knopf nimmt weiterhin PROXIMA-Spielstände: Der Inhalt wird erst als Spielstand
geprüft und dann als Chat. Wer den Text lieber einfügt, benutzt das Feld und **↥ AUS DEM FELD ÜBERNEHMEN**.

Wie die Zeilen ankommen:

| im fremden Chat | in PROXIMA |
| --- | --- |
| `[USER]` | deine eigenen Zeilen |
| `[AI]` | die Hauptfigur des Stranges |
| `[SYSTEM; name=Bo]` | eine weitere Figur namens Bo |
| `[SYSTEM]` ohne Namen oder mit `hiddenFrom` | Regieanweisung → wandert ins Gedächtnis |

Beim **Textblock** fehlt der Name der Hauptfigur — der steht dort nirgends. Deshalb gibt es unter dem
Feld zwei kleine Zeilen: **dein Name im Chat** und **der Name der Figur hinter `[AI]`**. Beim JSON
sind beide schon enthalten und die Zeilen bleiben leer.

Läuft noch kein Spiel, entsteht aus dem Chat eine schlichte Welt: der Ort heißt wie der Strang, die
Figuren kommen aus dem Gespräch, der Verlauf ist die Vorgeschichte. Läuft schon eins, hängt sich das
Gespräch an — bekannte Namen finden ihre Figur wieder, unbekannte treten dazu, solange am Ort Platz
ist. Mehr als vier Sprecher passen nicht: Die Übrigen werden gemeldet, ihre Zeilen liegen im
Gedächtnis statt im Dialog. Sehr lange Chats werden vorn gekürzt.

Der Weg zurück geht auch: **↧ CHAT** schreibt den laufenden Verlauf im selben Textformat ins Feld —
die erste Figur als `[AI]`, alle weiteren als benanntes `[SYSTEM]`.

#### Was die Auswertung nachträgt

Ein fremder Chat bringt Text mit, aber keine Profile. Deshalb liest die KI direkt nach dem Import
das Gespräch einmal durch — ein einzelner Aufruf — und trägt nach, was zum Weiterspielen fehlt:

* **Figuren**: Rolle, Aussehen, Kleidung, Wesen, Stimmung, Ziel und Geheimnis
* **Beziehungen**: Haltung jeder Figur zum Helden und zu den anderen
* **Held**: Aussehen, Kleidung, Geschlecht — und der Name, falls du beim Import keinen eingetragen hast
* **Ort**: Name, Beschreibung, Bildbeschreibung, Uhrzeit, Wetter
* **Gedächtnis**: was im Gespräch verabredet, versprochen oder enthüllt wurde
* **Mission und Etappe**, falls das Gespräch ein Ziel erkennen lässt

Angefasst werden dabei nur die Figuren, die aus dem Import stammen — wer schon in deiner Partie
gewachsen ist, bleibt unangetastet. Fällt die KI aus oder kommt Unlesbares zurück, bleiben die
Platzhalter stehen und es erscheint eine Meldung; **`/auswerten`** wiederholt den Versuch. Von Hand
aufgerufen darf der Befehl auch bestehende Profile überschreiben — dann ist es deine Entscheidung.

### Dateien statt Textblöcke

Ex- und Import laufen über den Dateidialog des Geräts:

| Knopf im Fenster **SPIELSTÄNDE** | was passiert |
| --- | --- |
| **↧ EXPORT** | legt `proxima-spielstand-<held>-<datum>.json` auf dem Gerät ab |
| **↧ CHAT** | legt `proxima-chat-<held>-<datum>.txt` ab — im Format des anderen Generators |
| **↥ IMPORT** | öffnet den Dateiexplorer und liest die gewählte Datei ein |
| **↥ AUS DEM FELD ÜBERNEHMEN** | liest, was im Textfeld steht |

Das Textfeld bleibt daneben bestehen, und zwar mit Absicht: Manche Browser lassen im
Perchance-Fenster keinen Download zu. Der Export schreibt seinen Text deshalb **immer auch ins
Feld** — kommt keine Datei an, kann man ihn von dort kopieren. Umgekehrt geht es genauso: einfügen
und **↥ AUS DEM FELD ÜBERNEHMEN** drücken.

Beim Import ist es gleichgültig, was in der Datei steht — Spielstand oder Chat aus einem anderen
Generator werden am Inhalt erkannt, nicht an der Endung.

### Charakterblatt

Gesichter wandern von Panel zu Panel. Im Figurenmenü erzeugt **✎ CHARAKTERBLATT** (oder `/blatt 2`,
für den Helden `/blatt held`) ein Porträt der Figur: Identität und Kleidung vor neutralem Grund, mit einem eigenen Seed, der aus
dem Seed der Partie abgeleitet ist — dieselbe Partie ergibt dieselben Gesichter, verschiedene Figuren
verschiedene. Die Bilder liegen **neben** dem Spielstand im `localStorage`, nicht darin; ein
Spielstand bleibt damit klein genug zum Exportieren.

### Lektor

Ein zweiter, stiller KI-Aufruf liest jede Antwort, bevor du sie siehst, und prüft vier Dinge:
wiederholte Formulierungen, zu schnelle Beziehungssprünge, ignorierte Mission, Widerspruch zur
Würfelprobe. Findet er nichts, antwortet er `OK` und die Zeile bleibt, wie sie war. Findet er etwas,
schreibt er sie neu — aber nur, wenn die Korrektur nicht länger als das Doppelte des Originals ist,
sonst gilt sie als Aufsatz und wird verworfen. Kostet einen KI-Aufruf je Zug, ab Werk aus.

### Woher die Bildbeschreibung kommt

In den Einstellungen steht ein Schalter: **Bildregie — eigener KI-Aufruf sucht das Bild zum Moment.**

| | aus (Standard) | an |
|---|---|---|
| Wer beschreibt das Bild | die Dialog-KI nebenbei, im Feld `bild` desselben Aufrufs | ein eigener Aufruf, der nur nach dem Bild fragt |
| Kosten | keine zusätzlichen | ein KI-Aufruf je Bild |
| Trifft den Moment | meist gut | meist genauer, weil die KI beim Antworten nur an das Bild denkt |

Der Bot bekommt Schauplatz, anwesende Figuren mit Stimmung, die bisherige Handlung und die letzten
vier Züge. Zurück kommt **ein englischer Satz**: Handlung, Körperhaltung, Blickrichtung,
Kameraeinstellung, Licht. Aussehen, Kleidung, Bildstil und Seed liefert weiterhin `bauePrompt()` —
sonst würde der Bot die Figuren bei jedem Bild neu erfinden.

Antwortet der Bot nicht oder zu knapp, zeichnet der Generator wie bisher aus der Dialogregie. Ein
Ausfall kostet also kein Bild. Ein von Hand gesetzter Prompt (`/bild: …`) hat immer Vorrang.

### Die Knöpfe oben

Der Bildstil hatte einmal ein eigenes Fenster. Er gehört zum Bild, also steht er jetzt oben im
**Bildmenü 🖼** — ein Fenster statt zwei. Der alte Aufruf `oeffneSzeneMenu()` führt dorthin weiter,
damit `/stil` und ältere Aufrufe nichts merken. Die Stilwahl greift, sobald **NEU ZEICHNEN** oder
**AUS SZENE** gedrückt wird.

Die Knöpfe stehen in einem festen Raster statt auf Padding: ein Zeichen quadratisch (1:1), die
beiden beschrifteten (**+ NPC**, **▶ AUTO**) doppelt so breit wie hoch (1:2). Der Ort trägt eine
gezeichnete Ortsmarke — eine umgekehrte Tropfenform — statt der runden Stecknadel, die auf vielen
Geräten wie ein Farbklecks aussah.

## Fallstrick beim Bearbeiten

Perchance tastet den HTML-Bereich **einmal beim Laden** ab und liest jeden Klammerinhalt als
Ausdruck. Entscheidend ist deshalb der *Zeitpunkt*, nicht der Ort:

| | |
|---|---|
| **`proxima.html`** — steht beim Laden im HTML-Bereich | wird geprüft → keine eckigen und keine geschweiften Klammern im Markup |
| **`proxima.app.html`** — kommt erst zur Laufzeit ins DOM | wird nicht mehr geprüft → beliebiger Inhalt |

Das ist der stille Gewinn der Umstellung: Die Dialogzeilen mit ihren `[Handlungen]`, Platzhalter,
Kommentare — im Generator selbst ist die Klammerfrage erledigt. Nur die Schale muss sauber bleiben,
und die ändert sich fast nie.

**HTML-Entities helfen nicht.** `&#91;` wird vom Browser beim Parsen zu `[` aufgelöst — und erst
danach schaut Perchance hin. Im Start-Markup hilft nur, die Klammern wegzulassen.

Ob der Inhalt gültiges JavaScript ist, entscheidet über den Fehler: `['a','b']` und `[i]` gehen
durch, zwei nackte Wörter wie `[eckigen Klammern]` ergeben *„Unexpected identifier"*. Der Abbruch
zieht Folgefehler nach sich — ohne aufgebaute Generator-Struktur findet das KI-Plugin sein Iframe
nicht mehr (*„Cannot read properties of null (reading 'contentWindow')"*).

`node test/logik.test.js` prüft die Ladeschale **nach** dem Auflösen der Entities und schlägt fehl,
bevor es in Perchance auffällt.

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

## Erzaehlweise und mitspielender Held

Auf dem Startbildschirm steht neben Bildstil und Bildquelle die **Erzaehlweise**:

| | |
|---|---|
| **Er-Perspektive** (Vorgabe) | Handlungen des Helden werden mit seinem Namen geschrieben, und er ist als Figur im Bild zu sehen. |
| **Ich-Perspektive** | Handlungen in der Ich-Form, und die Kamera ist sein Blick -- er selbst erscheint nicht im Bild, du siehst durch seine Augen. |

Die Wahl gilt fuer die ganze Partie, laesst sich aber jederzeit mit `/perspektive: ich` bzw.
`/perspektive: er` wechseln. Sie steckt im Spielstand; aeltere Staende starten in der
Er-Perspektive.

### Der Ort

Das **Ort-Menue** (Knopf mit der Ortsmarke) fuehrt Name, Beschreibung und die **Kulisse fuer Bilder**
(englisch). Die Kulisse steht hier, weil sie zum Ort gehoert; der Bildstil steht im Bildmenue 🖼.

Erzaehlt die Handlung einen **Ortswechsel**, geschieht er wirklich: Name, Beschreibung, Bildkulisse
und Ankunftsszene werden neu ausformuliert, der Raumtitel wechselt, das Bild wird neu gezeichnet
und der Wechsel landet im Langzeitgedaechtnis. Wer nicht mitkommt, gehoert unter `abgang` -- wer am
neuen Ort dazustoesst, unter `auftritt`; beides regelt dieselbe Antwort der Regie.

Veraendert sich der Ort nur (die Kerzen erloeschen, Regen setzt ein), wird das an die Beschreibung
angehaengt, statt den Ort zu wechseln. Dieselbe Veraenderung wird nicht doppelt eingetragen.

Von Hand: im Ort-Menue einen neuen Ort beschreiben und **✦ DORTHIN** druecken, oder `/ort: …`
schreiben. `/ort` ohne Angabe oeffnet das Menue.

### Mehrere Räume, und wer in welchem steht

Ein Ortswechsel wirft den alten Ort nicht mehr weg: Jeder Raum, der einmal betreten wurde, bleibt
bestehen, und **jede Figur steht in genau einem davon**. Die Kachelübersicht — `/räume` oder der
Knopf **⌗ ALLE RÄUME** im Ort-Menü — zeigt alle Räume nebeneinander und darin, wer sich gerade wo
aufhält. Der Raum mit der Kamera ist hervorgehoben. Aus jeder Kachel heraus lässt sich hingehen
(**◎ DORTHIN**) oder eine Figur herholen; ein neuer Raum entsteht mit **＋**.

Drei Regeln halten das zusammen:

* **Die Kamera hängt an der Figur, die du spielst.** Verlässt sie den Raum, geht das Bild mit — der
  Raumtitel wechselt, ein neues Panel entsteht.
* **Wer nicht im Raum ist, ist nicht da.** Er bleibt im Spiel, mit Profil, Beziehungen und
  Gedächtnis, taucht aber weder im Bild auf noch im Dialog: Die Regie bekommt ihn ausdrücklich als
  abwesend genannt und darf ihn nicht sprechen lassen. In der Figurenleiste oben steht er blass und
  mit seinem Raum dahinter.
* **Einzelne dürfen durch Türen gehen.** Die Regie hat dafür ein eigenes Feld (`Name > Raum`);
  ein `ortwechsel` bewegt weiterhin alle, die gerade zusammenstehen.

### Wen du spielst

Standardmäßig spielst du den Helden. Im **Figurenmenü** trägt jeder Block — der Held und jede Figur
— ein Kästchen **„Diese Rolle spiele ich"**. Setzt du den Haken auf eine Figur, dreht sich alles um:

* Was du eingibst, sagt und tut **diese Figur**; deine Zeilen tragen ihren Namen.
* **Der Held antwortet dann selbst.** Er ist ab da eine Rolle der KI wie jede andere — mit seinem
  Beruf, seiner Herkunft und seiner Eigenart — und erscheint als normale Figurenzeile im Gespräch.
* Die gespielte Figur wird für die KI gesperrt: Sie spricht sie nie, damit sie dir nicht ins Wort
  fällt.
* Die Kamera zieht mit — du siehst, was deine Figur sieht.

Die Kästchen verhalten sich wie Radioknöpfe: Es ist immer genau eine Rolle besetzt. Wird die
gespielte Figur entfernt, spielst du wieder den Helden.

### Wer im Bild ist

Ein Panel muss nicht immer alle zeigen. Im Bildmenü steht dafür **WER IST IM BILD**:

| Wahl | Bild |
| --- | --- |
| automatisch | die Regie entscheidet je Zug mit |
| alle Anwesenden | Held und Figuren des Raums (wie bisher) |
| nur die Figuren | der Held bleibt draußen |
| nur der Held | die Figuren bleiben draußen |
| niemand — Detailaufnahme | keine Person, ein Ding aus nächster Nähe, aus der Ich-Perspektive |

Die Wahl gilt dauerhaft, bis sie wieder auf *automatisch* steht; dann schlägt die Regie zu jedem
Zug ein Motiv vor. Gezeichnet wird immer nur, wer auch im Raum steht — und in der Ich-Perspektive
nie die Figur, durch deren Augen du schaust.

### Kleidung folgt der Handlung

Zieht sich jemand im Verlauf um, legt etwas ab oder wirft sich etwas ueber, traegt die Regie das
neue Outfit ein: es steht danach im Figurenmenue 👤, in der Chronik und im naechsten Bild -- das
sofort neu gezeichnet wird, weil ein Kleiderwechsel sichtbar ist.

Damit das ueberhaupt moeglich ist, kennt die Regie jetzt auch, **was jede Figur gerade traegt**.
Vorher stand das nirgends in ihrem Kontext; sie konnte weder konsistent erzaehlen noch einen
Wechsel melden.

Unveraenderte Angaben werden verworfen, damit nicht bei jedem Zug dasselbe Bild neu entsteht.
Der Held kann sich ebenso umziehen. Von Hand geht es weiter mit `/kleidungN: …` oder im
Figurenmenue.

### Wenn eine Aenderung nicht ankommt

Die Regie antwortet mit einem JSON-Objekt, in dem `auftritt`, `abgang`, `ortwechsel` und
`kleidung` den Spielzustand aendern. Bleibt eine Aenderung aus, zeigt **`/roh`**, was
tatsaechlich zurueckkam: ob das Feld fehlte, leer war oder die Antwort abgebrochen ist.

Die Feldreihenfolge ist deshalb kein Zufall -- die kurzen Zustandsfelder stehen **vor** den langen
Fliesstextfeldern `bild`, `handlung` und `fakt`. Wird eine Antwort abgeschnitten, faellt weg was
hinten steht, und das sollen nicht die Felder sein, die das Spiel weiterbewegen.

### Wenn die Welterschaffung haengt

Sie ist der Aufruf mit der laengsten angeforderten Ausgabe und damit der anfaelligste. Die
Wartezeit lag bei fuenf Minuten ohne jede Rueckmeldung -- das sah aus wie ein Absturz. Jetzt:
hoechstens 150 Sekunden, mit laufendem Sekundenzaehler im Statustext, und die angeforderten Texte
sind kuerzer (5 bis 7 statt mindestens 8 Saetze, 3 bis 5 statt 5 bis 10).

Laeuft sie trotzdem in die Zeitueberschreitung, sagt die Meldung ausdruecklich, dass es nicht an
der Eingabe liegt, und rät zum zweiten Versuch. Kommt die Antwort unvollstaendig zurueck, nennt
der Generator die fehlenden Felder, statt stillschweigend Platzhalter einzusetzen.

### Wenn die KI nicht rechtzeitig antwortet

Die Anweisung an die Regie wuchs mit jedem gespielten Zug: Verlauf, Gedaechtnis und
Ortsbeschreibung waren ungedeckelt. Gemessen an einer laufenden Partie mit zwei Figuren waren das
rund 10.500 Zeichen pro Zug -- genug fuer eine Zeitueberschreitung.

Alle Bloecke sind jetzt gedeckelt: zehn Verlaufszeilen zu hoechstens 240 Zeichen, die juengsten
vierzehn Fakten, Vorgeschichte, Handlung und Ortsbeschreibung auf feste Laengen. Dieselbe Partie
kommt damit auf rund 7.700 Zeichen.

Laeuft trotzdem eine Anfrage in die Zeitueberschreitung, schaltet der Generator selbst auf einen
**kuerzeren Kontext** um (sechs Zeilen, acht Fakten, knappere Texte -- rund 6.000 Zeichen) und sagt
es im Dialog. Mit `/nochmal` laesst sich der Zug dann wiederholen. `/roh` zeigt an, welcher Modus
gerade gilt.

### Besetzung folgt der Handlung

Erzaehlt die Regie, dass jemand hereinkommt oder den Ort verlaesst, zieht die Besetzung nach: die
Figur tritt tatsaechlich auf oder verschwindet, samt Stimmung, Kleidung, Chronik und Bild. Der
Schalter dafuer steht in ⚙ (**Figuren treten auf und ab, wenn die Handlung es erzaehlt**, an).

Eine blosse Erwaehnung reicht nicht -- die Regie wird ausdruecklich angewiesen, das nur zu melden,
wenn es im selben Moment wirklich geschieht. Die Obergrenze von vier Figuren gilt weiterhin, und
mindestens eine Person bleibt immer am Ort. Auftritte und Abgaenge landen als Fakten im
Langzeitgedaechtnis, damit spaeter niemand mit einer Abwesenden spricht.

Von Hand geht beides weiter wie bisher: **+ NPC** laesst jemanden auftreten, das ✕ am Namensschild
laesst jemanden gehen.

### Der Held im Auto-Modus

In ⚙ steht der Schalter **Im Auto-Modus handelt der Held selbst mit** (an). Ist er gesetzt, darf
die Regie im Auto-Modus auch deine Figur sprechen und handeln lassen -- sie verfolgt eigene
Absichten, fragt nach und ergreift die Initiative, statt nur Stichwortgeber zu sein. Alle
bisherigen Eingriffe bleiben:

* freier Text = stehende Regie fuer die ganze Szene
* `/sag: …` = du sprichst selbst, mitten im Auto-Modus
* `/npcN: …` = verdeckte Regie an eine Figur, die dann als Naechste dran ist
* AUTO ausschalten = du uebernimmst wieder vollstaendig

Ist der Schalter aus, verhaelt sich der Auto-Modus wie bisher: nur die uebrigen Figuren spielen.

## Befehle im Spiel

Im Spiel steht die vollstaendige Liste hinter dem Knopf **?** in der Kopfleiste, ebenso ueber
`/hilfe`. Sie baut sich aus derselben Registry auf, aus der die Befehle auch ausgefuehrt werden --
ein neuer Befehl steht damit automatisch in der Hilfe, ohne Nachpflege. Ein Test prueft das mit.

| Befehl | Wirkung |
|---|---|
| *(einfach schreiben)* | Der Held spricht. Text in `[eckigen Klammern]` ist eine Handlung. |
| `/hilfe` | Liste aller Befehle im Dialogfenster |
| `/sag: …` | selbst sprechen, auch während der Auto-Modus läuft |
| `/npcN: …` | verdeckte Regie an Figur N. Die nächste freie Nummer lässt eine **neue** Figur auftreten. |
| `/kleidungN: …` | dauerhaftes Outfit für Figur N (englisch) |
| `/regie: …` | stehende Regie für die ganze Szene, leer = löschen |
| `/bild: …` | neues Bild aus eigener Beschreibung |
| `/gedanken` | verdeckte Absichten aller Figuren zeigen — verrät die Geheimnisse |
| `/blatt N` | Charakterblatt zeichnen — N ist die Figurennummer, `held` der Held (ohne Angabe: Figurenmenü) |
| `/mission: …` | das Ziel der Geschichte setzen; `weg` streicht es, ohne Angabe öffnet sich das Missions-Menü |
| `/stil: …` | Bildstil wechseln (`manga`, `comic`, `aquarell`, `oel`, `realistisch`, `pixel` oder freier Text) — dasselbe geht oben im Bildmenü 🖼 |
| `/ort: …` | an einen anderen Ort wechseln (ohne Angabe: Ort-Menü) |
| `/perspektive: ich\|er` | Erzählweise wechseln (ohne Angabe: aktuelle anzeigen) |
| `/roh` | zeigt die letzte Antwort der Regie im Original — zur Fehlersuche |
| `/quelle` | Bildquelle wechseln |
| `/undo` | letzten Zug zurücknehmen |
| `/nochmal` | letzten Zug verwerfen und die Antwort neu würfeln |
| `/speichern` | Spielstände öffnen |
| `/räume` | Kachelübersicht aller Räume — wer wo ist, und wer wohin geht |
| `/auswerten` | ein übernommenes Gespräch (noch einmal) auswerten — Profile, Beziehungen, Gedächtnis |

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
* **Bildstil auch im laufenden Spiel wählbar** — im Bildmenü 🖼, mit denselben
  Vorgaben wie auf dem Startbildschirm plus eigenem Text. Vorher ging das nur über `/stil:`.
* **Einklappbare Kopfleiste**: Der Schalter unter der Titelzeile fährt Werkzeuge, Figurenanzeige
  und Titel nach oben aus dem Bild — das Szenenbild bleibt unverdeckt. Der Zustand wird gemerkt.
* **Bis zu vier Figuren** gleichzeitig statt zwei.
* **Undo und /nochmal** für misslungene Antworten.
* **Vier Spielstand-Plätze** (einer automatisch) mit Ex- und Import als Datei oder Textblock,
  Versionsfeld und Migration alter V6-Stände.
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

## Was nach außen geht

Der Generator hat keinen eigenen Server. Spielstände, Einstellungen und eingetragene Schlüssel
liegen im `localStorage` des Spielers. Nach außen gehen nur:

| Wohin | Was | Wann |
|---|---|---|
| Perchance | Texteingaben an das KI-Plugin | immer |
| die gewählte Bildquelle | Bildbeschreibung, ggf. Schlüssel | nur wenn die Quelle nicht Perchance ist |
| `raw.githubusercontent.com` | nichts als die Anfrage selbst — GitHub sieht dabei die IP | bei jedem Start |

Derselbe Text steht als Block **DATENSCHUTZ** am Ende der Einstellungen, damit ihn auch findet,
wer die README nie öffnet.

**Schriften kommen aus dem System.** Cinzel und EB Garamond hingen früher an
`fonts.googleapis.com` — jede Einbindung von dort schickt die IP-Adresse des Besuchers an Google,
und genau dafür gab es in Deutschland Abmahnungen (LG München I, 2022). Die beiden Stacks stehen
als `--schrift-titel` und `--schrift-text` im `:root`-Block. Wer die Originalschriften zurückwill,
hostet sie selbst und trägt sie dort ein; ein Link zu Google gehört nicht zurück in die Datei.

## Lizenz

MIT, siehe `LICENSE` im Wurzelverzeichnis. Der Code ist selbst geschrieben, ohne fremde
Bibliotheken und ohne eingebettete Fremdinhalte — es gibt nichts, was gesondert nachzuweisen wäre.

## Test

```
node test/logik.test.js
```

Prüft Parser, Prompt-Bau, Befehlserkennung, Bildquellen-Registry, Spielstände und die
V6-Migration gegen einen minimalen DOM-Stub — ohne Netz und ohne Browser. Dazu die Ladeschale:
Aufteilen der geholten Datei, Adressbau, Zweig-Umschaltung, beide Rückfallebenen und die
Fehlermeldung bei 404. Beide Skripte werden direkt aus den HTML-Dateien gezogen, laufen also nie
gegen eine veraltete Kopie.

Weil `main` jetzt der laufende Generator ist, läuft derselbe Test bei jedem Push über
`.github/workflows/proxima.yml`. Ein roter Haken dort heißt: nicht mergen, sonst ist der Fehler
eine Minute später im Generator.
