# IronLog — Especificación de diseño actual

Documento de referencia exhaustivo del estado **actual** de la aplicación IronLog. Su objetivo es servir como input para una IA que rediseñe visualmente la app, manteniendo idéntica funcionalidad, contenido, navegación y datos.

> Idioma de la app: **español**. Plataforma: **mobile-first (Expo / React Native)**, también funciona en web. Sin backend — todo se persiste en `AsyncStorage` con la clave `ironlog:v1`.

---

## 1. Identidad visual y design system

### 1.1 Marca
- Nombre: **IronLog**
- Tono: deportivo, motivador, directo, profesional
- Categoría: app de gimnasio / fitness completa (entrenamiento + nutrición + cuerpo)

### 1.2 Paleta de colores
Color de marca dominante: **naranja `#FF6B35`** (acentos, CTAs, ítems activos, gradientes).

#### Modo claro (`light`)
| Token | Valor | Uso |
|---|---|---|
| `background` | `#FAFAFA` | Fondo de pantallas |
| `foreground` | `#0A0A0A` | Texto principal |
| `card` | `#FFFFFF` | Fondo de tarjetas, tab bar |
| `primary` | `#FF6B35` | Marca, botones CTA, acentos |
| `primaryForeground` | `#FFFFFF` | Texto sobre primario |
| `secondary` | `#F2F2F2` | Fondo de inputs, chips inactivos, segmented control |
| `muted` / `mutedForeground` | `#F0F0F0` / `#737373` | Fondos sutiles / texto secundario |
| `accent` / `accentForeground` | `#FFE5DA` / `#FF6B35` | Pills informativas, badges suaves naranja |
| `destructive` | `#E11D48` | Eliminar, warnings críticos |
| `success` | `#10B981` | Logros, mejoras positivas |
| `warning` | `#F59E0B` | Calentamientos, carbos, snacks |
| `border` / `input` | `#E5E5E5` | Bordes de tarjetas e inputs |

#### Modo oscuro (`dark`)
| Token | Valor |
|---|---|
| `background` | `#0A0A0A` |
| `foreground` | `#FAFAFA` |
| `card` | `#161616` |
| `primary` | `#FF6B35` (igual) |
| `secondary` | `#1F1F1F` |
| `accent` | `#3A1F14` |
| `border` | `#262626` |

#### Colores por grupo muscular (usados en chips, badges, decoraciones)
- Pecho: naranja `#FF6B35`
- Espalda: azul `#3B82F6` (oscuro: `#60A5FA`)
- Piernas / cuádriceps: verde `#10B981` (oscuro: `#34D399`)
- Hombros: amarillo/ámbar `#F59E0B` (oscuro: `#FBBF24`)
- Brazos: morado `#A855F7` (oscuro: `#C084FC`)
- Core / abs: rosa `#EC4899` (oscuro: `#F472B6`)

### 1.3 Tipografía
Fuente única: **Inter** (Google Fonts, cargada vía `@expo-google-fonts/inter`). Pesos: 400 / 500 / 600 / 700.

| Variante | Tamaño | Line height | Peso | Letter spacing | Uso típico |
|---|---|---|---|---|---|
| `display` | 48 | 52 | bold | -1.2 | Cronómetro de descanso |
| `h1` | 32 | 38 | bold | -0.8 | Títulos de pantallas tab ("Entrenar", "Nutrición") |
| `h2` | 24 | 30 | bold | -0.4 | Métricas grandes, numerales destacados |
| `h3` | 20 | 26 | semibold | -0.2 | Subtítulos de sección, valores en cards |
| `title` | 17 | 22 | semibold | 0 | Títulos de tarjeta, ítems de lista |
| `body` | 15 | 21 | regular | 0 | Texto descriptivo, párrafos |
| `label` | 13 | 17 | medium | 0 | Etiquetas de input, chips |
| `caption` | 12 | 16 | regular | 0 | Texto secundario, metadatos |
| `tiny` | 10 | 14 | medium | 0.5 | **TODO MAYÚSCULAS** — etiquetas de datos ("VOLUMEN", "META") |
| `mono` | 15 | — | semibold | tabular-nums | Números monoespaciados (cronómetro, pesos) |

### 1.4 Espaciado, radios y elevación
- **Border radius global**: `14px` para tarjetas, botones e inputs (`colors.radius`)
- Radios menores: `8`, `10`, `12` (chips, pills, badges)
- Pills/circulares: `999` o radio = mitad del tamaño
- Padding base de tarjeta: `16`
- Padding de pantalla: `16` horizontal
- Sombra (sólo iOS): `shadowOpacity: 0.04`, offset `(0, 2)`, radius `6` — muy sutil
- Animación de press: `opacity: 0.85` + `scale: 0.98`

### 1.5 Iconografía
**Feather Icons** exclusivamente (`@expo/vector-icons`, set Feather). Tamaños comunes: 12, 14, 16, 18, 20, 22, 28, 32, 44.

Iconos usados con frecuencia:
- Tabs: `home`, `zap`, `trending-up`, `pie-chart`, `grid`
- Acciones: `plus`, `check`, `x`, `play`, `chevron-left`, `chevron-right`, `edit-2`, `trash-2`, `copy`, `more-vertical`
- Métricas: `bar-chart-2`, `activity`, `award`, `target`, `calendar`, `clock`
- Estados: `check-circle`, `alert-circle`, `info`, `lock`
- Comidas: `coffee` (desayuno), `sun` (almuerzo), `package` (snack), `moon` (cena)
- Cuerpo: `image`, `camera`, `sliders`

---

## 2. Componentes UI reutilizables

Todos viven en `components/ui/`.

