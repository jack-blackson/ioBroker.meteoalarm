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
var AdapterStarted;

let adapter;
let request;
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
    var callback
    requestXML('http://meteoalarm.eu/documents/rss/at/AT002.rss', callback)
    adapter.log.info('Ergebnis: ' + callback  )

    adapter.config.interval = 600000;
    adapter.subscribeStates('*')
}

function requestXML(url,callback){
    request = request || require('request');

    adapter.log.debug('Request URL: ' + url);
    request(url, (error, response, body) => callback(!body ? error || JSON.stringify(response) : null, body, url));
}