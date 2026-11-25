from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

OUT = Path(r"D:\descargas")
BURGUNDY = "7D173F"
PALE = "F6EEF2"
GRAY = "D9D9D9"


def shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = tcPr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tcPr.append(shd)
    shd.set(qn("w:fill"), fill)


def borders(table):
    tblPr = table._tbl.tblPr
    border = tblPr.first_child_found_in("w:tblBorders")
    if border is None:
        border = OxmlElement("w:tblBorders")
        tblPr.append(border)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = "w:" + edge
        el = border.find(qn(tag))
        if el is None:
            el = OxmlElement(tag)
            border.append(el)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), GRAY)


def set_cell(cell, text, header=False):
    cell.text = str(text)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    if header:
        shade(cell, BURGUNDY)
    else:
        shade(cell, PALE if cell._tc.getparent().index(cell._tc) % 2 else "FFFFFF")
    for p in cell.paragraphs:
        p.paragraph_format.space_after = Pt(2)
        for run in p.runs:
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(255,255,255) if header else RGBColor(0,0,0)
            run.bold = header


def add_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.style = "Table Grid"
    borders(table)
    for i, h in enumerate(headers):
        set_cell(table.rows[0].cells[i], h, True)
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            set_cell(cells[i], value, False)
    if widths:
        for row in table.rows:
            for i, width in enumerate(widths):
                row.cells[i].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def configure(doc, title):
    sec = doc.sections[0]
    sec.top_margin = Inches(0.75)
    sec.bottom_margin = Inches(0.7)
    sec.left_margin = Inches(0.85)
    sec.right_margin = Inches(0.85)
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Times New Roman"
    normal.font.size = Pt(10.5)
    normal.paragraph_format.line_spacing = 1.08
    normal.paragraph_format.space_after = Pt(6)
    for name, size in [("Title", 20), ("Heading 1", 15), ("Heading 2", 12.5), ("Heading 3", 11.5)]:
        st = styles[name]
        st.font.name = "Times New Roman"
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = RGBColor(0,0,0)
        st.paragraph_format.keep_with_next = True
    title_pr = styles["Title"]._element.get_or_add_pPr()
    title_bdr = title_pr.find(qn("w:pBdr"))
    if title_bdr is not None:
        title_pr.remove(title_bdr)
    header = sec.header.paragraphs[0]
    header.text = "HOSPITAL DE LA NIÑEZ OAXAQUEÑA  |  SISTEMA DE INVESTIGACIONES"
    header.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in header.runs:
        run.font.name = "Times New Roman"
        run.font.size = Pt(8)
        run.font.color.rgb = RGBColor(125,23,63)
        run.bold = True
    footer = sec.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = footer.add_run("Documento de apoyo del prototipo | 2027")
    run.font.name = "Times New Roman"
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(90,90,90)
    p = doc.add_paragraph(style="Title")
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run(title)
    pPr = p._p.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is not None:
        pPr.remove(pBdr)
    p2 = doc.add_paragraph()
    p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p2.add_run("Sistema web para la administración, evaluación, revisión, publicación y consulta de investigaciones científicas")
    r.font.name = "Times New Roman"; r.font.size = Pt(11); r.italic = True
    doc.add_paragraph()


def bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.add_run(text)
    return p


def numbered(doc, text):
    p = doc.add_paragraph(style="List Number")
    p.add_run(text)
    return p


