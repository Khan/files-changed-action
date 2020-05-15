const { execSync } = require('child_process');
const { getInput, setOutput } = require('@actions/core');
const path = require('path');
const fs = require('fs');
const minimatch = require('minimatch');

const getIgnoredPatterns = (fileContents) => {
    return fileContents
        .split('\n')
        .map((line) => {
            if (line.startsWith('#')) {
                return null;
            }
            if (line.startsWith('"')) {
                throw new Error('Quoted patterns not yet supported, sorry');
            }
            if (!line.trim()) {
                return null;
            }
            const [pattern, ...attributes] = line.trim().split(' ');
            if (
                attributes.includes('binary') ||
                attributes.inludes('linguist-generated=true')
            ) {
                return pattern;
            }
            return null;
        })
        .filter(Boolean);
};

const ignoredPatternsByDirectory = {};
const isFileIgnored = (workingDirectory, file) => {
    // If it's outside of the "working directory", we ignore it
    if (!file.startsWith(workingDirectory)) {
        return true;
    }
    let dir = path.dirname(file);
    let name = path.basename(file);
    while (dir.startsWith(workingDirectory)) {
        if (!ignoredPatternsByDirectory[dir]) {
            const attributes = path.join(dir, '.gitattributes');
            if (fs.existsSync(attributes)) {
                ignoredPatternsByDirectory[dir] = getIgnoredPatterns(
                    fs.readFileSync(attributes, 'utf8'),
                );
            } else {
                ignoredPatternsByDirectory[dir] = [];
            }
        }
        for (const pattern of ignoredPatternsByDirectory[dir]) {
            if (minimatch(name, pattern)) {
                return true;
            }
        }
        name = path.join(path.basename(dir), name);
        dir = path.dirname(dir);
    }
    return false;
};

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
    .filter((path) => !isFileIgnored(cwd, path))
    .filter((path) => (ignore ? !minimatch(path, ignore) : true))
    .filter((path) => (include ? minimatch(path, include) : true));

console.log('Files changed:');
files.forEach((file) => console.log('  ' + file));

// ':' is an illegal character in filenames, so it makes a good delimeter
setOutput('files', files.join(':::'));
