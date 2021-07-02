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
var parseString = require('xml2js').parseString;
var parseStringPromise = require('xml2js').parseStringPromise;

const i18nHelper = require(`${__dirname}/lib/i18nHelper`);
const bent = require("bent");

const parseCSV = require('csv-parse');
const fs = require("fs");

var DescFilter1 = '';
var DescFilter2 = '';
var country = '';
var countryConfig = '';
var regionConfig = '';
var countEntries = 0;
var typeArray = [];
var detailsURL = []
var regionCSV = ""

/*
var event = ""
var description = ""
var icon = ""
var color = ""
var effectiveDate = new Date();
var expiresDate = new Date();
var effectiveString = "";
var expiresString = "";
*/

var channelNames = []
var csvContent = [];


let adapter;
let lang;

var htmlCode = ""


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

        if (regionConfig  == "0"|| !regionConfig){
            adapter.log.error('Please select a valid region in setup!')
            adapter.terminate ? adapter.terminate(0) : process.exit(0);
        }
        else{
            adapter.log.debug('Setup found: country ' + countryConfig + ' and region ' + regionConfig)

            var urlAtom = getCountryLink(countryConfig)
            var xmlLanguage = getXMLLanguage(countryConfig)
            if (xmlLanguage == ""){
                xmlLanguage = 'en-GB'
            }
            adapter.log.debug(' XML Language: ' + xmlLanguage)

            // Delete old alarms
            adapter.log.debug('0: Delete Alarms')

            const deleted =  deleteAllAlarms();

            const csv = await getCSVData()
                
            adapter.log.debug('1: Parsed CSV File')

            for(var i = 0; i < csvContent.length; i += 1) {
                if(csvContent[i][0] == regionConfig) {
                    regionCSV =  csvContent[i][1];
                }
            }
            adapter.log.debug('1.1 Region Converted: ' + regionCSV)
            
            //adapter.log.debug('First Line: ' + csvContent[1][0])


            adapter.log.debug('2: Request Atom from ' + urlAtom )

            const getJSON = bent('string')
            let xmlAtom = await getJSON(urlAtom)
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
                
                    var i = 0
                    var now = new Date();
                    result.feed.entry.forEach(function (element){
                        var expiresDate = new Date(element['cap:expires']);

                        if ((element['cap:geocode'].value == regionCSV) && (expiresDate >= now)){
                            var detailsLink = element.link[0].$.href
                            adapter.log.debug('4.1: Warning found: ' + detailsLink)
                            detailsURL.push(detailsLink)
                
                            i += 1;
                        }
                    });
                }
            });
            
            // continue now to request details
            var countEntries = 0

            adapter.log.debug('5: Processed Atom')
            var countTotalURLs = detailsURL.length
            adapter.log.debug('5.1 Found ' + countTotalURLs + ' URLs')
            var countURL = 0
            for (const URL of detailsURL){ 
                countURL += 1
                //console.log(element) 
                var jsonResult;
                var type = ""
                adapter.log.debug('6: Request Details from URL ' + countURL + ': ' + URL)

                const getJSON1 = bent('string')
                let xmlDetails = await getJSON(URL)
                adapter.log.debug('7: Received Details for URL ' + countURL)

                parseString(xmlDetails, {
                    explicitArray: false
                }, 
        
                function (err, result) {
                    if (err) {
                        adapter.log.error("Fehler: " + err);
                        adapter.terminate ? adapter.terminate(0) : process.exit(0);
                    } else {
                        result.alert.info.forEach(function (element){
                            adapter.log.debug('Sprache gefundeN: ' + element.language)
                            if (element.language == xmlLanguage){
                                element.parameter.forEach(function (parameter){
                                    if (parameter.valueName == "awareness_type") {
                                        type =parameter.value
                                    }  
                                })
                                jsonResult = element 

                            }
                        })



                        /*
                        result.alert.info[0].parameter.forEach(function (element){
                            if (element.valueName == "awareness_type") {
                                type =element.value
                            }  
                        })
                        */

                    }
                });

                if (jsonResult){
                    //adapter.log.debug(' Type of URL ' + countURL + ' :' + type);
                    if (typeArray.indexOf(type) > -1) {
                        adapter.log.debug('8: Alarm States ignored for Alarm ' + countURL)
                        adapter.log.debug('9: Processed Details for Alarm ' + countURL)


                    } else {
                        //Type not yet in the array
                        countEntries += 1
                
                        typeArray.push(type)
                        const created = await createAlarms(countEntries)
                        adapter.log.debug('8: Alarm States created for Alarm ' + countURL + ' type:  ' + type)
                
                        const promises = await processDetails(jsonResult,countEntries)
                        adapter.log.debug('9: Processed Details for Alarm ' + countURL)
                    }

                }
                            
            
            }
            //const widget = await createHTMLWidget()
            adapter.log.debug('10: Creating HTML Widget')


            if (channelNames.length >= 1){
                htmlCode += '<table style="border-collapse: collapse; width: 100%;" border="1"><tbody>'
                for (const channelLoop of channelNames) {

                    var path = 'alarms.' + channelLoop
                    var colorHTML = ''
                    let event = await adapter.getStateAsync(path + '.event')
                    let description = await adapter.getStateAsync(path + '.description');
                    let icon = await adapter.getStateAsync(path + '.icon');
                    let color = await adapter.getStateAsync(path + '.color');
                    let effectiveDate = await adapter.getStateAsync(path + '.effective');
                    let expiresDate = await adapter.getStateAsync(path + '.expires');
                    
                    if (!adapter.config.noBackgroundColor){
                        colorHTML = 'background-color: ' + color.val
                    }
                     
                    if (!adapter.config.noIcons){
                        htmlCode += '<tr><td style="width: 5%; border-style: none; ' + colorHTML +  '">'
                        htmlCode += '<img style="display:block; padding-top: 10px; padding-bottom: 15px;padding-right: 10px; padding left: 10px;"'
                        htmlCode +=  'width="50%" height="50%" src="' +  icon.val + '"/>'
                        htmlCode += '</td>'
                    }


                    htmlCode += '<td style="width: 95%; border-style: none; ' + colorHTML +  '">'
                    htmlCode += '<h3 style = "margin-top: 5px;margin-bottom: 1px;">' + event.val + ': '
                    htmlCode += getDateFormated(effectiveDate.val) + ' - ' + getDateFormated(expiresDate.val) + '</h3>'
                    htmlCode += description.val 

    
                    htmlCode += '</td></tr>'
                }
            }
            if (htmlCode){
                htmlCode += '</tbody></table>'
            } 
            //adapter.log.debug('widget: ' + htmlCode)

            adapter.log.debug('11: Set State for Widget')

            await Promise.all([
                adapter.setStateAsync({device: '' , channel: '',state: 'htmlToday'}, {val: htmlCode, ack: true})
            ])

            adapter.log.debug('12: All Done')
            
            adapter.terminate ? adapter.terminate(0) : process.exit(0);


        }

}

