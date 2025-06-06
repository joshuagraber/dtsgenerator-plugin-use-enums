# dtsgenerator-use-enums

This is the `dtsgenerator` plugin.
This plugin's description is here.

# Install

```
npm install dtsgenerator-plugin-use-enums
```

# Usage

`dtsgen.json`
```json
{
    "plugins": {
        "dtsgenerator-plugin-use-enums": true, // or { config object }
    }
}
```

# Configuration

<!-- If this plugin uses the config object this section is useful for plugin user. -->

- the type of configuration
```ts
type Config = {
  consistentEnumCasing: EnumCasing | undefined;
  useConstEnums: boolean;
};

type EnumCasing =
  /* Both key and value take the casing of the value. 'foo bar' would generate `['foo bar'] = 'foo bar'`  */
  | 'value'
  /* Both key and value take upper snake case of the value. 'foo bar' would generate `FOO_BAR = 'FOO_BAR'` */
  | 'upper'
  /* Both key and value take snake case of the value. 'foo bar' would generate `foo_bar = 'foo_bar'` */
  | 'lower'
  /* Both key and value take pascal case of the value. 'foo bar' would generate `FooBar = 'FooBar'` */
  | 'pascal'
```

| key                  | type                      | description                                                                                                | Default     |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------- |
| consistentEnumCasing | `EnumCasing \| undefined` | If passed, enforces consistent casing. If not passed, keys are SCREAMING_SNAKE and values are as they were | `undefined` |
| useConstEnums        | `boolean`                 | Whether or not to use const enums                                                                          | `false`     |


- Example
```json
{
    "consistentEnumCasing": "upper",
    "useConstEnums": true
}
```


# Development

```
npm run build
npm test
```

## Stacks

- TypeScript
- eslint

## Files

- `index.ts`: plugin main file
- `test/snapshot_test.ts`: test main file. should not edit this file.
- `test/post_snapshots/`: post process test patterns. Please add folder if you need.
- `test/pre_snapshots/`: pre process test patterns. Please add folder if you need.

## npm scripts

### main scripts

- `npm run build`: transpile this plugin. This command need before publishing this plugin.
- `npm test`: test this plugin with coverage.
- `npm run clean`: remove all compiled files.

### sub scripts
- `npm run watch`: watch editing files for compile.
- `npm run lint:fix`: fix lint error automatically.
- `npm run test:update-snapshot`: update snapshot files for unit test.
- `npm run coverage`: report to [coveralls](https://coveralls.io/). Need coveralls configuration file.
