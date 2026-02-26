# Guia de Build - Pacotes Linux (.deb e .appimage)

Este guia explica como gerar pacotes `.deb` e `.appimage` para distribuição Linux do Ricky Assistant.

## Fluxo Atual Recomendado (root do monorepo)

Use sempre o `pnpm --filter ricky-desktop` para garantir que os scripts rodem na ordem correta:
```bash
pnpm --filter ricky-desktop build:appimage
# ou
pnpm --filter ricky-desktop build:deb
# ou
pnpm --filter ricky-desktop build:linux
```

Esses comandos fazem:
1) `prepare-deps` (copia dependências físicas para evitar erros de módulo em AppImage)
2) `build` (electron-vite)
3) `electron-builder`

## Pré-requisitos

1. **Instalar dependências:**
```bash
cd apps/desktop
pnpm install
# ou
npm install
```

2. **Dependências do sistema (para gerar .deb):**
```bash
# Ubuntu/Debian
sudo apt-get install -y fakeroot dpkg-dev

# Fedora
sudo dnf install fakeroot dpkg-dev
```

## Como Gerar os Pacotes

### Opção 1: Gerar ambos (.deb e .appimage)
```bash
npm run build:linux
```

### Opção 2: Gerar apenas .deb
```bash
npm run build:deb
```

### Opção 3: Gerar apenas .appimage
```bash
npm run build:appimage
```

### Opção 4: Build completo (recomendado)
```bash
npm run build:app
```

## Por que existe o prepare-deps

O monorepo usa pnpm, que cria muitos symlinks. O AppImage precisa de arquivos físicos (não symlinks) para resolver módulos como:
`pino-std-serializers`, `conf`, `ajv`, `debug`, etc.

O script `apps/desktop/scripts/prepare-deps.js`:
- copia dependências do `node_modules/.pnpm` para `apps/desktop/node_modules`
- garante que pacotes com escopo (`@xyflow/react`, `@types/*`) sejam copiados corretamente
- evita bugs de AppImage com “Cannot find module ...”

## Scripts Importantes (não remover)

- `apps/desktop/scripts/prepare-deps.js`: copia dependências físicas antes do build
- `apps/desktop/scripts/patch-xyflow-exports.js`: adiciona `./jsx-runtime` em `@xyflow/react`
- `apps/desktop/scripts/repair-react-deps.js`: corrige pacotes trocados dentro de `apps/desktop/node_modules`

O `prebuild` já chama:
```
node scripts/repair-react-deps.js && node scripts/patch-xyflow-exports.js
```

## Localização dos Arquivos Gerados

Os pacotes serão gerados no diretório:
```
apps/desktop/dist-release/
```

Você encontrará:
- `Ricky Assistant-0.0.1-x86_64.AppImage` (AppImage)
- `ricky-desktop_0.0.1_amd64.deb` (pacote Debian)

## Instalação dos Pacotes

### Instalar .deb
```bash
sudo dpkg -i dist-release/ricky-desktop_0.0.1_amd64.deb
# Se houver dependências faltando:
sudo apt-get install -f
```

### Usar .appimage
```bash
# Tornar executável
chmod +x "dist-release/Ricky Assistant-0.0.1-x86_64.AppImage"

# Executar
./dist-release/Ricky\ Assistant-0.0.1-x86_64.AppImage
```

## Configuração Avançada

### Nome do AppImage

O nome do arquivo é configurado em `apps/desktop/electron-builder.yml`:
```yaml
appImage:
  artifactName: ${productName}-${version}-${arch}-v107.${ext}
```

### Adicionar Ícone

1. Crie um diretório `assets` em `apps/desktop/`:
```bash
mkdir -p apps/desktop/assets
```

2. Adicione um ícone PNG (recomendado: 512x512px) como `icon.png`

3. Descomente a linha no `electron-builder.yml`:
```yaml
icon: assets/icon.png
```

### Personalizar Metadados

Edite o arquivo `electron-builder.yml` para personalizar:
- `productName`: Nome do produto
- `appId`: ID único da aplicação
- `description`: Descrição do pacote
- `maintainer`: Mantenedor do pacote
- Dependências do sistema no campo `deb.depends`

### Dependências do Sistema

O arquivo `electron-builder.yml` já inclui as dependências básicas necessárias:
- `libnss3`, `libatk-bridge2.0-0`, `libdrm2`
- `libxkbcommon0`, `libxss1`, `libasound2`
- `libatspi2.0-0`, `libgtk-3-0`, `libgbm1`

Se sua aplicação precisar de dependências adicionais, adicione-as em `deb.depends`.

## Troubleshooting

### Build fica “travado” em prepare-deps
Por padrão a sincronização de dependências do workspace está desativada (mais rápido).
Se necessário, force o comportamento antigo:
```bash
SYNC_WORKSPACE_DEPS=true pnpm --filter ricky-desktop build:appimage
```

### Erros de módulos faltando no AppImage
Exemplos:
- `Cannot find module 'pino-std-serializers'`
- `Cannot find module 'conf'`
- `Cannot find module 'ajv/dist/compile/codegen'`
- `Cannot find module 'debug'`

Solução:
```bash
pnpm --filter ricky-desktop build:appimage
```
Esse comando já roda `prepare-deps` antes do build.

### Erro: Missing "./jsx-runtime" specifier in "@xyflow/react"
O `prebuild` aplica o patch automaticamente. Se ainda aparecer:
```bash
cd apps/desktop
node scripts/repair-react-deps.js
node scripts/patch-xyflow-exports.js
npm run build
```

### Erro: Failed to resolve entry for package "d3-drag" / "d3-dispatch"
Indica pacote copiado com nome incorreto dentro de `apps/desktop/node_modules`.
Rode novamente o `prepare-deps` (ele corrige os nomes):
```bash
cd apps/desktop
npm run prepare-deps
```

### Erro: "electron-builder not found"
```bash
cd apps/desktop
pnpm install
```

### Erro ao gerar .deb: "fakeroot not found"
```bash
sudo apt-get install fakeroot dpkg-dev
```

### Build falha com módulos nativos
Certifique-se de executar o rebuild antes:
```bash
npm run rebuild:electron
npm run build:app
```

### AppImage não executa
Verifique as permissões:
```bash
chmod +x "dist-release/Ricky Assistant-0.0.1-x86_64.AppImage"
```

### Erro do sharp/libvips no AppImage
O `electron-builder.yml` já força `asarUnpack` para `sharp`:
```yaml
asarUnpack:
  - node_modules/sharp/**
  - node_modules/@img/**
```
Se o erro persistir, refaça o build e garanta que o `prepare-deps` copiou os pacotes `@img/*`.

## Notas Importantes

1. **Primeira execução**: O electron-builder pode baixar ferramentas adicionais na primeira execução (pode demorar alguns minutos).

2. **Tamanho dos pacotes**: Os pacotes podem ser grandes (100-200MB) devido às dependências do Electron e módulos nativos.

3. **Arquitetura**: Por padrão, os pacotes são gerados para a arquitetura do sistema atual. Para gerar para outras arquiteturas, use flags do electron-builder.

4. **Teste local**: Sempre teste os pacotes gerados antes de distribuir:
   - Instale o .deb em uma máquina limpa ou VM
   - Execute o AppImage em um sistema diferente
