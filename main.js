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
const i18nHelper = require(`${__dirname}/lib/i18nHelper`);
const bent = require("bent");

var DescFilter1 = '';
var DescFilter2 = '';
var country = '';
var countryConfig = '';
var regionConfig = '';
var countEntries = 0;
var typeArray = [];
var detailsURL = []


let adapter;
let lang;

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

        getData()
        

    }) 
}

async function getData(){
    adapter.log.debug('1: Before Delete Alarms')
        const deleted =  deleteAllAlarms();

        adapter.log.debug('2: Before Request Atom')

        //await requestAtom()
        const getJSON = bent('json')
        let obj = await getJSON('http://https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-austria.com/json.api')


        /*
        parseString(obj, {
            //mergeAttrs: true
        }, 

        function (err, result) {

            if (err) {

                adapter.log.error("Fehler: " + err);
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            } else {
                adapter.log.debug('4: Process Atom')

                adapter.log.debug('Received Atom data for ' + JSON.stringify(content.feed.id))

                var newdate = moment(new Date()).local().format('DD.MM.YYYY HH:mm')
            
                adapter.setState({device: '' , channel: '',state: 'lastUpdate'}, {val: newdate, ack: true});
            
                var i = 0
                var now = new Date();
                result.feed.entry.forEach(function (element){
                    var expiresDate = new Date(element['cap:expires']);
                    if (element['cap:areaDesc'] == regionConfig && expiresDate >= now){
                        var detailsLink = element.link[0].$.href
                        //adapter.log.debug('4: Before Request Details')
                        detailsURL.push = detailsLink
                        //const done =  requestDetails(detailsLink)
                        //adapter.log.debug('9: After Request Details')
            
                        i += 1;
                    }
                });
                //adapter.log.debug('All entries processed')
                //adapter.log.debug('Entries found: ' + i)
                //return







                //await processAtom(result)
                //const done = processAtom(result)
                adapter.log.debug(' Links: ' + detailsURL)

                adapter.log.debug('5: Processed Atom')
                //return Promise.resolve();
            }
        });




        adapter.log.debug('11: After Request Atom')
        */
        adapter.terminate ? adapter.terminate(0) : process.exit(0);

}

