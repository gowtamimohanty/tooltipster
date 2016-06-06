/**
 * tooltipster http://iamceege.github.io/tooltipster/
 * A rockin' custom tooltip jQuery plugin
 * Developed by Caleb Jacob and Louis Ameline
 * MIT license
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module unless amdModuleId is set
    define(["jQuery"], function (a0) {
      return (factory(a0));
    });
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require("jQuery"));
  } else {
    factory(jQuery);
  }
}(this, function ($) {

// This file will be UMDified by a build task.

var defaults = {
		animation: 'fade',
		animationDuration: 350,
		content: null,
		contentAsHTML: false,
		contentCloning: false,
		debug: true,
		delay: 300,
		delayTouch: [300, 500],
		functionInit: null,
		functionBefore: null,
		functionReady: null,
		functionAfter: null,
		functionFormat: null,
		IEmin: 6,
		interactive: false,
		multiple: false,
		// must be 'body' for now, or an element positioned at (0, 0)
		// in the document, typically like the very top views of an app.
		parent: 'body',
		plugins: ['tooltipster.sideTip'],
		repositionOnScroll: false,
		restoration: 'none',
		selfDestruction: true,
		theme: [],
		timer: 0,
		trackerInterval: 500,
		trackOrigin: false,
		trackTooltip: false,
		trigger: 'hover',
		triggerClose: {
			click: false,
			mouseleave: false,
			originClick: false,
			scroll: false,
			tap: false,
			touchleave: false
		},
		triggerOpen: {
			click: false,
			mouseenter: false,
			tap: false,
			touchstart: false
		},
		updateAnimation: 'rotate',
		zIndex: 9999999
	},
	// we'll avoid using window as a global. To run in Node,
	// window must be mocked up through $.tooltipster._setWindow
	win = (window !== undefined) ? window : null,
	// env will be proxied by the core for plugins to have access its properties
	env = {
		// this is a function because a mouse may be plugged at any time, we
		// need to re-evaluate every time
		deviceIsPureTouch: function() {
			return (!env.deviceHasMouse && env.deviceHasTouchCapability);
		},
		deviceHasMouse: false,
		// detect if this device can trigger touch events. Better have a false
		// positive (unused listeners, that's ok) than a false negative.
		// https://github.com/Modernizr/Modernizr/blob/master/feature-detects/touchevents.js
		// http://stackoverflow.com/questions/4817029/whats-the-best-way-to-detect-a-touch-screen-device-using-javascript
		deviceHasTouchCapability: !!(
				'ontouchstart' in win
			||	(win.DocumentTouch && document instanceof DocumentTouch)
			||	navigator.maxTouchPoints
		),
		IE: false,
		// don't set manually, it will be updated by a build task after the manifest
		semVer: '4.0.0rc48',
		window: win
	},
	core = function() {
		
		// core variables
		
		// the core emitter
		this.$emitter = $({});
		// proxy env variables for plugins who might use them
		this.env = env;
		this.instancesLatestArr = [];
		// collects plugins in their bare object form
		this.plugins = {};
	};

// core methods
core.prototype = {
	/**
	 * A function to proxy the methods of an object onto another
	 *
	 * @param {object} methods List of methods to proxy
	 * @param {object} obj The original object that holds the methods
	 * @param {object} proxy The object that will get new methods
	 * @param {string} ref A plugin name for the console log message
	 */
	_bridge: function(methods, obj, proxy, ref) {
		
		$.each(methods, function(methodName, fn) {
			
			if (methodName.charAt(0) != '_') {
				
				// if the method does not exist yet
				if (!proxy[methodName]) {
					
					proxy[methodName] = function() {
						fn.apply(obj, Array.prototype.slice.apply(arguments));
						return proxy;
					};
				}
				else if (defaults.debug) {
					
					console.log('The '+ methodName +' method of the '+ ref
						+' plugin conflicts with another plugin or native methods');
				}
			}
		});
	},
	/**
	 * Returns a ruler, a tool to help measure the size of a tooltip under
	 * various settings. Meant for plugins
	 * 
	 * @see Ruler
	 */
	_getRuler: function($tooltip) {
		return new Ruler($tooltip);
	},
	/**
	 * For mockup in Node env if need be
	 */
	_setWindow: function(window) {
		env.window = window;
	},
	/**
	 * Returns instances of all tooltips in the page or an a given element
	 *
	 * @param {string|HTML object collection} selector optional Use this
	 * parameter to restrict the set of objects that will be inspected
	 * for the retrieval of instances. By default, all instances in the
	 * page are returned.
	 * @return {array}
	 */
	instances: function(selector) {
		
		var instances = [],
			sel = selector || '.tooltipstered';
		
		$(sel).each(function() {
			
			var $this = $(this),
				ns = $this.data('tooltipster-ns');
			
			if (ns) {
				
				$.each(ns, function(i, namespace) {
					instances.push($this.data(namespace));
				});
			}
		});
		
		return instances;
	},
	/**
	 * Returns the Tooltipster objects generated by the last initializing call
	 *
	 * @return {array}
	 */
	instancesLatest: function() {
		return this.instancesLatestArr;
	},
	off: function() {
		this.$emitter.off.apply(this.$emitter, Array.prototype.slice.apply(arguments));
		return this;
	},
	on: function() {
		this.$emitter.on.apply(this.$emitter, Array.prototype.slice.apply(arguments));
		return this;
	},
	one: function() {
		this.$emitter.one.apply(this.$emitter, Array.prototype.slice.apply(arguments));
		return this;
	},
	/**
	 * Returns all HTML elements which have one or more tooltips
	 *
	 * @param {string} selector optional Use this to restrict the results
	 * to the descendants of an element
	 */
	origins: function(selector) {
		
		var sel = selector ?
		selector +' ' :
			'';
		
		return $(sel +'.tooltipstered').toArray();
	},
	/**
	 * Returns (getter) or adds (setter) a plugin
	 * 
	 * @param {string|object} plugin Provide a string (in the full form
	 * "namespace.name") to use as as getter, an object to use as a setter
	 * @return {object|self}
	 */
	plugin: function(plugin) {
		
		var self = this;
		
		// getter
		if (typeof plugin == 'string') {
			
			var pluginName = plugin,
				p = null;
			
			// if the namespace is provided, it's easy to search
			if (pluginName.indexOf('.') > 0) {
				p = self.plugins[pluginName];
			}
			// otherwise, return the first name that matches
			else {
				$.each(self.plugins, function(i, plugin) {
					
					if (plugin.name.substring(plugin.name.length - pluginName.length - 1) == '.'+ pluginName) {
						p = plugin;
						return false;
					}
				});
			}
			
			return p;
		}
		// setter
		else {
			
			// force namespaces
			if (plugin.name.indexOf('.') < 0) {
				throw new Error('Plugins must be namespaced');
			}
			
			self.plugins[plugin.name] = plugin;
			
			// if the plugin has core features
			if (plugin.core) {
				
				// instantiate at core level
				var fn = function() {};
				fn.prototype = plugin.core;
				
				var p = new fn();
				
				self[plugin.name] = p;
				
				if (p._init) {
					p._init(self);
				}
				
				// proxy public methods on the core to allow new core methods
				self._bridge(plugin.core, p, self, plugin.name);
			}
			
			return this;
		}
	},
	/**
	 * Change default options for all future instances
	 *
	 * @param {object} d
	 * @return {boolean}
	 */
	setDefaults: function(d) {
		$.extend(defaults, d);
		return true;
	},
	triggerHandler: function() {
		this.$emitter.triggerHandler.apply(this.$emitter, Array.prototype.slice.apply(arguments));
		return this;
	},
	version: function() {
		return semVer;
	}
};

// $.tooltipster will be used to call core methods
$.tooltipster = new core();

// the Tooltipster instance class (mind the capital T)
$.Tooltipster = function(element, options) {
	
	// list of instance variables
	
	// stack of custom callbacks provided as parameters to API methods
	this.callbacks = {
		close: [],
		open: []
	};
	// the schedule time of DOM removal
	this.closingTime;
	// this will be the user content shown in the tooltip. A capital "C" is used
	// because there is also a method called content()
	this.Content;
	// for the size tracker
	this.contentBcr;
	// to disable the tooltip once the destruction has begun
	this.destroyed = false;
	this.destroying = false;
	// we can't emit directly on the instance because if a method with the same
	// name as the event exists, it will be called by jQuery. Se we use a plain
	// object as emitter. This emitter is for internal use by plugins,
	// if needed.
	this.$emitterPrivate = $({});
	// this emitter is for the user to listen to events without risking to mess
	// with our internal listeners
	this.$emitterPublic = $({});
	this.enabled = true;
	// the reference to the gc interval
	this.garbageCollector;
	// various position and size data recomputed before each repositioning
	this.geometry;
	this.pointerIsOverOrigin = true;
	// a unique namespace per instance
	this.namespace = 'tooltipster-'+ Math.round(Math.random()*100000);
	this.options;
	// the element to which this tooltip is associated
	this.$origin;
	// will be used to support origins in scrollable areas
	this.$originParents;
	// to remove themes if needed
	this.previousThemes = [];
	// the state can be either: appearing, stable, disappearing, closed
	this.state = 'closed';
	// timeout references
	this.timeouts = {
		close: [],
		open: null
	};
	// this will be the tooltip element (jQuery wrapped HTML element).
	// It's the job of a plugin to create it and append it to the DOM
	this.$tooltip;
	// store touch events to be able to detect emulated mouse events
	this.touchEvents = [];
	// the reference to the tracker interval
	this.tracker = null;
	// the tooltip left/top coordinates, saved after each repositioning
	this.tooltipCoord;
	
	// launch
	this._init(element, options);
};

