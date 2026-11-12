from pathlib import Path
import re

from PIL import Image, ImageDraw, ImageFont
from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from docx.shared import Inches, Pt, RGBColor

SRC = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM.docx")
OUT = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_ACTUALIZADA.docx")
DOCS = Path(r"D:\descargas\sistema_investigaciones_hno\docs")
ASSETS = DOCS / "evidencias_documentacion"
BURGUNDY = "7D173F"
PALE = "F6EEF2"
BORDER = "D9D9D9"
WHITE = "FFFFFF"
BLACK = "000000"


def font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.load_default()


FONT = font(r"C:\Windows\Fonts\times.ttf", 24)
FONT_SMALL = font(r"C:\Windows\Fonts\times.ttf", 19)
FONT_BOLD = font(r"C:\Windows\Fonts\timesbd.ttf", 24)
FONT_TITLE = font(r"C:\Windows\Fonts\timesbd.ttf", 42)


def draw_sequence(title, actors, messages, target):
    width, height = 1800, 1080
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.text((width / 2, 28), title, fill="#21151A", font=FONT_TITLE, anchor="ma")
    left, right, top, bottom = 115, width - 115, 110, height - 100
    step = (right - left) / (len(actors) - 1)
    xs = [left + i * step for i in range(len(actors))]
    for x, actor in zip(xs, actors):
        box_w = 260
        draw.rounded_rectangle((x - box_w / 2, top, x + box_w / 2, top + 68), 14, fill="#86133E", outline="#5F0C2B", width=2)
        draw.text((x, top + 34), actor, fill="white", font=FONT_BOLD, anchor="mm")
        draw.line((x, top + 68, x, bottom), fill="#777777", width=2)
    y = top + 125
    for source, destination, label, response in messages:
        x1, x2 = xs[source], xs[destination]
        color = "#118F87" if response else "#86133E"
        draw.line((x1, y, x2, y), fill=color, width=4)
        direction = 1 if x2 > x1 else -1
        draw.polygon([(x2, y), (x2 - direction * 14, y - 8), (x2 - direction * 14, y + 8)], fill=color)
        wrapped = label if len(label) <= 48 else label[:46] + "..."
        draw.text(((x1 + x2) / 2, y - 15), wrapped, fill="#24191E", font=FONT_SMALL, anchor="ms")
        y += 88
    draw.text((width / 2, height - 42), "Fuente: elaboración propia con base en los servicios implementados.", fill="#555555", font=FONT_SMALL, anchor="mm")
    image.save(target)


draw_sequence(
    "Sprint 6  Dictamen autorización y notificaciones",
    ["Comité", "Interfaz web", "API REST", "MariaDB", "Admin investigador"],
    [
        (0, 1, "Registra evaluación y recomendación", False),
        (1, 2, "PUT /assignments/:id/evaluation", False),
        (2, 3, "Guarda evaluación y completa asignación", False),
        (4, 1, "Consulta el consolidado de la ronda", False),
        (1, 2, "GET /investigations/:id/decision-summary", False),
        (2, 3, "Consulta evaluaciones y dictámenes", False),
        (4, 1, "Registra dictamen y autorización", False),
        (1, 2, "POST committee-decisions y authorize", False),
        (2, 3, "Guarda estado APROBADA y notificación", False),
    ],
    ASSETS / "secuencia_sprint6_actual.png",
)

draw_sequence(
    "Sprint 7  Publicación consulta y reporte",
    ["Admin investigador", "Interfaz web", "API REST", "MariaDB", "Usuario institucional"],
    [
        (0, 1, "Selecciona una investigación aprobada", False),
        (1, 2, "POST /investigations/:id/publish", False),
        (2, 3, "Valida PDF y registra versión activa", False),
        (3, 2, "Publicación y estado PUBLICADA", True),
        (4, 1, "Busca por título o resumen", False),
        (1, 2, "GET /publications?query=", False),
        (2, 3, "Consulta publicaciones activas", False),
        (0, 1, "Solicita indicadores acumulados", False),
        (1, 2, "GET /reports/executive", False),
    ],
    ASSETS / "secuencia_sprint7_actual.png",
)


