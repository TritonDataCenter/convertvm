/*
 * Copyright 2011, Jeremy Stashewsky <jstash+node@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

var sys = require('sys');
var compress=require("../lib/compress");
var Stream = require('stream').Stream;

var gzipper = new compress.GzipStream(9,true,true);
gzipper.setEncoding('binary');

var gunzipper = new compress.GunzipStream(true,true);
gunzipper.setEncoding('binary');

Stream.prototype.pipe.call(gzipper, gunzipper);
Stream.prototype.pipe.call(gunzipper, process.stdout, {end:false});

gunzipper.once('end', function flushStdout() {
  sys.puts("-- all done");
  process.stdout.end();
});

//console.log({gzipper:gzipper, gunzipper:gunzipper, stdout:process.stdout});

sys.puts("-- starting");
gzipper.write(new Buffer("Here is the first chunk.\n"));
setTimeout(function() {
  sys.puts("-- tick");
  gzipper.write(new Buffer("Here is the next chunk.\n"));
  setTimeout(function() {
    sys.puts("-- tock");
    gzipper.write(new Buffer("Here is the final chunk.\n"));
    gzipper.end();
  }, 500);
}, 500);
