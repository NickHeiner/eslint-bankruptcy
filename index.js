const resolveFrom = require("resolve-from");
const path = require("path");
const loadJsonFile = require("load-json-file");
const util = require("util");
const findParentDir = util.promisify(require("find-parent-dir"));
const execa = require("execa");
const _ = require("lodash");
const fs = require("fs");
const readFile = util.promisify(fs.readFile.bind(fs));
const writeFile = util.promisify(fs.writeFile.bind(fs));
const log = require("./src/log");

/**
 *
 * @param {string[]} files
 * @param {string | undefined} eslintOutputFilePath
 * @returns
 */
async function getEslintReport(files, eslintOutputFilePath) {
  if (eslintOutputFilePath) {
    log.debug(
      { eslintOutputFilePath },
      "Reading eslint output from JSON instead of spawning eslint."
    );
    return loadJsonFile(eslintOutputFilePath);
  }
  const eslintBin = await getEslintBinPath();
  return runEslint(eslintBin, files);
}

/**
 * @param {object} options
 * @param {string[]} options.files
 * @param {string[]} options.rules
 * @param {boolean | undefined} options.dry
 * @param {string | undefined} options.explanation
 * @param {string} options.eslintOutputFilePath
 */
async function eslintBankruptcy(options) {
  const eslintReport = await getEslintReport(
    options.files,
    options.eslintOutputFilePath
  );
  const violations = await getViolations(eslintReport, options.rules);
  const countViolatingFiles = _.size(violations);
  const logParams = { countViolatingFiles };
  if (options.dry) {
    Object.assign(logParams, { violations });
  } else {
    log.debug({ violationFiles: Object.keys(violations) });
    log.trace({ violations });
  }
  log.info(logParams, `Found violations in ${countViolatingFiles} files.`);

  if (options.dry) {
    log.info("Exiting because dry mode is on.");
    return;
  }

  insertComments(violations, options.explanation);
}

/**
 * @param {ReturnType<typeof getViolations>} changes
 * @param {string | undefined} explanation
 */
function insertComments(changes, explanation) {
  // @codemod/cli has more functionality, but it'll be painful to use because we'd have to run it in subproc.
  // Our set of changes to make is in memory, so passing that through to the transform would also be a pain.

  return Promise.all(
    _.map(changes, (violations, filePath) =>
      insertCommentsInFile(filePath, violations, explanation)
    )
  );
}

/**
 * @param {string} filePath
 * @param {{[line: number]: string[]}} violations
 * @param {string | undefined} explanation
 */
async function insertCommentsInFile(filePath, violations, explanation) {
  log.info({ filePath }, "Modifying file");
  // I wonder if the line splitting is too naive here.
  const inputCode = (await readFile(filePath, "utf8")).split("\n");

  // I would declare this inline if I knew how to use the TS JSDoc syntax with it.
  /** @type {string[]} */
  const initial = [];

  const outputCode = inputCode
    .reduce((acc, line, lineIndex) => {
      const toAppend = [];
      // +1 because ESLint gives the line numbers 1-indexed.
      const violation = violations[lineIndex + 1];
      if (violation) {
        const leadingWhitespaceLength = line.length - line.trimLeft().length;
        const leadingWhitespace = line.substring(0, leadingWhitespaceLength);
        if (explanation) {
          toAppend.push(`${leadingWhitespace}/* ${explanation} */`);
        }
        toAppend.push(leadingWhitespace + getEslintDisableComment(violation));
      }
      toAppend.push(line);
      return [...acc, ...toAppend];
    }, initial)
    .join("\n");

  log.trace({ outputCode, filePath });
  await writeFile(filePath, outputCode);
}

/**
 * @param {string[]} rules
 */
function getEslintDisableComment(rules) {
  const ruleSet = new Set(rules);
  return `/* eslint-disable-next-line ${Array.from(ruleSet).join(", ")} */`;
}

/**
 * @param {Array<{filePath: string, messages: Array<{ruleId: string, line: number}>}>} eslintReport
 * @param {string[]} rules
 * @returns{{[filePath: string]: {[lineNumber: number]: string[]}}}}
 */
function getViolations(eslintReport, rules) {
  return _(eslintReport)
    .flatMapDeep(({ filePath, messages }) =>
      _.flatMap(messages, ({ ruleId, line }) => ({ filePath, ruleId, line }))
    )
    .groupBy("filePath")
    .mapValues((entry) => {
      let _entry = _(entry);
      if (rules != null && rules.length > 0) {
        _entry = _entry.filter(({ ruleId }) => rules.includes(ruleId));
      }

      return _entry
        .groupBy("line")
        .mapValues((violations) => _.map(violations, "ruleId"))
        .value();
    })
    .toPairs()
    .filter(([, violations]) => Boolean(_.size(violations)))
    .fromPairs()
    .value();
}

async function getEslintBinPath(dirPath = process.cwd()) {
  const eslintMainPath = resolveFrom(dirPath, "eslint");
  const eslintRoot = await findParentDir(eslintMainPath, "package.json");
  if (!eslintRoot) {
    throw new Error(
      "eslint-bankruptcy could not find an eslint instance to run. " +
        // The rule is over-zealous.
        // eslint-disable-next-line quotes
        `To resolve this, run this command from a directory in which "require('eslint')" works.`
    );
  }
  const packageJsonPath = path.join(eslintRoot, "package.json");
  /** @type {{bin: {eslint: string}}} */
  const packageJson = await loadJsonFile(packageJsonPath);
  return path.resolve(eslintRoot, packageJson.bin.eslint);
}

/**
 *
 * @param {string} eslintBinPath
 * @param {string[]} files
 */
async function runEslint(eslintBinPath, files) {
  log.debug({ eslintBinPath, files }, "Spawning eslint");

  /**
   * @param {Error} spawnError
   */
  function throwESLintFailedError(spawnError) {
    const err = new Error(
      "Eslint did not run successfully. Did you run this command from within the project " +
        "you're trying to transform? This is necessary so Eslint can load your project's config."
    );
    Object.assign(err, { eslintBinPath, files, spawnError });
    throw err;
  }

  try {
    const { stdout, stderr } = await execa(eslintBinPath, [
      ...files,
      "--format",
      "json",
    ]);
    log.debug({ stdout, stderr });
  } catch (e) {
    if (!e.code || e.code === 1) {
      try {
        return JSON.parse(e.stdout);
      } catch {
        throwESLintFailedError(e);
      }
    }
    console.log(e.stderr);
    throwESLintFailedError(e);
  }
}

module.exports = eslintBankruptcy;