doc = Document(SRC)


def find_paragraph(prefix):
    return next((p for p in doc.paragraphs if p.text.strip().startswith(prefix)), None)


def set_text(paragraph, text, style=None):
    paragraph.text = text
    if style:
        paragraph.style = doc.styles[style]


def insert_before(anchor, text="", style=None):
    paragraph = doc.add_paragraph(text, style=style)
    anchor._p.addprevious(paragraph._p)
    return paragraph


def set_cell_shading(cell, fill):
    properties = cell._tc.get_or_add_tcPr()
    shading = properties.find(qn("w:shd"))
    if shading is None:
        shading = OxmlElement("w:shd")
        properties.append(shading)
    shading.set(qn("w:fill"), fill)
    shading.set(qn("w:val"), "clear")


def set_run_font(run, size=None, color=None, bold=None):
    run.font.name = "Times New Roman"
    if size:
        run.font.size = Pt(size)
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if bold is not None:
        run.bold = bold
    rpr = run._element.get_or_add_rPr()
    fonts = rpr.rFonts
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        rpr.insert(0, fonts)
    for attr in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(qn("w:" + attr), "Times New Roman")


def format_table(table):
    properties = table._tbl.tblPr
    borders = properties.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        properties.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn("w:" + edge))
        if element is None:
            element = OxmlElement("w:" + edge)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:color"), BORDER)
    for row_index, row in enumerate(table.rows):
        row_properties = row._tr.get_or_add_trPr()
        if row_properties.find(qn("w:cantSplit")) is None:
            row_properties.append(OxmlElement("w:cantSplit"))
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_shading(cell, BURGUNDY if row_index == 0 else (PALE if row_index % 2 == 0 else WHITE))
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_before = Pt(2)
                paragraph.paragraph_format.space_after = Pt(2)
                for run in paragraph.runs:
                    set_run_font(run, 9, WHITE if row_index == 0 else BLACK, row_index == 0)


def replace_figure(caption_prefix, picture_path, width=6.5):
    caption = find_paragraph(caption_prefix)
    if not caption:
        return
    previous = caption._p.getprevious()
    if previous is None:
        return
    previous.getparent().remove(previous)
    paragraph = caption.insert_paragraph_before()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.add_run().add_picture(str(picture_path), width=Inches(width))
    paragraph.paragraph_format.keep_with_next = True


