# saf-baseline-ingestion
Ingest baselines and parse out which NIST 800-53 controls they validate

## Inputs

### `repo-owner`

**Optional** The owner of the repo.  Allowed values are "SAF" and "CMS".  Default of `"SAF"`.

## Example usage

uses: mitre/saf-baseline-ingestion
with:
  repo-owner: 'CMS'
