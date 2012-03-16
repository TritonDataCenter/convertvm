#!/usr/bin/node

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
