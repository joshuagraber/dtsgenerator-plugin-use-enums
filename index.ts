import {
    ts,
    PreProcessHandler,
    Plugin,
    PluginContext,
} from 'dtsgenerator';
import packageJson from './package.json';

/* Plugin options */
export type EnumCasing =
  | 'value'
  | 'upper'
  | 'lower'
  | 'pascal'

export type EnumStrategy = 
  | 'schema'
  | 'all'

interface EnumPluginOptions {
  consistentEnumCasing?: EnumCasing;
  constEnums?: boolean;
  enumStrategy?: EnumStrategy;
}

interface EnumInfo {
  name: string;
  values: string[];
  namespacePath: string[];
  pascalCaseName: string;
  fullPath: string; 
}

const enumsByValues = new Map<string, EnumInfo>();
const enumsByPath = new Map<string, EnumInfo>();
const processedEnums = new Set<string>();
const schemaDefinedEnums = new Set<string>();

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
    // Clear previous state
    enumsByValues.clear();
    enumsByPath.clear();
    processedEnums.clear();
    schemaDefinedEnums.clear();
    
    // Extract schema-defined enums
    if (pluginContext.inputSchemas) {
      for (const [_, schema] of pluginContext.inputSchemas) {
        extractSchemaEnums(schema.content, []);
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
        
        // First pass: collect all string unions and their contexts
        function collectEnums(node: ts.Node, namespacePath: string[] = []): void {
          if (ts.isModuleDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
            const newPath = [...namespacePath, node.name.text];
            if (node.body && ts.isModuleBlock(node.body)) {
              node.body.statements.forEach(stmt => collectEnums(stmt, newPath));
            }
          } else if (ts.isTypeAliasDeclaration(node) && ts.isUnionTypeNode(node.type)) {
            const typeNode = node.type;
            const stringLiterals = typeNode.types.filter(
              type => ts.isLiteralTypeNode(type) && 
              ts.isStringLiteral((type as ts.LiteralTypeNode).literal)
            );
            
            if (stringLiterals.length === typeNode.types.length && stringLiterals.length > 0) {
              const enumName = node.name.text;
              const values = stringLiterals.map(literal => 
                ((literal as ts.LiteralTypeNode).literal as ts.StringLiteral).text
              );
              
              if (enumStrategy === 'all' || isSchemaDefinedEnum(enumName, values)) {
                registerEnum(enumName, values, namespacePath);
              }
            }
          } else if (ts.isPropertySignature(node) && node.type && ts.isUnionTypeNode(node.type)) {
            // Handle inline union types in properties
            if (enumStrategy === 'all') {
              const typeNode = node.type;
              const stringLiterals = typeNode.types.filter(
                type => ts.isLiteralTypeNode(type) && 
                  ts.isStringLiteral((type as ts.LiteralTypeNode).literal)
              );
              
              if (stringLiterals.length === typeNode.types.length && stringLiterals.length > 0) {
                const values = stringLiterals.map(literal => 
                  ((literal as ts.LiteralTypeNode).literal as ts.StringLiteral).text
                );
                
                // Generate enum name based on property name
                if (node.name && ts.isIdentifier(node.name)) {
                  const enumName = node.name.text;
                  registerEnum(enumName, values, namespacePath);
                }
              }
            }
          }
          
          ts.forEachChild(node, child => collectEnums(child, namespacePath));
        }
        
        // Collect all enums first
        collectEnums(sourceFile);
        
        // Second pass: transform the AST
        function visit(node: ts.Node, currentNamespacePath: string[] = []): ts.Node {
          if (ts.isModuleDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
            const newPath = [...currentNamespacePath, node.name.text];
            
            if (node.body && ts.isModuleBlock(node.body)) {
              const transformedStatements: ts.Statement[] = [];
              const enumsToAdd: ts.EnumDeclaration[] = [];
              
              // Add enums that belong to this namespace
              for (const [_, enumInfo] of enumsByPath.entries()) {
                if (arraysEqual(enumInfo.namespacePath, newPath) && !processedEnums.has(enumInfo.fullPath)) {
                  processedEnums.add(enumInfo.fullPath);
                  
                  const enumMembers = enumInfo.values.map(value => {
                    const { enumKey: memberKey, enumValue } = 
                      getEnumMember(options.consistentEnumCasing, value);
                    
                    if (memberKey.startsWith('"')) {
                      const keyWithoutQuotes = memberKey.substring(1, memberKey.length - 1);
                      return factory.createEnumMember(
                        factory.createStringLiteral(keyWithoutQuotes),
                        factory.createStringLiteral(enumValue)
                      );
                    } else {
                      return factory.createEnumMember(
                        factory.createIdentifier(memberKey),
                        factory.createStringLiteral(enumValue)
                      );
                    }
                  });
                  
                  const modifiers: ts.Modifier[] = [factory.createModifier(ts.SyntaxKind.ExportKeyword)];
                  if (options.constEnums) {
                    modifiers.push(factory.createModifier(ts.SyntaxKind.ConstKeyword));
                  }
                  
                  const enumDeclaration = factory.createEnumDeclaration(
                    modifiers,
                    factory.createIdentifier(enumInfo.pascalCaseName),
                    enumMembers
                  );
                  
                  enumsToAdd.push(enumDeclaration);
                }
              }
              
              // Process existing statements
              for (const stmt of node.body.statements) {
                const transformedStmt = ts.visitNode(stmt, (child) => visit(child, newPath)) as ts.Statement;
                
                // Skip type aliases that we've converted to enums
                if (ts.isTypeAliasDeclaration(transformedStmt)) {
                  const fullPath = [...newPath, transformedStmt.name.text].join('.');
                  if (enumsByPath.has(fullPath)) {
                    continue; // Skip this type alias as it's now an enum
                  }
                }
                
                transformedStatements.push(transformedStmt);
              }
              
              // Combine enums and other statements
              const allStatements = [...enumsToAdd, ...transformedStatements];
              
              return factory.updateModuleDeclaration(
                node,
                node.modifiers,
                node.name,
                factory.updateModuleBlock(node.body, allStatements)
              );
            }
          }
          
          // Handle top-level type aliases that should become enums
          if (ts.isTypeAliasDeclaration(node) && ts.isUnionTypeNode(node.type)) {
            const typeNode = node.type;
            const stringLiterals = typeNode.types.filter(
              type => ts.isLiteralTypeNode(type) && 
              ts.isStringLiteral((type as ts.LiteralTypeNode).literal)
            );
            
            if (stringLiterals.length === typeNode.types.length && stringLiterals.length > 0) {
              const enumName = node.name.text;
              const values = stringLiterals.map(literal => 
                ((literal as ts.LiteralTypeNode).literal as ts.StringLiteral).text
              );
              
              if (enumStrategy === 'all' || isSchemaDefinedEnum(enumName, values)) {
                const fullPath = [...currentNamespacePath, enumName].join('.');
                const enumInfo = enumsByPath.get(fullPath);
                
                if (enumInfo && !processedEnums.has(fullPath)) {
                  processedEnums.add(fullPath);
                  
                  const enumMembers = enumInfo.values.map(value => {
                    const { enumKey: memberKey, enumValue } = 
                      getEnumMember(options.consistentEnumCasing, value);
                    
                    if (memberKey.startsWith('"')) {
                      const keyWithoutQuotes = memberKey.substring(1, memberKey.length - 1);
                      return factory.createEnumMember(
                        factory.createStringLiteral(keyWithoutQuotes),
                        factory.createStringLiteral(enumValue)
                      );
                    } else {
                      return factory.createEnumMember(
                        factory.createIdentifier(memberKey),
                        factory.createStringLiteral(enumValue)
                      );
                    }
                  });
                  
                  const modifiers: ts.Modifier[] = [factory.createModifier(ts.SyntaxKind.ExportKeyword)];
                  if (options.constEnums) {
                    modifiers.push(factory.createModifier(ts.SyntaxKind.ConstKeyword));
                  }
                  
                  const enumDeclaration = factory.createEnumDeclaration(
                    modifiers,
                    factory.createIdentifier(enumInfo.pascalCaseName),
                    enumMembers
                  );
                  
                  return enumDeclaration;
                }
              }
            }
          }
          
          // Handle property signatures - replace union types with enum references
          if (ts.isPropertySignature(node) && node.type) {
            if (ts.isUnionTypeNode(node.type)) {
              const typeNode = node.type;
              const stringLiterals = typeNode.types.filter(
                type => ts.isLiteralTypeNode(type) && 
                  ts.isStringLiteral((type as ts.LiteralTypeNode).literal)
              );
              
              if (stringLiterals.length === typeNode.types.length && stringLiterals.length > 0) {
                const values = stringLiterals.map(literal => 
                  ((literal as ts.LiteralTypeNode).literal as ts.StringLiteral).text
                );
                
                // Find the canonical enum for these values
                const valuesKey = JSON.stringify(values.sort());
                const enumInfo = enumsByValues.get(valuesKey);
                
                if (enumInfo) {
                  // Determine if we need a qualified reference
                  const needsQualifiedReference = !arraysEqual(enumInfo.namespacePath, currentNamespacePath);
                  
                  if (needsQualifiedReference && enumInfo.namespacePath.length > 0) {
                    // Create qualified reference
                    const qualifiedName = createQualifiedName(factory, enumInfo.namespacePath, enumInfo.pascalCaseName);
                    return factory.updatePropertySignature(
                      node,
                      node.modifiers,
                      node.name,
                      node.questionToken,
                      factory.createTypeReferenceNode(qualifiedName, undefined)
                    );
                  } else {
                    // Use simple reference
                    return factory.updatePropertySignature(
                      node,
                      node.modifiers,
                      node.name,
                      node.questionToken,
                      factory.createTypeReferenceNode(enumInfo.pascalCaseName, undefined)
                    );
                  }
                }
              }
            }
            
            // Handle qualified name references - replace with appropriate enum references
            if (ts.isTypeReferenceNode(node.type) && ts.isQualifiedName(node.type.typeName)) {
              const qualifiedName = node.type.typeName;
              const fullPath = getFullPathFromQualifiedName(qualifiedName);
              const enumInfo = enumsByPath.get(fullPath);
              
              if (enumInfo) {
                // Determine the best reference to use
                const needsQualifiedReference = !arraysEqual(enumInfo.namespacePath, currentNamespacePath);
                
                if (needsQualifiedReference && enumInfo.namespacePath.length > 0) {
                  const newQualifiedName = createQualifiedName(factory, enumInfo.namespacePath, enumInfo.pascalCaseName);
                  return factory.updatePropertySignature(
                    node,
                    node.modifiers,
                    node.name,
                    node.questionToken,
                    factory.createTypeReferenceNode(newQualifiedName, undefined)
                  );
                } else {
                  return factory.updatePropertySignature(
                    node,
                    node.modifiers,
                    node.name,
                    node.questionToken,
                    factory.createTypeReferenceNode(enumInfo.pascalCaseName, undefined)
                  );
                }
              }
            }
          }
          
          // Handle type references in other contexts
          if (ts.isTypeReferenceNode(node) && ts.isQualifiedName(node.typeName)) {
            const qualifiedName = node.typeName;
            const fullPath = getFullPathFromQualifiedName(qualifiedName);
            const enumInfo = enumsByPath.get(fullPath);
            
            if (enumInfo) {
              const needsQualifiedReference = !arraysEqual(enumInfo.namespacePath, currentNamespacePath);
              
              if (needsQualifiedReference && enumInfo.namespacePath.length > 0) {
                const newQualifiedName = createQualifiedName(factory, enumInfo.namespacePath, enumInfo.pascalCaseName);
                return factory.createTypeReferenceNode(newQualifiedName, undefined);
              } else {
                return factory.createTypeReferenceNode(enumInfo.pascalCaseName, undefined);
              }
            }
          }
          
          return ts.visitEachChild(node, (child) => visit(child, currentNamespacePath), context);
        }
        
        // Transform the source file
        const transformedSourceFile = ts.visitNode(sourceFile, visit) as ts.SourceFile;
        
        return transformedSourceFile;
      };
    };
}