$.Tooltipster.prototype = {
	
	_init: function(element, options) {
		
		var self = this;
		
		self.$origin = $(element);
		self.options = $.extend(true, {}, defaults, options);
		
		// some options may need to be reformatted
		self._optionsFormat();
		
		// don't run on old IE if asked no to
		if (	!env.IE
			||	env.IE >= self.options.IEmin
		) {
			
			// note: the content is null (empty) by default and can stay that
			// way if the plugin remains initialized but not fed any content. The
			// tooltip will just not appear.
			
			// let's save the initial value of the title attribute for later
			// restoration if need be.
			var initialTitle = null;
			
			// it will already have been saved in case of multiple tooltips
			if (self.$origin.data('tooltipster-initialTitle') === undefined) {
				
				initialTitle = self.$origin.attr('title');
				
				// we do not want initialTitle to be "undefined" because
				// of how jQuery's .data() method works
				if (initialTitle === undefined) initialTitle = null;
				
				self.$origin.data('tooltipster-initialTitle', initialTitle);
			}
			
			// If content is provided in the options, it has precedence over the
			// title attribute.
			// Note: an empty string is considered content, only 'null' represents
			// the absence of content.
			// Also, an existing title="" attribute will result in an empty string
			// content
			if (self.options.content !== null) {
				self._contentSet(self.options.content);
			}
			else {
				self._contentSet(initialTitle);
			}
			
			self.$origin
				// strip the title off of the element to prevent the default tooltips
				// from popping up
				.removeAttr('title')
				// to be able to find all instances on the page later (upon window
				// events in particular)
				.addClass('tooltipstered');
			
			// set listeners on the origin
			self._prepareOrigin();
			
			// set the garbage collector
			self._prepareGC();
			
			// init plugins
			$.each(self.options.plugins, function(i, pluginName) {
				self._plugin(pluginName);
			});
			
			// to detect swiping
			if (env.deviceHasTouchCapability) {
				$('body').on('touchmove.'+ self.namespace +'-triggerOpen', function(event) {
					self._touchRecordEvent(event);
				});
			}
			
			self
				// prepare the tooltip when it gets created. This event must
				// be fired by a plugin
				._on('created', function() {
					self._prepareTooltip();
				})
				// save position information when it's sent by a plugin
				._on('repositioned', function(e) {
					self.tooltipCoord = e.position;
				});
		}
		else {
			self.options.disabled = true;
		}
	},
	
	_close: function(event, callback) {
		
		var self = this,
			ok = true;
		
		self._trigger({
			type: 'close',
			event: event,
			stop: function() {
				ok = false;
			}
		});
		
		// a destroying tooltip may not refuse to close
		if (ok || self.destroying) {
			
			// save the method custom callback and cancel any open method custom callbacks
			if (callback) self.callbacks.close.push(callback);
			self.callbacks.open = [];
			
			// clear open/close timeouts
			self._timeoutsClear();
			
			var finishCallbacks = function() {
				
				// trigger any close method custom callbacks and reset them
				$.each(self.callbacks.close, function(i,c) {
					c.call(self, self, {
						event: event,
						origin: self.$origin[0]
					});
				});
				
				self.callbacks.close = [];
			};
			
			if (self.state != 'closed') {
				
				var necessary = true,
					d = new Date(),
					now = d.getTime(),
					newClosingTime = now + self.options.animationDuration[1];
				
				// the tooltip may already already be disappearing, but if a new
				// call to close() is made after the animationDuration was changed
				// to 0 (for example), we ought to actually close it sooner than
				// previously scheduled. In that case it should be noted that the
				// browser will not adapt the animation duration to the new
				// animationDuration that was set after the start of the closing
				// animation.
				// Note: the same thing could be considered at opening, but is not
				// really useful since the tooltip is actually opened immediately
				// upon a call to _openNow(). Since it would not make the opening
				// animation finish sooner, its sole impact would be to trigger the
				// state event and the open callbacks sooner than the actual end of
				// the opening animation, which is not great.
				if (self.state == 'disappearing') {
					
					if (newClosingTime > self.closingTime) {
						necessary = false;
					}
				}
				
				if (necessary) {
					
					self.closingTime = newClosingTime;
					
					if (self.state != 'disappearing') {
						self._stateSet('disappearing');
					}
					
					var finish = function() {
						
						// stop the tracker
						clearInterval(self.tracker);
						
						// a "beforeClose" option has been asked several times but would
						// probably useless since the content element is still accessible
						// via ::content(), and because people can always use listeners
						// inside their content to track what's going on. For the sake of
						// simplicity, this has been denied. Bur for the rare people who
						// really need the option (for old browsers or for the case where
						// detaching the content is actually destructive, for file or
						// password inputs for example), this event will do the work.
						self._trigger({
							type: 'closing',
							event: event
						});
						
						// unbind listeners which are no longer needed
						
						self.$tooltip
							.off('.'+ self.namespace +'-triggerClose')
							.removeClass('tooltipster-dying');
						
						// orientationchange, scroll and resize listeners
						$(env.window).off('.'+ self.namespace +'-triggerClose');
						
						// scroll listeners
						self.$originParents.each(function(i, el) {
							$(el).off('scroll.'+ self.namespace +'-triggerClose');
						});
						// clear the array to prevent memory leaks
						self.$originParents = null;
						
						$('body').off('.'+ self.namespace +'-triggerClose');
						
						self.$origin.off('.'+ self.namespace +'-triggerClose');
						
						self._off('dismissable');
						
						// a plugin that would like to remove the tooltip from the
						// DOM when closed should bind on this
						self._stateSet('closed');
						
						// trigger event
						self._trigger({
							type: 'after',
							event: event
						});
						
						// call our constructor custom callback function
						if (self.options.functionAfter) {
							self.options.functionAfter.call(self, self, {
								event: event
							});
						}
						
						// call our method custom callbacks functions
						finishCallbacks();
					};
					
					if (supportsTransitions()) {
						
						self.$tooltip.css({
							'-moz-animation-duration': self.options.animationDuration[1] + 'ms',
							'-ms-animation-duration': self.options.animationDuration[1] + 'ms',
							'-o-animation-duration': self.options.animationDuration[1] + 'ms',
							'-webkit-animation-duration': self.options.animationDuration[1] + 'ms',
							'animation-duration': self.options.animationDuration[1] + 'ms',
							'transition-duration': self.options.animationDuration[1] + 'ms'
						});
						
						self.$tooltip
							// clear both potential open and close tasks
							.clearQueue()
							.removeClass('tooltipster-show')
							// for transitions only
							.addClass('tooltipster-dying');
						
						if (self.options.animationDuration[1] > 0) {
							self.$tooltip.delay(self.options.animationDuration[1]);
						}
						
						self.$tooltip.queue(finish);
					}
					else {
						
						self.$tooltip
							.stop()
							.fadeOut(self.options.animationDuration[1], finish);
					}
				}
			}
			// if the tooltip is already closed, we still need to trigger
			// the method custom callbacks
			else {
				finishCallbacks();
			}
		}
		
		return self;
	},
	
	_contentInsert: function() {
		
		var self = this,
			$el = self.$tooltip.find('.tooltipster-content'),
			formattedContent = self.Content,
			format = function(content) {
				formattedContent = content;
			};
		
		self._trigger({
			type: 'format',
			content: self.Content,
			format: format
		});
		
		if (self.options.functionFormat) {
			
			formattedContent = self.options.functionFormat.call(
				self,
				self,
				{
					origin: self.$origin[0]
				},
				self.Content
			);
		}
		
		if (typeof formattedContent === 'string' && !self.options.contentAsHTML) {
			$el.text(formattedContent);
		}
		else {
			$el
				.empty()
				.append(formattedContent);
		}
	},
	
	_contentSet: function(content) {
		
		// clone if asked. Cloning the object makes sure that each instance has its
		// own version of the content (in case a same object were provided for several
		// instances)
		// reminder: typeof null === object
		if (content instanceof $ && this.options.contentCloning) {
			content = content.clone(true);
		}
		
		this.Content = content;
		
		this._trigger({
			type: 'updated',
			content: content
		});
	},
	
	_destroyError: function() {
		throw new Error('This tooltip has been destroyed and cannot execute your method call.');
	},
	
	/**
	 * Gather all information about dimensions and available space
	 */
	_geometry: function() {
		
		var	self = this,
			$target = self.$origin,
			originIsArea = self.$origin.is('area');
		
		// if this.$origin is a map area, the target we'll need
		// the dimensions of is actually the image using the map,
		// not the area itself
		if (originIsArea) {
			
			var mapName = self.$origin.parent().attr('name');
			
			$target = $('img[usemap="#'+ mapName +'"]');
		}
		
		var bcr = $target[0].getBoundingClientRect(),
			$document = $(env.window.document),
			$window = $(env.window),
			$parent = $target,
			// some useful properties of important elements
			geo = {
				// available space for the tooltip, see down below
				available: {
					document: null,
					window: null
				},
				document: {
					size: {
						height: $document.height(),
						width: $document.width()
					}
				},
				window: {
					scroll: {
						// the second ones are for IE compatibility
						left: env.window.scrollX || env.window.document.documentElement.scrollLeft,
						top: env.window.scrollY || env.window.document.documentElement.scrollTop
					},
					size: {
						height: $window.height(),
						width: $window.width()
					}
				},
				origin: {
					// the origin has a fixed lineage if itself or one of its
					// ancestors has a fixed position
					fixedLineage: false,
					// relative to the document
					offset: {},
					size: {
						height: bcr.bottom - bcr.top,
						width: bcr.right - bcr.left
					},
					usemapImage: originIsArea ? $target[0] : null,
					// relative to the window
					windowOffset: {
						bottom: bcr.bottom,
						left: bcr.left,
						right: bcr.right,
						top: bcr.top
					}
				}
			},
			geoFixed = false;
		
		// if the element is a map area, some properties may need
		// to be recalculated
		if (originIsArea) {
			
			var shape = self.$origin.attr('shape'),
				coords = self.$origin.attr('coords');
			
			if (coords) {
				
				coords = coords.split(',');
				
				$.map(coords, function(val, i) {
					coords[i] = parseInt(val);
				});
			}
			
			// if the image itself is the area, nothing more to do
			if (shape != 'default') {
				
				switch(shape) {
					
					case 'circle':
						
						var circleCenterLeft = coords[0],
							circleCenterTop = coords[1],
							circleRadius = coords[2],
							areaTopOffset = circleCenterTop - circleRadius,
							areaLeftOffset = circleCenterLeft - circleRadius;
						
						geo.origin.size.height = circleRadius * 2;
						geo.origin.size.width = geo.origin.size.height;
						
						geo.origin.windowOffset.left += areaLeftOffset;
						geo.origin.windowOffset.top += areaTopOffset;
						
						break;
					
					case 'rect':
						
						var areaLeft = coords[0],
							areaTop = coords[1],
							areaRight = coords[2],
							areaBottom = coords[3];
						
						geo.origin.size.height = areaBottom - areaTop;
						geo.origin.size.width = areaRight - areaLeft;
						
						geo.origin.windowOffset.left += areaLeft;
						geo.origin.windowOffset.top += areaTop;
						
						break;
					
					case 'poly':
						
						var areaSmallestX = 0,
							areaSmallestY = 0,
							areaGreatestX = 0,
							areaGreatestY = 0,
							arrayAlternate = 'even';
						
						for (var i = 0; i < coords.length; i++) {
							
							var areaNumber = coords[i];
							
							if (arrayAlternate == 'even') {
								
								if (areaNumber > areaGreatestX) {
									
									areaGreatestX = areaNumber;
									
									if (i === 0) {
										areaSmallestX = areaGreatestX;
									}
								}
								
								if (areaNumber < areaSmallestX) {
									areaSmallestX = areaNumber;
								}
								
								arrayAlternate = 'odd';
							}
							else {
								if (areaNumber > areaGreatestY) {
									
									areaGreatestY = areaNumber;
									
									if (i == 1) {
										areaSmallestY = areaGreatestY;
									}
								}
								
								if (areaNumber < areaSmallestY) {
									areaSmallestY = areaNumber;
								}
								
								arrayAlternate = 'even';
							}
						}
						
						geo.origin.size.height = areaGreatestY - areaSmallestY;
						geo.origin.size.width = areaGreatestX - areaSmallestX;
						
						geo.origin.windowOffset.left += areaSmallestX;
						geo.origin.windowOffset.top += areaSmallestY;
						
						break;
				}
			}
		}
		
		// user callback through an event
		var edit = function(r) {
			geo.origin.size.height = r.height,
			geo.origin.windowOffset.left = r.left,
			geo.origin.windowOffset.top = r.top,
			geo.origin.size.width = r.width
		};
		
		self._trigger({
			type: 'geometry',
			edit: edit,
			geometry: {
				height: geo.origin.size.height,
				left: geo.origin.windowOffset.left,
				top: geo.origin.windowOffset.top,
				width: geo.origin.size.width
			}
		});
		
		// calculate the remaining properties with what we got
		
		geo.origin.windowOffset.right = geo.origin.windowOffset.left + geo.origin.size.width;
		geo.origin.windowOffset.bottom = geo.origin.windowOffset.top + geo.origin.size.height;
		
		geo.origin.offset.left = geo.origin.windowOffset.left + env.window.scrollX;
		geo.origin.offset.top = geo.origin.windowOffset.top + env.window.scrollY;
		geo.origin.offset.bottom = geo.origin.offset.top + geo.origin.size.height;
		geo.origin.offset.right = geo.origin.offset.left + geo.origin.size.width;
		
		// the space that is available to display the tooltip relatively to the document
		geo.available.document = {
			bottom: {
				height: geo.document.size.height - geo.origin.offset.bottom,
				width: geo.document.size.width
			},
			left: {
				height: geo.document.size.height,
				width: geo.origin.offset.left
			},
			right: {
				height: geo.document.size.height,
				width: geo.document.size.width - geo.origin.offset.right
			},
			top: {
				height: geo.origin.offset.top,
				width: geo.document.size.width
			}
		};
		
		// the space that is available to display the tooltip relatively to the viewport
		// (the resulting values may be negative if the origin overflows the viewport)
		geo.available.window = {
			bottom: {
				// the inner max is here to make sure the available height is no bigger
				// than the viewport height (when the origin is off screen at the top).
				// The outer max just makes sure that the height is not negative (when
				// the origin overflows at the bottom).
				height: Math.max(geo.window.size.height - Math.max(geo.origin.windowOffset.bottom, 0), 0),
				width: geo.window.size.width
			},
			left: {
				height: geo.window.size.height,
				width: Math.max(geo.origin.windowOffset.left, 0)
			},
			right: {
				height: geo.window.size.height,
				width: Math.max(geo.window.size.width - Math.max(geo.origin.windowOffset.right, 0), 0)
			},
			top: {
				height: Math.max(geo.origin.windowOffset.top, 0),
				width: geo.window.size.width
			}
		};
		
		/*
		if (	geo.origin.offset.bottom <= geo.window.scroll.top
			||	geo.origin.offset.left >= geo.window.scroll.left + geo.window.size.width
			||	geo.origin.offset.top >= geo.window.scroll.top + geo.window.size.height
			||	geo.origin.offset.right <= geo.window.scroll.left
		) {
			geo.origin.offScreen = true;
		}
		
		if (	geo.origin.offScreen == false
			&&	geo.available.window.top.height == 0
			&&	geo.available.window.right.width == 0
			&&	geo.available.window.bottom.height == 0
			&&	geo.available.window.left.width == 0
		) {
			geo.origin.fullScreen = true;
		}
		*/
		
		while ($parent[0].tagName.toLowerCase() != 'html') {
			
			if ($parent.css('position') == 'fixed') {
				geo.origin.fixedLineage = true;
				break;
			}
			
			$parent = $parent.parent();
		}
		
		return geo;
	},
	
	/**
	 * For internal use by plugins, if needed
	 */
	_off: function() {
		this.$emitterPrivate.off.apply(this.$emitterPrivate, Array.prototype.slice.apply(arguments));
		return this;
	},
	
	/**
	 * For internal use by plugins, if needed
	 */
	_on: function() {
		this.$emitterPrivate.on.apply(this.$emitterPrivate, Array.prototype.slice.apply(arguments));
		return this;
	},
	
	// when using the mouseenter/touchstart open triggers, this function will schedule the
	// opening of the tooltip after the delay, if there is one
	_open: function(event) {
		
		var self = this,
			ok = true;
		
		if (self.state != 'stable' && self.state != 'appearing') {
			
			self._trigger({
				type: 'start',
				event: event,
				stop: function() {
					ok = false;
				}
			});
			
			if (ok) {
				
				var delay = (event.type.indexOf('touch') == 0) ?
					self.options.delayTouch :
					self.options.delay;
				
				if (delay[0]) {
					
					self.timeouts.open = setTimeout(function() {
						// open only if the pointer (mouse or touch) is still over the origin
						if (!self.pointerIsOverOrigin && self._touchIsMeaningfulEvent(event)) {
							self._openNow(event);
						}
					}, delay[0]);
				}
				else {
					self._openNow(event);
				}
			}
		}
	},
	
	// this function will open the tooltip right away
	_openNow: function(event, callback) {
		
		var self = this;
		
		// if the destruction process has not begun and if this was not
		// triggered by an unwanted emulated click event
		if (!self.destroying) {
			
			// check that the origin is still in the DOM
			if (	bodyContains(self.$origin)
				// if the tooltip is enabled
				&&	self.enabled
			) {
				
				var ok = true;
				
				// if the tooltip is not open yet, we need to call functionBefore.
				// otherwise we can jst go on
				if (self.state == 'closed') {
					
					// trigger an event. The event.stop function allows the callback
					// to prevent the opening of the tooltip
					self._trigger({
						type: 'before',
						event: event,
						stop: function() {
							ok = false;
						}
					});
					
					if (ok && self.options.functionBefore) {
						
						// call our custom function before continuing
						ok = self.options.functionBefore.call(self, self, {
							event: event,
							origin: self.$origin[0]
						});
					}
				}
				
				if (ok !== false) {
					
					// if there is some content
					if (self.Content !== null) {
						
						// save the method callback and cancel close method callbacks
						if (callback) {
							self.callbacks.open.push(callback);
						}
						self.callbacks.close = [];
						
						// get rid of any appearance timeouts
						self._timeoutsClear();
						
						var extraTime,
							finish = function() {
								
								if (self.state != 'stable') {
									self._stateSet('stable');
								}
								
								// trigger any open method custom callbacks and reset them
								$.each(self.callbacks.open, function(i,c) {
									c.call(self, self, {
										origin: self.$origin[0],
										tooltip: self.$tooltip[0]
									});
								});
								
								self.callbacks.open = [];
							};
						
						// if the tooltip is already open
						if (self.state !== 'closed') {
							
							// the timer (if any) will start (or restart) right now
							extraTime = 0;
							
							// if it was disappearing, cancel that
							if (self.state === 'disappearing') {
								
								self._stateSet('appearing');
								
								if (supportsTransitions()) {
									
									self.$tooltip
										.clearQueue()
										.removeClass('tooltipster-dying')
										.addClass('tooltipster-show');
									
									if (self.options.animationDuration[0] > 0) {
										self.$tooltip.delay(self.options.animationDuration[0]);
									}
									
									self.$tooltip.queue(finish);
								}
								else {
									// in case the tooltip was currently fading out, bring it back
									// to life
									self.$tooltip
										.stop()
										.fadeIn(finish);
								}
							}
							// if the tooltip is already open, we still need to trigger the method
							// custom callback
							else if (self.state == 'stable') {
								finish();
							}
						}
						// if the tooltip isn't already open, open it
						else {
							
							// a plugin must bind on this and store the tooltip in this.$tooltip
							self._stateSet('appearing');
							
							// the timer (if any) will start when the tooltip has fully appeared
							// after its transition
							extraTime = self.options.animationDuration[0];
							
							// insert the content inside the tooltip
							self._contentInsert();
							
							// reposition the tooltip and attach to the DOM
							self.reposition(event, true);
							
							// animate in the tooltip. If the display plugin wants no css
							// animations, it may override the animation option with a
							// dummy value that will produce no effect
							if (supportsTransitions()) {
								
								// note: there seems to be an issue with start animations which
								// are randomly not played on fast devices in both Chrome and FF,
								// couldn't find a way to solve it yet. It seems that applying
								// the classes before appending to the DOM helps a little, but
								// it messes up some CSS transitions. The issue almost never
								// happens when delay[0]==0 though
								self.$tooltip
									.addClass('tooltipster-'+ self.options.animation)
									.addClass('tooltipster-initial')
									.css({
										'-moz-animation-duration': self.options.animationDuration[0] + 'ms',
										'-ms-animation-duration': self.options.animationDuration[0] + 'ms',
										'-o-animation-duration': self.options.animationDuration[0] + 'ms',
										'-webkit-animation-duration': self.options.animationDuration[0] + 'ms',
										'animation-duration': self.options.animationDuration[0] + 'ms',
										'transition-duration': self.options.animationDuration[0] + 'ms'
									});
								
								setTimeout(
									function() {
										
										// a quick hover may have already triggered a mouseleave
										if (self.state != 'closed') {
											
											self.$tooltip
												.addClass('tooltipster-show')
												.removeClass('tooltipster-initial');
											
											if (self.options.animationDuration[0] > 0) {
												self.$tooltip.delay(self.options.animationDuration[0]);
											}
											
											self.$tooltip.queue(finish);
										}
									},
									0
								);
							}
							else {
								
								// old browsers will have to live with this
								self.$tooltip
									.css('display', 'none')
									.fadeIn(self.options.animationDuration[0], finish);
							}
							
							// checks if the origin is removed while the tooltip is open
							self._trackerStart();
							
							// NOTE: the listeners below have a '-triggerClose' namespace
							// because we'll remove them when the tooltip closes (unlike
							// the '-triggerOpen' listeners). So some of them are actually
							// not about close triggers, rather about positioning.
							
							$(env.window)
								// reposition on resize
								.on('resize.'+ self.namespace +'-triggerClose', function(e) {
									self.reposition(e);
								})
								// same as below for parents
								.on('scroll.'+ self.namespace +'-triggerClose', function(e) {
									self._scrollHandler(e);
								});
							
							self.$originParents = self.$origin.parents();
							
							// scrolling may require the tooltip to be moved or even
							// repositioned in some cases
							self.$originParents.each(function(i, parent) {
								
								$(parent).on('scroll.'+ self.namespace +'-triggerClose', function(e) {
									self._scrollHandler(e);
								});
							});
							
							
							if (	self.options.triggerClose.mouseleave
								||	(self.options.triggerClose.touchleave && env.deviceHasTouchCapability)
							) {
								
								// we use an event to allow users/plugins to control when the mouseleave/touchleave
								// close triggers will come to action. It allows to have more triggering elements
								// than just the origin and the tooltip for example, or to cancel/delay the closing,
								// or to make the tooltip interactive even if it wasn't when it was open, etc.
								self._on('dismissable', function(event) {
									
									if (event.dismissable) {
										
										if (event.delay) {
											
											timeout = setTimeout(function() {
												// event.event may be undefined
												self._close(event.event);
											}, event.delay);
											
											self.timeouts.close.push(timeout);
										}
										else {
											self._close(event);
										}
									}
									else {
										clearTimeout(timeout);
									}
								});
								
								// now set the listeners that will trigger 'dismissable' events
								var $elements = self.$origin,
									eventNamesIn = '',
									eventNamesOut = '',
									timeout = null;
								
								// if we have to allow interaction, bind on the tooltip too
								if (self.options.interactive) {
									$elements = $elements.add(self.$tooltip);
								}
								
								if (self.options.triggerClose.mouseleave) {
									eventNamesIn += 'mouseenter.'+ self.namespace +'-triggerClose ';
									eventNamesOut += 'mouseleave.'+ self.namespace +'-triggerClose ';
								}
								if (self.options.triggerClose.touchleave && env.deviceHasTouchCapability) {
									eventNamesIn += 'touchstart.'+ self.namespace +'-triggerClose';
									eventNamesOut += 'touchend.'+ self.namespace +'-triggerClose touchcancel.'+ self.namespace +'-triggerClose';
								}
								
								$elements
									// close after some time spent outside of the elements
									.on(eventNamesOut, function(event) {
										
										// it's ok if the touch gesture ended up to be a swipe,
										// it's still a "touch leave" situation
										if (	self._touchIsTouchEvent(event)
											||	!self._touchIsEmulatedEvent(event)
										) {
											
											var delay = (event.type == 'mouseleave') ?
												self.options.delay :
												self.options.delayTouch;
											
											self._trigger({
												delay: delay[1],
												dismissable: true,
												event: event,
												type: 'dismissable'
											});
										}
									})
									// suspend the mouseleave timeout when the pointer comes back
									// over the elements
									.on(eventNamesIn, function() {
										
										// it's also ok if the touch event is a swipe gesture
										if (	self._touchIsTouchEvent(event)
											||	!self._touchIsEmulatedEvent(event)
										) {
											self._trigger({
												dismissable: false,
												event: event,
												type: 'dismissable'
											});
										}
									});
							}
							
							// close the tooltip when the origin gets a mouse click (common behavior of
							// native tooltips)
							if (self.options.triggerClose.originClick) {
								
								self.$origin.on('click.'+ self.namespace + '-triggerClose', function(event) {
									
									// we could actually let a tap trigger this but this feature just
									// does not make sense on touch devices
									if (	!self._touchIsTouchEvent(event)
										&&	!self._touchIsEmulatedEvent(event)
									) {
										self._close(event);
									}
								});
							}
							
							// set the same bindings for click and touch on the body to close the tooltip
							if (	self.options.triggerClose.click
								||	(self.options.triggerClose.tap && env.deviceHasTouchCapability)
							) {
								
								// don't set right away since the click/tap event which triggered this method
								// (if it was a click/tap) is going to bubble up to the body, we don't want it
								// to close the tooltip immediately after it opened
								setTimeout(function() {
									
									if (self.state != 'closed') {
										
										var eventNames = '';
										if (self.options.triggerClose.click) {
											eventNames += 'click.'+ self.namespace +'-triggerClose ';
										}
										if (self.options.triggerClose.tap && env.deviceHasTouchCapability) {
											eventNames += 'touchend.'+ self.namespace +'-triggerClose';
										}
										
										$('body').on(eventNames, function(event) {
											
											if (self._touchIsMeaningfulEvent(event)) {
												
												self._touchRecordEvent(event);
												
												if (!self.options.interactive || !$.contains(self.$tooltip[0], event.target)) {
													self._close(event);
												}
											}
										});
										
										// needed to detect and ignore swiping
										if (self.options.triggerClose.tap && env.deviceHasTouchCapability) {
											
											$('body').on('touchstart.'+ self.namespace +'-triggerClose', function(event) {
												self._touchRecordEvent(event);
											});
										}
									}
								}, 0);
							}
							
							self._trigger('ready');
							
							// call our custom callback
							if (self.options.functionReady) {
								self.options.functionReady.call(self, self, {
									origin: self.$origin[0],
									tooltip: self.$tooltip[0]
								});
							}
						}
						
						// if we have a timer set, let the countdown begin
						if (self.options.timer > 0) {
							
							var timeout = setTimeout(function() {
								self._close();
							}, self.options.timer + extraTime);
							
							self.timeouts.close.push(timeout);
						}
					}
				}
			}
		}
	},
	
	_optionsFormat: function() {
		
		if (typeof this.options.animationDuration == 'number') {
			this.options.animationDuration = [this.options.animationDuration, this.options.animationDuration];
		}
		
		if (typeof this.options.delay == 'number') {
			this.options.delay = [this.options.delay, this.options.delay];
		}
		
		if (typeof this.options.delayTouch == 'number') {
			this.options.delayTouch = [this.options.delayTouch, this.options.delayTouch];
		}
		
		if (typeof this.options.theme == 'string') {
			this.options.theme = [this.options.theme];
		}
		
		// determine the future parent
		if (typeof this.options.parent == 'string') {
			this.options.parent = $(this.options.parent);
		}
		
		if (this.options.trigger == 'hover') {
			
			this.options.triggerOpen = {
				mouseenter: true,
				touchstart: true
			};
			
			this.options.triggerClose = {
				mouseleave: true,
				originClick: true,
				touchleave: true
			};
		}
		else if (this.options.trigger == 'click') {
			
			this.options.triggerOpen = {
				click: true,
				tap: true
			};
			
			this.options.triggerClose = {
				click: true,
				tap: true
			};
		}
		
		// for the plugins
		this._trigger('options');
	},
	
	_plugin: function(pluginName) {
		
		var plugin = $.tooltipster.plugin(pluginName);
		
		if (plugin) {
			
			if (plugin.instance) {
				
				var fn = function() {};
				fn.prototype = plugin.instance;
				
				var p = new fn();
				p._init(this);
				
				// proxy public methods on the instance to allow new instance methods
				$.tooltipster._bridge(plugin.instance, p, this, plugin.name);
			}
		}
		else {
			throw new Error('The "'+ pluginName +'" plugin is not defined');
		}
	},
	
	/**
	 * Schedules or cancels the garbage collector task
	 */
	_prepareGC: function() {
		
		var self = this;
		
		// in case the selfDestruction option has been changed by a method call
		if (self.options.selfDestruction) {
			
			// the GC task
			self.garbageCollector = setInterval(function() {
				
				var now = new Date().getTime();
				
				// forget the old events
				self.touchEvents = $.grep(self.touchEvents, function(event, i) {
					// 1 minute
					return now - event.time > 60000;
				});
				
				// auto-destruct if the origin is gone
				if (!bodyContains(self.$origin)) {
					self.destroy();
				}
			}, 20000);
		}
		else {
			clearInterval(self.garbageCollector);
		}
	},
	
	/**
	 * Sets listeners on the origin if the open triggers require them.
	 * Unlike the listeners set at opening time, these ones
	 * remain even when the tooltip is closed. It has been made a
	 * separate method so it can be called when the triggers are
	 * changed in the options. Closing is handled in _openNow()
	 * because of the bindings that may be needed on the tooltip
	 * itself
	 */
	_prepareOrigin: function() {
		
		var self = this;
		
		// in case we're resetting the triggers
		self.$origin.off('.'+ self.namespace +'-triggerOpen');
		
		// if the device is touch capable, even if only mouse triggers
		// are asked, we need to listen to touch events to know if the mouse
		// events are actually emulated (so we can ignore them)
		if (env.deviceHasTouchCapability) {
			
			self.$origin.on(
				'touchstart.'+ self.namespace +'-triggerOpen ' +
					'touchend.'+ self.namespace +'-triggerOpen ' +
					'touchcancel.'+ self.namespace +'-triggerOpen',
				function(event){
					self._touchRecordEvent(event);
				}
			);
		}
		
		// mouse click and touch tap work the same way
		if (	self.options.triggerOpen.click
			||	(self.options.triggerOpen.tap && env.deviceHasTouchCapability)
		) {
			
			var eventNames = '';
			if (self.options.triggerOpen.click) {
				eventNames += 'click.'+ self.namespace +'-triggerOpen ';
			}
			if (self.options.triggerOpen.tap && env.deviceHasTouchCapability) {
				eventNames += 'touchend.'+ self.namespace +'-triggerOpen';
			}
			
			self.$origin.on(eventNames, function(event) {
				if (self._touchIsMeaningfulEvent(event)) {
					self._openNow(event);
				}
			});
		}
		
		// mouseenter and touch start work the same way
		if (	self.options.triggerOpen.mouseenter
			||	(self.options.triggerOpen.touchstart && env.deviceHasTouchCapability)
		) {
			
			var eventNames = '';
			if (self.options.triggerOpen.mouseenter) {
				eventNames += 'mouseenter.'+ self.namespace +'-triggerOpen ';
			}
			if (self.options.triggerOpen.touchstart && env.deviceHasTouchCapability) {
				eventNames += 'touchstart.'+ self.namespace +'-triggerOpen';
			}
			
			self.$origin.on(eventNames, function(event) {
				if (	self._touchIsTouchEvent(event)
					||	!self._touchIsEmulatedEvent(event)
				) {
					self.pointerIsOverOrigin = false;
					self._open(event);
				}
			});
		}
		
		// info for the mouseleave/touchleave close triggers when they use a delay
		if (	self.options.triggerClose.mouseleave
			||	(self.options.triggerClose.touchleave && env.deviceHasTouchCapability)
		) {
			
			var eventNames = '';
			if (self.options.triggerClose.mouseleave) {
				eventNames += 'mouseleave.'+ self.namespace +'-triggerOpen ';
			}
			if (self.options.triggerClose.touchleave && env.deviceHasTouchCapability) {
				eventNames += 'touchend.'+ self.namespace +'-triggerOpen touchcancel.'+ self.namespace +'-triggerOpen';
			}
			
			self.$origin.on(eventNames, function(event) {
				
				if (self._touchIsMeaningfulEvent(event)) {
					self.pointerIsOverOrigin = true;
				}
			});
		}
	},
	
	/**
	 * Do the things that need to be done only once after the tooltip
	 * HTML element it has been created. It has been made a separate
	 * method so it can be called when options are changed. Remember
	 * that the tooltip may actually exist in the DOM before it is
	 * opened, and present after it has been closed: it's the display
	 * plugin that takes care of handling it.
	 */
	_prepareTooltip: function() {
		
		var self = this,
			p = self.options.interactive ? 'auto' : '';
		
		// this will be useful to know quickly if the tooltip is in
		// the DOM or not 
		self.$tooltip
			.attr('id', self.namespace)
			.css({
				// pointer events
				'pointer-events': p,
				zIndex: self.options.zIndex
			});
		
		// themes
		// remove the old ones and add the new ones
		$.each(self.previousThemes, function(i, theme) {
			self.$tooltip.removeClass(theme);
		});
		$.each(self.options.theme, function(i, theme) {
			self.$tooltip.addClass(theme);
		});
		
		self.previousThemes = $.merge([], self.options.theme);
	},
	
	/**
	 * Handles the scroll on any of the parents of the origin (when the
	 * tooltip is open)
	 * 
	 * @param {object} event
	 */
	_scrollHandler: function(event) {
		
		var self = this;
		
		if (self.options.triggerClose.scroll) {
			self._close(event);
		}
		else {
			
			// if the scroll happened on the window
			if (event.target === env.window.document) {
				
				// if the origin has a fixed lineage, window scroll will have no
				// effect on its position nor on the position of the tooltip
				if (!self.geometry.origin.fixedLineage) {
					
					// we don't need to do anything unless repositionOnScroll is true
					// because the tooltip will already have moved with the window
					// (and of course with the origin)
					if (self.options.repositionOnScroll) {
						self.reposition(event);
					}
				}
			}
			// if the scroll happened on another parent of the tooltip, it means
			// that it's in a scrollable area and now needs to have its position
			// adjusted or recomputed, depending ont the repositionOnScroll
			// option. Also, if the origin is partly hidden due to a parent that
			// hides its overflow, we'll just hide (not close) the tooltip.
			else {
				
				var g = self._geometry(),
					overflows = false;
				
				// a fixed position origin is not affected by the overflow hiding
				// of a parent
				if (self.$origin.css('position') != 'fixed') {
					
					self.$originParents.each(function(i, el) {
						
						var $el = $(el),
							overflowX = $el.css('overflow-x'),
							overflowY = $el.css('overflow-y');
						
						if (overflowX != 'visible' || overflowY != 'visible') {
							
							var bcr = el.getBoundingClientRect();
							
							if (overflowX != 'visible') {
								
								if (	g.origin.windowOffset.left < bcr.left
									||	g.origin.windowOffset.right > bcr.right
								) {
									overflows = true;
									return false;
								}
							}
							
							if (overflowY != 'visible') {
								
								if (	g.origin.windowOffset.top < bcr.top
									||	g.origin.windowOffset.bottom > bcr.bottom
								) {
									overflows = true;
									return false;
								}
							}
						}
						
						// no need to go further if fixed, for the same reason as above
						if ($el.css('position') == 'fixed') {
							return false;
						}
					});
				}
				
				if (overflows) {
					self.$tooltip.css('visibility', 'hidden');
				}
				else {
					self.$tooltip.css('visibility', 'visible');
					
					// reposition
					if (self.options.repositionOnScroll) {
						self.reposition(event);
					}
					// or just adjust offset
					else {
						
						// we have to use offset and not windowOffset because this way,
						// only the scroll distance of the scrollable areas are taken into
						// account (the scrolltop value of the main window must be
						// ignored since the tooltip already moves with it)
						var offsetLeft = g.origin.offset.left - self.geometry.origin.offset.left,
							offsetTop = g.origin.offset.top - self.geometry.origin.offset.top;
						
						// add the offset to the position initially computed by the display plugin
						self.$tooltip.css({
							left: self.tooltipCoord.left + offsetLeft,
							top: self.tooltipCoord.top + offsetTop
						});
					}
				}
			}
			
			self._trigger({
				type: 'scroll',
				event: event
			});
		}
	},
	
	/**
	 * Changes the state of the tooltip
	 *
	 * @param {string} state
	 * @return {object} this
	 */
	_stateSet: function(state) {
		
		this.state = state;
		
		this._trigger({
			type: 'state',
			state: state
		});
		
		return this;
	},
	
	/**
	 * Clear appearance timeouts
	 */
	_timeoutsClear: function() {
		
		// there is only one possible open timeout: the delayed opening
		// when the mouseenter/touchstart open triggers are used
		clearTimeout(this.timeouts.open);
		this.timeouts.open = null;
		
		// ... but several close timeouts: the delayed closing when the
		// mouseleave close trigger is used and the timer option
		$.each(this.timeouts.close, function(i, timeout) {
			clearTimeout(timeout);
		});
		this.timeouts.close = [];
	},
	
	/**
	 * This will return true if the event is a mouse event which was
	 * emulated by the browser after a touch event. This allows us to
	 * really dissociate mouse and touch triggers.
	 * 
	 * There is a margin of error if a real mouse event is fired right
	 * after (within the delay shown below) a touch event on the same
	 * element, but hopefully it should not happen often.
	 * 
	 * @returns {boolean}
	 */
	_touchIsEmulatedEvent: function(event) {
		
		var isEmulated = false,
			now = new Date().getTime();
		
		for (var i = this.touchEvents.length - 1; i >= 0; i--) {
			
			var e = this.touchEvents[i];
			
			// delay, in milliseconds. It's supposed to be 300ms in
			// most browsers (350ms on iOS) to allow a double tap but
			// can be less (check out FastClick for more info)
			if (now - e.time < 500) {
				
				if (e.target === event.target) {
					isEmulated = true;
				}
			}
			else {
				break;
			}
		}
		
		return isEmulated;
	},
	
	/**
	 * Returns false if the event was an emulated mouse event or
	 * a touch event involved in a swipe gesture.
	 * 
	 * @param event
	 * @returns {boolean}
	 */
	_touchIsMeaningfulEvent: function(event) {
		return (
				(this._touchIsTouchEvent(event) && !this._touchSwiped(event.target))
			||	(!this._touchIsTouchEvent(event) && !this._touchIsEmulatedEvent(event))
		);
	},
		
	_touchIsTouchEvent: function(event){
		return event.type.indexOf('touch') == 0;
	}
	,
	/**
	 * Store touch events for a while to detect swiping and emulated mouse events
	 * 
	 * @param event
	 */
	_touchRecordEvent: function(event) {
		if (this._touchIsTouchEvent(event)) {
			event.time = new Date().getTime();
			this.touchEvents.push(event);
		}
	},
	
	/**
	 * Returns true if a swipe happened after the last touchstart
	 * event fired on event.target.
	 * 
	 * We need to differentiate a swipe from a tap before we let the
	 * event open or close the tooltip. A swipe is when a touchmove
	 * (scroll) event happens on the body between the touchstart and
	 * the touchend events of an element.
	 *
	 * @returns {boolean}
	 */
	_touchSwiped: function(target) {
		
		var swiped = false;
		
		for (var i = this.touchEvents.length - 1; i >= 0; i--) {
			
			var e = this.touchEvents[i];
			
			if (e.type == 'touchmove') {
				swiped = true;
				break;
			}
			else if (
				e.type == 'touchstart'
				&&	target === e.target
			) {
				break;
			}
		}
		
		return swiped;
	},
	
	_trackerStart: function() {
		
		var self = this,
			$content = self.$tooltip.find('.tooltipster-content');
		
		// get the initial content size
		if (self.options.trackTooltip) {
			self.contentBcr = $content[0].getBoundingClientRect();
		}
		
		self.tracker = setInterval(function() {
			
			// if the origin or tooltip elements have been removed.
			// Note: we could destroy the instance now if the origin has
			// been removed but we'll leave that task to our garbage collector
			if (!bodyContains(self.$origin) || !bodyContains(self.namespace)) {
				self._close();
			}
			// if everything is alright
			else {
				
				// compare the former and current positions of the origin to reposition
				// the tooltip if need be
				if (self.options.trackOrigin) {
					
					var g = self._geometry(),
						identical = false;
					
					// compare size first (a change requires repositioning too)
					if (areEqual(g.origin.size, self.geometry.origin.size)) {
						
						// for elements that have a fixed lineage (see self::_geometry), we track the
						// top and left properties (relative to window)
						if (self.geometry.origin.fixedLineage) {
							if (areEqual(g.origin.windowOffset, self.geometry.origin.windowOffset)) {
								identical = true;
							}
						}
						// otherwise, track total offset (relative to document)
						else {
							if (areEqual(g.origin.offset, self.geometry.origin.offset)) {
								identical = true;
							}
						}
					}
					
					if (!identical) {
						
						// close the tooltip when using the mouseleave close trigger
						// (see https://github.com/iamceege/tooltipster/pull/253)
						if (self.options.triggerClose.mouseleave) {
							self._close();
						}
						else {
							self.reposition();
						}
					}
				}
				
				if (self.options.trackTooltip) {
					
					var currentBcr = $content[0].getBoundingClientRect();
					
					if (	currentBcr.height !== self.contentBcr.height
						||	currentBcr.width !== self.contentBcr.width
					) {
						self.reposition();
						self.contentBcr = currentBcr;
					}
				}
			}
		}, self.options.trackerInterval);
	},
	
	_trigger: function() {
		
		var args = Array.prototype.slice.apply(arguments);
		
		if (typeof args[0] == 'string') {
			args[0] = { type: args[0] };
		}
		
		// add properties to the event
		args[0].instance = this;
		args[0].origin = this.$origin ? this.$origin[0] : null;
		args[0].tooltip = this.$tooltip ? this.$tooltip[0] : null;
		
		// note: the order of emitters matters
		this.$emitterPrivate.trigger.apply(this.$emitterPrivate, args);
		$.tooltipster.$emitter.trigger.apply($.tooltipster.$emitter, args);
		this.$emitterPublic.trigger.apply(this.$emitterPublic, args);
		
		return this;
	},
	
	_update: function(content) {
		
		var self = this;
		
		// change the content
		self._contentSet(content);
		
		if (self.Content !== null) {
			
			// update the tooltip if it is open
			if (self.state !== 'closed') {
				
				// reset the content in the tooltip
				self._contentInsert();
				
				// reposition and resize the tooltip
				self.reposition();
				
				// if we want to play a little animation showing the content changed
				if (self.options.updateAnimation) {
					
					if (supportsTransitions()) {
						
						// keep the reference in the local scope
						var animation = self.options.updateAnimation;
						
						self.$tooltip.addClass('tooltipster-update-'+ animation);
						
						// remove the class after a while. The actual duration of the
						// update animation may be shorter, it's set in the CSS rules
						setTimeout(function() {
							
							if (self.state != 'closed') {
								
								self.$tooltip.removeClass('tooltipster-update-'+ animation);
							}
						}, 1000);
					}
					else {
						self.$tooltip.fadeTo(200, 0.5, function() {
							if (self.state != 'closed') {
								self.$tooltip.fadeTo(200, 1);
							}
						});
					}
				}
			}
		}
		else {
			self._close();
		}
	},
	
	/**
	 * @see self::_close
	 */
	close: function(callback) {
		
		if (!this.destroyed) {
			this._close(null, callback);
		}
		else {
			this._destroyError();
		}
		
		return this;
	},
	
	content: function(c) {
		
		// getter method
		if (c === undefined) {
			return this.Content;
		}
		// setter method
		else {
			
			if (!this.destroyed) {
				this._update(c);
			}
			else {
				this._destroyError();
			}
			
			return this;
		}
	},
	
	destroy: function() {
		
		var self = this;
		
		if (!self.destroyed) {
			
			if (!self.destroying) {
				
				self.destroying = true;
				
				self._close(null, function() {
					
					self.destroying = false;
					self.destroyed = true;
					
					// last event
					self._trigger('destroyed');
					
					// unbind private and public event listeners
					self._off();
					self.off();
					
					self.$origin
						.removeData(self.namespace)
						// remove the open trigger listeners
						.off('.'+ self.namespace +'-triggerOpen');
					
					// remove the touch listener
					$('body').off('.' + self.namespace +'-triggerOpen');
					
					var ns = self.$origin.data('tooltipster-ns');
					
					// if the origin has been removed from DOM, its data may
					// well have been destroyed in the process and there would
					// be nothing to clean up or restore
					if (ns) {
						
						// if there are no more tooltips on this element
						if (ns.length === 1) {
							
							// optional restoration of a title attribute
							var title = null;
							if (self.options.restoration == 'previous') {
								title = self.$origin.data('tooltipster-initialTitle');
							}
							else if (self.options.restoration == 'current') {
								
								// old school technique to stringify when outerHTML is not supported
								title = (typeof self.Content == 'string') ?
									self.Content :
									$('<div></div>').append(self.Content).html();
							}
							
							if (title) {
								self.$origin.attr('title', title);
							}
							
							// final cleaning
							
							self.$origin.removeClass('tooltipstered');
							
							self.$origin
								.removeData('tooltipster-ns')
								.removeData('tooltipster-initialTitle');
						}
						else {
							// remove the instance namespace from the list of namespaces of
							// tooltips present on the element
							ns = $.grep(ns, function(el, i) {
								return el !== self.namespace;
							});
							self.$origin.data('tooltipster-ns', ns);
						}
					}
					
					// remove external references, just in case
					self.Content = null;
					self.$origin = null;
					self.$emitterPrivate = null;
					self.$emitterPublic = null;
					self.$tooltip = null;
					self.options.parent = null;
					
					// make sure the object is no longer referenced in there to prevent
					// memory leaks
					$.tooltipster.instancesLatestArr = $.grep($.tooltipster.instancesLatestArr, function(el, i) {
						return self !== el;
					});
					
					clearInterval(self.garbageCollector);
				});
			}
		}
		else {
			self._destroyError();
		}
		
		// we return the scope rather than true so that the call to
		// .tooltipster('destroy') actually returns the matched elements
		// and applies to all of them
		return self;
	},
	
	disable: function() {
		
		if (!this.destroyed) {
			
			// close first, in case the tooltip would not disappear on
			// its own (no close trigger)
			this._close();
			this.enabled = false;
			
			return this;
		}
		else {
			this._destroyError();
		}
	},
	
	elementOrigin: function() {
		
		if (!this.destroyed) {
			return this.$origin[0];
		}
		else {
			this._destroyError();
		}
	},
	
	elementTooltip: function() {
		return this.$tooltip ? this.$tooltip[0] : null;
	},
	
	enable: function() {
		this.enabled = true;
		return this;
	},
	
	/**
	 * Alias, deprecated in 4.0.0
	 * 
	 * @param callback
	 */
	hide: function(callback) {
		return this.close(callback);
	},
	
	instance: function() {
		return this;
	},
	
	/**
	 * For public use only, not to be used by plugins (use ::_off() instead)
	 */
	off: function() {
		if (!this.destroyed) {
			this.$emitterPublic.off.apply(this.$emitterPublic, Array.prototype.slice.apply(arguments));
		}
		return this;
	},
	
	/**
	 * For public use only, not to be used by plugins (use ::_on() instead)
	 */
	on: function() {
		if (!this.destroyed) {
			this.$emitterPublic.on.apply(this.$emitterPublic, Array.prototype.slice.apply(arguments));
		}
		else {
			this._destroyError();
		}
		return this;
	},
	
	/**
	 * For public use only, not to be used by plugins
	 */
	one: function() {
		if (!this.destroyed) {
			this.$emitterPublic.one.apply(this.$emitterPublic, Array.prototype.slice.apply(arguments));
		}
		else {
			this._destroyError();
		}
		return this;
	},
	
	/**
	 * The public open() method is actually an alias for the private _openNow() method
	 * 
	 * @see self::_openNow
	 */
	open: function(callback) {
		
		if (!this.destroyed && !this.destroying) {
			this._openNow(null, callback);
		}
		else {
			this._destroyError();
		}
		
		return this;
	},
	
	/**
	 * Get or set options. For internal use and advanced users only.
	 * 
	 * @param {string} o Option name
	 * @param {mixed} val optional A new value for the option
	 * @return {mixed} If val is omitted, the value of the option is returned, otherwise
	 * the instance itself is returned
	 */ 
	option: function(o, val) {
		
		// getter
		if (val === undefined) {
			return this.options[o];
		}
		// setter
		else {
			
			if (!this.destroyed) {
				
				// change value
				this.options[o] = val;
				
				// format
				this._optionsFormat();
				
				// re-prepare the triggers if needed
				if ($.inArray(o, ['trigger', 'triggerClose', 'triggerOpen']) >= 0) {
					this._prepareOrigin();
				}
				
				if (o === 'selfDestruction') {
					this._prepareGC();
				}
			}
			else {
				this._destroyError();
			}
			
			return this;
		}
	},
	
	/**
	 * This method is in charge of setting the position and size properties of the tooltip.
	 * All the hard work is delegated to the display plugin.
	 * Note: The tooltip may be detached from the DOM at the moment the method is called 
	 * but must be attached by the end of the method call.
	 * 
	 * @param {object} event For internal use only. Defined if an event such as
	 * window resizing triggered the repositioning
	 * @param {boolean} tooltipIsDetached For internal use only. Set this to true if you
	 * know that the tooltip not being in the DOM is not an issue (typically when the
	 * tooltip element has just been created but has not been added to the DOM yet).
	 */
	reposition: function(event, tooltipIsDetached) {
		
		var self = this;
		
		if (!self.destroyed) {
			
			// if the tooltip has not been removed from DOM manually (or if it
			// has been detached on purpose)
			if (bodyContains(self.namespace) || tooltipIsDetached) {
				
				if (!tooltipIsDetached) {
					// detach in case the tooltip overflows the window and adds
					// scrollbars to it, so _geometry can be accurate
					self.$tooltip.detach();
				}
				
				// refresh the geometry object before passing it as a helper
				self.geometry = self._geometry();
				
				// let a plugin fo the rest
				self._trigger({
					type: 'reposition',
					event: event,
					helper: {
						geo: self.geometry
					}
				});
			}
		}
		else {
			self._destroyError();
		}
		
		return self;
	},
	
	/**
	 * Alias, deprecated in 4.0.0
	 *
	 * @param callback
	 */
	show: function(callback) {
		return this.open(callback);
	},
	
	/**
	 * Returns some properties about the instance
	 * 
	 * @returns {object}
	 */
	status: function() {
		
		return {
			destroyed: this.destroyed,
			destroying: this.destroying,
			enabled: this.enabled,
			open: this.state !== 'closed',
			state: this.state
		};
	},
	
	/**
	 * For public use only, not to be used by plugins
	 */
	triggerHandler: function() {
		if (!this.destroyed) {
			this.$emitterPublic.triggerHandler.apply(this.$emitterPublic, Array.prototype.slice.apply(arguments));
		}
		else {
			this._destroyError();
		}
		return this;
	}
};

