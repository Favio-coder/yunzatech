# Yunza Tech

MVP multijugador con React, Vite, Tailwind CSS, Firebase Authentication (Google), Firestore y Cloud Functions de segunda generación. El repositorio conserva la base original. No contiene una partida simulada en almacenamiento local; los adornos de la portada son una ilustración identificada como tal.

## Qué incluye

- Acceso con Google y autorización de organizadores mediante Custom Claims.
- Creación y edición de actividades propias, invitación por código/enlace e inscripciones.
- Máquina de estados: `LOBBY → DECORATING → READY → PLAYING → FINISHED`. Se permite cancelar desde cualquier estado no terminal.
- Árbol SVG adaptable a móvil, decoración compartida, selección y clic/toque, límites por participante y posiciones normalizadas. Interacción por teclado en el centro de la copa.
- Turnos aleatorios por rondas sin repetir a una persona entre rondas; daño aleatorio criptográfico calculado en servidor.
- Transacciones, identificadores de solicitud y turnos únicos para impedir golpes duplicados y ganadores concurrentes.
- Vencimientos duraderos con Cloud Tasks, disparador Firestore con reintentos y recuperación mediante Cloud Scheduler cada minuto.
- Ganador persistente, vista pública sin correos ni acceso a configuración privada e historial de golpes/omisiones.
- Indicaciones de carga, errores y desconexión; cierre de listeners y movimiento reducido.

## Preparación

Recomendado: **Node.js 22**, npm y **Java 21 o superior** para Firestore Emulator. La CLI está instalada en las dependencias de desarrollo; no necesitas instalarla globalmente.

```powershell
npm ci
npm ci --prefix functions
```

En esta máquina hay Java portable en `.tools/java21`, ignorado por Git. `scripts/firebase.js` lo detecta automáticamente en Windows. En otra máquina instala Java 21 y configura `JAVA_HOME`/`PATH`. Las Functions desplegadas usan Node 22; si tu Node local es diferente, el emulador lo advertirá.

## Desarrollo con emuladores (sin facturación ni proyecto real)

En tres terminales, desde la raíz:

```powershell
# Terminal 1: Auth, Firestore, Functions y UI de emuladores
npm run emulators

# Terminal 2: vencimientos locales autónomos
npm run emulators:clock

# Terminal 3: frontend apuntando exclusivamente al proyecto demo
npm run dev:emulators
```

