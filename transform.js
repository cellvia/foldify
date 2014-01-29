var fs = require('fs');
var path = require('path');
var util = require('util');

var through = require('through');
var falafel = require('falafel');
var unparse = require('escodegen').generate;
var minimatch = require('minimatch');

var bindShim = 'if (!Function.prototype.bind) {
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
}';

var someShim = "if (!Array.prototype.some)
{
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
}";

module.exports = function (file) {
    if (/\.json$/.test(file)) return through();
    var data = '';
    var curryNames = {};
    var vars = [ '__filename', '__dirname' ];
    var dirname = path.dirname(file);
    var pending = 0;

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
            if (isRequire(node) && node.arguments[0].value === 'curryFolder'
            && node.parent.type === 'VariableDeclarator'
            && node.parent.id.type === 'Identifier') {
                curryNames[node.parent.id.name] = true;
            }
            if (isRequire(node) && node.arguments[0].value === 'curryFolder'
            && node.parent.type === 'AssignmentExpression'
            && node.parent.left.type === 'Identifier') {
                curryNames[node.parent.left.name] = true;
            }
            
            var args = node.arguments;
            if ( isCurry(node) && !containsUndefinedVariable(args[0]) ) {
                
                var thisDir = unparse(args[0]),
                    thisDirParsed = eval(thisDir),
                    fpath = path.normalize( Function(vars, 'return ' + thisDir)(file, dirname) ),
                    thisOpts = args[1] ? eval("(" + unparse(args[1]) + ")") : {},
                    obj = "",
                    existingProps = [],
                    separator,
                    resolved,
                    parts;

                if(typeof thisOpts !== "object"){
                    return tr.emit('error', 'curryFolder (browserify) second argument must be an options object');
                }

                var toString = thisOpts.output.toLowerCase() === "string",
                    toArray = thisOpts.output.toLowerCase() === "array";

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
                obj+= bindShim + someShim;
                
                if(toString){
                    obj+= "var returnMe = ''";                                    
                }
                else if(toArray){
                    obj+= "var returnMe = [];";
                }else{
                    obj+= "var curry = require('curryFolder'), proxy = {};";
                    obj+= "var returnMe = curry.bind('curried', proxy);";
                }

                function recurs(dirname2){
                    var files = fs.readdirSync(dirname2);

                    files.forEach(function(filename){
                        var filepath = path.join(dirname2,filename),
                            ext = path.extname(filename),
                            name = path.basename(filename, ext),
                            isJs = ext === ".js" || ext === ".json",
                            isDir = ext === '',
                            propname;

                        if(isDir){
                            if(thisOpts.recursive) recurs(filepath);
                            return
                        }

                        if(  (thisOpts.whitelist && !checkList(thisOpts.whitelist, filepath))
                          || (thisOpts.blacklist && checkList(thisOpts.blacklist, filepath))  )
                            return;

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

                        obj += "returnMe[" + propname + "] = " + "proxy[" + propname + "] = " + toRequire + ";";
                    });
                }
                recurs(fpath);
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

    function checkList(list, name){
        list = util.isArray(list) ? list : [list];
        return list.some(function(rule){
            rule = "**" + path.sep + rule;
            return minimatch(name, rule);
        });
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
