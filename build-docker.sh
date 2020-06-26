#!/bin/bash

PACKAGE_VERSION=$(sed -nE 's/^\s*"version": "(.*?)",$/\1/p' package.json)

docker build --build-arg "PACKAGE_VERSION=$PACKAGE_VERSION" -t tarnadas/net64plus-server:latest .
docker tag tarnadas/net64plus-server:latest tarnadas/net64plus-server:$PACKAGE_VERSION
