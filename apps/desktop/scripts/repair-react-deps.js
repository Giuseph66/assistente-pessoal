#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, '..', '..');
const pnpmStore = path.join(workspaceRoot, 'node_modules', '.pnpm');

const targets = [
  path.join(appRoot, 'node_modules')
];

function readPackageJson(pkgPath) {
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (error) {
    return null;
  }
}

function copyRecursive(src, dest) {
  if (src === dest) {
    return;
  }
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else if (exists) {
    fs.copyFileSync(src, dest);
  }
}

function findInPnpmStore(packageName) {
  if (!fs.existsSync(pnpmStore)) {
    return null;
  }
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedName.replace('/', '\\+')}@`);
  const entries = fs.readdirSync(pnpmStore);
  const match = entries.find(entry => pattern.test(entry));
  if (!match) {
    return null;
  }
  return path.join(pnpmStore, match, 'node_modules', packageName);
}

function isExpectedPackage(pkgRoot, expectedName) {
  const pkgJson = readPackageJson(path.join(pkgRoot, 'package.json'));
  return pkgJson && pkgJson.name === expectedName;
}

function listPackages(nodeModulesRoot) {
  if (!fs.existsSync(nodeModulesRoot)) {
    return [];
  }
  const packages = [];
  fs.readdirSync(nodeModulesRoot).forEach(entry => {
    if (entry.startsWith('.') || entry === '.bin') {
      return;
    }
    const entryPath = path.join(nodeModulesRoot, entry);
    if (entry.startsWith('@')) {
      if (!fs.existsSync(entryPath)) {
        return;
      }
      fs.readdirSync(entryPath).forEach(scopedName => {
        const pkgPath = path.join(entryPath, scopedName);
        const expectedName = `${entry}/${scopedName}`;
        packages.push({ expectedName, pkgPath });
      });
      return;
    }
    packages.push({ expectedName: entry, pkgPath: entryPath });
  });
  return packages;
}

function repairPackage(expectedName, targetPath) {
  if (!fs.existsSync(targetPath)) {
    return;
  }
  const pkgJson = readPackageJson(path.join(targetPath, 'package.json'));
  if (!pkgJson) {
    return;
  }
  if (pkgJson.name === expectedName) {
    return;
  }
  const sourcePath = findInPnpmStore(expectedName);
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    if (pkgJson.name.startsWith('@') && !expectedName.startsWith('@')) {
      fs.rmSync(targetPath, { recursive: true, force: true });
      return;
    }
    console.warn(`repair-react-deps: fonte não encontrada para ${expectedName}`);
    return;
  }
  fs.rmSync(targetPath, { recursive: true, force: true });
  copyRecursive(sourcePath, targetPath);
}

targets.forEach(targetRoot => {
  if (!fs.existsSync(targetRoot)) {
    return;
  }
  listPackages(targetRoot).forEach(pkg => {
    repairPackage(pkg.expectedName, pkg.pkgPath);
  });
});

console.log('repair-react-deps: dependências verificadas');