replacements = {
    "Este capítulo documenta la planificación, diseño, desarrollo y pruebas de los ocho Sprints":
        "Este capítulo documenta la planificación de los ocho Sprints del proyecto y el desarrollo técnico verificado de los Sprints 1 al 7, ejecutados en el entorno local con React, Express y MariaDB. Para cada incremento se presentan planificación, historias de usuario, análisis, diseño, estructura del código, pruebas y evidencia. El Sprint 8 se conserva como plan de estabilización, despliegue institucional y entrega, porque su ejecución depende de la infraestructura y aceptación del Hospital de la Niñez Oaxaqueña. El código fuente permanece en el repositorio y no se reproduce íntegramente en este capítulo.",
    "Estado del Sprint: diseño funcional documentado. La implementación completa":
        "Estado del Sprint: incremento implementado y verificado en el entorno local. La API, la interfaz y MariaDB soportan el dictamen por comité, la autorización institucional, el historial de estados y las notificaciones. La aceptación del Product Owner permanece pendiente de la Sprint Review.",
    "El diseño incorpora decisiones_comite":
        "El modelo implementado incorpora dictamenes_comite para conservar una decisión por ronda y comité y notificaciones para la bandeja interna. La autorización se representa mediante el estado APROBADA y una entrada en historial_estados, lo que evita duplicar una fuente de verdad. Las relaciones usan claves foráneas hacia investigación, ronda, comité y usuario. Cada dictamen conserva decisión, observaciones, responsable y fecha; cada notificación registra destinatario, investigación relacionada y condición de lectura.",
    "El integrante de comité dispone de un resumen de su evaluación":
        "El integrante de comité registra puntajes, observaciones y recomendación desde Evaluaciones. El Administrador o Administrador Investigador selecciona una investigación con ronda, consulta el consolidado por comité, registra el dictamen y habilita la autorización cuando todas las decisiones son favorables. El investigador consulta el historial y las notificaciones de sus expedientes sin acceder a identidades individuales protegidas.",
    "Las operaciones de dictamen y autorización deberán ejecutarse":
        "Las operaciones de dictamen y autorización se ejecutan mediante rutas protegidas de la API y transacciones en MariaDB. GET /investigations/:id/decision-summary consolida las evaluaciones; POST /investigations/:id/committee-decisions registra el dictamen; POST /investigations/:id/authorize cambia el expediente a APROBADA; GET /investigations/:id/history devuelve la trazabilidad; y las rutas /notifications permiten consultar y marcar avisos como leídos. El servidor verifica rol, ronda, evaluaciones completadas, dictámenes favorables y PDF vigente antes de autorizar.",
    "Estado del Sprint: planificación, historias, diseño y criterios de prueba documentados":
        "Estado del Sprint: incremento implementado y verificado en el entorno local. El sistema publica el PDF vigente de una investigación aprobada, conserva una sola publicación activa, permite consulta y descarga institucional y genera un reporte ejecutivo. La aceptación del Product Owner permanece pendiente de la Sprint Review.",
    "La publicación referencia el documento vigente que fue objeto de autorización":
        "La publicación se vincula con el documento INVESTIGACION_PDF vigente de una investigación en estado APROBADA. La API desactiva una publicación anterior antes de registrar la nueva versión, cambia el expediente a PUBLICADA y crea historial y notificación. La consulta está protegida por autenticación institucional y devuelve únicamente publicaciones activas, metadatos autorizados y el PDF publicado; no expone anexos ni borradores.",
    "El reporte se compone de encabezado institucional":
        "El reporte ejecutivo implementado presenta fecha de generación, total de investigaciones, investigaciones en revisión, autorizadas y publicadas, además de distribuciones por estado, área y categoría. Los cálculos se realizan en la API a partir de MariaDB. El servicio admite límites de fecha y la interfaz muestra los indicadores acumulados al abrir el módulo.",
    "La vista Publicaciones presenta pestañas para catálogo y administración":
        "La vista Publicaciones integra una cola de investigaciones autorizadas para los perfiles administrativos, un buscador por título o resumen, fichas de publicaciones activas con descarga del PDF y un reporte ejecutivo con indicadores y distribuciones. Los controles de publicación y reporte se muestran únicamente a Administrador y Administrador Investigador; los usuarios autenticados conservan la consulta institucional.",
    "4.8.4 Documentación prevista del código": "4.8.4 Documentación de la estructura del código",
    "4.8.4.1 Estado actual del módulo": "4.8.4.1 Evidencia visual del incremento",
    "Figura 17. Estado actual del módulo del Sprint 7":
        "Figura 18. Módulo implementado del Sprint 7 con publicación, consulta y reporte ejecutivo. Fuente: elaboración propia.",
    "El capítulo documenta el desarrollo de los ocho Sprints mostrados":
        "El capítulo documenta los ocho Sprints mostrados en el cronograma. Los Sprints 1 al 7 cuentan con implementación y verificación técnica en el entorno local; el Sprint 8 permanece como plan de estabilización, instalación institucional, respaldo, manuales y capacitación. Cada Sprint ocupa dos semanas efectivas y conserva el mismo Objetivo del Producto. El receso del 22 de marzo al 2 de abril de 2027 se excluye del cómputo de las dieciséis semanas. El prototipo cubre inicio de sesión, roles y usuarios, operaciones CRUD con baja lógica, proceso institucional trazable y reporte ejecutivo.",
    "Estado del Sprint: plan de estabilización, despliegue y entrega documentado":
        "Estado del Sprint: planificación documentada y pendiente de ejecución institucional. Los Sprints 1 al 7 funcionan localmente; este incremento comprende estabilización final, instalación en infraestructura autorizada, respaldo, manuales, capacitación y aceptación del Hospital de la Niñez Oaxaqueña.",
}

for prefix, text in replacements.items():
    paragraph = find_paragraph(prefix)
    if paragraph:
        set_text(paragraph, text, paragraph.style.name)

