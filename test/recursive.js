var path = require('path');
var test = require('tape');
var util = require('util')

var curryFolder = require('../');

test('recursive - structure', function(t){

	t.plan(1);

	var tree = curryFolder(path.join(__dirname, 'files'), {recursive: true, includeExt: true} );

	var res = !!(tree["html_file1.html"] && tree["html_file2.html"] && tree["html_file3.html"]
				&& tree["jsone_file1.js"] && tree["jsone_file2.js"] && tree["jsone_file3.js"] 
				&& tree["js_file1.js"]
				&& tree["jsonone_file.json"]);

	t.equal(res, true);
});

test('recursive - evaluate', function(t){

	t.plan(2);

	var tree = curryFolder(path.join(__dirname, 'files'), {recursive: true, includeExt: true} );
	var evaluated = tree([1, 2, 3]);

	var expected = "<html><body>html_file3.html</body></html>"
				+ "jsone_file3.js"+1+2+3
				+ "function (){}"
				+ "foobar";

	var res = evaluated["html_file3.html"] 
				+ evaluated["jsone_file3.js"]
				+ evaluated["js_file1.js"]
				+ evaluated["jsonone_file.json"].jsonone_file;

	t.equal(res, expected)

	evaluated = evaluated()
	res = evaluated["html_file3.html"] 
			+ evaluated["jsone_file3.js"]
			+ evaluated["js_file1.js"]
			+ evaluated["jsonone_file.json"].jsonone_file;

	t.equal(res, expected)

});

