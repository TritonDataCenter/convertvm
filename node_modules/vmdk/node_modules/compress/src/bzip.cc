/*
 * Copyright 2010, Ivan Egorov (egorich.3.04@gmail.com).
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

#include <node.h>
#include <node_events.h>
#include <assert.h>
#include <string.h>
#include <stdlib.h>

#define BZ_NO_STDIO
#include <bzlib.h>
#undef BZ_NO_STDIO

#include "utils.h"
#include "zlib.h"

using namespace v8;
using namespace node;

class BzipUtils {
 public:
  typedef ScopedBlob Blob;

 public:
  static int StatusOk() {
    return BZ_OK;
  }


  static int StatusSequenceError() {
    return BZ_SEQUENCE_ERROR;
  }


  static int StatusMemoryError() {
    return BZ_MEM_ERROR;
  }


  static int StatusEndOfStream() {
    return BZ_STREAM_END;
  }

 public:
  static bool IsError(int bzipStatus) {
    return !(bzipStatus == BZ_OK ||
        bzipStatus == BZ_RUN_OK ||
        bzipStatus == BZ_FLUSH_OK ||
        bzipStatus == BZ_FINISH_OK ||
        bzipStatus == BZ_STREAM_END);
  }


  static Local<Value> GetException(int bzipStatus) {
    if (!IsError(bzipStatus)) {
      return Local<Value>::New(Undefined());
    } else {
      switch (bzipStatus) {
        case BZ_CONFIG_ERROR:
          return Exception::Error(String::New(ConfigError));
        case BZ_SEQUENCE_ERROR:
          return Exception::Error(String::New(SequenceError));
        case BZ_PARAM_ERROR:
          return Exception::Error(String::New(ParamError));
        case BZ_MEM_ERROR:
          return Exception::Error(String::New(MemError));
        case BZ_DATA_ERROR:
          return Exception::Error(String::New(DataError));
        case BZ_DATA_ERROR_MAGIC:
          return Exception::Error(String::New(DataErrorMagic));
        case BZ_IO_ERROR:
          return Exception::Error(String::New(IoError));
        case BZ_UNEXPECTED_EOF:
          return Exception::Error(String::New(UnexpectedEof));
        case BZ_OUTBUFF_FULL:
          return Exception::Error(String::New(OutbuffFull));

        default:
          return Exception::Error(String::New("Unknown error"));
      }
    }
  }

 private:
  static const char ConfigError[];
  static const char SequenceError[];
  static const char ParamError[];
  static const char MemError[];
  static const char DataError[];
  static const char DataErrorMagic[];
  static const char IoError[];
  static const char UnexpectedEof[];
  static const char OutbuffFull[];
};
const char BzipUtils::ConfigError[] = "Library configuration error.";
const char BzipUtils::SequenceError[] = "Call sequence error.";
const char BzipUtils::ParamError[] = "Invalid arguments.";
const char BzipUtils::MemError[] = "Out of memory.";
const char BzipUtils::DataError[] = "Data integrity error.";
const char BzipUtils::DataErrorMagic[] = "BZip magic not found.";
const char BzipUtils::IoError[] = "Input/output error.";
const char BzipUtils::UnexpectedEof[] = "Unexpected end of file.";
const char BzipUtils::OutbuffFull[] = "Output buffer full.";


class BzipImpl {
  friend class ZipLib<BzipImpl>;

  typedef BzipUtils Utils;
  typedef BzipUtils::Blob Blob;

 private:
  static const char Name[];

 private:
  Handle<Value> Init(const Arguments &args) {
    HandleScope scope;

    int blockSize100k = 1;
    int workFactor = 0;
    want_buffer_ = false;

    int length = args.Length();
    if (length >= 1 && !args[0]->IsUndefined()) {
      if (!args[0]->IsInt32()) {
        Local<Value> exception = Exception::TypeError(
            String::New("blockSize must be an integer"));
        return ThrowException(exception);
      }
      blockSize100k = args[0]->Int32Value();
    }
    if (length >= 2 && !args[1]->IsUndefined()) {
      if (!args[1]->IsInt32()) {
        Local<Value> exception = Exception::TypeError(
            String::New("workFactor must be an integer"));
        return ThrowException(exception);
      }
      workFactor = args[1]->Int32Value();
    }
    if (args.Length() > 3 && !args[2]->IsUndefined()) {
      want_buffer_ = args[2]->BooleanValue() ? true : false;
    }

    /* allocate deflate state */
    stream_.bzalloc = NULL;
    stream_.bzfree = NULL;
    stream_.opaque = NULL;

    int ret = BZ2_bzCompressInit(&stream_, blockSize100k, 0, workFactor);
    if (Utils::IsError(ret)) {
      return ThrowException(Utils::GetException(ret));
    }
    return Undefined();
  }


  int Write(char *data, int &dataLength, Blob &out, bool flush) {
    out.setUseBufferOut(want_buffer_);
    stream_.next_in = data;
    stream_.avail_in = dataLength;
    stream_.next_out = out.data() + out.length();
    size_t initAvail = stream_.avail_out = out.avail();

    int ret = BZ2_bzCompress(&stream_, flush ? BZ_FINISH : BZ_RUN);
    dataLength = stream_.avail_in;
    if (!Utils::IsError(ret)) {
      out.IncreaseLengthBy(initAvail - stream_.avail_out);
    }
    return ret;
  }


  int Finish(Blob &out) {
    out.setUseBufferOut(want_buffer_);
    stream_.next_out = out.data() + out.length();
    size_t initAvail = stream_.avail_out = out.avail();

    int ret = BZ2_bzCompress(&stream_, BZ_FINISH);
    if (!Utils::IsError(ret)) {
      out.IncreaseLengthBy(initAvail - stream_.avail_out);
    }
    return ret;
  }


  void Destroy() {
    BZ2_bzCompressEnd(&stream_);
  }


 private:
  bz_stream stream_;
  bool want_buffer_;
};
const char BzipImpl::Name[] = "Bzip";
typedef ZipLib<BzipImpl> Bzip;


