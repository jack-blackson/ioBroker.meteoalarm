/* eslint-disable no-var */
/* eslint-disable space-before-function-paren */
/*
    ioBroker.vis iobroker Widget-Set


    Copyright 2022 blacksonj blacksonj7@gmail.com
*/
'use strict';

// add translations for edit mode

$.extend(
	true,
	systemDictionary,
	{
		"meteo_Loc": {
			"en": "Location",
            "de": "Standort",
            "ru": "Локация",
            "pt": "Localização",
            "nl": "Locatie",
            "fr": "Lieu",
            "it": "Location",
            "es": "Ubicación",
            "pl": "Location",
            "uk": "Місцезнаходження",
            "zh-cn": "租金"
		},		
        "group_showElements": {
			"en": "Display Elements",
            "de": "Anzeigeelemente",
            "ru": "Элементы дисплея",
            "pt": "Elementos de exibição",
            "nl": "Vertaling:",
            "fr": "Éléments d'affichage",
            "it": "Elementi di visualizzazione",
            "es": "Elementos de visualización",
            "pl": "Elementy rozgrywkowe",
            "uk": "Елементи відображення",
            "zh-cn": "缺点"
		},
        "show_Loc": {
            "en": "Show Location",
            "de": "Standort anzeigen",
            "ru": "Показать местоположение",
            "pt": "Mostrar localização",
            "nl": "Toon de locatie",
            "fr": "Voir la situation",
            "it": "Mostra posizione",
            "es": "Mostrar ubicación",
            "pl": "Show Location (ang.)",
            "uk": "Показати Місцезнаходження",
            "zh-cn": "技能租赁"
		}
	}
);




vis.binds["meteoalarm"] = {
	version: "0.0.1",
	showVersion: function () {
		if (vis.binds["meteoalarm"].version) {
			console.log("Version meteoalarm: " + vis.binds["meteoalarm"].version);
			vis.binds["meteoalarm"].version = null;
		}
	},
	createWidget: function (widgetID, view, data, style) {
		var $div = $("#" + widgetID);
		// if nothing found => wait
		if (!$div.length) {
			return setTimeout(function () {
				vis.binds["meteoalarm"].createWidget(widgetID, view, data, style);
			}, 100);
		}
		console.log(`Creating Meteoalarm Widget for widget #${widgetID}`);
        console.log('Location: ' + data.meteo_Loc)
        //$('#' + widgetID).html("text");
        /*
		function onChange(e, newVal, oldVal) {
			let img = new Image();
			img.src = newVal;

			if (data.Debug === true) { console.log(`Picture change occured for widget #${widgetID}`) };

		}
        

		if (data.oid) {
			vis.states.bind(data.oid + ".val", onChange);
		}
        */
	}
};





vis.binds['meteoalarm'].showVersion();
vis.binds['meteoalarm'].createWidget();

