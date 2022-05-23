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
var parseString = require('xml2js').parseString;
var parseStringPromise = require('xml2js').parseStringPromise;
const stateAttr = require('./lib/stateAttr.js'); // State attribute definitions

const i18nHelper = require(`${__dirname}/lib/i18nHelper`);
const bent = require("bent");

const parseCSV = require('csv-parse');
const fs = require("fs");
const path = require('path');

var DescFilter1 = '';
var DescFilter2 = '';
var country = '';
var countryConfig = '';
var regionConfig = '';
var countEntries = 0;
var typeArray = [];
var urlArray = [];

var regionCSV = ""
var regionName = ""
var xmlLanguage = ""
const warnMessages = {};

var channelNames = []
var csvContent = [];
var urlAtom = ""

let adapter;
let lang;

var htmlCode = ""

var today = new Date();
var maxAlarmLevel = 1

var imageSizeSetup = 0



//var Interval

function startAdapter(options) {

    options = options || {};
    Object.assign(options, {
        name: 'meteoalarm',
        useFormatDate: true,
        ready: function() {
            main()
        }
    });

    adapter = new utils.Adapter(options);

    adapter.on(`unload`, callback => {
        //clearInterval(Interval);
        callback && callback();
    });

    

    return adapter;

}


function main() {

    adapter.getForeignObject('system.config', (err, systemConfig) => {
        if (!systemConfig.common.language){
            lang = 'en'
        }
        else{
            lang = systemConfig.common.language
        }
        adapter.log.debug('Language: ' + lang)
        getData()
        

    }) 
}

