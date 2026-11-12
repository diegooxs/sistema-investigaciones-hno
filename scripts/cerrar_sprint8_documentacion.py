from pathlib import Path
import re

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

SRC = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_ACTUALIZADA.docx")
OUT = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_COMPLETA.docx")
BURGUNDY = "7D173F"
PALE = "F6EEF2"
WHITE = "FFFFFF"
BLACK = "000000"
BORDER = "D9D9D9"

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


def shade(cell, fill):
    props = cell._tc.get_or_add_tcPr()
    element = props.find(qn("w:shd"))
    if element is None:
        element = OxmlElement("w:shd")
        props.append(element)
    element.set(qn("w:fill"), fill)
    element.set(qn("w:val"), "clear")


def set_font(run, size=None, color=None, bold=None):
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
    for name in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(qn("w:" + name), "Times New Roman")


def format_table(table):
    props = table._tbl.tblPr
    borders = props.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        props.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        item = borders.find(qn("w:" + edge))
        if item is None:
            item = OxmlElement("w:" + edge)
            borders.append(item)
        item.set(qn("w:val"), "single")
        item.set(qn("w:sz"), "4")
        item.set(qn("w:color"), BORDER)
    for row_index, row in enumerate(table.rows):
        row_props = row._tr.get_or_add_trPr()
        if row_props.find(qn("w:cantSplit")) is None:
            row_props.append(OxmlElement("w:cantSplit"))
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            shade(cell, BURGUNDY if row_index == 0 else (PALE if row_index % 2 == 0 else WHITE))
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_before = Pt(2)
                paragraph.paragraph_format.space_after = Pt(2)
                for run in paragraph.runs:
                    set_font(run, 9, WHITE if row_index == 0 else BLACK, row_index == 0)


updates = {
    "Estado del Sprint: planificación documentada y pendiente de ejecución institucional":
        "Estado del Sprint: cierre técnico local completado y verificado. La instalación, capacitación y aceptación en infraestructura institucional permanecen pendientes porque requieren coordinación y autorización del Hospital de la Niñez Oaxaqueña.",
    "El Objetivo del Sprint consiste en estabilizar el prototipo":
        "El Objetivo del Sprint consistió en estabilizar el prototipo, comprobar una instalación reproducible, incorporar controles de configuración y seguridad, verificar respaldo y restauración, y completar los manuales técnico y de usuario. La ejecución técnica local concluyó el 8 de noviembre de 2026. La instalación en infraestructura del hospital, la capacitación y el acta de aceptación permanecen como actividades institucionales externas al entorno académico.",
    "El despliegue se organiza en preparación, instalación, configuración":
        "El cierre técnico se ejecutó en preparación, compilación, persistencia, seguridad, respaldo y recuperación. El comando pnpm prod:prepare instaló dependencias con el archivo de bloqueo, ejecutó las pruebas, compiló React y comprobó MariaDB. Los comandos prod:up, prod:status y prod:down preparan la demostración compilada; la API expone una comprobación de salud. La configuración de producción rechaza claves predeterminadas, contraseñas de demostración y orígenes sin HTTPS. El despliegue institucional definitivo deberá ejecutarse en infraestructura autorizada.",
    "La documentación del código se presenta mediante responsabilidades":
        "La estructura de cierre incluye scripts/produccion-local.ps1 para preparación, arranque, estado y detención; scripts/backup-mariadb.ps1 para respaldo y restauración con suma SHA-256; .env.production.example para configuración segura; validación de producción en config.js; encabezados HTTP de seguridad en app.js; y los manuales técnico y de usuario en docs. El código fuente completo permanece en el repositorio y no se reproduce en el capítulo.",
    "La Sprint Review y entrega del incremento están previstas para el 28 de mayo":
        "La Sprint Review académica del incremento puede demostrar la preparación reproducible, autenticación y roles, los dos CRUD lógicos, el proceso completo, el reporte, el respaldo y la restauración. La revisión institucional se mantiene prevista para el 28 de mayo de 2027, con hora por definir con el Product Owner, porque requiere el equipo o servidor definitivo, dominio, certificado HTTPS, credenciales institucionales, capacitación y acta de aceptación.",
    "La Sprint Retrospective final revisa el cumplimiento":
        "La Sprint Retrospective confirmó que el Objetivo del Producto se encuentra cubierto por el prototipo local y que el cierre técnico es repetible. Se corrigió una incompatibilidad de PowerShell detectada al probar el cálculo SHA-256 del respaldo y se volvió a ejecutar exitosamente el ciclo de respaldo y restauración. Como acciones institucionales quedan definir infraestructura, política de conservación, responsables operativos y criterios de aceptación.",
    "El capítulo documenta los ocho Sprints mostrados":
        "El capítulo documenta los ocho Sprints mostrados en el cronograma. Los Sprints 1 al 7 cubren el flujo funcional y el Sprint 8 completa la estabilización técnica local, la validación reproducible, los controles de producción, el respaldo y restauración y los manuales. La instalación, capacitación y aceptación en infraestructura del Hospital de la Niñez Oaxaqueña permanecen pendientes porque requieren recursos y autorización institucionales; esta condición no impide la entrega académica del prototipo.",
    "Figura 20. Evidencia del prototipo integrado":
        "Figura 20. Pantalla representativa del módulo de registro documental utilizada durante la verificación de cierre; la aceptación institucional permanece pendiente.",
}

