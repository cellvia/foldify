var test = require('tape');

var curryFolder = require('../');
var files = curryFolder(__dirname + '/files');

test('basic', function(t){
	t.plan(1);
	t.equal(files["file.txt"], "file.txt");
})