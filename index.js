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

	var	beingCurried = this == "curried",
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
			args2 = moreArgs[1] || [];
			args2 = util.isArray(args2) ? args2 : [args2]
			args = args.concat(args2);
			options = moreArgs[2] || {};
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
			output = curry.bind( "curried", curry );
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
		files = [];

	if(toString){
		returnMe = "";
	}else if(toArray){
		returnMe = [];
	}else{
		returnMe = curry.bind( "curried", proxy );
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
              if(options.recursive) recurs(filepath);
              return  
            } 
            files.push(filepath);
        });
    }
    recurs(dirname);

    if(options.whitelist) files = whitelist(options.whitelist, files, path.resolve(dirname))
    if(options.blacklist) files = blacklist(options.blacklist, files, path.resolve(dirname))

	files.forEach(function(filepath){
		var ext = path.extname(filepath),
			name = path.basename(filepath, ext),
			filename = name + ext,
			isJs = (ext === ".js" || ext === ".json"),
			isDir = ext === '',
			propname;

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

        if(options.fullPath || ~existingProps.indexOf(propname))
            propname = filepath;
        else
            existingProps.push(propname);                            

		if((isJs && options.jsToString) || !isJs )
			returnMe[propname] = proxy[propname] = fs.readFileSync(filepath, "utf-8");					
		else
			returnMe[propname] = proxy[propname] = require(filepath);
		
	});

	return returnMe;
}	

function evaluate(srcObj, args, options){
	var proxy = {}, node, isWhitelisted, isBlacklisted;
	if(options.evaluate === false)
		returnObj = curry.bind( "curried", proxy, args);
	else
		returnObj = curry.bind( "curried", proxy);

	for(var prop in srcObj){
		var isWhitelisted,
			isBlacklisted,
			skip;
		if(options.whitelist && checkList(options.whitelist, prop))
			isWhitelisted = true;

		if(options.blacklist && checkList(options.blacklist, prop))
			isBlacklisted = true;

		skip = (options.whitelist && !isWhitelisted) || isBlacklisted;

		if(options.trim && skip)
			continue

		node = srcObj[prop];
		if(!skip){
			if(options.evaluate !== false){
				if( typeof node === "function" )
					returnObj[prop] = proxy[prop] = node.apply(srcObj, args)
			} else {
				if( typeof node === "function" )
					returnObj[prop] = proxy[prop] = node.bind( srcObj, args);
			}
		}
		
		returnObj[prop] = proxy[prop] = proxy[prop] || node;

		if(typeof proxy[prop] === "undefined" && !options.allowUndefined){
			if(options.trim === true){
				delete proxy[prop];
				delete returnObj[prop];				
			}else{
				returnObj[prop] = proxy[prop] = node.bind( srcObj, args);
			}
		}
	}
	return returnObj;
}

function checkList(list, name){
	list = util.isArray(list) ? list : [list];
	return list.some(function(rule){
		return minimatch(name, rule);
	});
}

function whitelist(whitelist, files, rootdir){
    if(!whitelist || !files) return
    var output = [];
    whitelist = util.isArray(whitelist) ? whitelist : [whitelist];
    whitelist.forEach(function(rule){
        rule = path.join( rootdir, rule );
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
            rule = path.join( rootdir, rule );
            return minimatch(name, rule)
        });
    });
}

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
