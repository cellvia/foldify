var fs = require('fs'),
	path = require('path'),
	util = require('util'),
	minimatch = require('minimatch');

module.exports = curry;

function curry(toBeCurried){
	if(!toBeCurried) return false;
	var moreArgs = [].slice.call(arguments, 1),
		mergeToMe = {},
		options,
		individual,
		originalFullPath;

	if(util.isArray(toBeCurried)){
		options = moreArgs[0];
		originalFullPath = options.fullPath;
		toBeCurried.forEach(function(toCurry){
			individual = curry.call(this, toCurry, options)
			for(var prop in individual){
				if(mergeToMe[prop]){
					options.fullPath = true;
					individual = curry.call(this, toCurry, options);
					options.fullPath = originalFullPath;
					break;
				}
			}
			for (var prop in individual) {
	          mergeToMe[prop] = individual[prop];
	        }
		});
		return curry.bind( "curried", mergeToMe );
	}

	var	beingCurried = this && this.curryStatus,
		isObj = typeof toBeCurried === "object" && !beingCurried,
		isCurryObj = typeof toBeCurried === "object" && beingCurried,
		isDir = typeof toBeCurried === "string",
		args,
		output,
		combined;
	
	switch(false){
		case !isDir:
			options = moreArgs[0] || {};
			output = populate.apply(this, [toBeCurried, options]);
		break;
		case !isCurryObj:
			args = moreArgs[0] || [];
			args = util.isArray(args) ? args : [args]
			if(this.curryStatus === "curryOnly"){
				args2 = moreArgs[1] || [];
				args2 = util.isArray(args2) ? args2 : [args2]
				args = args.concat(args2);
				options = moreArgs[2] || {};				
			}else{
				options = moreArgs[1] || {};
			}
			output = evaluate.apply(this, [toBeCurried, args, options]);
		break;
		case !isObj:
			options = moreArgs[0] || {};
			for(var name in toBeCurried){
				if( (options.whitelist && !checkList(options.whitelist, name))
				  || (options.blacklist && checkList(options.blacklist, name)) )
					continue
				curry[name] = toBeCurried[name];
			}
			output = curry.bind( {curryStatus: true}, curry );
		break;
	}

	return output;

};

function populate(dirname, options){
	if(!fs) throw "you must run the curryFolder browserify transform (curryFolder/transform.js) for curryFolder to work in the browser!";
	var proxy = {},
		toString = options.output && options.output.toLowerCase() === "string",
		toArray = options.output && options.output.toLowerCase() === "array",
		returnMe,
		existingProps = [],
		newdirname,
		separator,
		parts,
		map = options.tree ? {} : false,
		files = [];

	if(toString){
		returnMe = "";
	}else if(toArray){
		returnMe = [];
	}else{
		returnMe = curry.bind( { curryStatus: true, map: map }, proxy );
	}

    try{
	    if(~dirname.indexOf("/"))
	        separator = "/";
	    if(~dirname.indexOf("\\"))
	        separator = "\\";
	    parts = dirname.split(separator);
        newdirname = path.dirname( require.resolve( parts[0] ) );
    	if(!~newdirname.indexOf("node_modules")) throw "not a node module";
        dirname = newdirname + path.sep + parts.slice(1).join(path.sep);
    }catch(err){}


    function recurs(thisDir){
        fs.readdirSync(thisDir).forEach(function(file){
            var filepath = path.join( thisDir, file);
            if(path.extname(file) === ''){
              if(options.recursive || options.tree) recurs(filepath);
              return  
            } 
            files.push(filepath);        		
        });
    }
    recurs(dirname);

    if(options.whitelist) files = whitelist(options.whitelist, files, dirname)
    if(options.blacklist) files = blacklist(options.blacklist, files, dirname)

	files.forEach(function(filepath){
		var ext = path.extname(filepath),
			name = path.basename(filepath, ext),
			filename = name + ext,
			isJs = (ext === ".js" || ext === ".json"),
			isDir = ext === '',
			propname,
			add,
			last = false;

		if( toString ){
			returnMe += fs.readFileSync(filepath, "utf-8");					
			return
		}

		if( toArray ){
			returnMe.push( fs.readFileSync(filepath, "utf-8") );
			return
		}

		if(!options.includeExt && (isJs || options.includeExt === false) )
			propname = name;
		else
			propname = filename;

		if(!options.tree){
	        if(options.fullPath || ~existingProps.indexOf(propname) )
	            propname = path.relative(dirname, filepath);
	        else
	            existingProps.push(propname);			
		}

		if((isJs && options.jsToString) || !isJs )
			add = fs.readFileSync(filepath, "utf-8");
		else
			add = require(filepath);

		if(map){
			var paths = path.relative(dirname, filepath).split(path.sep);
			var last, thismap;
			for(var x = 0, len = paths.length; x<len; x++){
				if(x===0){
					if(!returnMe[ paths[x] ] )
						returnMe[ paths[x] ] = {};
					last = returnMe[ paths[x] ]
					if(!map[ paths[x] ] )
						map[ paths[x] ] = {};
					thismap = map[ paths[x] ]
				}else if(x < (len-1)){
					if(!last[ paths[x] ] )
						last[ paths[x] ] = {};
					last = last[paths[x]];
					if(!thismap[ paths[x] ] )
						thismap[ paths[x] ] = {};
					thismap = thismap[ paths[x] ];
				}else{
					last[ propname ] = add;
					thismap[ propname ] = true;
				}
			}
		}else{
			returnMe[propname] = add;
		}
		
	});

	for(var p in returnMe) proxy[p] = returnMe[p];
	return returnMe;
}	

