const fs = require('fs').promises;
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const inspec = require('inspecjs');
const parse = require('csv-parse/lib/sync');

const getAllControlsCanonized = () => {
  const frontier = inspec.nist.FULL_NIST_HIERARCHY;
  let allControls = [];
  while (frontier.length) {
    const { control, children } = frontier.pop();
    frontier.push(...children);
    allControls.push(control);
  }

  allControls = allControls.filter(x => x.sub_specifiers.length > 1);
  allControls = allControls.sort((a, b) => a.localCompare(b));
  console.log('all controls', allControls);

  const allControlsCanonized = [];
  for (const control of allControls) {
    const canonized = control.canonize({max_specifiers: 3, allow_letters: false, add_spaces: false});
    if (!allControlsCanonized.includes(canonized)) {
      allControlsCanonized.push(canonized);
    }
  }
  console.log('all controls canonized', allControlsCanonized);

  return allControlsCanonized;
}

// vmware has an unusual directory structure so they will need special handling
const vmwareGitUrl = 'https://github.com/vmware/dod-compliance-and-automation.git';

const getGitHash = async (profile) => {
  console.log('git hash', profile.shortName);

  if (profile.longName.includes('Google')) {
    console.log('skipping google cause their repos don\'t have nist tags and also inspec json fails due to needing credentials for some reason');
    return '0';
  }

  let url = profile.link;
  if (profile.link.startsWith('https://github.com/vmware')) {
    url = vmwareGitUrl;
  }

  const { stdout, stderr } = await exec(`git ls-remote --symref ${url} HEAD | awk 'FNR == 2 {print $1}'`);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
  return stdout.trim();
}

const downloadGitRepo = async (profile) => {
  let cmd = `git clone --depth=1 ${profile.link} "${profile.shortName}"`;
  if (profile.link.startsWith('https://github.com/vmware')) {
    cmd = `[ ! -d "./vmware" ] && git clone --depth=1 ${vmwareGitUrl} "./vmware"`;
  }

  try {
    const { stdout, stderr } = await exec(cmd);
    console.log('stdout:', stdout);
    console.log('stderr:', stderr);
  } catch (error) {
    // we've got 2+ vmware repos
    console.log('git error that we\'re just gonna ignore cause it\'s probably the "is this directory already here" conditional failing which is the point cause git clone fails on attempted overwrite', error);
  }
}

const generateProfileJson = async (profile) => {
  const maxBuffer = 1024 * 1024 * 100; // set max buffer to 100x default size - hopefully ~100MB is sufficient space

  let path = `./${profile.shortName}`
  if (profile.link.startsWith('https://github.com/vmware')) {
    path = `./vmware/${profile.link.substr(profile.link.indexOf('vsphere')).concat(profile.link.includes('vcsa') ? '/wrapper' : '')}`
  }

  // we're stuck to the version of bundler that's integrated with inspec so would be blocked if the lock file was created with a more recent version
  const { stdout: bundleStdout, stderr: bundleStderr } = await exec(`if [ -f "${path}/Gemfile" ]; then [ -f "${path}/Gemfile.lock" ] && rm "${path}/Gemfile.lock"; bundle install --gemfile="${path}/Gemfile"; fi`, { maxBuffer: maxBuffer });
  console.log('stdout:', bundleStdout);
  console.log('stderr:', bundleStderr);

  const { stdout: inspecStdout, stderr: inspecStderr } = await exec(`/usr/bin/inspec json "${path}"`, { maxBuffer: maxBuffer });
  // console.log('stdout:', inspecStdout); // a very large amount of text
  console.log('stderr:', inspecStderr);

  return inspecStdout;
}

const getProfileControls = (allControls, profileText) => {
  const hdf = inspec.parse.convertFile(profileText);

  const profiles = hdf["1_0_ExecJson"] ? hdf["1_0_ExecJson"].profiles : [hdf["1_0_ProfileJson"]]; // some profiles generate one or the other type at least out of the ones I tested

  const controls = [];
  for (const profile of profiles) {
    for (const control of profile.controls) {
      controls.push(inspec.hdfWrapControl(control));
    }
  }

  const nistTagHits = new Set();
  for (const control of controls) {
    for (const tag of control.parsed_nist_tags) {
      const canonized = tag.canonize({max_specifiers: 3, allow_letters: false, add_spaces: false});
      nistTagHits.add(canonized);
      if (!allControls.includes(canonized)) {
        throw 'Missed: ' + canonized + ' in ' + tag;
      }
    }
  }

  return [...nistTagHits];
}

