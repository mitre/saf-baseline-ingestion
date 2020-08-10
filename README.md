# saf-baseline-ingestion
Ingest baselines and parse out which NIST 800-53 controls they validate

## Inputs

### `repo_owner`

**Optional** The owner of the repo.  Allowed values are "SAF" and "CMS".

## Example usage

uses: docker://mitre/saf-baseline-ingestion
with:
  repo_owner: 'SAF'
