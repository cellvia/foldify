var test = require('tape');

var foldify = require('../');

test('basic - __dirname', function(t){
	t.plan(1);
	var files = foldify(__dirname + '/files');
	t.equal(files["file.txt"], "file.txt");
});

test('basic - relative 1', function(t){
	t.plan(2);
	var files = foldify('./files');
	t.equal(files["file.txt"], "file.txt");
	var files2 = foldify('../test/files');
	t.equal(files2["file.txt"], "file.txt");
});

test('basic - relative 2', function(t){
	t.plan(2);
	var files = foldify('./', {jsToString: true});
	t.equal(!!files["basic"], true);
	var files2 = foldify('../', {jsToString: true});
	t.equal(!!files2["index"], true);
});