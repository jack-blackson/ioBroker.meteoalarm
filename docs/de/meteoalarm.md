# ioBroker.meteoalarm

## Zur vis hinzufügen
Am einfachsten fügst du es zu deinem Vis hinzu, indem du das Widget basic - html verwendest und dort {meteoalarm.0.htmlToday} eingibst. Dadurch erhältst du ein vorgefertigtes HTML-Widget, das du im Adapter-Setup anpassen kannst.

# Einstellungen

## Einstellungen
"Keine Hintergrundfarbe im HTML Widget": 
Möglichkeit, das HTML-Widget ohne Hintergrundfarbe zu verwenden (z. B. wenn Sie das Farbobjekt verwenden möchten, um das gesamte Widget zu füllen, nicht nur das HTML-Widget)

"Weiße Symbole für Widget": 
Weiße statt schwarze Icons verwenden.

"Icons": 
Definiere die Größe des Symbols im HTML-Widget

"Symbole im HTML Widget nicht anzeigen":
Verwende keine Symbol im HTML-Widget. Sie können es trotzdem in den Objekten aufrufen. Dies ist nützlich, wenn Sie das Symbol getrennt vom Widget anzeigen möchten - z. B. in einer größeren Größe.

"Heute statt Wochentag"
Anzeige in der Kopfzeile des Widgets anstelle des Wochentags "heute", "morgen" oder "gestern".

"Warnfarben definieren": 
Möglichkeit, die Farben für die verschiedenen Alarmstufen im HEX-Code zu definieren. Verwendet für HTML-Widget und auch für das Farbobjekt, um es manuell einem anderen Widget zuzuweisen.

## Alarmtypen
Hier können Sie festlegen, welche Alarmstufen und Alarmtypen verfolgt werden. Dies hat Auswirkungen auf die Alarmobjekte, auf das HTML-Widget und auf das JSON-Objekt.

## Benachrichtigungen
Es ist möglich, dass der Adapter Ihnen die Benachrichtigungen per Mail, Telegramm, Signal oder Pushover sendet.

* Signal
* Mail
* Pushover
* Telegram
* Synochat

Verfügbare Einstellungen:
* Standort anzeigen: Wenn diese Einstellung aktiviert ist, wird der Ortsname zur Benachrichtigung hinzugefügt.
* Warnstufe in Wörtern: Fügen Sie die Warnstufe in Worten zusätzlich zu den Warnsymbolen hinzu
* Keine Details: Fügen Sie der Benachrichtigung keine Beschreibung der Warnung hinzu - z. B. für Alexa
* Keine Warnungen senden": Eine Benachrichtigung senden, wenn alle Alarme beendet sind und derzeit keine Warnung vorliegt
* Warnstufen-Symbole: Wählen Sie, welche Symbole der Benachrichtigung hinzugefügt werden sollen


## Benachrichtigungsalarmtypen
Hier können Sie festlegen, welche Alarmstufen und -typen für die Benachrichtigungen verwendet werden sollen. Wichtig: Wenn eine Stufe oder ein Typ in der Einstellung "Alarmtypen" nicht verfolgt wird, können Sie sie in den Benachrichtigungen nicht verfolgen.

# Objekte

## Übergreifende Objekte

|Objekt Name|Beschreibung|                                                                       
|:---:|:---:|
|JSON|JSON mit allen Alarm-Daten. Struktur: Event, Description,Level,Start Date, Icon, Alarmtype|
|color|Farbcode der höchsten verfügbaren Alarmstufe|
|htmlToday|HTML Widget (Anpassbar im Setup)|
|lastUpdate|Letztes Update von Meteoalarm|
|level|Maximal verfügbare ALarmstufe|
|link|Feed Link|
|location|Standort Name|
|noOfAlarms|Anzahl verfügbarer Alarme|
|notification|Objekt, das sich ändert, wenn ein neuer Alarm hinzugefügt wird. Kann für Benachrichtigungen verwendet werden.|


## Objecte, die für jeden Alarm erstellt werden
Diese Objekte werden für jeden Alarm erstellt.

|Objekt Nane|Beschreibung|                                                                       
|:---:|:---:|
|color|Hex-Code für Alarm - kann im Setup für die verschiedenen Stufen eingestellt werden|
|description|Langbeschreibung|
|effective|Start Datum/Uhrzeit des Events|
|event|Event Type|
|expires|End Datum/Uhrzeit des Events|
|headline|Kurzbeschreibung|
|icon|Link zum Symbol|
|level|Alarmstufe als Zahl (Alarmstufen siehe unten)|
|levelText|Alarmstufe in Worten|
|link|Link zum xml|
|sender|Absender der Warnung (e.g. Deutscher Wetterdienst")|
|sent|Sendedatum/Uhrzeit|
|type|Alarmtyp als Zahl (Alarmzypen siehe unten)|
|typeText|Alarmtyp als Wort|
|updateIdentifier|Nicht relevant|

# Alarmdetails

## Alarmstufen
|Alarmstufen|Nummer|Beschreibung|                                                                       
|:---:|:---:|:---:|
|Grün|1|Zurzeit ist keine Warnung verfügbar|
|GElb|2|Das Wetter ist potenziell gefährlich. Die vorhergesagten Wetterphänomene sind nicht ungewöhnlich, aber bei Aktivitäten, die meteorologischen Risiken ausgesetzt sind, sollte man erhöhte Aufmerksamkeit walten lassen. Informieren Sie sich über die zu erwartenden meteorologischen Bedingungen und gehen Sie keine vermeidbaren Risiken ein|
|Orange|3|Das Wetter ist gefährlich. Ungewöhnliche meteorologische Phänomene sind vorhergesagt worden. Beschädigungen und Unfälle sind wahrscheinlich. Seien Sie sehr aufmerksam und vorsichtig und halten Sie sich über die zu erwartenden meteorologischen Bedingungen auf dem Laufenden|
|Rot|4|Das Wetter ist sehr gefährlich. Ungewöhnlich intensive meteorologische Phänomene wurden vorhergesagt. Extreme Schäden und Unfälle, oft über große Gebiete hinweg, bedrohen Leben und Eigentum|

## Alarmtypen
|Alarmtypen|Beschreibung|                                                                       
|:---:|:---:|
|1|Wind|
|2|Schnee und Eis|
|3|Gewitter|
|4|Nebel|
|5|Hohe Temperaturen|
|6|Niedrige Temperaturen|
|7|Küstenevent|
|8|Waldbrand|
|9|Lawine|
|10|Regen|
|11|Unbekannt|
|12|Flut|
|13|Regen-Flut|

# Unterstützte Länder
* Österreich
* Deutschland
* Belgien
* BosnienHerzegowina
* Kroatien
* Zypern
* Tschechische Republik
* Dänemark
* Estland
* Finnland
* Frankreich
* Griechenland
* Ungarn
* Island
* Israel
* Italien
* Lettland
* Litauen
* Luxemburg
* Malta
* Niederlande
* Norwegen
* Polen
* Rumänien
* Serbien
* Slowakei
* Slowenien
* Spanien
* Schweden
* Schweiz
* UK

Wenn Sie Ihr Land nicht finden, erstellen Sie bitte einen Eintrag auf github, und ich werde es gerne hinzufügen

# Nicht unterstützte Länder
* Portugal (Geocode-Datei von meteoalarm.org ist wahrscheinlich falsch)
* Bulgarien (Geocode-Datei von meteoalarm.org ist wahrscheinlich nicht korrekt)