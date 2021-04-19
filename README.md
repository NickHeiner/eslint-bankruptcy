# eslint-bankruptcy
> Codemod to eslint-disable all instances of a rule violation in a codebase

## Who Needs This?
Let's say you have an existing codebase, and you'd like to add a new lint rule. When you turn it on, you find that you have many existing violations. Your options are:

1. Go back and fix all existing violations. However, this could be unfeasible, and will delay when you can start getting the protection of the new rule.
1. Turn the rule on as a `warning`. However, this is ineffective because devs ignore warnings.
1. Use a path-specific `.eslintrc` to only enable the rule for greenfield parts of your codebase. However, this is cumbersome, and you won't get protection for newly added code in non-greenfield areas.

None of these options are great. Enter this tool. If you wanted to enable the rule `no-return-assign`, you'd run:

```
$ declare-eslint-bankruptcy src --rule no-return-assign
```

The command will add an `eslint-disable-next-line` to every violation of the specified rule(s). It'll change your code from:

```js
function f() {
  let x = 1;
  return x = 2;
}
```

to:

```js
function f() {
  let x = 1;
  // eslint-disable-next-line no-return-assign
  return x = 2;
}
```

Next, you add `no-return-assign` as an `error` in your `.eslintrc`. Future code, anywhere in your codebase, will have to respect the new rule. Existing code does not need to be further modified.

**Highly recommended:** pass `--explanation` to provide additional context:

```
$ declare-eslint-bankruptcy src --rule no-import-my-legacy-module --explanation "Use MyNewModule instead."
```

```js
// Use MyNewModule instead.
// eslint-disable-next-line no-import-my-legacy-module
import 'my-legacy-module'
```

### When Not To Use This
* When you want to add a new rule, and there are violations in your existing code, but they can be fixed with a codemod or ESLint's autofixer.

## Installation
```
npm install -g eslint-bankruptcy
```

## Usage
See `declare-eslint-bankruptcy --help`.

Passing the `--explanation` flag will set an explanation along with the `eslint-disable` comments. This is highly recommended, because without context, an `eslint-disable` comment is unclear to future developers. Did the original author intend to disable the rule because it's inapplicable to this current case? Or should the violation be fixed, but disabling the rule was just a cut corner?

```
$ declare-eslint-bankruptcy src --rule no-return-assign --explanation "TODO: Clean this up."
```

```js
function f() {
  let x = 1;
  // TODO: Clean this up.
  // eslint-disable-next-line no-return-assign
  return x = 2;
}
```

### ESLint Instance
When you invoke the command line tool, it runs `require.resolve('eslint')` in your curent working directory and uses it. This means that if you run this tool in your repo, and you have ESLint installed locally (as you should), that's the version that will be used.

If ESLint changes its command line interface, this tool could break.

## Areas for Development
* Provide ability to specify an ESLint executable.

## Programmatic Usage
`require('eslint-bankruptcy')`. Look at the type definitions in this package's `main` file for usage.

## Whimsy
Depending on your use case, you may find the following aliases useful:

```
alias fuck_it=declare-eslint-bankruptcy
alias oh_god_im_so_sorry=declare-eslint-bankruptcy
alias i_give_up=declare-eslint-bankruptcy
```