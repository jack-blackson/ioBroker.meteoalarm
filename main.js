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
//const request = require('request');
const moment = require('moment');
const util = require('util')
const turf = require('@turf/turf')
var parseString = require('xml2js').parseString;
var parseStringPromise = require('xml2js').parseStringPromise;
const stateAttr = require('./lib/stateAttr.js'); // State attribute definitions

const i18nHelper = require(`${__dirname}/lib/i18nHelper`);
const bent = require("bent");

const parseCSV = require('csv-parse');
const geoCodeJSON = require('./admin/geocodes.json')
const fs = require("fs");
const path = require('path');
const { hasUncaughtExceptionCaptureCallback, features } = require('process');
const { count } = require('console');
const { level } = require('./lib/stateAttr.js');
const { addAbortSignal } = require('stream');

var DescFilter1 = '';
var DescFilter2 = '';
var country = '';
var countryConfig = '';
var geocodeLocationConfig = []
//var regionConfig = '';
var latConfig = '';
var longConfig = '';
var countEntries = 0;
var typeArray = [];
var urlArray = [];

var regionCSV = ""
//var regionName = ""
var xmlLanguage = ""
const warnMessages = {};

var tempFirst = true

var channelNames = []
var csvContent = [];
var alarmAll = []
var alarmOldIdentifier = []
var alarmOldArray = []
var urlAtom = ""
var locationArray = new Array()

let adapter;
let lang;

var noOfAlarmsAtEnd= 0
var noOfAlarmsAtStart = 0

var htmlCode = ""

var today = new Date();
var maxAlarmLevel = 1

var notificationAlarmArray = []

var imageSizeSetup = 0

var updateError = false

var initialDataLoaded = false
//var geoCodeLoaded = false

let Sentry;
let SentryIntegrations;
function initSentry(callback) {
    if (!adapter.ioPack.common || !adapter.ioPack.common.plugins || !adapter.ioPack.common.plugins.sentry) {
        return callback && callback();
    }
    const sentryConfig = adapter.ioPack.common.plugins.sentry;
    if (!sentryConfig.dsn) {
        adapter.log.warn('Invalid Sentry definition, no dsn provided. Disable error reporting');
        return callback && callback();
    }
    // Require needed tooling
    Sentry = require('@sentry/node');
    SentryIntegrations = require('@sentry/integrations');
    // By installing source map support, we get the original source
    // locations in error messages
    require('source-map-support').install();

    let sentryPathWhitelist = [];
    if (sentryConfig.pathWhitelist && Array.isArray(sentryConfig.pathWhitelist)) {
        sentryPathWhitelist = sentryConfig.pathWhitelist;
    }
    if (adapter.pack.name && !sentryPathWhitelist.includes(adapter.pack.name)) {
        sentryPathWhitelist.push(adapter.pack.name);
    }
    let sentryErrorBlacklist = [];
    if (sentryConfig.errorBlacklist && Array.isArray(sentryConfig.errorBlacklist)) {
        sentryErrorBlacklist = sentryConfig.errorBlacklist;
    }
    if (!sentryErrorBlacklist.includes('SyntaxError')) {
        sentryErrorBlacklist.push('SyntaxError');
    }

    Sentry.init({
        release: adapter.pack.name + '@' + adapter.pack.version,
        dsn: sentryConfig.dsn,
        integrations: [
            new SentryIntegrations.Dedupe()
        ]
    });
    Sentry.configureScope(scope => {
        scope.setTag('version', adapter.common.installedVersion || adapter.common.version);
        if (adapter.common.installedFrom) {
            scope.setTag('installedFrom', adapter.common.installedFrom);
        }
        else {
            scope.setTag('installedFrom', adapter.common.installedVersion || adapter.common.version);
        }
        scope.addEventProcessor(function(event, hint) {
            // Try to filter out some events
            if (event.exception && event.exception.values && event.exception.values[0]) {
                const eventData = event.exception.values[0];
                // if error type is one from blacklist we ignore this error
                if (eventData.type && sentryErrorBlacklist.includes(eventData.type)) {
                    return null;
                }
                if (eventData.stacktrace && eventData.stacktrace.frames && Array.isArray(eventData.stacktrace.frames) && eventData.stacktrace.frames.length) {
                    // if last exception frame is from an nodejs internal method we ignore this error
                    if (eventData.stacktrace.frames[eventData.stacktrace.frames.length - 1].filename && (eventData.stacktrace.frames[eventData.stacktrace.frames.length - 1].filename.startsWith('internal/') || eventData.stacktrace.frames[eventData.stacktrace.frames.length - 1].filename.startsWith('Module.'))) {
                        return null;
                    }
                    // Check if any entry is whitelisted from pathWhitelist
                    const whitelisted = eventData.stacktrace.frames.find(frame => {
                        if (frame.function && frame.function.startsWith('Module.')) {
                            return false;
                        }
                        if (frame.filename && frame.filename.startsWith('internal/')) {
                            return false;
                        }
                        if (frame.filename && !sentryPathWhitelist.find(path => path && path.length && frame.filename.includes(path))) {
                            return false;
                        }
                        return true;
                    });
                    if (!whitelisted) {
                        return null;
                    }
                }
            }

            return event;
        });

        adapter.getForeignObject('system.config', (err, obj) => {
            if (obj && obj.common && obj.common.diag !== 'none') {
                adapter.getForeignObject('system.meta.uuid', (err, obj) => {
                    // create uuid
                    if (!err  && obj) {
                        Sentry.configureScope(scope => {
                            scope.setUser({
                                id: obj.native.uuid
                            });
                        });
                    }
                    callback && callback();
                });
            }
            else {
                callback && callback();
            }
        });
    });
}

//var Interval

function startAdapter(options) {

    options = options || {};
    Object.assign(options, {
        name: 'meteoalarm',
        useFormatDate: true,
        ready: function() {
            //main()
        }
    });

    adapter = new utils.Adapter(options);

    adapter.on(`unload`, callback => {
        //clearInterval(Interval);
        callback && callback();
    });

    
    adapter.on('ready', function() {
        if (adapter.supportsFeature && adapter.supportsFeature('PLUGINS')) {
            const sentryInstance = adapter.getPluginInstance('sentry');
            if (sentryInstance) {
                Sentry = sentryInstance.getSentryObject();
            }
            main();
        }
        else {
            initSentry(main);
        }
    });

    return adapter;

}


function main() {
        getData()
}

function initialSetup(){
            // run once when adapter starts

            adapter.getForeignObject('system.config', (err, systemConfig) => {
                if (!systemConfig.common.language){
                    lang = 'en'
                }
                else{
                    lang = systemConfig.common.language
                }
            }) 

            latConfig = adapter.config.lat
            longConfig = adapter.config.long
            locationArray = adapter.config.geocode

            countryConfig = adapter.config.country
            geocodeLocationConfig = adapter.config.geocodeLocation
            imageSizeSetup = Number(adapter.config.imageSize)

            adapter.log.debug('0.0 Initial setup loaded')
}

