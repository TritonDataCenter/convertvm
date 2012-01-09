var DatasetManifest = require('./dataset_manifest');
var DiskImage = require('./disk_image');
var async = require('async');
var execFile = require('child_process').execFile;
var fs = require('fs');
var optparse = require('optparse');
var path = require('path');
var util = require('util');
var uuid = require('node-uuid');
var common = require('./common');
var OvfPackage = require('./formats/ovf');

var CLI = module.exports = function () {
  this.fileDigests = {};
}

CLI.prototype.parseOptions = function () {
  var self = this;
  var switches
    = [ ['-h', '--help',                 'This help message']
      , ['-f', '--format VALUE',         'The format of the input vm (ovf-1.0)']
      , ['-n', '--ds-name VALUE',        'Short name for the dataset']
      , ['-v', '--ds-version VALUE',     'Semantic version of dataset']
      , ['-d', '--ds-description VALUE',
         'Short description of dataset (to max. of 255 bytes)']
      , ['-o', '--ds-os VALUE',
         'The dataset operating system. (ie. linux, smartos, etc)']
      , ['-a', '--assets-url VALUE',     'Assets location url']
      , ['-D', '--ds-disk-driver VALUE', 'Set the VM\'s disk driver (default: virtio)']
      , ['-N', '--ds-nic-driver VALUE',  'Set the VM\'s NIC driver (default: virtio)']
      ];

  var examples
    = [
        { description:
            "bleh"
        , example:
            "$0 --assets-url http://10.99.99.6/datasets/ --dataset-os linux" +
            "--name mylinux ./vms/mylinux.ovf /usbkey/datasets"
        }
      ]

  var options = this.options = {};
  var parser = new optparse.OptionParser(switches);
  parser.banner
    = [ "Usage:"
      , "  " + [ process.argv[0]
               , process.argv[1]
               , "[options] <vm.ovf> [output-directory]"
               ].join(' ')
      ].join("\n");

  parser.on(2, function (value) {
    options.input = value;
  });

  parser.on(3, function (value) {
    options.outputDir = value;
  });

  parser.on('help', function () {
    self.displayHelp(parser.toString());
  });

  parser.on('format', function (name, value) {
    options.format = value;
  });

  parser.on('ds-name', function (name, value) {
    options.ds_name = value;
  });

  parser.on('ds-version', function (name, value) {
    options.ds_version = value;
  });

  parser.on('ds-uuid', function (name, value) {
    options.ds_uuid = value;
  });

  parser.on('ds-os', function (name, value) {
    options.ds_os = value;
  });

  parser.on('ds-disk-driver', function (name, value) {
    options.disk_driver = value;
  });

  parser.on('ds-nic-driver', function (name, value) {
    options.nic_driver = value;
  });

  parser.on('assets-url', function (name, assets_url) {
    options.assets_url = assets_url;
  });

  var args = parser.parse(process.argv);

  if (!options.input) {
    self.displayHelp(parser.toString());
    process.exit(1);
  }

  if (!options.ds_os) {
    console.error("Error: --ds-os must be specified\n");
    self.displayHelp(parser.toString());
    process.exit(1);
  }

  if (!options.outputDir) {
    options.outputDir = '.';
  }

  if (!options.assets_url) {
    options.assets_url = 'http://10.99.99.6/datasets'
  }

  if (!options.format) {
    options.format = 'ovf-1.0'
  }

  return options;
}

process.on('SIGINT', function () {
  console.error("Exiting!");
  process.exit(1);
});

CLI.prototype.start = function () {
  var self = this;
  var options = this.parseOptions();

  async.waterfall
    ( [ self.mkdir.bind(self)
      , function (callback) {
          var filename = options.input;
          if (['ovf', 'ovf-1.0'].indexOf(options.format) !== -1) {
            return self.parseOvfFile(callback);
          }
          else {
            throw new Error("Unsupported input format: " + options.format);
          }
          return callback();
        }
      , self.createDatasetManifest.bind(self)
      , self.createDiskImages.bind(self)
      , self.populateFiles.bind(self)
      , self.writeDatasetManifest.bind(self)
      ]
    , function (error) {
        console.log("All done!");
      }
    );
}

