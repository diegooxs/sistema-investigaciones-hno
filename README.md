# Sistema de investigaciones científicas del HNO

Prototipo funcional correspondiente a los ocho Sprints del proyecto **Desarrollo de un Sistema Web para la Administración, Evaluación, Revisión, Publicación y Consulta de Investigaciones Científicas del Hospital de la Niñez Oaxaqueña**. Los Sprints 1 al 7 implementan el flujo funcional y el Sprint 8 incorpora estabilización, preparación de entrega local, respaldo, restauración, manuales y controles de configuración. La instalación y aceptación en infraestructura institucional requieren coordinación con el hospital.

## Estructura

- `apps/web`: interfaz React y maquetado inicial.
- `apps/api`: API REST Express con endpoints de verificación y metadatos.
- `database`: modelo relacional inicial para MariaDB.
- `docs`: Product Backlog, diagramas, Sprint Backlog y avance del capítulo IV.

## MariaDB local

El proyecto utiliza **MariaDB Server 11.4.10**. En Windows se incluye un instalador portátil automatizado: no es necesario instalar MariaDB como servicio del sistema.

La primera ejecución descarga el paquete ZIP oficial, verifica su suma SHA-256, crea la base `hno_investigaciones`, aplica `database/schema.sql` y carga `database/seed.sql`:

```powershell
pnpm db:up
```

Los datos quedan guardados en `.runtime/data`, aun después de cerrar la API. Comandos disponibles:

- `pnpm db:status`: muestra si MariaDB está activo.
- `pnpm db:tables`: muestra las tablas disponibles.
- `pnpm db:console`: abre una consola SQL conectada a `hno_investigaciones`.
- `pnpm db:down`: detiene MariaDB sin borrar los datos.
- `pnpm db:up`: vuelve a iniciarlo y aplica el esquema y los datos iniciales de manera idempotente.
- `pnpm test:db`: ejecuta la prueba de persistencia real.

También se conserva `compose.yaml` como alternativa para equipos que tengan Docker Desktop funcionando, mediante `pnpm db:docker:up`.

## Ejecución del sistema

1. Copiar `.env.example` como `.env` y ajustar valores locales.
2. Instalar dependencias con `pnpm install`.
3. Iniciar MariaDB con `pnpm db:up`.
4. Ejecutar la API con `pnpm dev:api`.
5. Ejecutar la interfaz con `pnpm dev:web`.
6. Verificar el código con `pnpm check` y la persistencia con `pnpm test:db`.

El Sprint 1 entrega la arquitectura, el modelo de datos, la interfaz base y una aplicación ejecutable verificable. El Sprint 2 incorpora inicio de sesión, tokens con vencimiento, permisos por rol y una pantalla administrativa para registrar usuarios, asignar roles, activar o desactivar cuentas y restablecer contraseñas; los servicios de comités y catálogos permanecen disponibles en la API. El Sprint 3 agrega registro y edición de borradores, asignación de un investigador responsable, búsqueda y filtrado de expedientes, descarga de los documentos proporcionados Anexo A, Anexo E, Anexo G y Anexo I en formato Word, indicador de integración documental, carga validada de anexos y PDF, descarga de archivos e historial de versiones con identificación del documento vigente, responsable y fecha de carga.

El Sprint 4 incorpora la configuración de integrantes, apertura de rondas, asignación de revisores, fechas límite y bandejas según el rol. El Sprint 5 agrega rúbricas versionadas, criterios ponderados, evaluación calculada por la API, observaciones confidenciales, carga de correcciones y reenvío. El Sprint 6 incorpora dictamen por comité, autorización, historial y notificaciones. El Sprint 7 agrega publicación controlada, consulta y reporte ejecutivo. El Sprint 8 prepara una ejecución local reproducible, validación de configuración de producción, encabezados de seguridad, respaldo con suma SHA-256, restauración confirmada y manuales de operación.

## Cierre técnico del Sprint 8

Ejecuta la validación completa antes de entregar:

```powershell
pnpm prod:prepare
```

Para iniciar el prototipo compilado en modo local de entrega:

```powershell
pnpm prod:up
pnpm prod:status
```

La interfaz queda disponible en `http://127.0.0.1:4173`. Para detener todo utiliza `pnpm prod:down`.

El respaldo se genera con `pnpm db:backup` y se almacena en `backups\AAAAMMdd-HHmmss` junto con un manifiesto SHA-256. Antes de restaurar, detén el uso del sistema y ejecuta:

```powershell
pnpm db:restore -- -BackupPath "D:\ruta\al\respaldo" -ConfirmRestore
```

La restauración reemplaza los datos actuales. Los procedimientos completos se encuentran en `docs/manual-tecnico.md` y `docs/manual-usuario.md`.

Las credenciales incluidas son exclusivamente de demostración local y deben sustituirse antes de cualquier despliegue:

- Administrador: `admin@hno.local` / `Admin2027!`
- Administrador Investigador: `investigacion@hno.local` / `Investiga2027!`
- Investigador: `investigador@hno.local` / `Investigador2027!`
- Comité de Ética: `etica@hno.local` / `Comite2027!`
- Comité de Investigación: `comite.investigacion@hno.local` / `Comite2027!`
- Comité de Bioseguridad: `bioseguridad@hno.local` / `Comite2027!`

La ejecución normal de la API utiliza MariaDB. El almacén en memoria se conserva exclusivamente como dependencia aislada de las pruebas unitarias, para que estas no alteren los datos locales.

