const {dirSync: createTmpDir} = require('tmp');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
// @ts-ignore TS erroneously complains about this require.
const packageJson = require('../package');
const {spawnSync} = require('child_process');
const loadJsonFile = require('load-json-file');
const writeJsonFile = require('write-json-file');
const globby = require('globby');
const log = require('../src/log');
const _ = require('lodash');

/**
 * @param {string} testName 
 * @param {string[]} flagsOtherThanFilePath 
 * @param {string[]} [filesArgs]
 * @param {{passEslintOutput?: boolean} | undefined} opts
 */
function prepareTest(testName, flagsOtherThanFilePath, filesArgs, {passEslintOutput} = {}) {
  const tmpDir = createTmpDir({prefix: `${packageJson.name}-${encodeURIComponent(testName)}-`}).name;
  copy(path.resolve(__dirname, '..', 'fixtures'), tmpDir);

  const eslintOutputJsonPath = path.join(tmpDir, 'eslint-output.json');
  const eslintOutput = loadJsonFile.sync(eslintOutputJsonPath);
  if (!eslintOutput) {
    throw new Error(`Test was expecting to find eslint output file at "${eslintOutputJsonPath}".`);
  }
  // I'm not sure how to do the type assertion in JSDoc.
  /** @ts-expect-error */
  const withFilePathFixed = eslintOutput.map(fileEntry => ({
    ...fileEntry,
    filePath: fileEntry.filePath.replace('<fixturesRoot>', tmpDir)
  }));
  writeJsonFile.sync(eslintOutputJsonPath, withFilePathFixed);

  const binPath = path.resolve(__dirname, '..', packageJson.bin['declare-eslint-bankruptcy']);
  const filesToPass = filesArgs ? filesArgs.map(filePath => path.join(tmpDir, filePath)) : [tmpDir];
  const flags = [...filesToPass, ...flagsOtherThanFilePath];

  if (passEslintOutput) {
    flags.push('--eslintOutputFilePath', eslintOutputJsonPath);
  }

  log.trace({binPath, flags}, 'Spawning');
  const {status, stdout: stdoutBuffer, stderr: stderrBuffer} = spawnSync(binPath, flags, {
    env: {
      ...process.env,
      loglevel: 'trace'
    }
  });
  const stdout = stdoutBuffer.toString();
  const stderr = stderrBuffer.toString();
  if (process.env.loglevel === 'trace') {
    console.log('stdout', stdout, 'stderr', stderr);
  }
  if (status) {
    const err = new Error('Spawning declare-eslint-bankruptcy failed');
    Object.assign(err, {stdout, stderr});
    throw err;
  }
    
  return {
    files: filesArgs ? 
      filesToPass : 
      _.reject(globby.sync(`${tmpDir}/**/*`), filePath => filePath.includes('eslint-output.json')),
    rootDir: tmpDir
  };
}

/**
 * 
 * @param {string} sourceDir 
 * @param {string} destDir 
 */
function copy(sourceDir, destDir) {
  const files = globby.sync(['**/*', '**/.*'], {cwd: sourceDir});
  files.forEach(filePath => {
    const sourcePath = path.join(sourceDir, filePath);
    const destPath = path.join(destDir, filePath);
    log.trace({sourcePath, destPath}, 'Copying file');
    mkdirp.sync(path.dirname(destPath));
    fs.writeFileSync(destPath, fs.readFileSync(sourcePath, 'utf8'));
  });
}

/**
 * 
 * @param {object} options 
 * @param {string[]} options.files
 * @param {string} options.rootDir
 */
function assertFilesMatchSnapshots({files, rootDir}) {
  files.forEach(filePath => {
    it(path.relative(rootDir, filePath), () => {
      expect(fs.readFileSync(filePath, 'utf8')).toMatchSnapshot();
    });
  });
}

describe('eslint-bankruptcy', () => {
  describe('only no-console', () => {
    const files = prepareTest('only no-console', ['--rule', 'no-console']);
    assertFilesMatchSnapshots(files);
  });

  describe('multiple explicit file paths', () => {
    const files = prepareTest(
      'multiple explicit file paths', 
      ['--rule', 'no-console'], 
      ['root.js', 'already-disabled-line.js']
    );
    assertFilesMatchSnapshots(files);
  });

  describe('warnings are ignored', () => {
    const files = prepareTest('warnings are ignored', ['--rule', 'eqeqeq'], ['only-warning.js']);
    assertFilesMatchSnapshots(files);
  });
  
  describe('set explanation message', () => {
    const files = prepareTest('only no-console', ['--rule', 'no-console', '--explanation', 'inserted explanation']);
    assertFilesMatchSnapshots(files);
  });

  describe('no-console and camelcase', () => {
    const files = prepareTest('only no-console', ['--rule', 'no-console', '--rule', 'camelcase']);
    assertFilesMatchSnapshots(files);
  });

  describe('dry run', () => {
    const files = prepareTest('dry run', ['--dry', '--rule', 'no-console']);
    assertFilesMatchSnapshots(files);
  });

  describe('--eslintOutputFilePath', () => {
    const files = prepareTest(
      'eslintOutputFilePath', 
      ['--rule', 'no-console'],
      undefined,
      {passEslintOutput: true}
    );
    assertFilesMatchSnapshots(files);
  });
});