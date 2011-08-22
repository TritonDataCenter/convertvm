var DatasetManifest = require('./dataset_manifest');
var DiskImage = require('./disk_image');
var async = require('async');
var crypto = require('crypto');
var execFile = require('child_process').execFile;
var fs = require('fs');
var fs = require('fs');
var optparse = require('optparse');
var path = require('path');
var util = require('util');
var uuid = require('node-uuid');
var xml2js = require('xml2js');

function sha1file (filename, callback) {
  var shasum = crypto.createHash('sha1');
  var s = fs.ReadStream(filename);
  s.on('data', function(d) {
    shasum.update(d);
  });

  s.on('end', function() {
    var d = shasum.digest('hex');
    return callback(null, d);
  });
}

function replaceFilenameExtension (filename, newExt) {
  return ( path.join
           ( path.dirname(filename)
           , path.basename
               ( filename
               , path.extname(filename)
               ) + newExt
           )
         );
}

var CLI = module.exports = function () {}

CLI.prototype.parseOptions = function () {
  var self = this;
  var switches
    = [ ['-h', '--help',                 'This help message']
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

  parser.on('ds-name', function (name, ds_name) {
    options.ds_name = ds_name;
  });

  parser.on('ds-version', function (name, ds_version) {
    options.ds_version = ds_version;
  });

  parser.on('ds-uuid', function (name, ds_uuid) {
    options.ds_uuid = ds_uuid;
  });

  parser.on('ds-os', function (name, ds_os) {
    options.ds_os = ds_os;
  });

  parser.on('assets-url', function (name, assets_url) {
    options.assets_url = assets_url;
  });

  var args = parser.parse(process.argv);

  // name is mandatory

  if (!options.input) {
    self.displayHelp(parser.toString());
    process.exit(1);
  }

  if (!options.ds_os) {
    console.error("Error: --ds-os must be specified\n");
    self.displayHelp(parser.toString());
    process.exit(1);
  }

  self.ovfFilename = options.input;
  if (!options.outputDir) {
    options.outputDir = '.';
  }

  if (!options.assets_url) {
    options.assets_url = 'http://10.99.99.6/datasets'
  }

  return options;
}

CLI.prototype.start = function () {
  var self = this;
  var options = this.parseOptions();

  // create/verify directory
  async.waterfall
    ( [ self.mkdir.bind(self)
      , self.verifyFiles.bind(self)
      , self.convertOvfToJson.bind(self)
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

CLI.prototype.verifyFiles = function (callback) {
  var self = this;

  self.fileDigests = {};
  var manifestFilename = (path.dirname(self.options.input)
                          + '/'
                          + path.basename( self.options.input
                                         , path.extname(self.options.input))
                          + '.mf');

  path.exists(manifestFilename, function (exists) {
    if (exists) {
      fs.readFile(manifestFilename, function(err, data) {
        var lines = data.toString().split(/\n+/);
        async.forEach
          ( lines
          , function (line, callback) {
              if (!line) return;
              var m = line.match(/([^)]+)\((.+?)\)\s*=\s*(.*)/);
              var digest = m[1];
              var filename = m[2];
              sha1file(filename, function (error, computedDigest) {
                if (digest !== computedDigest) {
                  console.error("Digest mismatch for file " + filename);
                  process.exit(1);
                }
                self.fileDigests[filename] = computedDigest;
                callback();
              });
            }
          , function (error) {
              callback();
            }
          );
      });
    }
    else {
      return callback();
    }
  });
}
        
CLI.prototype.createDatasetManifest = function (callback) {
  var self = this;

  var manifest;
  var ovf = self.ovf;

  this.manifest = manifest = new DatasetManifest();

  // Scan hardware and gather the following information.
  // - cpu type
  // - nic driver
  // - harddisk driver
  
  var VirtualSystem = ovf.VirtualSystem;

  self.parseDisks(ovf);
//   self.parseVirtualSytemSection(ovf);
  self.parseNetworkSection(ovf);

  manifest.name = this.options.ds_name || VirtualSystem['@']['ovf:id'];
  manifest.requirements = {};
  manifest.type = 'zvol';
  manifest.uuid = this.options.ds_uuid || uuid().toLowerCase();
  manifest.version = this.options.ds_version || '1.0.0';
  manifest.os = this.options.ds_os || manifest.name;
  manifest.disk_driver = this.options.disk_driver || 'virtio';
  manifest.nic_driver = this.options.nic_driver || 'virtio';

  return callback();
}

CLI.prototype.populateFiles = function (callback) {
  var self = this;

  async.forEach
    ( Object.keys(self.files)
    , function (file, callback) {
        var outputFile = path.join(self.options.outputDir
          , replaceFilenameExtension(self.files[file].href, '.zfs.bz2'));

        var record = {
          path: replaceFilenameExtension(self.files[file].href, '.zfs.bz2')
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
                sha1file(outputFile, function (error, sha) {
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


/*
CLI.prototype.parseVirtualSytemSection = function (obj, callback) {
  var self = this;
  var VirtualHardwareSection = obj.VirtualSystem.VirtualHardwareSection;

  var Items = 

  VirtualHardwareSection.Item.forEach(function (hw) {
    switch (Number(hw['rasd:ResourceType'])) {
      // NIC
      case 10:
        break;
    }
  });
} */

CLI.prototype.parseNetworkSection = function (obj) {
  var self = this;
  var NetworkSection = obj.NetworkSection;
  var Network;
  var nets = [];

  if (NetworkSection.Network) {
    if (Array.isArray(NetworkSection.Network)) {
      Network = NetworkSection.Network;
    }
    else {
      Network = [ NetworkSection.Network ];
    }

    var count = 0;

    Network.forEach(function (n) {
      nets.push({ name: 'net'+count++, description: n.Description });
    });
  }

  // Scan Networks
  if (nets.length) {
    self.manifest.networks = nets;
  }
}

CLI.prototype.getAsArray = function (section, key) {
  if (Array.isArray(section[key])) {
    return section[key];
  }
  else {
    return [ section[key] ];
  }
}

CLI.prototype.parseDisks = function () {
  var self = this;
  var ovf = self.ovf;
  var files = self.files = {};
  var disks = self.disks = {};

  var dirname = path.dirname(self.ovfFilename);

  var Files = self.getAsArray(ovf.References, 'File');
  var Disks = self.getAsArray(ovf.DiskSection, 'Disk');

  if (Disks.length > 1) {
    throw new Error(
      "sdc-convertm does not support .ovf's describing multiple disks");
  }

  Files.forEach(function (File) {
    var file
      = files[File['@']['ovf:id']]
      = { size: File['@']['ovf:size']
        , id: File['@']['ovf:id']
        };
    var href = File['@']['ovf:href'];
    var m = href.match(/^(\w+):\/\//);
    if (m) {
      throw new Error(
        "OVF disk referenced file with unsupported href type: " + m[1]);
    }
    file.path = path.join(dirname, href);
    file.href = href;
    file.outputFile
      = path.join
          ( self.options.outputDir
          , replaceFilenameExtension(href, '.zfs.bz2')
          );
  });

  Disks.forEach(function (Disk) {
    var disk = disks[Disk['@']['ovf:diskId']]
      = { capacityBytes: Disk['@']['ovf:capacity']
        , file: files[Disk['@']['ovf:fileRef']]
        };

    var format = Disk['@']['ovf:format'];

    if (format.match(/vmdk\.html/i)) {
      disk.format = 'vmdk';
    }

    var allocUnits = Disk['@']['ovf:capacityAllocationUnits'];
    if (allocUnits) {
      var m = allocUnits.match(/^byte * (\d+)\^(\d+)$/);
      if (m) {
        disk.capacityBytes *= Math.pow(Number(m[1]), Number(m[2]));
      }
      else {
        console.error("Waning: Couldn't make sense of capacityAllocationUnits: "
                      + allocUnits);
      }
    }

    self.manifest.image_size = disk.capacityBytes / (1024*1024);
  });
}

CLI.prototype.convertOvfToJson = function (callback) {
  var self = this;
  var parser = new xml2js.Parser();
  parser.addListener('end', function (ovf) {
    self.ovf = ovf;
    return callback();
  });
  var filename = self.ovfFilename;
  fs.readFile(filename, function(err, data) {
    parser.parseString(data);
  });
}

CLI.prototype.createDiskImages = function (callback) {
  var self = this;
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

var OVF = function () {}

OVF.prototype.parse = function (opts) {
  if (opts.file) {
  
  }
  else if (opts.xml) {
  
  }
}

OVF.prototype.parseXml = function (opts) {
}