async function getData(){
        
 
        alarmAll = []

        if (!initialDataLoaded){
            initialSetup()
            initialDataLoaded = true
        }

        if (countryConfig  == ""|| !countryConfig || latConfig == "" || !latConfig ||longConfig == ""|| !longConfig || !locationArray){
            adapter.log.error('0.1 Please maintain country, geocode and location in setup!')
            let htmlCode = '<table style="border-collapse: collapse; width: 100%;" border="1"><tbody><tr>'
            htmlCode += '<td style="width: 100%; background-color: #fc3d03;">Please maintain country and location in setup!</td></tr></tbody></table>'
            await Promise.all([
                adapter.setStateAsync({device: '' , channel: '',state: 'level'}, {val: 0, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'htmlToday'}, {val: htmlCode, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'noOfAlarms'}, {val: 0, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'JSON'}, {val: '', ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'location'}, {val: 'Check Setup!', ack: true})
            ])
            adapter.terminate ? adapter.terminate(0) : process.exit(0);
        }
        else{
            adapter.log.debug('0.1 Setup found: country ' + countryConfig + ' with geocode(s) ' + locationArray + ' for location ' + geocodeLocationConfig+ ' and Lat ' + latConfig + ' Long ' +  longConfig )
            if (Sentry){
                adapter.log.debug('Sentry aktiv - Breadcrumb gesetzt')
                Sentry.addBreadcrumb({
                    category: "info",
                    message: 'Country ' + countryConfig + ', Location '+ latConfig + ' - ' +  longConfig,
                    level: "info",
                  });
            }
            /*
            if (!geoCodeLoaded){
                findGeoCode()
                geoCodeLoaded = true
                adapter.log.debug('0.2: Geocode loaded. Result: ' + locationArray)
            }
            */
            
            urlAtom = getCountryLink(countryConfig)
            xmlLanguage = getXMLLanguage(countryConfig)
            if (xmlLanguage == ""){
                xmlLanguage = 'en-GB'
            }
            adapter.log.debug('0.3 XML Language: ' + xmlLanguage)

            const checkState = await adapter.getStateAsync('weatherMapCountry')
            if (checkState != null ){

                adapter.log.debug('0.3: Cleaning up old objects');
                const cleaned = await cleanupOld()
            }
            
            const csv = await getCSVData()

            const temp = await adapter.getStateAsync('noOfAlarms')
            if (temp){
                noOfAlarmsAtStart = temp.val
            }
            adapter.log.debug('0.4: Existing alarm objects at adapter start: ' + noOfAlarmsAtStart)
            
            const temp2 = await saveAlarmNamesForLater()
            for (const alarmLoop of alarmOldIdentifier) {
                //HIER SIND WIR
                //adapter.log.debug('TEMP: ' + alarmLoop)
                const temp1 = await saveAlarmsForLater(alarmLoop)
            };



            adapter.log.debug('1: Parsed CSV File')
            
            adapter.log.debug('2: Request Atom from ' + urlAtom )

            const getJSON = bent('string')
            let xmlAtom
            try {
                xmlAtom = await getJSON(urlAtom)
            } catch (err){
                adapter.log.warn('2.1: Atom URL ' + urlAtom + ' not available - error ' + err) 
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            if (xmlAtom){
                adapter.log.debug('3: Received Atom')

                parseString(xmlAtom, {
                    //mergeAttrs: true
                    explicitArray: false

                }, 

                function (err, result) {
                    if (err) {
                        adapter.log.error("Fehler: " + err);
                        adapter.terminate ? adapter.terminate(0) : process.exit(0);
                    } else {
                        adapter.log.debug('4: Process Atom')
                        var newdate = moment(new Date()).local().format('DD.MM.YYYY HH:mm')
                        adapter.setState({device: '' , channel: '',state: 'lastUpdate'}, {val: newdate, ack: true});
                        //adapter.log.debug('4.1 Content: ' + util.inspect(result.feed.entry, {showHidden: false, depth: null, colors: true}))
                        if (result.feed.entry){
                            if (result.feed.entry[0]){
                                adapter.log.debug('4.1.1: Check Entries')
                                checkRelevante(result.feed.entry)
                            }
                            else {
                                // try to fix the damaged xml
                                adapter.log.debug('4.2.1 tried to fix xml')
                                let newObject = [result.feed.entry]
                                if (newObject[0]){
                                    adapter.log.debug('4.2.2 new object after fixing: ' + util.inspect(newObject, {showHidden: false, depth: null, colors: true}))
                                    checkRelevante(newObject)
                                }
                            }
                        }
                    }
                });
            }
            
            // continue now to request details
            var countEntries = 0
            //adapter.log.debug('Object Result: ' + util.inspect(urlArray, {showHidden: false, depth: null}))

            urlArray.sort(function(a, b) {
                var keyA = new Date(a.effective),
                  keyB = new Date(b.effective);
                // Compare the 2 dates
                if (keyA < keyB) return -1;
                if (keyA > keyB) return 1;
                return 0;
              });
              

            //adapter.log.debug('Object Sorted Result: ' + util.inspect(urlArray, {showHidden: false, depth: null}))


            adapter.log.debug('5: Processed Atom')
            var countTotalURLs = urlArray.length
            adapter.log.debug('5.1 Found ' + countTotalURLs + ' URLs')
            var countURL = 0
            var detailsType = ""
            var detailsIdentifier = ""
            var detailsReference = ""
            var detailssent = ""
            for (var i = 0, l = urlArray.length; i < l; i++){ 
                countURL += 1
                var jsonResult;
                var awarenesstype = ""
                adapter.log.debug('6: Request Details from URL ' + countURL + ': ' + urlArray[i].url)

                const getJSON1 = bent('string')
                let xmlDetails

                try {
                    xmlDetails = await getJSON1(urlArray[i].url)

                } catch (err){
                    adapter.log.debug('6.1: Details URL ' + urlArray[i].url + ' not valid any more - error ' + err) 
                    updateError = true
                }
               var typeRelevant = false
                if (xmlDetails ){
                    // Just go here if Request for Details is successful
                    adapter.log.debug('7: Received Details for URL ' + countURL)

                    parseString(xmlDetails, {
                        explicitArray: false
                    }, 
            
                    function (err, result) {
                        if (err) {
                            adapter.log.error("Fehler: " + err);
                            adapter.terminate ? adapter.terminate(0) : process.exit(0);
                        } else {
                            var info = []
                            if (result.alert.info[0]){
                                info = result.alert.info
                            }
                            else {
                                info = [result.alert.info]
                            }

                            detailsType= result.alert.msgType
                            detailsIdentifier = result.alert.identifier
                            detailsIdentifier = detailsIdentifier.replace(/\./g,'') // remove dots
                            detailssent = result.alert.sent
                            if (detailsType != "Alert" && result.alert.references != ""){
                                detailsReference = result.alert.references
                                var searchTerm = ","

                                const indexOfFirstComma = detailsReference.indexOf(searchTerm);
                                const indexOfSecondComma = detailsReference.indexOf(searchTerm, indexOfFirstComma +1);
                                detailsReference = detailsReference.substring(indexOfFirstComma +1,indexOfSecondComma)
                                detailsReference = detailsReference.replace(/\./g,'') // remove dots

                            }

                            for (var j = 0, l = info.length; j < l; j++){ 
                                var element = info[j]

                                if (element.language == xmlLanguage){
                                    element.parameter.forEach(function (parameter){
                                        if (parameter.valueName == "awareness_type") {
                                            awarenesstype =parameter.value
                                            var n = awarenesstype.indexOf(";");
                                            awarenesstype = awarenesstype.substring(0, n)
                                            typeRelevant = checkTypeRelevant(awarenesstype,"general")
                                            //adapter.log.debug('Alarm ' + countURL + ' with type ' + awarenesstype + ' relevant: ' + typeRelevant)
                                        }  
                                    })
                                    jsonResult = element 
    
                                }
                            }
    
                        }
                    });

                }

                if (jsonResult && typeRelevant){
                        countEntries += 1
                
                        const promises = await processDetails(jsonResult,countEntries,detailsType,detailsIdentifier,detailsReference,detailssent)
                        adapter.log.debug('8: Processed Details for Alarm ' + countURL)

                }
                            
            
            }
            //const widget = await createHTMLWidget()

            adapter.log.debug('9: Checking for duplicate alarms')
            adapter.log.debug('9.0.1 alarmAll Array before removing duplicates: ' + JSON.stringify(alarmAll))

            checkDuplicates()


            

            //const created = await createAlarms(countEntries)
            //            adapter.log.debug('8: Alarm States created for Alarm ' + countURL + ' type:  ' + awarenesstype)
            notificationAlarmArray = []
            adapter.log.debug('10: Create alarm states')
            for (var j = 0, l = alarmAll.length; j < l; j++){ 
                //adapter.log.debug('10.TEMP: level= ' + alarmAll[j].Level)
                if (checkRelevanceAlarmLevel(String(alarmAll[j].Level),"general","")){
                    const promises = await fillAlarm(alarmAll, j)
                }
            }
            adapter.log.debug('10.2: Created alarm states')


            adapter.log.debug('11: Cleaning up obsolete alarms')
            if (!updateError){
                const clean = await cleanObsoleteAlarms(alarmAll)
                adapter.log.debug('11.1: Cleaned up obsolete alarms')

            }


            adapter.log.debug('12: Creating HTML Widget')
            htmlCode = ''
            var JSONAll = []
            var warningCount = 0
            if (channelNames.length >= 1){
                htmlCode += '<table style="border-collapse: collapse; width: 100%;"><tbody>'
                for (const channelLoop of channelNames) {

                    warningCount += 1
                    var path = 'alarms.' + channelLoop
                    var colorHTML = ''
                    let event = await adapter.getStateAsync(path + '.event')
                    let headline = await adapter.getStateAsync(path + '.headline')

                    let description = await adapter.getStateAsync(path + '.description');
                    let icon = await adapter.getStateAsync(path + '.icon');
                    let color = await adapter.getStateAsync(path + '.color');
                    let effectiveDate = await adapter.getStateAsync(path + '.effective');
                    let expiresDate = await adapter.getStateAsync(path + '.expires');    
                    let level = await adapter.getStateAsync(path + '.level');
                    let alarmType = await adapter.getStateAsync(path + '.typeText');


                    if (color && color.val){
                        if (!adapter.config.noBackgroundColor){
                            colorHTML = 'background-color: ' + color.val
                        }
                    }
                    

                    if (level && level.val){
                        if (level.val > maxAlarmLevel){
                            maxAlarmLevel = Number(level.val)
                        }
                    }
                     
                    if (!adapter.config.noIcons){
                        // Dummy cell to move picture away from the left side
                        htmlCode += '<tr><td style="width: 1%; border-style: none; ' + colorHTML +  '"></td>'
                        htmlCode += '<td style="width: 9%; border-style: none; ' + colorHTML +  '">'
                        htmlCode += '<img style="display:block;"'
                        var imageSize = ''
                        if (icon && icon.val){
                            switch (imageSizeSetup) {
                                case 0:
                                    imageSize = ' width="20" height="20"';
                                    break;
                                case 1:
                                    imageSize = ' width="35" height="35"';
                                    break;
                                case 2:
                                    imageSize = ' width="50" height="50"';
                                    break;
                                default:
                                    imageSize = ' width="35" height="35"';
                                    break;
                             } 
                             //adapter.log.debug('Image Size: ' + imageSizeSetup + ' -> Result: ' + imageSize)

                            htmlCode += imageSize

                            htmlCode +=  ' alt="Warningimmage" src="' +  icon.val + '"/>'
                        }
                        htmlCode += '</td>'
                    }

                    htmlCode += '<td style="width: 90%; border-style: none; ' + colorHTML +  '">'
                    if (headline && headline.val){
                        adapter.log.debug('12.1: Added Alarm to widget for ' + headline.val)
                        htmlCode += '<h4 style = "margin-top: 5px;margin-bottom: 1px;">' + headline.val + ': '
                    }
                    if (effectiveDate && effectiveDate.val && expiresDate && expiresDate.val){
                        htmlCode += getAlarmTime(effectiveDate.val, expiresDate.val) + '</h4>'
                    }
                    if (description && description.val){
                        htmlCode += description.val 
                    }

    
                    htmlCode += '</td></tr>'
                    if (effectiveDate && effectiveDate.val && expiresDate && expiresDate.val){
                        JSONAll.push(
                            {
                                Event: event.val,
                                Description: description.val,
                                Level: level.val,
                                Effective: getAlarmTime(effectiveDate.val, expiresDate.val),
                                Icon: icon.val,
                                AlarmType: alarmType.val
                            }
                        );
                    }

                    
                }    
            }
            else{
                // No Alarm Found
                htmlCode += '<table style="border-collapse: collapse; width: 100%;"><tbody>'
                htmlCode += '<tr><td style= "border-style: none; '
                if (!adapter.config.noBackgroundColor){
                    htmlCode += 'background-color: ' + getColor('1')
                }
                htmlCode +=  '">' + getLevelName('1') 
                htmlCode += '</td></tr>'
                maxAlarmLevel = 1
            }


            if (htmlCode){
                htmlCode += '</tbody></table>'
            } 

            // Check if no alarms are found, then add "no alarm found"
            if (JSONAll.length == 0){
                JSONAll.push(
                    {
                        Event: "",
                        Description: getLevelName('1'),
                        Level: "1",
                        Effective: "",
                        Icon: ""
                    }
                );
            }

            noOfAlarmsAtEnd = warningCount
            await Promise.all([
                adapter.setStateAsync({device: '' , channel: '',state: 'level'}, {val: maxAlarmLevel, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'htmlToday'}, {val: htmlCode, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'location'}, {val: geocodeLocationConfig, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'link'}, {val: urlAtom, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'color'}, {val: getColor(maxAlarmLevel.toString()), ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'noOfAlarms'}, {val: warningCount, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'JSON'}, {val: JSON.stringify(JSONAll), ack: true})
            ])
            adapter.log.debug('13: Set State for Widget')

            adapter.log.debug('14: Processing notifications')
            // Important, also go in there if no notifications are valid, because it could be that we need to trigger the "All warnings done" message
            const promises = await processNotifications(alarmAll)


            adapter.log.debug('15: All Done')
            if (geocodeLocationConfig){
                adapter.log.info('15.1: Updated Weather Alarms for ' + geocodeLocationConfig + ' -> ' + warningCount + ' alarm(s) found')
            }
            
            adapter.terminate ? adapter.terminate('All data processed. Adapter stopped until next scheduled process.') : process.exit(0);


        }

}

function checkDuplicates(){
    var alarmAllChecked = []

    // 1. check for duplicate entries of type Alarm with the same Type, Level, Onset and Expires Date -> saved in Alarm_Key
    for(var i = 0; i < alarmAll.length; i += 1) {
        if (alarmAll[i].Alarm_Type == "Alert")
        {
            let check = alarmAllChecked.some(function(item) {
                return item.Alarm_Key === alarmAll[i].Alarm_Key})
            if (!check){
                alarmAllChecked.push(alarmAll[i])
            }
        }
        else{
            alarmAllChecked.push(alarmAll[i])
        }
        
    }

    //2.  Check for Alarmupdates, duplicate updates and cancles

    alarmAll = alarmAllChecked
    adapter.log.debug('9.1 Finished checking alerts - ' + alarmAll.length + ' relevant alarm(s)')
    //adapter.log.debug('9.3 alarmAll Array after removing duplicates: ' + JSON.stringify(alarmAll))
    //adapter.log.debug('9.3.1 alarmAll sorted by sent1 date:' + JSON.stringify(alarmAll.sort((a, b) => a.Alarm_Sent - b.Alarm_Sent)))
}


function createPolyDataString(PolyDataToConvert){
    var result = []
    var first = true
    var i = 0
    var lat = ''
    var long = ''
    do {
        var loc = PolyDataToConvert.indexOf(' ')
        var countComma = (PolyDataToConvert.match(/,/g) || []).length;
        var lengthpolyDataToConvert = PolyDataToConvert.length
        var tempString = PolyDataToConvert.substring(0, loc)
        var locComma = tempString.indexOf(',')
        //adapter.log.debug('data: ' +i + ' ' + PolyDataToConvert)
        //adapter.log.debug('Count Comma ' + countComma)

        if (countComma >1){
            // still multiple objects

            

            PolyDataToConvert = PolyDataToConvert.substring(loc+1,lengthpolyDataToConvert)

            
            long = tempString.substring(locComma+1,tempString.length)
            lat = tempString.substring(0,locComma)
            //adapter.log.debug(' push: ' + lat + ' ' + long)
            i ++
            result.push([long, lat ])
        }
        else{
            //last object
            /*
            var locComma = PolyDataToConvert.indexOf(',')

            //adapter.log.debug('loc comma' + locComma)
            var locComma = tempString.indexOf(',')

            var longLast = PolyDataToConvert.substring(locComma+1,PolyDataToConvert.length)
            var latLast = PolyDataToConvert.substring(0,locComma)
            if (longLast != long && latLast != lat){
                result.push([long, lat ])

            }
            */
            //adapter.log.debug('last push: ' + lat + ' ' + long)
            PolyDataToConvert = ''

        }
        
        lengthpolyDataToConvert = PolyDataToConvert.length
      } while (lengthpolyDataToConvert > 1);
      
    return result
}



function checkIfInPoly(polyData){

    var polyArray = createPolyDataString(polyData)
    adapter.log.debug(polyArray)


    var myLoc = {
        "type": "Feature",
        "geometry": {
          "type": "Point",
          "coordinates": 
            [longConfig, latConfig]
        }
    };
            
    let i = 0;
    let pathArray = [];
    
    while (i < polyArray.length) {
        var lat = polyArray[i][0]
        var long = polyArray[i][1]

        pathArray.push([lat, long])

        i++;
    }
     
    var poly = {        
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": 
                  [pathArray]
        }
    }
      
    //adapter.log.debug('myloc: ' + JSON.stringify(myLoc))
      //adapter.log.debug('array: ' + polyArray)

    //adapter.log.debug('poly: ' + JSON.stringify(poly))
    //adapter.log.debug('type: ' + typeof polyArray)


 
            
    var isInside = turf.booleanPointInPolygon(myLoc, poly);

      //adapter.log.debug('type config: ' + typeof longConfig + ' type poly: ' + typeof polyData)

    adapter.log.debug('Is inside:' + isInside)

   

    return isInside


}

