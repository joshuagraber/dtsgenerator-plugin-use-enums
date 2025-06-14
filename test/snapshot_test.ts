import fs from 'fs';
import path from 'path';
import { ts, PluginContext, parseSchema, JsonSchema } from 'dtsgenerator';
import plugin from '..';
import assert from 'assert';

const splitStringByNewLine = (input: string): string[] => {
    const splitted = input.split(/\r?\n/);
    return splitted ? splitted : [];
};

describe('PreProcess Snapshot testing', () => {
    const fixturesDir = path.join(__dirname, 'pre_snapshots');
    const inputFileName = 'input.json';
    const configFileName = 'config.json';
    const expectedFileName = 'expected.json';

    fs.readdirSync(fixturesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => {
            const caseName = dirent.name;
            const normalizedTestName = caseName.replace(/-/g, ' ');

            it(`Test ${normalizedTestName}`, async function () {
                const fixtureDir = path.join(fixturesDir, caseName);
                const inputFilePath = path.join(fixtureDir, inputFileName);
                const configFilePath = path.join(fixtureDir, configFileName);
                const expectedFilePath = path.join(
                    fixtureDir,
                    expectedFileName,
                );

                const inputContent = fs.readFileSync(inputFilePath, {
                    encoding: 'utf-8',
                });
                const input = (JSON.parse(inputContent) as JsonSchema[]).map(
                    (c) => parseSchema(c),
                );
                const option = fs.existsSync(configFilePath)
                    ? require(configFilePath)
                    : {};

                const context = { option } as PluginContext;
                const p = plugin.preProcess;
                if (p == null) {
                    assert.fail('pre process plugin is not configured.');
                }
                const handler = await p(context);
                if (handler == null) {
                    assert.fail('factory is not returned.');
                }

                const result = handler(input);
                const actual = JSON.stringify(result, null, 2);

                // When we do `UPDATE_SNAPSHOT=1 npm test`, update snapshot data.
                if (process.env.UPDATE_SNAPSHOT) {
                    fs.writeFileSync(expectedFilePath, actual);
                    this.skip();
                }
                const expected = fs.readFileSync(expectedFilePath, {
                    encoding: 'utf-8',
                });
                assert.deepStrictEqual(
                    splitStringByNewLine(actual),
                    splitStringByNewLine(expected),
                    `
${fixtureDir}
${actual}
`,
                );
            });
        });
});

describe('PostProcess Snapshot testing', () => {
    const fixturesDir = path.join(__dirname, 'post_snapshots');
    const inputFileName = 'input.d.ts';
    const configFileName = 'config.json';
    const expectedFileName = 'expected.d.ts';

    fs.readdirSync(fixturesDir, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => {
            const caseName = dirent.name;
            const normalizedTestName = caseName.replace(/-/g, ' ');

            it(`Test ${normalizedTestName}`, async function () {
                const fixtureDir = path.join(fixturesDir, caseName);
                const inputFilePath = path.join(fixtureDir, inputFileName);
                const configFilePath = path.join(fixtureDir, configFileName);
                const expectedFilePath = path.join(
                    fixtureDir,
                    expectedFileName,
                );

                const inputContent = fs.readFileSync(inputFilePath, {
                    encoding: 'utf-8',
                });
                const input = ts.createSourceFile(
                    '_.d.ts',
                    inputContent,
                    ts.ScriptTarget.Latest,
                    false,
                    ts.ScriptKind.TS,
                );
                const option = fs.existsSync(configFilePath)
                    ? require(configFilePath)
                    : {};

                const context = { option } as PluginContext;
                const p = plugin.postProcess;
                if (p == null) {
                    assert.fail('post process plugin is not configured.');
                }
                const factory = await p(context);
                if (factory == null) {
                    assert.fail('factory is not returned.');
                }

                const result = ts.transform(input, [factory]);
                const printer = ts.createPrinter();
                const actual = printer.printFile(result.transformed[0]);
                result.dispose();

                // When we do `UPDATE_SNAPSHOT=1 npm test`, update snapshot data.
                if (process.env.UPDATE_SNAPSHOT) {
                    fs.writeFileSync(expectedFilePath, actual);
                    this.skip();
                }
                const expected = fs.readFileSync(expectedFilePath, {
                    encoding: 'utf-8',
                });
                assert.deepStrictEqual(
                    splitStringByNewLine(actual),
                    splitStringByNewLine(expected),
                    `
${fixtureDir}
${actual}
`,
                );
            });
        });
});