Abre el enlace que imprime Vite (normalmente http://localhost:5173). La UI de emuladores está en http://127.0.0.1:4000. El modo `emulator` fuerza `demo-yunza-tech` y utiliza cuentas de prueba de Google del emulador, sin credenciales reales. Abre dos perfiles de navegador para participar con cuentas diferentes.

El reloj local invoca la misma lógica transaccional del servidor cada segundo. Debe permanecer ejecutándose para vencer turnos y decoración: en producción lo sustituyen Cloud Tasks y Cloud Scheduler, que funcionan sin tu equipo ni navegadores abiertos. El trigger omite Cloud Tasks en emuladores deliberadamente para que las pruebas no dependan de servicios de Google Cloud. Los emuladores normales no guardan datos al cerrarse; puedes usar las opciones `--import` y `--export-on-exit` de Firebase CLI si necesitas conservarlos localmente.

### Primer administrador local

1. Entra con una cuenta Google de prueba desde la app.
2. Copia su UID desde Auth en la UI de emuladores.
3. En PowerShell:

```powershell
$env:FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
$env:GCLOUD_PROJECT = 'demo-yunza-tech'
npm --prefix functions run grant-admin -- UID_DE_PRUEBA
```

4. Cierra sesión y entra otra vez. Ahora `/admin` permite crear actividades.

## Conectar tu Firebase real

1. En Firebase Console, selecciona tu proyecto y registra una aplicación web.
2. Crea **Cloud Firestore en modo nativo**, elige una ubicación compatible con tus Functions y despliega las reglas de este repositorio. No dejes reglas abiertas de prueba.
3. En **Authentication → Sign-in method**, habilita **Google** y selecciona el correo de soporte. En **Settings → Authorized domains**, agrega `localhost`, `127.0.0.1` si lo usas y el dominio final del sitio.
4. Conserva tu `.env` actual o copia `.env.example` y completa `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID`. Deja `VITE_USE_EMULATORS=false` y `VITE_BASE_PATH=/` para Firebase Hosting. Reinicia Vite después de cambiar el entorno.
5. Activa **Blaze (facturación)** para desplegar Functions y sus tareas. El despliegue necesita Cloud Functions, Cloud Run, Cloud Build, Artifact Registry, Eventarc, Pub/Sub, Cloud Tasks y Cloud Scheduler. Firebase CLI suele solicitar habilitar las APIs faltantes. Google Auth, Firestore y Hosting tienen cuotas gratuitas; el uso adicional y los servicios de servidor pueden generar cargos.
6. Autentica la CLI con tu cuenta y despliega al ID concreto de tu proyecto:

```powershell
npx firebase login
npm run build
npx firebase deploy --project TU_PROJECT_ID --only firestore,functions,hosting
```

`.firebaserc` apunta por defecto al proyecto demo. Es obligatorio indicar `--project TU_PROJECT_ID` al desplegar a producción.

Para desarrollo contra tus servicios reales, usa `npm run dev`. Es necesario desplegar las Functions primero; Vite por sí solo no implementa el backend.

### Permisos de tareas y vencimientos

La cuenta de servicio de ejecución del trigger `scheduleDeadline` necesita **Cloud Tasks Enqueuer** en la cola `deadline` y permiso `iam.serviceAccounts.actAs` sobre la identidad que envía tareas. La identidad de la tarea debe tener permiso para invocar `deadline` (Cloud Functions Invoker / Cloud Run Invoker según la configuración de segunda generación). Conserva `deadline` como servicio protegido por IAM; solo `operate` y `clock` son callables accesibles desde el cliente. Verifica también que `recoverDeadlines` tenga su trabajo Scheduler activo.

Tras el primer despliegue, revisa en Google Cloud la cola, el job y los permisos efectivos de las cuentas concretas creadas en tu proyecto. El CLI no garantiza estos permisos en organizaciones que bloquean concesiones automáticas. La documentación oficial enlazada al final detalla IAM para Cloud Tasks.

Si falla el encolado, el evento Firestore se reintenta y el job de recuperación recoge actividades vencidas. Ese respaldo puede retrasar el avance aproximadamente un minuto más el tiempo de ejecución/arranque. El servidor rechaza igualmente adornos o golpes después del plazo exacto. Los tiempos no dependen del reloj del navegador.

### Primer administrador de producción

El script Admin SDK necesita credenciales de aplicación predeterminadas (ADC), **independientes de `firebase login`**. Desde un equipo autorizado, usa `gcloud auth application-default login` o una identidad administrativa configurada fuera del frontend. No guardes claves de servicio dentro del repositorio.

En una terminal de producción, elimina cualquier variable de emuladores si la habías definido:

```powershell
Remove-Item Env:FIREBASE_AUTH_EMULATOR_HOST -ErrorAction SilentlyContinue
Remove-Item Env:FIRESTORE_EMULATOR_HOST -ErrorAction SilentlyContinue
$env:GCLOUD_PROJECT = 'TU_PROJECT_ID'
npm --prefix functions run grant-admin -- UID_REAL
```

El UID se obtiene de Firebase Authentication después de que la persona inicie sesión. Cierra sesión y entra otra vez para renovar el token. El frontend y las reglas nunca pueden asignar roles.

## Rutas

| Ruta                     | Uso                                                           |
| ------------------------ | ------------------------------------------------------------- |
| `/`                      | Inicio e ilustración del árbol                                |
| `/join?code=CODIGO`      | Acceso con Google e ingreso por código                        |
| `/admin`                 | Actividades propias y creación; requiere claim admin          |
| `/admin/activities/:id`  | Gestión, configuración, lista e historial; requiere propiedad |
| `/activities/:id`        | Participación persistente y fases                             |
| `/activities/:id/winner` | Resultado compartido                                          |
| `/display/:id`           | Pantalla pública sin sesión, solo lectura                     |

El administrador puede participar abriendo la ruta de participante y uniéndose como cualquier otra cuenta.

## Esquema y autoridad

| Colección                                           | Contenido y acceso                                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `users/{uid}`                                       | Perfil privado y correo; lectura propia, escrituras solo de servidor                                    |
| `users/{uid}/requests/{requestId}`                  | Recibos idempotentes vinculados al contenido y usuario; privados                                        |
| `activities/{id}`                                   | Configuración, propietario, código, lista congelada, orden y estado; lectura solo del admin propietario |
| `activities/{id}/participants/{uid}`                | Participación única y contador de adornos; privada                                                      |
| `activities/{id}/turns/{n}`                         | Turnos golpeados u omitidos; privados                                                                   |
| `activities/{id}/hits/{n}`                          | Daño y resistencia por golpe; privados                                                                  |
| `joinCodes/{code}`                                  | Resolución de códigos exclusivamente mediante callable                                                  |
| `publicActivities/{id}`                             | Proyección explícita con fase, tiempos, resistencia y ganador; lectura por ID, listado global denegado  |
| `publicActivities/{id}/participants/{uid}`          | Nombre, UID y foto públicos; sin correo                                                                 |
| `publicActivities/{id}/decorations/{uid_requestId}` | Tipo, propietario y posición normalizada                                                                |
| `publicActivities/{id}/hits/{n}`                    | Historial público de golpes                                                                             |
| `publicActivities/{id}/turns/{n}`                   | Historial público de turnos y omisiones                                                                 |

Todos los cambios pasan por `operate`, una callable autenticada. Las reglas **deniegan todas las escrituras de clientes**, incluidas decoraciones: la Function valida propietario, participación, fase, plazo, geometría y límite dentro de una transacción. La proyección pública se escribe en la misma transacción, por lo que resistencia y ganador son consistentes con los datos privados.

Los campos `*At` y `*EndsAt` se almacenan como milisegundos UTC producidos en servidor con `Timestamp.now().toMillis()`. No se acepta ningún timestamp del cliente. El frontend sincroniza su reloj con una callable de servidor; su cuenta regresiva es informativa. Daño, sorteo, vencimientos y transición tienen autoridad exclusivamente en servidor.

Cada solicitud lleva un UUID; el servidor guarda su resultado y huella del contenido. Reintentar una solicitud exitosa devuelve el mismo resultado. Cambiar el contenido conservando el UUID se rechaza. Además, el número de turno evita que dos UUID distintos registren dos golpes sobre el mismo turno. La pertenencia, el estado y la resistencia se verifican de nuevo en cada reintento de la transacción.

## Organización del código

- `src/services/firebase.js`: conexiones reales y selección explícita de emuladores.
- `src/hooks/`: sesión, suscripciones limpias, operaciones idempotentes y reloj sincronizado.
- `src/pages/`: inicio, acceso por código, panel y experiencia por actividad.
- `src/components/`: árbol, capa de adornos, indicador de turno, hachazo, cuenta regresiva y ganador intercambiables por pixel art.
- `functions/src/domain.js`: validación, máquina de estados, geometría, rondas y daño.
- `functions/src/service.js`: transacciones, autorización, proyección pública y vencimientos.
- `functions/src/index.js`: callables, tareas y programación.

## Verificación

```powershell
npm run lint
npm test
npm run build
npm run test:emulators
npm run format:check
```

`test:emulators` arranca Auth, Firestore y Functions y ejecuta las pruebas reales de callable y reglas. Usa solamente `demo-yunza-tech`. No ejecutes esa prueba sobre emuladores que contengan datos locales que quieras conservar: limpia los datos de Firestore del proyecto demo al comenzar.

Las pruebas cubren dos usuarios, rol protegido, propiedad administrativa, inscripción única, adornos compartidos, límites y geometría, expiración autónoma, turnos elegibles, doble clic/reintentos, omisiones, ganador único concurrente, persistencia y prohibición de escrituras/lecturas privadas. Para acelerar las pruebas se adelantan plazos mediante Admin SDK exclusivamente dentro del proyecto demo.

## Hosting existente en GitHub Pages

El workflow existente se conserva. Usa `VITE_BASE_PATH=/yunzatech/` y variables de repositorio `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID` y `VITE_FIREBASE_APP_ID`. También genera `404.html` para resolver rutas SPA. Firebase Hosting ya tiene rewrites SPA y permite usar el sitio desde `/`.

GitHub Pages solo publica el frontend: las reglas, índices y Functions se despliegan por separado en Firebase con el comando anterior. No uses una compilación con `VITE_BASE_PATH=/yunzatech/` para Firebase Hosting en la raíz.

## Límites y pendientes externos

- Debes habilitar Google Auth, Firestore, Blaze y los servicios indicados; verificar IAM de las tareas; asignar tu UID administrador y desplegar. No se hizo ningún despliegue ni se modificó tu proyecto remoto durante la implementación.
- El despliegue de Cloud Tasks/Cloud Scheduler y un acceso OAuth real de Google deben verificarse en tu proyecto; los emuladores no demuestran la configuración IAM ni la pantalla OAuth real.
- MVP limitado a 100 personas por actividad y 30 adornos por persona; la UI muestra los últimos 100 turnos, pero el historial completo permanece en Firestore. No hay eliminación ni archivado de actividades ni limpieza automática de recibos en este MVP.
- Pixel art, pagos y donaciones quedan fuera de esta versión, según el alcance solicitado.

## Documentación oficial

- [Google Auth en web](https://firebase.google.com/docs/auth/web/google-signin)
- [Cloud Tasks e IAM](https://firebase.google.com/docs/functions/task-functions)
- [Cloud Scheduler](https://firebase.google.com/docs/functions/schedule-functions)
- [Runtime de Functions y Blaze](https://firebase.google.com/docs/functions/manage-functions)
- [Emulator Suite y Java](https://firebase.google.com/docs/emulator-suite/install_and_configure)

## Resultado de las comprobaciones de esta entrega

Pasaron ESLint, el formato Prettier, las 8 pruebas de dominio, la compilación de producción y el flujo de integración en Emulator Suite (11 casos más el test contenedor). Se revisó la portada a tamaño de escritorio y a 390 px, y la compilación final mostró el acceso Google en la ruta protegida `/join`.

Se corrigieron las alertas altas de gRPC con una resolución compatible a `1.14.6` o superior, dentro de la versión mayor 1. `npm audit` todavía informa 5 alertas moderadas transitivas de las herramientas de Firebase CLI (OpenTelemetry/gaxios/uuid); quedan pendientes de actualización compatible del proveedor. No se aplicaron degradaciones ni actualizaciones mayores forzadas de esas herramientas. La auditoría de las dependencias de `functions/` informó 0 vulnerabilidades al instalar las versiones actuales.
