var path = require('path');
var test = require('tape');
var util = require('util')

var curryFolder = require('../');

test('whitelist - populate', function(t){

	t.plan(1);

	var evaluate = curryFolder(__dirname + '/files', {whitelist: ["js/*.js", "js/jsone/jsone_file1.*"], recursive: true} );
	var res = typeof evaluate["js_file1"]
			 + typeof evaluate["jsone_file1"]
			 + typeof evaluate["jsone_file2"]
			 + typeof evaluate["html_a.html"];
	var expected = "function"
					+"function"
					+"undefined"
					+"undefined";

	t.equal(res, expected);

});

test('whitelist - evaluate + trim', function(t){

	t.plan(3);

	var evaluate = curryFolder(__dirname + '/files', {recursive: true} );
	t.equal(typeof evaluate["js_file1"], "function");

	var evaluated = evaluate([1,2,3], {whitelist: "jsone_file*", trim: true});
	var res = ""+evaluated["js_file1"]
			 + evaluated["jsone_file1"]
			 + evaluated["jsone_file2"]
			 + evaluated["jsone_file3"];
	var expected = "undefined"
					+"jsone_file1.js"+1+2+3
					+"jsone_file2.js"+1+2+3
					+"jsone_file3.js"+1+2+3;

	t.equal(res, expected);

	evaluated = evaluated([], {whitelist: "*3", trim: true});
	var res = ""+evaluated["js_file1"]
			 + evaluated["jsone_file1"]
			 + evaluated["jsone_file2"]
			 + evaluated["jsone_file3"];
	var expected = "undefined"
					+"undefined"
					+"undefined"
					+"jsone_file3.js"+1+2+3;

	t.equal(res, expected);

});

test('whitelist - tree + trim', function(t){

	t.plan(2);

	var evaluate = curryFolder(__dirname + '/files', {tree: true, whitelist: "js*/**"} );
	t.equal(typeof evaluate.json.jsonone["jsonone_file"], "object");

	var evaluated = evaluate([1,2,3], {whitelist: ["**/js_file1", "js/**/*file*"], trim: true});

	var res = evaluated.js["js_file1"]
			 + evaluated.js.jsone["jsone_file1"]
			 + evaluated.js.jsone["jsone_file2"]
			 + evaluated.js.jsone["jsone_file3"]
			 + evaluated.html
			 + evaluated.json;

	var expected = "undefined"
					+"jsone_file1.js"+1+2+3
					+"jsone_file2.js"+1+2+3
					+"jsone_file3.js"+1+2+3
					+"undefined"
					+"undefined";

	t.equal(res, expected);

});
