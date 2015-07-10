'use strict';

define(
  [
    'flight/lib/component'
  ],

  function (defineComponent) {

    return defineComponent(toTop);

    function toTop() {
	    this.duration = 300;

      this.backToTop = function(e) {
	        event.preventDefault();
	        $('html, body').animate({scrollTop: 0}, this.duration);
	        return false;
      };

      this.after('initialize', function() {
//    	  $(window).scroll(function() {
//  	        if ($(this).scrollTop() > this.offset) {
//  	        	$('.back-to-top').fadeIn(this.duration);
//  	        } else {
//  	        	$('.back-to-top').fadeOut(this.duration);
//  	        }
//  	    });

    	this.on('click', this.backToTop);
      });
    }
  }

);
