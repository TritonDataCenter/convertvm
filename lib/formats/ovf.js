var path = require('path');
var xml2js = require('xml2js');
var fs = require('fs');
var common = require('../common');

var OvfPackage = module.exports = function (options) {
  this.input = options.input;
  this.output = options.output || '.';
}

/*
OvfPackage.prototype.parseVirtualSytemSection = function (obj, callback) {
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

OvfPackage.prototype.parseNetworkSection = function (obj) {
  var self = this;
  var NetworkSection = self.ovf.NetworkSection;
  var Network;
  self.nets = [];

  if (NetworkSection.Network) {
    if (Array.isArray(NetworkSection.Network)) {
      Network = NetworkSection.Network;
    }
    else {
      Network = [ NetworkSection.Network ];
    }

    var count = 0;

    Network.forEach(function (n) {
      self.nets.push({ name: 'net'+count++, description: n.Description });
    });
  }

}

OvfPackage.prototype.getAsArray = function (section, key) {
  if (Array.isArray(section[key])) {
    return section[key];
  }
  else {
    return [ section[key] ];
  }
}

OvfPackage.prototype.parseDisks = function () {
  var self = this;
  var ovf = self.ovf;
  var files = self.files = {};
  var disks = self.disks = {};

  var dirname = path.dirname(self.input);

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
          ( self.output
          , common.replaceFilenameExtension(href, '.zfs.bz2')
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

    console.log("ALLOC_UNITS = >" + allocUnits + "<");
      var m = allocUnits.match(/^byte \* (\d+)\^(\d+)$/);
      if (m) {
        disk.capacityBytes *= Math.pow(Number(m[1]), Number(m[2]));
      }
      else {
        console.error("Waning: Couldn't make sense of capacityAllocationUnits: "
                      + allocUnits);
      }
    }

    self.image_size = disk.capacityBytes / (1024*1024);
  });
}

OvfPackage.prototype.parse = function (callback) {
  var self = this;
  self.parseOvfXml(function (error) {
    if (error) {
      return callback(error);
    }
    self.parseDisks();
    self.parseNetworkSection();
    return callback();
  });
}

OvfPackage.prototype.parseOvfXml = function (callback) {
  var self = this;
  var parser = new xml2js.Parser();
  parser.addListener('end', function (ovf) {
    self.ovf = ovf;
    return callback();
  });
  var filename = self.input;
  fs.readFile(filename, function(err, data) {
    parser.parseString(data);
  });
}

OvfPackage.prototype.verifyFileIntegrity = function (callback) {
  var self = this;

  var manifestFilename = (path.dirname(self.filename)
                          + '/'
                          + path.basename( self.filename
                                         , path.extname(self.filename))
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
              common.sha1file(filename, function (error, computedDigest) {
                if (digest !== computedDigest) {
                  throw new Error("Digest mismatch for file " + filename);
                }
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