| Componente | Resumen visual |
|---|---|
| **Screen** | Wrapper de pantalla con safe-area top/bottom, opcional scroll, padding 16 horizontal por defecto, status bar adaptado al tema. |
| **Header** | Barra superior con: botón "atrás" circular (36×36, fondo `secondary`, icono `chevron-left`) a la izquierda, título + subtítulo centrado, slot derecho para acciones. Fondo = `background`, sin sombra, opcional borde inferior. |
| **Card** | Caja blanca/oscura con borde 1px (`border`), radio 14, padding 16. Sombra muy ligera en iOS. Puede ser presionable. |
| **Button** | Variantes: `primary` (naranja relleno), `secondary` (gris), `ghost` (transparente), `outline` (borde), `danger` (rojo). Tamaños `sm` 36px, `md` 48px, `lg` 56px. Texto Inter SemiBold. Opcional `icon` izquierdo y `iconRight`. Anim press: opacidad + escala 0.98. Haptic feedback. |
| **Input** | Fondo `secondary`, borde transparente que pasa a `primary` al enfocar (o `destructive` con error). Altura 48. Label arriba (`label` muted) opcional, hint/error abajo. Slot `rightAdornment` para icono o sufijo. |
| **SegmentedControl** | Pill horizontal con fondo `secondary` y padding 4. Opción activa = card blanca/oscura con texto semibold; inactivas = texto muted medium. Haptic feedback. |
| **EmptyState** | Centrado verticalmente con icono dentro de círculo 72×72 (fondo `secondary`, borde sutil), título h3, descripción body muted, botón opcional. |
| **Badge** | Pill pequeña con texto en mayúsculas. |
| **IconButton** | Botón circular con un único icono. Tamaño parametrizable. |
| **ProgressBar** | Barra horizontal de 4-6px con fondo `secondary` y relleno `primary` (o color custom). |
| **MuscleGroupChip** | Pill horizontal con etiqueta del grupo muscular ("Pecho", "Espalda"…). Estado activo = fondo `primary` + texto blanco; inactivo = fondo `secondary`. |

---

## 3. Componentes especializados

### 3.1 Charts (`components/charts/`)
- **LineChart** (`react-native-svg`): gráfico de línea con curva suave, área degradada bajo la línea, puntos en cada dato, labels en eje Y a la izquierda. Sin grid pesado.
- **Heatmap**: estilo GitHub. Cuadrados de 13-14px con gap 3px, en grilla 7 filas × N semanas. Etiquetas mensuales arriba ("dic", "ene"…), días "L M X J V S D" a la izquierda (sólo días pares para no saturar). Intensidad: vacío = `secondary`; 1 sesión = primary 53% alpha; 2 = 80%; 3+ = primary sólido. Días futuros ocultos.
- **MacroRing**: anillo SVG circular grueso (12-14px). Fondo gris (`secondary`), arco naranja proporcional al consumo. Centro: número grande de calorías restantes + "kcal restantes" debajo.
- **BarRow**: una sola barra horizontal con label a la izquierda (ej. "Proteína"), valor numérico a la derecha (ej. "0 / 150g"), barra debajo coloreada según macro.

### 3.2 Workout
- **SetRow**: fila horizontal compacta para registrar un set en el entrenamiento activo.
  - Badge circular de set a la izquierda (32×32): número del set o "C" si es calentamiento (color amarillo/warning para warmup, foreground para work). Cuando está completado: fondo `primary` con número en blanco.
  - Columna "PREVIO" (64px): muestra `peso × reps` de la última sesión de ese ejercicio o "—".
  - 3 inputs centrados: KG, REPS, RPE (RPE oculto si es warmup). Fondo `background`, texto centrado, semibold.
  - Botón check a la derecha (36×36, borde): vacío inactivo / verde primary cuando completado. Long-press elimina el set.
  - Fila completa cambia a fondo `accent` con borde `primary` cuando está completada.

- **RestTimer**: tarjeta con borde, aparece tras completar un set de trabajo.
  - Header: pill circular con icono `clock` + "Descanso" (label muted), botón cerrar (X) a la derecha.
  - Cronómetro tipográfico **enorme (display 48pt)** centrado, formato `mm:ss`, tabular-nums.
  - Barra de progreso decreciente (6px alto, llenado de derecha a izquierda).
  - 3 botones en fila: `−15s` (gris), `Pausar/Reanudar` (naranja, doble ancho, con icono play/pause), `+15s` (gris).
  - Haptic + notificación al llegar a 0.

### 3.3 Celebration
- **CelebrationOverlay**: modal a pantalla completa al desbloquear logros o batir PRs. Fondo translúcido oscuro. Card central con icono grande circular naranja, título grande, subtítulo descriptivo, botón "Continuar". Usado en la pantalla de resumen post-entrenamiento.

---

## 4. Navegación

### 4.1 Estructura
Expo Router con dos niveles:

```
RootLayout (Stack, sin headers, transición slide_from_right)
├── (tabs) ── Tab bar inferior con 5 tabs
│   ├── index       → "Inicio"     icon: home
│   ├── workout     → "Entrenar"   icon: zap
│   ├── progress    → "Progreso"   icon: trending-up
│   ├── nutrition   → "Nutrición"  icon: pie-chart
│   └── more        → "Más"        icon: grid
├── routine/[id]    (card)         — detalle/edición de rutina (id="new" crea una nueva)
├── workout/active  (card, sin gesto atrás)  — sesión en curso
├── workout/summary (card, sin gesto atrás)  — resumen post-sesión
├── exercises       (modal)        — selector de ejercicios
├── food-add        (modal)        — añadir alimento al diario
├── food-new        (modal)        — crear alimento personalizado
├── exercise-detail                — historial y stats de un ejercicio
├── profile                        — datos personales del usuario
├── settings                       — preferencias de la app
├── goals                          — metas personales
├── achievements                   — logros desbloqueables
├── planning                       — plan semanal + calendario
└── body                           — peso, medidas, fotos
```

