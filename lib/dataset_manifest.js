/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var DatasetManifest = module.exports = function () {
    var self = this;
    var simpleKeys = [
        'name',
        'type',
        'uuid',
        'version',
        'image_size',
        'files',
        'os',
        'disk_driver',
        'nic_driver',
        'description'
    ];

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
};

DatasetManifest.prototype.toJson = function () {
    return JSON.stringify(this.manifest, null, '  ');
};
