# Iron-Gym

Monorepo pnpm de IronLog:

- `apps/ironlog`: app mobile Expo SDK 54 + React Native + expo-router.
- `packages/db`: persistencia local SQLite/Drizzle usada por la app.

## Requisitos

- Node.js 24
- pnpm
- Xcode + Simulator para correr la app en iOS

```bash
pnpm install
```

## Ejecutar la app mobile

```bash
cd apps/ironlog
pnpm run dev:ios
```

También están disponibles `pnpm run dev`, `pnpm run dev:tunnel` y los comandos
`ios`/`android` para builds nativos.

## Comandos del monorepo

Desde la raíz:

```bash
pnpm run typecheck
pnpm run build
```

Por paquete:

```bash
pnpm --filter @workspace/ironlog run typecheck
pnpm --filter @workspace/ironlog run test
```