def build_user():
    doc = Document(); configure(doc, "Manual de usuario")
    doc.add_heading("1. Propósito y alcance", 1)
    doc.add_paragraph("Este manual explica cómo utilizar el prototipo del Sistema de Investigaciones Científicas del Hospital de la Niñez Oaxaqueña. Está dirigido a administradores, administradores investigadores, investigadores e integrantes de comité; también describe la consulta institucional autorizada. Describe el acceso, las funciones disponibles por rol, el flujo completo del expediente y las acciones de atención de incidencias.")
    doc.add_paragraph("La interfaz muestra únicamente las opciones permitidas por el rol autenticado. Los nombres de los botones pueden variar ligeramente según el tamaño de la pantalla, pero las reglas de operación son las mismas.")

    doc.add_heading("2. Acceso al sistema", 1)
    doc.add_paragraph("Para una demostración local, el administrador proporciona la dirección de la interfaz. En el entorno de desarrollo se utiliza http://localhost:5173 y en la ejecución preparada para entrega local se utiliza http://127.0.0.1:4173.")
    numbered(doc, "Abra la dirección indicada en un navegador actualizado.")
    numbered(doc, "Escriba el correo institucional y la contraseña.")
    numbered(doc, "Seleccione Continuar.")
    numbered(doc, "Confirme que el panel lateral muestre únicamente los módulos autorizados.")
    numbered(doc, "Para salir, seleccione Cerrar sesión.")
    add_table(doc, ["Resultado", "Interpretación"], [
        ("Acceso concedido", "Las credenciales son válidas y se carga el panel del rol."),
        ("Credenciales inválidas", "El sistema rechaza el acceso sin revelar información sensible."),
        ("Sesión vencida", "Debe volver a autenticarse antes de continuar."),
    ], [2.0, 4.6])

    doc.add_heading("3. Roles y permisos", 1)
    add_table(doc, ["Rol", "Funciones principales", "Restricciones"], [
        ("Administrador", "Usuarios, roles, activación, contraseñas, consulta global, controles administrativos y reportes.", "No debe sustituir la revisión científica del comité."),
        ("Administrador Investigador", "Responsables, comités, rondas, revisores, rúbricas, dictámenes, autorización, publicación y reportes.", "No administra las cuentas generales."),
        ("Investigador", "Investigaciones propias, formatos, anexos, PDF principal, versiones, correcciones, historial y notificaciones.", "No autoriza su propio expediente ni conoce revisores individuales."),
        ("Integrante de comité", "Consulta asignaciones, visualiza PDF, descarga documentos, registra puntajes, observaciones y recomendación.", "Solo accede a expedientes asignados; no modifica expedientes ni autoriza publicaciones."),
        ("Consulta institucional autorizada", "Consulta investigaciones publicadas y documentos autorizados mediante un perfil autenticado con permiso.", "No ve borradores, revisores, observaciones confidenciales ni versiones anteriores; no es un quinto rol independiente."),
    ], [1.35,3.4,2.0])

    doc.add_heading("4. Flujo completo de una investigación", 1)
    steps = [
        "El Administrador registra las cuentas y asigna los roles.",
        "El Investigador crea un expediente y captura título, área, categoría, resumen y responsable.",
        "El Investigador guarda el expediente como borrador.",
        "Descarga los formatos de apoyo Anexo A, Anexo E, Anexo G y Anexo I.",
        "Carga los anexos y el PDF principal; el sistema valida extensiones y conserva versiones.",
        "El Administrador Investigador asigna responsable, comité, integrantes y fechas de revisión.",
        "Los integrantes evalúan con la rúbrica y registran observaciones y recomendación.",
        "El Investigador atiende correcciones, carga la nueva versión y reenvía el expediente cuando la ronda lo solicita.",
        "El Administrador Investigador consulta el consolidado, registra el dictamen y autoriza cuando se cumplen las reglas.",
        "Se publica únicamente el PDF vigente autorizado y los usuarios institucionales consultan la publicación.",
        "El personal autorizado consulta el reporte ejecutivo y el historial de eventos.",
    ]
    for s in steps: numbered(doc, s)

    doc.add_heading("5. Operación por módulo", 1)
    doc.add_heading("5.1 Panel general", 2)
    doc.add_paragraph("Muestra el estado general del sistema: investigaciones registradas, borradores, documentos vigentes, expedientes con avance documental y el alcance del Sprint implementado.")
    doc.add_heading("5.2 Investigaciones", 2)
    doc.add_paragraph("Permite registrar, buscar, filtrar y consultar expedientes. En el detalle se visualizan los datos de la investigación, el responsable, el estado, los documentos y el historial de versiones.")
    doc.add_heading("5.3 Documentos y versiones", 2)
    doc.add_paragraph("El PDF principal solo acepta formato PDF. Los anexos aceptan PDF, DOC, DOCX, RTF u ODT. Cada carga registra nombre, tipo, tamaño, responsable y fecha. El sistema conserva antecedentes y marca una sola versión vigente por tipo documental.")
    doc.add_heading("5.4 Revisiones y evaluaciones", 2)
    doc.add_paragraph("Las revisiones se organizan por rondas. El integrante de comité consulta los documentos de su asignación, puede abrir la vista previa de los PDF o descargarlos, utiliza la rúbrica vigente, captura criterios, observaciones y recomendación. Las observaciones confidenciales no se muestran al usuario institucional.")
    doc.add_paragraph("Una rúbrica puede tener un solo criterio con peso 100 % o varios criterios cuya suma sea 100 %.")
    doc.add_heading("5.5 Publicaciones y reportes", 2)
    doc.add_paragraph("La publicación requiere autorización. La consulta institucional muestra únicamente publicaciones activas. El reporte ejecutivo permite observar cantidades y estados conforme a los filtros disponibles.")

    doc.add_heading("6. Validaciones y mensajes frecuentes", 1)
    add_table(doc, ["Situación", "Qué debe hacer el usuario"], [
        ("No se puede iniciar sesión", "Verifique correo, contraseña y disponibilidad de la API. No repita intentos continuamente."),
        ("Archivo rechazado", "Confirme que el PDF principal sea PDF y que el anexo tenga una extensión permitida."),
        ("No aparece una investigación", "Revise el rol, el responsable asignado, los filtros y el estado del expediente."),
        ("Sesión vencida", "Regrese al acceso e inicie sesión nuevamente."),
        ("Error de MariaDB", "Informe al administrador; no intente restaurar ni modificar la base de datos desde la interfaz."),
    ], [2.2,4.4])

    doc.add_heading("7. Recomendaciones de uso", 1)
    bullet(doc, "No comparta contraseñas ni deje sesiones abiertas en equipos compartidos.")
    bullet(doc, "Revise nombre, formato y contenido antes de cargar un documento.")
    bullet(doc, "No cargue varias veces el mismo archivo si la interfaz todavía está procesando la operación.")
    bullet(doc, "Use las observaciones y correcciones para mantener la trazabilidad del expediente.")
    bullet(doc, "Confirme que el PDF vigente sea el documento autorizado antes de publicar.")
    doc.add_heading("8. Criterios de aceptación del flujo", 1)
    add_table(doc, ["Prueba", "Resultado esperado"], [
        ("Login válido e inválido", "Acceso correcto o rechazo controlado."),
        ("Alta de usuario", "El administrador registra y asigna un rol."),
        ("Alta de investigación", "Se crea un borrador con responsable."),
        ("Carga y versión", "Se conserva el historial y una sola versión queda vigente."),
        ("Revisión y corrección", "El comité evalúa y el investigador puede reenviar."),
        ("Autorización y publicación", "Solo se publica el PDF vigente autorizado."),
        ("Consulta y reporte", "Los datos visibles corresponden al rol y a los filtros."),
    ], [2.2,4.4])
    doc.save(OUT / "MANUAL_USUARIO_HNO.docx")


