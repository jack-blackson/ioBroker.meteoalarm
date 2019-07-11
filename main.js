/**
 *
 *      ioBroker Meteoalarm Adapter
 *
 *      (c) 2019 Alexander K <blacksonj7@gmail.com>
 *
 *      MIT License
 *
 */

'use strict';
const utils = require('@iobroker/adapter-core');
const request = require('request');
const moment = require('moment');
var parseString = require('xml2js').parseString;

var AdapterStarted;

var warningTextToday = '';
var warningTextTodayFrom = '';
var warningTextTodayTo = '';
var warningTextTodayType = '';
var warningTextTodayLevel = '';
var warningTextTodayColor = '';


let adapter;
startAdapter()

setInterval(function() { 
    // alle 10 Minute ausführen 
    main(); 
}, 600000);


function startAdapter(options) {

    options = options || {};
    Object.assign(options, {
        name: 'meteoalarm',
        ready: () => main()
    });

    AdapterStarted = false;

    adapter = new utils.Adapter(options);

    return adapter;

}


function main() {

    adapter.setObjectNotExists('today', {
        common: {
              name: 'today'
        },
        type: 'channel',
        'native' : {}
    });

    adapter.setObjectNotExists('tomorrow', {
        common: {
              name: 'tomorrow'
        },
        type: 'channel',
        'native' : {}
    });

    //'http://meteoalarm.eu/documents/rss/at/AT002.rss'
    //  http://meteoalarm.eu/documents/rss/de/DE387.rss
    if (adapter.config.pathXML != '') {
        requestXML(adapter.config.pathXML)
    }
    else{
        adapter.log.error('No path maintained!!')
    }

    adapter.config.interval = 600000;
    adapter.subscribeStates('*')
}

function requestXML(url){
    adapter.log.info('Requesting data')
    request.post({
        url:     url
      }, function(error, response, body){
        if (error){
            adapter.log.error(error)
        }
        if (body) {

            parseString(body, {

				explicitArray: false,

				mergeAttrs: true

			}, 

			function (err, result) {

				if (err) {

					adapter.log.error("Fehler: " + err);

				} else {
                    processJSON(result)
				}
			});
        }
      });    
}

function processJSON(content){

    adapter.log.info('Location: ' + JSON.stringify(content.rss.channel.item.title))
    adapter.log.info('Wetter: ' + JSON.stringify(content.rss.channel.item.description))

    adapter.createState('', '', 'location', {
        read: true, 
        write: true, 
        name: "Location", 
        type: "string", 
        def: JSON.stringify(content.rss.channel.item.title),
        role: 'value'
    });

    adapter.createState('', '', 'link', {
        read: true, 
        write: true, 
        name: "Link", 
        type: "string", 
        def: JSON.stringify(content.rss.channel.item.link),
        role: 'value'
    });
        

    var newdate = moment(new Date(), 'DD.MM.YYYY HH:mm:ss').toDate()
    adapter.createState('', '', 'lastUpdate', {
        read: true, 
        write: true, 
        name: "lastUpdate", 
        type: "string", 
        def: newdate,
        role: 'value'
    });

    adapter.createState('', '', 'publicationDate', {
        read: true, 
        write: true, 
        name: "publicationDate", 
        type: "string", 
        def: JSON.stringify(content.rss.channel.item.pubDate),
        role: 'value'
    });


    parseWeather(content.rss.channel.item.description)


    /*
        // today
        adapter.setObjectNotExists('today.text', {
            common: {
                  name: 'text'
            },
            type: 'state',
            val: warningTextToday,
            'native' : {}
         });
         adapter.setObjectNotExists('today.from', {
            common: {
                  name: 'from'
            },
            type: 'state',
            val: warningTextTodayFrom,
            'native' : {}
         });
         adapter.setObjectNotExists('today.to', {
            common: {
                  name: 'to'
            },
            type: 'state',
            val: warningTextTodayTo,
            'native' : {}
         });
         adapter.setObjectNotExists('today.type', {
            common: {
                  name: 'type'
            },
            type: 'state',
            val: warningTextTodayType,
            'native' : {}
         });
         adapter.setObjectNotExists('today.level', {
            common: {
                  name: 'level'
            },
            type: 'state',
            val: warningTextTodayLevel,
            'native' : {}
         });
         adapter.setObjectNotExists('today.color', {
            common: {
                  name: 'color'
            },
            type: 'state',
            val: warningTextTodayColor,
            'native' : {}
         });
         */
}

function parseWeather(description){
    var WarnungsText = '';

    // Warning Text Today
    var SearchCrit1 = description.indexOf('Today') + 1;
    var SearchCrit2 = description.indexOf('Tomorrow') + 1;
    var ContentHeute = description.slice((SearchCrit1 - 1), SearchCrit2);
    SearchCrit1 = ContentHeute.indexOf('deutsch: ') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 9;
    SearchCrit2 = ContentHeute.indexOf('english') + 1;
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -1;
    if (SearchCrit1 != '9') {
        WarnungsText = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    }
    adapter.createState('', 'today', 'text', {
        read: true, 
        write: true, 
        name: "Text", 
        type: "string", 
        def: WarnungsText,
        role: 'value'
    });



    // Warning Text From/To Today
    SearchCrit1 = ContentHeute.indexOf('From: </b><i>') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 13;
    SearchCrit2 = ContentHeute.indexOf('CET') + 1;
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -2;
    adapter.log.info('Variable From:' + SearchCrit1 + ',' + SearchCrit2 )
    var Warnung_Von = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    SearchCrit1 = ContentHeute.indexOf('Until: </b><i>') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 14;
    SearchCrit2 = ContentHeute.indexOf(' CET</i></td><') + 1;
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -1;
    var Warnung_Bis = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    adapter.createState('', 'today', 'from', {
        read: true, 
        write: true, 
        name: "From", 
        type: "string", 
        def: Warnung_Von,
        role: 'value'
    });
    adapter.createState('', 'today', 'to', {
        read: true, 
        write: true, 
        name: "To", 
        type: "string", 
        def: Warnung_Bis,
        role: 'value'
    });


    //Warning Text Today Type
    SearchCrit1 = ContentHeute.indexOf('awt:') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 4;
    SearchCrit2 = SearchCrit1 + 1;
    var Typ = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    if (SearchCrit1 != 0) {
      warningTextTodayType = Typ;
      adapter.createState('', 'today', 'type', {
        read: true, 
        write: true, 
        name: "To", 
        type: "string", 
        def: Typ,
        role: 'value'
        });
    }
    


    // Warning Text Today Level
    SearchCrit1 = ContentHeute.indexOf('level:') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 6;
    SearchCrit2 = SearchCrit1 + 1;
    var Level = ContentHeute.charAt((SearchCrit1 - 1));
    if (SearchCrit1 != 0) {
        adapter.createState('', 'today', 'level', {
            read: true, 
            write: true, 
            name: "Level", 
            type: "string", 
            def: Level,
            role: 'value'
        });
    
        warningTextTodayColor = '';
        switch (Level) {
         case '1':
            // Grün
            warningTextTodayColor = '#01DF3A';
            break;
        case '2':
            // Gelb
            warningTextTodayColor = '#FFFF00';
            break;
        case '3':
            // Orange
            warningTextTodayColor = '#FF8000';
            break;
        case '4':
            // Rot
            warningTextTodayColor = '#FF0000';
            break;
        default:
           
            break;
        }
        adapter.createState('', 'today', 'color', {
            read: true, 
            write: true, 
            name: "Color", 
            type: "string", 
            def: warningTextTodayColor,
            role: 'value'
        });
    }

}