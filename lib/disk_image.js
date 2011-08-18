var execFile = require('child_process').execFile;
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var zfs = require('zfs').zfs;
var async = require('async');

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

var DiskImage = module.exports = function () {}


DiskImage.prototype.convertToZfsStream = function (opts, callback) {
  var self = this;

  opts.zpool = opts.zpool || 'zones';

  if (!opts.inputFile) {
    throw new Error("Missing option to DiskImage: inputFile");
  }
  if (!opts.outputFile) {
    throw new Error("Missing option to DiskImage: outputFile");
  }

  if (!opts.format) {
    throw new Error("No disk format specified");
  }

  if (['vmdk'].indexOf(opts.format) === -1) {
    throw new Error("Unsupported disk format: " + opts.format);
  }

  this.capacityBytes = opts.capacityBytes;
  this.zvolName = opts.zpool + '/convert-image-'+randstr();
  this.zvolSnapshotName = this.zvolName + '@qemu-img-convert';
  this.zvolDskPath = '/dev/zvol/dsk/' + this.zvolName;
  this.inputFile = opts.inputFile;
  this.outputFile = opts.outputFile;

  async.waterfall
    ( [ self._createZvol.bind(self)
      , self._vmdkToZvol.bind(self)
      , self._snapshotZvol.bind(self)
      , self._zfsSendSnapshot.bind(self)
      ]
    , function (error) {
        if (error) {
          console.error(error);
        }
        console.log("All done!");
        zfs.destroyAll
          ( self.zvolName
          , function (error, stdout, stderr) {
              if (callback) return callback();
            }
          );
        }
    );
}

DiskImage.prototype._createZvol = function (callback) {
  var self = this;

  execFile
    ( '/usr/sbin/zfs'
    , [ 'create', '-V', self.capacityBytes, self.zvolName ]
    , {}
    , function (error, stdout, stderr) {
        if (error) {
          return callback(new Error(stderr.toString()));
        }
        return callback();
      }
    );
}

DiskImage.prototype._vmdkToZvol = function (callback) {
  var self = this;
  var child =
    spawn
      ( '/smartdc/bin/qemu-img'
      , [ 'convert', '-f', 'vmdk', '-O', 'host_device'
        , self.inputFile, self.zvolDskPath
        ]
      );

  child.stdout.on('data', function (data) {
    console.log(data.toString());
  });

  child.stderr.on('data', function (data) {
    console.error(data.toString());
  });

  child.on('exit', function (code) {
    if (code) {
      return callback(new Error(stderr.toString()));
    }
    return callback();
  });

}

DiskImage.prototype._snapshotZvol = function (callback) {
  var self = this;

  zfs.snapshot(self.zvolName + '@qemu-img-convert', function (error) {
    if (error) {
      return callback(new Error(stderr.toString()));
    }
    return callback();
  });
}

DiskImage.prototype._zfsSendSnapshot = function (callback) {
  var self = this;
  exec
    ( '/usr/sbin/zfs send ' + self.zvolSnapshotName + ' | bzip2 > ' + self.outputFile
    , {}
    , function (error, stdout, stderr) {
        if (error) {
          return callback(new Error(stderr.toString()));
        }
        return callback();
      }
    );
}

function randstr () {
  return Math.floor(Math.random() * 0xffffffff).toString(16);
};
