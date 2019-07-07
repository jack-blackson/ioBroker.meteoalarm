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
    var callback
    requestXML('http://meteoalarm.eu/documents/rss/at/AT002.rss')

    adapter.config.interval = 600000;
    adapter.subscribeStates('*')
}

function requestXML(url){
    request.post({
        url:     url
      }, function(error, response, body){
        if (body) {
            adapter.log.info('Antwort: ' + response + ',' + body + ',' + error); // Hello, world!

        }
      });    
}