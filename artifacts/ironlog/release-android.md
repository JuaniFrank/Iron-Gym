# IronLog — Release a Google Play Store (Android)

> Guía paso a paso, checklist accionable y referencia operativa para publicar
> IronLog en Play Store. Pensada para seguirla cuando arranques el proceso —
> incluye las trampas que sorprenden a developers que nunca lanzaron.

---

## Índice

1. [TL;DR](#1-tldr)
2. [Costos y timeline real](#2-costos-y-timeline-real)
3. [Pre-requisitos](#3-pre-requisitos)
4. [Cuenta de Google Play Console](#4-cuenta-de-google-play-console)
5. [Configuración del proyecto Expo](#5-configuración-del-proyecto-expo)
6. [Assets requeridos](#6-assets-requeridos)
7. [Build con EAS](#7-build-con-eas)
8. [App signing](#8-app-signing)
9. [Crear la app en Play Console](#9-crear-la-app-en-play-console)
10. [Store listing](#10-store-listing)
11. [Cuestionarios obligatorios](#11-cuestionarios-obligatorios)
12. [Privacy policy y compliance](#12-privacy-policy-y-compliance)
13. [Testing tracks y la regla 20/14](#13-testing-tracks-y-la-regla-2014)
14. [Permisos sensibles](#14-permisos-sensibles)
15. [Submit a producción](#15-submit-a-producción)
16. [Post-launch](#16-post-launch)
17. [Updates posteriores](#17-updates-posteriores)
18. [Razones comunes de rejection](#18-razones-comunes-de-rejection)
19. [Checklist final accionable](#19-checklist-final-accionable)
20. [Apéndice — Comandos y URLs útiles](#20-apéndice--comandos-y-urls-útiles)

---

## 1. TL;DR

- **Costo**: USD 25 una vez en Google + Expo EAS (gratis con limits o ~$19/mes).
- **Timeline mínimo de cero a producción**: 3–4 semanas, no por desarrollo sino por dos delays administrativos: verificación de identidad (24h–7d) y closed testing obligatorio de 14 días con 20+ testers.
- **Formato**: AAB (App Bundle), no APK.
- **Privacy policy obligatoria**, gratuita no es opción.
- **Background location** (running) requiere form aparte con video screencast — plan: lanzar v1 sin running primero.

---

## 2. Costos y timeline real

### Costos

| Item | Costo |
|---|---|
| Google Play Console (cuenta developer) | USD 25 una vez |
| Expo EAS Build | gratis con cuotas / USD 19/mes Production / USD 99/mes Enterprise |
| Privacy policy hosting | gratis (GitHub Pages, Notion público, sitio estático) |
| Assets (íconos, screenshots) | si los hacés vos: cero |
| Apple Developer Program | USD 99/año — **no aplica para Android**, pero sí cuando sumes iOS |

### Timeline desde cero

| Día | Hito |
|---|---|
| 0 | Crear cuenta Play Console + arrancar verificación de identidad |
| 1–7 | (En paralelo) verificación corre; vos preparás assets, privacy policy, builds |
| 5–7 | Verificación aprobada |
| 8 | Subir build a internal testing |
| 9 | Arrancar closed testing con 20+ testers — empieza el contador 14 días |
| 23 | Aplicar para production access (botón aparece después de 14 días) |
| 24 | Submit a producción |
| 27–31 | Review de Google (3–7 días primera vez) |
| 32 | App live en Play Store |

**Plan defensivo**: el counter de 14 días arrancalo lo antes posible, mientras seguís puliendo. Los testers pueden seguir testeando builds nuevos durante esos 14 días.

---

## 3. Pre-requisitos

Antes de empezar:

- [ ] Tarjeta de crédito/débito internacional para los USD 25.
- [ ] Cuenta de Google personal (Gmail) que vas a asociar a Play Console.
- [ ] Documento oficial (DNI o pasaporte) con foto frontal nítida.
- [ ] Webcam/cámara para selfie de verificación.
- [ ] Dirección verificable (a veces piden factura de servicios).
- [ ] Datos fiscales del país (CUIT/CUIL si Argentina).
- [ ] Cuenta bancaria (si vas a cobrar; para app free podés saltearlo).
- [ ] Decidir el **package name permanente** de la app — `com.tudominio.ironlog` (no se puede cambiar nunca después).
- [ ] Definir si registrás como **Personal** u **Organization** (ver §4.1).

---

## 4. Cuenta de Google Play Console

### 4.1 Personal vs Organization

Decisión crítica antes de pagar los USD 25.

| Tipo | Verificación | Implicancias |
|---|---|---|
| **Personal** | DNI/pasaporte + selfie + dirección | Sujeto a regla "20 testers / 14 días" antes de producción. Tu nombre real aparece visible en la ficha de la app. |
| **Organization** | D-U-N-S Number + verificación de empresa registrada | Sin regla de testing 20/14. Pero D-U-N-S tarda 1–4 semanas y necesitás empresa registrada con CUIT. |

**Recomendación si sos solo**: registrate como **Personal**. Asumí los 14 días extra. Si te molesta el nombre real público, después podés migrar a Organization (es trámite, no instantáneo).

### 4.2 Crear la cuenta

1. Ir a `https://play.google.com/console/signup`.
2. Loguear con la cuenta de Google que vas a usar permanentemente — esta cuenta es la dueña de tus apps. Si la perdés, perdés acceso a todo.
3. Aceptar el Developer Distribution Agreement.
4. Pagar los USD 25 (one-time).
5. Empezar la verificación de identidad: subir documento, hacer selfie, ingresar dirección.
6. Esperar — Google manda un mail cuando aprueba (24h a 7 días).

> **Hasta que la verificación esté aprobada no podés publicar nada.** Pero sí podés crear apps, llenar fichas, subir builds a internal testing.

### 4.3 Payment profile (separado)

Para recibir plata (apps pagas o IAP):

1. `https://pay.google.com` → "Settings".
2. Crear merchant profile.
3. Datos fiscales completos.
4. Vincular cuenta bancaria.
5. Tax forms del país.
6. En Play Console → Setup → Payments profile → linkearlo.

Si lanzás free al principio, podés saltearlo y configurarlo cuando vayas a cobrar.

---

## 5. Configuración del proyecto Expo

Editar `artifacts/ironlog/app.json`. Lo que importa para Android:

```json
{
  "expo": {
    "name": "IronLog",
    "slug": "ironlog",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "android": {
      "package": "com.tudominio.ironlog",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F0F0E"
      },
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION"
      ]
    },
    "plugins": [
      "expo-router",
      "expo-font"
    ]
  }
}
```

### 5.1 Reglas críticas que duelen si las descuidás

- **`package`** debe ser **único globalmente y permanente**. Una vez subido a Play Store nunca se puede cambiar. Convención: `com.tudominio.ironlog`. Si no tenés dominio, `com.tunombre.ironlog` está bien.
- **`versionCode`** es entero. **Debe incrementar en cada submit a Play Store**. Si subís dos builds con el mismo `versionCode`, Google rechaza el segundo.
- **`version`** es semver visible al usuario, puede repetirse, no afecta a Google.
- **Adaptive icon** obligatorio para Android moderno (foreground separado del fondo).
- **Target SDK**: Expo SDK 54 te da SDK 35 por default. Google exige **mínimo SDK 34** para apps nuevas y **SDK 35** desde mediados 2025. Con Expo SDK 54+ estás cubierto.

### 5.2 Permisos por fase

**v1 sin running** — permisos mínimos:

```json
"permissions": [
  "CAMERA",
  "READ_EXTERNAL_STORAGE",
  "WRITE_EXTERNAL_STORAGE"
]
```

**v2 con running** — sumar:

```json
"permissions": [
  "ACCESS_FINE_LOCATION",
  "ACCESS_COARSE_LOCATION",
  "ACCESS_BACKGROUND_LOCATION",
  "ACTIVITY_RECOGNITION",
  "FOREGROUND_SERVICE",
  "FOREGROUND_SERVICE_LOCATION"
]
```

Cada permiso "sensible" agregado activa una declaración aparte en Play Console (ver §14).

---

## 6. Assets requeridos

| Asset | Resolución | Formato | Dónde |
|---|---|---|---|
| App icon | 512×512 | PNG (sin alpha en bordes) | `assets/icon.png` |
| Adaptive icon foreground | 432×432 | PNG transparente | `assets/adaptive-icon.png` |
| Splash screen | 1242×2436 | PNG | `assets/splash.png` |
| Play Store icon | 512×512 | PNG 32-bit | sube en consola |
| **Feature graphic** | 1024×500 | JPG/PNG 24-bit, sin alpha | sube en consola |
| **Screenshots phone** | min 320px, max 3840px lado largo, ratio entre 16:9 y 9:16 | JPG/PNG | min 2, max 8 |
| Screenshots tablet 7" | opcional | JPG/PNG | — |
| Screenshots tablet 10" | opcional | JPG/PNG | — |
| Promo video | YouTube link | público o unlisted | opcional pero suma 20–30% conversión |

### 6.1 Tips para screenshots

- Capturarlas con simulator/device en orientación portrait a 1080×1920 o 1080×2400.
- Mostrar las 3 features más vendedoras: tu home con stats, un workout activo, una pantalla de progreso.
- No abusar de mockups con frames de teléfono — Google permite pero pierde autenticidad.
- Texto overlay opcional: máximo una frase corta por shot.

### 6.2 Feature graphic

Banner que aparece arriba en Play Store. **No incluyas el ícono de la app ahí** (lo hace Google automáticamente). Texto opcional: tagline + branding. Ejemplo: "IronLog — entrená inteligente" sobre fondo charcoal con accent lime.

---

## 7. Build con EAS

### 7.1 Setup inicial (una vez)

```bash
cd artifacts/ironlog
pnpm dlx eas-cli login
pnpm dlx eas-cli build:configure
```

Esto crea `eas.json` en la raíz del proyecto. Configuración recomendada:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-play-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 7.2 Tipos de build

| Profile | Output | Uso |
|---|---|---|
| `development` | APK con dev client | Para testing con hot reload en dispositivo físico. |
| `preview` | APK | Compartir directo con testers fuera de Play Store (Google Drive, link directo). |
| `production` | AAB | El bundle final para subir a Play Store. **Único formato aceptado para producción.** |

### 7.3 Primer build de producción

```bash
eas build --platform android --profile production
```

- Tarda 10–25 minutos (corre en cloud de Expo).
- Te da una URL para descargar el AAB cuando termina.
- También aparece en `https://expo.dev/accounts/<tu-cuenta>/projects/ironlog/builds`.

### 7.4 Build local (alternativa sin EAS cloud)

Si querés ahorrar la cuota de EAS o tenés Android Studio:

```bash
eas build --platform android --profile production --local
```

Requisitos: Android SDK + JDK 17 + Android NDK instalados. Más lío pero gratis.

---

## 8. App signing

### 8.1 Las dos opciones

| Opción | Quién guarda la signing key | Recomendación |
|---|---|---|
| **Play App Signing** | Google guarda la signing key, vos firmás con upload key | **Sí, siempre.** Si perdés la upload key, Google te ayuda a recuperarla. Default desde 2021. |
| **Self-managed** | Vos sos responsable de la keystore | Si la perdés, **nunca más podés actualizar tu app**. Tenés que publicar como nueva. No vale la pena. |

### 8.2 Cómo lo maneja EAS

Por default, EAS Build genera y administra una upload keystore en la cloud de Expo:

- La primera vez que buildeás, EAS la crea automáticamente.
- Para descargarla: `eas credentials` → seleccionar Android → "Download Keystore".
- **Backup obligatorio**: guardala en un password manager (1Password, Bitwarden) y/o en un drive cifrado. Sin ella no podés actualizar la app desde otra máquina/cuenta de EAS.

### 8.3 Habilitar Play App Signing

Cuando subas el primer AAB a Play Console, te pregunta si querés habilitar Play App Signing. **Aceptá**. Una vez habilitado:

- Google guarda la signing key (la "real").
- Vos firmás con tu upload key (la que generó EAS).
- Si perdés la upload key, podés solicitar reset a Google con el upload certificate.

> **No se puede desactivar** una vez habilitado. Es decisión final.

---

## 9. Crear la app en Play Console

1. `https://play.google.com/console` → "Create app".
2. Llenar:
   - **App name** (visible al usuario, hasta 30 caracteres).
   - **Default language**: Spanish (Latin America) o el que prefieras.
   - **App o game**: App.
   - **Free o paid**: free al principio. Si elegís paid no podés cambiar a free después.
   - **Declaraciones**: tildar "developer policies", "US export laws".
3. "Create app" → te lleva al dashboard de la app.

A partir de acá hay un **task list** lateral con los pasos pendientes. Tenés que tildarlos todos antes de poder publicar.

---

## 10. Store listing

### 10.1 App content / Main store listing

| Campo | Límite | Notas |
|---|---|---|
| App name | 30 caracteres | Pre-completado, editable. |
| Short description | 80 caracteres | Lo que aparece en search. **El más importante para conversión.** |
| Full description | 4000 caracteres | Long-form con keywords. Markdown no soportado, plain text. |
| App icon | 512×512 PNG | El mismo del bundle. |
| Feature graphic | 1024×500 | Obligatorio. |
| Phone screenshots | 2–8 | Obligatorio mínimo 2. |
| Tablet screenshots | opcional | — |
| Video | YouTube URL | Opcional. |

### 10.2 Plantilla de descriptions (IronLog v1)

**Short** (80 ch):
```
Tu tracker de gimnasio minimalista. Rutinas, PRs, progreso. Sin distracciones.
```

**Full** (4000 ch máx):
```
IronLog es un tracker de entrenamiento de gimnasio diseñado para ser
rápido, claro y sin distracciones.

CARACTERÍSTICAS

· Rutinas personalizables por día de la semana
· Tracking de sets con peso, reps y RPE
· Detección automática de PRs
· Mapa de calor de consistencia y streaks
· Tracking de macros y calorías
· Mediciones corporales y peso
· 165+ ejercicios pre-cargados
· Tema claro y oscuro
· 100% en español

PRIVACIDAD

Tus datos quedan en tu teléfono. Nada se sube a la nube. Sin cuenta requerida.
Sin tracking de tu actividad. Tu progreso es tuyo.

REQUISITOS

· Android 7.0 (Nougat) o superior
· Sin necesidad de internet — funciona 100% offline

SOPORTE

Si tenés feedback o algún bug, escribinos a soporte@ironlog.app
```

### 10.3 Categorización

- **Categoría**: Health & Fitness.
- **Tags** (hasta 5): "exercise tracker", "workout log", "strength training", "fitness journal", "gym".

### 10.4 Contact details

- Email: obligatorio, visible al usuario.
- Phone: opcional.
- Website: opcional pero suma legitimidad.
- Privacy policy URL: **obligatorio** (ver §12).

---

## 11. Cuestionarios obligatorios

Cada uno bloquea el submit hasta que esté completo. Están en Console → tu app → "App content".

### 11.1 Privacy policy

URL pública. Ver §12 para el contenido.

### 11.2 App access

¿Hay funcionalidad detrás de login? Para IronLog v1 (sin auth): "All functionality is available without special access" → next.

### 11.3 Ads

¿Tu app tiene ads? Para IronLog: **No**. Si después agregás ads, hay que actualizar.

### 11.4 Content rating

Cuestionario de ~10 minutos sobre contenido de la app:

- Violence: No.
- Sexuality: No.
- Profanity: No.
- Drugs/alcohol/tobacco: No.
- User-generated content: No.
- Gambling: No.
- Sensitive themes: No.

Resultado para IronLog: **PEGI 3 / Everyone**.

### 11.5 Target audience and content

- Target age: **18+** (más simple para IronLog — evitás reglas COPPA).
- Si elegís incluir < 13: activás "Designed for Families" con compliance estricto. **Evitalo**.

### 11.6 News app

¿Es app de noticias? No.

### 11.7 COVID-19 contact tracing

¿Es app de COVID tracing? No.

### 11.8 Data safety form (CRÍTICO)

El form más largo. Declarás campo por campo qué datos colectás, cómo los usás, si los compartís.

**Para IronLog v1 (local-only)**:

| Tipo de dato | ¿Se colecta? | ¿Se comparte? | Propósito | Obligatorio? |
|---|---|---|---|---|
| Personal info (name, email) | Sí (name solo en perfil) | No | App functionality | Optional |
| Photos & videos | Sí (progress photos) | No | App functionality | Optional |
| Health & fitness | Sí (workouts, body measurements) | No | App functionality | Optional |
| Files & docs | No | — | — | — |
| Calendar | No | — | — | — |
| Contacts | No | — | — | — |
| App activity | No (sin analytics) | — | — | — |
| Web browsing | No | — | — | — |
| App info & performance | No (sin crash analytics) | — | — | — |
| Device or other IDs | No | — | — | — |

**Si después agregás Firebase Analytics, Sentry, o RevenueCat, hay que actualizar este form.**

Para cada dato declarado tenés que indicar:
- Encryption in transit: Yes (forced HTTPS).
- User can request data deletion: Yes (botón "Reset all" en Settings).

> **Tiene que ser consistente con tu privacy policy.** Google audita random. Si declarás "no comparto data" pero metés analytics → rejection o suspensión.

### 11.9 Government apps / Financial / News

Filtros raros que no aplican. Click no en cada uno.

---

## 12. Privacy policy y compliance

### 12.1 Cómo hostearla (gratis)

Opciones:

| Plataforma | Cómo |
|---|---|
| GitHub Pages | Repo público con un `index.html` o `.md` → settings → enable Pages. URL queda como `https://tunombre.github.io/ironlog-privacy/`. |
| Notion público | Página → Share → Publish to web → copiá la URL. |
| Vercel / Netlify | Static site con un README rendereado. |
| Sitio propio | Si ya tenés un dominio. |

### 12.2 Generadores

Si no querés escribirla a mano:

- **TermsFeed** — generador gratuito, output decente.
- **FreePrivacyPolicy** — gratis con limits.
- **Iubenda** — pago pero más completo, recomendable cuando crezcas.

### 12.3 Contenido mínimo (IronLog v1 local-only)

```markdown
# Política de Privacidad de IronLog

Última actualización: [FECHA]

## Datos que colectamos

IronLog colecta y guarda los siguientes datos **únicamente en tu dispositivo**:

- Información de perfil que ingresás manualmente (nombre, edad, peso, etc.)
- Datos de entrenamiento (rutinas, sets, reps, peso levantado)
- Mediciones corporales y peso
- Fotos de progreso (si las agregás manualmente)
- Comidas y macros logueadas

## Cómo usamos tus datos

Todos los datos se procesan localmente para mostrarte estadísticas, gráficos
y tu progreso. **No enviamos ningún dato a servidores externos.**

## Permisos que solicitamos

- **Cámara y galería**: para fotos de progreso (opcional).
- **Ubicación** (cuando agreguemos running): para rastrear carreras.

## Compartir datos con terceros

No compartimos, vendemos ni transferimos tus datos a ningún tercero.

## Borrar tus datos

Podés borrar todos tus datos desde Configuración → Reset all. También podés
desinstalar la app, lo que elimina todo automáticamente.

## Cambios a esta política

Si cambiamos esta política te avisaremos en la app antes de que aplique.

## Contacto

Para preguntas: soporte@ironlog.app
```

### 12.4 Cuando IronLog crezca

Si después agregás:
- Cuenta + sync (backend) → privacy policy debe mencionar servidores, retention.
- Analytics → declarar el provider (Firebase, Mixpanel) y opt-out.
- IAP / RevenueCat → declarar processing de datos de compra.
- Auth con Google/Apple → declarar OAuth y datos recibidos.

---

## 13. Testing tracks y la regla 20/14

### 13.1 Los 4 tracks

| Track | Audiencia | Tiempo en propagar | Uso |
|---|---|---|---|
| **Internal testing** | Hasta 100 testers, lista de emails | Minutos | Builds rápidos para vos y tu equipo. |
| **Closed testing** | Lista de emails que vos definís, sin límite | Horas | Beta cerrada. **Acá corre la regla 20/14.** |
| **Open testing** | Cualquiera con el link, opt-in público | Horas | Beta abierta. |
| **Production** | Mundo, todos los users con Play Store | Horas a días | Live en Play Store. |

### 13.2 La regla 20/14

> **Para cuentas Personal creadas después de noviembre 2023**: antes de poder publicar tu primera app a producción, tenés que correr un **closed testing con al menos 20 testers durante al menos 14 días continuos**.

Cómo cumplirla paso a paso:

1. Console → tu app → Testing → **Closed testing** → "Create new release".
2. Subís el AAB.
3. Crear track de testers: agregás emails (uno por línea o desde Google Group).
4. Generás un opt-in URL.
5. Lo mandás a tus 20+ testers.
6. **Cada uno tiene que aceptar el opt-in y descargar la app**. Google verifica que efectivamente la instalaron.
7. Mantenés esa cohorte activa **14 días corridos**. Si bajás de 20 testers activos, el contador puede resetear (la política exacta es ambigua, ser conservador y mantener 25+).
8. Después de 14 días aparece un botón "Apply for production access" en el panel.
9. Llenás un breve form (nombre del closed testing, link a la app, etc.) → Google revisa y habilita producción.

### 13.3 Cómo conseguir 20 testers reales

Lo que más complica del proceso. Opciones:

- Amigos / familia / colegas (ideal — feedback real).
- Comunidades de testing recíproco:
  - Reddit r/AndroidPlayBeta
  - Grupos de Telegram de "Play Store closed testing"
  - Facebook groups "Android beta testers"
- Forums fitness/runners donde busques beta testers honestos.
- LinkedIn / Twitter post: "estoy lanzando una app de gym, busco 20 beta testers Android para feedback".

**Tip**: arrancá el closed testing **antes** de tener todo perfecto. Los 14 días corren mientras polishás y los testers van dando feedback real.

### 13.4 Cómo subir el AAB

#### Manual (web)

Console → tu app → Testing → seleccionar track → "Create new release" → arrastrar el AAB → completar release notes → "Save" → "Review release" → "Start rollout".

#### Automatizado con EAS Submit

Setup inicial (una vez):

1. Google Cloud Console → habilitar **Google Play Android Developer API** en un proyecto.
2. Crear **service account** en ese proyecto, generar key JSON.
3. Play Console → Settings → API access → invitar el service account email con permisos:
   - View app information and download bulk reports
   - Manage production releases
   - Manage testing track releases
4. Guardar el JSON como `google-play-key.json` (no commitear — agregar a `.gitignore`).

Después es un comando:

```bash
eas submit --platform android --profile production
```

Sube directo a internal testing por default. Para subir a otro track, modificá `eas.json`:

```json
"submit": {
  "production": {
    "android": {
      "serviceAccountKeyPath": "./google-play-key.json",
      "track": "production"
    }
  }
}
```

---

## 14. Permisos sensibles

### 14.1 Qué cuenta como sensible

Google clasifica algunos permisos como "high-risk" y exige declaración aparte:

- `ACCESS_BACKGROUND_LOCATION` — ubicación en background (running tracking)
- `READ_SMS` / `RECEIVE_SMS`
- `READ_CALL_LOG` / `WRITE_CALL_LOG`
- `READ_CONTACTS` / `WRITE_CONTACTS`
- `MANAGE_EXTERNAL_STORAGE`
- `QUERY_ALL_PACKAGES`

Para IronLog la única que aplica (cuando llegue running) es **`ACCESS_BACKGROUND_LOCATION`**.

### 14.2 Permissions declaration form

Cuando subís un AAB que incluye un permiso sensible, Console te pide llenar un form aparte. Para background location:

1. Caso de uso: "GPS-based fitness activity tracking (running, walking, hiking)".
2. Por qué se necesita en background: "Para mantener el GPS rastreando con la pantalla bloqueada — los usuarios bloquean el teléfono mientras corren para ahorrar batería".
3. Mostrar **video screencast** (sí, video) que demuestre:
   - Pantalla donde se le explica al user por qué se pide el permiso (consent screen).
   - Cómo el user inicia el tracking.
   - Cómo el tracking sigue con la pantalla bloqueada (notificación persistente).
   - Cómo el user puede pararlo.
4. Confirmar que la app:
   - Muestra un prominent in-app disclosure antes de pedir el permiso.
   - Tiene una notificación foreground service mientras trackea.
   - Permite parar el tracking en cualquier momento.

### 14.3 Plan IronLog para evitar bloqueos

- **v1 (sin running)**: lanzar sin background location. Permisos sensibles cero. Submit sin form extra.
- **v2 (con running)**: cuando esté listo el módulo running:
  1. Grabar video screencast del flujo completo.
  2. Sumar el permiso a `app.json`.
  3. Build nuevo, subir a closed testing primero.
  4. Llenar el permissions declaration form.
  5. Esperar aprobación de Google del form (3–7 días extra).
  6. Promover a producción.

---

## 15. Submit a producción

Una vez que tildaste todos los items del task list y pasaste los 14 días de closed testing:

1. Console → tu app → Production → "Create new release".
2. Subir el AAB (o **promover** desde closed/open testing — recomendado, no rebuilds, mismo binary).
3. Release notes en cada idioma activo (lo que aparece en "Novedades" de Play Store):
   ```
   • Primera versión de IronLog
   • Tracking de rutinas y sets
   • Detección de PRs
   • 165+ ejercicios pre-cargados
   ```
4. "Save" → "Review release" → revisar el resumen → "Start rollout to production".

### 15.1 Review timeline

| Caso | Tiempo típico |
|---|---|
| Primera app de cuenta nueva | 3–7 días, a veces hasta 14 |
| Updates posteriores | Pocas horas a 1 día |
| Apps con permisos sensibles | +3–7 días extra de review del form |

Review automatizado + humano. Te avisan por mail si rechazan, con motivo.

### 15.2 Rollout estratégico

Recomendado para cualquier release a producción:

- **Staged rollout**: empezás con 5% de usuarios, monitoreás crash rate, subís a 20% / 50% / 100% en días sucesivos.
- Si el crash rate sube de tu baseline, **pausás** el rollout y publicás un fix.

Para la PRIMERA versión, podés ir directo a 100% (no hay baseline aún), pero activá staged rollout desde la segunda en adelante.

---

## 16. Post-launch

### 16.1 Pre-launch report (gratis y automático)

Antes de cada release a producción / closed / open, Google corre tu app en una flota de devices físicos. Te genera un report con:

- Crashes detectados.
- ANRs (App Not Responding).
- Issues de accesibilidad.
- Issues de privacidad/seguridad detectados.
- Capturas de cada pantalla.

**Mirá ese report siempre antes de promover.** Está en Console → tu app → Testing → Pre-launch report.

### 16.2 Monitoring

Por default Play Console te muestra:

- Install / uninstall rate.
- Crash rate y ANR rate (% de sesiones con crash).
- Reviews con rating distribution.
- Country breakdown.

Para más detalle agregar:

- **Firebase Crashlytics** — gratis, stack traces de cada crash, filtros por device/version.
- **Sentry** — alternativa, mejor DX, tier gratuito limitado.

No es obligatorio para v1 pero te ahorra muchísimo tiempo de debugging cuando aparezca un crash en producción.

### 16.3 Reviews

- Los users dejan reviews públicas con rating 1–5.
- Respondelas, sobre todo las negativas, con tono profesional.
- Las respuestas son públicas y suben tu ranking.
- Reviews < 3 estrellas pueden contestarse con "te contacté por email" si pediste su mail.

### 16.4 Vitals

Console → Quality → Android vitals. Te muestra:
- Excessive wakeups
- Stuck wake locks
- Crash rate vs peer apps de tu categoría

Si superás los thresholds de Google, te bajan en search ranking. Atender ASAP.

---

## 17. Updates posteriores

### 17.1 Flujo típico

1. Cambios de código.
2. **Incrementar `versionCode`** en `app.json` (ej. 1 → 2).
3. Opcional: incrementar `version` (ej. 1.0.0 → 1.0.1).
4. `eas build --platform android --profile production`.
5. `eas submit --platform android --profile production` (sube a internal testing).
6. Verificás que arranca bien.
7. Promovés a producción desde Console (manual) o cambiás `track` a "production" en `eas.json` y resubmit.
8. Staged rollout (5% → monitoreás → 20% → 50% → 100%).

### 17.2 Hotfix urgente

Si hay un crash crítico en producción:

1. **Halt rollout** en Console (botón "Halt") — frena que más users reciban la versión rota.
2. Build con el fix → submit → review (te suelen acelerar para hotfixes).
3. Promover el hotfix.

> Ojo: **no podés "borrar" una versión publicada**. Solo podés publicar una versión nueva. Los users que ya la instalaron tienen que actualizar.

### 17.3 Política de update mínimo

Si el update es crítico (security fix, breaking server change), podés forzar update vía In-App Updates API. Out-of-scope para v1.

---

## 18. Razones comunes de rejection

| Motivo | Cómo evitarlo |
|---|---|
| Privacy policy URL rota o no accesible | Verificá la URL en incógnito antes de submit. |
| Inconsistencia entre data safety form y privacy policy | Repasá ambos lado a lado. |
| Permisos sin justificación visible al usuario | Antes de cada `permissionsAsync()`, mostrá un dialog explicativo. |
| Crashes en startup | Mirá el pre-launch report y arreglá cualquier issue antes de submit. |
| Background location sin form aprobado | Llená el form **antes** de mandar a producción. |
| Copyright issues | No usar fotos/iconos de terceros sin license. Si usás Lucide/Feather/Ionicons, está OK (open source). |
| App "vacía" o broken | Tener al menos 5 features funcionales reales. |
| Spam o duplicados de otra app | No copies otra app conocida. |
| Misleading descripcion vs functionality | Lo que prometés en la ficha tiene que estar en la app. |

Si te rechazan, el mail explica el motivo. Arreglás, resubmit. **No te bannean** salvo que insistas con violations claras o uses la cuenta para algo turbio.

---

## 19. Checklist final accionable

### Fase 1 · Cuenta y verificación

- [ ] Decidir Personal vs Organization
- [ ] Pagar USD 25 en Play Console
- [ ] Subir documento + selfie
- [ ] Recibir confirmación de identidad (24h–7d)
- [ ] (Si vendés) configurar payment profile

### Fase 2 · Configuración del proyecto

- [ ] Definir `package` permanente en `app.json`
- [ ] Setear `versionCode: 1` y `version: "1.0.0"`
- [ ] Configurar adaptive icon (foreground + backgroundColor)
- [ ] Configurar splash screen
- [ ] Setear permisos mínimos para v1
- [ ] Verificar que target SDK ≥ 34

### Fase 3 · Assets

- [ ] App icon 512×512
- [ ] Adaptive icon foreground 432×432 transparente
- [ ] Splash screen
- [ ] Feature graphic 1024×500
- [ ] Mínimo 2 screenshots de teléfono (recomendado 6–8)
- [ ] (Opcional) Promo video subido a YouTube

### Fase 4 · Build

- [ ] `eas build:configure` ejecutado
- [ ] `eas.json` con profiles development/preview/production
- [ ] Primer AAB de producción buildeado exitosamente
- [ ] Upload keystore backupeada en password manager
- [ ] (Opcional) service account JSON para EAS Submit configurado

### Fase 5 · Play Console — Setup app

- [ ] App creada en Console (free, app, default lang)
- [ ] Habilitar Play App Signing al subir el primer AAB

### Fase 6 · Store listing

- [ ] App name + short description (80ch) + full description (4000ch)
- [ ] Categorización (Health & Fitness)
- [ ] Tags (5)
- [ ] Contact email visible
- [ ] Privacy policy URL pública y accesible

### Fase 7 · Cuestionarios

- [ ] App access
- [ ] Ads (No)
- [ ] Content rating (PEGI 3 / Everyone)
- [ ] Target audience (18+)
- [ ] News / COVID / Government — todos No
- [ ] Data safety form completo y consistente con privacy policy

### Fase 8 · Privacy policy

- [ ] Hosteada en URL pública
- [ ] Cubre todos los datos declarados en data safety
- [ ] Email de contacto válido
- [ ] Linkeada desde Console

### Fase 9 · Testing

- [ ] AAB subido a internal testing
- [ ] App abre y funciona en al menos 3 devices distintos
- [ ] Pre-launch report sin issues bloqueantes
- [ ] AAB subido a closed testing
- [ ] 20+ testers agregados a la lista
- [ ] Opt-in URL distribuida y aceptada por 20+ testers
- [ ] Confirmado que los 20+ instalaron la app
- [ ] **14 días continuos** transcurridos
- [ ] "Apply for production access" enviado y aprobado

### Fase 10 · (Solo si aplica) Permisos sensibles

- [ ] Video screencast del flujo grabado
- [ ] Permissions declaration form llenado
- [ ] Form aprobado por Google

### Fase 11 · Producción

- [ ] Production release creado (preferentemente promovido desde closed testing)
- [ ] Release notes en español
- [ ] Staged rollout activado (start con 5% si no es la primera vez)
- [ ] Submit
- [ ] Esperar review (3–7 días primera vez)
- [ ] App live en Play Store

### Fase 12 · Post-launch

- [ ] Verificar que la app aparece en search por nombre
- [ ] Verificar que se puede instalar y abrir desde Play Store
- [ ] Configurar Crashlytics o Sentry (opcional pero recomendado)
- [ ] Monitorear vitals durante la primera semana
- [ ] Responder reviews

---

## 20. Apéndice — Comandos y URLs útiles

### Comandos EAS

```bash
# Login una vez
pnpm dlx eas-cli login

# Configuración inicial
pnpm dlx eas-cli build:configure

# Build de producción (AAB)
eas build --platform android --profile production

# Build local (sin EAS cloud)
eas build --platform android --profile production --local

# Build APK para testers directos
eas build --platform android --profile preview

# Submit a Play Store
eas submit --platform android --profile production

# Ver builds activos
eas build:list

# Gestionar credentials
eas credentials

# Bajar la upload keystore
# (desde el menú interactivo de eas credentials)
```

### URLs clave

| Para qué | URL |
|---|---|
| Crear cuenta Play Console | https://play.google.com/console/signup |
| Play Console (after signup) | https://play.google.com/console |
| Payment profile | https://pay.google.com |
| Google Cloud Console (service accounts) | https://console.cloud.google.com |
| EAS Build dashboard | https://expo.dev/accounts/[user]/projects/ironlog/builds |
| Play Console API | https://developers.google.com/android-publisher |
| Política de developer | https://play.google.com/about/developer-content-policy/ |

### Documentos referenciables

| Doc | Para qué |
|---|---|
| `RUNNING.md` | Plan del módulo running (cuándo activar background location) |
| `db.md` | Estado del storage (relevante para data safety form) |
| `backend.md` | Cuando sumes backend, actualizar privacy policy y data safety |
| `README.md` | Onboarding general del repo |

### Variables de entorno para CI

Si automatizás releases en GitHub Actions:

```bash
EXPO_TOKEN=...                     # eas-cli auth
GOOGLE_PLAY_KEY_JSON=...          # contenido de google-play-key.json
ANDROID_KEYSTORE=...               # base64 de la keystore
ANDROID_KEYSTORE_PASSWORD=...
ANDROID_KEY_ALIAS=...
ANDROID_KEY_PASSWORD=...
```

`google-play-key.json` y la keystore **no** commitear al repo. Guardarlos como secrets.

---

## Apéndice — Decisiones documentadas (mini-ADRs)

**ADR A-1: Lanzar v1 sin running**
Decisión: la primera versión de IronLog en Play Store es solo gym/nutrition/body. Running se suma en v2.
Razón: evitar el form de permisos sensibles + video screencast en el primer launch. Reduce risk de rejection inicial.

**ADR A-2: Personal account, no Organization**
Decisión: registrar como Personal.
Razón: D-U-N-S Number tarda 1–4 semanas. Los 14 días de closed testing son aceptables como costo de arranque.

**ADR A-3: Play App Signing siempre**
Decisión: aceptar Play App Signing al subir el primer AAB.
Razón: Google guarda la signing key — si perdés la upload key podés recuperar. Self-managed es too risky.

**ADR A-4: Privacy policy minimalista pero honesta**
Decisión: privacy policy en GitHub Pages, contenido alineado a la app local-only actual.
Razón: cuando sumemos backend / analytics / IAP, actualizar. Por ahora reflejar la realidad: nada se sube a la nube.

**ADR A-5: Sin analytics en v1**
Decisión: no integrar Firebase Analytics ni Mixpanel en el primer launch.
Razón: data safety form más simple, menos riesgo de inconsistencias, alineado al espíritu local-first. Si después necesitamos métricas, agregar Crashlytics primero (solo crashes, no behavior).
