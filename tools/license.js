#!/usr/bin/node
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

var fs = require('fs');

var input = process.argv[2];

fs.readFile(input, function (error, data) {
  var json = JSON.parse(data.toString());
  var licenses = [];

  if (!json.licenses) {
  }
  else if (Array.isArray(json.licenses)) {
    json.licenses.forEach(function (license) {
      licenses.push(license.type);
    });
  }

  var license = !licenses.length ? "No licenses" : licenses.join(", ");

  console.log("%s\n%s\n%s", json.name, input, license);
});