function evaluate(srcObj, args, options){
	var proxy = {}, returnObj;
	if(options.evaluate === false){
		this.curryStatus = "curryOnly";
		returnObj = Function.prototype.bind.apply( curry, [this, proxy].concat([args]) );
	}
	else
		returnObj = curry.bind( this, proxy );

	var objpaths = flatten.call(this.map, srcObj);

	for(var objpath in objpaths){
		var isWhitelisted = false,
			isBlacklisted = false,
			skip = false,
			add = false,
			node = false,
			last = false;

		if(options.whitelist && checkList(options.whitelist, objpath))
			isWhitelisted = true;

		if(options.blacklist && checkList(options.blacklist, objpath))
			isBlacklisted = true;

		skip = (options.whitelist && !isWhitelisted) || isBlacklisted;

		if(skip && options.trim) continue;

		add = node = objpaths[objpath];

		if(!skip && typeof node === "function")
			add = options.evaluate !== false ? node.apply( srcObj, args) : Function.prototype.bind.apply( node, [srcObj].concat(args) );
		
		if(typeof add === "undefined" && options.allowUndefined !== true && options.trim)
			continue

		if(typeof add === "undefined" && options.allowUndefined !== true)
			add = node

		if(this.map){
			paths = objpath.split(path.sep);
			for(var x = 0, len = paths.length; x<len; x++){
				if(x===0){
					if(!returnObj[ paths[x] ] )
						returnObj[ paths[x] ] = {};
					last = returnObj[ paths[x] ]
				}else if(x < (len-1)){
					if(!last[ paths[x] ] )
						last[ paths[x] ] = {};
					last = last[paths[x]];
				}else{
					last[ paths[x] ] = add;
				}
			}			
		}else{
			returnObj[objpath] = add;
		}
	}

	for(var p in returnObj) proxy[p] = returnObj[p];
	return returnObj;
}

function checkList(list, name){
	list = util.isArray(list) ? list : [list];
	return list.some(function(rule){
		return minimatch(name, path.normalize(rule));
	});
}

function whitelist(whitelist, files, rootdir){
    if(!whitelist || !files) return
    var output = [];
    whitelist = util.isArray(whitelist) ? whitelist : [whitelist];
    whitelist.forEach(function(rule){
        rule = path.join( rootdir || "", rule );
        files.forEach( function(name){
            if(~output.indexOf(name)) return
            if( minimatch(name, rule) )
                output.push(name);
        }) 
    });
    return output;
}

function blacklist(blacklist, files, rootdir){
    if(!blacklist || !files) return
    blacklist = util.isArray(blacklist) ? blacklist : [blacklist];

    return files.filter(function(name){
        return !blacklist.some(function(rule){
            rule = path.join( rootdir || "", rule );
            return minimatch(name, rule)
        });
    });
}

function flatten(obj, _path, result) {
  if(!this) return obj;
  var key, val, __path;
  _path = _path || [];
  result = result || {};
  for (key in obj) {
    val = obj[key];
    __path = _path.concat([key]);
    if (this[key] && this[key] !== true) {
      flatten.call(this[key], val, __path, result);
    } else {
      result[__path.join(path.sep)] = val;
    }
  }
  return result;
};

if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (searchElement, fromIndex) {
      if ( this === undefined || this === null ) {
        throw new TypeError( '"this" is null or not defined' );
      }

      var length = this.length >>> 0; // Hack to convert object.length to a UInt32

      fromIndex = +fromIndex || 0;

      if (Math.abs(fromIndex) === Infinity) {
        fromIndex = 0;
      }

      if (fromIndex < 0) {
        fromIndex += length;
        if (fromIndex < 0) {
          fromIndex = 0;
        }
      }

      for (;fromIndex < length; fromIndex++) {
        if (this[fromIndex] === searchElement) {
          return fromIndex;
        }
      }

      return -1;
    };
  }
if (!Array.prototype.forEach) {
  Array.prototype.forEach = function(fun /*, thisArg */)
  {
    "use strict";

    if (this === void 0 || this === null)
      throw new TypeError();

    var t = Object(this);
    var len = t.length >>> 0;
    if (typeof fun !== "function")
      throw new TypeError();

    var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
    for (var i = 0; i < len; i++)
    {
      if (i in t)
        fun.call(thisArg, t[i], i, t);
    }
  };
}
if (!Array.prototype.some) {
  Array.prototype.some = function(fun /*, thisArg */)
  {
    'use strict';

    if (this === void 0 || this === null)
      throw new TypeError();

    var t = Object(this);
    var len = t.length >>> 0;
    if (typeof fun !== 'function')
      throw new TypeError();

    var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
    for (var i = 0; i < len; i++)
    {
      if (i in t && fun.call(thisArg, t[i], i, t))
        return true;
    }

    return false;
  };
};
if (!Function.prototype.bind) {
  Function.prototype.bind = function (oThis) {
    if (typeof this !== "function") {
      // closest thing possible to the ECMAScript 5 internal IsCallable function
      throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
    }

    var aArgs = Array.prototype.slice.call(arguments, 1), 
        fToBind = this, 
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(this instanceof fNOP && oThis
                                 ? this
                                 : oThis,
                               aArgs.concat(Array.prototype.slice.call(arguments)));
        };

    fNOP.prototype = this.prototype;
    fBound.prototype = new fNOP();

    return fBound;
  };
};
