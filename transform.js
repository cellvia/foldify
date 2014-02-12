var fs = require('fs');
var path = require('path');
var util = require('util');

var through = require('through');
var falafel = require('falafel');
var unparse = require('escodegen').generate;
var minimatch = require('minimatch');

var bindShim = 'Function.prototype.bind||(Function.prototype.bind=function(a){if("function"!=typeof this)throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");var b=Array.prototype.slice.call(arguments,1),c=this,d=function(){},e=function(){return c.apply(this instanceof d&&a?this:a,b.concat(Array.prototype.slice.call(arguments)))};return d.prototype=this.prototype,e.prototype=new d,e});';

module.exports = function (file) {
    if (/\.json$/.test(file)) return through();
    var data = '';
    var curryNames = {};
    var vars = [ '__dirname' ];
    var dirname = path.dirname(file);
    var pending = 0;
    var foldifyLocation = ~dirname.indexOf(path.join('foldify', 'test')) ? '../' : 'foldify';

    var tr = through(write, end);
    return tr;

    function containsUndefinedVariable (node) {
        if (node.type === 'Identifier') {
            if (vars.indexOf(node.name) === -1) {
                return true;
            }
        }
        else if (node.type === 'BinaryExpression') {
            return containsUndefinedVariable(node.left)
                || containsUndefinedVariable(node.right)
            ;
        }
        else {
            return false;
        }
    };
    
    function write (buf) { data += buf }
    function end () {
        try { var output = parse() }
        catch (err) {
            this.emit('error', new Error(
                err.toString().replace('Error: ', '') + ' (' + file + ')')
            );
        }
        
        if (pending === 0) finish(output);
    }
    
    function finish (output) {
        tr.queue(String(output));
        tr.queue(null);
    }
    
    function parse () {
        var output = falafel(data, function (node) {
            var args = node.arguments;
            var check;
            if(isRequire(node)){
                if(args[0] && args[0].value === 'foldify'){
                    check = true;
                }else if(args[0]){
                    try{
                        check = require.resolve(dirname + '/' + eval(unparse(args[0])));
                        check = check.split(path.sep);
                        var check2 = check.slice(check.indexOf("foldify")+1)                        
                        check = check2.length === 1;
                    }catch(e){}
                }
            }

            if (isRequire(node) && check
            && node.parent.type === 'VariableDeclarator'
            && node.parent.id.type === 'Identifier') {
                curryNames[node.parent.id.name] = true;
            }
            if (isRequire(node) && check
            && node.parent.type === 'AssignmentExpression'
            && node.parent.left.type === 'Identifier') {
                curryNames[node.parent.left.name] = true;
            }
            
            if ( isCurry(node) && !containsUndefinedVariable(args[0]) ) {
                
                var thisDir = unparse(args[0]),
                    thisDirParsed = eval(thisDir),
                    fpath = path.normalize( Function(vars, 'return ' + thisDir)(dirname) ),
                    thisOpts = args[1] ? eval("(" + unparse(args[1]) + ")") : {},
                    obj = "",
                    existingProps = [],
                    separator,
                    resolved,
                    parts,
                    files = [];

                if(typeof thisOpts !== "object"){
                    return tr.emit('error', 'foldify (browserify) second argument must be an options object');
                }

                var toString = thisOpts.output && thisOpts.output.toLowerCase() === "string",
                    toArray = thisOpts.output && thisOpts.output.toLowerCase() === "array";

                try{
                    if(~thisDirParsed.indexOf("/"))
                        separator = "/";
                    if(~thisDirParsed.indexOf("\\"))
                        separator = "\\";
                    parts = thisDirParsed.split(separator);
                    resolved = path.dirname( require.resolve( parts[0] + separator + 'package.json' ) );
                    if(!~resolved.indexOf("node_modules")) throw "not a node module";
                    fpath = resolved + path.sep + parts.slice(1).join(separator);                    
                }catch(err){}

                obj+= "((function(){ ";
                obj+= bindShim;
                
                if(toString){
                    obj+= "var returnMe = '';";                                    
                }
                else if(toArray){
                    obj+= "var returnMe = [];";
                }else{
                    obj+= "var curry = require("+JSON.stringify(foldifyLocation)+"), proxy = {}, map = false;";
                    obj+= thisOpts.tree ? "map = {};" : "";
                    obj+= "var returnMe = curry.bind({curryStatus: true, map: map}, proxy);";
                }

                function recurs(dirname2){
                    fs.readdirSync(dirname2).forEach(function(file){
                        var filepath = path.join( dirname2, file);
                        if(path.extname(file) === ''){
                          if(thisOpts.recursive || thisOpts.tree) recurs(filepath);
                          return  
                        } 
                        files.push(filepath);
                    });
                }
                recurs(fpath);

                if(thisOpts.whitelist) files = whitelist(thisOpts.whitelist, files, path.resolve(fpath) );
                if(thisOpts.blacklist) files = blacklist(thisOpts.blacklist, files, path.resolve(fpath) );

                files.forEach(function(filepath){
                    var ext = path.extname(filepath),
                        name = path.basename(filepath, ext),
                        filename = name + ext,
                        isJs = ext === ".js" || ext === ".json",
                        propname;

                    if( toString ){
                        obj += "returnMe += " + JSON.stringify(fs.readFileSync(filepath, "utf-8")) + ";";                 
                        return
                    }

                    if( toArray ){
                        obj += "returnMe.push( " + JSON.stringify(fs.readFileSync(filepath, "utf-8")) + ");";                 
                        return
                    }

                    if((isJs && thisOpts.jsToString) || !isJs)
                        toRequire = JSON.stringify(fs.readFileSync(filepath, 'utf-8'));
                    else
                        toRequire = "require("+JSON.stringify(filepath)+")";

                    if(!thisOpts.includeExt && (isJs || thisOpts.includeExt === false) )
                        propname = JSON.stringify(name);
                    else
                        propname = JSON.stringify(filename);

                    if(thisOpts.fullPath || ~existingProps.indexOf(propname) )
                        propname = filepath;
                    else
                        existingProps.push(propname);                            

                    if(thisOpts.tree){
                        var paths = path.relative(fpath, filepath).split(path.sep);
                        obj+="var paths = " + JSON.stringify(paths) + ";";
                        obj+="var last, thismap;";
                        obj+="for(var x = 0, len = paths.length; x<len; x++){";
                            obj+="if(x===0){";
                                obj+="if(!returnMe[ paths[x] ] )";
                                    obj+="returnMe[ paths[x] ] = {};";
                                obj+="last = returnMe[ paths[x] ];";
                                obj+="if(!map[ paths[x] ] )";
                                    obj+="map[ paths[x] ] = {};";
                                obj+="thismap = map[ paths[x] ]";
                            obj+="}else if(x < (len-1)){";
                                obj+="if(!last[ paths[x] ] )";
                                    obj+="last[ paths[x] ] = {};";
                                obj+="last = last[paths[x]];";
                                obj+="if(!thismap[ paths[x] ] )";
                                    obj+="thismap[ paths[x] ] = {};";
                                obj+="thismap = thismap[ paths[x] ];";
                            obj+="}else{";
                                obj+="last[ " + propname + " ] = " + toRequire + ";";
                                obj+="thismap[ " + propname + " ] = true;";
                            obj+="}";
                        obj+="}";
                    }else{
                        obj += "returnMe[" + propname + "] = " + toRequire + ";";                    
                    }

                });
                
                if(!toString && !toArray)
                    obj+= "for(var p in returnMe){ proxy[p] = returnMe[p]; }";
                obj += "return returnMe;})())";
                node.update(obj);
            }
        });
        return output;
    }
    
    function isCurry (node) {
        if (!node) return false;
        if (node.type !== 'CallExpression') return false;
        return node.callee.type === 'Identifier' && curryNames[node.callee.name];
    }

    function whitelist(whitelist, files, rootdir){
        if(!whitelist || !files) return
        rootdir = rootdir || "";
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
        rootdir = rootdir || "";
        files = files.filter(function(name){
            return !blacklist.some(function(rule){
                rule = path.join( rootdir, rule );
                return minimatch(name, rule);
            });
        });
        return files
    }
};

function isRequire (node) {
    var c = node.callee;
    return c
        && node.type === 'CallExpression'
        && c.type === 'Identifier'
        && c.name === 'require'
    ;
}
