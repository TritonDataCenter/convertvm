var crypto = require('crypto');
var fs = require('fs');
var path = require('path');

exports.replaceFilenameExtension = function (filename, newExt) {
    return (
        path.join(
            path.dirname(filename),
            path.basename(
                filename,
                path.extname(filename)) + newExt));
};

exports.sha1file = function (filename, callback) {
    var shasum = crypto.createHash('sha1');
    var s = fs.ReadStream(filename);
    s.on('data', function (d) {
        shasum.update(d);
    });

    s.on('end', function () {
        var d = shasum.digest('hex');
        return callback(null, d);
    });
};
