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

var DescFilter1 = '';
var DescFilter2 = '';


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

    getFilters()

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
}

function parseWeather(description){
    var WarnungsText = '';

    // Warning Text Today
    var SearchCrit1 = description.indexOf('Today') + 1;
    var SearchCrit2 = description.indexOf('Tomorrow') + 1;
    var ContentHeute = description.slice((SearchCrit1 - 1), SearchCrit2);
    SearchCrit1 = description.indexOf(DescFilter1) + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + DescFilter1.length;
    var ContentFromDescFilter1 = ContentHeute.slice((SearchCrit1))
    SearchCrit2 = ContentFromDescFilter1.indexOf(DescFilter2) + 1;
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

    // Icon Link:
    SearchCrit1 = ContentHeute.indexOf('src=') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 13;
    SearchCrit2 = ContentHeute.indexOf('alt=') + 1;
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -2;
    var Warnung_img = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    adapter.createState('', 'icon', 'from', {
        read: true, 
        write: true, 
        name: "Icon", 
        type: "string", 
        def: Warnung_img,
        role: 'value'
    });

    adapter.log.info('Variable searchcrit before:' + SearchCrit1 )

    // Warning Text From/To Today
    var Warnung_Von = ''
    var Warnung_Bis = ''
    if (ContentHeute.indexOf('From: </b><i>') != -1){
        SearchCrit1 = ContentHeute.indexOf('From: </b><i>') + 1;
        SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 13;
        SearchCrit2 = ContentHeute.indexOf('CET') + 1;
        SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -2;
        Warnung_Von = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);

        SearchCrit1 = ContentHeute.indexOf('Until: </b><i>') + 1;
        SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 14;
        SearchCrit2 = ContentHeute.indexOf(' CET</i></td><') + 1;
        SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -1;
        Warnung_Bis = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    }
    
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

function getFilters(){
    DescFilter1 = '';
    DescFilter2 = '';

    var link = adapter.config.pathXML
    var SearchCrit1 = link.indexOf('rss') + 4;
    var country = link.slice((SearchCrit1), SearchCrit1 + 2)
    switch (country) {
        case 'at':
            // Österreich
            DescFilter1 = 'deutsch:';
            DescFilter2 = 'english:';
           break;
        case 'de':
                // Deutschland
                DescFilter1 = 'deutsch:';
                DescFilter2 = '</td>';
               break;
        case 'it':
            // Italien
            DescFilter1 = 'italiano:';
            DescFilter2 = '</td>';
           break;
        default:
                DescFilter1 = 'english:';
                DescFilter2 = '</td>';
           break;
       }




}