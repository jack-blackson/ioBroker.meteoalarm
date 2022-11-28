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
		}
	}
);

// this code can be placed directly in rssfeed.html
vis.binds['meteoalarm'] = {
    version: '0.0.1',
    showVersion: function () {
        if (vis.binds['meteoalarm'].version) {
            console.log('Version meteoalarm: ' + vis.binds['meteoalarm'].version);
            vis.binds['meteoalarm'].version = null;
        }
    },
    tplmeteoAlarmWidget: {
        createWidget: function (widgetID, view, data, style) {

            var $div = $('#' + widgetID);
            // if nothing found => wait
            if (!$div.length) {
                return setTimeout(function () {
                    vis.binds['rssfeed'].rssfeedmultiwidget.createWidget(widgetID, view, data, style);
                }, 100);
            }

            var articles = [];
            var feedCount = data.rss_feedCount ? data.rss_feedCount : 1;
            var dpCount = data.rss_dpCount ? data.rss_dpCount : 1;
            var datapoints = [];
            var bound = [];

            for (var i1 = 1; i1 <= dpCount; i1++) {
                if (data['rss_dp'+i1]) {
                    datapoints[data['rss_dp'+i1]] = vis.states.attr(data['rss_dp'+i1] + '.val');
                    bound.push(data['rss_dp'+i1]);
                }
            }

            var defaulttemplate = `
                <% articles.forEach(function(item){ %>
                <p><%- item.meta_name || item.meta_title || '' %></p>
                <p><small><%- vis.formatDate(item.pubdate, "TT.MM.JJJJ SS:mm") %></small></p>
                <h3><%- item.title %></h3>
                <p><%- item.description %></p>
                <div style="clear:both;" />
                <% }); %>
                            `;

            var template  = (data['rss_template'] ? ( data['rss_template'].trim() ? data['rss_template'].trim() : defaulttemplate) : defaulttemplate);

            var filterFunction = function(item){
                return vis.binds['rssfeed'].checkHighlite(item.title+item.description+item.categories.toString(),filter);
            };
            var mapFunction = function(item) {
                item['meta_title'] = rss.meta.title;
                item['meta_description'] = rss.meta.description;
                item['meta_name'] = name;
                return item;
            }.bind(this);

            for (var i = 1; i <= feedCount; i++) {
                var rss  = data['rss_oid'+i] ? JSON.parse(vis.states.attr(data['rss_oid'+i] + '.val')) : {};
                if (!Object.prototype.hasOwnProperty.call(rss,'articles'))  continue;
                bound.push(data['rss_oid'+i]);

                var filter  = data['rss_filter'+i] ? data['rss_filter'+i] : '';
                var maxarticles = data['rss_maxarticles'+i] ? data['rss_maxarticles'+i] : 999;
                maxarticles = maxarticles > 0 ? maxarticles : 1;
                var name  = data['rss_name'+i] ? data['rss_name'+i] : '';

                if (rss && rss.articles && rss.articles.length > maxarticles) rss.articles = rss.articles.slice(0,maxarticles);

                if (filter!='') {
                    rss.articles = rss.articles.filter(filterFunction);
                }

                rss.articles = rss.articles.map(mapFunction);
                articles.push(rss.articles);
            }

            // eslint-disable-next-line no-unused-vars
            function onChange(e, newVal, oldVal) {
                if (newVal) vis.binds['rssfeed'].rssfeedmultiwidget.createWidget(widgetID, view, data, style);
            }
            if (bound.length>0 ) {
                // eslint-disable-next-line no-constant-condition
                if (1 || !vis.editMode) {
                    vis.binds['rssfeed'].bindStates($div,bound,onChange);
                }
            }

            var collect = [];
            articles.forEach(function(item){
                collect=collect.concat(item);
            }
            );

            collect.sort(function(a,b){
                // Turn your strings into dates, and then subtract them
                // to get a value that is either negative, positive, or zero.
                return new Date(b.date) - new Date(a.date);
            });
            var meta = new Proxy({},{get(target,name) {
                if (name=='title' || name=='description') {
                    return 'meta.'+ name +' is not available please use RSS Feed widget. Read the widget help';
                } else {
                    return 'meta is not available please use RSS Feed widget. Read the widget help.';
                }
            }});
            var text='';
            try {
                text = ejs.render(template, {'articles': collect,'meta':meta,'dp':datapoints});
            }
            catch (e) {
                text = vis.binds['rssfeed'].escapeHTML(e.message).replace(/(?:\r\n|\r|\n)/g, '<br>');
                text = text.replace(/ /gm,'&nbsp;');
                text = '<code style="color:red;">' + text + '</code>';
            }

            $('#' + widgetID).html(text);
        },
    },
    checkHighlite: function(value,highlights,sep) {
        sep = typeof sep !== 'undefined' ? sep : ';';
        var highlight = highlights.split(sep);
        return highlight.reduce(function(acc,cur){
            if (cur=='') return acc;
            return acc || value.toLowerCase().indexOf(cur.toLowerCase())>=0;
        },false);
    },
    bindStates: function(elem, bound, change_callback) {
        var $div = $(elem);
        var boundstates = $div.data('bound');
        if (boundstates) {
            for (var i = 0; i < boundstates.length; i++) {
                vis.states.unbind(boundstates[i], change_callback);
            }
        }
        $div.data('bound', null);
        $div.data('bindHandler', null);

        vis.conn.gettingStates = 0;
        vis.conn.getStates(bound, function (error, states) {
            vis.conn.subscribe(bound);
            $div.data('bound', bound);
            $div.data('bindHandler', change_callback);
            for (var i=0;i<bound.length;i++) {
                bound[i]=bound[i]+'.val';
                vis.states.bind(bound[i] , change_callback);
            }
            vis.updateStates(states);
        }.bind({change_callback}));
    },
    escapeHTML: function (html) {
        var escapeEl = document.createElement('textarea');
        escapeEl.textContent = html;
        var ret = escapeEl.innerHTML;
        escapeEl = null;
        return ret;
    },
    editEjs: function (widAttr) {
        var that = vis;
        var line = {
            input: '<textarea id="inspect_' + widAttr + '"></textarea>'
        };

        line.button = {
            icon: 'ui-icon-note',
            text: false,
            title: _('Select color'),
            click: function (/*event*/) {
                var wdata = $(this).data('wdata');
                var data = {};
                if (that.config['dialog-edit-text']) {
                    data = JSON.parse(that.config['dialog-edit-text']);
                }
                ace.config.setModuleUrl('ace/mode/ejs', 'widgets/rssfeed/js/mode-ejs.js');
                var editor = ace.edit('dialog-edit-text-textarea');
                var changed = false;
                $('#dialog-edit-text').dialog({
                    autoOpen: true,
                    width:    data.width  || 800,
                    height:   data.height || 600,
                    modal:    true,
                    resize:   function () {
                        editor.resize();
                    },
                    open: function (event) {
                        $(event.target).parent().find('.ui-dialog-titlebar-close .ui-button-text').html('');
                        $(this).parent().css({'z-index': 1000});
                        if (data.top !== undefined) {
                            if (data.top >= 0) {
                                $(this).parent().css({top:  data.top});
                            } else {
                                $(this).parent().css({top:  0});
                            }
                        }
                        if (data.left !== undefined) {
                            if (data.left >= 0) {
                                $(this).parent().css({left: data.left});
                            } else {
                                $(this).parent().css({left: 0});
                            }
                        }
                        editor.getSession().setMode('ace/mode/ejs');
                        editor.setOptions({
                            enableBasicAutocompletion: true,
                            enableLiveAutocompletion:  true
                        });
                        editor.$blockScrolling = Infinity;
                        editor.getSession().setUseWrapMode(true);
                        editor.setValue($('#inspect_' + wdata.attr).val());
                        editor.navigateFileEnd();
                        editor.focus();
                        editor.getSession().on('change', function() {
                            changed = true;
                        });
                    },
                    beforeClose: function () {
                        var $parent = $('#dialog-edit-text').parent();
                        var pos = $parent.position();
                        that.editSaveConfig('dialog-edit-text', JSON.stringify({
                            top:    pos.top  > 0 ? pos.top  : 0,
                            left:   pos.left > 0 ? pos.left : 0,
                            width:  $parent.width(),
                            height: $parent.height() + 9
                        }));

                        if (changed) {
                            if (!window.confirm(_('Changes are not saved!. Continue?'))) {
                                return false;
                            }
                        }
                    },
                    buttons:  [
                        {
                            text: _('Ok'),
                            click: function () {
                                $('#inspect_' + wdata.attr).val(editor.getValue()).trigger('change');
                                changed = false;
                                $(this).dialog('close');
                            }
                        },
                        {
                            text: _('Cancel'),
                            click: function () {
                                $(this).dialog('close');
                            }
                        }
                    ]
                }).show();
            }
        };
        return line;
    },

};

vis.binds['meteoalarm'].showVersion();

