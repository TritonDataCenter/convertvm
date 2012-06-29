#
# Copyright (c) 2012, Joyent, Inc. All rights reserved.
#
# Makefile: basic Makefile for template API service
#
# This Makefile is a template for new repos. It contains only repo-specific
# logic and uses included makefiles to supply common targets (javascriptlint,
# jsstyle, restdown, etc.), which are used by other repos as well. You may well
# need to rewrite most of this file, but you shouldn't need to touch the
# included makefiles.
#
# If you find yourself adding support for new targets that could be useful for
# other projects too, you should add these to the original versions of the
# included Makefiles (in eng.git) so that other teams can use them too.
#

#
# Tools
#
TAP		:= ./node_modules/.bin/tap

#
# Files
#
ROOT = $(shell pwd)
DOC_FILES = index.restdown boilerplateapi.restdown
JS_FILES := $(shell ls *.js 2>/dev/null) $(shell find lib -name '*.js' 2>/dev/null)
JSL_CONF_NODE = tools/jsl.node.conf
JSL_FILES_NODE = $(JS_FILES)
JSSTYLE_FILES = $(JS_FILES)
JSSTYLE_FLAGS = -o indent=4,doxygen,unparenthesized-return=0

NODE_PREBUILT_VERSION=v0.6.19
NODE_PREBUILT_TAG=gz

include ./tools/mk/Makefile.defs
include ./tools/mk/Makefile.node_prebuilt.defs
include ./tools/mk/Makefile.node_deps.defs
include ./tools/mk/Makefile.smf.defs

#
# Repo-specific targets
#
.PHONY: all
all: | $(TAP) $(REPO_DEPS)
	$(NPM) rebuild

$(TAP): | $(NPM_EXEC)
	$(NPM) install

CLEAN_FILES += $(TAP) ./node_modules/tap

ROOT            := $(shell pwd)
RELEASE_TARBALL := convertvm-$(STAMP).tar.bz2
TMPDIR          := /tmp/$(STAMP)

.PHONY: test
test: $(TAP)
	TAP=1 $(TAP) test/*.test.js

.PHONY: release
release: all deps #docs
	@echo "Building $(RELEASE_TARBALL)"
	@mkdir -p $(TMPDIR)/convertvm
	cp -r   $(ROOT)/build \
    $(ROOT)/bin \
    $(ROOT)/lib \
    $(ROOT)/Makefile \
    $(ROOT)/node_modules \
    $(ROOT)/package.json \
    $(ROOT)/tools \
    $(TMPDIR)/convertvm
	(cd $(TMPDIR) && $(TAR) -jcf $(ROOT)/$(RELEASE_TARBALL) convertvm)
	@rm -rf $(TMPDIR)

.PHONY: publish
publish: release
	@if [[ -z "$(BITS_DIR)" ]]; then \
    echo "error: 'BITS_DIR' must be set for 'publish' target"; \
    exit 1; \
  fi
	mkdir -p $(BITS_DIR)/convertvm
	cp $(ROOT)/$(RELEASE_TARBALL) $(BITS_DIR)/convertvm/$(RELEASE_TARBALL)


include ./tools/mk/Makefile.deps
include ./tools/mk/Makefile.node_prebuilt.targ
include ./tools/mk/Makefile.node_deps.targ
include ./tools/mk/Makefile.smf.targ
include ./tools/mk/Makefile.targ