paragraph = find_paragraph("4.7.3 Análisis diseño y modelo de datos")
if paragraph:
    set_text(paragraph, "4.7.3 Análisis, diseño y modelo de datos", "Heading 3")
paragraph = find_paragraph("4.7.4.1 Documentación prevista del código y seguridad")
if paragraph:
    set_text(paragraph, "4.7.4.1 Documentación de la estructura del código y seguridad", "Heading 4")

# HU-20 refleja el flujo real: la recomendación del comité precede al dictamen consolidado.
for table in doc.tables:
    flat = " | ".join(cell.text for row in table.rows for cell in row.cells)
    if "Número | HU-20" in flat:
        values = {
            "Usuario": "Administrador o Administrador Investigador",
            "Nombre": "Registrar el dictamen por comité",
            "Descripción": "Como responsable administrativo, quiero consolidar las evaluaciones y registrar el dictamen de cada comité, para sustentar la autorización institucional con evidencia trazable.",
            "Criterios de aceptación": "Todas las asignaciones del comité deben estar completadas; el comité debe pertenecer a la ronda; se conserva un dictamen por comité y ronda con decisión, observaciones, responsable y fecha; una decisión con correcciones o rechazo actualiza el estado y notifica al investigador.",
        }
        for row in table.rows:
            if len(row.cells) >= 2 and row.cells[0].text.strip() in values:
                row.cells[1].text = values[row.cells[0].text.strip()]
    if "HU-20 | Votación y dictamen" in flat:
        for row in table.rows:
            if row.cells[0].text.strip() == "HU-20":
                row.cells[1].text = "Dictamen por comité"
            if row.cells[0].text.strip() == "HU-24":
                row.cells[1].text = "Consulta institucional"
    if any(row.cells[0].text.strip() == "HU-20" for row in table.rows):
        for row in table.rows:
            if row.cells[0].text.strip() == "HU-20" and len(row.cells) > 1:
                row.cells[1].text = "Registrar dictamen por comité"

paragraph = find_paragraph("Tabla 20. Historia de usuario HU-20 Emitir votos y dictamen")
if paragraph:
    set_text(paragraph, "Tabla 20. Historia de usuario HU-20 Registrar dictamen por comité", "Caption")

# HU-27 surgió durante el refinamiento y debe aparecer en el Product Backlog consolidado.
backlog = next((t for t in doc.tables if "HU-01" in " ".join(c.text for r in t.rows for c in r.cells) and "HU-26" in " ".join(c.text for r in t.rows for c in r.cells)), None)
if backlog and not any(row.cells[0].text.strip() == "HU-27" for row in backlog.rows):
    row = backlog.add_row()
    for cell, value in zip(row.cells, ["HU-27", "Reporte ejecutivo", "Alta", "8", "7"]):
        cell.text = value

evaluation_updates = {
    "HU-20": "Aprobada. La prueba automatizada verifica evaluaciones completas, pertenencia del comité, registro del dictamen y permisos.",
    "HU-21": "Aprobada. La API conserva el historial, genera notificaciones y permite marcarlas como leídas.",
    "Ronda con una asignación pendiente": "Aprobada. La API bloquea la autorización cuando faltan dictámenes favorables o el expediente no está En revisión.",
    "Ronda cerrada, evaluaciones completas": "Aprobada en memoria y MariaDB. La investigación cambia a APROBADA y conserva historial y notificación.",
    "Investigación Autorizada con PDF vigente": "Aprobada en memoria y MariaDB. La publicación se vincula al PDF vigente y deja una sola versión activa.",
    "Investigación en revisión o con observaciones": "Aprobada. La API rechaza cualquier publicación cuyo expediente no se encuentre APROBADO.",
    "Publicación activa y usuario con acceso": "Aprobada. La consulta devuelve publicaciones activas y permite descargar exclusivamente el PDF publicado.",
    "Datos de prueba en distintos estados": "Aprobada. El reporte devuelve totales y distribuciones por estado, área y categoría a partir de MariaDB.",
    "Reporte con evaluaciones y revisores": "Aprobada. El reporte excluye contraseñas, observaciones confidenciales e identidad individual de revisores.",
}
for table in doc.tables:
    text = " | ".join(cell.text for row in table.rows for cell in row.cells)
    for marker, result in evaluation_updates.items():
        if marker in text:
            for row in table.rows:
                if row.cells[0].text.strip() == "Evaluación":
                    row.cells[1].text = result

