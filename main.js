/**
 *
 *      ioBroker COUNTDOWN Adapter
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
    //'http://meteoalarm.eu/documents/rss/at/AT002.rss'
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
                    processJSON(body)
				}
			});
        }
      });    
}

function processJSON(content){
        adapter.setState({state: 'location'}, {val: JSON.stringify(content.rss.channel.item.title), ack: true});
        adapter.setState({state: 'link'}, {val: JSON.stringify(content.rss.channel.item.link), ack: true});
        var newdate = moment(new Date(), 'DD.MM.YYYY HH:mm:ss').toDate()
        adapter.setState({state: 'lastUpdate'}, {val: JSON.stringify(newdate), ack: true});
        adapter.setState({state: 'publicationDate'}, {val: JSON.stringify(content.rss.channel.item.pubdate), ack: true});
        adapter.log.info('Wetter: ' + JSON.stringify(content.rss.channel.item.description))

}