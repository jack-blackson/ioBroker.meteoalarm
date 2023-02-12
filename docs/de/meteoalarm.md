# ioBroker.meteoalarm

## Zur vis hinzufügen
Am einfachsten fügst du es zu deinem Vis hinzu, indem du das Widget basic - html verwendest und dort {meteoalarm.0.htmlToday} eingibst. Dadurch erhältst du ein vorgefertigtes HTML-Widget, das du im Adapter-Setup anpassen kannst.

# Einstellungen

## Einstellungen
"No Background Color in HTML Widget": 
Ability to use the HTML Widget without background color (e.g. if you want to use the color object to fill your whole widget, not just the html widget)

"Define Warning colors": 
Ability to define the colors for the various alarm levels in HEX code. Used for HTML widget and also for the color object to manually assign it to another widget

"Use white icons": 
Use white icons instead of black ones

"Icons": 
Define the size of the icon in the HTML widget

"No symbols in widget":
Don't use the symbol in the HTML widget. You can still access it in the objects. This is usefill if you want to show the icon seperatly from the widget - e.g. in a bigger size.

"Today instead of Weekday"
Show in the header of the widget instead of the weekday "today", "tomorrow" or "yesterday.

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

## Generelle Objekte

|Object Name|Description|                                                                       
|:---:|:---:|
|JSON|JSON that includes all alarms. Structure: Event, Description,Level,Start Date, Icon, Alarmtype|
|color|Color code of the hightest available alarm level|
|htmlToday|HTML Widget code (adjustable in setup)|
|lastUpdate|Last Update from Meteoalarm|
|level|Maximum level of available alarms|
|link|Feed Link|
|location|Location name|
|noOfAlarms|Count of available alarms|
|notification|Object that changes if a new alarm is added. Can be used for notifications.|


## Objects for each alarm
These objects are created for each alarm.

|Object Nane|Description|                                                                       
|:---:|:---:|
|color|Hex code for alarm - can be adjusted in setup for the various levels|
|description|Long description of alarm|
|effective|Start date/time of alarm event|
|event|Event type|
|expires|End date/time of alarm event|
|headline|Short description of alarm|
|icon|Link to icon|
|level|Level number (see alarm levels below)|
|levelText|Level in words|
|link|Link to xml|
|sender|Who sent the alarm (e.g. Deutscher Wetterdienst")|
|sent|Date/time when alarm was sent|
|type|Type of alarm as number (see alarm types above|
|typeText|Type of alarm in words (see alarm types above|
|updateIdentifier|Not relevant|

# Alarmdetails

## Alarm Levels
|Alarm Level|Number|Description|                                                                       
|:---:|:---:|:---:|
|Green|1|There is no warning available at the moment.|
|Yellow|2|The weather is potentially dangerous. The predicted weather phenomena are not unusual, but increased attention should be paid to activities exposed to meteorological risks. Keep yourself informed about the meteorological conditions to be expected and do not take any avoidable risks.|
|Orange|3|The weather is dangerous. Unusual meteorological phenomena have been predicted. Damage and accidents are likely. Be very attentive and careful and keep up to date with the expected meteorological conditions. |
|Red|4|The weather is very dangerous. Unusually intense meteorological phenomena were predicted. Extreme damage and accidents, often over large areas, threaten life and property. |

## Alarm Types
|Alarm Type|Description|                                                                       
|:---:|:---:|
|1|Wind|
|2|Snow/Ice|
|3|Thunder & Lightning|
|4|Fog|
|5|High temperature|
|6|Low temperature|
|7|Coast Event|
|8|Forrest fire|
|9|Avalanche|
|10|Rain|
|11|Unknown|
|12|Flood|
|13|Rain-Flood|

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