for prefix, replacement in updates.items():
    paragraph = find_paragraph(prefix)
    if paragraph:
        set_text(paragraph, replacement, paragraph.style.name)

# Actualizar la evidencia de las historias y pruebas del Sprint 8.
for table in doc.tables:
    full = " | ".join(cell.text for row in table.rows for cell in row.cells)
    if "HU-26" in full and "Desplegar, documentar y capacitar" in full:
        for row in table.rows:
            if row.cells[0].text.strip() == "Criterios de aceptación":
                row.cells[1].text = "Se documentaron requisitos, configuración, arranque, respaldo y restauración; se verificaron interfaz, API y MariaDB; los manuales cubren roles y flujo. La instalación y aceptación institucional quedan pendientes del Product Owner."
    if "Caso de despliegue definido para la entrega técnica" in full:
        for row in table.rows:
            if row.cells[0].text.strip() == "Evaluación":
                row.cells[1].text = "Aprobada. pnpm prod:prepare instaló dependencias reproducibles, ejecutó 22 pruebas de API, compiló React y aprobó 3 pruebas con MariaDB."
    if "Caso de continuidad definido" in full:
        for row in table.rows:
            if row.cells[0].text.strip() == "Evaluación":
                row.cells[1].text = "Aprobada. Se generó un respaldo con manifiesto SHA-256 y se restauró correctamente en MariaDB el 8 de noviembre de 2026."
    if "Caso integral preparado para evaluación" in full:
        for row in table.rows:
            if row.cells[0].text.strip() == "Evaluación":
                row.cells[1].text = "Aprobada técnicamente. Las pruebas cubren login, roles, usuarios, investigaciones, flujo institucional, publicación y reporte; la demostración docente permanece programada."
    if "README y manual de instalación" in full and "scripts/mariadb-local.ps1" in full:
        replacements = [
            ("README y manuales", "Requisitos, variables, instalación, operación y acciones por rol."),
            ("scripts/produccion-local.ps1", "Preparación, arranque compilado, estado y detención del entorno local."),
            ("scripts/backup-mariadb.ps1", "Respaldo, manifiesto SHA-256 y restauración confirmada."),
            ("config.js y app.js", "Validación de configuración y encabezados HTTP de seguridad."),
            ("database/schema.sql y migraciones", "Creación reproducible y evolución del modelo MariaDB."),
        ]
        for row, pair in zip(table.rows[1:], replacements):
            row.cells[0].text, row.cells[1].text = pair

# Incorporar resultados verificables antes de la Review del Sprint 8.
review = find_paragraph("4.9.5 Sprint Review")
if review and not find_paragraph("4.9.4.1 Resultados de verificación técnica"):
    insert_before(review, "4.9.4.1 Resultados de verificación técnica", "Heading 4")
    insert_before(review, "La verificación de cierre se ejecutó el 8 de noviembre de 2026 en Windows con Node.js, React, Express y MariaDB 11.4.10. Los resultados siguientes corresponden al entorno local y no sustituyen la aceptación del hospital.")
    insert_before(review, "Tabla 29. Resultados técnicos del Sprint 8", "Caption")
    table = doc.add_table(rows=7, cols=2)
    values = [
        ("Verificación", "Resultado"),
        ("Pruebas unitarias y de API", "22 aprobadas, 0 fallos"),
        ("Integración con MariaDB", "3 aprobadas, 0 fallos"),
        ("Compilación de React", "Aprobada"),
        ("Encabezados y configuración segura", "Aprobados"),
        ("Respaldo con SHA-256", "Generado y validado"),
        ("Restauración de MariaDB", "Ejecutada correctamente"),
    ]
    for row, pair in zip(table.rows, values):
        row.cells[0].text, row.cells[1].text = pair
    review._p.addprevious(table._tbl)
    format_table(table)

# Renumerar las leyendas para conservar una secuencia única.
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
        paragraph.paragraph_format.keep_with_next = paragraph.text.strip().lower().startswith("tabla")
    for run in paragraph.runs:
        set_font(run)

for table in doc.tables:
    text = " ".join(cell.text for row in table.rows for cell in row.cells)
    if len(table.rows) >= 2 and len(table.columns) >= 2 and not ("ACTIVIDADES" in text and "25-29" in text):
        format_table(table)

doc.core_properties.title = "Documentación final del Sistema de Investigaciones Científicas del HNO"
doc.core_properties.subject = "Desarrollo con Scrum y cierre técnico de los ocho Sprints"
doc.save(OUT)
print(OUT)