# Nombres de componentes alineados con la implementación actual del Sprint 6.
for table in doc.tables:
    for row in table.rows:
        if len(row.cells) < 2:
            continue
        component = row.cells[0].text.strip()
        if component == "API de votación":
            row.cells[0].text = "Rutas de evaluación y dictamen"
            row.cells[1].text = "Registro de evaluaciones, recomendaciones y dictamen consolidado por comité."
        elif component == "Servicio de dictamen":
            row.cells[0].text = "Servicio de decisión institucional"
            row.cells[1].text = "Consolidación de evaluaciones, autorización, historial de estado y notificaciones."

replace_figure("Figura 15.", ASSETS / "secuencia_sprint6_actual.png")
replace_figure("Figura 16.", ASSETS / "secuencia_sprint7_actual.png")
replace_figure("Figura 18.", DOCS / "evidencia_sprint7_publicaciones_reporte_actual.png")

# Evidencia visual adicional para el incremento real del Sprint 6.
tests_sprint6 = find_paragraph("4.7.5 Pruebas de aceptación")
if tests_sprint6 and not find_paragraph("4.7.4.2 Evidencia visual del incremento"):
    heading = insert_before(tests_sprint6, "4.7.4.2 Evidencia visual del incremento", "Heading 4")
    picture = insert_before(tests_sprint6)
    picture.alignment = WD_ALIGN_PARAGRAPH.CENTER
    picture.add_run().add_picture(str(DOCS / "evidencia_sprint6_dictamen_actual.png"), width=Inches(6.5))
    picture.paragraph_format.keep_with_next = True
    caption = insert_before(tests_sprint6, "Figura 16. Interfaz implementada del Sprint 6 para dictamen y autorización. Fuente: elaboración propia.", "Caption")
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Resultados consolidados posteriores a las pruebas de aceptación del Sprint 7.
review_sprint7 = find_paragraph("4.8.6 Sprint Review y Sprint Retrospective")
if review_sprint7:
    set_text(review_sprint7, "4.8.7 Sprint Review y Sprint Retrospective", "Heading 3")
    results_heading = insert_before(review_sprint7, "4.8.6 Resultados de verificación", "Heading 3")
    results_text = insert_before(review_sprint7, "La verificación técnica del 5 de noviembre de 2026 cubrió el flujo de los Sprints 6 y 7 en el almacén de pruebas y en MariaDB 11.4.10. Se comprobaron dictamen, autorización, notificaciones, historial, publicación versionada, descarga y reporte ejecutivo. La aceptación del Product Owner continúa pendiente y no se confunde con la verificación técnica.")
    caption = insert_before(review_sprint7, "Tabla 27. Resultados técnicos consolidados hasta el Sprint 7", "Caption")
    verification = doc.add_table(rows=6, cols=2)
    verification.cell(0, 0).text = "Verificación"
    verification.cell(0, 1).text = "Resultado"
    rows = [
        ("21 pruebas unitarias y de API", "Aprobadas sin fallos"),
        ("3 pruebas de integración con MariaDB", "Aprobadas sin fallos"),
        ("Flujo persistente de los Sprints 4 a 7", "Aprobado"),
        ("Compilación de producción de React", "Aprobada"),
        ("Revisión visual de los módulos 6 y 7", "Aprobada"),
    ]
    for index, values in enumerate(rows, 1):
        verification.cell(index, 0).text = values[0]
        verification.cell(index, 1).text = values[1]
    review_sprint7._p.addprevious(verification._tbl)
    format_table(verification)

