# Yunza Tech

MVP multijugador con React, Vite, Tailwind CSS, Firebase Authentication (Google), Cloud Firestore y una API en **Deno Deploy**. El backend ya no usa Cloud Functions, Cloud Tasks ni Cloud Scheduler, por lo que el proyecto Firebase puede permanecer en el plan Spark (sin Blaze). La portada muestra una ilustración identificada como tal; no simula una partida.

## Qué incluye

- Acceso con Google. Al iniciar sesión se crea automáticamente `users/{uid}` con `isAdmin: false`.
- Rol administrador definido **exclusivamente** por el booleano `users/{uid}.isAdmin === true`, que se habilita y revoca desde Firebase Console. No existen pantallas, scripts ni endpoints de autoasignación. Custom Claims y la colección `admins` no conceden nada.
- Creación y edición de actividades propias, invitación por código/enlace e inscripciones.
- Máquina de estados `LOBBY → DECORATING → READY → PLAYING → FINISHED`, con cancelación desde estados no terminales.
- Árbol SVG adaptable, decoración compartida, límites por participante, posiciones normalizadas y teclado.
- Turnos aleatorios por rondas sin repetir persona entre rondas; daño aleatorio criptográfico calculado en servidor.
- Transacciones, identificadores de solicitud y turnos únicos para impedir golpes duplicados y ganadores concurrentes.
- Vencimientos en servidor: `Deno.cron` cada minuto como recuperación y aviso desde los navegadores conectados para vencer al segundo. Nunca decide el reloj del cliente.
- Ganador persistente, vista pública sin correos ni configuración privada e historial de golpes y omisiones.
- Indicaciones de carga, errores y desconexión; cierre de listeners y descarte de sesiones antiguas.

## Arquitectura

```text
React ── Firebase Auth (Google)
      ├─ Firestore SDK / onSnapshot (perfil propio, actividades, proyección pública)
      └─ HTTPS + ID token ── API Deno Deploy (backend/)
                             ├─ firebase-admin: verificación de ID tokens
                             ├─ @google-cloud/firestore (REST): transacciones
                             └─ Deno.cron: recuperación de vencimientos cada minuto
```

Firestore sigue notificando los cambios directamente al navegador. El backend conserva la autoridad sobre permisos, daño, estado, turnos, ganador y proyección pública. El Admin SDK omite las reglas, por eso el backend comprueba explícitamente cada permiso dentro de la transacción.

## Preparación

Necesitas **Node.js 22+**, npm, **Deno 2.x** y **Java 21+** para el emulador de Firestore. La CLI de Firebase viene en las dependencias de desarrollo.

```powershell
npm ci
```

Los scripts aceptan herramientas portátiles ignoradas por Git dentro de `.tools/`: `scripts/firebase.js` detecta `.tools/java21/<carpeta>/bin/java.exe` y `scripts/deno.js` usa `.tools/deno/deno.exe` si Deno no está en el `PATH` (también puedes indicar `DENO_BIN`). En otra máquina instala Deno y Java 21 de forma normal y configura `JAVA_HOME`/`PATH`.

Si npm bloquea scripts de instalación (`npm warn allow-scripts`), no hace falta aprobarlos: la aplicación y las pruebas funcionan sin ellos.

## Desarrollo con emuladores (sin facturación ni proyecto real)

En tres terminales, desde la raíz:

```powershell
# Terminal 1: Auth, Firestore y UI de emuladores
npm run emulators

# Terminal 2: backend Deno contra los emuladores (recarga automática y reloj local cada segundo)
npm run backend

# Terminal 3: frontend apuntando exclusivamente al proyecto demo y a http://127.0.0.1:8000
npm run dev:emulators
```