### 4.2 Tab bar inferior
- Altura: 64px (Android) / 88px (iOS, con safe area)
- Fondo: `card`, borde superior 1px `border`
- Iconos crecen ligeramente al estar activos (21 → 23) y se tiñen de `primary`
- Etiqueta debajo del icono: `Inter_600SemiBold` 10pt

---

## 5. Pantallas — descripción exhaustiva

### 5.1 Pantalla `Inicio` (`app/(tabs)/index.tsx`)

**Propósito**: dashboard del día con saludo, próximo entrenamiento, métricas resumen y heatmap de actividad.

**Estructura vertical (scroll)**:

1. **Saludo personalizado**
   - Línea 1 (caption muted): `"Buenos días"` / `"Buenas tardes"` / `"Buenas noches"` según hora actual
   - Línea 2 (h1): nombre del usuario (`profile.name`)

2. **Tarjeta "héroe" del día** — adopta uno de tres estados:
   - **Sesión activa**: gradiente naranja diagonal (`#FF6B35` → `#FF4F1F`), texto blanco. Pill "EN CURSO" arriba, título "Continuar entrenamiento", subtítulo "Tienes una sesión activa". Icono `play-circle` 44px a la derecha. Tap → `/workout/active`.
   - **Día programado**: gradiente naranja (`#FF6B35` → `#E64A1A`), pill "HOY", título = nombre del día de la rutina, subtítulo = `{nombreRutina} · {N} ejercicios`, círculo blanco translúcido con icono `play` a la derecha. Tap → empieza ese entrenamiento.
   - **Día de descanso**: card normal con círculo `accent`/icono `calendar`, título "Día de descanso", subtítulo "No tienes nada programado hoy", chevron a la derecha → `/planning`.

3. **2 filas de 2 stat cards** (4 totales). Cada card: icono coloreado en círculo 32×32 con tinte 20% del color, número grande (h2 24pt), label caption muted.
   - Días seguidos (icono `zap`, naranja) — racha actual
   - Entrenamientos (icono `award`, success) — total de sesiones finalizadas
   - Volumen 7 días (icono `bar-chart-2`, azul) — formato `0.0t`
   - kcal del día (icono `pie-chart`, warning) — formato `consumidas / meta kcal`

4. **Card "Actividad"** con heatmap
   - Header con título "Actividad" + subtítulo "Últimas 18 semanas", icono `activity` en círculo accent a la derecha
   - Heatmap GitHub-style centrado debajo

5. **(Condicional) Card de éxito si entrenó hoy**: fondo `accent`, borde `primary`, icono `check-circle`, texto "¡Entrenamiento completado hoy!" + recordatorio nutrición/sueño.

6. **(Condicional) Sección "Sesiones recientes"**: títulos h3 + lista de las últimas 3 sesiones. Cada item: barra vertical naranja a la izquierda, nombre del día (title), `{N} sets · {volumen}t` (caption muted), pill naranja "{N} PR" si hubo PRs.

---

### 5.2 Pantalla `Entrenar` (`app/(tabs)/workout.tsx`)

**Propósito**: hub de rutinas — listar las propias y las predefinidas, lanzar entrenamientos rápidos.

**Estructura**:

1. **Header**: "Entrenar" (h1) + subtítulo "{N} rutinas · {N} predefinidas"
2. **(Si hay sesión activa)** Card naranja "Sesión en curso" — círculo blanco con `zap`, texto blanco "Toca para continuar". Tap → `/workout/active`.
3. **Card "Inicio rápido"**:
   - Título "Inicio rápido" con icono `zap` naranja
   - Dos botones lado a lado: "Sesión libre" (primary, icon `plus`) inicia entrenamiento sin rutina, "Nueva rutina" (outline, icon `bookmark`) → `/routine/new`
4. **SegmentedControl**: `Mis rutinas` / `Predefinidas`
5. **Lista de rutinas** según pestaña:
   - Cada item: card con cuadrado redondeado 44×44 a la izquierda (fondo `accent` con icono `star` para preset, fondo `secondary` con icono `bookmark` para propias), título de rutina + pill pequeña con la goal ("Fuerza", "Hipertrofia", "Definición", "Principiante") al lado, subtítulo "{N} días · {N} ejercicios"
   - Si es preset: botón `copy` a la derecha que clona la rutina
   - Si es propia: chevron a la derecha
   - Tap del item → `/routine/{id}`
   - Si no hay rutinas en "Mis rutinas": EmptyState con icono `bookmark`, título "Sin rutinas", botón "Crear rutina"

---

### 5.3 Pantalla `Progreso` (`app/(tabs)/progress.tsx`)

**Propósito**: panel de progreso general con tres pestañas.

**Header**: "Progreso" (h1), subtítulo "{N} sesiones registradas"
**SegmentedControl**: `Resumen` / `Ejercicios` / `Cuerpo`

#### Pestaña "Resumen"
1. **Card "Volumen semanal"**: header con título + subtítulo "Últimas 8 semanas", a la derecha el volumen de la última semana en h3 naranja. LineChart de 8 semanas.
2. **Card "Récords personales"**: header con título + subtítulo "{N} PRs totales", círculo accent con `trending-up`. Si vacío: texto centrado muted. Si hay: lista de hasta 5 PRs ordenados por fecha desc — cada fila tiene nombre del ejercicio (label semibold), fecha relativa (caption muted), peso del PR (title naranja) y delta `+Xkg` debajo (tiny muted).
3. **Card "Estadísticas"**: header con icono `bar-chart-2` + "Estadísticas". Grid 2×2 de "MiniStat" (label tiny muted en mayúsculas + valor h3): Total sets, Tiempo total, Volumen total, Promedio/sesión.

#### Pestaña "Ejercicios"
- Lista de los 10 ejercicios más frecuentes ordenados por uso. Cada card: nombre del ejercicio (label semibold), "{N} sesiones" (caption muted), récord de peso a la derecha (title naranja) + label "Récord" (tiny muted).
- Tap → `/exercise-detail?id={id}`
- Si no hay datos: EmptyState con `activity`.

