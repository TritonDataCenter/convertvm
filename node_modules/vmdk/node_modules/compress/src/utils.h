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

#ifndef NODE_COMPRESS_UTILS_H__
#define NODE_COMPRESS_UTILS_H__

#include <new>

#include <assert.h>
#include <stdio.h>
#include <pthread.h>

#define COND_RETURN(cond, ret) \
    if (cond) \
      return (ret);

#ifdef DEBUG

#include <stdio.h>

#define DEBUG_P(fmt, args...) \
do { \
  char junk[1024]; \
  snprintf(junk, sizeof(junk), "%s: %d %s " fmt "\n", \
      __FILE__, __LINE__, __PRETTY_FUNCTION__, ##args); \
  write(2, junk, strlen(junk)); \
} while (0);


#else

#define DEBUG_P(fmt, args...)

#endif

#ifdef DEBUG
#include <typeinfo>
template <class T>
class CounterMonitor {
  volatile static int Counter;

 public:
  CounterMonitor() {
    ++Counter;
    printf("%s: %d\n", typeid(*this).name(), Counter);
  }

  ~CounterMonitor() {
    --Counter;
  }
};
template<class T> volatile int CounterMonitor<T>::Counter = 0;
#endif

template <class T>
class ScopedOutputBuffer {
 public:
  ScopedOutputBuffer() 
    : data_(0), capacity_(0), length_(0), use_buffers_(false)
  {
  }

  ScopedOutputBuffer(size_t initialCapacity)
    : data_(0), capacity_(0), length_(0), use_buffers_(false)
  {
    GrowBy(initialCapacity);
  }

  ~ScopedOutputBuffer() {
    Free();
  }

  bool GrowBy(size_t sz) {
    assert(sz >= 0);
    if (sz == 0) {
      return true;
    }
    return GrowTo(capacity_ + sz);
  }


  void IncreaseLengthBy(size_t sz) {
    assert(sz >= 0);
    assert(length_ + sz <= capacity_);
    length_ += sz;
  }

  
  void ResetLength() {
    length_ = 0;
  }


  void Free() {
    free(data_);
    data_ = 0;
    capacity_ = 0;
    length_ = 0;
  }


  T* data() const {
    return data_;
  }


  size_t capacity() const {
    return capacity_;
  }


  size_t length() const {
    return length_;
  }


  size_t avail() const {
    return capacity_ - length_;
  }

  void setUseBufferOut(bool use_buffers) {
    use_buffers_ = use_buffers;
  }

  bool getUseBufferOut() {
    return use_buffers_;
  }
 
 private:
  bool GrowTo(size_t sz) {
    if (sz == 0) {
      return true;
    }

    T *tmp = (T*) realloc(data_, sz * sizeof(T));
    if (tmp == NULL) {
      return false;
    }
    data_ = tmp;
    capacity_ = sz;
    return true;
  }

 private:
  T* data_;
  size_t capacity_;
  size_t length_;
  bool use_buffers_;

 private:
  ScopedOutputBuffer(ScopedOutputBuffer&);
  ScopedOutputBuffer(const ScopedOutputBuffer&);
  ScopedOutputBuffer& operator=(ScopedOutputBuffer&);
  ScopedOutputBuffer& operator=(const ScopedOutputBuffer&);
};

typedef ScopedOutputBuffer<char> ScopedBlob;

template <class T>
class StateTransition {
 public:
  StateTransition(T &ref, T value)
    : reference_(ref), value_(value), abort_(false)
  {}

  ~StateTransition() {
    if (!abort_) {
      reference_ = value_;
    }
  }

  void alter(T value) {
    value_ = value;
  }

  void abort(bool value = true) {
    abort_ = value;
  }

 private:
  T &reference_;
  T value_;
  bool abort_;

 private:
  StateTransition(StateTransition&);
  StateTransition(const StateTransition&);
  StateTransition& operator=(StateTransition&);
  StateTransition& operator=(const StateTransition&);
};


#endif