/* UTILS */
function extractSchemaEnums(content: unknown, path: string[]): void {
  if (!content || typeof content !== 'object' || !('type' in content) || !('enum' in content)) return;
  
  // Check if this is an enum definition
  if (content.type === 'string' && Array.isArray(content.enum)) {
    // This is a schema-defined enum
    const enumName = path[path.length - 1];
    if (enumName) {
      schemaDefinedEnums.add(enumName);
    }
  }
  
  // Recursively check nested objects
  for (const [key, value] of Object.entries(content)) {
    extractSchemaEnums(value, [...path, key]);
  }
}

function registerEnum(name: string, values: string[], namespacePath: string[]): void {
  const valuesKey = JSON.stringify(values.sort());
  const fullPath = [...namespacePath, name].join('.');
  const pascalCaseName = toPascalCase(name);
  
  // Check if we already have an enum with these exact values
  const existingEnum = enumsByValues.get(valuesKey);
  if (existingEnum) {
    // Use the existing enum's location as the canonical one
    // But still register this path for reference resolution
    enumsByPath.set(fullPath, existingEnum);
    return;
  }
  
  // Create new enum info
  const enumInfo: EnumInfo = {
    name,
    values,
    namespacePath,
    pascalCaseName,
    fullPath
  };
  
  enumsByValues.set(valuesKey, enumInfo);
  enumsByPath.set(fullPath, enumInfo);
}