#### Pestaña "Cuerpo"
1. **Card "Peso corporal"**: header con título + "{N} registros", botón pill "+ Registrar" naranja claro a la derecha. LineChart de evolución del peso si hay 2+ registros, sino texto pidiendo más datos. Debajo: dos columnas "ACTUAL" y "CAMBIO" (con flecha verde si bajó, foreground si subió).
2. **Card "Métricas"**: icono `info` + "Métricas". Dos cajas grises lado a lado: "IMC" con valor h2 + categoría con color (Bajo peso azul, Normal verde, Sobrepeso ámbar, Obesidad rojo); "PESO" con valor h2 + "kg".
3. **Card "Fotos y medidas"** (presionable): círculo accent con icono `image`, título "Fotos y medidas", subtítulo "Seguimiento corporal completo", chevron. Tap → `/body`.

---

### 5.4 Pantalla `Nutrición` (`app/(tabs)/nutrition.tsx`)

**Propósito**: diario calórico con macros y comidas del día.

**Estructura**:

1. **Header**: "Nutrición" (h1) + subtítulo "Hoy" o fecha larga ("lunes, 14 de abril"). A la derecha: dos IconButton circulares (chevron-left / chevron-right) para cambiar de día (no permite avanzar a futuro).

2. **Card de calorías y macros** (la más importante):
   - Lado izquierdo: **MacroRing** 140×140 con calorías restantes en el centro
   - Lado derecho (flex 1): dos columnas "CONSUMIDAS" y "META" con números h3, debajo tres BarRow apilados:
     - Proteína (color `primary` naranja) — `0 / 150g`
     - Carbos (color `warning` ámbar) — `0 / 280g`
     - Grasas (color `backColor` azul) — `0 / 80g`

3. **Botón ancho "Añadir comida"** (naranja primary, padding vertical 14, icono `plus` + texto title blanco). Tap → `/food-add?date=…`.

4. **4 cards de comidas** (Desayuno, Almuerzo, Snack, Cena). Cada card:
   - Círculo `accent` 36×36 con icono propio (coffee/sun/package/moon) en `primary`
   - Título del meal + subtítulo "Vacío" o "{N} alimentos · {kcal} kcal"
   - Botón circular `+` a la derecha (32×32, fondo secondary) → abre `/food-add` con meal preseleccionado
   - Si tiene items: lista debajo con chips horizontales (fondo secondary, padding compacto): nombre del alimento (flex 1), gramos (caption muted), kcal totales (label semibold). Long-press elimina el item.

5. **Texto pequeño centrado** al final si hay items: "Mantén pulsado un alimento para eliminarlo".

---

### 5.5 Pantalla `Más` (`app/(tabs)/more.tsx`)

**Propósito**: menú de configuración y secciones secundarias.

**Estructura**:

1. **Header**: "Más" (h1)

2. **Card del perfil** (presionable → `/profile`): círculo naranja 56×56 con la inicial del nombre en blanco h2. Al lado: nombre (h3), "{peso} kg · {altura} cm · {edad} años" (caption muted). Chevron a la derecha.

3. **Sección "ENTRENAMIENTO"** (label tiny muted) con grupo de filas en card unificada:
   - Planificación semanal (icon `calendar`)
   - Metas (icon `target`) — badge naranja con número de metas activas si hay
   - Logros (icon `award`) — badge con número de logros desbloqueados

4. **Sección "CUERPO"**:
   - Peso, medidas y fotos (icon `trending-up`) → `/body`

5. **Sección "PREFERENCIAS"**:
   - Ajustes (icon `settings`) → `/settings`

6. **Footer centrado**: cuadrado accent 48×48 con icono `zap` naranja, texto caption muted "IronLog · v1.0"

Cada **MenuRow** es: cuadrado redondeado 32×32 (fondo `secondary`) con icono, título flex 1, badge opcional, chevron a la derecha. Separador entre filas (línea 1px con padding-left 60).

---

### 5.6 Pantalla `Detalle de rutina` (`app/routine/[id].tsx`)

**Propósito**: visualizar/editar una rutina (preset o propia) y empezar a entrenar.

**Si la id es "new"**: se crea automáticamente una rutina vacía y se redirige a su id real.

**Estructura**:

1. **Header**: nombre de la rutina + botón derecho `copy` si es preset, o `trash-2` rojo si es propia (con confirmación de borrado).

2. **Si es propia**:
   - Botón pequeño "Editar nombre" (caption naranja con icono `edit-2`) que abre un input + botón "Guardar".

   **Si es preset**: card naranja claro (`accent`) con icono `info` y texto "Esta es una rutina predefinida. Cópiala para personalizarla."

3. **Descripción** (si existe) — body muted.

4. **Selector de días** (si hay >1 día): scroll horizontal de pills:
   - Día activo: fondo `primary`, texto blanco semibold
   - Días inactivos: fondo `secondary`, texto foreground
   - Si es propia: botón circular `+` al final para añadir un día

   Si solo hay 1 día y es propia: aparece un botón outline "Añadir día".

5. **Sección del día activo**:
   - Encabezado: nombre del día (h3) + "{N} ejercicios" (caption muted)
   - Lista de ejercicios — cada uno en una card:
     - Cuadrado naranja claro 32×32 con número del ejercicio (label naranja bold)
     - Nombre del ejercicio (title) + "{sets} × {reps} · {rest}s descanso" (caption muted)
     - Si es propia: 3 SmallStepper en fila debajo (Series / Reps / Calent.) — cada uno con label tiny muted en mayúsculas, fila con `−` / valor / `+` con haptic
     - Si es propia: botón `x` a la derecha para quitar el ejercicio
   - Si vacío: EmptyState `plus-circle` "Sin ejercicios" con botón "Añadir ejercicio" (sólo si propia)
   - Si propia con ejercicios: botón outline ancho "Añadir ejercicio" (icon `plus`)
   - Si propia y >1 día: enlace pequeño rojo destructivo "Eliminar este día" abajo