Abre el enlace de Vite (normalmente http://localhost:5173). La UI de emuladores está en http://127.0.0.1:4000. El modo `emulator` fuerza `demo-yunza-tech`, usa cuentas de prueba de Google del emulador y toma las variables de `backend/.env.emulator`. El backend rechaza arrancar con variables de emulador si el proyecto no empieza por `demo-`, si detecta `DENO_DEPLOY=true` o si hay `GOOGLE_APPLICATION_CREDENTIALS`.

En modo local el backend ejecuta la misma recuperación del cron cada segundo (`LOCAL_CLOCK_MS`) y expone `POST /api/dev/expire-due`, que solo existe con emuladores y que las pruebas usan para simular el cron.

### Primer administrador local

1. Entra con una cuenta de prueba desde la app: se crea `users/{uid}` con `isAdmin: false`.
2. En la UI de emuladores (Firestore → `users`) cambia `isAdmin` a `true` (booleano).
3. El panel `/admin` se habilita sin volver a iniciar sesión: el rol se escucha en tiempo real.

## Contrato HTTP del backend

Todas las respuestas llevan `Cache-Control: no-store` y `Vary: Origin`. CORS solo acepta los orígenes exactos de `ALLOWED_ORIGINS`. CORS no sustituye a la autenticación: cada ruta protegida verifica el ID token de Firebase con el Admin SDK.

| Método y ruta                     | Autenticación                                     | Comportamiento                                                                     |
| --------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `GET /api/health`                 | Pública                                           | `{ ok, mode, identity }`; `identity` resume la sonda de credenciales de Google.    |
| `GET /api/clock`                  | Pública                                           | `{ now }` en milisegundos UTC del servidor.                                        |
| `POST /api/operate`               | Bearer ID token                                   | Ejecuta una operación del juego. Cuerpo JSON ≤ 16 KB con `action` y `requestId`.   |
| `POST /api/activities/:id/expire` | Bearer ID token; participante o admin propietario | Pide comprobar un vencimiento. El servidor decide con su reloj y el estado actual. |
| `OPTIONS` de cualquier ruta       | Sin token                                         | Preflight CORS.                                                                    |

Operaciones: `create`, `updateConfig`, `registration`, `decorateStart`, `decorate`, `playStart`, `hit`, `skip`, `cancel`, `join`, `joinCode`.

```http
POST /api/operate
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json

{"action":"join","activityId":"ID_ACTIVIDAD","requestId":"UUID"}
```

Éxito: `{ "result": { "activityId": "..." } }`. Error: `{ "error": { "code": "permission-denied", "message": "..." } }` con estados 400 (`invalid-argument`), 401 (`unauthenticated`), 403 (`permission-denied`), 404 (`not-found`), 405, 409 (`already-exists`, `failed-precondition`, `aborted`), 413 y 500 con mensaje genérico. El diagnóstico detallado solo se registra en servidor; nunca se registran tokens.

Garantías conservadas:

- Las operaciones administrativas (`create`, `updateConfig`, `registration`, `decorateStart`, `playStart`, `skip`, `cancel`) leen `users/{uid}.isAdmin === true` dentro de la transacción y **antes** de devolver un recibo guardado, así un rol revocado bloquea también los reintentos. Además verifican propiedad de la actividad.
- Un administrador no puede golpear fuera de turno ni unirse a actividades cerradas: los permisos de participante siguen siendo específicos.
- Ganador, daño, turnos y proyección pública se escriben de forma atómica.
- `requestId` es idempotente y queda ligado a la huella del payload: reutilizarlo con otros datos devuelve `already-exists`.
- Cualquier `uid`, `role` o `isAdmin` enviado en el cuerpo se ignora como prueba de identidad.

## Vencimientos

- El frontend, cuando la cuenta regresiva sincronizada llega a cero y hay sesión (participante u organizador), llama a `/expire` con hasta 5 intentos y espera exponencial. Un aviso anticipado no cambia nada.
- `Deno.cron` (`recover-deadlines`, cada minuto, con reintentos) consulta `activities` con `nextDeadline` vencido y procesa hasta 5 páginas de 200 actividades por ejecución, en grupos de 20 transacciones. Lo que quede pendiente lo toma la siguiente ejecución.
- Varias peticiones simultáneas de navegadores y cron producen una sola omisión o transición por turno: todas pasan por la misma transacción.
- Sin navegadores conectados el avance depende del cron: minuto de granularidad más la latencia de la plataforma. El servidor rechaza igualmente adornos y golpes después del plazo exacto.
- Al recuperar una actividad se crea el siguiente turno desde ese momento; no se simulan las rondas perdidas durante una desconexión.

## Esquema y autoridad

| Colección                                                               | Contenido y acceso                                                                                                                                                                                                               |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                                                           | Perfil privado, correo e `isAdmin`. Lectura propia; creación propia con `isAdmin: false`; actualización propia solo para inicializar `isAdmin: false` en perfiles antiguos sin el campo. El rol se edita desde Firebase Console. |
| `users/{uid}/requests/{requestId}`                                      | Recibos idempotentes con `result`, `fingerprint` y `createdAt`; privados                                                                                                                                                         |
| `activities/{id}`                                                       | Configuración, propietario, código, estado, lista, cola y `nextDeadline`; lectura solo del admin propietario                                                                                                                     |
| `activities/{id}/participants/{uid}`                                    | Participación única y contador de adornos; privada                                                                                                                                                                               |
| `activities/{id}/turns/{n}` y `/hits/{n}`                               | Historial privado                                                                                                                                                                                                                |
| `joinCodes/{code}`                                                      | Resolución de códigos exclusivamente en el backend                                                                                                                                                                               |
| `publicActivities/{id}`                                                 | Proyección explícita (lista de campos de `publicActivity()`); lectura por ID, listado denegado                                                                                                                                   |
| `publicActivities/{id}/participants`, `/decorations`, `/hits`, `/turns` | Datos compartidos para los listeners                                                                                                                                                                                             |

Los tiempos son milisegundos UTC producidos en servidor. Las reglas deniegan todas las escrituras de clientes sobre juego, historial, recibos y códigos, el listado de usuarios y cualquier modificación del rol. Un campo ausente, `false` o el texto `"true"` nunca conceden administración.

## Rutas del frontend

| Ruta                     | Uso                                                           |
| ------------------------ | ------------------------------------------------------------- |
| `/`                      | Inicio e ilustración del árbol                                |
| `/join?code=CODIGO`      | Acceso con Google e ingreso por código                        |
| `/admin`                 | Actividades propias y creación; requiere `isAdmin`            |
| `/admin/activities/:id`  | Gestión, configuración, lista e historial; requiere propiedad |
| `/activities/:id`        | Participación persistente y fases                             |
| `/activities/:id/winner` | Resultado compartido                                          |
| `/display/:id`           | Pantalla pública sin sesión, solo lectura                     |

## Variables de configuración

Frontend (públicas, se incorporan al build; ver `.env.example`):

```dotenv
VITE_FIREBASE_API_KEY=CLAVE_WEB_PUBLICA
VITE_FIREBASE_AUTH_DOMAIN=ID_REAL.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ID_REAL
VITE_FIREBASE_APP_ID=APP_ID_WEB
VITE_API_BASE_URL=https://URL_REAL_DEL_BACKEND
VITE_USE_EMULATORS=false
VITE_BASE_PATH=/
```

`VITE_API_BASE_URL` no incluye `/api` ni barra final. `VITE_FIREBASE_FUNCTIONS_REGION` ya no se usa. Storage, Messaging y Analytics no se utilizan.

Backend (ver `backend/.env.example`; se configuran por contexto en Deno Deploy):

```dotenv
FIREBASE_PROJECT_ID=ID_REAL
ALLOWED_ORIGINS=https://DOMINIO_REAL,https://www.DOMINIO_REAL
```

La identidad de Google llega por la Cloud Connection de Deno Deploy, que inyecta `GOOGLE_APPLICATION_CREDENTIALS`; no la definas a mano ni guardes claves. Producción y Development (previews) deben tener su propio `FIREBASE_PROJECT_ID`; el cron de una preview nunca debe apuntar a producción. Las variables de emulador (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `LOCAL_CLOCK_MS`, `PORT`) solo existen en local.

## Organización del código

- `src/services/firebase.js`: Auth y Firestore del cliente, selección de emuladores y cliente HTTP de la API (`operate`, `serverClock`, `requestExpiration`) con un reintento tras 401 renovando el token y conservando payload y `requestId`.
- `src/services/userProfile.js`: transacción que crea el perfil propio con `isAdmin: false` sin tocar roles existentes.
- `src/components/AuthProvider.jsx`: sesión, creación del perfil, listener del rol, carga, errores y reintento; descarta respuestas de sesiones anteriores.
- `src/hooks/`: suscripciones, operaciones idempotentes, reloj sincronizado y aviso de vencimientos (`useExpiration`).
- `backend/main.ts`: rutas HTTP, CORS, cron y reloj local. `backend/firebase.ts`: configuración, Admin SDK y sonda de identidad. `backend/db.ts`: cliente Firestore REST. `backend/auth.ts`: verificación de ID tokens. `backend/http.ts`: errores, CORS y límite de cuerpo.
- `backend/domain.js` y `backend/service.js`: validación, máquina de estados, geometría, rondas, daño, transacciones, autorización, proyección pública y vencimientos.
- `firestore.rules` e `firestore.indexes.json`: seguridad de clientes e índice de actividades propias.
- `tests/run-integration.js` y `tests/emulator.test.js`: arrancan el backend Deno contra los emuladores y ejecutan el flujo completo.

## Verificación

```powershell
npm run lint            # ESLint del frontend y scripts
npm run format:check    # Prettier (incluye backend/)
npm run check:backend   # deno check + deno lint
npm test                # pruebas Deno: dominio, configuración y verificación de tokens (usa red)
npm run build           # Vite
npm run test:emulators  # Auth + Firestore emulados, backend Deno y pruebas de integración
```

`npm test` incluye una prueba que descarga las claves públicas de Google para rechazar tokens con firma falsa; sin red, ejecútala con `SKIP_NETWORK_TESTS=true`. `test:emulators` usa solo `demo-yunza-tech` y limpia Firestore al comenzar.

La integración cubre: salud, reloj, CORS, límite de cuerpo y formas de error; tokens ausentes, malformados, vencidos y de otro proyecto; rol ausente, `false`, texto `"true"` y booleano `true`; revocación con recibos reintentados; propiedad administrativa; inscripción única; adornos compartidos, geometría y límites; avisos de vencimiento anticipados, no autorizados, concurrentes y recuperación tipo cron; turnos elegibles; doble clic y reintentos; omisión administrativa; ganador único concurrente; creación de perfil con reglas, inicialización de perfiles antiguos y prohibición de autoascenso, listado y lecturas privadas. El emulador de Auth acepta tokens sin firma por diseño; la firma se comprueba en `backend/tests/auth_test.ts` en modo nube.

## Publicación

### 1. Firebase (sin Blaze)

1. Habilita **Google** en Authentication → Sign-in method y añade `localhost` y el dominio final en Settings → Authorized domains.
2. Crea Cloud Firestore en modo nativo y despliega reglas e índices con el ID real del proyecto (no el nombre visible):

```powershell
npx firebase login
npx firebase projects:list
npx firebase deploy --project "ID_REAL" --only "firestore"
```

`.firebaserc` apunta al proyecto demo; indicar `--project` es obligatorio.

### 2. Backend en Deno Deploy

1. La app `yunzatech` vive en la organización `favio-coder` de https://console.deno.com y está vinculada al repositorio `Favio-coder/yunzatech`, rama `main`. Configura **App Directory** = `backend`, runtime **Dynamic App**, entrypoint `main.ts` y comandos de instalación y compilación vacíos. La sección `deploy` de `backend/deno.json` apunta a la misma app para publicaciones opcionales con `npm run deploy:backend`. `Deno.cron` se habilita con `"unstable": ["cron"]`. URL de producción: https://yunzatech.favio-coder.deno.net. Las previews no tienen acceso al Firebase de producción.
2. Variables por contexto: `FIREBASE_PROJECT_ID` y `ALLOWED_ORIGINS` en **Production**; valores propios para **Development** si se quiere probar previews con otro proyecto Firebase.
3. Cloud Connection con Google Cloud (identidad sin claves descargadas). Requiere en el proyecto de Google Cloud del Firebase real: habilitar `iam`, `iamcredentials` y `sts`; un Workload Identity Pool y proveedor OIDC con issuer `https://oidc.deno.com`; una **cuenta de servicio** a la que el pool pueda impersonar (`roles/iam.workloadIdentityUser`) y, sobre el proyecto, el rol mínimo `roles/datastore.user` para Firestore. Deno documenta `deno deploy setup-gcp` y los comandos `gcloud` equivalentes en [Cloud Connections](https://docs.deno.com/deploy/reference/cloud_connections/). Restringe la confianza a la app y al contexto de producción (`principal://.../subject/deployment:ORG/APP/production`). La verificación de ID tokens no necesita IAM.
4. Tras el primer despliegue comprueba `GET /api/health` (`identity` debe ser `ok`), `GET /api/clock`, una operación con token real y, en la pestaña **Cron**, la ejecución de `recover-deadlines`.

### 3. Frontend

GitHub Pages (workflow `.github/workflows/deploy.yml`): define las variables de repositorio `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` y `VITE_API_BASE_URL`. El job `verify` ejecuta lint, formato, checks Deno, pruebas y la suite con emuladores antes de publicar. `VITE_BASE_PATH` es `/` porque el sitio se publica en el dominio propio `yunzatech.com` (archivo `CNAME` y configuración de Pages).

Firebase Hosting (opcional): `npm run build` con `VITE_BASE_PATH=/` y `npx firebase deploy --project "ID_REAL" --only "hosting"`. El rewrite SPA no afecta a `/api`, que vive en otro dominio.

Antes de abrir una yunza real, prueba con dos cuentas y una pantalla pública en el entorno desplegado.

## Costes y límites

Google Auth, Firestore, GitHub Pages y Deno Deploy tienen cuotas gratuitas, pero no ilimitadas: revisa [Firestore](https://firebase.google.com/docs/firestore/quotas) y [Deno Deploy](https://deno.com/deploy/pricing). Cada ejecución del cron cuenta como una petición. Cada lectura de reglas con `get()` del perfil cuenta como lectura. MVP limitado a 100 personas por actividad y 30 adornos por persona; la UI muestra los últimos 100 turnos. No hay archivado de actividades ni limpieza de recibos.

## Resolución de problemas

| Síntoma                        | Revisar                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| No aparece `users/{uid}`       | Reglas desplegadas, proyecto correcto, sesión Google y el mensaje de error con botón Reintentar. |
| API 401                        | Token Firebase, proyecto, vencimiento y header `Authorization`.                                  |
| API 403                        | `isAdmin` booleano y propiedad/participación; distinguir reglas de cliente de IAM del backend.   |
| `identity: error` en `/health` | Cloud Connection, pool/proveedor OIDC, cuenta de servicio, APIs habilitadas y contexto.          |
| Error CORS                     | Origen exacto en `ALLOWED_ORIGINS`, preflight y respuestas de error.                             |
| Vite funciona pero no el juego | `VITE_API_BASE_URL` y `/api/health` del backend.                                                 |
| Turnos se demoran sin clientes | Cron por minuto y sus registros; no equivale a temporizadores exactos.                           |
| Firebase solicita Blaze        | Se intentó desplegar Functions o se conserva alguna dependencia de servicios de pago.            |

## Estado de esta entrega (23 de octubre de 2026)

Ejecutado con éxito en local: `npm run lint`, `npm run format:check`, `npm run check:backend`, `npm test` (13 pruebas Deno, incluida la verificación de firma con claves de Google), `npm run build` y `npm run test:emulators` (15 casos de integración más el contenedor, con Auth y Firestore emulados y el backend Deno 2.9.8 usando el transporte REST de Firestore).

Pendiente y fuera del repositorio, requiere acceso del propietario:

- Crear la app en Deno Deploy, vincular el repositorio y configurar variables por contexto. La URL pública resultante va en `VITE_API_BASE_URL` y en `ALLOWED_ORIGINS` del frontend.
- Aprovisionar la federación OIDC en Google Cloud. Deno Deploy exige una cuenta de servicio para la Cloud Connection; no se descarga ninguna clave, pero su creación y los permisos IAM deben autorizarse explícitamente. No se ha creado ningún recurso remoto.
- Desplegar reglas e índices al proyecto real, añadir el dominio en Authorized domains y configurar DNS/HTTPS del dominio comprado.
- Probar en el entorno desplegado Google real, dominio, cron y una partida con dos usuarios, revocación y recuperación de vencimientos. Los emuladores no demuestran IAM ni OAuth de producción.
- Marcar `isAdmin: true` en Firebase Console para el primer organizador.
