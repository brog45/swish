/*  Part of SWISH

    Author:        Jan Wielemaker
    E-mail:        J.Wielemaker@cs.vu.nl
    WWW:           http://www.swi-prolog.org
    Copyright (C): 2014-2018, VU University Amsterdam
			      CWI Amsterdam
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions
    are met:

    1. Redistributions of source code must retain the above copyright
       notice, this list of conditions and the following disclaimer.

    2. Redistributions in binary form must reproduce the above copyright
       notice, this list of conditions and the following disclaimer in
       the documentation and/or other materials provided with the
       distribution.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
    FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
    COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
    INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
    BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
    LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
    CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
    LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
    ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
    POSSIBILITY OF SUCH DAMAGE.
*/

/**
 * @fileOverview
 * List available sources.
 *
 * @version 0.2.0
 * @author Jan Wielemaker, J.Wielemaker@vu.nl
 * @requires jquery
 */

define([ "jquery", "config", "form", "modal", "laconic" ],
       function($, config, form, modal) {

(function($) {
  var pluginName = 'sourcelist';

  var current_query;
  var query_cache = [];

  /** @lends $.fn.sourcelist */
  var methods = {
    _init: function(options) {
      return this.each(function() {
	var elem = $(this);
	var data = {};			/* private data */

	elem.data(pluginName, data);	/* store with element */
	elem[pluginName]('update', current_query);
      });
    },

    /**
     * Post an update query and process the result
     */
    update: function(query) {
      var elem = this;
      var reply;
      var profile = $("#login").login('get_profile',
				      [ "display_name", "avatar"
				      ]);

      if ( (reply = from_cache(query_cache, query)) ) {
	elem.sourcelist('fill', reply, query);
      } else {
	query = query||{};

	$.extend(query, profile);
	query.q = query.q||"";
	query.offset = query.offset||0;
	query.limit  = query.limit||10;

	$.ajax({
	  url: config.http.locations.source_list,
	  data: query,
	  dataType: "json",
	  success: function(reply) {
	    reply.query = query;
	    add_to_cache(query_cache, reply);
	    elem.sourcelist('fill', reply, query);
	  },
	  error: function(jqXHDR) {
	    modal.ajaxError(jqXHDR);
	  }
	});
      }
    },

    /**
     * Go to a page
     */

    page: function(move) {
      var data = this.data(pluginName);

      if ( data && data.page ) {
	var q = $.extend({}, data.page.query);

	if ( q.offset == undefined )
	  q.offset = 0;

	function roundUp(v, n) {
	  return Math.floor((v+(n-1))/n) * n;
	}

	switch(move) {
	  case "first": q.offset  = 0; break;
	  case "prev":  q.offset -= data.page.size; break;
	  case "next":  q.offset += data.page.size; break;
	  case "last":  q.offset  = roundUp(data.page.total, data.page.size) -
				    data.page.size; break;
	  default: return;
	}

	q.offset = Math.max(0, q.offset);
	this[pluginName]('update', q);
      }
    },

    /**
     * Fill the result table
     */
    fill: function(results, query) {
      var data = this.data(pluginName);
      var body;

      current_query = query;
      data.page = { query:  query,
                    offset: query.offset,
		    size:   query.limit,
		    total:  results.total
                  };

      function h(title) {
	return $.el.th(title);
      }

      function humanize(stamp) {
	var d = new Date(stamp*1000);
	var s = d.toISOString();

	return s.slice(0, 10) + " " + s.slice(11,19);
      }

      body = this.find("tbody");
      if ( body.length == 0 ) {
	this.append($.el.div({class:"search-form input-group"}),
		    table =
		    $.el.table({class:"table table-striped table-hover "+
				      "table-condensed"},
			       $.el.thead($.el.tr(h("Type"),
						  h("Name"),
						  h("Tags"),
						  h("User"),
						  h("Modified"))),
			       body = $.el.tbody()),
		   $.el.div({class:"search-footer"}));
	this[pluginName]('search_form');
	body = $(body);
	body.on("click", "tr", function(ev) {
	  var tr = $(ev.target).closest("tr");
	  $("body").swish('playFile', { file:tr.attr("data-name") });
	});
      } else {
	$(body).html("");
      }

      this.find("input.search").val(results.query.q);
      var i = query.offset - results.query.offset;
      var e = Math.min(i+query.limit, results.matches.length);

      for(; i<e; i++)
      { var match = results.matches[i];
	var ext   = match.name.split(".").pop();
	var base  = match.name.slice(0, -(ext.length+1));

	body.append($.el.tr({"data-name":match.name},
			    $.el.td(form.widgets.typeIcon(ext)),
			    $.el.td(base),
			    $.el.td((match.tags||[]).join(" ")),
			    $.el.td(match.author),
			    $.el.td(humanize(match.time))));
      }
      this[pluginName]('search_footer', results, query);
    },

    search_footer: function(data, query) {
      var footer = this.find("div.search-footer");
      var bopts = {};

      function btn(action, dir, icon) {
	bopts.action = action;
	bopts.class  = "btn-primary "+dir;
	return form.widgets.glyphIconButton(icon, bopts);
      }

      if ( footer.find(".f-total").length == 0 ) {
	footer.append(btn("first", "backward", "fast-backward"),
		      btn("prev",  "backward", "step-backward"),
		      $.el.button({class:"btn btn-default"},
				  $.el.span({class: "f-from"}),
				  $.el.label("to"),
				  $.el.span({class: "f-to"}),
				  $.el.label("from"),
				  $.el.span({class: "f-total"})),
		      btn("next", "forward", "step-forward"),
		      btn("last", "forward", "fast-forward"));

	footer.on("click", "button", function(ev) {
	  var b   = $(ev.target).closest("button");
	  var act = b.data('action');

	  if ( act )
	    b.closest("div.sourcelist")[pluginName]("page", act)
	});
      }

      var end = Math.min(query.offset+query.limit, data.total);

      if ( query.offset > 0 || end < data.total ) {
	footer.show();
	if ( query.offset == 0 ) {
	  footer.find(".backward").attr("disabled", "disabled");
	} else {
	  footer.find(".backward").removeAttr("disabled");
	}
	if ( end >= data.total ) {
	  footer.find(".forward").attr("disabled", "disabled");
	} else {
	  footer.find(".forward").removeAttr("disabled");
	}
	footer.find(".f-from") .text(""+query.offset);
	footer.find(".f-to")   .text(""+end);
	footer.find(".f-total").text(""+data.total);
      } else {
	footer.hide();
      }
    },

    search_form: function() {
      var data = this.data(pluginName);
      var elem = this;
      var div = this.find("div.search-form");
      var btnsubmit;

      function btn(title, members) {
	var ul;
	var div = $.el.div({class:"btn-group"},
		    $.el.button({ type:"button",
			          class:"btn btn-default dropdown-toggle",
			          'data-toggle':"dropdown",
			          'aria-haspopup': true,
			          'aria-expanded': false
			        },
				title, " ",
				$.el.span({class:"caret"})),
		    ul=$.el.ul({class:"dropdown-menu"}));

	function add(item) {
	  if ( title == "Type" )
	    return $.el.a({'data-tag':"type", 'data-value':item},
			  form.widgets.typeIcon(item), " ."+item);
	  else
	    return $.el.a({'data-tag':item}, item);
	}

	for(var i=0; i<members.length; i++) {
	  $(ul).append($.el.li(add(members[i])));
	}

	return div;
      }

      function resettimeout(set) {
	if ( data.tmo ) {
	  clearTimeout(data.tmo);
	  data.tmo = undefined;
	}
	if ( set == true )
	  set = 1000;
	if ( set )
	  setTimeout(submit, set);
      }

      function submit(ev) {
	if ( ev )
	  ev.preventDefault();
	resettimeout();
	var q = elem.find("input").val();
	elem[pluginName]('update', {q:q});
	return false;
      }

      div.append(
	$.el.div({class:"form-group has-feedback has-clear"},
		 $.el.input({
		   type: "text",
		   class: "form-control search",
		   placeholder: "Find files"
		 }),
		 $.el.span({class:"form-control-clear glyphicon "+
				  "glyphicon-remove form-control-feedback "+
				  "hidden"})),
	$.el.div({ class: "input-group-btn" },
		 btn("Filter", ["name", "user", "tag"]),
		 btn("Type",   ["pl", "swinb", "lnk"]),
		 btnsubmit=
		 $.el.button({class:"btn btn-default", type:"submit"},
			     $.el.i({class:"glyphicon glyphicon-search"}))));

      form.dyn_clear(div, submit);

      div.on("click", "a", function(ev) {
	var a = $(ev.target).closest("a");

	function tag(tag, value) {
	  var input = div.find("input");
	  var val = input.val();
	  var tagv = tag + ":" + (value||"");

	  if ( val.trim() == "" ) {
	    val = tagv;
	  } else {
	    if ( value && RegExp("\\b"+tag+":").test(val) ) {
	      val = val.replace(RegExp("\\b"+tag+":\\S*"), tagv);
	    } else {
	      val = val.trim() + " " + tagv;
	    }
	  }

	  input.val(val).trigger('propertychange');
	  if ( value || tag == "tag" )
	    submit();
	}

	tag(a.data('tag'), a.data('value'));
      });

      $(btnsubmit).on("click", function(ev) {
	return submit(ev);
      });

      elem.find("input").keydown(function(ev) {
	if ( ev.which == 13 )
	  return submit(ev);
	if ( from_cache(query_cache, div.find("input").val()) ) {
	  resettimeout(200);
	} else
	  resettimeout(true);
      });
    }
  }; // methods


  /**
   * Cache management.  These functions should eventually merge results
   * and select sub-results without contacting the server.
   */
  function from_cache(cache, query) {
    function qmatch(entry) {
      var e = entry.query;
      if ( query.q == e.q ) {
	if ( query.offset >= e.offset &&
	     (query.offset+query.limit <= e.offset + entry.matches.length ||
	      e.offset + entry.matches.length == entry.total) )
	  return e;
	}
    }

    if ( query != undefined ) {
      query.offset = query.offset || 0;
      query.limit  = query.limit  || 10;

      for(var i=cache.length-1; i>=0; i--) {
	var entry = cache[i];
	if ( qmatch(entry) )
	  return entry;
      }
    }
  }

  function add_to_cache(cache, result) {
    var qr = result.query;

    qr.offset = qr.offset || 0;
    qr.limit  = qr.limit  || 10;

    for(var i=cache.length-1; i>=0; i--) {
      var entry = cache[i];
      var qc = entry.query;

      if ( qc.q == qr.q ) {
	if ( qc.offset + entry.matches.length == qr.offset ) {
	  for(var i=0; i<result.matches.length; i++)
	    entry.matches.push(result.matches[i]);
	  return;
	}
      }
    }

    cache.push(result);
  }

  /**
   * List available sources.
   *
   * @class sourcelist
   * @tutorial jquery-doc
   * @memberOf $.fn
   * @param {String|Object} [method] Either a method name or the jQuery
   * plugin initialization object.
   * @param [...] Zero or more arguments passed to the jQuery `method`
   */

  $.fn.sourcelist = function(method) {
    if ( methods[method] ) {
      return methods[method]
	.apply(this, Array.prototype.slice.call(arguments, 1));
    } else if ( typeof method === 'object' || !method ) {
      return methods._init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.' + pluginName);
    }
  };
}(jQuery));
});