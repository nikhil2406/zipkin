'use strict';

define(
  [
    'flight/lib/component'
  ],

  function (defineComponent) {

    return defineComponent(trace);

    function trace() {
      this.spans = {};
      this.spansBackup = {};
      this.parents = {};
      this.children = {};
      this.spansByService = {};

      this.setupSpan = function($span) {
        var self = this;
        var id = $span.data('id');

        $span.id = id;
        $span.expanded = false;
        $span.$expander = $span.find('.expander');
        $span.inFilters = 0;
        $span.openChildren = 0;
        $span.openParents = 0;
        this.spans[id] = $span;

        var children = ($span.data('children') || "").toString().split(',');
        if (children.length == 1 && children[0] === "") {
          $span.find('.expander').hide();
          children = [];
        }
        this.children[id] = children;

        var parentId = $span.data('parentId');
        $span.isRoot = !(parentId !== undefined && parentId !== "");
        this.parents[id] = !$span.isRoot ? [parentId] : [];
        $.merge(this.parents[id], this.parents[parentId] || []);

        $.each(($span.data('serviceNames') || "").split(','), function(i, sn) {
          var spans = self.spansByService[sn] || [];
          spans.push(id);
          self.spansByService[sn] = spans;
        });
      };

      /*This method stores original span details for later use.
       * When span view is zoomed in and zoomed out these details help to
       * get back to original span view*/
      this.setupRedrawSpan = function($span) {
          var id = $span.data('id');

          $span.id = id;
          this.spansBackup[id] = $span;
        };

      
      
      this.getSpansByService = function(svc) {
        var spans = this.spansByService[svc];
        if (spans === undefined)
          this.spansByService[svc] = spans = $();
        else if (spans.jquery === undefined)
          this.spansByService[svc] = spans = $('#' + spans.join(',#'));
        return spans;
      };

      this.filterAdded = function(e, data) {
        if (this.actingOnAll) return;
        var self = this;
        var spans = this.getSpansByService(data.value).map(function() {
          return self.spans[$(this).data('id')];
        });
        this.expandSpans(spans);
      };

      this.expandSpans = function(spans) {
        var self = this,
            toShow = {};
        $.each(spans, function(i, $span) {
          if ($span.inFilters == 0)
            $span.show().addClass('highlight');
          $span.expanded = true;
          $span.$expander.text('-');
          $span.inFilters += 1;

          $.each(self.children[$span.id], function(i, cId) { toShow[cId] = true; self.spans[cId].openParents += 1; });
          $.each(self.parents[$span.id], function(i, pId) { toShow[pId] = true; self.spans[pId].openChildren += 1; });
        });

        $.each(toShow, function(id, n) { self.spans[id].show(); });
      };

      this.filterRemoved = function(e, data) {
        if (this.actingOnAll) return;
        var self = this;
        var spans = this.getSpansByService(data.value).map(function() {
          return self.spans[$(this).data('id')];
        });
        this.collapseSpans(spans);
      };

      this.collapseSpans = function(spans, childrenOnly) {
        var self = this,
            toHide = {};

        $.each(spans, function(i, $span) {
          $span.inFilters -= 1;
          if (!childrenOnly && $span.inFilters == 0) {
            $span.removeClass('highlight');
            self.hideSpan($span);
          }

          $span.expanded = false;
          $span.$expander.text('+');

          $.each(self.children[$span.id], function(i, cId) { toHide[cId] = true; self.spans[cId].openParents -= 1; });
          if (!childrenOnly)
            $.each(self.parents[$span.id], function(i, pId) { toHide[pId] = true; self.spans[pId].openChildren -= 1; });
        });

        $.each(toHide, function(id, n) { self.hideSpan(self.spans[id]); });
      };

      this.hideSpan = function($span) {
        if ($span.inFilters > 0 || $span.openChildren > 0 || $span.openParents > 0) return;
        $span.hide();
      };

      this.handleClick = function(e) {
        var $target = $(e.target);
        var $span = this.spans[($target.is('.span') ? $target : $target.parents('.span')).data('id')];

        var $expander = $target.is('.expander') ? $target : $target.parents('.expander');
        if ($expander.length > 0) {
          this.toggleExpander($span);
          return;
        }

        if ($span.length > 0) {
          this.showSpanDetails($span);
          return;
        }
      };

      this.toggleExpander = function($span) {
        if ($span.expanded)
          this.collapseSpans([$span], true);
        else
          this.expandSpans([$span], true);
      };

      this.showSpanDetails = function($span) {
        var spanData = {
          annotations: [],
          binaryAnnotations: []
        };

        $.each($span.data('keys').split(','), function(i, n) {
          spanData[n] = $span.data(n);
        });

        $span.find('.annotation').each(function() {
          var $this = $(this);
          var anno = {};
          $.each($this.data('keys').split(','), function(e, n) {
            anno[n] = $this.data(n);
          });
          spanData.annotations.push(anno);
        });

        $span.find('.binary-annotation').each(function() {
          var $this = $(this);
          var anno = {};
          $.each($this.data('keys').split(','), function(e, n) {
            anno[n] = $this.data(n);
          });
          spanData.binaryAnnotations.push(anno);
        });

        this.trigger('uiRequestSpanPanel', spanData);
      };

      this.showSpinnerAround = function(cb, e, data) {
        if (this.actingOnAll) return cb(e, data);

        this.trigger(document, 'uiShowFullPageSpinner');
        var self = this;
        setTimeout(function() {
          cb(e, data);
          self.trigger(document, 'uiHideFullPageSpinner');
        }, 100);
      };

      this.triggerForAllServices = function(evt) {
        var self = this;
        $.each(self.spansByService, function(sn, s) { self.trigger(document, evt, {value: sn}); });
      };

      this.expandAllSpans = function() {
        var self = this;
        self.actingOnAll = true;
        this.showSpinnerAround(function() {
          $.each(self.spans, function(id, $span) {
            $span.inFilters = 0;
            $span.show().addClass('highlight');
            $span.expanded = true;
            $span.$expander.text('-');
            $.each(self.children[id], function(i, cId) { self.spans[cId].openParents += 1; });
            $.each(self.parents[id], function(i, pId) { self.spans[pId].openChildren += 1; });
          });
          $.each(self.spansByService, function(svc, spans) {
            $.each(spans, function(i, $span) { $span.inFilters += 1; });
          });
          self.triggerForAllServices('uiAddServiceNameFilter');
        });
        self.actingOnAll = false;
      };

      this.collapseAllSpans = function() {
        var self = this;
        self.actingOnAll = true;
        this.showSpinnerAround(function() {
          $.each(self.spans, function(id, $span) {
            $span.inFilters = 0;
            $span.openParents = 0;
            $span.openChildren = 0;
            $span.removeClass('highlight');
            $span.expanded = false;
            $span.$expander.text('+');
            if (!$span.isRoot) $span.hide();
          });
          self.triggerForAllServices('uiRemoveServiceNameFilter');
        });
        self.actingOnAll = false;
      };

      /*This method modifies the span container view. It zooms in the span view on selected time zone.
       * Spans starting with in the selected time zone are highlighted with span name in red color.
       * Also unhides zoomout button so that user can go back to original span view*/
      this.zoomInSpans = function() {
    	  var self = this;

    	  var originalDuration = parseFloat($('#timeLabel-redraw .time-marker-5').text());
    	  var mintime = parseFloat($('#minTime').val());
    	  var maxtime = parseFloat($('#maxTime').val());
    	  var newDuration = maxtime - mintime;

    	  this.$node.find('#timeLabel .time-marker').each(function(i) {
    		  var v = (mintime + newDuration * (i/5)).toFixed(2);
    		  $(this).text(v+"ms");
    	  });
    	  
    	  var styles = {
    		  left : "0.0%",
    		  width: "100.0%",
    		  color: "#000"
    	  };
          this.showSpinnerAround(function() {
            $.each(self.spans, function(id, $span) {
            	/*corresponding to this id extract span from backupspans list*/
            	var origLeftVal = parseFloat((self.spansBackup[id]).find('.duration')[0].style.left);
            	var origWidthVal = parseFloat((self.spansBackup[id]).find('.duration')[0].style.width);
            	var spanStart = (origLeftVal*originalDuration)/100;
            	var spanEnd = spanStart + (origWidthVal*originalDuration)/100;
            	/*reset the color to black. It gets set for inrange spans to red*/
            	styles.color = "#000";
            	
            	/*change style left, width and color of new spans based on mintime and maxtime*/
    			if(spanStart < mintime && spanEnd < mintime) {
    				styles.left = "0.0%"; styles.width = "0.0%";
    			} else if (spanStart < mintime && spanEnd > mintime && spanEnd < maxtime) {
    				var w = (((spanEnd - mintime))/newDuration) * 100 + "%";
    				styles.left = "0.0%"; styles.width = w;
    			} else if (spanStart < mintime && spanEnd > mintime && spanEnd > maxtime) {
    				styles.left = "0.0%"; styles.width = "100.0%";
    			} else if (spanStart >= mintime && spanStart < maxtime && spanEnd <= maxtime) {
    				var l = (((spanStart - mintime))/newDuration) * 100 + "%";
    				var w = (((spanEnd - spanStart))/newDuration) * 100 + "%";
    				styles.left = l; styles.width = w; styles.color = "#d9534f";
    			} else if (spanStart >= mintime && spanStart < maxtime && spanEnd > maxtime) {
    				var l = (((spanStart - mintime))/newDuration) * 100 + "%";
    				var w = (((maxtime - spanStart))/newDuration) * 100 + "%";
    				styles.left = l; styles.width = w; styles.color = "#d9534f";
    			} else if (spanStart > maxtime) {
    				styles.left = "100.0%"; styles.width = "0.0%";
    			} else if (spanStart == maxtime) {
    				styles.left = "100.0%"; styles.width = "0.0%"; styles.color = "#d9534f";
    			} else {
    				styles.left = "0.0%"; styles.width = "0.0%";
    			}

    			$span.find('.duration').css('left', styles.left);
    			$span.find('.duration').css('width', styles.width);
    			$span.find('.duration').css('color', styles.color);
            });

          });
          
          /*show zoomOut button now*/
    	  $('button[value=uiZoomOutSpans]').removeClass("hidden");
          
        };

        /*This method brings back the original span container in view*/
        this.zoomOutSpans = function() {
      	  var originalDuration = parseInt($('#timeLabel-redraw .time-marker-5').text(), 10);

      	  this.$node.find('#timeLabel .time-marker').each(function(i) {
      		  var v = (originalDuration * (i/5)).toFixed(2);
      		  $(this).text(v+"ms");
      	  });
      	  
      	  var self = this;
          this.showSpinnerAround(function() {
            $.each(self.spans, function(id, $span) {
              var originalStyle = $("#trace-container-redraw" + " #"+id +' .duration').attr('style');
              $span.find('.duration').attr('style', originalStyle);
            });

          });
          /*hide zoomOut button now*/
    	  $('button[value=uiZoomOutSpans]').addClass("hidden");
        };

        
      this.after('initialize', function() {
        this.around('filterAdded', this.showSpinnerAround);
        this.around('filterRemoved', this.showSpinnerAround);

        this.on('click', this.handleClick);
        this.on(document, 'uiAddServiceNameFilter', this.filterAdded);
        this.on(document, 'uiRemoveServiceNameFilter', this.filterRemoved);

        this.on(document, 'uiExpandAllSpans', this.expandAllSpans);
        this.on(document, 'uiCollapseAllSpans', this.collapseAllSpans);
        this.on(document, 'uiZoomInSpans', this.zoomInSpans);
        this.on(document, 'uiZoomOutSpans', this.zoomOutSpans);

        var self = this;
        self.$node.find('.span:not(#timeLabel)').each(function() { self.setupSpan($(this)); });
        /*get spans from trace-container-redraw*/
        $('#trace-container-redraw .span:not(#timeLabel-redraw)').each(function() { self.setupRedrawSpan($(this)); });

        var serviceName = $.getUrlVar('serviceName');
        if (serviceName !== undefined)
          this.trigger(document, 'uiAddServiceNameFilter', {value: serviceName});
        else
          this.expandSpans([this.spans[this.$node.find('.span:nth(1)').data('id')]]);
      });
    };
  }
)
