#! /usr/bin/env node

const eslintBankruptcy = require('..');

const {argv} = require('yargs')
  .options({
    rule: {
      alias: 'r',
      array: true,
      description: 'The rule to disable. Pass this flag multiple times to disable multiple rules at once.'
    }
  })
  .demandOption('rule', 'You must specify at least one eslint rule to disable.');

// TODO: add ability to specify an eslint instance / command path
// Possibly add ability to pass through arbitrary other args to eslint?

async function main() {
  try {
    await eslintBankruptcy({
      files: argv._,
      rules: argv.rule
    });
  } catch (e) {
    console.log(e);
    process.exit(1);
  }
}

main();