$.fn.tooltipster = function() {
	
	// for using in closures
	var args = Array.prototype.slice.apply(arguments),
		// common mistake: an HTML element can't be in several tooltips at the same time
		contentCloningWarning = 'You are using a single HTML element as content for several tooltips. You probably want to set the contentCloning option to TRUE.';
	
	// this happens with $(sel).tooltipster(...) when $(sel) does not match anything
	if (this.length === 0) {
		
		// still chainable
		return this;
	}
	// this happens when calling $(sel).tooltipster('methodName or options')
	// where $(sel) matches one or more elements
	else {
		
		// method calls
		if (typeof args[0] === 'string') {
			
			var v = '#*$~&';
			
			this.each(function() {
				
				// retrieve the namepaces of the tooltip(s) that exist on that element.
				// We will interact with the first tooltip only.
				var ns = $(this).data('tooltipster-ns'),
					// self represents the instance of the first tooltipster plugin
					// associated to the current HTML object of the loop
					self = ns ? $(this).data(ns[0]) : null;
				
				// if the current element holds a tooltipster instance
				if (self) {
					
					if (typeof self[args[0]] === 'function') {
						
						if (	this.length > 1
							&&	args[0] == 'content'
							&&	typeof args[1] == 'object'
							&&	args[1] !== null
							&&	!self.options.contentCloning
							&&	self.options.debug
						) {
							console.log(contentCloningWarning);
						}
						
						// note : args[1] and args[2] may not be defined
						var resp = self[args[0]](args[1], args[2]);
					}
					else {
						throw new Error('Unknown method "'+ args[0] +'"');
					}
					
					// if the function returned anything other than the instance
					// itself (which implies chaining, except for the `instance` method)
					if (resp !== self || args[0] === 'instance') {
						
						v = resp;
						
						// return false to stop .each iteration on the first element
						// matched by the selector
						return false;
					}
				}
				else {
					throw new Error('You called Tooltipster\'s "'+ args[0] +'" method on an uninitialized element');
				}
			});
			
			return (v !== '#*$~&') ? v : this;
		}
		// first argument is undefined or an object: the tooltip is initializing
		else {
			
			// reset the array of last initialized objects
			$.tooltipster.instancesLatestArr = [];
			
			// is there a defined value for the multiple option in the options object ?
			var	multipleIsSet = args[0] && args[0].multiple !== undefined,
				// if the multiple option is set to true, or if it's not defined but
				// set to true in the defaults
				multiple = (multipleIsSet && args[0].multiple) || (!multipleIsSet && defaults.multiple),
				// same for content
				contentIsSet = args[0] && args[0].content !== undefined,
				content = (contentIsSet && args[0].content) || (!contentIsSet && defaults.content),
				// same for contentCloning
				contentCloningIsSet = args[0] && args[0].contentCloning !== undefined,
				contentCloning =
						(contentCloningIsSet && args[0].contentCloning)
					||	(!contentCloningIsSet && defaults.contentCloning),
				// same for debug
				debugIsSet = args[0] && args[0].debug !== undefined,
				debug = (debugIsSet && args[0].debug) || (!debugIsSet && defaults.debug);
			
			if (	this.length > 1
				&&	typeof content == 'object'
				&&	content !== null
				&&	!contentCloning
				&&	debug
			) {
				console.log(contentCloningWarning);
			}
			
			// create a tooltipster instance for each element if it doesn't
			// already have one or if the multiple option is set, and attach the
			// object to it
			this.each(function() {
				
				var go = false,
					$this = $(this),
					ns = $this.data('tooltipster-ns'),
					obj = null;
				
				if (!ns) {
					go = true;
				}
				else if (multiple) {
					go = true;
				}
				else if (debug) {
					console.log('Tooltipster: one or more tooltips are already attached to the element below. Ignoring.');
					console.log(this);
				}
				
				if (go) {
					obj = new $.Tooltipster(this, args[0]);
					
					// save the reference of the new instance
					if (!ns) ns = [];
					ns.push(obj.namespace);
					$this.data('tooltipster-ns', ns);
					
					// save the instance itself
					$this.data(obj.namespace, obj);
					
					// call our constructor custom function.
					// we do this here and not in ::init() because we wanted
					// the object to be saved in $this.data before triggering
					// it
					if (obj.options.functionInit) {
						obj.options.functionInit.call(obj, obj, {
							origin: this
						});
					}
					
					// and now the event, for the plugins and core emitter
					obj._trigger('init');
				}
				
				$.tooltipster.instancesLatestArr.push(obj);
			});
			
			return this;
		}
	}
};

