//DSC NameSpace
var DSC = DSC || {};

//execute clickStore in the DSC namespace - reduces global namespace pollution
DSC.clickStore = function(){

  //function settings
	var settings = {
		immediatePost: true,								//post as soon as a button is clicked
		periodicPost: false,								//post at regular intervals
		periodicPostInterval:0,								//millisecond interval to check for unposted clicks
		post:{							
			URL: 'None',									//the url to post click information to
			treatFailAsSuccess: false, 						//useful for debugging where the server action has yet to be written!
		},
		debug: false,										//display console debug information
		user: "unknown" ,									//the currently logged in user to attribute click stats against
		elements: $('.btn:visible, input[type=file], a')	//the elements on which to track clicks
	},
	storage = window.sessionStorage;						//shorthand for windows.sesssionStorage
	
	var _init = function(options){
		settings = $.extend({}, settings, options);
		//initialise periodic posting if required
		if (settings.periodicPost){
			_debug('Settings up periodic post with interval: ' + settings.periodicPostInterval);
			setInterval(postAll, settings.periodicPostInterval);
		}
		
		//$('.btn:visible, input[type=file], a')
		settings.elements
			.click(function(e){
				var $this = $(this),
					obj = _storeItem($this, settings.user);
				
				if (settings.immediatePost){
					_postSingle(obj);
				}
			});
		
		if (settings.debug){
		//Add a debug button to initiate a POST
		$('.navbar-inner').append('<input type="button" id="submitClickStats" value="Submit Click Stats" />');
			$('#submitClickStats').click(function(){
				_postAll();
			});
		}
	},
	
	//return the sessionStorage key for a given object
	_getStorageKey=function(obj){
		_debug(' - getStorageKey');
		return obj.user + '-' + obj.window + '_' + obj.id + '_'+(obj.text || obj.friendlyName);
	},

	//return a json object from sessionStorage based on the provided index
	_getObj = function(i){
		var key = storage.key(i),
			itemString = storage.getItem(key);
		_debug(' - getObj: ' + itemString);
		return $.parseJSON(itemString);
	},
		
	//place a clickState object in sessionStorage
	_storeItem = function(obj, user){
	
		//build the storage object    
		var btnInfo = {
			clickStore: true,
			posted: false,
			userAgent: navigator.userAgent,
			user: user,
			window: window.location.href,
			id: obj.prop('id'),
			text: obj.text() || obj.val(),
			friendlyName: obj.attr('data_friendlyname') || '',
			href: obj.attr('href') || ''
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
	_postSingle = function(obj){
		var jsonObj = JSON.stringify(obj);
		_debug('postSingle:' + JSON.stringify(jsonObj));
		
		$.ajax({
			url:settings.post.URL,
			data:jsonObj,
			type:'POST',
			success:function(){
				_debug('POST success');
				_markItemAsPosted(obj);
			},
			error:function(){
				_debug('POST fail');
				if (settings.post.treatFailAsSuccess){
					_debug(' - treating fail as Success...');
					_markItemAsPosted(obj);
				}
			}
		});
	},

	//post all known clickState objects to the server
	_postAll = function(items){
		_debug('postAll');
		
		//build an array of objects to post
		var localStore =[];
		
		for (var i=0;i<storage.length;i++){
			var obj = _getObj(i);
			//only post clickState items that are marked as 'clickStore',
			//and not posted (we don't want to post the same details over and over);
			if (_isClickStore(obj) && !_isPosted(obj)){
				localStore.push(JSON.stringify(obj));
			}
		}
		//before POSTing, check that we actually have something to POST
		if (localStore.length > 0){
			
			_debug(' - SUBMITTING:');
			_debug(JSON.stringify(localStore));
			
			$.ajax({
				url:settings.post.URL,
				data:JSON.stringify(localStore),
				type:'POST',
				success:function(){
					_debug(' - POST success');
					_markAllItemsAsPosted();
				},
				error:function(){
					_debug(' - POST fail');
					if (settings.post.treatFailAsSuccess){
						_debug(' - treating fail as Success...');
						_markAllItemsAsPosted();
					}
				}
			});
		}
		else
		{
			_debug(' - Nothing to submit');
		}
	},

	//display debug information
	_debug = function(msg){
		if (settings.debug){
			if (typeof console == "object"){
				console.info(msg);
			}
		}
	},

	//update all clickState objects as posted. This is to prevent already submitted
	//objects from being being posted again (unless they change)
	_markAllItemsAsPosted = function(){
		_debug('markAllItemsAsPosted');
		//update storage to mark posted items as posted   
		for(var i=0;i<storage.length;i++){
			var obj = _getObj(a);
			//remove the object from sessionState first
			_removeObj(obj);
			_debug(' - marking obj as posted');
			//update the posted attribute
			obj.posted = true;
			//re-store the object in sessionState
			_storeObj(obj);
		}
	},

	//mark the supplied object as posted. This is to prevent this object being submitted
	//again, unless it has changed
	_markItemAsPosted = function(obj){
		//remove the object from sessionState first
		_removeObj(obj);
		_debug(' - marking obj as posted');
		//update the posted attribute
		obj.posted = true;
		//re-store the object in sessionState
		_storeObj(obj);
	},

	//remove the given object from sessionState
	_removeObj = function(obj){
		_debug(' - removeObj');
		var key = _getStorageKey(obj); 
		storage.removeItem(key);
	},

	//store the supplied object in sessionState
	_storeObj = function(obj){
		_debug(' - storeObj');
		var key = _getStorageKey(obj); 
		storage.setItem(key, JSON.stringify(obj));
	},

	//return whether the supplied object is a clickStore object
	//(note that other objects may be stored in sessionStorage and we're not interested in them!)
	_isClickStore = function(obj){
		try{
			_debug(' - isClickStore: ' + obj.clickStore);
			return obj.clickStore == true;
		}
		catch(err){
			_debug(' - isClickStore: false');
			return false;
		}
	},

	//return whether the supplied object has been posted
	//note that changes to clickStore objects (via _storeItem) cause posted to be false
	_isPosted = function(obj){
		try{
			_debug(' - isPosted: ' + obj.posted);
			return obj.posted == true;
		}
		catch(err){
			_debug('isPosted: false');
			return false;
		}
	}

	return {
		init : _init
	}
}();


