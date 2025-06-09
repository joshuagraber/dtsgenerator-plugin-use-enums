import {
    ts,
    PreProcessHandler,
    Plugin,
    PluginContext,
    Schema,
} from 'dtsgenerator';
import packageJson from './package.json';

/* Plugin options */
export type EnumCasing =
  /* Both key and value take the casing of the value. 'foo bar' would generate `'foo bar' = 'foo bar'`  */
  | 'value'
  /* Both key and value take upper snake case of the value. 'foo bar' would generate `FOO_BAR = 'FOO_BAR'` */
  | 'upper'
  /* Both key and value take snake case of the value. 'foo bar' would generate `foo_bar = 'foo_bar'` */
  | 'lower'
  /* Both key and value take pascal case of the value. 'foo bar' would generate `FooBar = 'FooBar'` */
  | 'pascal'


export type EnumStrategy = 
  /* Create enums only from schema-defined enums (default) */
  | 'schema'
  /* Create enums from all string unions */
  | 'all'

interface EnumPluginOptions {
  /** Force consistent enum casing to one of the EnumCasing options. If omitted, the value will be left as-is, and the key will be transformed to PascalCase */
  consistentEnumCasing?: EnumCasing;
  /** Generate const enums */
  constEnums?: boolean;
  /** Strategy for enum creation. 'schema' only creates enums defined in schema, 'all' creates enums from all string unions */
  enumStrategy?: EnumStrategy;
}

export const processedEnums = new Set<string>();
export const enumDefinitions: Record<string, string[]> = {};
export const enumNameMappings: Record<string, string> = {};

const plugin: Plugin = {
    meta: {
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
    },
    preProcess,
    postProcess,
};

async function preProcess(
    pluginContext: PluginContext
): Promise<PreProcessHandler | undefined> {
    // Extract enums from schema
    if (pluginContext.inputSchemas) {
      for (const [_, schema] of pluginContext.inputSchemas) {
        extractEnumsFromSchema(schema.content, '');
      }
    }
    
    return (schemas) => schemas;
}