// Utilities

/**
 * A class to check if a tooltip can fit in given dimensions
 * 
 * @param {object} $tooltip The jQuery wrapped tooltip element, or a clone of it
 */
function Ruler($tooltip) {
	
	// list of instance variables
	
	this.$container;
	this.constraints = null;
	this.$tooltip;
	
	this._init($tooltip);
}

Ruler.prototype = {
	
	/**
	 * Move the tooltip into an invisible div that does not allow overflow to make
	 * size tests. Note: the tooltip may or may not be attached to the DOM at the
	 * moment this method is called, it does not matter.
	 * 
	 * @param {object} $tooltip The object to test. May be just a clone of the
	 * actual tooltip.
	 */
	_init: function($tooltip) {
		
		this.$tooltip = $tooltip;
		
		this.$tooltip
			.css({
				// for some reason we have to specify top and left 0
				left: 0,
				// any overflow will be ignored while measuring
				overflow: 'hidden',
				// positions at (0,0) without the div using 100% of the available width
				position: 'absolute',
				top: 0
			})
			// overflow must be auto during the test. We re-set this in case
			// it were modified by the user
			.find('.tooltipster-content')
				.css('overflow', 'auto');
		
		this.$container = $('<div class="tooltipster-ruler"></div>')
			.append(this.$tooltip)
			.appendTo('body');
	},
	
	/**
	 * Force the browser to redraw (re-render) the tooltip immediately. This is required
	 * when you changed some CSS properties and need to make something with it
	 * immediately, without waiting for the browser to redraw at the end of instructions.
	 *
	 * @see http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
	 */
	_forceRedraw: function() {
		
		// note: this would work but for Webkit only
		//this.$tooltip.close();
		//this.$tooltip[0].offsetHeight;
		//this.$tooltip.open();
		
		// works in FF too
		var $p = this.$tooltip.parent();
		this.$tooltip.detach();
		this.$tooltip.appendTo($p);
	},
	
	/**
	 * Set maximum dimensions for the tooltip. A call to ::measure afterwards
	 * will tell us if the content overflows or if it's ok
	 *
	 * @param {int} width
	 * @param {int} height
	 * @return {Ruler}
	 */
	constrain: function(width, height) {
		
		this.constraints = {
			width: width,
			height: height
		};
		
		this.$tooltip.css({
			// we disable display:flex, otherwise the content would overflow without
			// creating horizontal scrolling (which we need to detect).
			display: 'block',
			// reset any previous height
			height: '',
			// we'll check if horizontal scrolling occurs
			overflow: 'auto',
			// we'll set the width and see what height is generated and if there
			// is horizontal overflow
			width: width
		});
		
		return this;
	},
	
	/**
	 * Reset the tooltip content overflow and remove the test container
	 */
	destroy: function() {
		
		// in case the element was not a clone
		this.$tooltip
			.detach()
			.find('.tooltipster-content')
				.css({
					// reset to CSS value
					display: '',
					overflow: ''
				});
		
		this.$container.remove();
	},
	
	/**
	 * Removes any constraints
	 * 
	 * @returns {Ruler}
	 */
	free: function() {
		
		this.constraints = null;
		
		// reset to natural size
		this.$tooltip.css({
			display: '',
			height: '',
			overflow: 'visible',
			width: ''
		});
		
		return this;
	},
	
	/**
	 * Returns the size of the tooltip. When constraints are applied, also returns
	 * whether the tooltip fits in the provided dimensions.
	 * The idea is to see if the new height is small enough and if the content does
	 * not overflow horizontally.
	 *
	 * @param {int} width
	 * @param {int} height
	 * @return {object} An object with a bool `fits` property and a `size` property
	 */
	measure: function() {
		
		this._forceRedraw();
		
		var tooltipBrc = this.$tooltip[0].getBoundingClientRect(),
			result = { size: {
				// brc.width/height are not defined in IE8- but in this
				// case, brc.right/bottom will have the same value
				height: tooltipBrc.bottom,
				width: tooltipBrc.right
			}};
		
		if (this.constraints) {
			
			// note: we used to use offsetWidth instead of boundingRectClient but
			// it returned rounded values, causing issues with sub-pixel layouts.
			
			// note2: noticed that the bcrWidth of text content of a div was once
			// greater than the bcrWidth of its container by 1px, causing the final
			// tooltip box to be too small for its content. However, evaluating
			// their widths one against the other (below) surprisingly returned
			// equality. Happened only once in Chrome 48, was not able to reproduce
			// => just having fun with float position values...
			
			var $content = this.$tooltip.find('.tooltipster-content'),
				height = this.$tooltip.outerHeight(),
				contentBrc = $content[0].getBoundingClientRect(),
				fits = {
					height: height <= this.constraints.height,
					width: (
						// this condition accounts for min-width property that
						// may apply
						tooltipBrc.width <= this.constraints.width
							// the -1 is here because scrollWidth actually returns
							// a rounded value, and may be greater than brc.width if
							// it was rounded up. This may cause an issue for contents
							// which actually really overflow  by 1px or so, but that
							// should be rare. Not sure how to solve this efficiently.
							// See http://blogs.msdn.com/b/ie/archive/2012/02/17/sub-pixel-rendering-and-the-css-object-model.aspx
						&&	contentBrc.width >= $content[0].scrollWidth - 1
					)
				};
			
			result.fits = fits.height && fits.width;
		}
		
		// old versions of IE get the width wrong for some reason
		if (env.IE && env.IE <= 11) {
			result.size.width = Math.ceil(result.size.width) + 1;
		}
		
		return result;
	}
};

