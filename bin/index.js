#! /usr/bin/env node

const eslintBankruptcy = require('..');
const log = require('nth-log');

const {argv} = require('yargs')
  .options({
    rule: {
      alias: 'r',
      array: true,
      demandOption: true,
      description: 'The rule to disable. Pass this flag multiple times to disable multiple rules at once.',
      coerce: rules => rules.map(/** @param {any} rule */ rule => rule.toString())
    }
  });

// TODO: add ability to specify an eslint instance / command path
// Possibly add ability to pass through arbitrary other args to eslint?

async function main() {
  try {
    console.log(argv);
    await eslintBankruptcy({
      files: argv._,
      // @ts-ignore the coerce function ensures that argv.rule will be string[].
      rules: argv.rule
    });
  } catch (e) {
    console.log(e);
    log.error(e);
    process.exit(1);
  }
}

main();