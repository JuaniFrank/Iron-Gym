# Iron-Gym

pnpm monorepo con dos artefactos principales:

- `artifacts/ironlog` — app mobile (Expo SDK 54 + React Native + expo-router).
- `artifacts/api-server` — backend Express 5 (TypeScript, esbuild, pino).

---

## Requisitos

- **Node.js 24** (ver `replit.md`)
- **pnpm** (el `preinstall` rechaza `npm`/`yarn`)
- **Xcode + Simulator** para correr la app en iOS
- En el primer arranque, el CLI de Expo descarga e instala automáticamente **Expo Go 54.0.6** en el simulador (no sirve una versión vieja como 2.30.x).

```bash
pnpm install
```

---

## Ejecutar la app mobile (iOS Simulator)

1. Abrí el simulador y booteá un device (ej. iPhone Xs):

   ```bash
   xcrun simctl list devices booted
   # si no hay ninguno booteado:
   open -a Simulator
   xcrun simctl boot "iPhone Xs"
   ```

2. Levantá Expo desde el paquete:

   ```bash
   cd artifacts/ironlog
   pnpm exec expo start --ios
   ```

   - Si Expo Go en el simulador es viejo, el CLI te pregunta si querés instalar la versión correcta — respondé **y**.
   - Para correrlo sin TTY (scripts/CI local) y aceptar la instalación automáticamente:

     ```bash
     script -q /dev/null bash -c 'yes | pnpm exec expo start --ios'
     ```

3. Comandos útiles dentro del prompt de Metro:
   - `r` — reload
   - `i` — re-abrir en iOS
   - `j` — debugger
   - `shift+m` — más herramientas

### Si Metro ya está corriendo y solo querés abrir la app

```bash
xcrun simctl openurl booted "exp://127.0.0.1:8081"
```

### Cerrar Metro

```bash
pkill -f "expo start"
```

> Nota: el script `dev` de `package.json` (`pnpm --filter @workspace/ironlog run dev`) está configurado para **Replit** (usa `EXPO_PACKAGER_PROXY_URL`, `REPLIT_DEV_DOMAIN`, etc.). Localmente usá `pnpm exec expo start --ios` directo.

---

## Ejecutar el backend (api-server)

Express 5 con un único endpoint hoy: `GET /api/health`. La app mobile **no** lo necesita por ahora (no hace llamadas HTTP), así que solo corrélo si vas a desarrollar contra él.

```bash
cd artifacts/api-server
PORT=3000 pnpm run dev
```

`dev` hace `build` (esbuild → `dist/index.mjs`) y luego `start`. Para iterar más rápido:

```bash
PORT=3000 pnpm run build      # bundle
PORT=3000 pnpm run start      # corre el bundle ya compilado
```

Verificación rápida:

```bash
curl http://localhost:3000/api/health
```

### Apuntar la app mobile al backend local

Cuando agregues llamadas HTTP, exponé la URL vía variable de entorno con prefijo `EXPO_PUBLIC_` (Expo solo inyecta esas en runtime). Como el simulador iOS comparte loopback con el host, `localhost` funciona:

```bash
cd artifacts/ironlog
EXPO_PUBLIC_API_URL=http://localhost:3000 pnpm exec expo start --ios
```

Para un device físico cambialo por la IP LAN de tu Mac (la que imprime Metro al arrancar, ej. `http://192.168.10.190:3000`).

---

## Comandos a nivel monorepo

Desde la raíz:

```bash
pnpm run typecheck     # tsc --build de todas las libs + paquetes
pnpm run build         # typecheck + build recursivo
```

Por paquete:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/ironlog   run typecheck
```
