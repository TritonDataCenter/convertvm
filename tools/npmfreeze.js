#!/usr/bin/env node
// -*- mode: js -*-
/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Copyright (c) 2014, Joyent, Inc.
 */

//
//
// Generate a "dependencies" block for a top-level package.json that includes
// the explicit versions for all recursive npm modules. See "Method 3" in
// <https://head.no.de/docs/eng> for why this is interesting.
//
// Usage:
//      find . -name "package.json" | xargs ./tools/npmfreeze.js
//
// If two parts of the node_modules tree includes separate versions of a
// particular module, then the greater version is used.

var fs = require('fs');
var semver = require('semver');
var spawn = require('child_process').spawn;


///--- Globals
var deps = {};


///--- Helpers

function done() {
    console.log(JSON.stringify(deps, null, 2));
}


function waitForDone() {
    process.nextTick(function() {
        if (wait === 0)
            return done();

        return waitForDone();
    });
}


///--- Main

process.argv.slice(2).forEach(function(fname) {
    var pkg = JSON.parse(fs.readFileSync(fname, 'utf8'));
    if (!pkg.dependencies)
        return;

    var tmp = pkg.dependencies;
    Object.keys(tmp).forEach(function(dep) {
        if (!deps[dep] || semver.gt(tmp[dep], deps[dep]))
            deps[dep] = semver.clean(tmp[dep]) || '*';
    });
});

// Make a pass and clean up all the '*'
var wait = 0;
Object.keys(deps).forEach(function(k) {
    if (deps[k] !== '*')
        return;

    wait++;
    var npm = spawn('npm', ['info', k]);
    var json = '';
    npm.stdout.on('data', function(data) {
        if (data)
            json += data;
    });

    npm.stdout.on('end', function(code) {
        if (code) {
            console.error('npm info %s exited: %d', k, code);
            process.exit(code);
        }

        var val;
        eval('val = ' + json);

        deps[k] = val['dist-tags'].latest;
        wait--;
    });
});

return (wait === 0 ? done() : waitForDone());

