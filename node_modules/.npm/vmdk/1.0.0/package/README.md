# NAME

node-vmdk - Interface around reading from streamOptimized sparse VMDK files.

# SYNOPSIS

    // Create an output stream.
    fs.createWriteStream(filename + ".raw", function (error, wstream) {
      
      // Open VMDK file.
      var vmdk = new VMDK({ filename: filename });
      vmdk.open(function (error) {
        console.dir(vmdk.header);
        
        // Stream contents to output stream.
        var stream = v.stream();
        stream.pipe(wstream);
        stream.start();
      });
    });

# DESCRIPTION

This is just a simple stream interface to read the contents of VMDK files.

# BUGS

May spontaenously spew forth unspeakable evil.

# AUTHOR

Orlando Vazquez < orlando@joyent.com >
