NAME
----

node-zfs - Node.js ZFS interface

SYNOPSIS
--------

    // list datasets
    zfs.list(function (err, fields, data) {
      // ...
    });

    // list snapshots
    zfs.list_snapshots(function (err, fields, data) {
      // ...
    });

    // create a dataset
    zfs.create('mydataset', function (err) {
      // ...
    });

    // destroy a dataset or snapshot
    zfs.destroy('mydataset', function (err) {
      // ...
    });

    // recursively destroy a dataset
    zfs.destroyAll('mydataset', function (err) {
      // ...
    });

    // rollback a snapshot
    zfs.rollback('mydataset@backup', function (err) {
      // ...
    });

    // clone a dataset
    zfs.clone('mydataset@backup', 'mynewdataset', function (err) {
      // ...
    });

    // set dataset properties
    zfs.set('mydataset', { 'test:key1': 'value'
                         , 'test:key2': 'value' }, function (err) {
      // ...
    });

    // get dataset properties
    zfs.get('mydataset', [ 'test:key1', 'test:key2' ],
      function (err, properties) {
        // ...
      });

DESCRIPTION
-----------

The node-zfs library provies a thin, evented wrapper around common ZFS
commands.

ENVIRONMENT
-----------

The library was developed on an OpenSolaris snv_111b system.

AUTHOR
------

Orlando Vazquez <orlando@joyent.com>

SEE ALSO
--------

zfs(1M), zpool(1M)