CLI.prototype.parseOvfFile = function (callback) {
  var self = this;
  var opts = {
      input: self.options.input
    , output: self.options.outputDir
    }
  self.ovf = new OvfPackage(opts);
  self.ovf.verifyFileIntegrity(function (error) {
    if (error) {
      return callback(error);
    }
    self.ovf.parse(function (error) {
      if (error) {
        return callback(error);
      }
      callback(error);
    });
  });
}

CLI.prototype.writeDatasetManifest = function (callback) {
  var self = this;
  var dsmfilename
    = path.join(self.options.outputDir, self.manifest.name) + '.dsmanifest';
  console.log(dsmfilename);
  fs.writeFile
    ( dsmfilename
    , self.manifest.toJson()+"\n"
    , function (error) {
        return callback(error);
      }
    );
}

CLI.prototype.mkdir = function (callback) {
  var self = this;
  console.log("Output directory: " + self.options.outputDir);
  path.exists(self.options.outputDir, function (exists) {
    if (exists) {
      callback();
    }
    else {
      fs.mkdir(self.options.outputDir, parseInt('0755', 8), function (error) {
        if (error) {
          throw new Error(error.toString);
        }
        callback();
      });
    }
  });
}

CLI.prototype.displayHelp = function (help) {
  console.error(help+"\n");
  process.exit(0);
}
        
CLI.prototype.createDatasetManifest = function (callback) {
  var self = this;

  var manifest = this.manifest = new DatasetManifest();
  var ovf = self.ovf;

  // Scan hardware and gather the following information.
  // - cpu type
  // - nic driver
  // - harddisk driver
  
//   var VirtualSystem = ovf.VirtualSystem;

  manifest.name = this.options.ds_name || VirtualSystem['@']['ovf:id'];
  manifest.requirements = {};
  manifest.type = 'zvol';
  manifest.uuid = this.options.ds_uuid || uuid().toLowerCase();
  manifest.version = this.options.ds_version || '1.0.0';
  manifest.os = this.options.ds_os || manifest.name;
  manifest.disk_driver = this.options.disk_driver || 'virtio';
  manifest.nic_driver = this.options.nic_driver || 'virtio';

  manifest.image_size = ovf.image_size;
  if (ovf.nets.length) manifest.networks = ovf.nets;

  return callback();
}

CLI.prototype.populateFiles = function (callback) {
  var self = this;

  self.files = self.ovf.files;

  async.forEach
    ( Object.keys(self.files)
    , function (file, callback) {
        var outputFile = path.join(self.options.outputDir
          , common.replaceFilenameExtension(self.files[file].href, '.zfs.bz2'));

        var record = {
          path: common.replaceFilenameExtension(self.files[file].href, '.zfs.bz2')
        };

        record.url = self.options.assets_url + '/' + record.path;
        async.waterfall
          ( [ function (callback) {
                fs.stat(self.files[file].path, function (error, stat) {
                  record.size = stat.size;
                  callback();
                });
              }
            , function (callback) {
                console.log("Verifying file " + outputFile);
                common.sha1file(outputFile, function (error, sha) {
                  self.fileDigests[file] = record.sha1 = sha;
                  callback();
                });
              }
            ] 
          , function (error) {
              self.manifest.files.push(record);
              return callback(error);
            }
          )
      }
    , function (error) {
        return callback(error);
      }
    );
}

CLI.prototype.createDiskImages = function (callback) {
  var self = this;
  self.disks = self.ovf.disks;
  async.forEachSeries
    ( Object.keys(self.disks)
    , function (diskId, callback) {
        var disk = self.disks[diskId];
        var diskImage = new DiskImage();
        
        var opts
          = { inputFile: disk.file.path
            , outputFile: disk.file.outputFile
            , capacityBytes: disk.capacityBytes
            , zpool: self.options.zpool
            , format: disk.format
            };

        diskImage.convertToZfsStream(opts, function (error) {
          console.log("Done converting " + disk);
          callback();
        });
      }
    , function () {
        return callback();
      }
    );
}