function createQualifiedName(factory: ts.NodeFactory, namespacePath: string[], enumName: string): ts.EntityName {
  if (namespacePath.length === 0) {
    return factory.createIdentifier(enumName);
  }
  
  let result: ts.EntityName = factory.createIdentifier(namespacePath[0]);
  for (let i = 1; i < namespacePath.length; i++) {
    result = factory.createQualifiedName(result, factory.createIdentifier(namespacePath[i]));
  }
  
  return factory.createQualifiedName(result, factory.createIdentifier(enumName));
}

function getFullPathFromQualifiedName(qualifiedName: ts.QualifiedName): string {
  const parts: string[] = [];
  
  function collectParts(node: ts.EntityName): void {
    if (ts.isIdentifier(node)) {
      parts.unshift(node.text);
    } else if (ts.isQualifiedName(node)) {
      parts.unshift(node.right.text);
      collectParts(node.left);
    }
  }
  
  collectParts(qualifiedName);
  return parts.join('.');
}

function isSchemaDefinedEnum(name: string, _values: string[]): boolean {
  return schemaDefinedEnums.has(name);
}

function toPascalCase(str: string): string {
  if (!str) return '';
  
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
    
    // eslint-disable-next-line no-useless-escape
    const hasInvalidChars = /[\s&\-+.(){}[\]^%$#@!,;:'\"\/\\<>?=*|~`]/.test(value);

    switch (consistentEnumCasing) {
    case 'value':
      enumKey = hasInvalidChars ? `"${value}"` : value;
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
