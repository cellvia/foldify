var path = require('path');
var test = require('tape');
var util = require('util')

var curryFolder = require('../');

test('blacklist - populate', function(t){

	t.plan(1);

	var evaluate = curryFolder(__dirname + '/files', {blacklist: ["js/*.js", "/html/*1.html"], recursive: true} );
	var res = typeof evaluate["js_file1"]
			 + typeof evaluate["jsone_file1"]
			 + typeof evaluate["jsone_file2"]
			 + typeof evaluate["html_file1.html"];
	var expected = "undefined"
					+"function"
					+"function"
					+"undefined";

	t.equal(res, expected);

});

test('blacklist - evaluate + trim', function(t){

	t.plan(3);

	var evaluate = curryFolder(__dirname + '/files', {recursive: true} );
	t.equal(typeof evaluate["js_file1"], "function");

	var evaluated = evaluate([1,2,3], {blacklist: "js_file*", trim: true});
	var res = evaluated["js_file1"]
			 + evaluated["jsone_file1"]
			 + evaluated["jsone_file2"]
			 + evaluated["jsone_file3"];
	var expected = "undefined"
					+"jsone_file1.js"+1+2+3
					+"jsone_file2.js"+1+2+3
					+"jsone_file3.js"+1+2+3;

	t.equal(res, expected);

	evaluated = evaluated([], {blacklist: "*3", trim: true});
	var res = evaluated["js_file1"]
			 + evaluated["jsone_file1"]
			 + evaluated["jsone_file2"]
			 + evaluated["jsone_file3"];
	var expected = "undefined"
					+"jsone_file1.js"+1+2+3
					+"jsone_file2.js"+1+2+3
					+"undefined";

	t.equal(res, expected);

});

test('blacklist - tree + trim', function(t){

	t.plan(3);

	var evaluate = curryFolder(__dirname + '/files', {tree: true, includeExt: true} );
	t.equal(typeof evaluate.json.jsonone["jsonone_file.json"], "object");

	var evaluated = evaluate([1,2,3], {blacklist: ["**/*.js", "**/*.json"], trim: true});

	var res = evaluated.js
			 + evaluated.html["html_file3.html"]
			 + evaluated.html.html_a["html_a.html"]
			 + evaluated.json;

	var expected = "undefined"
					+"<html><body>html_file3.html</body></html>"
					+"<html><body>html_a.html</body></html>"
					+"undefined";

	t.equal(res, expected);

	evaluated = evaluated([], {blacklist: ["**/html_a*"], trim: true});

	res = evaluated.js
			 + evaluated.html["html_file3.html"]
			 + evaluated.html.html_a
			 + evaluated.json;

	expected = "undefined"
					+"<html><body>html_file3.html</body></html>"
					+"undefined"
					+"undefined";

	t.equal(res, expected);

});
