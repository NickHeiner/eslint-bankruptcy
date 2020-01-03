#! /usr/bin/env node

const eslintBankruptcy = require('..');
const log = require('nth-log');

const {argv} = require('yargs')
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
    }
  });

// TODO: add ability to specify an eslint instance / command path
// Possibly add ability to pass through arbitrary other args to eslint?

async function main() {
  try {
    log.trace(argv);
    await eslintBankruptcy({
      files: argv._,
      rules: argv.rule,
      dry: argv.dry
    });
  } catch (e) {
    console.log(e);
    log.error(e);
    process.exit(1);
  }
}

main();