async function getData(){
        
        // request setup
        countryConfig = adapter.config.country
        regionConfig = adapter.config.region
        regionName = adapter.config.regionName
        imageSizeSetup = Number(adapter.config.imageSize)
        

        if (regionConfig  == "0"|| !regionConfig){
            adapter.log.error('Please select a valid region in setup!')
            let htmlCode = '<table style="border-collapse: collapse; width: 100%;" border="1"><tbody><tr>'
            htmlCode += '<td style="width: 100%; background-color: #fc3d03;">Please maintain country and region in setup!</td></tr></tbody></table>'
            await Promise.all([
                adapter.setStateAsync({device: '' , channel: '',state: 'level'}, {val: '4', ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'htmlToday'}, {val: htmlCode, ack: true})
            ])
            adapter.terminate ? adapter.terminate(0) : process.exit(0);
        }
        else{
            adapter.log.debug('Setup found: country ' + countryConfig + ' and region ' + regionConfig + ' - ' +  regionName )

            urlAtom = getCountryLink(countryConfig)
            xmlLanguage = getXMLLanguage(countryConfig)
            if (xmlLanguage == ""){
                xmlLanguage = 'en-GB'
            }
            adapter.log.debug(' XML Language: ' + xmlLanguage)

            // Delete old alarms
            adapter.log.debug('0: Delete Alarms')

            const deleted =  await deleteAllAlarms();

            const checkState = await adapter.getStateAsync('weatherMapCountry')
            if (checkState != null ){

                adapter.log.debug('0.1: Cleaning up old objects');
                const cleaned = await cleanupOld()
            }
            
            const csv = await getCSVData()
                
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

                            for (var j = 0, l = info.length; j < l; j++){ 
                                var element = info[j]
                                if (element.language == xmlLanguage){
                                    element.parameter.forEach(function (parameter){
                                        if (parameter.valueName == "awareness_type") {
                                            awarenesstype =parameter.value
                                            var n = awarenesstype.indexOf(";");
                                            awarenesstype = awarenesstype.substring(0, n)
                                            typeRelevant = checkTypeRelevant(awarenesstype)
                                            adapter.log.debug('Alarm ' + countURL + ' with type ' + awarenesstype + ' relevant: ' + typeRelevant)
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
                
                        const created = await createAlarms(countEntries)
                        adapter.log.debug('8: Alarm States created for Alarm ' + countURL + ' type:  ' + awarenesstype)
                
                        const promises = await processDetails(jsonResult,countEntries)
                        adapter.log.debug('9: Processed Details for Alarm ' + countURL)

                }
                            
            
            }
            //const widget = await createHTMLWidget()
            adapter.log.debug('10: Creating HTML Widget')
            htmlCode = ''
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
                        adapter.log.debug('10.1: Added Alarm for ' + headline.val)
                        htmlCode += '<h4 style = "margin-top: 5px;margin-bottom: 1px;">' + headline.val + ': '
                    }
                    if (effectiveDate && effectiveDate.val && expiresDate && expiresDate.val){
                        htmlCode += getAlarmTime(effectiveDate.val, expiresDate.val) + '</h4>'
                    }
                    if (description && description.val){
                        htmlCode += description.val 
                    }

    
                    htmlCode += '</td></tr>'
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

            
            await Promise.all([
                adapter.setStateAsync({device: '' , channel: '',state: 'level'}, {val: maxAlarmLevel, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'htmlToday'}, {val: htmlCode, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'location'}, {val: regionName, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'link'}, {val: urlAtom, ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'color'}, {val: getColor(maxAlarmLevel.toString()), ack: true}),
                adapter.setStateAsync({device: '' , channel: '',state: 'noOfAlarms'}, {val: countEntries, ack: true})
            ])
            adapter.log.debug('11: Set State for Widget')

            adapter.log.debug('12: All Done')
            if (regionName){
                adapter.log.info('Updated Weather Alarms for ' + regionName + ' -> ' + warningCount + ' warning(s) found')
            }
            
            adapter.terminate ? adapter.terminate(0) : process.exit(0);


        }

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
        if (element['cap:geocode'].valueName ){
             locationRelevant = checkLocation(element['cap:geocode'].valueName , element['cap:geocode'].value)
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

            adapter.log.debug('4.1: Warning found: ' + detailsLink + ' of message type ' + messagetype)

      

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


function checkLocation(type,value){
    //check which type it is and if it is relevant for us
    if (type == "EMMA_ID"){
        return value == regionConfig
    }
    else{
        var successful = false
        for(var i = 0; i < csvContent.length; i += 1) {
            if((csvContent[i][0] == regionConfig) && (csvContent[i][2] == type) ) {
                if (value == csvContent[i][1] ){
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

async function getCSVData(){
    return new Promise(function(resolve,reject){
        fs.createReadStream(path.resolve(__dirname, 'geocodes-aliases.csv'))
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

async function processDetails(content, countInt){
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
    if (level == ""){
        level = "0";
    }

    await localCreateState(path + '.event', 'event', content.event);
    await localCreateState(path + '.headline', 'headline', content.headline);
    await localCreateState(path + '.description', 'description', content.description);
    await localCreateState(path + '.link', 'link', content.web);
    await localCreateState(path + '.expires', 'expires', content.expires);
    await localCreateState(path + '.effective', 'effective', content.onset);
    await localCreateState(path + '.sender', 'sender', content.senderName);
    await localCreateState(path + '.level', 'level', Number(level));
    await localCreateState(path + '.levelText', 'levelText', getLevelName(level));
    await localCreateState(path + '.type', 'type', Number(type));
    await localCreateState(path + '.typeText', 'typeText', getTypeName(type));
    await localCreateState(path + '.icon', 'icon', Warnung_img);
    await localCreateState(path + '.color', 'color', getColor(level));
   

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
    adapter.log.debug(`Create_state called for : ${state} with value : ${value}`);

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

async function deleteAllAlarms(){
    const promises = await Promise.all([
        adapter.deleteDeviceAsync('alarms')
    ])
}



async function createAlarms(AlarmNumber){
    var path = 'alarms.' + 'Alarm_' + AlarmNumber
    channelNames.push('Alarm_' + AlarmNumber)
    const promises = await Promise.all([

        adapter.setObjectNotExistsAsync('alarms', {
            common: {
                name: 'Alarm'
            },
            type: 'device',
            'native' : {}
        }),

        adapter.setObjectNotExistsAsync(path, {
            common: {
                name: 'Alarm_' + AlarmNumber
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

function checkTypeRelevant(warntype){

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
            return 'ne-NL'
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