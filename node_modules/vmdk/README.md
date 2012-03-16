# NAME

node-vmdk - Interface around reading from streamOptimized sparse VMDK files.

# SYNOPSIS

## Command line tool

    node bin/vmdk2raw.js input.vmdk output.raw

## Programmatic Interface

    var filename = process.argv[2];
    var outputfilename = process.argv[3];

    var v = new VMDK({ filename: filename });

    var writeStream = fs.createWriteStream(outputfilename);

    v.open(function (error) {
      var stream = v.stream();

      v.footer(function (error, footer) {
        console.warn("Footer:");
        console.warn(sys.inspect(footer));

        stream.pipe(writeStream);
        stream.on('end', function () {
          console.warn("This is done");
          v.close();
          writeStream.end();
        });
        stream.on('error', function () {
          console.error("THERE WAS AN ERROR");
          process.exit(1);
        });

        stream.start();
      });
    });


# DESCRIPTION

This is just a simple stream interface to read the contents of VMDK files.

# LICENSE

Copyright (c) 2012 Orlando Vazquez, All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

# BUGS

May spontaenously spew forth unspeakable evil.

# AUTHOR

Orlando Vazquez < orlando@joyent.com >
