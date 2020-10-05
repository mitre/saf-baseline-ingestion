# saf-baseline-ingestion
Ingest baselines and parse out which NIST 800-53 controls they validate

## Example usage
```
name: Example Action For Baseline Ingestion

on:
  workflow_dispatch:

jobs:
  example:
    runs-on: ubuntu-latest
    name: Ingest
    steps:
      - name: Pull repo
        uses: actions/checkout@v2
      - name: Ingest and process data
        uses: docker://mitre/saf-baseline-ingestion
      - name: Commit processed ata
        run: |
          git add ./src/assets/data/baselineProfiles/
          git add ./src/assets/data/baselines.json
          git add ./src/assets/data/mitre-saf-control-mapping.json
          git commit -m 'Automated ingestion of profiles' || true
          git push "https://${GITHUB_ACTOR}:${{ secrets.GITHUB_TOKEN }}@github.com/${GITHUB_REPOSITORY}.git" HEAD:master
```

## License and Author
### Authors

- Author:: Amndeep Singh Mann [me@asm.works](mailto:me@asm.works)

## NOTICE
© 2020 The MITRE Corporation.

Approved for Public Release; Distribution Unlimited. Case Number 18-3678.

## NOTICE
MITRE hereby grants express written permission to use, reproduce, distribute, modify, and otherwise leverage this software to the extent permitted by the licensed terms provided in the LICENSE.md file included with this project.

## NOTICE
This software was produced for the U. S. Government under Contract Number HHSM-500-2012-00008I, and is subject to Federal Acquisition Regulation Clause 52.227-14, Rights in Data-General.

No other use other than that granted to the U. S. Government, or to those acting on behalf of the U. S. Government under that Clause is authorized without the express written permission of The MITRE Corporation.

For further information, please contact The MITRE Corporation, Contracts Management Office, 7515 Colshire Drive, McLean, VA  22102-7539, (703) 983-6000.

### NOTICE
CIS Benchmarks are published by the Center for Internet Security (CIS), see: https://www.cisecurity.org/.