6. **Botón flotante inferior** (solo si hay ejercicios): "Empezar entrenamiento" (primary, lg, icon `play`, ancho completo, posición absolute bottom 16).

---

### 5.7 Pantalla `Sesión activa` (`app/workout/active.tsx`)

**Propósito**: registrar un entrenamiento en tiempo real.

**Auto-arranca**: si llega con `?routineId=&dayId=` y no hay sesión activa, la inicia automáticamente.

**Estructura**:

1. **Header**: nombre del día (`session.dayName`) + subtítulo = cronómetro de la sesión (formato `Hh MMm` o `MM:SS`). Botón derecho `x` rojo → confirma "Descartar sesión".

2. **Card resumen** (3 columnas con divisores verticales):
   - DURACIÓN (tiny muted) + valor (h3 tabular-nums)
   - SETS + valor
   - VOLUMEN + valor `{kg}kg`

3. **(Condicional) RestTimer** — aparece tras completar un set de trabajo, ver §3.2.

4. **Por cada ejercicio** (en `session.exerciseOrder`): una card con:
   - Header: cuadrado accent 36×36 con icono `activity` naranja, nombre del ejercicio (title) + "{sets} × {reps} · {rest}s" (caption muted)
   - **Fila de cabeceras**: SET (32px) | PREVIO (64px) | KG | REPS | RPE | (espacio botón)
   - Lista de **SetRow** (ver §3.2). Calcula filas combinando warmups + work sets, dejando una fila extra al final para añadir más sets.

5. Botón outline ancho "Añadir ejercicio" (icon `plus`) → `/exercises?sessionId=…`

6. **Botón flotante inferior** "Terminar sesión" (primary, lg, icon `check`). Pide confirmación → finaliza, calcula PRs y desbloquea logros, navega a `/workout/summary`.

---

### 5.8 Pantalla `Resumen de sesión` (`app/workout/summary.tsx`)

**Propósito**: celebración + estadísticas tras completar un entrenamiento.

**Estructura**:

1. **Hero gradiente naranja** con check blanco grande (32px) en círculo translúcido 64×64, texto h2 blanco "¡Sesión completada!" y nombre del día debajo (body translúcido 90%).

2. **Grid de 5 BigStat** en dos filas (2 + 3):
   - Duración (icon `clock`)
   - Volumen (icon `bar-chart-2`) — `{kg}kg`
   - Sets (icon `layers`)
   - Reps (icon `repeat`)
   - Ejercicios (icon `activity`)

   Cada BigStat es card pequeño centrado con icono pequeño muted arriba, valor h3 tabular-nums, label tiny muted en mayúsculas.

3. **(Condicional) Card de récords personales** (fondo accent, borde primary): icono `trending-up` + "Récords personales" (title primary). Lista de PRs con nombre del ejercicio (label) y peso (title naranja).

4. **Sección "Resumen por ejercicio"** (title): lista de cards, una por ejercicio. Cada card: nombre (label semibold) + "{N} sets · {N} reps" (caption muted), peso máximo del ejercicio (title naranja) a la derecha.

5. **Botón ancho** "Volver al inicio" (primary lg, icon `home`) → `/`.

6. **CelebrationOverlay** se dispara secuencialmente para cada PR/logro nuevo desbloqueado.

---

### 5.9 Pantalla `Ejercicios` (`app/exercises.tsx`)

**Propósito**: selector/buscador de ejercicios + creación de ejercicios personalizados.

Usado como modal con params:
- `?routineId=&dayId=` → al elegir, añade el ejercicio al día y vuelve atrás
- `?sessionId=` → al elegir, añade al entrenamiento activo

**Estructura**:

1. **Header**: "Ejercicios", botón derecho `+` naranja → muestra formulario inline.
2. **Input de búsqueda** con icono `search` (o `x-circle` para limpiar).
3. **Scroll horizontal de chips** de grupos musculares: "Todo" + 11 grupos (Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Abdominales, Antebrazos).
4. **Lista de ejercicios**:
   - Si filtro = "Todo": agrupados por grupo muscular con header tiny en mayúsculas
   - Si filtro específico o búsqueda: lista plana
   - Cada **ExerciseRow**: nombre del ejercicio (label semibold), tipo + grupo + "Personalizado" (caption muted), icono `plus-circle` naranja a la derecha
   - Si vacío: EmptyState `search` con botón "Crear ejercicio personalizado"
5. **Form inline** (cuando se toca el +): input "Nombre" + scroll horizontal de chips de grupo muscular, botones "Cancelar"/"Crear".

---

### 5.10 Pantalla `Detalle de ejercicio` (`app/exercise-detail.tsx`)

**Propósito**: ver historial y progresión de un ejercicio específico.

**Estructura**:

1. **Header**: nombre del ejercicio.
2. **Card descriptiva**: tipo + grupo muscular (caption muted), descripción del ejercicio (body).
3. **3 Stat cards en fila**: Récord (peso máximo), Volumen total (`Xt`), Reps totales. Mismo formato que BigStat.
4. **Card "Progreso de peso máximo"**: LineChart de la evolución del max weight por sesión. Si <2 sesiones: texto centrado muted.
5. **Card "Historial reciente"**: últimas 5 sesiones. Cada fila: fecha corta + "{N} sets · {fecha relativa}" a la izquierda, peso máximo en title naranja a la derecha.

---

### 5.11 Pantalla `Añadir alimento` (`app/food-add.tsx`)

**Propósito**: buscar y registrar comida en el diario.

**Vista 1 — Buscador**:
- Header "Añadir alimento" + botón `+` naranja → `/food-new`
- Input de búsqueda
- Lista de alimentos (hasta 50): nombre (label semibold) + "{kcal} kcal · P {N}g · C {N}g · G {N}g" (caption muted), chevron derecho.