class BunzipImpl {
  friend class ZipLib<BunzipImpl>;

  typedef BzipUtils Utils;
  typedef BzipUtils::Blob Blob;

 private:
  static const char Name[];

 public:
  Handle<Value> Init(const Arguments &args) {
    HandleScope scope;

    want_buffer_ = false;

    int small = 0;
    if (args.Length() > 0 && !args[0]->IsUndefined()) {
      small = args[0]->BooleanValue() ? 1 : 0;
    }
    if (args.Length() > 1 && !args[1]->IsUndefined()) {
      want_buffer_ = args[1]->BooleanValue() ? true : false;
    }

    stream_.bzalloc = NULL;
    stream_.bzfree = NULL;
    stream_.opaque = NULL;
    stream_.avail_in = 0;
    stream_.next_in = NULL;

    int ret = BZ2_bzDecompressInit(&stream_, 0, small);
    if (Utils::IsError(ret)) {
      return ThrowException(Utils::GetException(ret));
    }
    return Undefined();
  }


  int Write(const char *data, int &dataLength, Blob &out, bool flush) {
    out.setUseBufferOut(want_buffer_);
    stream_.next_in = const_cast<char*>(data);
    stream_.avail_in = dataLength;
    stream_.next_out = out.data() + out.length();
    size_t initAvail = stream_.avail_out = out.avail();

    int ret = BZ2_bzDecompress(&stream_);
    dataLength = stream_.avail_in;
    if (!Utils::IsError(ret)) {
      out.IncreaseLengthBy(initAvail - stream_.avail_out);
    }
    return ret;
  }


  int Finish(Blob &out) {
    out.setUseBufferOut(want_buffer_);
    return BZ_OK;
  }


  void Destroy() {
    BZ2_bzDecompressEnd(&stream_);
  }

 private:
  bool want_buffer_;
  bz_stream stream_;
};
const char BunzipImpl::Name[] = "Bunzip";
typedef ZipLib<BunzipImpl> Bunzip;
