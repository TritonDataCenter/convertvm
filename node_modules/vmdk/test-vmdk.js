var async = require('async');
var VMDK = require('./vmdk');

var filename = process.argv.length > 1 ? process.argv[2] : './fdbase.vmdk';
var v = new VMDK({ filename: filename });

v.open(function (error) {
    console.log('opened the file %s', filename);
    console.dir(error);
    console.dir(v.header);

    var stream = v.stream();

    stream.on('data', function (data) {
        // console.log( data.toString());
    });

    stream.on('error', function (stream$error) {
        console.warn('Error streaming vmdk: %s', stream$error.message);
    });

    stream.on('end', function (data) {
        console.warn('VMDK Stream ended');
        v.close();
    });

    stream.start();
});