**Vista 2 — Configurar cantidad** (al elegir):
- Header con nombre del alimento + back personalizado que vuelve al buscador
- Card "POR 100G": 4 MacroPills inline (Kcal naranja, Prot verde, Carb ámbar, Grasa azul)
- Input "Cantidad (gramos)" con sufijo "g"
- Card "TOTAL" mostrando: Calorías (title naranja grande) y debajo P/C/G en columnas centradas
- Selector de comida (SegmentedControl 4 opciones: Desayuno, Almuerzo, Snack, Cena)
- Botón ancho "Añadir al diario" (primary lg, icon `check`)

---

### 5.12 Pantalla `Nuevo alimento` (`app/food-new.tsx`)

**Propósito**: crear alimento personalizado.

- Header "Nuevo alimento"
- Texto pequeño "Valores nutricionales por 100 gramos"
- Inputs: Nombre, Calorías (kcal/100g), Proteína (g), Carbohidratos (g), Grasas (g) — todos numéricos
- Botón ancho "Crear alimento"

---

### 5.13 Pantalla `Perfil` (`app/profile.tsx`)

**Propósito**: editar datos personales del usuario para cálculos nutricionales y de cuerpo.

**Estructura**:

1. **Header**: "Perfil"
2. **Card "Datos personales"**: Input Nombre, fila de 3 inputs (Edad / Altura cm / Peso kg), SegmentedControl Sexo (Hombre / Mujer)
3. **Card "Actividad"**: lista de 5 opciones (Sedentario, Ligero, Moderado, Activo, Muy activo) con descripción cada una. Activa = fondo `accent`, borde `primary`, label en `primary`. Inactiva = fondo `secondary` plano.
4. **Card "Objetivo"**: SegmentedControl 4 opciones (Bajar, Mantener, Músculo, Subir)
5. **Card "CALCULADO"** (fondo accent, borde primary): label tiny naranja "CALCULADO" + 2 columnas con BMR (kcal en descanso) y TDEE (kcal gasto diario), ambos en h3 naranja.
6. Botón ancho "Guardar cambios"

---

### 5.14 Pantalla `Ajustes` (`app/settings.tsx`)

**Estructura**:

1. **Header**: "Ajustes"
2. **Card "Apariencia"**: SegmentedControl Sistema / Claro / Oscuro
3. **Card "Unidades"**: SegmentedControl Métrico (kg, cm) / Imperial (lb, in)
4. **Card "Descanso por defecto"**: input numérico con sufijo "seg" + hint explicativo
5. **Card "Metas nutricionales"**: subtítulo con valores sugeridos calculados. Input Calorías + fila de 3 inputs (Prot / Carb / Grasa). Botón "Guardar metas".
6. **Card destructiva** "Borrar todos los datos": círculo rojo con `trash-2`, título rojo, subtítulo muted "Restablecer la app a estado inicial". Confirma antes de borrar y vuelve a `/`.

---

### 5.15 Pantalla `Metas` (`app/goals.tsx`)

**Propósito**: gestor de metas personales con plazos.

**Estructura**:

1. **Header**: "Metas" + botón `+` naranja → modal de creación
2. Si vacío: EmptyState `target` con botón "Crear meta"
3. Sección "ACTIVAS · {N}": cada card tiene un círculo vacío 24×24 con borde (checkbox) a la izquierda → toggle. Título + descripción opcional + footer con icono `calendar` y fecha relativa. Botón `x` derecho elimina.
4. Sección "COMPLETADAS · {N}": opacidad 0.7. Checkbox naranja relleno con check blanco. Texto tachado.

**Modal "Nueva meta"** (page sheet): inputs Título / Descripción (multiline) / Plazo en días (numérico). Botón ancho "Crear meta".

---

### 5.16 Pantalla `Logros` (`app/achievements.tsx`)

**Propósito**: mostrar logros desbloqueados y por desbloquear.

**Estructura**:

1. **Header**: "Logros"
2. **Card "{N} / {Total}" desbloqueados** (fondo accent, borde primary): círculo primary 56×56 con icono `award` blanco, h2 con conteo en `primary`, caption "Logros desbloqueados".
3. **Lista de los 13 logros** (orden fijo). Cada card:
   - Si desbloqueado: opacidad completa, círculo `primary` con icono blanco, check-circle naranja a la derecha
   - Si bloqueado: opacidad 0.6, círculo `secondary` con icono muted, icono `lock` muted a la derecha
   - Título (title) + descripción (caption muted)

**Lista de logros**:
1. Primera sesión (1 entrenamiento) — icon `award`
2. Primera semana (3 días seguidos) — icon `calendar`
3. 10 entrenamientos — icon `target`
4. 50 entrenamientos — icon `shield`
5. 100 entrenamientos — icon `star`
6. Racha de 7 días — icon `zap`
7. 30 días seguidos — icon `trending-up`
8. Primer PR — icon `trophy`
9. 10 PRs — icon `crown`
10. 100kg en press de banca — icon `anchor`
11. 140kg en sentadilla — icon `anchor`
12. 180kg en peso muerto — icon `anchor`
13. Seguimiento corporal (10 pesos) — icon `activity`

---

### 5.17 Pantalla `Planificación` (`app/planning.tsx`)

**Propósito**: asignar rutinas a días de la semana + ver calendario mensual con sesiones reales.

**Estructura**:

1. **Header**: "Planificación"
2. **Sección "Plan semanal"** (h3): 7 cards (Lunes a Domingo). Cada card:
   - Cuadrado 44×44 con abreviatura del día (LUN, MAR…) en caption bold. Si tiene rutina asignada: fondo `accent`, texto `primary`. Si descanso: fondo `secondary`, texto muted.
   - Nombre del día (title) + subtítulo "Descanso" o "{rutina} · {día}"
   - Icono `edit-2` o `plus` a la derecha
   - Tap → abre modal de selección
