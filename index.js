const resolveFrom = require('resolve-from');
const path = require('path');
const dedent = require('dedent');
const loadJsonFile = require('load-json-file');
const util = require('util');
const findParentDir = util.promisify(require('find-parent-dir'));
const {spawn} = require('child_process');
const log = require('nth-log');
const _ = require('lodash');
const fs = require('fs');
const readFile = util.promisify(fs.readFile.bind(fs));
const writeFile = util.promisify(fs.writeFile.bind(fs));

/**
 * @param {object} options 
 * @param {string[]} options.files
 * @param {string[]} options.rules
 * @param {boolean | undefined} options.dry
 * @param {string} options.explanation
 */
async function eslintBankruptcy(options) {
  const eslintBin = await getEslintBinPath();
  const eslintReport = await runEslint(eslintBin, options.files);
  const violations = await getViolations(eslintReport, options.rules);
  const countViolatingFiles = _.size(violations);
  const logParams = {countViolatingFiles};
  if (options.dry) {
    Object.assign(logParams, {violations});
  } else {
    log.debug({violationFiles: Object.keys(violations)});
    log.trace({violations});
  }
  log.info(logParams, `Found violations in ${countViolatingFiles} files.`);
  
  if (options.dry) {
    log.info('Exiting because dry mode is on.');
    return;
  }

  insertComments(violations, options.explanation);
}

/**
 * @param {ReturnType<typeof getViolations>} changes 
 * @param {string} explanation
 */
function insertComments(changes, explanation) {
  // @codemod/cli has more functionality, but it'll be painful to use because we'd have to run it in subproc.
  // Our set of changes to make is in memory, so passing that through the the transform would also be a pain.

  return Promise.all(_.map(changes, (violations, filePath) => insertCommentsInFile(filePath, violations, explanation)));
}

/**
 * @param {string} filePath 
 * @param {{[line: number]: string[]}} violations 
 * @param {string} explanation 
 */
async function insertCommentsInFile(filePath, violations, explanation) {
  log.info({filePath}, 'Modifying file');
  // I wonder if the line splitting is too naive here.
  const inputCode = (await readFile(filePath, 'utf8')).split('\n');
  
  // I would declare this inline if I knew how to use the TS JSDoc syntax with it.
  /** @type {string[]} */
  const initial = [];
  
  const outputCode = inputCode.reduce((acc, line, lineIndex) => {
    const toAppend = [];
    // +1 because ESLint gives the line numbers 1-indexed.
    const violation = violations[lineIndex + 1];
    if (violation) {
      const leadingWhitespaceLength = line.length - line.trimLeft().length;
      const leadingWhitespace = line.substring(0, leadingWhitespaceLength);
      if (explanation) {
        toAppend.push(`${leadingWhitespace}// ${explanation}`);
      }
      toAppend.push(leadingWhitespace + getEslintDisableComent(violation));
    }
    toAppend.push(line);
    return [...acc, ...toAppend];
  }, initial).join('\n');

  log.trace({outputCode, filePath});
  await writeFile(filePath, outputCode);
}

/**
 * @param {string[]} rules 
 */
function getEslintDisableComent(rules) {
  return `// eslint-disable-next-line ${rules.join(' ')}`;
}

/**
 * @param {Array<{filePath: string, messages: Array<{ruleId: string, line: number}>}>} eslintReport 
 * @param {string[]} rules
 * @return {{[filePath: string]: {[lineNumber: number]: string[]}}}}
 */
function getViolations(eslintReport, rules) {
  return _(eslintReport)
    .flatMapDeep(({filePath, messages}) => _.flatMap(messages, ({ruleId, line}) => ({filePath, ruleId, line})))
    .groupBy('filePath')
    .mapValues(entry => _(entry)
      .filter(({ruleId}) => rules.includes(ruleId))
      .groupBy('line')
      .mapValues(violations => _.map(violations, 'ruleId'))
      .value()
    )
    .toPairs()
    .filter(([, violations]) => Boolean(_.size(violations)))
    .fromPairs()
    .value();
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