// quick & dirty compare function, not bijective nor multidimensional
function areEqual(a,b) {
	var same = true;
	$.each(a, function(i, _) {
		if (b[i] === undefined || a[i] !== b[i]) {
			same = false;
			return false;
		}
	});
	return same;
}

/**
 * A fast function to check if an element is still in the DOM. It
 * tries to use an id as ids are indexed by the browser, or falls
 * back to jQuery's `contains` method.
 *
 * @param {string|object} ref An id or a jQuery-wrapped HTML element
 * @return {boolean}
 */
function bodyContains(ref) {
	var id = (typeof ref === 'string') ? ref : ref.attr('id');
	return id ? !!env.window.document.getElementById(id) : $.contains(env.window.document.body, ref[0]);
}

// we'll assume the device has no mouse until we detect any mouse movement
$('body').one('mousemove', function() {
	env.deviceHasMouse = true;
});

// detect IE versions for dirty fixes
var uA = navigator.userAgent.toLowerCase();
if (uA.indexOf('msie') != -1) env.IE = parseInt(uA.split('msie')[1]);
else if (uA.toLowerCase().indexOf('trident') !== -1 && uA.indexOf(' rv:11') !== -1) env.IE = 11;
else if (uA.toLowerCase().indexOf('edge/') != -1) env.IE = parseInt(uA.toLowerCase().split('edge/')[1]);

// detecting support for CSS transitions
function supportsTransitions() {
	var b = env.window.document.body || env.window.document.documentElement,
		s = b.style,
		p = 'transition',
		v = ['Moz', 'Webkit', 'Khtml', 'O', 'ms'];
	
	if (typeof s[p] == 'string') { return true; }
	
	p = p.charAt(0).toUpperCase() + p.substr(1);
	for (var i=0; i<v.length; i++) {
		if (typeof s[v[i] + p] == 'string') { return true; }
	}
	return false;
}

// we'll return jQuery for plugins not to have to declare it as a dependency,
// but it's done by a build task since it should be included only once at the
// end when we concatenate the core file with a pluginreturn $;

}));
