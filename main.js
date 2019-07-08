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

					adapter.log.info("Result: " + JSON.stringify(result));
					adapter.log.info("Result title: " + JSON.stringify(result.rss));
					adapter.log.info("Result title2: " + JSON.stringify(result.rss.title));

				}

			});




            //var json = convert.xml2json(body, {compact: false, spaces: 4});
            //adapter.log.info(json);
            //processXML(body)
        }
        
      });    
}

function processXML(content){
        
        adapter.log.info(content.title)
}