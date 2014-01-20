# curryFolder

Import / require entire folder(s), and evaluate / curry the results.

## Features

completed:
server side and client side support (via supplied browserify transform)
can include npm modules or subfolders of npm modules (if you want to grab specific folder of css/less files from a module for example)
functional (continuously returns itself as a function, endlessly iterable)
whitelist / blacklist files or properties at each iteration
compatible with for...in (no additional hidden properties or prototype to sort through)

yet to be completed:
return a tree instead of flat literal, based on folder structure
ability to wrap a function around results
if a function does not return or returns undefined (and trim is not set to true) return that same function but with previous arguments curried into it
tests >_<

## Usage

### Instantiate the curried folder

```javascript
var curryFolder = require("curryFolder");

var errorControllers = curryFolder(__dirname + "/lib/controllers/errors");
```

The result is an object literal with properties something very much like this would return: 
```javascript
{ 	filename: require(filename.js), 
	filename2: fs.readFileSync(filename.html) }
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

### Evaluate the hash

With a folder 'routes' with files like:
```javascript
module.exports = function(app){
	app.get('/', function(req, res){ res.end("hello world"); });
}
```

To attach all routes using the supplied variable:
```javascript
var app = express();
var curryFolder = require("curryFolder");

var routes = curryFolder(__dirname + "/lib/routes");

routes(app);
```



### Only curry the hash

With a folder 'matchFuncs' with files like:
```javascript
module.exports = sum;
function sum(){
	var sum = [].slice.call(arguments, 0)
				.reduce(function(prev, current){ return (+prev || 0) + (+current || 0); });
	console.log("sum = " + sum);
}
```

To curry only, set 'evaluate' to false:
```javascript
var curryFolder = require("curryFolder");
var mathFuncs = curryFolder(__dirname + "/lib/mathFuncs");

//does not evaluate
var curried = mathFuncs(1, {evaluate: false});

//evaluates, while also currying previous arguments
var curried2 = curried([2,3]);
//sum = 6

curried2(5)
//sum = 11

var curried3 = curried2(10);
//sum = 16

curried3(20)
//sum = 36
```

## Options

### recursive (default: false) 

Include subfolders.  Only available in initial import.

### whitelist

Uses 'minimatch' upon filepaths / property names using supplied whitelist patterns.  Can be supplied at any iteration.

### blacklist

Uses 'minimatch' upon filepaths / property names using supplied blacklist patterns.  Can be supplied at any iteration.

### trim (default: false)

If a function or property evaluates to undefined, remove it.

### evaluate (default: true)

Set to false if you want to curry the folder's functions instead of evaluate them.

### includeExt

When generating the initial object property names, whether to include extensions.  Default is false for .js and .json, and true for all others.  Manually setting this option will apply it to all filetypes.

### fullPath (default: false)

When generating the initial object property names, whether to use the full path.  Will happen automatically if duplicate filenames are encountered.

### jsToString (default: false)

Import js as string rather than evaluate it.
