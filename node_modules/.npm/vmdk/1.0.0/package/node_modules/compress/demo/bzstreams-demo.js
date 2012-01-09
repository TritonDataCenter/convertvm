/*
 * Copyright 2010, Ivan Egorov (egorich.3.04@gmail.com).
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

var compress=require("../lib/compress");
var sys=require("sys");
var posix=require("fs");
var Buffer = require('buffer').Buffer;


function bind(fun, self) {
  var args = Array.prototype.slice.call(arguments, 2);

  return function() {
    var innerArgs = Array.prototype.slice.call(arguments, 0);
    return Function.prototype.apply.call(fun, self, args.concat(innerArgs));
  };
}


function doCompress(compressor, continuation) {
  sys.puts('Making compression requests...');
  var output = '';
  compressor.setInputEncoding('utf8');
  compressor.setEncoding('binary');
  compressor.addListener('data', function(data) {
    output += data;
  }).addListener('error', function(err) {
    throw err;
  }).addListener('end', function() {
    sys.puts('Compressed length: ' + output.length);
    continuation(output);
  });

  compressor.write("My data that needs ");
  compressor.write("to be compressed. 01234567890.");
  compressor.close();
  sys.puts('Requests done.');
}


function doDecompress(decompressor, input) {
  var d1 = input.substr(0, 25);
  var d2 = input.substr(25);

  sys.puts('Making decompression requests...');
  var output = '';
  decompressor.setInputEncoding('binary');
  decompressor.setEncoding('utf8');
  decompressor.addListener('data', function(data) {
    output += data;
  }).addListener('error', function(err) {
    throw err;
  }).addListener('end', function() {
    sys.puts('Decompressed length: ' + output.length);
    sys.puts('Raw data: ' + output);
  });
  decompressor.write(d1);
  decompressor.write(d2);
  decompressor.close();
  sys.puts('Requests done.');
}


doCompress(new compress.BzipStream(),
    bind(doDecompress, null, new compress.BunzipStream()));

