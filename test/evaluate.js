var path = require('path');
var test = require('tape');
var util = require('util')

var foldify = require('../');

test('evaluate', function(t){

	t.plan(2);

	var evaluate = foldify(__dirname + '/files/js/jsone');
	var evaluated = evaluate([1,2,3]);

	t.equal(evaluated["jsone_file3"], "jsone_file3.js"+1+2+3);

	evaluated = evaluated()

	t.equal(evaluated["jsone_file3"], "jsone_file3.js"+1+2+3);

});

test('evaluate - false (curry only)', function(t){

	t.plan(3);

	var evaluate = foldify(__dirname + '/files/js/jsone');

	var evaluated = evaluate([1,2,3], {evaluate: false} );
	t.equal(typeof(evaluated["jsone_file2"]), "function");

	evaluated = evaluated(undefined, {evaluate: false});
	t.equal(typeof(evaluated["jsone_file2"]), "function")

	evaluated = evaluated();
	t.equal(evaluated["jsone_file2"], "jsone_file2.js"+1+2+3);

});
