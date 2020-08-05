#!/bin/bash

echo 'hi'
ls
ls /
cd /control-table-data-ingest
node ./ingest.js
cp -r ./profiles /github/workspace/control-table-data-ingest
