const resolveFrom = require('resolve-from');
const util = require('util');
const findParentDir = util.promisify(require('find-parent-dir'));

/**
 * @param {object} options 
 * @param {string[]} options.files
 * @param {string[]} options.rules
 */
async function eslintBankruptcy(options) {
  const eslintBin = await getEslintBinPath();
}

async function getEslintBinPath(dirPath = process.cwd()) {
  const eslintMainPath = resolveFrom(dirPath, 'eslint');
  const eslintRoot = await findParentDir(eslintMainPath, 'package.json');
  console.log({eslintRoot});
}

module.exports = eslintBankruptcy;