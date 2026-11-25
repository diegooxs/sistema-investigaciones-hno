from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor


SOURCE = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_ENTREGA.docx")
OUTPUT = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_FINAL.docx")


def style_runs(paragraph, size=10.5):
    for run in paragraph.runs:
        run.font.name = "Times New Roman"
        run.font.size = Pt(size)


def replace_paragraph(paragraph, replacements):
    original = paragraph.text
    updated = original
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated != original:
        paragraph.text = updated
        style_runs(paragraph)
        return True
    return False


def replace_cell(cell, replacements, header=False):
    original = cell.text
    updated = original
    for old, new in replacements:
        updated = updated.replace(old, new)
    if updated == original:
        return False
    cell.text = updated
    for paragraph in cell.paragraphs:
        paragraph.paragraph_format.space_after = Pt(2)
        for run in paragraph.runs:
            run.font.name = "Times New Roman"
            run.font.size = Pt(9)
            run.font.color.rgb = RGBColor(255, 255, 255) if header else RGBColor(0, 0, 0)
            run.bold = header
    return True


def add_after(anchor, text):
    paragraph = anchor._parent.add_paragraph(text)
    anchor._p.addnext(paragraph._p)
    style_runs(paragraph)
    return paragraph


doc = Document(SOURCE)

paragraph_replacements = [
    (
        "Este capítulo documenta la planificación de los ocho Sprints del proyecto y el desarrollo técnico verificado de los Sprints 1 al 7, ejecutados en el entorno local con React, Express y MariaDB. Para cada incremento se presentan planificación, historias de usuario, análisis, diseño, estructura del código, pruebas y evidencia. El Sprint 8 se conserva como plan de estabilización, despliegue institucional y entrega, porque su ejecución depende de la infraestructura y aceptación del Hospital de la Niñez Oaxaqueña. El código fuente permanece en el repositorio y no se reproduce íntegramente en este capítulo.",
        "Este capítulo documenta la planificación, diseño, desarrollo, pruebas y cierre técnico de los ocho Sprints previstos en el cronograma del proyecto. Los ocho incrementos fueron implementados y verificados en el entorno local con React, Express y MariaDB; la instalación en infraestructura institucional, la capacitación y la aceptación formal del Hospital de la Niñez Oaxaqueña permanecen como actividades posteriores. Para cada incremento se presentan planificación, historias de usuario, análisis, diseño, estructura del código, pruebas y evidencia. El código fuente completo permanece en el repositorio y no se reproduce íntegramente en este capítulo.",
    ),
    ("21 pruebas unitarias y de API", "22 pruebas unitarias y de API"),
    ("actualizada al 5 de noviembre de 2026", "actualizada al 23 de noviembre de 2026"),
    ("La ejecución técnica local concluyó el 8 de noviembre de 2026.", "La ejecución técnica local se verificó y actualizó el 23 de noviembre de 2026."),
    ("La verificación de cierre se ejecutó el 8 de noviembre de 2026 en Windows", "La verificación de cierre se ejecutó el 23 de noviembre de 2026 en Windows"),
    (
        "La ejecución se organiza en ocho Sprints de dos semanas efectivas.",
        "La ejecución se organiza en ocho Sprints de dos semanas efectivas.",
    ),
    ("carga de cuatro anexos y del PDF hasta las rondas de revisión, evaluación, corrección, votación, autorización y publicación", "carga de cuatro anexos y del PDF hasta las rondas de revisión, evaluación, corrección, dictamen, autorización y publicación"),
    ("establecer las relaciones entre investigaciones, documentos, rondas, evaluaciones, votos y publicaciones", "establecer las relaciones entre investigaciones, documentos, rondas, evaluaciones, dictámenes y publicaciones"),
    ("Gestión de la votación, la aprobación o rechazo y la autorización institucional", "Gestión de dictámenes, aprobación o rechazo y autorización institucional"),
    ("incorporar votación, autorización y notificaciones únicamente en el Sprint 6", "incorporar dictamen administrativo, autorización y notificaciones únicamente en el Sprint 6"),
    ("El alcance no incluye la autorización institucional definitiva, la votación ni la publicación.", "El alcance no incluye la autorización institucional definitiva, el dictamen administrativo ni la publicación."),
    ("votación, historial de estados, notificaciones y autorización institucional", "dictámenes por comité, historial de estados, notificaciones y autorización institucional"),
    ("Los ocho Sprints mostrados en el cronograma.", "Los ocho Sprints mostrados en el cronograma."),
    (
        "Los Sprints 1 al 7 cubren el flujo funcional y el Sprint 8 completa la estabilización técnica local, la validación reproducible, los controles de producción, el respaldo y restauración y los manuales.",
        "Los Sprints 1 al 7 cubren el flujo funcional y el Sprint 8 completa la estabilización técnica local, la validación reproducible, los controles de producción, el registro de solicitudes, el respaldo y restauración y los manuales.",
    ),
]

for paragraph in doc.paragraphs:
    replace_paragraph(paragraph, paragraph_replacements)

table_replacements = [
    ("Sprint 6: votación, historial de estados, notificaciones y autorización institucional.", "Sprint 6: dictámenes por comité, historial de estados, notificaciones y autorización institucional."),
    ("Emitir votos y consolidar decisiones institucionales", "Registrar dictámenes por comité y consolidar la decisión institucional"),
    ("Usuario institucional", "Consulta institucional autorizada"),
    ("usuario institucional", "usuario autenticado con permiso"),
    ("La rúbrica contiene nombre, versión y estado; los criterios incluyen descripción y ponderación; la suma de ponderaciones es válida; una rúbrica usada conserva su versión histórica.", "La rúbrica contiene nombre, versión y estado; admite uno o más criterios, incluido un único criterio con ponderación de 100 %; cada criterio incluye descripción, ponderación y puntaje máximo; una rúbrica usada conserva su versión histórica."),
    ("21 pruebas unitarias y de API", "22 pruebas unitarias y de API"),
]

for table in doc.tables:
    for row_index, row in enumerate(table.rows):
        for cell in row.cells:
            replace_cell(cell, table_replacements, header=row_index == 0)

# Add the current operational logging detail once, in the Sprint 8 code section.
if not any("registro compacto de solicitudes HTTP" in paragraph.text for paragraph in doc.paragraphs):
    anchor = next((p for p in doc.paragraphs if p.text.strip() == "4.9.3.2 Documentación de instalación, operación y código"), None)
    if anchor is not None:
        add_after(anchor, "La API incorpora un registro compacto de solicitudes HTTP para operación local. Al finalizar cada solicitud se registra en la consola el momento, el método (GET, POST, PUT o PATCH), la ruta, el código de respuesta y la duración, sin imprimir contraseñas, cuerpos ni tokens. En la ejecución preparada, la bitácora queda disponible en .runtime\\processes\\api.log.")

# Keep title and body typography consistent after textual replacements.
for paragraph in doc.paragraphs:
    if paragraph.style.name.startswith("Heading") or paragraph.style.name in ("Title", "Subtitle"):
        for run in paragraph.runs:
            run.font.name = "Times New Roman"
    if paragraph.style.name == "Caption":
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.save(OUTPUT)
print(OUTPUT)
