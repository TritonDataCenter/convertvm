# NAME

convertvm - Convert VM images into Smart Datacenter dataset manifests.


# SYNOPSIS

    convertvm [-dhnouv] inputvm output-directory


# DESCRIPTION

Virtual Machine images may be represented by various formats. `convertvm`
takes as input a VM (virtual machine) or VA (or virtual appliace) and can
output a binary dataset that can be imported into SDC (Smart Data Center).

`convertvm` accepts as input OVF (Open Virtualization Format) files. It
outputs a .dsmanifest and .zfs.bz2 file to the `output-directory` specified at
invocation.


# OPTIONS

## General options

    -a/--assets-url <assets-url>
         Set the location where this dataset's file will be available.
         (ie. http://10.99.99.6/datasets/)


## Dataset Override Options

    -n/--ds-manifest <name>
         Set the dataset name. (ie. myvm)

    -v/--ds-version <version>
         Set the dataset version. (ie. 1.0.0)

    -d/--ds-description <description>
         Set the dataset description. Maximum of 256 characters.

    -o/--ds-os <os>
         Set the dataset operating system. (ie. linux, windows, smartos, etc.)

    -N/--ds-nic-driver <pcnet|e1000|...>
         Set the nic driver.

    -D/--ds-disk-driver <virtio|ide|...>
         Set the dataset disk driver


# CAVEATS

- Only OVF-1.0 is supported.
- Only one VM per OVF file is supported.
- Only one Disk per OVF VM is supported.


# REFERENCES

- http://www.vmware.com/appliances/getting-started/learn/ovf.html
- http://www.dmtf.org/standards/published_documents/DSP0243_1.1.0.pdf

# LICENSE

Copyright (c) 2012 Joyent, All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
