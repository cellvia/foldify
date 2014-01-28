# curryFolder

Import / require folder(s) of any type of files, and evaluate / curry the results.

## Features

###completed:
server side and client side support (via supplied browserify transform)  
can include npm modules or subfolders of npm modules (if you want to grab specific folder of css/less files from a module for example)  
functional (continuously returns itself as a function, endlessly iterable)  
whitelist / blacklist files or properties at each iteration  
compatible with for...in (no additional hidden properties or prototype to sort through)

###yet to be completed:
return a tree instead of flat literal, based on folder structure  
ability to wrap a function around results  
tests >_<

## Initializing the hash

When the hash is initializaed the result is an object literal with property names taken from the individual filenames, and content taken from the respective files.  
.js and .json files are require() into the hash, while all other files are fs.readFileSync().  

Will return something like:
```javascript
{ 	filename: require("filename.js"), 
	filename2: fs.readFileSync("filename.html") }
```

### curryFolder( dirname, [options] );

**dirname** may be a path to a folder, node module, node module subdir path (ex: "curryFolder/test"), object, or array of any of these.

In the case of an object, it is simply returned wrapped with the curryFolder functionality.

```javascript
var curryFolder = require("curryFolder");

var errorControllers = curryFolder(__dirname + "/lib/controllers/errors");
```

Even just this object can be useful:
```javascript
//with a folder structure like:
// ~/lib/controllers/errors/
//                      .../500.js
//                      .../403.js
//                      .../402.js

app.get( '/500', errorControllers.500 );
app.get( '/403', errorControllers.403 );
app.get( '/402', errorControllers.402 );
```

also for...in compatible:
```javascript
for(var controllerName in errorControllers){
	app.get( '/' + controllerName, errorControllers[controllerName] );
}
```

## Initialization Options

### recursive (default: false) 

Include subfolders.

### whitelist

Uses 'minimatch' upon filepaths using supplied whitelist patterns.  Accepts string or array.

### blacklist

Uses 'minimatch' upon filepaths using supplied blacklist patterns.  Accepts string or array.

### includeExt

When generating the property names for the hash, this determines whether to include extensions.  Default is false for .js and .json, and true for all others.  Manually setting this option will apply it to all filetypes.

### fullPath (default: false)

When generating the property names for the hash, this determines whether to use the full path as the property name.  This is defaulted to for cases of duplicate property names.  
One benefit of fullPath is more flexibility with minimatch white/black listing upon evaluation.

### jsToString (default: false)

Import js / json files as strings rather than require them.

## Evaluating the hash

Once the hash is initialized, it becomes a function that can be evaluated.  It is also an object whose properties make up the hash.  Everytime the function is evaluated, it returns another function-object that can also be evaluated.

Evaluation is very useful when keeping folders of files that are functions taking similar arguments.  

For example a single file within a folder of express routes would look like this:
```javascript
module.exports = function(app){
	app.get('/', function(req, res){ res.end("hello world"); });
}
```

### evaluateHash( [args], [options] );

**args** is optional, and may be a single argument, or an array of arguments.  If you would like to pass in an array, you must encapsulate it with another array, or it will be parsed as if the values within that array represent arguments.

Following from the example above, to attach all routes to the same express app:
```javascript
var app = express();
var curryFolder = require("curryFolder");

var routes = curryFolder(__dirname + "/routes");

routes(app);
```

## Evaluation options

### whitelist

Uses 'minimatch' upon property names using supplied whitelist pattern(s).  Accepts string or array.

### blacklist

Uses 'minimatch' upon property names using supplied blacklist pattern(s).  Accepts string or array.

### evaluate (default: true)

Set to false if you only want to curry the hash's functions.

With a folder 'mathFuncs' with files like:
```javascript
module.exports = sum;
function sum(){
	var sum = [].slice.call(arguments, 0)
				.reduce(function(prev, current){ return (+prev || 0) + (+current || 0); });
	console.log("sum = " + sum);
}
```

```javascript
var curryFolder = require("curryFolder");
var mathFuncs = curryFolder(__dirname + "/lib/mathFuncs");

//To curry only, set 'evaluate' to false:
var curried = mathFuncs(1, {evaluate: false});

var curried2 = curried([2,3], {evaluate: false});

curried()
//sum = 1

curried2()
//sum = 6
```

### trim (default: false)

If a function or property evaluates to undefined, remove it.

### allowUndefined (default: false)

If **allowUndefined** is true, functions may return undefined into the hash instead of a curried version of itself:

```javascript
var curried3 = curried2(10, {allowUndefined: true});
//sum = 16

typeof curried3.mathFunc // undefined

curried3()
//cannot curry or evaluate further
```

Normally, when evaluated function returns undefined, the function itself will be placed into the hash (with the original arguments curried):

```javascript
var curried3 = curried2(10);
//sum = 16

typeof curried3.mathFunc // function

curried3()
//sum = 16

var curried4 = curried3(20)
//sum = 36

curried4()
//sum = 46
```
