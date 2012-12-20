//DSC NameSpace
;var DanH = DanH || {};

//execute clickStore in the DanH namespace - reduces global namespace pollution
DanH.clickStore = function () {

  //function settings
	var settings = {
		immediatePost: true, 				//post as soon as a button is clicked
		periodicPost: false, 				//post at regular intervals
		periodicPostInterval: 0, 			//millisecond interval to check for unposted clicks
		post: {
			URL: 'None', 					//the url to post click information to
		},
		debug: {
			showDebugInfo: false, 			//display console debug information
			preventDefaultAction: false,    //whilst debugging, prevent button clicks from following their default action  
			treatFailAsSuccess: false       //useful for debugging where the server action has yet to be written but you want to test the effect of posting!
		},
		user: '', 							//the currently logged in user to attribute click stats against
		elements: {},                       //the elements on which to track clicks
		ignoreElements: {},                 //list of elements to ignore
		elementContainerTag: '',            //a user-defined data-value attribute to store against each click
		elementFriendlyName: '',            //a user defined data-value attribute used to store a reportable friendly name
	},
	storage = window.sessionStorage; 		//shorthand for windows.sesssionStorage

	var _init = function (options) {
		//merge settings with the default optins
		settings = $.extend({}, settings, options);
		
		//initialise periodic posting if required
		if (settings.periodicPost) {
			_debug('Settings up periodic post with interval: ' + settings.periodicPostInterval);
			setInterval(_postAll, settings.periodicPostInterval);
		}

		_debug('elements:');
		_debug(settings.elements);
		_debug('ignore elements:');
		_debug(settings.ignoreElements);
		_debug('monitor elements:');

		var monitorElements = settings.elements.not(settings.ignoreElements);
		_debug(monitorElements);

		monitorElements
			.click(function (e) {
				_recordClick($(e.currentTarget));
			});

		if (settings.debug.showDebugInfo) {
			//Add a debug button to initiate a POST
			$('body').prepend('<input type="button" id="submitClickStats" value="Submit Click Stats" />');
			$('#submitClickStats').click(function () {
				_postAll();
			});
		}
	},

	//store an item click
	_recordClick = function(e){
		_debug('recordClick');

		var $this = $(e),
			obj = _storeItem($this, settings.user);	

		if (settings.immediatePost) {
			_postAll();
		}
	},

	//return the sessionStorage key for a given object
	_getStorageKey = function (obj) {
		_debug(' - getStorageKey');
		return (obj.user || 'unknown') + '-' + obj.window + '_' + obj.id + '_' + (obj.text || obj.friendlyName);
	},

	//return a json object from sessionStorage based on the provided index
	_getObj = function (i) {
		var key = storage.key(i),
			itemString = storage.getItem(key);
		_debug(' - getObj: ' + itemString);

		try{
			return $.parseJSON(itemString);
		}
		catch (err){
			return {};
		}
	},

	//place a clickStore object in sessionStorage
	_storeItem = function (obj, user) {
		//identify the tag in which this element resides
		var containerTagText = '';
		if (settings.elementContainerTag.length > 0){
			var containerTag = obj.closest('[' + settings.elementContainerTag + ']');
			containerTagText = containerTag.attr(settings.elementContainerTag) || '';
		}

		//build the storage object    
		var btnInfo = {
			clickStore: true,
			userAgent: navigator.userAgent || '',
			user: user || '',
			window: window.location.href || '',
			id: obj.prop('id') || '',
			text: (obj.text() || obj.val()).trim() || '',
			href: obj.attr('href') || '',
			friendlyName: obj.attr(settings.elementFriendlyName) || '',
			tag: containerTagText
		}

		_debug('storeItem:' + JSON.stringify(btnInfo));

		//get the number of times this element has already been clicked,
		//increase by 1 and store it locally
		var key = _getStorageKey(btnInfo);
		storedItem = $.parseJSON(storage.getItem(key)) || btnInfo;
		clickCount = parseInt(storedItem.clickCount) || 0;
		clickCount++;
		btnInfo.clickCount = clickCount;
		_storeObj(btnInfo);
		_debug(storage);
		return btnInfo;
	},

	//post a single clickState object to the server
	_postSingle = function (obj) {
		var jsonObj = JSON.stringify(obj);
		_debug('postSingle:' + JSON.stringify(jsonObj));

		var data = {'clickStore':jsonObj};

		_postAjax(
			data, 
			function(){
				_markItemAsPosted(obj);
			});
	},
	
	//post data to the server
	_postAjax = function(data, success, fail){
		$.ajax({
			url: settings.post.URL,
			data: data,
			type: 'POST',
			success: function (result) {
				if (result.toLowerCase = 'true'){
					_debug('Ajax Success');
					if (typeof(success) == 'function'){
						success();
					}
				} 
				else {
					if (settings.debug.treatFailAsSuccess && typeof(success) == 'function'){
						success();
					}
					else if (typeof(fail) == 'function'){
						fail();
					}
				}
			},
			error: function () {
				_debug('Ajax Fail');
				if (settings.debug.treatFailAsSuccess && typeof(success) == 'function'){
					success();
				}
				else if (typeof(fail) == 'function'){
					fail();
				}
			}
		});
	},

	//post all known clickStore objects to the server
	_postAll = function () {
		_debug('postAll');

		//build an array of objects to post
		var localStore = [];

		for (var i = 0; i < storage.length; i++) {

			var obj = _getObj(i);
			//only post clickState items that are marked as 'clickStore'
			if (_isClickStore(obj)) {
				localStore.push(obj);
			}
		}

		//before POSTing, check that we actually have something to POST
		if (localStore.length > 0) {
			_debug(' - SUBMITTING:');
			_debug(JSON.stringify(localStore));

			var data = {
				clickStore:
				JSON.stringify(localStore)
			}

			_postAjax(
				data,
				function(){
					_removeAllObjects();
			});
			
		} else {
			_debug(' - Nothing to submit');
		}
	},

	//display debug information
	_debug = function (msg) {
		if (settings.debug.showDebugInfo) {
			if (typeof console == "object") {
				console.info(msg);
			}
		}
	},

	//update all clickState objects as posted. This is to prevent already submitted
	//objects from being being posted again (unless they change)
	_removeAllObjects = function () {
		_debug('markAllItemsAsPosted');

		//update storage to mark posted items as posted   
		var storageKeys = [];

		//build a list of storage keys
		for (var i = 0; i < storage.length; i++) {
			//storageKeys.push(storage.getItem(i));
			var obj = _getObj(i);
			storageKeys.push(_getStorageKey(obj));
		};

		//cycle through storage keys and remove clickStore objects
		for(var i = 0; i<storageKeys.length;i++){
			storage.removeItem(storageKeys[i]);
		}
	},

	//remove the given object from sessionState
	_removeObj = function (obj) {
		_debug(' - removeObj');
		var key = _getStorageKey(obj);
		storage.removeItem(key);
	},

	//store the supplied object in sessionState
	_storeObj = function (obj) {
		_debug(' - storeObj');
		var key = _getStorageKey(obj);
		storage.setItem(key, JSON.stringify(obj));
	},

	//return whether the supplied object is a clickStore object
	//(note that other objects may be stored in sessionStorage and we're not interested in them!)
	_isClickStore = function (obj) {
		try {
			_debug(' - isClickStore: ' + obj.clickStore);
			return obj.clickStore == true;
		}
		catch (err) {
			_debug(' - isClickStore: false');
			return false;
		}
	}

	return {
		//initialise the clickStore 
		init: _init,
		
		//manually record a click
		recordClick: _recordClick,
		
		//manually post data to the server
		post: _postAll
	}
}();