3. **Card "Semana de descarga"** (fondo accent, borde primary): icono `info` + título naranja "Semana de descarga" + caption "Cada 4-6 semanas reduce el peso al 50% y el volumen al 50% para recuperar y volver más fuerte."
4. **Calendario mensual**:
   - Header: "Mes Año" (h3) + dos botones circulares chevron-left/right para navegar
   - Card con grilla 7 columnas:
     - Cabecera: L M X J V S D (tiny muted, una por columna)
     - Cuerpo: aspect-ratio 1, padding 2. Cada celda:
       - Día entrenado (sesión finalizada): fondo `primary`, número blanco bold
       - Hoy: fondo `accent`, borde `primary` 2px, número en `primary` bold
       - Día programado pero no entrenado: punto `primary` 4×4 debajo del número
       - Resto: número foreground medium
   
**Modal "Día"** (page sheet con back chevron `x`): 
- Card "Descanso" (icon `moon`) → desasigna
- Lista de todas las rutinas con sus días: card con cuadrado accent + icono `zap`, título del día, subtítulo "{rutina} · {N} ejercicios"

---

### 5.18 Pantalla `Cuerpo` (`app/body.tsx`)

**Propósito**: registro completo de seguimiento corporal en 3 pestañas.

**Header**: "Cuerpo"
**SegmentedControl**: `Peso` / `Medidas` / `Fotos`

#### Pestaña "Peso"
1. **Card "Peso"**: header con título + "{N} registros", botón pill primary "+ Registrar" a la derecha (abre modal). LineChart si >=2 registros, sino texto pidiendo más datos.
2. Lista de registros (más reciente primero), cada uno en card: peso (label semibold) + fecha corta. Long-press elimina.

**Modal "Registrar peso"**: input numérico "Peso (kg)" + botón ancho "Guardar".

#### Pestaña "Medidas"
1. **(Si hay datos suficientes) Card "GRASA CORPORAL ESTIMADA (NAVY)"** (fondo accent, borde primary): label tiny naranja en mayúsculas + valor h1 naranja con %.
2. Botón "Nueva medición" → modal
3. Si vacío: EmptyState `sliders`
4. Lista de mediciones (más reciente primero). Cada card: fecha (label semibold) + grid horizontal de **MeasureChips** (label tiny muted + valor label semibold) para cada medida registrada (Cintura, Pecho, Cadera, Cuello, Hombros, Brazo izq/der, Muslo izq/der). Long-press elimina.

**Modal "Nueva medición"**: scroll con texto explicativo "Todas las medidas en cm. Deja en blanco las que no quieras registrar." + 9 inputs numéricos (en filas de 1-2): Cintura, Pecho, Cadera, Cuello, Hombros, Brazo izq, Brazo der, Muslo izq, Muslo der. Botón "Guardar".

#### Pestaña "Fotos"
1. Dos botones lado a lado: "Galería" (outline, icon `image`) y "Cámara" (primary, icon `camera`) — ambos solicitan permisos.
2. Si vacío: EmptyState `camera`
3. Grid de 3 columnas de fotos (aspect-ratio 0.75). Cada foto: imagen completa con overlay inferior negro translúcido mostrando la fecha (tiny blanca). Long-press confirma eliminación.

---

## 6. Modelo de datos

Todo en `AsyncStorage` con key `ironlog:v1`. State en `IronLogContext` (React Context).

### 6.1 Entidades principales

**Exercise**: `id, name, description, primaryMuscle, secondaryMuscles[], type, isCustom?`
- Tipos: `barbell | dumbbell | machine | cable | bodyweight`
- Grupos musculares (11): `chest, back, shoulders, biceps, triceps, quadriceps, hamstrings, glutes, calves, abs, forearms`
- **165 ejercicios sembrados** (15 por grupo muscular), todos en español con descripciones cortas. Etiquetas: Pecho, Espalda, Hombros, Bíceps, Tríceps, Cuádriceps, Isquiotibiales, Glúteos, Gemelos, Abdominales, Antebrazos.

**Routine**: `id, name, description?, days[], isPreset?, goal?, createdAt`
- `goal`: `strength | hypertrophy | cutting | beginner` (etiquetas: Fuerza, Hipertrofia, Definición, Principiante)
- `days[]`: cada `RoutineDay = { id, name, exercises[] }`
- `RoutineExercise`: `id, exerciseId, targetSets, targetReps, warmupSets, supersetWith?, restSeconds, notes?`

**4 rutinas predefinidas** sembradas:
- **Fuerza 5x5** (strength, 2 días A/B): 5×5 sentadilla / press banca / remo (A); sentadilla / press militar / peso muerto (B). Rest 180s.
- **Hipertrofia PPL** (hypertrophy, 3 días Push/Pull/Legs): 6 ejercicios cada uno, rest 60-180s
- **Definición** (cutting, 4 días Tren Sup A/B + Tren Inf A/B): rest 45-90s, más volumen
- **Cuerpo completo (principiante)** (beginner, 3 sesiones): rutinas básicas

**WorkoutSession**: `id, routineId?, routineDayId?, routineName, dayName, startedAt, endedAt?, sets[], exerciseOrder[], totalVolumeKg, prsAchieved[], notes?`

**CompletedSet**: `id, exerciseId, weight, reps, rpe?, isWarmup, setIndex, completedAt`

**PRRecord**: `exerciseId, exerciseName, type ("weight"|"volume"|"reps"), value, previousValue?, achievedAt`

**UserProfile**: `name, age, weightKg, heightCm, sex (male|female), activityLevel (sedentary|light|moderate|active|veryActive), goal (lose|maintain|gain|muscle), units (metric|imperial), theme (system|light|dark), caloriesGoal?, proteinGoalG?, carbsGoalG?, fatGoalG?`

