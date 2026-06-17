# JavaScript / TypeScript Detection Reference

Load this reference when the project has a `package.json` file.

## Manifest Files

| File | What to extract |
|------|----------------|
| `package.json` | Framework (dependencies/devDependencies), scripts, package manager (infer from lockfile) |
| `tsconfig.json` / `jsconfig.json` | Language settings, path aliases, module system, strict mode |
| Build config (`vite.config.*`, `next.config.*`, `webpack.config.*`, `rollup.config.*`) | Build tooling, plugins, environment setup |
| Lint/format config (`.eslintrc*`, `biome.json`, `.prettierrc*`) | Linting and formatting conventions |
| Entry points (`src/index.*`, `src/main.*`, `src/app.*`, `app/page.*`, `app/layout.*`) | App structure, routing patterns |
| Test files (`*.test.*`, `*.spec.*`, `__tests__/`) | Testing framework, test patterns, coverage config |
| `Dockerfile` / `docker-compose.yml` | Deployment patterns |

## Package Manager Detection

| Lockfile present | Package manager |
|-----------------|----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` / `bun.lock` | bun |
| `package-lock.json` | npm |

## Framework Detection Signatures

| Dependency | Framework |
|-----------|-----------|
| `react` + `next` | Next.js (check `app/` dir for App Router vs `pages/` for Pages Router) |
| `react` (no next) | React SPA (check for vite / CRA / remix) |
| `vue` | Vue.js (check for `nuxt` dependency) |
| `svelte` + `@sveltejs/kit` | SvelteKit |
| `svelte` (no kit) | Svelte SPA |
| `@angular/core` | Angular |
| `express` / `fastify` / `hono` / `koa` | Node.js backend |
| `@nestjs/core` | NestJS |
| `electron` | Electron desktop app |
| `react-native` | React Native mobile app |

## Detection Dimensions

Identify these aspects of the project:

- **Tech stack**: framework, language (TS or JS), Node version (from `.nvmrc` / `engines`), package manager
- **State management**: zustand / redux (@reduxjs/toolkit) / pinia / mobx / jotai / valtio / React context
- **Testing**: vitest / jest / @testing-library/* / playwright / cypress, test file naming pattern
- **API style**: RESTful / GraphQL (apollo/urql) / tRPC, route conventions
- **Code organization**: feature-based modules / layered architecture / barrel exports (`index.ts` re-exports), `src/` vs `app/` structure
- **Styling**: Tailwind CSS / CSS Modules / styled-components / emotion / SCSS / vanilla-extract
- **Error handling**: error boundary patterns, try-catch conventions, global error handlers
- **Import/export**: ESM / CJS, path alias usage (`@/` or `~/` prefix), barrel files

## Example Output

> - 语言/框架: TypeScript + React 18 + Next.js 14 (App Router)
> - 包管理: pnpm
> - 状态管理: zustand, store 文件在 src/stores/
> - 测试: vitest + @testing-library/react, 测试文件与源码同目录
> - 样式: Tailwind CSS v3
> - API: RESTful, route handlers 在 app/api/ 下
> - 代码组织: 按功能模块划分 (src/features/)
> - 代码质量: ESLint + Prettier, 路径别名 @/ -> src/
