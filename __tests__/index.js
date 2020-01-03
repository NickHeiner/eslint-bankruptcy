const {dirSync: createTmpDir} = require('tmp');
const mkdirp = require('mkdirp');
const fs = require('fs');
const path = require('path');
// @ts-ignore TS erroneously complains about this require.
const packageJson = require('../package');
const {spawnSync} = require('child_process');
const globby = require('globby');

/**
 * @param {string} testName 
 * @param {string[]} flagsOtherThanFilePath 
 */
function prepareTest(testName, flagsOtherThanFilePath) {
  const tmpDir = createTmpDir({prefix: `${packageJson.name}-${encodeURIComponent(testName)}-`}).name;
  copy(path.resolve(__dirname, '..', 'fixtures'), tmpDir);
  const binPath = path.resolve(__dirname, '..', packageJson.bin['declare-eslint-bankruptcy']);
  const {status, stdout: stdoutBuffer, stderr: stderrBuffer} = spawnSync(binPath, [tmpDir, ...flagsOtherThanFilePath]);
  if (status) {
    const stdout = stdoutBuffer.toString();
    const stderr = stderrBuffer.toString();
    console.log({stdout, stderr});
    const err = new Error('Spawning declare-eslint-bankruptcy failed');
    Object.assign(err, {stdout, stderr});
    throw err;
  }
    
  return {files: globby.sync(`${tmpDir}/**/*`), rootDir: tmpDir};
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
    mkdirp.sync(path.dirname(destPath));
    fs.writeFileSync(destPath, fs.readFileSync(sourcePath, 'utf8'))
  })
}

/**
 * 
 * @param {string[]} files 
 */
function assertFilesMatchSnapshots({files, rootDir}) {
  files.forEach(filePath => {
    it(path.relative(rootDir, filePath), () => {
      expect(fs.readFileSync(filePath, 'utf8')).toMatchSnapshot();
    })
  })
}

describe('eslint-bankruptcy', () => {
  describe('only no-console', () => {
    const files = prepareTest('only no-console', ['--rule', 'no-console']);
    assertFilesMatchSnapshots(files);
  })
  
  // describe('dry run');
  // describe('no-console and camelcase');
});