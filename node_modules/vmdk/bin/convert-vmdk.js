#!/usr/bin/env node
var async = require('async');
var util = require('util');
var fs = require('fs');
var VMDK = require('../lib/vmdk');

if (!process.argv[2]) {
    console.error('Must pass in vmdk file as argument');
    process.exit(1);
}

var filename = process.argv[2];
var outputfilename = process.argv[3];

var v = new VMDK({ filename: filename });

var writeStream = fs.createWriteStream(outputfilename);

v.open(function (error) {
    var stream = v.stream();

    v.footer(function (footer$error, footer) {
        console.warn('Footer:');
        console.warn(util.inspect(footer));

        stream.pipe(writeStream);
        stream.on('end', function () {
            console.warn('This is done');
            v.close();
            writeStream.end();
        });
        stream.on('error', function () {
            console.error('THERE WAS AN ERROR');
            process.exit(1);
        });

        stream.start();
    });
});
