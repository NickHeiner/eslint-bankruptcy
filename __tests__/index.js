const {dir: createTmpDir} = require('tmp-promise');
const {promisify} = require('util');
const ncp = promisify(require('ncp'));
const fs = require('fs');
const path = require('path');
// @ts-ignore TS erroneously complains about this require.
const packageJson = require('../package');
const {spawn} = require('child_process');
const globby = require('globby');

/**
 * @param {string} testName 
 * @param {string[]} flagsOtherThanFilePath 
 */
async function prepareTest(testName, flagsOtherThanFilePath) {
  const tmpDir = (await createTmpDir({prefix: `${packageJson.name}-${testName}-`})).path;
  await ncp(path.resolve(__dirname, '..', 'fixtures'), tmpDir);
  const binPath = path.resolve(__dirname, '..', packageJson.bin['declare-eslint-bankruptcy']);
  const childProc = spawn(binPath, [tmpDir, ...flagsOtherThanFilePath]);
  await new Promise((resolve, reject) => {
    childProc.on('close', code => {
      if (code) {
        reject(code);
      }
      resolve(code);
    })
  })
  return globby('**/*', {cwd: tmpDir});
}

function assertFilesMatchSnapshots(files) {
  files.forEach(filePath => {
    it(filePath, () => {
      expect(fs.readFileSync(filePath, 'utf8')).toMatchSnapshot();
    })
  })
}

const count = {};
async function log(message) {
  await new Promise(resolve => setTimeout(resolve));
  count[message] = count[message] || -1;
  count[message]++;
  console.log(message, count[message]);
}

describe('eslint-bankruptcy', () => {
  log('top level await');

  beforeAll(() => log('beforeAll'));
  beforeEach(() => log('beforeEach'));

  it('dummy test', () => {});

  // describe('only no-console', () => {
  //   let files;

  //   beforeAll(async () => {
  //     files = await prepareTest('only no-console', ['--rule', 'no-console'])
  //   })

  //   assertFilesMatchSnapshots(files);
  // })
  
  // describe('dry run');
  // describe('no-console and camelcase');
});