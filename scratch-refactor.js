const { Project } = require('ts-morph');
const path = require('path');

const project = new Project();
project.addSourceFilesAtPaths("api/src/modules/**/*.ts");

const files = project.getSourceFiles();

let changedFiles = 0;

for (const file of files) {
  let changed = false;

  // 1. Update import
  const imports = file.getImportDeclarations();
  for (const imp of imports) {
    if (imp.getModuleSpecifierValue().includes('mistral-chat.service')) {
      const specifier = imp.getModuleSpecifierValue().replace('mistral-chat.service', 'ai-provider-router.service');
      imp.setModuleSpecifier(specifier);
      
      const namedImports = imp.getNamedImports();
      for (const named of namedImports) {
        if (named.getName() === 'MistralChatService') {
          named.replaceWithText('AiProviderRouter');
          changed = true;
        }
      }
    }
  }

  // 2. Update constructor injection
  const classes = file.getClasses();
  for (const cls of classes) {
    const constructors = cls.getConstructors();
    for (const ctor of constructors) {
      const params = ctor.getParameters();
      for (const param of params) {
        if (param.getTypeNode()?.getText() === 'MistralChatService') {
          param.setType('AiProviderRouter');
          const name = param.getName();
          if (name === 'mistral' || name === 'mistralChat') {
            param.rename('aiRouter');
          }
          changed = true;
        }
      }
    }
  }

  if (changed) {
    console.log(`Updated file: ${file.getFilePath()}`);
    file.saveSync();
    changedFiles++;
  }
}

console.log(`Updated ${changedFiles} files.`);
