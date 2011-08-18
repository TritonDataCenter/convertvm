var DatasetManifest = module.exports = function () {
  var self = this;
  var simpleKeys = 'name type uuid version files'.split(' ');

  this.manifest = { files: [], requirements: { networks : [] }};
  var requirements = this.manifest.requirements;

  simpleKeys.forEach(function (i) {
    self.__defineSetter__(i, function (v) {
      this.manifest[i] = v;
    });
    self.__defineGetter__(i, function () {
      return this.manifest[i];
    });
  });

  self.__defineSetter__('networks', function (v) {
    requirements.networks = v;
  });
}

DatasetManifest.prototype.toJson = function () {
  return JSON.stringify(this.manifest, null, '  ');
}
