var fs = require('fs'),
	path = require('path'),
	util = require('util'),
	minimatch = require('minimatch'),
	_ = require('underscore');

module.exports = curry;

function curry(toBeCurried){
	if(!toBeCurried) return false;
	var moreArgs = [].slice.call(arguments, 1),
		mergeToMe = {},
		theseArgs;

	if(util.isArray(toBeCurried)){
		options = _.clone(moreArgs[0]);
		options.fullPath = true;
		theseArgs = [toCurry].concat([options], moreArgs.slice(1));
		_.each(toBeCurried, function(toCurry){
			mergeToMe = _.extend(curry.apply(this, theseArgs), mergeToMe);
		}
		return _.bind(curry, "curried", mergeToMe);
	}

	var	beingCurried = this === "curried",
		isCurryObj = typeof toBeCurried === "object",
		isCurryDir = typeof toBeCurried === "string",
		args,
		options;

	if(!isCurryObj && !isCurryDir)
		return false
	
	if(isCurryObj && beingCurried){
		args = moreArgs[0] || [];
		args = util.isArray(args) ? args : [args]
		args2 = moreArgs[1] || [];
		args2 = util.isArray(args2) ? args2 : [args2]
		args = args.concat(args2);
		options = moreArgs[2] || {};
	}else{
		options = moreArgs[0] || {};
	}

	return isCurryDir ? populate.apply("curried", [toBeCurried, options]) : evaluate.apply("curried", [toBeCurried, args, options]);
	
};

function populate(dirname, options){
	if(!fs.readdirSync) throw "you must run the curryFolder browserify transform (curryFolder/transform.js) for curryFolder to work in the browser!";
	var proxy = {},
		returnObj = _.bind(curry, "curried", proxy),
		existingProps = [],
		newdirname,
		separator,
		parts;

    if(~dirname.indexOf("/"))
        separator = "/";
    if(~dirname.indexOf("\\"))
        separator = "\\";

    try{
	    parts = dirname.split(separator);
        newdirname = path.dirname( require.resolve( parts.splice(0,1) ) );
    	if(!~newdirname.indexOf("node_modules")) throw "not a node module";
        dirname = newdirname + path.sep + parts.join(path.sep));
    }

	function recurs(thisDir){
		fs.readdirSync(thisDir).forEach(function(filename){
			var ext = path.extname(filename),
				isJs = (ext === ".js" || ext === ".json"),
				isDir = ext === '',
				name = path.basename(filename, ext),
				filepath = path.join(thisDir, filename),
				propname;
			if(options.recursive && isDir){
				recurs(filepath);
				return
			}
			if(options.whitelist){
				options.whitelist = util.isArray(options.whitelist) ? options.whitelist : [options.whitelist];
				var isWhitelisted = _.some(options.whitelist, function(rule){
					return minimatch(rule, filename);
				});
				if(!isWhitelisted) return;
			}
			if(options.blacklist){
				options.blacklist = util.isArray(options.blacklist) ? options.blacklist : [options.blacklist];
				var isBlacklisted = _.some(options.blacklist, function(rule){
					return minimatch(rule, filename);
				});
				if(isBlacklisted) return;
			}

			if(!options.includeExt && (isJs || options.includeExt === false) )
				propname = name;
			else
				propname = filename;

	        if(options.fullPath || ~_.indexOf(existingProps, propname))
	            propname = filepath;
	        else
	            existingProps.push(propname);                            

			if((isJs && options.jsToString) || !isJs )
				returnObj[propname] = proxy[propname] = fs.readFileSync(filepath, "utf-8");					
			else
				returnObj[propname] = proxy[propname] = require(filepath);
			
		});			
	}
	recurs(dirname);
	return returnObj;
}	

function evaluate(obj, args, options){
	var proxy = {};
	if(options.curryOnly)
		returnObj = _.bind(curry, "curried", proxy, args);
	else
		returnObj = _.bind(curry, "curried", proxy);
	for(var name in obj){
		if(options.whitelist){
			options.whitelist = util.isArray(options.whitelist) ? options.whitelist : [options.whitelist];
			var isWhitelisted = _.some( options.whitelist, function(rule){
				return minimatch(rule, name);
			});
			if(!isWhitelisted) continue;
		}
		if(options.blacklist){
			options.blacklist = util.isArray(options.blacklist) ? options.blacklist : [options.blacklist];
			var isBlacklisted = _.some( options.blacklist, function(rule){
				return minimatch(rule, name);
			});
			if(isBlacklisted) continue;
		}

		var node = obj[name];
		if(!options.curryOnly && typeof node === "function")
			returnObj[name] = proxy[name] = node.apply(obj, args)
		else
			returnObj[name] = proxy[name] = node;
		
		if(options.trimUndefined === true && typeof proxy[name] === "undefined"){
			delete proxy[name];
			delete returnObj[name];
		}
	}
	return returnObj;
}
