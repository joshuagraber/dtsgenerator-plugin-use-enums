import { ts, PluginContext, Schema } from 'dtsgenerator';
import plugin, { processedEnums, enumDefinitions, enumNameMappings } from '..';
import assert from 'assert';

describe('EnumStrategy option tests', () => {
  // Reset the plugin's internal state before each test
  beforeEach(() => {
    // Reset the internal state of the plugin
    processedEnums.clear();
    Object.keys(enumDefinitions).forEach(key => delete enumDefinitions[key]);
    Object.keys(enumNameMappings).forEach(key => delete enumNameMappings[key]);
  });

  // Helper function to create a TypeScript source file from string
  function createSourceFile(content: string): ts.SourceFile {
    return ts.createSourceFile(
      'test.d.ts',
      content,
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.TS
    );
  }

  // Helper function to transform a source file using our plugin
  async function transformWithPlugin(
    sourceFile: ts.SourceFile, 
    options: { enumStrategy?: 'schema' | 'all', consistentEnumCasing?: string, useConstEnums?: boolean }
  ): Promise<string> {
    // Create plugin context with options
    const context = { 
      option: options,
      inputSchemas: createMockSchemas()
    } as PluginContext;
    
    // Add schema-defined enums to the plugin's internal state
    if (plugin.preProcess) {
      const preProcessHandler = await plugin.preProcess(context);
      if (preProcessHandler) {
        // Create mock schemas that match the Schema type
        const mockSchemas: Schema[] = Array.from(context.inputSchemas).map(([_, schema]) => schema);
        preProcessHandler(mockSchemas);
      }
    }
    
    // Process with the plugin
    const factory = await plugin.postProcess!(context);
    if (!factory) {
      throw new Error('Factory should be returned');
    }

    // Transform the source file
    const result = ts.transform(sourceFile, [factory]);
    
    // Get the transformed source file
    const transformedSourceFile = result.transformed[0];
    
    // Print the result
    const printer = ts.createPrinter();
    const output = printer.printFile(transformedSourceFile);
    
    // Clean up
    result.dispose();
    
    return output;
  }

  // Create mock schemas that match the Schema interface
  function createMockSchemas(): IterableIterator<[string, Schema]> {
    const schemas = new Map<string, Schema>();
    
    // Add a schema with an enum definition
    schemas.set('test', {
      type: 'Latest' as const,
      id: { absolutePath: 'test', type: 'test' },
      content: {
        components: {
          schemas: {
            Status: {
              type: 'string',
              enum: ['active', 'inactive', 'pending']
            }
          }
        }
      }
    } as unknown as Schema);
    
    return schemas.entries();
  }

  it('should only create enums defined in schema when enumStrategy is "schema"', async () => {
    // Create test input with both schema-defined and non-schema string unions
    const input = `
      declare namespace Components {
        namespace Schemas {
          export type Status = "active" | "inactive" | "pending";
        }
      }
      export type Priority = "low" | "medium" | "high";
    `;
    
    const sourceFile = createSourceFile(input);
    const output = await transformWithPlugin(sourceFile, { 
      enumStrategy: 'schema',
      useConstEnums: true
    });
    
    console.log('Schema strategy output:', output);
    
    // Status should be converted to enum (it's in the schema)
    assert.ok(output.includes('export const enum Status'), 'Status enum should be created');
    
    // Priority should remain as a type alias (not in the schema)
    assert.ok(output.includes('export type Priority ='), 'Priority should remain as a type alias');
    assert.ok(!output.includes('export const enum Priority'), 'Priority should not be converted to enum');
  });

  it('should create enums from all string unions when enumStrategy is "all"', async () => {
    // Create test input with both schema-defined and non-schema string unions
    const input = `
      declare namespace Components {
        namespace Schemas {
          export type Status = "active" | "inactive" | "pending";
        }
      }
      export type Priority = "low" | "medium" | "high";
    `;
    
    const sourceFile = createSourceFile(input);
    const output = await transformWithPlugin(sourceFile, { 
      enumStrategy: 'all',
      useConstEnums: true
    });
    
    console.log('All strategy output:', output);
    
    // Both Status and Priority should be converted to enums
    assert.ok(output.includes('export const enum Status'), 'Status enum should be created');
    assert.ok(output.includes('export const enum Priority'), 'Priority enum should be created');
  });
});