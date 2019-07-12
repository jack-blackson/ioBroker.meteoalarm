![Logo](admin/meteoalarm.png)
# ioBroker.meteoalarm
=================

[![Greenkeeper badge](https://badges.greenkeeper.io/jack-blackson/ioBroker.meteoalarm.svg)](https://greenkeeper.io/)

[![NPM version](http://img.shields.io/npm/v/iobroker.meteoalarm.svg)](https://www.npmjs.com/package/iobroker.meteoalarm)

**Tests:** [![Build Status Travis](https://travis-ci.org/jack-blackson/ioBroker.meteoalarm.svg?branch=master)](https://travis-ci.org/jack-blackson/ioBroker.meteoalarm) 

[![NPM](https://nodei.co/npm/iobroker.meteoalarm.png?downloads=true)](https://nodei.co/npm/iobroker.meteoalarm.png?downloads=true/)
<!--![Number of Installations](http://iobroker.live/badges/bring-installed.svg) ![Number of Installations](http://iobroker.live/badges/bring-stable.svg) 
[![Downloads](https://img.shields.io/npm/dm/iobroker.bring.svg)](https://www.npmjs.com/package/iobroker.countdown)

-->


meteoalarm Adapter for ioBroker
------------------------------------------------------------------------------
This adapter is pulling weather alarms from meteoalarm.eu, which includes wind, snow, rain, high and low temperature,etc. This information is available in local language and for detailed regions.

## How to use it
Please go to http://meteoalarm.eu and choose your region. Then go to the RSS symbol on the top right side, do a right click and copy the link. This is the link which you please add to the setup of the adapter.

## Available fields
|Field Name|Description|                                                                       
|:---:|:---:|
|Last Update|Date when the adapter received data the last time|
|Link|Link to the RSS Feed|
|Location|Alarm Location|
|Publication Date|Publication Date of the alarm according to the website|
|Text|Alarm Text in country specific language|
|From|Alarm starting date|
|To|Alarm ending date|
|Type|Type of Alarm -> see below|
|Level|Level of Alarm -> see below|
|Color|Alarm color for widgets|
|Icon|Alarm type icon|


## Alarm Types
|Alarm Type|Description|                                                                       
|:---:|:---:|
|1|Wind|
|2|Thunder & Lightning|
|3|unknown|
|4|unknown|
|5|High temperature|
|6|unknown|
|7|unknown|
|8|Forest fire|
|9|unknown|
|10|Rain|

## Alarm Levels
|Alarm Level|Description|                                                                       
|:---:|:---:|
|Green|There is no warning available at the moment.|
|Yellow|The weather is potentially dangerous. The predicted weather phenomena are not unusual, but increased attention should be paid to activities exposed to meteorological risks. Keep yourself informed about the meteorological conditions to be expected and do not take any avoidable risks.|
|Orange|The weather is dangerous. Unusual meteorological phenomena have been predicted. Damage and accidents are likely. Be very attentive and careful and keep up to date with the expected meteorological conditions. |
|Red|The weather is very dangerous. Unusually intense meteorological phenomena were predicted. Extreme damage and accidents, often over large areas, threaten life and property. |

## Supported countries
* Austria
* Germany
* Italy

If you don't find your country, please create an issue on github, and I will be happy to add it


## Changelog
### 0.1.0 (2019-07-12)
* (jack-blackson) initial version


## Credits
Bell in icon designed by Freepik from www.flaticon.com


## License
The MIT License (MIT)

Copyright (c) 2019 jack-blackson <blacksonj7@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.