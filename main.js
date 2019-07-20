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
var country = '';

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
    adapter.log.info('Requesting data from ' + url)
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

    adapter.createState('', '', 'location', {
        read: true, 
        write: true, 
        name: "Location", 
        type: "string", 
        def: JSON.stringify(content.rss.channel.item.title),
        role: 'value'
    });
    adapter.log.info('Received data for ' + JSON.stringify(content.rss.channel.item.title))

    adapter.createState('', '', 'link', {
        read: true, 
        write: true, 
        name: "Link", 
        type: "string", 
        def: JSON.stringify(content.rss.channel.item.link),
        role: 'value'
    });
        
    var newdate = moment(new Date()).local().format('DD.MM.YYYY HH:mm')
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

    if (DescFilter1 != 'nA'){
        parseWeather(content.rss.channel.item.description,'today')
        parseWeather(content.rss.channel.item.description,'tomorrow')
        setTimeout(function() { 
            updateHTMLWidget()
        }, 2000);
        
    }
    else{
        // Land ist nicht in der Filterliste (getfilters()) -> daher kann Text nicht gefunden werden
        adapter.log.error('The country ' + country +  ' is not set up. Please create a github issue to get it set up.')
    }
}

function updateHTMLWidget(){
    var htmllong = '';
    var typeName = '';
    var color = '';
    var icon = '';
    var from = '';
    var to = '';
    var text = '';

    adapter.getState('today.type', function (err, state) {
        adapter.log.info('Type: ' + state.val)
        //var typeNumber = Number(state.val)

        typeName = getTypeName(state.val);
        adapter.log.info('Typename: ' + typeName)

    });
    adapter.getState('today.color', function (err, state) {
        color = state.val;
    });

    adapter.getState('today.icon', function (err, state) {
        icon = state.val;
    });

    adapter.getState('today.from', function (err, state) {
        from = state.val;
    });

    adapter.getState('today.to', function (err, state) {
        to = state.val;
    });
    
    adapter.getState('today.text', function (err, state) {
        text = state.val;
    });

    setTimeout(function() { 
        htmllong += '<div style="background:' + color + '"  border:"10px">';
        htmllong += '<p></p><h3><img src="//' +  icon + '" alt="" width="20" height="20"/> '
        htmllong += typeName + '</h3><p>' + from + ' - ' + to 
        htmllong += '</p><p>' + text + '</p></div>'
    
        adapter.createState('', '', 'htmlLong', {
            read: true, 
            write: true, 
            name: "HTML Widget Long Text", 
            type: "string", 
            def: htmllong,
            role: 'value'
        });
    }, 5000);
}

function getTypeName(type){

    switch (type) {
        case '1':
            return 'Wind'
            break;
        case '2':
            return 'Schnee & Eis'
            break;
        case '3':
            return 'Blitz und Donner'
            break;
        case '4':
            return 'Nebel'
            break;
        case '5':
            return 'Hohe Temperaturen'
            break;
        case '6':
            return 'Niedrige Temperaturen'
            break;
        case '7':
            return 'Küstenereigniss'
            break;
        case '8':
            return 'Waldbrand'
            break;
        case '9':
            return 'Lawinen'
            break;
        case '10':
            return 'Regen'
            break;
        case '11':
            return 'Unknown'
            break;
        case '12':
            return 'Flut'
            break;
        case '13':
            return 'Regen-Flut'
            break;
        case '':
            return ''
            break;
       default:
           return 'undefined'
           break;
    }

}

