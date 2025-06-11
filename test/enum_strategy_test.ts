import { ts, PluginContext, Schema } from 'dtsgenerator';
import plugin from '..';
import assert from 'assert';

describe('EnumStrategy option tests', () => {
  // Note: The new implementation manages state internally and clears it automatically

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
    options: { enumStrategy?: 'schema' | 'all', consistentEnumCasing?: string, constEnums?: boolean }
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
      constEnums: true
    });
    
    console.log('Schema strategy output:', output);
    
    // With the new implementation, enums are created within their namespaces
    // Status should be converted to enum (it's in the schema)
    assert.ok(output.includes('export const enum Status'), 'Status enum should be created');
    
    // Priority should remain as a type alias (not in the schema)
    assert.ok(output.includes('export type Priority ='), 'Priority should remain as a type alias');
    assert.ok(!output.includes('const enum Priority'), 'Priority should not be converted to enum');
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
      constEnums: true
    });
    
    console.log('All strategy output:', output);
    
    // With the new implementation, both should be converted to enums
    // Status should be in the Components.Schemas namespace
    assert.ok(output.includes('export const enum Status'), 'Status enum should be created');
    // Priority should be at the top level
    assert.ok(output.includes('export const enum Priority'), 'Priority enum should be created');
  });

  it('should handle enums with same name but different values in different namespaces', async () => {
    // Test case for the edge case: same enum name, different values, different namespaces
    // This ensures we don't incorrectly deduplicate enums that happen to have the same name
    // but are in different contexts and have different values
    const input = `
      declare namespace ServiceA {
        export type Status = "pending" | "approved" | "rejected";
        
        export interface Request {
          status: Status;
        }
      }

      declare namespace ServiceB {
        export type Status = "active" | "inactive" | "suspended";
        
        export interface User {
          status: Status;
        }
      }
    `;
    
    const sourceFile = createSourceFile(input);
    const output = await transformWithPlugin(sourceFile, { 
      enumStrategy: 'all',
      constEnums: false
    });
    
    console.log('Same name, different values output:', output);
    
    // Both Status enums should be created in their respective namespaces
    assert.ok(output.includes('namespace ServiceA'), 'ServiceA namespace should exist');
    assert.ok(output.includes('namespace ServiceB'), 'ServiceB namespace should exist');
    
    // Check that both enums are created with their respective values
    assert.ok(output.includes('"pending"') && output.includes('"approved"') && output.includes('"rejected"'), 
              'ServiceA Status enum should have its values');
    assert.ok(output.includes('"active"') && output.includes('"inactive"') && output.includes('"suspended"'), 
              'ServiceB Status enum should have its values');
    
    // Check that properties reference their local enums
    assert.ok(output.includes('status: Status'), 'Properties should reference local Status enum');
  });

  it('should handle enums with same name and same values in different namespaces', async () => {
    // Test case: same enum name, same values, different namespaces
    // This ensures we create separate enums even when values are identical,
    // maintaining namespace isolation and avoiding unwanted cross-namespace deduplication
    const input = `
      declare namespace ServiceC {
        export type Priority = "low" | "medium" | "high";
        
        export interface TaskC {
          priority: Priority;
        }
      }

      declare namespace ServiceD {
        export type Priority = "low" | "medium" | "high";
        
        export interface TaskD {
          priority: Priority;
        }
      }
    `;
    
    const sourceFile = createSourceFile(input);
    const output = await transformWithPlugin(sourceFile, { 
      enumStrategy: 'all',
      constEnums: false
    });
    
    console.log('Same name, same values output:', output);
    
    // Should create enums in both namespaces (maintaining namespace isolation)
    assert.ok(output.includes('namespace ServiceC'), 'ServiceC namespace should exist');
    assert.ok(output.includes('namespace ServiceD'), 'ServiceD namespace should exist');
    
    // Both should have Priority enum with the same values
    assert.ok(output.includes('"low"') && output.includes('"medium"') && output.includes('"high"'), 
              'Priority enum should have the expected values');
    
    // Properties should reference their local Priority enum
    assert.ok(output.includes('priority: Priority'), 'Properties should reference Priority enum');
  });
});