async function requestAtom(){
    countryConfig = adapter.config.country
    regionConfig = adapter.config.region

    adapter.log.debug('Requesting atom data for country ' + countryConfig + ' and region ' + regionConfig)



    if (regionConfig  == "0"|| regionConfig  == ""){
        adapter.log.error('Please select a valid region in setup!')
        return
        //adapter.terminate ? adapter.terminate(0) : process.exit(0);
    }


    var urlAtom = getCountryLink(countryConfig)
    if (urlAtom){
        adapter.log.debug('Requesting data from ' + urlAtom)
        adapter.setState({ state: 'location'}, {val:  regionConfig, ack: true})

        request.get({
        url:     urlAtom,
        timeout: 8000
      }, function(error, response, body){
        if (error){
            if (error.code === 'ETIMEDOUT'){
                adapter.log.warn('Error ETIMEOUT: No website response after 8 seconds. Adapter will try again at next scheduled run.')
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            else if (error.code === 'ESOCKETTIMEDOUT'){
                adapter.log.warn('Error ESOCKETTIMEDOUT: No website response after 8 seconds. Adapter will try again at next scheduled run.')
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            else if (error.code === 'ENOTFOUND'){
                adapter.log.warn('Error ENOTFOUND: No website response after 8 seconds. Adapter will try again at next scheduled run.')
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            else(
                adapter.log.error(error)

            )
        }
        if (response.statusCode == 200){
            countEntries = 0;
            adapter.log.debug('Status Code Atom:' + response.statusCode)
            if (body) {
                var cleanedString = body.replace("\ufeff", "");
                parseString(cleanedString, {
                    //mergeAttrs: true
                }, 
    
                function (err, result) {
    
                    if (err) {
    
                        adapter.log.error("Fehler: " + err);
                        adapter.terminate ? adapter.terminate(0) : process.exit(0);
                    } else {
                        adapter.log.debug('4: Process Atom')

                        //adapter.log.debug('Received Atom data for ' + JSON.stringify(content.feed.id))

                        var newdate = moment(new Date()).local().format('DD.MM.YYYY HH:mm')
                    
                        adapter.setState({device: '' , channel: '',state: 'lastUpdate'}, {val: newdate, ack: true});
                    
                        var i = 0
                        var now = new Date();
                        result.feed.entry.forEach(function (element){
                            var expiresDate = new Date(element['cap:expires']);
                            if (element['cap:areaDesc'] == regionConfig && expiresDate >= now){
                                var detailsLink = element.link[0].$.href
                                //adapter.log.debug('4: Before Request Details')
                                detailsURL.push = detailsLink
                                //const done =  requestDetails(detailsLink)
                                //adapter.log.debug('9: After Request Details')
                    
                                i += 1;
                            }
                        });
                        //adapter.log.debug('All entries processed')
                        //adapter.log.debug('Entries found: ' + i)
                        //return







                        //await processAtom(result)
                        //const done = processAtom(result)
                        adapter.log.debug(' Links: ' + detailsURL)

                        adapter.log.debug('5: Processed Atom')
                        return Promise.resolve();
                    }
                });
            }
        }
        else{
            adapter.log.warn('Status Code XML:' + response.statusCode)
            adapter.terminate ? adapter.terminate(0) : process.exit(0);
        }
      });    

    }
    else{
        adapter.log.error('No country selected. Please check setup!')
        adapter.terminate ? adapter.terminate(0) : process.exit(0);

    }
    
}

  
async function requestDetails(detailsLink){

    adapter.log.debug('Requesting details from ' + detailsLink)

    typeArray = []

    request.get({
        url:     detailsLink,
        timeout: 8000
      }, function(error, response, body){
        if (error){
            if (error.code === 'ETIMEDOUT'){
                adapter.log.warn('Error ETIMEOUT: No website response after 8 seconds. Adapter will try again at next scheduled run.')
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            else if (error.code === 'ESOCKETTIMEDOUT'){
                adapter.log.warn('Error ESOCKETTIMEDOUT: No website response after 8 seconds. Adapter will try again at next scheduled run.')
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            else if (error.code === 'ENOTFOUND'){
                adapter.log.warn('Error ENOTFOUND: No website response after 8 seconds. Adapter will try again at next scheduled run.')
                adapter.terminate ? adapter.terminate(0) : process.exit(0);
            }
            else(
                adapter.log.error(error)

            )
        }
        if (response.statusCode == 200){
            adapter.log.debug('Status Code:' + response.statusCode)
            if (body) {
                //var cleanedString = body.replace("\ufeff", "");
                parseString(body, {
                    explicitArray: false,
    
                    //mergeAttrs: true
                }, 
    
                function (err, result) {
    
                    if (err) {
    
                        adapter.log.error("Fehler: " + err);
                        return
                        //adapter.terminate ? adapter.terminate(0) : process.exit(0);
                    } else {
                        adapter.log.debug('Ready to parse atom')
                        countEntries += 1
                        var type = result.alert.info[0].parameter[1].value
                        if (typeArray.indexOf(type) > -1) {
                            //In the array - skip
                            return
                        } else {
                            //Not in the array
                            typeArray.push(type)
                            adapter.log.debug('5: Before Process Details')

                            const promises = processDetails(result,countEntries)
                            adapter.log.debug('8: After Process Details')
                            return
                            //adapter.terminate ? adapter.terminate(0) : process.exit(0);
                        }
                    }
                });
            }
        }
        else{
            adapter.log.warn('Status Code:' + response.statusCode)
            return
            //adapter.terminate ? adapter.terminate(0) : process.exit(0);
        }
      });    
}

/*
async function processAtom(content){
    adapter.log.debug('Received Atom data for ' + JSON.stringify(content.feed.id))

    var newdate = moment(new Date()).local().format('DD.MM.YYYY HH:mm')

    adapter.setState({device: '' , channel: '',state: 'lastUpdate'}, {val: newdate, ack: true});

    var i = 0
    var now = new Date();
    content.feed.entry.forEach(function (element){
        var expiresDate = new Date(element['cap:expires']);
        if (element['cap:areaDesc'] == regionConfig && expiresDate >= now){
            var detailsLink = element.link[0].$.href
            adapter.log.debug('4: Before Request Details')

            const done =  requestDetails(detailsLink)
            adapter.log.debug('9: After Request Details')

            i += 1;
        }
    });
    //adapter.log.debug('All entries processed')
    //adapter.log.debug('Entries found: ' + i)
    return
}
*/

async function processDetails(content, countInt){

    let created = createAlarms(countInt)
    let done = await created
    adapter.log.debug('6: After Create Alarm')
    var level = content.alert.info[0].parameter[0].value
    var n = level.indexOf(";");
    level = level.substring(0, n)
    var type = content.alert.info[0].parameter[1].value
    var n = type.indexOf(";");
    type = type.substring(0, n)

    var Warnung_img = ''
    if (level != 1){
        if (adapter.config.whiteIcons){
            Warnung_img += '/meteoalarm.admin/icons/white/'
        }
        else{
            Warnung_img += '/meteoalarm.admin/icons/black/'
        }
        Warnung_img += 't' + type + '.png'
    }

    const promises = await Promise.all([

        adapter.setStateAsync({ state: 'alarms.' + countInt + '.event'}, {val:  content.alert.info[0].event, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.description'}, {val: content.alert.info[0].description, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.link'}, {val: content.alert.info[0].web, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.expires'}, {val: content.alert.info[0].expires, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.effective'}, {val: content.alert.info[0].effective, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.sender'}, {val: content.alert.info[0].senderName, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.level'}, {val: level, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.levelText'}, {val: getLevelName(level), ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.type'}, {val: type, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.typeText'}, {val: getTypeName(type), ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.icon'}, {val: Warnung_img, ack: true}),
        adapter.setStateAsync({ state: 'alarms.' + countInt + '.color'}, {val: getColor(level), ack: true})
    ])
    adapter.log.debug('7: After Set Alarm')

}

async function deleteAllAlarms(){
    const promises = await Promise.all([
        adapter.deleteDeviceAsync('alarms')
    ])
}

async function createAlarms(AlarmNumber){
    const promises = await Promise.all([

        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber, {
            common: {
                name: 'Alarm'
            },
            type: 'channel',
            'native' : {}
        }),

        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.event', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.color', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.icon', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.level', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.levelText', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.type', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.typeText', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.description', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.sender', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.effective', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.expires', {
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
        adapter.setObjectNotExistsAsync('alarms.' + AlarmNumber + '.link', {
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

/*

function processJSON(content){

    getFilters()
    adapter.setState({device: '' , channel: '',state: 'location'}, {val: JSON.stringify(content.rss.channel.item.title), ack: true});
    adapter.log.info('Received data for ' + JSON.stringify(content.rss.channel.item.title))

    adapter.setState({device: '' , channel: '',state: 'link'}, {val: JSON.stringify(content.rss.channel.item.link), ack: true});

    var newdate = moment(new Date()).local().format('DD.MM.YYYY HH:mm')

    adapter.setState({device: '' , channel: '',state: 'lastUpdate'}, {val: newdate, ack: true});
    adapter.setState({device: '' , channel: '',state: 'publicationDate'}, {val: JSON.stringify(content.rss.channel.item.pubDate), ack: true});


    if (DescFilter1 != 'nA'){
        if (typeof content.rss.channel.item.description != 'undefined'){
            parseWeather(content.rss.channel.item.description,'today', function(){
                parseWeather(content.rss.channel.item.description,'tomorrow', function(){
                    setTimeout(function() {
                        // wait 3 seconds to make sure all is done
                        updateHTMLWidget()
                      }, 3000);
                    
                })
            })    
        }
        else{
            adapter.log.error('Invalid XML - please check link in adapter settings. Choose region!')
            adapter.terminate ? adapter.terminate(0) : process.exit(0);
        }            
    }
    else{
        // Land ist nicht in der Filterliste (getfilters()) -> daher kann Text nicht gefunden werden
        adapter.log.error('The country ' + country +  ' is not set up. Please create a github issue to get it set up.')
        adapter.terminate ? adapter.terminate(0) : process.exit(0);
    }
}

*/

function updateHTMLWidget(){
    var htmllong = '';
    var typeName = '';
    var color = '';
    var icon = '';
    var from = '';
    var to = '';
    var text = '';
    var level = '';

    adapter.getState('today.type', function (err, state) {
        typeName = getTypeName(parseInt(state.val));

    });
    adapter.getState('today.color', function (err, state) {
        color = state.val;
    });

    adapter.getState('today.level', function (err, state) {
        level = state.val;
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
    
    adapter.log.debug('Setup Status noBackground Color:' + adapter.config.noBackgroundColor)

    adapter.getState('today.text', function (err, state) {
        text = state.val;

        if (level != '1'){
            // Warnung vorhanden
            htmllong += '<div '
            if (!adapter.config.noBackgroundColor){
                htmllong += 'style="background:' + color + '"';  
            }
            htmllong += ' border:"10px">';
            htmllong += '<div style="display: flex; align-items: center">'
            if (!adapter.config.noIcons){
                htmllong += '<img src="' +  icon + '" alt="" width="20" height="20"/> '
            }
            htmllong += '<h3 style="margin-left: 10px;margin-top: 5px;margin-bottom: 5px;">' + typeName + '</h3> </div>' 
            htmllong += '<div style="margin-left: 10px; margin-right: 5px">' + from + ' - ' + to 
            htmllong += '</p><p>' + text + '</p></div></div>'
        }
        else{
            // keine Warnung vorhanden
            htmllong += '<div ';
            if (!adapter.config.noBackgroundColor){
                htmllong +=  'style="background:' + color + '"';  
            }
            htmllong += ' border:"10px">';
            htmllong += '<p></p><h3> '
            htmllong += i18nHelper.NoWarning[lang] + '</h3><p>'  
            htmllong += '</p><p></p></div>'
        }
        
        adapter.setState({device: '' , channel: '',state: 'htmlToday'}, {val: htmllong, ack: true});


        let weatherDate = moment(new Date()).local().format('YYMMDD')
        var htmlweathermap = "https://meteoalarm.eu/maps/" + country.toUpperCase() + '-' + weatherDate + '.gif';

        adapter.setState({device: '' , channel: '',state: 'weatherMapCountry'}, {val: htmlweathermap, ack: true});


        setTimeout(function() {
            // wait 5 seconds to make sure all is done
            adapter.log.debug('All done')
            adapter.terminate ? adapter.terminate(0) : process.exit(0);
          }, 5000);
        
    });
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

function parseWeather(description,type, callback){
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

    adapter.setState({device: '' , channel: folder,state: 'text'}, {val: WarnungsText, ack: true});

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
    
    adapter.setState({device: '' , channel: folder,state: 'from'}, {val: Warnung_Von, ack: true});
    adapter.setState({device: '' , channel: folder,state: 'to'}, {val: Warnung_Bis, ack: true});


        // Warning Text  Level
        SearchCrit1 = ContentHeute.indexOf('level:') + 1;
        SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 6;
        SearchCrit2 = SearchCrit1 + 1;
        var Level = parseInt(ContentHeute.charAt(SearchCrit1 - 1));
        var Color = ''
        if (SearchCrit1 != 0) {

            adapter.setState({device: '' , channel: folder,state: 'level'}, {val: Level, ack: true});
            adapter.setState({device: '' , channel: folder,state: 'levelText'}, {val: getLevelName(Level), ack: true});

        
            switch (Level) {
             case 1:
                // Grün
                Color = adapter.config.warningColorLevel1;
                break;
            case 2:
                // Gelb
                Color = adapter.config.warningColorLevel2;
                break;
            case 3:
                // Orange
                Color = adapter.config.warningColorLevel3;
                break;
            case 4:
                // Rot
                Color = adapter.config.warningColorLevel4;
                break;
            default:
                Color = '#ffffff';
                break;
            }

            adapter.setState({device: '' , channel: folder,state: 'color'}, {val: Color, ack: true});

        }

    //Warning Text Type
    SearchCrit1 = ContentHeute.indexOf('awt:') + 1;
    SearchCrit1 = (typeof SearchCrit1 == 'number' ? SearchCrit1 : 0) + 4;
    SearchCrit2 = SearchCrit1 + 1;
    var Typ = parseInt(ContentHeute.slice((SearchCrit1 - 1), SearchCrit2));
    if (SearchCrit1 != 0) {
        if (Level == 1){
            Typ = 0;
        }

        adapter.setState({device: '' , channel: folder,state: 'type'}, {val: Typ, ack: true});
        adapter.setState({device: '' , channel: folder,state: 'typeText'}, {val: getTypeName(Typ), ack: true});
    }

    var Warnung_img = '';
    if (Level != 1){
        if (adapter.config.whiteIcons){
            Warnung_img += '/meteoalarm.admin/icons/white/'
        }
        else{
            Warnung_img += '/meteoalarm.admin/icons/black/'
        }
        Warnung_img += 't' + Typ + '.png'
    }

    adapter.setState({device: '' , channel: folder,state: 'icon'}, {val: Warnung_img, ack: true});

    adapter.log.debug('Loaded ' + type + ' data')
    callback()
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
                DescFilter2 = 'english:';
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
        case 'es':
            // Spanien
            DescFilter1 = 'español:';
            DescFilter2 = 'english:';
           break;
        case 'ch':
            // Switzerland
            DescFilter1 = 'english:';
            DescFilter2 = '</td>';
           break;
        case 'sk':
            // Switzerland
            DescFilter1 = 'slovenčina:';
            DescFilter2 = 'english:';
           break;
        case 'cz':
            // Czech Republic
            DescFilter1 = 'čeština:';
            DescFilter2 = 'english:';
        break;
        case 'ie':
            // Ireland
            DescFilter1 = 'english:';
            DescFilter2 = '</td>';
        break;
        case 'il':
            // Israel
            DescFilter1 = 'english:';
            DescFilter2 = '</td>';
        break;
        case 'lt':
            // Lithuania
            DescFilter1 = 'lietuviu:';
            DescFilter2 = 'english:';
        break;
        case 'lu':
            // Luxembourg
            DescFilter1 = 'deutsch:';
            DescFilter2 = 'english:';
        break;
        case 'lv':
            // Latvia
            DescFilter1 = 'latviešu:';
            DescFilter2 = '</td>';
        break;
        case 'me':
            // Montenegro
            DescFilter1 = 'Црногорски:';
            DescFilter2 = '</td>';
        break;
        case 'mt':
            // Malta
            DescFilter1 = 'Malti:';
            DescFilter2 = '</td>';
        break;
        case 'rs':
            // Serbia
            DescFilter1 = 'српски:';
            DescFilter2 = '</td>';
        break;
        case 'se':
            // Sweden
            DescFilter1 = 'svenska:';
            DescFilter2 = 'english:';
        break;
        case 'pl':
            // Poland
            DescFilter1 = 'polski:';
            DescFilter2 = 'english:';
        break;
        case 'md':
            // Moldova
            DescFilter1 = 'româna:';
            DescFilter2 = '</td>';
        break;
        case 'ro':
            // Romania
            DescFilter1 = 'româna:';
            DescFilter2 = 'english:';
        break;
        case 'gr':
            // Greece
            DescFilter1 = 'Ελληνικά:';
            DescFilter2 = '</td>';
        break;
        default:
                DescFilter1 = 'nA';
                DescFilter2 = 'nA';
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
        case 'MT':
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

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
} 