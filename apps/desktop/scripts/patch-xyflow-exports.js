#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, '..', '..');
const workspaceNodeModules = path.join(workspaceRoot, 'node_modules');
const pnpmStore = path.join(workspaceNodeModules, '.pnpm');

const runtimeStub = `module.exports = require('react/jsx-runtime');\n`;
const devRuntimeStub = `module.exports = require('react/jsx-dev-runtime');\n`;

function ensureFile(filePath, contents) {
  if (!fs.existsSync(filePath) || fs.readFileSync(filePath, 'utf8') !== contents) {
    fs.writeFileSync(filePath, contents);
  }
}

function patchPackage(pkgRoot) {
  const pkgJsonPath = path.join(pkgRoot, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    return false;
  }

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const exportsField = pkgJson.exports && typeof pkgJson.exports === 'object' ? pkgJson.exports : {};

  let changed = false;
  if (exportsField['./jsx-runtime'] !== './jsx-runtime.js') {
    exportsField['./jsx-runtime'] = './jsx-runtime.js';
    changed = true;
  }
  if (exportsField['./jsx-dev-runtime'] !== './jsx-dev-runtime.js') {
    exportsField['./jsx-dev-runtime'] = './jsx-dev-runtime.js';
    changed = true;
  }

  if (changed || pkgJson.exports !== exportsField) {
    pkgJson.exports = exportsField;
    fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
  }

  ensureFile(path.join(pkgRoot, 'jsx-runtime.js'), runtimeStub);
  ensureFile(path.join(pkgRoot, 'jsx-dev-runtime.js'), devRuntimeStub);

  return true;
}

const candidateRoots = new Set();

try {
  const resolvedPkg = require.resolve('@xyflow/react/package.json', { paths: [appRoot] });
  const resolvedRoot = path.dirname(resolvedPkg);
  candidateRoots.add(resolvedRoot);
  candidateRoots.add(fs.realpathSync(resolvedRoot));
} catch (error) {
  // Ignorar se o pacote não estiver instalado ainda
}

if (fs.existsSync(pnpmStore)) {
  fs.readdirSync(pnpmStore).forEach(entry => {
    if (!entry.startsWith('@xyflow+react@')) {
      return;
    }
    const candidate = path.join(pnpmStore, entry, 'node_modules/@xyflow/react');
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      candidateRoots.add(candidate);
    }
  });
}

let patched = 0;
candidateRoots.forEach(root => {
  if (patchPackage(root)) {
    patched += 1;
  }
});

if (patched === 0) {
  console.warn('patch-xyflow-exports: @xyflow/react not found, skipping');
  process.exit(0);
}

console.log('patch-xyflow-exports: ensured jsx-runtime exports');
