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
NPM		:= npm
TAP		:= ./node_modules/.bin/tap

#
# Files
#
REPO_ROOT	 = $(shell pwd)
DOC_FILES	 = index.restdown boilerplateapi.restdown
JS_FILES	:= $(shell ls *.js 2>/dev/null) $(shell find bin lib test -name '*.js' 2>/dev/null)
JSL_CONF_NODE	 = $(REPO_ROOT)/tools/jsl.node.conf
JSL_FILES_NODE   = $(JS_FILES)
JSSTYLE_FILES	 = $(JS_FILES)
JSSTYLE_FLAGS    = -o indent=4,doxygen,unparenthesized-return=0
SMF_MANIFESTS	 = 
SMF_DTD		 = $(REPO_ROOT)/tools/service_bundle.dtd.1

#
# Repo-specific targets
#
.PHONY: all
all:
	$(NPM) rebuild

.PHONY: test
test: $(TAP)
	TAP=1 $(TAP) test/*.test.js

include inc/Makefile.deps
include inc/Makefile.targ
