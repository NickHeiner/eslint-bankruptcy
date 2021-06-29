#! /usr/bin/env node

const eslintBankruptcy = require('..');

// This is valid, but the types don't know it.
// @ts-ignore
require('hard-rejection/register');

require('yargs')
  .command('$0 <files...>', '', yargs => {
    yargs.positional('files', {
      describe: 'Files to modify',
      string: true,
      required: true
    });
  }, main)
  .options({
    rule: {
      alias: 'r',
      array: true,
      string: true,
      demandOption: true,
      description: 'The rule to disable. Pass this flag multiple times to disable multiple rules at once.'
    },
    dry: {
      alias: 'd',
      boolean: true,
      description: 'If true, print a description of which files will be updated, but do not actually change anything.'
    },
    explanation: {
      alias: 'e',
      string: true,
      description: 'Highly recommended. A message that will be included with the disable comments.'
    },
    eslintOutputFilePath: {
      string: true,
      description: '[Experimental] Pass the output of `eslint --format json`. ' +
        'Use this if your project has a special eslint setup, or you want to preprocess what this tool runs on.'
    }
  })
  .argv;

// TODO: add ability to specify an eslint instance / command path
// Possibly add ability to pass through arbitrary other args to eslint?

/**
 * I'm not sure how to these types flow automatically.
 * @param {Record<'files' | 'rule' | 'dry' | 'explanation', any>} argv 
 */
async function main(argv) {
  if (!argv.files.length) {
    throw new Error(
      'Passing a set of files to declare-eslint-bankruptcy is required. Pass it as the sole positional argument.'
    );
  }
  await eslintBankruptcy({
    files: argv.files,
    rules: argv.rule,
    dry: argv.dry,
    explanation: argv.explanation,
    eslintOutputFilePath: argv. eslintOutputFilePath
  });
}
