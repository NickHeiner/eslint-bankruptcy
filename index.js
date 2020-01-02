const resolveFrom = require('resolve-from');
const path = require('path');
const dedent = require('dedent');
const loadJsonFile = require('load-json-file');
const util = require('util');
const findParentDir = util.promisify(require('find-parent-dir'));
const {spawn} = require('child_process');
const log = require('nth-log');
const _ = require('lodash');

/**
 * @param {object} options 
 * @param {string[]} options.files
 * @param {string[]} options.rules
 */
async function eslintBankruptcy(options) {
  const eslintBin = await getEslintBinPath();
  const eslintReport = await runEslint(eslintBin, options.files);
}

/**
 * @param {Array<{filePath: string, messages: Array<{ruleId: string, line: number}>}>} eslintReport 
 */
function getViolations(eslintReport) {

}

async function getEslintBinPath(dirPath = process.cwd()) {
  const eslintMainPath = resolveFrom(dirPath, 'eslint');
  const eslintRoot = await findParentDir(eslintMainPath, 'package.json');
  if (!eslintRoot) {
    throw new Error(dedent`
      eslint-bankruptcy could not find an eslint instance to run. To resolve this:

      1. Run this command from a directory in which "require('eslint')" works.
      2. Pass an eslint instance to use.
      3. Pass a directory from which to resolve eslint.
    `);
  }
  const packageJsonPath = path.join(eslintRoot, 'package.json');
  /** @type {{bin: {eslint: string}}} */ 
  const packageJson = await loadJsonFile(packageJsonPath);
  return path.resolve(eslintRoot, packageJson.bin.eslint);
}

/**
 * 
 * @param {string} eslintBinPath 
 * @param {string[]} files 
 */
function runEslint(eslintBinPath, files) {
  log.debug({eslintBinPath, files}, 'Spawning eslint');

  const childProc = spawn(eslintBinPath, [files.join(' '), '--format', 'json']);

  let stdOut = '';
  childProc.stdout.on('data', chunk => {
    const chunkStr = chunk.toString();
    log.debug(chunkStr);
    stdOut += chunkStr;
  });
  let stdErr = '';
  childProc.stderr.on('data', chunk => {
    const chunkStr = chunk.toString();
    log.debug(chunkStr);
    stdErr += chunkStr;
  });

  return new Promise((resolve, reject) => {
    childProc.on('close', code => {
      if (!code) {
        return resolve(null);
      }

      if (code === 1) {
        const outputJson = JSON.parse(stdOut);
        return resolve(outputJson);
      }
      const err = new Error('Eslint did not run successfully');
      Object.assign(err, {stdOut, stdErr, eslintBinPath, files});
      return reject(err);
    });
  });
}

module.exports = eslintBankruptcy;