function parseWeather(description,type){
    var WarnungsText = '';
    var folder = '';
    var SearchCrit1 = 0;
    var SearchCrit2 = 0;
    switch (type) {
        case 'today':
            SearchCrit1 = description.indexOf('Today') + 1;
            SearchCrit2 = description.indexOf('Tomorrow') + 1;
            folder = 'today';
           break;
       case 'tomorrow':
            SearchCrit1 = description.indexOf('Tomorrow') + 1;
            SearchCrit2 = description.length;
            folder = 'tomorrow';
           break;       
       default:
           break;
       }



    // Warning Text
    var ContentHeute = description.slice((SearchCrit1 - 1), SearchCrit2);
    SearchCrit1 = ContentHeute.indexOf(DescFilter1) + 1;
    if (SearchCrit1 != 0){
        SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + DescFilter1.length;
        var ContentFromDescFilter1 = ContentHeute.slice((SearchCrit1))
        SearchCrit2 = ContentFromDescFilter1.indexOf(DescFilter2) + 1;
        SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -1;
        WarnungsText = ContentFromDescFilter1.slice(1, SearchCrit2);
    } 
    adapter.createState('', folder, 'text', {
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
    SearchCrit2 = (typeof SearchCrit2 == 'number' ? SearchCrit2 : 0) + -3;
    var Warnung_img = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    adapter.createState('', folder, 'icon', {
        read: true, 
        write: true, 
        name: "Icon", 
        type: "string", 
        def: Warnung_img,
        role: 'value'
    });

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
    
    adapter.createState('', folder, 'from', {
        read: true, 
        write: true, 
        name: "From", 
        type: "string", 
        def: Warnung_Von,
        role: 'value'
    });
    adapter.createState('', folder, 'to', {
        read: true, 
        write: true, 
        name: "To", 
        type: "string", 
        def: Warnung_Bis,
        role: 'value'
    });

        // Warning Text  Level
        SearchCrit1 = ContentHeute.indexOf('level:') + 1;
        SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 6;
        SearchCrit2 = SearchCrit1 + 1;
        var Level = ContentHeute.charAt((SearchCrit1 - 1));
        var Color = ''
        if (SearchCrit1 != 0) {
            adapter.createState('', folder, 'level', {
                read: true, 
                write: true, 
                name: "Level", 
                type: "string", 
                def: Level,
                role: 'value'
            });
        
            switch (Level) {
             case '1':
                // Grün
                Color = '#01DF3A';
                break;
            case '2':
                // Gelb
                Color = '#FFFF00';
                break;
            case '3':
                // Orange
                Color = '#FF8000';
                break;
            case '4':
                // Rot
                Color = '#FF0000';
                break;
            default:
               
                break;
            }
            adapter.createState('', folder, 'color', {
                read: true, 
                write: true, 
                name: "Color", 
                type: "string", 
                def: Color,
                role: 'value'
            });
        }

    //Warning Text Type
    SearchCrit1 = ContentHeute.indexOf('awt:') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 4;
    SearchCrit2 = SearchCrit1 + 1;
    var Typ = ContentHeute.slice((SearchCrit1 - 1), SearchCrit2);
    if (SearchCrit1 != 0) {
        if (Level == '1'){
            Typ = '';
        }

        adapter.createState('', folder, 'type', {
            read: true, 
            write: true, 
            name: "Type", 
            type: "string", 
            def: Typ,
            role: 'value'
        });

        adapter.createState('', folder, 'typeText', {
            read: true, 
            write: true, 
            name: "Type Text", 
            type: "string", 
            def: getTypeName(Typ),
            role: 'value'
            });
    }
    
}

function getFilters(){
    DescFilter1 = '';
    DescFilter2 = '';

    var link = adapter.config.pathXML
    var SearchCrit1 = link.indexOf('rss') + 4;
    country = link.slice((SearchCrit1), SearchCrit1 + 2)
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
        case 'hu':
            // Ungarn
            DescFilter1 = 'magyar:';
            DescFilter2 = 'english:';
           break;
        case 'no':
            // Norwegen
            DescFilter1 = 'norsk:';
            DescFilter2 = 'english:';
           break;
        case 'nl':
            // Niederlande
            DescFilter1 = 'nederlands:';
            DescFilter2 = 'english:';
           break;
        case 'fi':
            // Finnland
            DescFilter1 = 'suomi:';
            DescFilter2 = 'svenska:';
           break;
        case 'hr':
            // Kroatien
            DescFilter1 = 'hrvatski:';
            DescFilter2 = 'english:';
           break;
        default:
                DescFilter1 = 'nA';
                DescFilter2 = 'nA';
           break;
       }
}