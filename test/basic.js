var test = require('tape');

var foldify = require('../');
var files = foldify(__dirname + '/files');

test('basic', function(t){
	t.plan(1);
	t.equal(files["file.txt"], "file.txt");
})