function getDateFormated(dateTimeString)
{
   return new Date(dateTimeString).toLocaleDateString(undefined, { weekday: "long" , hour: "numeric", minute: "2-digit"})
      
}

async function getCSVData(){
    return new Promise(function(resolve,reject){
        fs.createReadStream('geocodes-aliases.csv', 'utf8')
        .pipe(parseCSV({delimiter: ','}))
        .on('headers', (headers) => {
            adapter.log.debug(`First header: ${headers[0]}`)
        })
        .on('data', function(csvrow) {
            //console.log(csvrow);
            //do something with csvrow
            csvContent.push(csvrow);        
        })
        .on('end',function() {
        //do something with csvData
        adapter.log.debug(csvContent);
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

    var path = 'alarms.' + 'Alarm ' + countInt
    const promises = await Promise.all([

        adapter.setStateAsync({ state: path + '.event'}, {val:  content.event, ack: true}),
        adapter.setStateAsync({ state: path + '.description'}, {val: content.description, ack: true}),
        adapter.setStateAsync({ state: path + '.link'}, {val: content.web, ack: true}),
        adapter.setStateAsync({ state: path + '.expires'}, {val: content.expires, ack: true}),
        adapter.setStateAsync({ state: path + '.effective'}, {val: content.effective, ack: true}),
        adapter.setStateAsync({ state: path + '.sender'}, {val: content.senderName, ack: true}),
        adapter.setStateAsync({ state: path + '.level'}, {val: level, ack: true}),
        adapter.setStateAsync({ state: path + '.levelText'}, {val: getLevelName(level), ack: true}),
        adapter.setStateAsync({ state: path + '.type'}, {val: type, ack: true}),
        adapter.setStateAsync({ state: path + '.typeText'}, {val: getTypeName(type), ack: true}),
        adapter.setStateAsync({ state: path + '.icon'}, {val: Warnung_img, ack: true}),
        adapter.setStateAsync({ state: path + '.color'}, {val: getColor(level), ack: true})
    ])
    //adapter.log.debug('7: After Set Alarm')

}

async function deleteAllAlarms(){
    const promises = await Promise.all([
        adapter.deleteDeviceAsync('alarms')
    ])
}

async function createAlarms(AlarmNumber){
    var path = 'alarms.' + 'Alarm ' + AlarmNumber
    channelNames.push('Alarm ' + AlarmNumber)
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
                name: 'Alarm ' + AlarmNumber
            },
            type: 'channel',
            'native' : {}
        }),

        adapter.setObjectNotExistsAsync(path + '.event', {
            common: {
                name: 'Event',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.color', {
            common: {
                name: 'Alarm color',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.icon', {
            common: {
                name: 'Alarm icon',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.level', {
            common: {
                name: 'Alarm level',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.levelText', {
            common: {
                name: 'Alarm level text',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.type', {
            common: {
                name: 'Alarm icon',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.typeText', {
            common: {
                name: 'Alarm type text',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.description', {
            common: {
                name: 'Description',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.sender', {
            common: {
                name: 'Sender of the Alarm',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.effective', {
            common: {
                name: 'Date Alarm gets effective',
                type: 'string',
				role: 'value.datetime',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.expires', {
            common: {
                name: 'Date Alarm expires',
                type: 'string',
				//role: 'value.datetime',
                role: 'value',
				read: true,
				write: true
            },
            type: 'state',
            'native' : {}
        }),
        adapter.setObjectNotExistsAsync(path + '.link', {
            common: {
                name: 'Link',
                type: 'string',
				role: 'value',
				read: true,
				write: true
            },
            type: 'state',
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
                return '#ffffff';
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
            return '';
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
            return ''
            break;
        case 'DK':
            return ''
            break;
        case 'EE':
            return ''
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
            return ''
            break;
        case 'IE':
            return ''
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
            return ''
            break;
        case 'ME':
            return ''
            break;
        case 'MD':
            return 'ro'
            break;
        case 'MT':
            return ''
            break;
        case 'NL':
            return ''
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