const { execSync } = require('child_process');
const { getInput, setOutput } = require('@actions/core');
const path = require('path');
const fs = require('fs');
const minimatch = require('minimatch');

const ignore = getInput('ignore');
const include = getInput('include');
const base = getInput('base') || process.env.GITHUB_BASE_REF;
if (!base) {
    console.error(
        'No base! Must either provide the "base" input argument, or have the GITHUB_BASE_REF env variable present.',
    );
    process.exit(1);
}
const cwd = process.cwd();

const stdout = execSync(
    `git diff --name-only refs/remotes/origin/${base} --relative`,
    {
        cwd,
        encoding: 'utf8',
        rejectOnError: true,
    },
);
const files = stdout
    .split('\n')
    .filter(Boolean)
    .map((name) => path.join(cwd, name))
    // Filter out paths that were deleted
    .filter((path) => fs.existsSync(path))
    .filter((path) => (ignore ? !minimatch(path, ignore) : true))
    .filter((path) => (include ? minimatch(path, include) : true));

console.log('Files changed:');
files.forEach((file) => console.log('  ' + file));
// ':' is an illegal character in filenames, so it makes a good delimeter
setOutput('files', files.join(':::'));
