#!/bin/bash

cd /control-table-data-ingest
node ./ingest.js
cp -r ./profiles /github/workspace/src/assets/data/baselineProfiles/
