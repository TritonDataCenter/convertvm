var execFile = require('child_process').execFile;
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var zfs = require('zfs').zfs;
var async = require('async');
var VMDK = require('vmdk');
var fs = require('fs');

/*
 * Get DiskSection.Disk @populatedSize
 * @ovf:capacity
 * @ovf:capacityAllocationUnits
 *
 * 1. zfs create -V $capacity_in_bytes zones/$zvol
 * 2. qemu-img convert -f vmdk -O host_device
 * 3. zfs snapshot/send
 * 4. zfs destroy
 */

function randstr() {
    return Math.floor(Math.random() * 0xffffffff).toString(16);
}

var DiskImage = module.exports = function () {};

DiskImage.prototype.convertToZfsStream = function (opts, callback) {
    var self = this;

    opts.zpool = opts.zpool || 'zones';

    if (!opts.inputFile) {
        throw new Error('Missing option to DiskImage: inputFile');
    }

    if (!opts.outputFile) {
        throw new Error('Missing option to DiskImage: outputFile');
    }

    if (!opts.format) {
        throw new Error('No disk format specified');
    }

    if (['vmdk'].indexOf(opts.format) === -1) {
        throw new Error('Unsupported disk format: ' + opts.format);
    }

    console.dir(opts);

    this.capacityBytes = opts.capacityBytes;
    this.zvolName = opts.zpool + '/convert-image-'+randstr();
    this.zvolSnapshotName = this.zvolName + '@vmdk-img-convert';
    this.zvolDskPath = '/dev/zvol/dsk/' + this.zvolName;
    this.inputFile = opts.inputFile;
    this.outputFile = opts.outputFile;

    async.waterfall([
        self.createZvol.bind(self),
        self.vmdkToZvol.bind(self),
        function (wf$callback) {
            setTimeout(function () { wf$callback(); }, 5000);
        },
        self.snapshotZvol.bind(self),
        self.zfsSendSnapshot.bind(self)
    ],
    function (error) {
        if (error) {
            console.error(error);
        }
        console.log('All done!');
        zfs.destroy(
            this.zvolSnapshotName,
            function () {
                zfs.destroyAll(
                    self.zvolName,
                    function () {
                        if (callback) {
                            callback();
                        }
                    });
            });
    });
};

DiskImage.prototype.createZvol = function (callback) {
    var self = this;

    console.log('Creating zvol: ' + self.zvolName);
    execFile(
        '/usr/sbin/zfs',
        [ 'create', '-V', self.capacityBytes, self.zvolName ],
        {},
        function (error, stdout, stderr) {
            if (error) {
                return callback(new Error(stderr.toString()));
            }
            return callback();
        });
};

DiskImage.prototype.vmdkToZvol = function (callback) {
    var self = this;
    console.log('Converting zvol.');

    var outputStream;
    var v = new VMDK({ filename: self.inputFile });

    async.waterfall([
        function (wf$callback) {
            outputStream = fs.createWriteStream(self.zvolDskPath);
            return wf$callback();
        },
        function (wf$callback) {
            v.open(function (error) {
                console.log('opened the file %s', self.zvolDskPath);
                console.dir(error);
                console.dir(v.header);

                var stream = v.stream();
                stream.pipe(outputStream);

                stream.on('error', function (stream$error) {
                    console.warn(
                        'Error streaming vmdk: %s', stream$error.message);
                });

                stream.on('end', function (data) {
                    console.warn('VMDK Stream ended');
                    outputStream.end();
                    return wf$callback();
                });

                stream.start();
            });
        }
    ],
    function (error) {
        if (error) {
            console.error('Error writing vmdk stream to output file');
            console.error(error.message);
            console.error(error.stack);
            return callback(error);
        }
        return callback();
    });
};

DiskImage.prototype.snapshotZvol = function (callback) {
    var self = this;
    console.log('Taking Snapshot of zvol.');
    zfs.snapshot(self.zvolName + '@vmdk-img-convert', function (error) {
        if (error) {
            return callback(error);
        }
        return callback();
    });
};

DiskImage.prototype.zfsSendSnapshot = function (callback) {
    var self = this;
    console.log('Compressing and saving ZFS stream.');
    exec(
        '/usr/sbin/zfs send ' + self.zvolSnapshotName
            + ' | bzip2 > ' + self.outputFile,
        {},
        function (error, stdout, stderr) {
            if (error) {
                return callback(new Error(stderr.toString()));
            }
            return callback();
        });
};
