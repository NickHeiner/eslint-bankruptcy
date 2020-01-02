const resolveFrom = require('resolve-from');
const path = require('path');
const dedent = require('dedent');
const loadJsonFile = require('load-json-file');
const util = require('util');
const findParentDir = util.promisify(require('find-parent-dir'));

/**
 * @param {object} options 
 * @param {string[]} options.files
 * @param {string[]} options.rules
 */
async function eslintBankruptcy(options) {
  const eslintBin = await getEslintBinPath();
  console.log({eslintBin});
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

module.exports = eslintBankruptcy;