async function postProcess(
    pluginContext: PluginContext
): Promise<ts.TransformerFactory<ts.SourceFile> | undefined> {
    const options: EnumPluginOptions = 
      typeof pluginContext.option === 'object' ?  
        pluginContext.option : {};
    
    const enumStrategy = options.enumStrategy ?? 'schema';
    
    return (context: ts.TransformationContext) => {
      return (sourceFile: ts.SourceFile): ts.SourceFile => {
        const factory = context.factory;
        const enumDeclarations: ts.EnumDeclaration[] = [];
        
        // Create enum declarations from extracted definitions
        for (const [enumName, values] of Object.entries(enumDefinitions)) {
          if (!processedEnums.has(enumName)) {
            processedEnums.add(enumName);
            
            // Convert enum name to PascalCase
            const pascalCaseName = toPascalCase(enumName);
            enumNameMappings[enumName.toLowerCase()] = pascalCaseName;
            
            // Create enum members
            const enumMembers = values.map(value => {
              const { enumKey, enumValue } = 
                getEnumMember(options.consistentEnumCasing, value); 

              
              // Create the enum member with appropriate node type
              if (enumKey.startsWith('"')) {
                // For string literal property names (with spaces)
                const keyWithoutQuotes = enumKey.substring(1, enumKey.length - 1);
                return factory.createEnumMember(
                  factory.createStringLiteral(keyWithoutQuotes),
                  factory.createStringLiteral(enumValue)
                );
              } else {
                // For regular identifiers
                return factory.createEnumMember(
                  factory.createIdentifier(enumKey),
                  factory.createStringLiteral(enumValue)
                );
              }
            });
            
            // Create enum declaration with const modifier if specified
            const modifiers: ts.Modifier[] = [factory.createModifier(ts.SyntaxKind.ExportKeyword)];
            if (options.constEnums) {
              modifiers.push(factory.createModifier(ts.SyntaxKind.ConstKeyword));
            }
            
            const enumDeclaration = factory.createEnumDeclaration(
              modifiers,
              factory.createIdentifier(pascalCaseName),
              enumMembers
            );
            
            // Add to our list of enum declarations
            enumDeclarations.push(enumDeclaration);
          }
        }
        
        // Find all type aliases that look like enums (string literal unions)
        function visit(node: ts.Node): ts.Node {
          // Remove stray semicolons
          if (node.kind === ts.SyntaxKind.EmptyStatement) {
            return factory.createNotEmittedStatement(node);
          }
          
          // Handle type references to enums in namespaces
          if (ts.isTypeReferenceNode(node) && ts.isQualifiedName(node.typeName)) {
            // Check if this is a reference to a Components.Schemas.X where X is an enum
            const rightName = node.typeName.right.text;
            
            // If we have a mapping for this enum name, replace the reference with the top-level enum
            if (enumNameMappings[rightName.toLowerCase()]) {
              return factory.createTypeReferenceNode(
                enumNameMappings[rightName.toLowerCase()],
                undefined
              );
            }
          }
          
          // Handle type aliases in namespaces that reference enums
          if (ts.isTypeAliasDeclaration(node) && ts.isTypeReferenceNode(node.type)) {
            const typeNode = node.type;
            
            // If the type alias is referencing an enum, keep it but update the reference
            if (ts.isQualifiedName(typeNode.typeName)) {
              const rightName = typeNode.typeName.right.text;
              if (enumNameMappings[rightName.toLowerCase()]) {
                return factory.updateTypeAliasDeclaration(
                  node,
                  node.modifiers,
                  node.name,
                  node.typeParameters,
                  factory.createTypeReferenceNode(
                    enumNameMappings[rightName.toLowerCase()],
                    undefined
                  )
                );
              }
            }
          }
          
          if (ts.isTypeAliasDeclaration(node)) {
            const typeNode = node.type;
            
            if (ts.isUnionTypeNode(typeNode)) {
              // Check if all union members are string literals
              const stringLiterals = typeNode.types.filter(
                type => ts.isLiteralTypeNode(type) && 
                ts.isStringLiteral((type as ts.LiteralTypeNode).literal)
              );
              
              // If all members are string literals, convert to enum
              if (stringLiterals.length === typeNode.types.length && stringLiterals.length > 0 && 
                // Only proceed if enumStrategy is 'all' or we're dealing with a schema-defined enum
                  (enumStrategy === 'all' || processedEnums.has(node.name.text))) {
                const enumName = node.name.text;
                const pascalCaseName = toPascalCase(enumName);
                enumNameMappings[enumName.toLowerCase()] = pascalCaseName;
                
                if (!processedEnums.has(enumName)) {
                  processedEnums.add(enumName);
                  
                  // Create enum members
                  const enumMembers = stringLiterals.map(literal => {
                    const stringLiteral = (literal as ts.LiteralTypeNode).literal as ts.StringLiteral;
                    const value = stringLiteral.text;
                    const { enumKey, enumValue } = getEnumMember(options.consistentEnumCasing, value); 

                    
                    // Create the enum member with appropriate node type
                    if (enumKey.startsWith('"')) {
                      // For string literal property names (with spaces)
                      const keyWithoutQuotes = enumKey.substring(1, enumKey.length - 1);
                      return factory.createEnumMember(
                        factory.createStringLiteral(keyWithoutQuotes),
                        factory.createStringLiteral(enumValue)
                      );
                    } else {
                      // For regular identifiers
                      return factory.createEnumMember(
                        factory.createIdentifier(enumKey),
                        factory.createStringLiteral(enumValue)
                      );
                    }
                  });
                  
                  // Create enum declaration with const modifier if specified
                  const modifiers: ts.ModifierLike[] = [...(node.modifiers ?? [])];
                  if (options.constEnums) {
                    modifiers.push(factory.createModifier(ts.SyntaxKind.ConstKeyword) as ts.Modifier);
                  }
                  
                  const enumDeclaration = factory.createEnumDeclaration(
                    modifiers,
                    factory.createIdentifier(pascalCaseName),
                    enumMembers
                  );
                  
                  // Add to our list of enum declarations
                  enumDeclarations.push(enumDeclaration);
                  
                  // Return an empty statement to remove the original type alias
                  return factory.createEmptyStatement();
                }
              }
            }
          }
          
          // Replace string literal union property types with enum references
          if (ts.isPropertySignature(node) && node.type) {
            // Handle direct union types
            if (ts.isUnionTypeNode(node.type)) {
              const typeNode = node.type;
              const stringLiterals = typeNode.types.filter(
                type => ts.isLiteralTypeNode(type) && 
                       ts.isStringLiteral((type as ts.LiteralTypeNode).literal)
              );
              
              // Only process if enumStrategy is 'all'
              if (stringLiterals.length === typeNode.types.length && stringLiterals.length > 0 && enumStrategy === 'all') {
                // Extract values to create an enum name
                const values = stringLiterals.map(literal => 
                  ((literal as ts.LiteralTypeNode).literal as ts.StringLiteral).text
                );
                
                // Generate a name based on property name
                let enumName = '';
                if (node.name && ts.isIdentifier(node.name)) {
                  enumName = node.name.text;
                }
                
                // Check if this matches an existing enum
                for (const [existingName, existingValues] of Object.entries(enumDefinitions)) {
                  if (arraysEqual(values, existingValues)) {
                    enumName = existingName;
                    break;
                  }
                }
                
                if (enumName && !processedEnums.has(enumName)) {
                  processedEnums.add(enumName);
                  enumDefinitions[enumName] = values;
                  
                  // Convert enum name to PascalCase
                  const pascalCaseName = toPascalCase(enumName);
                  enumNameMappings[enumName.toLowerCase()] = pascalCaseName;
                  
                  // Create enum members
                  const enumMembers = values.map(value => {
                  const { enumKey, enumValue } = getEnumMember(options.consistentEnumCasing, value); 
                    
                    // Create the enum member with appropriate node type
                    if (enumKey.startsWith('"')) {
                      // For string literal property names (with spaces)
                      const keyWithoutQuotes = enumKey.substring(1, enumKey.length - 1);
                      return factory.createEnumMember(
                        factory.createStringLiteral(keyWithoutQuotes),
                        factory.createStringLiteral(enumValue)
                      );
                    } else {
                      // For regular identifiers
                      return factory.createEnumMember(
                        factory.createIdentifier(enumKey),
                        factory.createStringLiteral(enumValue)
                      );
                    }
                  });
                  
                  // Create enum declaration with const modifier if specified
                  const modifiers: ts.Modifier[] = [factory.createModifier(ts.SyntaxKind.ExportKeyword)];
                  if (options.constEnums) {
                    modifiers.push(factory.createModifier(ts.SyntaxKind.ConstKeyword) as ts.Modifier);
                  }
                  
                  const enumDeclaration = factory.createEnumDeclaration(
                    modifiers,
                    factory.createIdentifier(pascalCaseName),
                    enumMembers
                  );
                  
                  // Add to our list of enum declarations
                  enumDeclarations.push(enumDeclaration);
                }
                
                if (enumName) {
                  // Replace the union type with the enum reference
                  return factory.updatePropertySignature(
                    node,
                    node.modifiers,
                    node.name,
                    node.questionToken,
                    factory.createTypeReferenceNode(toPascalCase(enumName), undefined)
                  );
                }
              }
            }
            
            // Handle qualified name references (e.g., Components.Schemas.SubscriptionStatus)
            if (ts.isTypeReferenceNode(node.type) && ts.isQualifiedName(node.type.typeName)) {
              const rightName = node.type.typeName.right.text;
              
              // If we have a mapping for this enum name, replace the reference with the top-level enum
              if (enumNameMappings[rightName.toLowerCase()]) {
                return factory.updatePropertySignature(
                  node,
                  node.modifiers,
                  node.name,
                  node.questionToken,
                  factory.createTypeReferenceNode(
                    enumNameMappings[rightName.toLowerCase()],
                    undefined
                  )
                );
              }
            }
          }
          
          // Preserve export keyword in namespaces
          if (ts.isModuleDeclaration(node) && node.body && ts.isModuleBlock(node.body)) {
            const visitedStatements = ts.visitNodes(node.body.statements, visit, ts.isStatement);
            return factory.updateModuleDeclaration(
              node,
              node.modifiers,
              node.name,
              factory.updateModuleBlock(node.body, visitedStatements)
            );
          }
          
          return ts.visitEachChild(node, visit, context);
        }
        
        // Visit all nodes in the source file
        const transformedSourceFile = ts.visitNode(sourceFile, visit) as ts.SourceFile;
        
        // If we found any enums, create a new source file with the enum declarations at the beginning
        if (enumDeclarations.length > 0) {
          const newStatements = [...enumDeclarations, ...transformedSourceFile.statements];
          return factory.updateSourceFile(transformedSourceFile, newStatements);
        }
        
        return transformedSourceFile;
      };
    };
}


