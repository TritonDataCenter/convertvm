var cp = require('child_process'),
    fs = require('fs');

var execFile = cp.execFile,
    spawn    = cp.spawn;

/*
 * ZFS utilities paths
 */
exports.paths = {
    'zpool': '/sbin/zpool',
    'zfs': '/sbin/zfs'
};

var zpool = exports.zpool = function () { };

// if zfs commands take longer than timeoutDuration it's an error
var timeoutDuration = exports.timeoutDuration = 60*1000;

function zfsErrorStr(error, stderr) {
	if (!error)
		return (null);

	if (error.killed)
		return ('Process killed due to timeout.');

	return (error.message || (stderr ? stderr.toString() : ''));
}

function zfsError(error, stderr) {
	return (new Error(zfsErrorStr(error, stderr)));
}

zpool.listFields_ = [ 'name', 'size', 'allocated', 'free', 'cap',
    'health', 'altroot' ];

zpool.listDisks = function () {
	if (arguments.length !== 1)
		throw Error('Invalid arguments');
	var callback = arguments[0];

	execFile('/usr/bin/diskinfo', [ '-Hp' ], { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(stderr.toString()));

		var disks = [];
		var rows = parseTabSeperatedTable(stdout);

		for (var ii = 0; ii < rows.length; ii++) {
			disks.push({
			    type: rows[ii][0],
			    name: rows[ii][1],
			    vid: rows[ii][2],
			    pid: rows[ii][3],
			    size: rows[ii][4],
			    removable: (rows[ii][5] === 'yes')
			});
		}

		return (callback(null, disks));
	});
};

zpool.list = function () {
	var pool, callback;
	switch (arguments.length) {
		case 1:
			callback = arguments[0];
			break;
		case 2:
			pool     = arguments[0];
			callback = arguments[1];
			break;
		default:
			throw Error('Invalid arguments');
	}
	var args = ['list', '-H', '-o', zpool.listFields_.join(',')];
	if (pool)
		args.push(pool);

	execFile(exports.paths.zpool, args, { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		var rows = parseTabSeperatedTable(stdout);
		return (callback(null, zpool.listFields_, rows));
	});
};

zpool.status = function (pool, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zpool, [ 'status', pool ],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		stdout = stdout.trim();
		if (error || stdout == 'no pools available\n') {
			callback(null, 'UNKNOWN');
			return;
		}

		var lines = stdout.split('\n');
		for (var i = 0; i < lines.length; i++) {
			if (lines[i].trim().substr(0, 5) === 'state') {
				return (callback(null,
				    lines[i].trim().substr(7)));
			}
		}
		callback(null, 'UNKNOWN');
	});
};

/*
 * zpool.create()
 *
 * The list of disks is specified as an array of arrays, with each sub-array
 * corresponding to one RAID group.  Some examples:
 *
 *  2 RAID-Z groups with 4 disks each
 *    profile: 'raidz', disks: [ [ 'c0t0d0', 'c0t1d0', 'c0t2d0', 'c0t030' ],
 *                               [ 'c0t4d0', 'c0t5d0', 'c0t6d0', 'c0t7d0' ] ]
 *
 *  1 RAID-Z2 group with 8 disks
 *    profile: 'raidz2', disks: [ [ 'c0t0d0', 'c0t1d0', 'c0t2d0', 'c0t030',
 *                                  'c0t4d0', 'c0t5d0', 'c0t6d0', 'c0t7d0' ] ]
 *
 *  4 mirrored groups, each with 2 disks
 *    profile: 'mirror', disks: [ [ 'c0t0d0', 'c0t1d0' ],
 *                                [ 'c0t2d0', 'c0t3d0' ],
 *                                [ 'c0t4d0', 'c0t5d0' ],
 *                                [ 'c0t6d0', 'c0t7d0' ],
 */
zpool.create = function (pool, profile, disks, callback) {
	if (arguments.length != 4)
		throw Error('Invalid arguments, 4 arguments expected');

	profile = profile.toLowerCase();

	if (profile !== 'mirror' && profile !== 'raidz' &&
	    profile !== 'raidz2' && profile !== 'raidz3' &&
	    profile !== 'striped')
		throw Error('Invalid RAID profile: ' + profile);

	var args = [ 'create', pool ];
	for (var i in disks) {
		if (profile !== 'striped') {
			args.push(profile);
		}
		for (var j in disks[i]) {
			args.push(disks[i][j]);
		}
	}

	execFile(exports.paths.zpool, args, { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(stderr.toString()));
		return (callback(null));
	});
};

zpool.destroy = function (pool, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zpool, [ 'destroy', pool ],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(stderr.toString()));
		return (callback(null));
	});
};

zpool.upgrade = function (pool) {
	var version = -1,
	    callback;
	if (arguments.length === 2) {
		callback = arguments[1];
	} else if (arguments.length === 3) {
		version = arguments[1];
		callback = arguments[2];
	} else {
		throw Error('Invalid arguments');
	}

	var args = [ 'upgrade' ];
	if (version !== -1)
		args.push(' -V ' + version);
	args.push(pool);

	execFile(exports.paths.zpool, args, { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(stderr.toString()));
		return (callback(null));
	});
};

function parseTabSeperatedTable(data) {
	var i, numLines, lines = data.trim().split('\n');
	var rows = [];
	for (i = 0, numLines = lines.length; i < numLines; i++) {
		if (lines[i]) {
			rows.push(lines[i].split('\t'));
		}
	}
	return (rows);
}

var zfs;
exports.zfs = zfs = function () {};

