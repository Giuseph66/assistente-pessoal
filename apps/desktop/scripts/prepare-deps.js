#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Dependências que precisam ser copiadas fisicamente (não como symlinks)
const depsToCopy = [
  'pino-std-serializers',
  'pino',
  'pino-pretty',
  'pino-roll'
];

const desktopNodeModules = path.join(__dirname, '../node_modules');
const rootNodeModules = path.join(__dirname, '../../../node_modules');
const pnpmStore = path.join(rootNodeModules, '.pnpm');
const workspacePackages = [
  {
    name: '@neo/logger',
    root: path.join(__dirname, '../../../packages/logger'),
    nodeModules: path.join(__dirname, '../../../packages/logger/node_modules')
  },
  {
    name: '@neo/config',
    root: path.join(__dirname, '../../../packages/config'),
    nodeModules: path.join(__dirname, '../../../packages/config/node_modules')
  },
  {
    name: '@neo/shared',
    root: path.join(__dirname, '../../../packages/shared'),
    nodeModules: path.join(__dirname, '../../../packages/shared/node_modules')
  }
];
const workspacePackageNames = new Set(workspacePackages.map(pkg => pkg.name));
const workspacePackageRoots = new Map(
  workspacePackages.map(pkg => [pkg.name, pkg.root])
);
const desktopPackageJsonPath = path.join(__dirname, '../package.json');

