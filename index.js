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
		options,
		individual,
		originalFullPath;

	if(util.isArray(toBeCurried)){
		options = moreArgs[0];
		originalFullPath = options.fullPath;
		_.each(toBeCurried, function(toCurry){
			individual = curry.call(this, toCurry, options)
			for(var prop in individual){
				if(mergeToMe[prop]){
					options.fullPath = true;
					individual = curry.call(this, toCurry, options);
					options.fullPath = originalFullPath;
					break;
				}
			}
			_.extend(mergeToMe, individual);
		});
		return _.bind(curry, "curried", mergeToMe);
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
			combined = _.extend(curry, toBeCurried);
			for(var name in combined){
				if( (options.whitelist && !checkList(options.whitelist, name))
				  || (options.blacklist && checkList(options.blacklist, name)) )
					delete combined[name];
			}
			output = _.bind(combined, "curried", combined);
		break;
	}

	return output;

};

function checkList(list, name){
	list = util.isArray(list) ? list : [list];
	return _.some(list, function(rule){
		rule = "**" + path.sep + rule;
		return minimatch(name, rule);
	});
}

function populate(dirname, options){
	if(!fs) throw "you must run the curryFolder browserify transform (curryFolder/transform.js) for curryFolder to work in the browser!";
	var proxy = {},
		returnObj = _.bind(curry, "curried", proxy),
		existingProps = [],
		newdirname,
		separator,
		parts;

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
		fs.readdirSync(thisDir).forEach(function(filename){
			var ext = path.extname(filename),
				isJs = (ext === ".js" || ext === ".json"),
				isDir = ext === '',
				name = path.basename(filename, ext),
				filepath = path.join(thisDir, filename),
				propname;

			if(isDir){
				if(options.recursive) recurs(filepath);
				return
			}

			if( (options.whitelist && !checkList(options.whitelist, filename))
			  || (options.blacklist && checkList(options.blacklist, filename)) )
				return;

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

function evaluate(srcObj, args, options){
	var proxy = {}, node, isWhitelisted, isBlacklisted;
	if(options.evaluate === false)
		returnObj = _.bind(curry, "curried", proxy, args);
	else
		returnObj = _.bind(curry, "curried", proxy);
	for(var prop in srcObj){

		if(options.whitelist && !checkList(options.whitelist, prop))
			continue;

		if(options.blacklist && checkList(options.blacklist, prop))
			continue;

		node = srcObj[prop];
		if(options.evaluate !== false && typeof node === "function")
			returnObj[prop] = proxy[prop] = node.apply(srcObj, args)
		else
			returnObj[prop] = proxy[prop] = _.bind(node, srcObj, args);
		
		if(typeof proxy[prop] === "undefined" && !options.allowUndefined){
			if(options.trim === true){
				delete proxy[prop];
				delete returnObj[prop];				
			}else{
				returnObj[prop] = proxy[prop] = _.bind(node, srcObj, args);
			}
		}
	}
	return returnObj;
}