# Actualizar la verificación anterior sin alterar su contexto histórico.
paragraph = find_paragraph("La verificación técnica del 2 de noviembre de 2026 obtuvo 20 pruebas")
if paragraph:
    set_text(paragraph, "La verificación técnica actualizada al 5 de noviembre de 2026 obtuvo 21 pruebas unitarias y de API aprobadas, tres pruebas de integración aprobadas contra MariaDB 11.4.10 y una compilación de producción de React sin errores. El recorrido integral cubre registro, documentos, ronda, permisos, rúbrica, evaluación, correcciones, dictamen, autorización, historial, notificación, publicación y reporte. Estas evidencias demuestran funcionamiento técnico local y no sustituyen la aceptación formal del Product Owner.")
for table in doc.tables:
    if table.cell(0, 0).text.strip() == "Verificación" and any("20 pruebas" in c.text for r in table.rows for c in r.cells):
        for row in table.rows:
            if "20 pruebas" in row.cells[0].text:
                row.cells[0].text = "21 pruebas unitarias y de API"

# Colocar el único encabezado de referencias antes de la primera entrada y quitar duplicados exactos.
references_heading = find_paragraph("REFERENCIAS")
first_reference = find_paragraph("Schwaber, K. y Sutherland, J. (2020). La Guía Scrum")
if references_heading and first_reference:
    references_heading._p.getparent().remove(references_heading._p)
    first_reference._p.addprevious(references_heading._p)
seen = set()
for paragraph in list(doc.paragraphs):
    text = paragraph.text.strip()
    if re.match(r"^[A-ZÁÉÍÓÚÑ][^\n]+\(20\d{2}\)\.", text):
        if text in seen:
            paragraph._p.getparent().remove(paragraph._p)
        else:
            seen.add(text)

# Renumeración coherente de tablas y figuras después de incorporar nuevas evidencias.
figure_number = 0
table_number = 0
for paragraph in doc.paragraphs:
    text = paragraph.text.strip()
    if re.match(r"^Figura(?:\s+\d+)?\.", text, re.I):
        figure_number += 1
        paragraph.text = re.sub(r"^Figura(?:\s+\d+)?\.", f"Figura {figure_number}.", text, flags=re.I)
        paragraph.style = doc.styles["Caption"]
    elif re.match(r"^Tabla(?:\s+\d+)?\.", text, re.I):
        table_number += 1
        paragraph.text = re.sub(r"^Tabla(?:\s+\d+)?\.", f"Tabla {table_number}.", text, flags=re.I)
        paragraph.style = doc.styles["Caption"]

# Formato académico uniforme.
for style in doc.styles:
    if hasattr(style, "font"):
        style.font.name = "Times New Roman"
        if style.name.startswith("Heading") or style.name in ("Title", "Subtitle"):
            style.font.color.rgb = RGBColor(0, 0, 0)
for paragraph in doc.paragraphs:
    if paragraph.style.name.startswith("Heading"):
        paragraph.paragraph_format.keep_with_next = True
    if paragraph.style.name == "Caption":
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        # Las leyendas de tabla preceden al objeto; las de figura lo siguen.
        paragraph.paragraph_format.keep_with_next = paragraph.text.strip().lower().startswith("tabla")
    for run in paragraph.runs:
        set_run_font(run)
for table in doc.tables:
    meaningful = len(table.rows) >= 2 and len(table.columns) >= 2
    if meaningful:
        text = " ".join(cell.text for row in table.rows for cell in row.cells)
        if not ("ACTIVIDADES" in text and "25-29" in text):
            story = len(table.columns) == 2 and any(cell.text.strip() == "Número" for row in table.rows for cell in row.cells)
            if story:
                for row in table.rows:
                    for column, cell in enumerate(row.cells):
                        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                        set_cell_shading(cell, BURGUNDY if column == 0 else WHITE)
                        for paragraph in cell.paragraphs:
                            for run in paragraph.runs:
                                set_run_font(run, 9, WHITE if column == 0 else BLACK, column == 0)
            else:
                format_table(table)
    for row in table.rows:
        for cell in row.cells:
            for paragraph in cell.paragraphs:
                for run in paragraph.runs:
                    set_run_font(run)

doc.core_properties.title = "Documentación final actualizada del sistema de investigaciones científicas del Hospital de la Niñez Oaxaqueña"
doc.core_properties.subject = "Anteproyecto y desarrollo con Scrum sincronizado con la implementación hasta el Sprint 7"
doc.save(OUT)
print(OUT)