function checkRelevante(entry){
    var i = 0
    var now = new Date();
    entry.forEach(function (element){
        var expiresDate = new Date(element['cap:expires']);
        var effectiveDate = new Date(element['cap:onset']);
        var messagetype = ""
        var messagetypeRelevant = false
        if (element['cap:message_type']){
            messagetype = element['cap:message_type']
        }
        // Ignore Cancles
        if (messagetype == "Alert"){
            // show Alert only if no Update and no cancle found
            messagetypeRelevant = true
        }
        if (messagetype == "Update"){
            // Show all updates
            messagetypeRelevant = true
        }

        var locationRelevant = false
        
        if (element['cap:geocode'] && element['cap:geocode'].valueName ){
             locationRelevant = checkLocation(element['cap:geocode'].valueName , element['cap:geocode'].value)
        }
        if (element['cap:polygon'])  {
            // found polygon
            let polygon = element['cap:polygon']

            var areaDesc = ''
            if (element['cap:areaDesc'])  {
                areaDesc = element['cap:areaDesc']
            }

            //TEMP!!!!!
            if (areaDesc == "Verzasca"){
                locationRelevant = checkIfInPoly(polygon)

            }



            

            if (locationRelevant){
                adapter.log.debug('Found relevant polygon warning for location ' + areaDesc)
            }
            
        }

        var statusRelevant = false
        if (element['cap:status'] == 'Actual'){
            statusRelevant = true
        }



        var given = moment(effectiveDate);
        var current = moment().startOf('day');
        var daysDifference = moment.duration(given.diff(current)).asDays()
        var dateRelevant = false
        if ((expiresDate >= now)&&(daysDifference < 2)){
            dateRelevant = true
        }

        var eventType = element['cap:event']
        
        if (locationRelevant){
            //adapter.log.debug('4.1.2: Check Result: dateRelevant = ' + dateRelevant + "statusrelevant= " + statusRelevant + " messagetyperelevant = " + messagetypeRelevant )
        }

        if (locationRelevant && (dateRelevant) && statusRelevant && messagetypeRelevant){
            for(var i = 0; i < element.link.length; i += 1) {

                //adapter.log.debug('4.1.1: Link ' + i + ': ' + element.link[i].$.href)
                if (element.link[i].$.type){
                    //adapter.log.debug('4.1.1: Typ ' + i + ': ' + element.link[i].$.type)
                    if (element.link[i].$.type == 'application/cap+xml'){
                        var detailsLink = element.link[i].$.href
                    }
                }

            }

            adapter.log.debug('4.2: Warning found: ' + detailsLink + ' of message type ' + messagetype)

      

            let obj = {
                "id": i,
                "event": eventType,
                "url": detailsLink,
                "effective": effectiveDate,
                "expires": expiresDate
               }
            urlArray.push(obj)

            i += 1;
        }
    });
    adapter.log.debug('4.2: Checked relevance, found ' + urlArray.length + ' relevant alarms')


}