/* UTILS */
function extractEnumsFromSchema(schema: Schema['content'], path: string): void {
  if (!schema || typeof schema !== 'object') return;
  
  if (schema.type === 'string' && Array.isArray(schema.enum)) {
    const name = path.split('/').pop();
    if (name && !enumDefinitions[name]) {
      enumDefinitions[name] = schema.enum;
    }
  }
  
  for (const key in schema) {
    extractEnumsFromSchema(schema[key as keyof typeof schema], `${path}/${key}`);
  }
}

function toPascalCase(str: string): string {
  if (!str) return '';
  
  // Handle already PascalCased strings (preserve existing casing)
  if (/^[A-Z][a-zA-Z0-9]*$/.test(str)) {
    return str;
  }
  
  return str
    .split(/[-_]+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('') || str.charAt(0).toUpperCase() + str.slice(1);
}

function arraysEqual(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  
  const countMap = new Map();
  
  for (const val of a) {
    countMap.set(val, (countMap.get(val) ?? 0) + 1);
  }
  
  for (const val of b) {
    const count = countMap.get(val);
    if (!count) return false;
    countMap.set(val, count - 1);
  }
  
  return true;
}

function getEnumMember(consistentEnumCasing: EnumCasing | undefined, value: string) {
    let enumKey = value, enumValue = value;

    switch (consistentEnumCasing) {
    case 'value':
      // For 'value' option, keep the original value but handle spaces
      enumKey = /\s/.test(value) ? `"${value}"` : value;
      break;
    case 'upper':
      enumKey = value.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
      enumValue = value.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
      break;
    case 'lower':
      enumKey = value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      enumValue = value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      break;
    case 'pascal':
      enumKey = toPascalCase(value);
      enumValue = toPascalCase(value);
      break;
    default:
      enumKey = toPascalCase(value);
  }

  return { enumKey, enumValue };
}

export default plugin;