**BodyWeightEntry**: `id, date, weightKg`

**BodyMeasurementEntry**: `id, date, waist?, chest?, hips?, leftArm?, rightArm?, leftThigh?, rightThigh?, neck?, shoulders?` (todo en cm)

**ProgressPhoto**: `id, date, uri, weightKg?, notes?`

**FoodItem**: `id, name, brand?, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, defaultServingG?, isCustom?`
- **47 alimentos sembrados** organizados por categoría: Proteínas (pollo, huevo, atún, salmón, carnes, lácteos proteicos, whey, tofu, mariscos), Carbohidratos (arroz, avena, pasta, patata, pan, quinoa, legumbres), Grasas (aguacate, frutos secos, mantequilla maní, aceite oliva), Frutas (plátano, manzana, fresas, arándanos, naranja, sandía), Verduras (brócoli, espinaca, pepino, tomate), Lácteos (leches, quesos), Snacks (barra proteína, chocolate negro, galletas avena).

**FoodEntry**: `id, date, mealType (breakfast|lunch|snack|dinner|other), foodItemId, grams`

**FitnessGoal**: `id, title, description?, targetDate, exerciseId?, targetWeight?, completed, createdAt`

**ScheduledRoutine**: `dayOfWeek (0-6), routineId, routineDayId`

**AchievementUnlock**: `id, unlockedAt`

### 6.2 Cálculos clave (`utils/calculations.ts`)
- **BMR**: fórmula Mifflin-St Jeor (depende de sexo/edad/altura/peso)
- **TDEE**: BMR × multiplicador de actividad (1.2 sedentario → 1.9 muy activo)
- **Calorie goal por objetivo**: lose −500 kcal, maintain TDEE, muscle +250, gain +500
- **Macros default**: proteína 1.6-2.2g/kg según objetivo, grasas 25-30% de kcal, resto carbos
- **BMI**: `weight / (height/100)²` con categorías Bajo peso (<18.5) / Normal (<25) / Sobrepeso (<30) / Obesidad (≥30)
- **Navy Body Fat**: fórmula con cuello, cintura, cadera (mujeres) y altura
- **Conversiones de unidades**: kg↔lb, cm↔in con `formatWeight` y `formatLength`

### 6.3 Lógica importante
- **Detección de PRs**: al finalizar sesión, compara peso máximo de cada ejercicio contra todas las sesiones previas
- **Streak (días seguidos)**: recorre fechas con sesión completada
- **Logros**: se evalúan tras cada sesión; los recién desbloqueados se muestran con CelebrationOverlay en la pantalla de resumen
- **Cloning de rutinas**: las preset son inmutables; clonar genera una copia editable con `isPreset: false`
- **Sesión libre**: arranca un workout sin rutina, se añaden ejercicios sobre la marcha

---

## 7. Patrones de interacción

- **Haptic feedback** en toda interacción importante: cambio de segmentado, completar set, ajustar timer, presionar botón principal (vía `expo-haptics`, no en web)
- **Confirmaciones nativas** (`Alert.alert`) para acciones destructivas: borrar rutina, descartar sesión, terminar entrenamiento, borrar registros, reset total
- **Long-press** para eliminar ítems en listas (alimentos, registros de peso, mediciones, fotos)
- **Modales** (presentación page sheet) para formularios de creación: meta, peso, medición, día programado, alimento nuevo
- **Pestañas internas** (SegmentedControl) en pantallas con varias vistas: Progreso (Resumen/Ejercicios/Cuerpo), Cuerpo (Peso/Medidas/Fotos), Entrenar (Mis rutinas/Predefinidas), Add Food (selector de meal)
- **Estados vacíos consistentes** con icono circular, título h3 y descripción muted opcional + botón de acción
- **Auto-creación**: al navegar a `/routine/new` se crea una rutina vacía y se redirige; al entrar a `/workout/active?routineId=…` se inicia sesión si no había una

---

## 8. Resumen de pantallas (mapa rápido)

| # | Ruta | Tipo | Función principal |
|---|---|---|---|
| 1 | `/` (Inicio) | tab | Dashboard del día |
| 2 | `/workout` (Entrenar) | tab | Hub de rutinas |
| 3 | `/progress` (Progreso) | tab | Stats globales (3 sub-pestañas) |
| 4 | `/nutrition` (Nutrición) | tab | Diario calórico |
| 5 | `/more` (Más) | tab | Menú de configuración |
| 6 | `/routine/[id]` | card | Detalle/edición de rutina |
| 7 | `/workout/active` | card | Entrenamiento en curso |
| 8 | `/workout/summary` | card | Resumen post-sesión + celebración |
| 9 | `/exercises` | modal | Selector + creación de ejercicios |
| 10 | `/exercise-detail` | card | Historial y stats de un ejercicio |
| 11 | `/food-add` | modal | Buscar y añadir alimento |
| 12 | `/food-new` | modal | Crear alimento personalizado |
| 13 | `/profile` | card | Datos personales |
| 14 | `/settings` | card | Preferencias (tema, unidades, descanso, metas) |
| 15 | `/goals` | card | Metas con plazos |
| 16 | `/achievements` | card | Logros desbloqueables (13 totales) |
| 17 | `/planning` | card | Plan semanal + calendario mensual |
| 18 | `/body` | card | Peso, medidas, fotos (3 sub-pestañas) |

---

## 9. Lo que NO tiene la app (importante para no añadir)

- **Sin escáner de código de barras** (decisión explícita)
- **Sin backend** — todo local con AsyncStorage
- **Sin sincronización entre dispositivos** ni cuentas de usuario
- **Sin notificaciones push**
- **Sin redes sociales / compartir** (más allá de capturas)
- **Sin entrenador con IA / coach virtual**
- **Sin integración con wearables** (Apple Health, Fit, etc.)
- **Sin compras integradas / suscripciones**