function checkLocation(type,locationValue){
    //check which type it is and if it is relevant for us

    if (type == "EMMA_ID"){
        return locationArray.includes(locationValue)
    }
    else{
        var successful = false
        for(var i = 0; i < csvContent.length; i += 1) {
            if((locationArray.includes(csvContent[i][0])) && (csvContent[i][2] == type) ) {

                if (locationValue == csvContent[i][1] ){
                    successful = true
                }
            }
        }
        return successful

    }

}

function getAlarmTime(onset,expires){
    var expiresDate = new Date(expires)
    var onsetDate = new Date(onset)
    var dateString = ''
    var expiresToday = today.toDateString() == expiresDate.toDateString()
    var onsetToday = today.toDateString() == onsetDate.toDateString()
    var expiresDay = moment(expires).locale(lang).format("ddd")
    var onsetDay = moment(onset).locale(lang).format("ddd")

    //if (expiresToday && onsetToday){
    if (expiresDate.toDateString() == onsetDate.toDateString()){

        if (adapter.config.dayInWords) {
            dateString = dateDifferenceInWord(onsetDate,today) + ' ' + getDateFormatedShort(onset) + ' - ' + getDateFormatedShort(expires)
        }
        else{
            dateString = onsetDay + ' '  + getDateFormatedShort(onset) + ' - ' + getDateFormatedShort(expires)
        }
    }
    else{
        //adapter.log.debug('Days difference onset: ' + dateDifferenceInWord(onsetDate,today) + ' : ' + onsetDate)
        //adapter.log.debug('Days difference expires: ' + dateDifferenceInWord(expiresDate,today)+ ' : ' + expiresDate)

        if (adapter.config.dayInWords) {
            dateString = dateDifferenceInWord(onsetDate,today) + ' ' + getDateFormatedShort(onset) + ' - ' + dateDifferenceInWord(expiresDate,today) + ' ' + getDateFormatedShort(expires)
        }
        else{
            dateString = onsetDay + ' ' + getDateFormatedShort(onset) + ' - ' + expiresDay + ' ' + getDateFormatedShort(expires)
        }
    }

    return dateString
}

