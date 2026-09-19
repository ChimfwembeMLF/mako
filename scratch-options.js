const { Project } = require('ts-morph');

const project = new Project();
project.addSourceFilesAtPaths("api/src/modules/**/*.ts");

const files = project.getSourceFiles();

let changedFiles = 0;

for (const file of files) {
  let changed = false;

  const calls = file.getDescendantsOfKind(require('ts-morph').SyntaxKind.CallExpression);
  
  for (const call of calls) {
    const expr = call.getExpression();
    const text = expr.getText();
    
    if (text.endsWith('aiRouter.complete') || text.endsWith('aiRouter.completeJson')) {
      const args = call.getArguments();
      
      // Determine what variable represents tenantId in the current scope
      let tenantIdVar = 'tenantId';
      
      const functionParent = call.getFirstAncestorByKind(require('ts-morph').SyntaxKind.MethodDeclaration) 
          || call.getFirstAncestorByKind(require('ts-morph').SyntaxKind.FunctionDeclaration)
          || call.getFirstAncestorByKind(require('ts-morph').SyntaxKind.ArrowFunction);
          
      if (functionParent) {
          const bodyText = functionParent.getText();
          if (bodyText.includes('req.tenantId')) {
              tenantIdVar = 'req.tenantId';
          } else if (bodyText.includes('params.tenantId')) {
              tenantIdVar = 'params.tenantId';
          } else if (bodyText.includes('source.tenantId')) {
              tenantIdVar = 'source.tenantId';
          } else if (bodyText.includes('tenantId')) {
              tenantIdVar = 'tenantId';
          } else if (bodyText.includes('payload.tenantId')) {
              tenantIdVar = 'payload.tenantId';
          }
      }

      if (args.length === 1) {
        // No options provided, add `{ tenantId: var }`
        call.addArgument(`{ tenantId: ${tenantIdVar} }`);
        changed = true;
      } else if (args.length === 2) {
        // Options provided, add `tenantId: var` to options
        const optionsArg = args[1];
        if (optionsArg.getKindName() === 'ObjectLiteralExpression') {
          if (!optionsArg.getProperty('tenantId')) {
            optionsArg.addPropertyAssignment({ name: 'tenantId', initializer: tenantIdVar });
            changed = true;
          }
        }
      }
    }
  }

  if (changed) {
    console.log(`Updated call in file: ${file.getFilePath()}`);
    file.saveSync();
    changedFiles++;
  }
}

console.log(`Updated ${changedFiles} files with tenantId.`);
