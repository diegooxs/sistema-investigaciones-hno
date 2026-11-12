# Manual técnico de instalación y operación

## 1. Alcance

Este manual describe la preparación, ejecución, respaldo y recuperación del prototipo del Sistema de Investigaciones Científicas del Hospital de la Niñez Oaxaqueña. La instalación institucional definitiva debe usar credenciales, dominio, certificado HTTPS y política de respaldo autorizados por el hospital.

## 2. Requisitos

- Windows 10 u 11 de 64 bits.
- Node.js LTS y pnpm 11.19.0.
- 4 GB de memoria disponible y al menos 5 GB de almacenamiento libre.
- Acceso de red local a los puertos configurados para la interfaz, API y MariaDB.
- Cuenta de Windows con permisos sobre la carpeta de instalación.

## 3. Preparación reproducible

1. Copiar el proyecto a una ruta sin sincronización automática.
2. Copiar `.env.example` como `.env` y sustituir todas las credenciales de demostración.
3. Ejecutar `pnpm prod:prepare` desde PowerShell en la raíz del proyecto.
4. Confirmar que las pruebas de API, integración con MariaDB y compilación concluyen sin fallos.
5. Ejecutar `pnpm prod:up` y comprobar `pnpm prod:status`.
6. Abrir `http://127.0.0.1:4173` para la demostración local.

## 4. Configuración institucional

La plantilla `.env.production.example` enumera las variables necesarias. En producción se debe usar `NODE_ENV=production`, una clave JWT aleatoria de al menos 32 caracteres, una contraseña exclusiva para `hno_app`, un origen HTTPS y una URL pública de API. Los archivos `.env` no deben enviarse por correo, incorporarse al repositorio ni incluirse en capturas.

El servidor valida la configuración al iniciar. Si detecta claves predeterminadas, contraseñas de demostración u origen sin HTTPS, cancela el arranque para evitar una publicación insegura.

## 5. Respaldo

1. Verificar que no exista una operación administrativa en curso.
2. Ejecutar `pnpm db:backup`.
3. Confirmar que la carpeta creada contiene `hno_investigaciones.sql` y `manifest.json`.
4. Copiar la carpeta completa a un medio protegido distinto del equipo principal.
5. Conservar al menos un respaldo diario y uno semanal según la política institucional.

Los PDF, anexos, versiones, usuarios, investigaciones, evaluaciones, dictámenes, publicaciones y notificaciones se almacenan en MariaDB; por ello quedan incluidos en el volcado con opción `--hex-blob`. El manifiesto registra la suma SHA-256 para detectar corrupción.

## 6. Restauración

1. Detener el acceso de usuarios.
2. Ejecutar `pnpm db:restore -- -BackupPath "RUTA_DEL_RESPALDO" -ConfirmRestore`.
3. Esperar la validación de la suma SHA-256 y la importación completa.
4. Reiniciar el entorno con `pnpm prod:up`.
5. Iniciar sesión, consultar usuarios, abrir una investigación y descargar un documento para verificar la recuperación.

La restauración reemplaza la información actual. Nunca debe ejecutarse sin un respaldo previo y autorización del responsable institucional.

## 7. Comprobaciones operativas

- `pnpm prod:status`: estado de API, interfaz y MariaDB.
- `pnpm release:check`: pruebas, compilación e integración persistente.
- `GET /api/health`: disponibilidad de API y almacenamiento.
- `.runtime/processes`: bitácoras locales de la API y la interfaz.
- `pnpm db:tables`: tablas disponibles en MariaDB.

## 8. Secuencia de producción prevista

El proxy HTTPS institucional recibe las solicitudes. Las rutas `/api` se envían a Express y el resto sirve la interfaz compilada. Express valida el token y el rol antes de acceder a MariaDB. La base de datos permanece en una red interna y no debe exponerse directamente a Internet. Los respaldos deben cifrarse y almacenarse fuera del servidor principal.

## 9. Entrega institucional pendiente

Antes de declarar el sistema en producción se requieren dominio y certificado, infraestructura autorizada, política de conservación, prueba de restauración, cambio de credenciales, validación de formatos, capacitación, acta de aceptación y autorización del responsable de datos personales.