def build_tech():
    doc = Document(); configure(doc, "Manual técnico")
    doc.add_heading("1. Propósito y alcance", 1)
    doc.add_paragraph("Este manual describe la instalación, configuración, ejecución, verificación, respaldo, restauración y operación del prototipo del Sistema de Investigaciones Científicas del Hospital de la Niñez Oaxaqueña. Está dirigido a la persona responsable de preparar el entorno local o institucional y no sustituye la política de seguridad, conservación documental o protección de datos del hospital.")

    doc.add_heading("2. Arquitectura de referencia", 1)
    add_table(doc, ["Componente", "Tecnología y responsabilidad"], [
        ("Interfaz", "React y Vite. Presenta vistas, navegación, formularios, permisos visuales y descarga de documentos."),
        ("API", "Node.js y Express. Expone rutas REST, autenticación, autorización, validaciones, reglas de negocio y registro compacto de solicitudes."),
        ("Persistencia", "MariaDB Server 11.4.10. Conserva usuarios, investigaciones, documentos, versiones, revisiones, evaluaciones, publicaciones y notificaciones."),
        ("Archivos de operación", "La API almacena el contenido documental en la base de datos como datos binarios; el respaldo SQL incluye los blobs."),
        ("Ejecución", "pnpm administra scripts; Vite sirve desarrollo o compilación; los scripts PowerShell preparan el entorno local."),
    ], [1.5,5.1])
    doc.add_paragraph("La implementación separa interfaz, rutas de API, reglas de negocio y persistencia. No debe describirse como un MVC monolítico; la separación por capas cumple una función equivalente para este prototipo.")

    doc.add_heading("3. Requisitos del entorno", 1)
    bullet(doc, "Windows 10 u 11 de 64 bits para la preparación local documentada.")
    bullet(doc, "Node.js LTS y pnpm 11.19.0.")
    bullet(doc, "4 GB de memoria disponible y al menos 5 GB de almacenamiento libre.")
    bullet(doc, "PowerShell con permiso para ejecutar scripts del proyecto.")
    bullet(doc, "Acceso a los puertos locales de la interfaz, API y MariaDB.")
    bullet(doc, "Para producción: servidor autorizado, dominio, HTTPS, estrategia de respaldos y credenciales institucionales.")

    doc.add_heading("4. Instalación y preparación local", 1)
    for s in [
        "Copie el proyecto a una ruta estable, por ejemplo D:\\sistema_investigaciones_hno.",
        "Abra PowerShell en la raíz del proyecto.",
        "Instale dependencias con pnpm install.",
        "Copie .env.example como .env y revise las variables de conexión.",
        "Inicie MariaDB con pnpm db:up.",
        "Compruebe el estado con pnpm db:status y las tablas con pnpm db:tables.",
        "Ejecute pnpm prod:prepare para instalar, probar, compilar y validar la integración.",
    ]: numbered(doc, s)
    doc.add_paragraph("La instalación portátil incluida por el proyecto no requiere registrar MariaDB como servicio de Windows. La alternativa compose.yaml puede utilizarse si el equipo cuenta con Docker Desktop.")

    doc.add_heading("5. Ejecución para desarrollo", 1)
    add_table(doc, ["Terminal", "Comando", "Resultado"], [
        ("1", "pnpm db:up", "Inicia MariaDB y aplica el esquema y los datos iniciales."),
        ("1", "pnpm dev:api", "Levanta Express en http://localhost:3001."),
        ("2", "pnpm dev:web", "Levanta Vite, normalmente en http://localhost:5173."),
        ("3", "pnpm check", "Ejecuta pruebas de API y compilación de React."),
        ("3", "pnpm test:db", "Ejecuta pruebas contra MariaDB real."),
    ], [0.8,2.2,3.6])
    doc.add_paragraph("Si aparece EADDRINUSE, ya existe otro proceso usando el puerto. Cierre la instancia anterior o reutilícela; no inicie múltiples APIs o interfaces para la misma demostración.")

    doc.add_heading("6. Ejecución preparada para entrega local", 1)
    numbered(doc, "Ejecute pnpm prod:prepare.")
    numbered(doc, "Ejecute pnpm prod:up.")
    numbered(doc, "Compruebe el estado con pnpm prod:status.")
    numbered(doc, "Abra http://127.0.0.1:4173.")
    numbered(doc, "Al terminar, ejecute pnpm prod:down.")

    doc.add_heading("7. Variables de configuración", 1)
    doc.add_paragraph("Use .env.production.example como referencia y cree un archivo privado para cada ambiente. Nunca publique el archivo .env ni las credenciales en GitHub.")
    add_table(doc, ["Variable", "Uso", "Recomendación"], [
        ("NODE_ENV", "Define el ambiente.", "production en el servidor institucional."),
        ("JWT_SECRET", "Firma tokens de sesión.", "Cadena aleatoria de al menos 32 caracteres."),
        ("WEB_ORIGIN", "Origen permitido por CORS.", "En producción debe usar HTTPS."),
        ("DB_HOST / DB_PORT", "Ubicación de MariaDB.", "No exponer el puerto a Internet."),
        ("DB_NAME", "Base hno_investigaciones.", "Mantener consistente con el esquema."),
        ("DB_USER / DB_PASSWORD", "Cuenta de aplicación.", "Usar una cuenta exclusiva, no root."),
    ], [1.4,2.7,2.5])

    doc.add_heading("8. Verificación técnica", 1)
    for s in [
        "pnpm check: 22 pruebas de API y compilación de la interfaz.",
        "pnpm test:db: pruebas de persistencia contra MariaDB.",
        "GET /api/health: disponibilidad de API y almacenamiento.",
        "pnpm db:status: estado del servidor MariaDB local.",
        "pnpm db:tables: tablas creadas y disponibles.",
        "pnpm release:check: validación integral previa a entrega.",
    ]: bullet(doc, s)
    doc.add_paragraph("La verificación debe ejecutarse después de cada cambio que afecte autenticación, permisos, documentos, estados o consultas.")
    doc.add_paragraph("Durante el desarrollo, la API registra en la consola la fecha y hora, el método HTTP, la ruta, el código de respuesta y la duración de cada solicitud. No se imprimen contraseñas, cuerpos ni tokens. En la ejecución preparada, la bitácora se conserva en .runtime\\processes\\api.log.")

    doc.add_heading("9. Respaldo", 1)
    numbered(doc, "Confirme que no exista una operación administrativa en curso.")
    numbered(doc, "Ejecute pnpm db:backup.")
    numbered(doc, "Verifique que se haya creado backups\\AAAAMMdd-HHmmss.")
    numbered(doc, "Confirme la presencia de hno_investigaciones.sql y manifest.json.")
    numbered(doc, "Copie la carpeta a un medio protegido distinto del equipo principal.")
    doc.add_paragraph("El manifiesto incluye una suma SHA-256. El respaldo contiene usuarios, investigaciones, documentos, versiones, evaluaciones, dictámenes, publicaciones y notificaciones porque los documentos se almacenan en MariaDB.")

    doc.add_heading("10. Restauración", 1)
    numbered(doc, "Detenga el acceso de usuarios y realice un respaldo preventivo.")
    numbered(doc, 'Ejecute pnpm db:restore -- -BackupPath "RUTA_DEL_RESPALDO" -ConfirmRestore.')
    numbered(doc, "Espere la validación SHA-256 y la importación completa.")
    numbered(doc, "Reinicie con pnpm prod:up y revise pnpm prod:status.")
    numbered(doc, "Pruebe login, consulta de usuarios, apertura de una investigación y descarga de un documento.")
    doc.add_paragraph("La restauración reemplaza los datos actuales. Requiere autorización del responsable institucional y no debe ejecutarse como una acción rutinaria de usuario.")

    doc.add_heading("11. Seguridad y operación en producción", 1)
    bullet(doc, "Usar HTTPS y un dominio institucional.")
    bullet(doc, "Mantener MariaDB en red interna, sin exposición directa a Internet.")
    bullet(doc, "Cambiar todas las credenciales de demostración.")
    bullet(doc, "Usar un JWT_SECRET aleatorio y privado.")
    bullet(doc, "Configurar respaldos cifrados y pruebas periódicas de restauración.")
    bullet(doc, "Restringir el acceso administrativo y registrar incidencias.")
    bullet(doc, "Definir política de conservación documental y protección de datos personales.")
    doc.add_paragraph("La configuración de producción debe ser aprobada por el hospital antes de publicar el sistema. El prototipo local no equivale a una puesta en producción institucional.")

    doc.add_heading("12. Diagnóstico de incidencias", 1)
    add_table(doc, ["Síntoma", "Comprobación", "Acción"], [
        ("pnpm no se reconoce", "Ejecute pnpm --version.", "Instale pnpm 11.19.0 y reinicie la terminal."),
        ("API no conecta con MariaDB", "Ejecute pnpm db:status y revise .env.", "Inicie MariaDB con pnpm db:up y valide credenciales."),
        ("EADDRINUSE", "Revise si otro proceso ocupa 3001 o 5173.", "Cierre la instancia duplicada o reutilice el proceso activo."),
        ("CORS bloqueado", "Compare WEB_ORIGIN con la URL del navegador.", "Ajuste el origen permitido y reinicie la API."),
        ("500 en una ruta", "Consulte la salida de la API y /api/health.", "Verifique MariaDB, esquema y variables; no borre datos."),
    ], [1.5,2.4,2.7])

    doc.add_heading("13. Lista de entrega técnica", 1)
    for s in [
        "Dependencias instaladas y versiones registradas.",
        "MariaDB iniciado y esquema verificado.",
        "Pruebas de API, integración y compilación aprobadas.",
        "Variables de producción reemplazadas y protegidas.",
        "Respaldo generado y restauración probada.",
        "Manual de usuario entregado junto con este manual.",
        "Dominio, HTTPS, política de datos, capacitación y acta de aceptación pendientes de autorización institucional.",
    ]: bullet(doc, s)
    doc.save(OUT / "MANUAL_TECNICO_HNO.docx")


if __name__ == "__main__":
    build_user(); build_tech()
    print(OUT / "MANUAL_USUARIO_HNO.docx")
    print(OUT / "MANUAL_TECNICO_HNO.docx")