zfs.create = function (name, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, [ 'create', name ],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

zfs.set = function (name, properties, callback) {
	if (arguments.length != 3)
		throw Error('Invalid arguments');

	var keys = Object.keys(properties);

	// loop over and set all the properties using chained callbacks
	(function () {
		var next = arguments.callee;
		if (!keys.length) {
			callback();
			return;
		}
		var key = keys.pop();

		execFile(exports.paths.zfs,
		    ['set', key + '=' + properties[key], name ],
		    { timeout: timeoutDuration },
		    function (error, stdout, stderr) {
			if (error)
				return (callback(zfsError(error, stderr)));
			return (next()); // loop by calling enclosing function
		});
	})();
};

var zfsGetRegex = new RegExp('^([^\t]+)\t([^\t]+)\t(.+)');
zfs.get = function (name, propNames, parseable, callback) {
	if (arguments.length != 4)
		throw Error('Invalid arguments');

	var opts = '-H';
	if (parseable)
		opts = '-Hp';

	execFile(exports.paths.zfs, ['get', opts,
	    '-o', 'source,property,value', propNames.join(','), name],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		var properties = {};

		// Populate the properties hash with regexp match groups from
		// each line.  Break on  irst empty line
		var lines = stdout.split('\n');
		var i, l, m;
		for (i = 0, l = lines.length; i < l; i++) {
			m = zfsGetRegex.exec(lines[i]);
			if (!m)
				continue;
			properties[m[2]] = m[3];
		}
		return (callback(null, properties));
	});
};

zfs.snapshot = function (name, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, ['snapshot', name],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

zfs.clone = function (snapshot, name, callback) {
	if (arguments.length != 3)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, ['clone', snapshot, name],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

zfs.destroy = function (name, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, ['destroy', name],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

zfs.destroyAll = function (name, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, ['destroy', '-r',  name],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

/*
 * zfs.list fields
 */

zfs.listFields_ = [ 'name', 'used', 'avail', 'refer', 'type', 'mountpoint' ];

/*
 * List datasets.
 *
 * @param {String} [name]
 *   Dataset to list. If name is not given, `list` defaults to returning all
 *   datasets.
 *
 * @param {Object} [options]
 *   Options object:
 *     - `type`: restrict dataset type (dataset, volume, snapshot or all)
 *
 * @param {Function} [callback]
 *   Call `callback` when done. Function will be called with an error
 *   parameter, a field names list and a array of arrays comprising the list
 *   information.
 *
 */

zfs.list = function () {
	var dataset, callback,
	    options = {};
	switch (arguments.length) {
		case 1:
			callback = arguments[0];
			break;
		case 2:
			dataset  = arguments[0];
			callback = arguments[1];
			break;
		case 3:
			dataset  = arguments[0];
			options  = arguments[1];
			callback = arguments[2];
			break;
		default:
			throw Error('Invalid arguments');
	}

	options.type      = options.type || 'filesystem';
	options.recursive = options.recursive || false;

	var args = [ 'list', '-H', '-o', zfs.listFields_.join(','),
	    '-t', options.type ];
	if (options.recursive) args.push('-r');
	if (dataset) args.push(dataset);

	execFile(exports.paths.zfs, args, { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		var rows = parseTabSeperatedTable(stdout);
		return (callback(null, zfs.listFields_, rows));
	});
};

zfs.send = function (snapshot, filename, callback) {
	fs.open(filename, 'w', 400, function (error, fd) {
		if (error)
			return (callback(error));
		// set the child to write to STDOUT with `fd`
		var child = spawn(exports.paths.zfs,
		    [ 'send', snapshot ], undefined, [ -1, fd ]);
		child.addListener('exit', function (code) {
			if (code) {
				callback(new Error('Return code was ' + code));
				return;
			}
			fs.close(fd, function () {
				callback();
			});
		});

		return (null);
	});
};

zfs.receive = function (name, filename, callback) {
	fs.open(filename, 'r', 400, function (error, fd) {
		if (error)
			return (callback(error));
		// set the child to read from STDIN with `fd`
		var child = spawn(exports.paths.zfs,
		    [ 'receive', name ], undefined, [ fd ]);
		child.addListener('exit', function (code) {
			if (code) {
				return (callback(new Error(
				    'Return code was ' + code)));
			}
			fs.close(fd, function () {
				return (callback());
			});

			return (null);
		});

		return (null);
	});
};

zfs.list_snapshots = function () {
	var snapshot, callback;
	switch (arguments.length) {
		case 1:
			callback = arguments[0];
			break;
		case 2:
			snapshot = arguments[0];
			callback = arguments[1];
			break;
		default:
			throw Error('Invalid arguments');
	}
	var args = ['list', '-H', '-t', 'snapshot'];
	if (snapshot) args.push(snapshot);

	execFile(exports.paths.zfs, args, { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		var rows = parseTabSeperatedTable(stdout);
		return (callback(error, zfs.listFields_, rows));
	});
};

zfs.rollback = function (name, callback) {
	if (arguments.length != 2)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, ['rollback', '-r', name],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

zfs.rename = function (name, newname, callback) {
	if (arguments.length != 3)
		throw Error('Invalid arguments');

	execFile(exports.paths.zfs, [ 'rename', name, newname ],
	    { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(zfsError(error, stderr)));
		return (callback());
	});
};

zfs.upgrade = function (name, version, callback) {
	if (arguments.length === 2) {
		callback = arguments[1];
	} else if (arguments.length === 3) {
		version = arguments[1];
		callback = arguments[2];
	} else {
		throw Error('Invalid arguments');
	}

	name = arguments[0];

	var args = [ 'upgrade' ];
	if (version !== -1)
		args.push(' -V ' + version);
	args.push(name);

	execFile(exports.paths.zfs, args, { timeout: timeoutDuration },
	    function (error, stdout, stderr) {
		if (error)
			return (callback(new Error(stderr.toString())));
		return (callback(null));
	});
};
