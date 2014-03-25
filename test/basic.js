var test = require('tape');

var foldify = require('../');

test('basic', function(t){
	var files = foldify(__dirname + '/files');
	t.plan(1);
	t.equal(files["file.txt"], "file.txt");
});