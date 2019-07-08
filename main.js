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
const xml2js = require('xml2js');


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

    adapter.config.interval = 600000;
    adapter.subscribeStates('*')
}

function requestXML(url){
    request.post({
        url:     url
      }, function(error, response, body){
        if (error){
            adapter.log.error(error)
        }
        if (body) {
            var json = xml2js.xml2json(body, {compact: false, spaces: 4});
            adapter.log.info(json);
            processXML(body)
        }
        
      });    
}

function processXML(content){
        
        adapter.log.info(content.title)
}