const controlsType = 'NIST SP 800-53 Control';

(async () => {
  try {
    // get all the controls that inspecjs knows about and format them in a particular mannner
    const allControls = getAllControlsCanonized();

    // get all the profiles and extra sources of information
    let { baselines, extras } = JSON.parse(await fs.readFile('/github/workspace/src/assets/data/baselines.json', 'utf8'));
    console.log(baselines);

    // go through all the profiles, replace the ones that need to be updated in the cache, and extract all the controls
    const allProfileControls = {};
    for (const profile of baselines) {
      let profileText = '';

      const hash = await getGitHash(profile);
      console.log('old hash', profile.gitHash, 'new hash', hash);
      if (profile.gitHash && profile.gitHash === hash) {
        profileText = await fs.readFile(`/github/workspace/src/assets/data/baselineProfiles${profile.link.substr(profile.link.lastIndexOf('/'))}.json`, 'utf8');
      } else {
        await downloadGitRepo(profile);

        try {
          profileText = await generateProfileJson(profile);
        } catch (error) {
          console.log('inspec error that we\'re just gonna ignore', error);
        }

        await fs.writeFile(`/github/workspace/src/assets/data/baselineProfiles${profile.link.substr(profile.link.lastIndexOf('/'))}.json`, JSON.stringify(JSON.parse(profileText), null, 2), 'utf8');
        profile.gitHash = hash;
      }

      try {
        allProfileControls[profile.shortName] = getProfileControls(allControls, profileText);
        console.log('controls that the profile has', profile.shortName, allProfileControls[profile.shortName]);
      } catch (error) {
        console.log('inspecjs error that we\'re not gonna ignore', error);
        throw error;
      }
    }

    // same as above, but for sources that are not inspec profiles
    const allExtraControls = {};
    for (const extra of extras.csv) {
      let csv = '';

      const hash = await getGitHash(extra);
      if (extra.gitHash && extra.gitHash === hash) {
        csv = await fs.readFile(`/github/workspace/src/assets/data/baselineProfiles${extra.link.substr(extra.link.lastIndexOf('/'))}.csv`, 'utf8');
      } else {
        await downloadGitRepo(extra);

        csv = await fs.readFile(`./${extra.path}`, 'utf8');

        await fs.copyFile(`./${extra.path}`, `/github/workspace/src/assets/data/baselineProfiles${extra.link.substr(extra.link.lastIndexOf('/'))}.csv`);
        extra.gitHash = hash;
      }

      const asJson = parse(csv, { columns: true, skip_empty_lines: true });

      allExtraControls[extra.longName] = asJson.reduce((acc, row) => acc.includes(row[extra.column]) ? acc : acc.concat(row[extra.column]), []);
      console.log('controls that the extra thing has', extra.longName, allExtraControls[extra.longName]);
    }

    // replace baselines.json with the new hashes
    await fs.writeFile('/github/workspace/src/assets/data/baselines.json', JSON.stringify({baselines, extras}, null, 2), 'utf8');
    console.log('overwrite baselines with new hashes');

    // generate the one to many control->profile mapping that says which profiles implement which controls
    // the format is an array of objects where the first property of the object is the name of the control, the second is a boolean representing if any profile implements the control, and the remainder being the mapping
    const controlMapping = [];
    for (const control of allControls) {
      const mappingProfile = {};
      for (const [profileName, profileControls] of Object.entries(allProfileControls)) {
        mappingProfile[profileName + ' InSpec Profile'] = profileControls.includes(control);
      }

      const mappingExtra = {};
      for (const [extraName, extraControls] of Object.entries(allExtraControls)) {
        mappingExtra[extraName] = extraControls.includes(control);
      }

      const all = Object.keys(mappingProfile).reduce((acc, key) => acc || mappingProfile[key], false) || Object.keys(mappingExtra).reduce((acc, key) => acc || mappingExtra[key], false);

      controlMapping.push({ [controlsType]: control, "ALL": all, ...mappingExtra, ...mappingProfile });
    }
    console.log('control mapping', controlMapping);

    await fs.writeFile('/github/workspace/src/assets/data/mitre-saf-control-mapping.json', JSON.stringify(controlMapping, null, 2), 'utf8');
    console.log('hopefully we\'re in a success state now');
  } catch (error) {
    console.log('error', error);
  }
})();
