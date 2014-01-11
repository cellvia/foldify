var fs = require('fs');
var path = require('path');

var through = require('through');
var falafel = require('falafel');
var unparse = require('escodegen').generate;

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
                    fpath = Function(vars, 'return ' + thisDir)(file, dirname),
                    thisOpts = args[1] ? eval(unparse(args[1])) : {},
                    obj = "",
                    existingProps = [],
                    separator,
                    newDir,
                    parts;

                if(typeof thisOpts !== "object") return tr.emit('error', 'curryFolder (browserify) second argument must be an options object');

                if(~thisDir.indexOf("/"))
                    separator = "/";
                if(~thisDir.indexOf("\\"))
                    separator = "\\";

                try{
                    parts = thisDir.split(separator);
                    newDir = path.dirname( require.resolve( parts.splice(0,1) ) );
                    if(!~newDir.indexOf("node_modules")) throw "not a node module";
                    thisDir = newDir + path.sep + parts.join(path.sep));
                }

                ++ pending;
                function recurs(dirname2){
                    fs.readdir(dirname2, function (err, files) {
                        if (err) return tr.emit('error', err);
                        obj+= "((function(){ var proxy = {};";
                        obj+= "if(!_) var _ = require('underscore');";
                        obj+= "var curry = require('curryFolder');";
                        obj+= "var returnMe = _.bind(curry, 'curried', proxy);";

                        files.forEach(function(filename){
                            var filepath = path.join(dirname2,filename),
                                ext = path.extname(filename),
                                name = path.basename(filename, ext),
                                isJs = ext === ".js" || ext === ".json",
                                isDir = ext === '',
                                propname;

                            if(thisOpts.recursive && isDir){
                                recurs(filepath);
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

                            if(thisOpts.fullPath || ~_.indexOf(existingProps, propname))
                                propname = filepath;
                            else
                                existingProps.push(propname);                            

                            obj += "returnMe[" + propname + "] = " + "proxy[" + propname + "] = " + toRequire + ";";
                        });
                        obj += "return returnMe;})())";
                        node.update(obj);
                        if (--pending === 0) finish(output);
                    });                    
                }
                recurs(fpath);
            }
        });
        return output;
    }
    
    function isCurry (node) {
        if (!node) return false;
        if (node.type !== 'CallExpression') return false;
        return node.callee.type === 'Identifier' && curryNames[node.callee.name];
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
