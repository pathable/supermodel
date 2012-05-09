REPORTER=dot

# prefer installed scripts
PATH := $(CURDIR)/node_modules/.bin:/usr/local/bin:${PATH}

OUTJS = supermodel.js
MINJS = supermodel.min.js

build: $(MINJS)

test: $(MINJS)
	@PATH=$(PATH) grunt

$(MINJS): $(OUTJS)
	@PATH=$(PATH) uglifyjs $(OUTJS) > $(MINJS)
	@git add $(MINJS)

.PHONY: build test
