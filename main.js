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
        //requestXML(adapter.config.pathXML)
        requestXML('http://meteoalarm.eu/documents/rss/de/DE387.rss')

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
        
        adapter.setObjectNotExists('location', {
           name: 'location',
           type: "string",
           read: true, 
           write: false, 
           role: 'value',
        });
        
       adapter.log.info('Location: ' + JSON.stringify(content.rss.channel.item.title))

       adapter.setState({ state: 'location'}, {val: 'test', ack: true});

        //adapter.setState('location','test')

        adapter.setObjectNotExists('link', {
            common: {
                  name: 'link'
            },
            type: 'state',
            read: true, 
            write: false, 
            def: JSON.stringify(content.rss.channel.item.link),
            role: 'value',
            'native' : {}
         });

        var newdate = moment(new Date(), 'DD.MM.YYYY HH:mm:ss').toDate()
        adapter.setObjectNotExists('lastUpdate', {
            common: {
                  name: 'lastUpdate'
            },
            type: 'state',
            read: true, 
            write: false, 
            def: newdate,
            role: 'value',
            'native' : {}
         });

         adapter.setObjectNotExists('publicationDate', {
            common: {
                  name: 'publicationDate'
            },
            type: 'state',
            val: JSON.stringify(content.rss.channel.item.pubdate),
            'native' : {}
         });

        adapter.log.info('Wetter: ' + JSON.stringify(content.rss.channel.item.description))
        parseWeather(content.rss.channel.item.description)

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
    warningTextToday = WarnungsText;

    // Warning Text From/To Today
    SearchCrit1 = ContentHeute.indexOf('From: </b><i>') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 13;
    SearchCrit2 = ContentHeute.indexOf('CET') + 1;
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -2;
    var Warnung_Von = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    SearchCrit1 = ContentHeute.indexOf('Until: </b><i>') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 14;
    SearchCrit2 = ContentHeute.indexOf(' CET</i></td><') + 1;
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -1;
    var Warnung_Bis = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    warningTextTodayFrom = Warnung_Von
    warningTextTodayTo = Warnung_Bis

    //Warning Text Today Type
    SearchCrit1 = ContentHeute.indexOf('awt:') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 4;
    SearchCrit2 = SearchCrit1 + 1;
    var Typ = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    if (SearchCrit1 != 0) {
      warningTextTodayType = Typ;
    }

    // Warning Text Today Level
    SearchCrit1 = ContentHeute.indexOf('level:') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 6;
    SearchCrit2 = SearchCrit1 + 1;
    var Level = ContentHeute.charAt((SearchCrit1 - 1));
    if (SearchCrit1 != 0) {
        warningTextTodayLevel = Level;

    
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
    }

}