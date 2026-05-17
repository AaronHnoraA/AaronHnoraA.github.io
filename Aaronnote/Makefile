PORT ?= 5179
HOST ?= 127.0.0.1
ROOT ?= ../roam

.PHONY: start install build test

start:
	npm run start -- --host $(HOST) --port $(PORT) --root $(ROOT)

install:
	npm install

build:
	npm run build:aaronnote

test:
	npm test