function copyRecursive(src, dest, options = {}) {
  const { skipNodeModules = false } = options;
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
      if (skipNodeModules && childItemName === 'node_modules') {
        return;
      }
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName),
        options
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function findInPnpmStore(packageName) {
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedName.replace('/', '\\+')}@`);
  const entries = fs.readdirSync(pnpmStore);
  const match = entries.find(entry => pattern.test(entry));
  if (match) {
    return path.join(pnpmStore, match, 'node_modules', packageName);
  }
  return null;
}

function findInstalledPackage(packageName) {
  for (const pkg of workspacePackages) {
    const candidate = path.join(pkg.nodeModules, packageName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  const rootCandidate = path.join(rootNodeModules, packageName);
  if (fs.existsSync(rootCandidate)) {
    return rootCandidate;
  }
  return null;
}

function findPackageSource(packageName) {
  if (workspacePackageNames.has(packageName)) {
    const workspaceRoot = workspacePackageRoots.get(packageName);
    if (workspaceRoot && fs.existsSync(workspaceRoot)) {
      return workspaceRoot;
    }
    return findInstalledPackage(packageName) || findInPnpmStore(packageName);
  }
  return findInPnpmStore(packageName) || findInstalledPackage(packageName);
}

function isPackageMatch(sourcePath, expectedName) {
  const pkgJson = readPackageJson(path.join(sourcePath, 'package.json'));
  return pkgJson && pkgJson.name === expectedName;
}

function resolvePackageSource(packageName, preferredSource) {
  const candidates = [];
  if (preferredSource) {
    candidates.push(preferredSource);
  }
  if (workspacePackageNames.has(packageName)) {
    const workspaceRoot = workspacePackageRoots.get(packageName);
    if (workspaceRoot) {
      candidates.push(workspaceRoot);
    }
  }
  const storeCandidate = findInPnpmStore(packageName);
  if (storeCandidate) {
    candidates.push(storeCandidate);
  }
  const installedCandidate = findInstalledPackage(packageName);
  if (installedCandidate) {
    candidates.push(installedCandidate);
  }
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate) && isPackageMatch(candidate, packageName)) {
      return candidate;
    }
  }
  return null;
}

function isStorePath(packagePath) {
  return packagePath.includes(`${path.sep}node_modules${path.sep}.pnpm${path.sep}`);
}

function collectStoreDependencies(sourcePath, packageName) {
  const deps = [];
  if (!sourcePath || !isStorePath(sourcePath)) {
    return deps;
  }
  const parentDepth = packageName.startsWith('@') ? 2 : 1;
  let storeNodeModules = sourcePath;
  for (let i = 0; i < parentDepth; i += 1) {
    storeNodeModules = path.dirname(storeNodeModules);
  }
  if (!fs.existsSync(storeNodeModules)) {
    return deps;
  }
  fs.readdirSync(storeNodeModules).forEach(entry => {
    if (entry === '.bin') {
      return;
    }
    const entryPath = path.join(storeNodeModules, entry);
    if (!fs.existsSync(entryPath)) {
      return;
    }
    if (entry.startsWith('@')) {
      fs.readdirSync(entryPath).forEach(scopedName => {
        const scopedPath = path.join(entryPath, scopedName);
        const fullName = `${entry}/${scopedName}`;
        if (fullName === packageName || !fs.existsSync(scopedPath)) {
          return;
        }
        deps.push({ name: fullName, sourcePath: fs.realpathSync(scopedPath) });
      });
      return;
    }
    if (entry === packageName) {
      return;
    }
    deps.push({ name: entry, sourcePath: fs.realpathSync(entryPath) });
  });
  return deps;
}

function readPackageJson(pkgPath) {
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch (error) {
    console.warn(`Falha ao ler package.json: ${pkgPath}`);
    return null;
  }
}

function readWorkspaceDependencies() {
  const deps = [];
  workspacePackages.forEach(pkg => {
    const pkgJsonPath = path.join(pkg.root, 'package.json');
    const pkgJson = readPackageJson(pkgJsonPath);
    if (pkgJson) {
      deps.push(...collectDependencies(pkgJson));
    }
  });
  return deps;
}

function readDesktopDependencies() {
  const pkgJson = readPackageJson(desktopPackageJsonPath);
  if (!pkgJson) {
    return [];
  }
  return collectDependencies(pkgJson);
}

function collectDependencies(pkgJson) {
  const deps = Object.keys(pkgJson.dependencies || {});
  const optionalDeps = Object.keys(pkgJson.optionalDependencies || {});
  const peerDeps = Object.keys(pkgJson.peerDependencies || {});
  return Array.from(new Set([...deps, ...optionalDeps, ...peerDeps]));
}

console.log('Preparando dependências para electron-builder...');

if (!fs.existsSync(pnpmStore)) {
  console.error(`Pnpm store não encontrado: ${pnpmStore}`);
  process.exit(1);
}

const queue = [...depsToCopy];
const processed = new Set();
const copiedDeps = [];
const preferredSources = new Map();
const workspaceDeps = readWorkspaceDependencies();
const desktopDeps = readDesktopDependencies();
workspaceDeps.forEach(dep => queue.push(dep));
desktopDeps.forEach(dep => queue.push(dep));

while (queue.length > 0) {
  const dep = queue.shift();
  if (!dep || processed.has(dep)) {
    continue;
  }
  processed.add(dep);

  const targetPath = path.join(desktopNodeModules, dep);
  const preferredSource = preferredSources.get(dep);
  const sourcePath = resolvePackageSource(dep, preferredSource);

  if (sourcePath && fs.existsSync(sourcePath)) {
    // Se já existe como symlink ou diretório, remover primeiro
    if (fs.existsSync(targetPath)) {
      const stats = fs.lstatSync(targetPath);
      if (stats.isSymbolicLink()) {
        fs.unlinkSync(targetPath);
      } else if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      }
    }

    console.log(`Copiando ${dep}...`);
    const skipNodeModules = workspacePackageNames.has(dep);
    copyRecursive(sourcePath, targetPath, { skipNodeModules });
    copiedDeps.push(dep);

    const pkgJson = readPackageJson(path.join(sourcePath, 'package.json'));
    if (pkgJson) {
      const deps = collectDependencies(pkgJson);
      deps.forEach(nextDep => {
        if (!processed.has(nextDep)) {
          queue.push(nextDep);
        }
      });
    }
    const storeDeps = collectStoreDependencies(sourcePath, dep);
    storeDeps.forEach(({ name, sourcePath: depSource }) => {
      if (!preferredSources.has(name)) {
        preferredSources.set(name, depSource);
      }
      if (!processed.has(name)) {
        queue.push(name);
      }
    });
  } else {
    console.warn(`Não encontrado: ${dep}`);
  }
}

function syncDepsToWorkspace() {
  const deps = Array.from(new Set([...processed, ...depsToCopy, ...copiedDeps]));
  workspacePackages.forEach(pkg => {
    if (!fs.existsSync(pkg.nodeModules)) {
      fs.mkdirSync(pkg.nodeModules, { recursive: true });
    }
    console.log(`Sincronizando dependências para ${pkg.name}...`);
    deps.forEach(dep => {
      const targetPath = path.join(pkg.nodeModules, dep);
      const preferredSource = preferredSources.get(dep);
      const sourcePath = resolvePackageSource(dep, preferredSource);
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return;
      }
      if (path.resolve(sourcePath) === path.resolve(targetPath)) {
        return;
      }
      if (fs.existsSync(targetPath)) {
        const stats = fs.lstatSync(targetPath);
        if (stats.isSymbolicLink()) {
          fs.unlinkSync(targetPath);
        } else if (stats.isDirectory()) {
          fs.rmSync(targetPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(targetPath);
        }
      }
      copyRecursive(sourcePath, targetPath);
    });
  });
}

if (process.env.SYNC_WORKSPACE_DEPS === 'true') {
  syncDepsToWorkspace();
} else {
  console.log('Sincronização de dependências de workspace ignorada (SYNC_WORKSPACE_DEPS=false).');
}
console.log('Dependências preparadas!');