function getDateFormatedShort(dateTimeString)
{
   return new Date(dateTimeString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

}

function dateDifferenceInWord(inputDate,comparison){
    // Take the difference between the dates and divide by milliseconds per day.
    // Round to nearest whole number to deal with DST.
    //var difference = Math.round((comparison-inputDate)/(1000*60*60*24))
    var difference = 0

    //adapter.log.debug('Days difference: ' + inputDate + ' - ' + difference) 

     
    var date1_tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    var date1_today = new Date(today.getFullYear(), today.getMonth(), today.getDate() );
    var date1_yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    //adapter.log.debug('Date tomorrow ' + date1_tomorrow)
    //adapter.log.debug('Date today ' + date1_today)
    //adapter.log.debug('Date yesterday ' + date1_yesterday)


    if (date1_tomorrow.getFullYear() == inputDate.getFullYear() && date1_tomorrow.getMonth() == inputDate.getMonth() && date1_tomorrow.getDate() == inputDate.getDate()) {
        //date is tomorrow
        difference = 1
    }
    if (date1_today.getFullYear() == inputDate.getFullYear() && date1_today.getMonth() == inputDate.getMonth() && date1_today.getDate() == inputDate.getDate()) {
        //date is today
        difference = 2
    }
    if (date1_yesterday.getFullYear() == inputDate.getFullYear() && date1_yesterday.getMonth() == inputDate.getMonth() && date1_yesterday.getDate() == inputDate.getDate()) {
        //date is yesterday
        difference = 3
    }

    switch (difference) {
        case 2:
            return i18nHelper.today[lang]
            break;
        case 3:
            return i18nHelper.yesterday[lang]
            break;
        case 1:
            return i18nHelper.tomorrow[lang]
            break;
       default:
           return moment(inputDate).locale(lang).format("ddd") // Hier wird was falsches zurückgegeben!!
           break;
    }

    return Math.round((comparison-inputDate)/(1000*60*60*24));

}

async function cleanupOld(){
    const promises = await Promise.all([

        adapter.deleteChannelAsync('today'),
        adapter.deleteChannelAsync('tomorrow'),
        adapter.deleteStateAsync('weatherMapCountry')

    ])
}


async function saveAlarmNamesForLater(){
    return new Promise(function(resolve){

        adapter.getChannelsOf('alarms', function (err, result) {
            for (const channel of result) {
                alarmOldIdentifier.push(channel.common.name
            );
            
            }
            resolve('done')
        })
    })

}

async function saveAlarmsForLater(alarmName){
    let path = 'alarms.' + alarmName

    var effective = await adapter.getStateAsync(path + '.effective')
    if (effective == null){
        effective = ""
    }
    var referenz = await adapter.getStateAsync(path + '.updateIdentifier')
    if (referenz == null){
        referenz = ""
    }
    var sent = await adapter.getStateAsync(path + '.sent')
    if (sent == null){
        sent = ""
    }
    var expires = await adapter.getStateAsync(path + '.expires')
    if (expires == null){
        expires = ""
    }
    var tempLevel = await adapter.getStateAsync(path + '.level')
    if (tempLevel == null){
        tempLevel = ""
    }
    var type = await adapter.getStateAsync(path + '.type')
    if (type == null){
        type = ""
    }
    alarmOldArray.push(
        {
            Alarm_Identifier: alarmName,
            Alarm_Reference: referenz.val,
            Alarm_Sent: sent.val,
            Expires: expires.val,
            Effective: effective.val,
            Level: Number(tempLevel.val),
            Type: Number(type.val)
        }
    );
}

async function cleanObsoleteAlarms(allAlarms){
    //const promises = await Promise.all([
        
    return new Promise(async function(resolve){

            const done = await adapter.getChannelsOfAsync('alarms', async function (err, result) {
                for (const channel of result) {
                    // check if the alarm is included in the new alarms, either as identifier or reference for the updates
                    let check = allAlarms.some(function(item) {
                        return item.Alarm_Identifier === channel.common.name})
                    let check1 = allAlarms.some(function(item) {
                        //adapter.log.debug('TEst1 ' + item.Alarm_Reference)
                        //adapter.log.debug('TEst2 ' + channel.common.name)


                        return item.Alarm_Reference === channel.common.name})    
                    if (!check){
                    //adapter.log.debug('11.0.1: ' + channel.common.name + ' Check = ' + check + ' , check1 = ' +  check1)
                    //if (!check && !check1){

                       adapter.log.debug('11.0.2: Alarm ' + channel.common.name + ' will be deleted.')
                        const obj = await adapter.deleteChannelAsync('alarms',channel.common.name);                        
                        adapter.log.debug('11.0.3: After delete alarm ' + channel.common.name)
                    }
                
                }
                resolve('done')

            })

    })
    
}

/*
async function getJSONData(){
    fetch('./geocodes.json')
    .then((response) => response.json())
    .then((json) => adapter.log.debug(json));

}
*/



async function getCSVData(){
    return new Promise(function(resolve,reject){
        fs.createReadStream(path.resolve(__dirname + '/meteoalarm', 'geocodes-aliases.csv'))
        .pipe(parseCSV({delimiter: ','}))
        .on('data', function(csvrow) {
            //console.log(csvrow);
            //do something with csvrow
            csvContent.push(csvrow);        
        })
        .on('end',function() {
        //do something with csvData
        //adapter.log.debug(csvContent);
        resolve(csvContent);
        })
        .on('error', reject); 
    })
}


async function processNotifications(alarms){
    return new Promise(function(resolve,){
        if (notificationAlarmArray.length >= 1){
            adapter.log.debug('14.1: Notifications available for alarms: ' + util.inspect(notificationAlarmArray, {showHidden: false, depth: null, colors: true}))
        }
        adapter.log.debug('14.1.0 Details: noofAlarmsAtStart: ' + noOfAlarmsAtStart + ', noofAlarmsatEnd: ' + noOfAlarmsAtEnd + ' , noWarningsSetupActive: ' + adapter.config.noWarningsNotification)


        for(var i = 0; i < notificationAlarmArray.length; i += 1) {
            alarms.map(function (alarms) {
                if (alarms.Alarm_Identifier == notificationAlarmArray[i]) {
                    var tempDate = ""
                    if (alarms.Effective && alarms.Expires){
                        tempDate = getAlarmTime(alarms.Effective, alarms.Expires)
                    }
                    var region = ""
                    if (adapter.config.showLocation){
                        region = ' - ' + geocodeLocationConfig
                    }

                    var notificationLevel = getNotificationLevel(alarms.Level)
                    var notificationText = prepareNotificationText(alarms.Headline,alarms.Description,tempDate,region,notificationLevel,alarms.Alarm_Identifier)
                    adapter.log.debug('14.1.1 Type relevant: ' +checkTypeRelevant(String(alarms.Type),"notification") )
                    if ((checkRelevanceAlarmLevel(alarms.Level,"notification",alarms.Alarm_Identifier ))&&  (checkTypeRelevant(String(alarms.Type),"notification"))){
                        adapter.setStateAsync({device: '' , channel: '',state: 'notification'}, {val: notificationText, ack: true})
                        sendNotification(alarms.Headline,alarms.Description,tempDate,region,notificationLevel,alarms.Alarm_Identifier,alarms.Alarm_Type)  
                    }

                }
            })  
        }

        if ((noOfAlarmsAtStart >= 1)  &&(noOfAlarmsAtEnd == 0) && (adapter.config.noWarningsNotification)){
            // all Alarms Ended notification should be sent
            adapter.log.debug('14.1.1: Warning for "All warnings ended" sent')
            var region = ""
            if (adapter.config.showLocation){
                region = ' - ' + geocodeLocationConfig
            }
            var notificationLevel = getNotificationLevel(1)
            var notificationText = notificationLevel  + region + ': ' + i18nHelper.warningsLifted[lang]
            sendMessage('',notificationText,'')
            adapter.setStateAsync({device: '' , channel: '',state: 'notification'}, {val: notificationText, ack: true})
        }


        resolve('done')
    })
}



function prepareNotificationText(headline,description,date,region,level,identifier){
    var notificationText = ""

    notificationText += level + headline + region + ' (' + date + ') ' + description

    return notificationText
}

function sendNotification(headline,description,date,region,levelText,identifier,type){
    var notificationText = ""
    var descriptionText = ""
    var typeText = ""
    if (type == 'Update'){
        typeText = i18nHelper.update[lang] + ': '
    }
    if (!adapter.config.noDetails ){
        descriptionText = description
    }


    switch (adapter.config.notificationsType){
        case 'None':
            // Do nothing
            break;
        case 'Telegram':
            if (adapter.config.notificationsType){
                notificationText = '<b>' + typeText + headline + region + '</b>' + '\r\n' + levelText + '\r\n' + descriptionText + '\r\n' + date
            }
            else{
                notificationText = levelText + '<b>' + typeText +  headline + region + '</b>' + '\r\n' + ' (' + date + ') ' + '\r\n' + descriptionText
            }
            break;
        case 'Mail':
            notificationText =  levelText + typeText + headline + region + ' (' + date + ') ';
            descriptionText = description
            break;
        case 'Pushover':
            notificationText = levelText + typeText + headline + region + ' (' + date + ') ' + descriptionText
            break;
        case 'Signal':
            notificationText = levelText+ typeText+ headline + region + ' (' + date + ') ' + descriptionText
            break;
        case 'SynoChat':
            notificationText = levelText+ typeText+ headline + region + ' (' + date + ') ' + descriptionText
            break;
        default:
            //Do nothing
        break;
    }

    sendMessage(identifier,notificationText,descriptionText)
}

function checkRelevanceAlarmLevel(alarmlevel,type,identifier){
    var typeRelevant = false
    var alarmlevelInt = parseInt(alarmlevel)

    if (type == "notification"){
        //adapter.log.debug('14.1.2.1: Settings relevance notification: ' + adapter.config.warningLevelSetupNotification)

        switch (adapter.config.warningLevelSetupNotification){
            case '0':
                typeRelevant = true
                break;
            case '1':
                if (alarmlevelInt >= 3){
                    typeRelevant = true
                }
                break;
            case '2':
                if (alarmlevelInt == 4){
                    typeRelevant = true
                }
                break;
            default:
                //Do nothing
                adapter.log.debug('14.1.1: Type not found -> no check for relevance possible')
            break;
        }
        adapter.log.debug('10.1.2: Alarm ' + identifier + ' with level ' + alarmlevel + ' relevant for ' + type +': ' + typeRelevant + ' (setting: ' + adapter.config.warningLevelSetupNotification + ')')

    }
    if (type == "general"){
        //adapter.log.debug('14.1.2.1: Settings relevance general: ' + adapter.config.warningLevelSetupGeneral)
        switch (adapter.config.warningLevelSetupGeneral){
            case '0':
                typeRelevant = true
                break;
            case '1':
                if (alarmlevelInt >= 3){
                    typeRelevant = true
                }
                break;
            case '2':
                if (alarmlevelInt == 4){
                    typeRelevant = true
                }
                break;
            default:
                //Do nothing
                adapter.log.debug('10.1.1: Type not found -> no check for relevance possible')
            break;
        }
        adapter.log.debug('10.1.2: Alarm ' + identifier + ' with level ' + alarmlevel + ' relevant for ' + type +': ' + typeRelevant + ' (setting: ' + adapter.config.warningLevelSetupGeneral)

    }
    return typeRelevant
}

function getNotificationLevel(level){
    var notificationText = ""
    if(adapter.config.levelType == "Rufezeichen"){
        switch (level) {
            case 1:
                notificationText += ''
                break;
            case 2:
                notificationText += '❗'
                break;
            case 3:
                notificationText += '❗❗'
                break;
            case 4:
                notificationText += '❗❗❗'
                break;
           default:
            notificationText +=  ''
               break;
        }
    } else if (adapter.config.levelType == "Kreise"){
        switch (level) {
            case 1:
                notificationText += '🟢 '
                break;
            case 2:
                notificationText += '🟡 '
                break;
            case 3:
                notificationText += '🟠 '
                break;
            case 4:
                notificationText += '🔴 '
                break;
           default:
            notificationText +=  ''
               break;
        }
    }
    

    if (adapter.config.notificationsType){
        notificationText +=  i18nHelper.warninglevel[lang] + ' ' + level + '/4' + ' '
    }

    return notificationText

}

function sendMessage(identifier,content,subject){
    var sentMessage = false
    var instanceMissing = false
    switch (adapter.config.notificationsType){
        case 'None':
            // Do nothing
            break;
        case 'Telegram':
            if (adapter.config.telegramInstanz){
                adapter.sendTo(adapter.config.telegramInstanz, "send", {
                    "text": content,
                    "parse_mode": "HTML"
                });
                sentMessage = true
            }
            else{
                instanceMissing = true
            }
            break;
        case 'Mail':
            if (adapter.config.mailInstanz){
                if (adapter.config.mailAddress != ""){
                    adapter.sendTo(adapter.config.mailInstanz, {
                        to:      adapter.config.mailAddress, // comma separated multiple recipients.
                        subject: content,
                        text:    subject
                    });
                    sentMessage = true
                }
                else{
                    adapter.log.warn('14.3: Please maintain an email address for the warning notification, or deactivate mail.')
                }
            }
            else{
                instanceMissing = true
            }    
            break;
        case 'Pushover':
            if (adapter.config.pushInstanz){
                adapter.sendTo(adapter.config.pushInstanz, content);
                sentMessage = true
            }
            else{
                instanceMissing = true
            }   
            break;
        case 'SynoChat':
            if (adapter.config.synoInstanz){
                var state = adapter.config.synoInstanz + '.' +  adapter.config.SynoChannel + '.message'
                adapter.setForeignStateAsync(state, content);
                sentMessage = true
            }
            else{
                instanceMissing = true
            }   
            break;
        case 'Signal':
            if (adapter.config.signalInstanz){
                adapter.sendTo(adapter.config.signalInstanz, "send", {
                    "text": content,
                });
                sentMessage = true
            }
            else{
                instanceMissing = true
            }
            break;
        default:
            //Do nothing
        break;
    }
    if (sentMessage){
        if (identifier != "")
        {
            adapter.log.debug('14.3: Sent ' + adapter.config.notificationsType + ' message for alarm '+ identifier)
        }
        else{
            adapter.log.debug('14.3: Sent ' + adapter.config.notificationsType + ' message')
        }

    }
    if (instanceMissing){
        adapter.log.warn('14.3: No instance in setup maintained for ' + adapter.config.notificationsType + '!') 
    }
}

async function processDetails(content, countInt,detailsType,detailsIdentifier,detailsReference,detailssent,detailsLink){
    var type = ""
    var level = ""
    content.parameter.forEach(function (element){
        if (element.valueName == "awareness_type") {
            type =element.value
            var n = type.indexOf(";");
            type = type.substring(0, n)
        }  
        if (element.valueName == "awareness_level") {
            level =element.value
            var n = level.indexOf(";");
            level = level.substring(0, n)
        }  
    })
 

    var Warnung_img = ''
    if (level != "1"){
        if (adapter.config.whiteIcons){
            Warnung_img += '/meteoalarm.admin/icons/white/'
        }
        else{
            Warnung_img += '/meteoalarm.admin/icons/black/'
        }
        Warnung_img += 't' + type + '.png'
    }

    var path = 'alarms.' + 'Alarm_' + countInt

    //adapter.log.debug('TEMP!! + ' + JSON.stringify(content.area))
    let areaData = content.area
    //adapter.log.debug(' is areaData an array: ' + Array.isArray(areaData))
    if (!Array.isArray(areaData)){
        areaData = [areaData]
    }

    for(let i = 0; i < areaData.length; i++) {
        let geoCodesArray = areaData[i].geocode
        if (!Array.isArray(geoCodesArray)){
            geoCodesArray = [geoCodesArray]
        }
        //adapter.log.debug('geocodes.array length ' + geoCodesArray.length)

        //adapter.log.debug('Location : ' + areaData[i].areaDesc)

    }
    //adapter.log.debug('Location : ' + regionName)

    

    alarmAll.push(
        {
            Alarm_Type: detailsType,
            Alarm_Identifier: detailsIdentifier,
            Alarm_Reference: detailsReference,
            Alarm_Key: detailsType + '-' + Number(level) + '-' + content.onset + '-' + content.expires,
            Alarm_Sent: detailssent,
            Event: content.event,
            Headline: content.headline,
            Description: content.description,
            Link: content.web,
            Expires: content.expires,
            Effective: content.onset,
            Sender: content.senderName,
            Level: Number(level),
            Leveltext: getLevelName(level),
            Type: Number(type),
            Typetext: getTypeName(type),
            Icon: Warnung_img,
            Color: getColor(level)
        }
    );

}

async function fillAlarm(content, countInt){
    var path = ""
    path = 'alarms.' + content[countInt].Alarm_Identifier
    const created = await createAlarms(content[countInt].Alarm_Identifier,content[countInt].Alarm_Identifier)
    if (content[countInt].Alarm_Type == "Alert"){
        await localCreateState(path + '.updateIdentifier', 'updateIdentifier', '');
    }
    else if (content[countInt].Alarm_Type == "Update"){
        //path = 'alarms.' + content[countInt].Alarm_Reference
        //const created = await createAlarms(content[countInt].Alarm_Reference,content[countInt].Alarm_Identifier)
        await localCreateState(path + '.updateIdentifier', 'updateIdentifier', content[countInt].Alarm_Reference);
    }

    await localCreateState(path + '.event', 'event', content[countInt].Event);
    await localCreateState(path + '.headline', 'headline', content[countInt].Headline);
    await localCreateState(path + '.description', 'description', content[countInt].Description);
    await localCreateState(path + '.link', 'link', content[countInt].Link);
    await localCreateState(path + '.expires', 'expires', content[countInt].Expires);
    await localCreateState(path + '.effective', 'effective', content[countInt].Effective);
    await localCreateState(path + '.sender', 'sender', content[countInt].Sender);
    await localCreateState(path + '.level', 'level', content[countInt].Level);
    await localCreateState(path + '.levelText', 'levelText', content[countInt].Leveltext);
    await localCreateState(path + '.type', 'type', content[countInt].Type);
    await localCreateState(path + '.typeText', 'typeText', content[countInt].Typetext);
    await localCreateState(path + '.icon', 'icon', content[countInt].Icon);
    await localCreateState(path + '.color', 'color', content[countInt].Color);
    await localCreateState(path + '.sent', 'sent', content[countInt].Alarm_Sent);

}

function errorHandling(codePart, error, suppressFrontendLog) {
    if (!suppressFrontendLog) {
        adapter.log.error(`[${codePart}] error: ${error.message}, stack: ${error.stack}`);
    }
    if (adapter.supportsFeature && adapter.supportsFeature('PLUGINS')) {
        const sentryInstance = adapter.getPluginInstance('sentry');
        if (sentryInstance) {
            sentryInstance.getSentryObject().captureException(error);
        }
    }
}


async function localCreateState(state, name, value) {
    //adapter.log.debug(`Create_state called for : ${state} with value : ${value}`);

    try {
        // Try to get details from state lib, if not use defaults. throw warning if states is not known in attribute list
        if (stateAttr[name] === undefined) {
            const warnMessage = `State attribute definition missing for ${name}`;
            if (warnMessages[name] !== warnMessage) {
                warnMessages[name] = warnMessage;
                adapter.log.warn(`State attribute definition missing for ${name}`);
            }
        }
        const writable = stateAttr[name] !== undefined ? stateAttr[name].write || false : false;
        const state_name = stateAttr[name] !== undefined ? stateAttr[name].name || name : name;
        const role = stateAttr[name] !== undefined ? stateAttr[name].role || 'state' : 'state';
        const type = stateAttr[name] !== undefined ? stateAttr[name].type || 'mixed' : 'mixed';
        const unit = stateAttr[name] !== undefined ? stateAttr[name].unit || '' : '';
        //adapter.log.debug(`Write value : ${writable}`);

        await adapter.setObjectNotExistsAsync(state, {
            type: 'state',
            common: {
                name: state_name,
                role: role,
                type: type,
                unit: unit,
                read: true,
                write: writable
            },
            native: {},
        });

        // Ensure name changes are propagated
        await adapter.extendObjectAsync(state, {
            type: 'state',
            common: {
                name: state_name,
                type: type, // Also update types t solve log error's and  attribute changes
            },
        });

        // Only set value if input != null
        if (value !== null) {
            await adapter.setState(state, {val: value, ack: true});
        }

        // Subscribe on state changes if writable
        // writable && this.subscribeStates(state);
    } catch (error) {
        errorHandling('localCreateState', error);
    }
}


function fillNotificatinAlarmArray(identifier){
    adapter.log.debug('10.1: Added Alert Notification for '+ identifier)
    notificationAlarmArray.push(identifier)
}

async function createAlarms(AlarmIdentifier,notificationReference){
    var path = 'alarms.' + AlarmIdentifier
    // avoid duplicate entries in widget - sometimes the same alarm is sent twice from weather agencies
    if (!channelNames.includes(AlarmIdentifier)){
        channelNames.push(AlarmIdentifier)
    }
    const obj = await adapter.getObjectAsync('alarms.' + AlarmIdentifier);

    if(!obj) {
        fillNotificatinAlarmArray(notificationReference) 
        
    };

    const promises = await Promise.all([


        adapter.setObjectNotExistsAsync('alarms', {
            common: {
                name: 'Alarms'
            },
            type: 'device',
            'native' : {}
        }),

        adapter.setObjectNotExistsAsync(path, {
            common: {
                name: AlarmIdentifier
            },
            type: 'channel',
            'native' : {}
        })
    ])
}

function getTypeName(type){

    switch (type) {
        case '1':
            return i18nHelper.typeDesc1[lang]
            break;
        case '2':
            return i18nHelper.typeDesc2[lang]
            break;
        case '3':
            return i18nHelper.typeDesc3[lang]
            break;
        case '4':
            return i18nHelper.typeDesc4[lang]
            break;
        case '5':
            return i18nHelper.typeDesc5[lang]
            break;
        case '6':
            return i18nHelper.typeDesc6[lang]
            break;
        case '7':
            return i18nHelper.typeDesc7[lang]
            break;
        case '8':
            return i18nHelper.typeDesc8[lang]
            break;
        case '9':
            return i18nHelper.typeDesc9[lang]
            break;
        case '10':
            return i18nHelper.typeDesc10[lang]
            break;
        case '11':
            return 'Unknown'
            break;
        case '12':
            return i18nHelper.typeDesc12[lang]
            break;
        case '13':
            return i18nHelper.typeDesc13[lang]
            break;
        case '0':
            return ''
            break;
       default:
           return 'undefined'
           break;
    }

}

function checkTypeRelevant(warntype,checkType){
    if (checkType == "general"){
        switch (warntype) {
            case '1':
                return adapter.config.warningType1
                break;
            case '2':
                return adapter.config.warningType2
                break;
            case '3':
                return adapter.config.warningType3
                break;
            case '4':
                return adapter.config.warningType4
                break;
            case '5':
                return adapter.config.warningType5
                break;
            case '6':
                return adapter.config.warningType6
                break;
            case '7':
                return adapter.config.warningType7
                break;
            case '8':
                return adapter.config.warningType8
                break;
            case '9':
                return adapter.config.warningType9
                break;
            case '10':
                return adapter.config.warningType10
                break;
            case '11':
                return 'Unknown'
                break;
            case '12':
                return adapter.config.warningType12
                break;
            case '13':
                return adapter.config.warningType13
                break;
            case '0':
                return ''
                break;
           default:
               adapter.log.warn('No configuration found for type ' + warntype)
               return true
               break;
        }
    }
    if (checkType == "notification"){
        switch (warntype) {
            case '1':
                return adapter.config.warningType1Notification
                break;
            case '2':
                return adapter.config.warningType2Notification
                break;
            case '3':
                return adapter.config.warningType3Notification
                break;
            case '4':
                return adapter.config.warningType4Notification
                break;
            case '5':
                return adapter.config.warningType5Notification
                break;
            case '6':
                return adapter.config.warningType6Notification
                break;
            case '7':
                return adapter.config.warningType7Notification
                break;
            case '8':
                return adapter.config.warningType8Notification
                break;
            case '9':
                return adapter.config.warningType9Notification
                break;
            case '10':
                return adapter.config.warningType10Notification
                break;
            case '11':
                return 'Unknown'
                break;
            case '12':
                return adapter.config.warningType12Notification
                break;
            case '13':
                return adapter.config.warningType13Notification
                break;
            case '0':
                return ''
                break;
           default:
               adapter.log.warn('No configuration found for notification alert type ' + warntype)
               return true
               break;
        }
    }

}

function getLevelName(level){

    switch (level) {
        case '1':
            return i18nHelper.levelDesc1[lang]
            break;
        case '2':
            return i18nHelper.levelDesc2[lang]
            break;
        case '3':
            return i18nHelper.levelDesc3[lang]
            break;
        case '4':
            return i18nHelper.levelDesc4[lang]
            break;
       default:
           return 'undefined'
           break;
    }

}

function getColor(level){
    var Color = ''
               
            switch (level) {
             case '1':
                // Grün
                return adapter.config.warningColorLevel1;
                break;
            case '2':
                // Gelb
                return adapter.config.warningColorLevel2;
                break;
            case '3':
                // Orange
                return adapter.config.warningColorLevel3;
                break;
            case '4':
                // Rot
                return adapter.config.warningColorLevel4;
                break;
            default:
                return '';
                break;
            }
}


function getCountryLink(country){
    var link = ''
    switch (country) {
        // Alpha-2 Codes https://de.wikipedia.org/wiki/ISO-3166-1-Kodierliste
        case 'AT':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-austria';
            break;
        case 'BE':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-belgium';
            break;
        case 'BA':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-bosnia-herzegovina';
            break;
        case 'BG':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-bulgaria';
            break;
        case 'HR':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-croatia'
            break;
        case 'CY':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-cyprus'
            break;
        case 'CZ':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-czechia'
            break;
        case 'DK':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-denmark'
            break;
        case 'EE':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-estonia'
            break;
        case 'FI':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-finland'
            break;
        case 'FR':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-france'
            break;
        case 'DE':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-germany'
            break;
         case 'GR':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-greece'
            break;
        case 'HU':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-hungary'
            break;
        case 'IS':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-iceland'
            break;
        case 'IE':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-ireland'
            break;
        case 'IL':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-israel'
            break;
        case 'IT':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-italy'
            break;
        case 'LV':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-latvia'
            break;
        case 'LT':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-lithuania'
            break;
        case 'LU':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-luxembourg'
            break;
        case 'MT':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-malta'
            break;
        case 'MD':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-moldova'
            break;
        case 'ME':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-montenegro'
            break;
        case 'NL':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands'
            break;
         case 'NO':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-norway'
            break;
         case 'PL':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-poland'
            break;
        case 'PT':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-portugal'
            break;
        case 'RO':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-romania'
            break;
        case 'RS':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-serbia'
            break;
        case 'SK':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-slovakia'
            break;
        case 'SI':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-slovenia'
            break;
        case 'ES':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-spain'
            break;
        case 'SE':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-sweden'
            break;
        case 'CH':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-switzerland'
            break;
         case 'UK':
            return 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-united-kingdom'
            break;                           
       default:
           return ''
           break;
    }
}

function multiSort(array, sortObject = {}) {
    const sortKeys = Object.keys(sortObject);

    // Return array if no sort object is supplied.
    if (!sortKeys.length) {
        return array;
    }

    // Change the values of the sortObject keys to -1, 0, or 1.
    for (let key in sortObject) {
        sortObject[key] = sortObject[key] === 'desc' || sortObject[key] === -1 ? -1 : (sortObject[key] === 'skip' || sortObject[key] === 0 ? 0 : 1);
    }

    const keySort = (a, b, direction) => {
        direction = direction !== null ? direction : 1;

        if (a === b) { // If the values are the same, do not switch positions.
            return 0;
        }

        // If b > a, multiply by -1 to get the reverse direction.
        return a > b ? direction : -1 * direction;
    };

    return array.sort((a, b) => {
        let sorted = 0;
        let index = 0;

        // Loop until sorted (-1 or 1) or until the sort keys have been processed.
        while (sorted === 0 && index < sortKeys.length) {
            const key = sortKeys[index];

            if (key) {
                const direction = sortObject[key];

                sorted = keySort(a[key], b[key], direction);
                index++;
            }
        }

        return sorted;
    });
}

function getXMLLanguage(country){
    var link = ''
    switch (country) {
        // Alpha-2 Codes https://de.wikipedia.org/wiki/ISO-3166-1-Kodierliste
        case 'AT':
            return 'de-DE';
            break;
        case 'BE':
            return 'nl-BE';
            break;
        case 'BA':
            return 'bs';
            break;
        case 'BG':
            return 'bg';
            break;
        case 'HR':
            return 'hr-HR'
            break;
        case 'CY':
            return 'el-GR'
            break;
        case 'CZ':
            return 'cs'
            break;
        case 'DK':
            return 'da-DK'
            break;
        case 'EE':
            return 'et-ET'
            break;
        case 'FI':
            return 'fi-FI'
            break;
        case 'FR':
            return 'fr-FR'
            break;
        case 'DE':
            return 'de-DE'
            break;
         case 'GR':
            return 'el-GR'
            break;
        case 'HU':
            return 'hu-HU'
            break;
        case 'IS':
            return 'is-IS'
            break;
        case 'IE':
            return 'en-GB'
            break;
        case 'IL':
            return 'he-IL'
            break;
        case 'IT':
            return 'it-IT'
            break;
        case 'LV':
            return 'lv'
            break;
        case 'LT':
            return 'lt'
            break;
        case 'LU':
            return 'de-DE'
            break;
        case 'ME':
            return ''
            break;
        case 'MD':
            return 'ro'
            break;
        case 'MT':
            return 'mt-MT'
            break;
        case 'NL':
            return 'nl-NL'
            break;
         case 'NO':
            return 'no'
            break;
         case 'PL':
            return 'po-PL'
            break;
        case 'PT':
            return 'pt-PT'
            break;
        case 'RO':
            return 'ro-RO'
            break;
        case 'RS':
            return 'sr'
            break;
        case 'SK':
            return 'sk'
            break;
        case 'SI':
            return 'sl'
            break;
        case 'ES':
            return 'es-ES'
            break;
        case 'SE':
            return 'sv-SE'
            break;
        case 'CH':
            return ''
            break;
         case 'UK':
            return 'en-GB'
            break;                           
       default:
           return 'en-GB'
           break;
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 