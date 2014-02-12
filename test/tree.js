var path = require('path');
var test = require('tape');
var util = require('util');

var curryFolder = require('../');

test('tree - structure', function(t){

	t.plan(1);

	var tree = curryFolder(__dirname + '/files', {tree: true, includeExt: true} );
	var res = !!(tree.html["html_file1.html"] && tree.html["html_file2.html"] && tree.html["html_file3.html"]
				&& tree.js.jsone["jsone_file1.js"] && tree.js.jsone["jsone_file2.js"] && tree.js.jsone["jsone_file3.js"] 
				&& tree.js["js_file1.js"]
				&& tree.json.jsonone["jsonone_file.json"]);

	t.equal(res, true);
});

test('tree - evaluate', function(t){

	t.plan(2);

	var tree = curryFolder(__dirname + '/files', {tree: true, includeExt: true} );
	var evaluated = tree([1, 2, 3]);

	var expected = "<html><body>html_file3.html</body></html>"
				+ "jsone_file2.js"+1+2+3
				+ "function (){}"
				+ "foobar";

	var res = evaluated.html["html_file3.html"] 
				+ evaluated.js.jsone["jsone_file2.js"]
				+ evaluated.js["js_file1.js"]
				+ evaluated.json.jsonone["jsonone_file.json"].jsonone_file;

	t.equal(res, expected)

	evaluated = evaluated()
	res = evaluated.html["html_file3.html"] 
			+ evaluated.js.jsone["jsone_file2.js"]
			+ evaluated.js["js_file1.js"]
			+ evaluated.json.jsonone["jsonone_file.json"].jsonone_file;

	t.equal(res, expected)

});
