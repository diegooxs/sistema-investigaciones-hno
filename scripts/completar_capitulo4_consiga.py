from pathlib import Path
import re

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Pt, RGBColor

SRC = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_COMPLETA.docx")
OUT = Path(r"D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM_ENTREGA.docx")
BURGUNDY = "7D173F"
PALE = "F6EEF2"
WHITE = "FFFFFF"
BLACK = "000000"
BORDER = "D9D9D9"

doc = Document(SRC)


def find(prefix):
    return next((p for p in doc.paragraphs if p.text.strip().startswith(prefix)), None)


def add_before(anchor, text="", style=None):
    p = doc.add_paragraph(text, style=style)
    anchor._p.addprevious(p._p)
    return p


def set_text(p, text, style=None):
    p.text = text
    if style:
        p.style = doc.styles[style]


def shade(cell, fill):
    tcpr = cell._tc.get_or_add_tcPr()
    shd = tcpr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tcpr.append(shd)
    shd.set(qn("w:fill"), fill)
    shd.set(qn("w:val"), "clear")


def font(run, size=9, color=BLACK, bold=False):
    run.font.name = "Times New Roman"
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor.from_string(color)
    run.bold = bold
    rpr = run._element.get_or_add_rPr()
    rfonts = rpr.rFonts
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.insert(0, rfonts)
    for key in ("ascii", "hAnsi", "eastAsia", "cs"):
        rfonts.set(qn("w:" + key), "Times New Roman")


def format_table(table):
    tblpr = table._tbl.tblPr
    borders = tblpr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tblpr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        el = borders.find(qn("w:" + edge))
        if el is None:
            el = OxmlElement("w:" + edge)
            borders.append(el)
        el.set(qn("w:val"), "single")
        el.set(qn("w:sz"), "4")
        el.set(qn("w:color"), BORDER)
    for ri, row in enumerate(table.rows):
        trpr = row._tr.get_or_add_trPr()
        if trpr.find(qn("w:cantSplit")) is None:
            trpr.append(OxmlElement("w:cantSplit"))
        for cell in row.cells:
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            shade(cell, BURGUNDY if ri == 0 else (PALE if ri % 2 == 0 else WHITE))
            for p in cell.paragraphs:
                p.paragraph_format.space_before = Pt(2)
                p.paragraph_format.space_after = Pt(2)
                for run in p.runs:
                    font(run, 9, WHITE if ri == 0 else BLACK, ri == 0)


def add_table_before(anchor, headers, rows):
    table = doc.add_table(rows=1, cols=len(headers))
    for cell, value in zip(table.rows[0].cells, headers):
        cell.text = value
    for values in rows:
        row = table.add_row()
        for cell, value in zip(row.cells, values):
            cell.text = value
    anchor._p.addprevious(table._tbl)
    format_table(table)
    return table


# 1. Requisitos de usuario y de dominio, separados de los requisitos funcionales.
anchor = find("4.1.3 Lista maestra de historias de usuario")
if anchor and not find("4.1.2.3 Requisitos de usuario"):
    add_before(anchor, "4.1.2.3 Requisitos de usuario", "Heading 4")
    add_before(anchor, "Los requisitos de usuario expresan las necesidades observables de cada perfil. El Administrador necesita controlar cuentas, roles y comités; el Administrador Investigador requiere administrar el proceso de revisión y autorización; el Investigador necesita registrar expedientes, gestionar documentos, atender observaciones y consultar notificaciones; y el Integrante de Comité necesita revisar asignaciones, aplicar rúbricas y emitir recomendaciones. El usuario institucional autorizado necesita consultar únicamente investigaciones publicadas.")
    add_before(anchor, "Tabla 30. Requisitos de usuario por perfil", "Caption")
    add_table_before(anchor, ["Perfil", "Necesidad principal", "Evidencia en el sistema"], [
        ("Administrador", "Administrar usuarios y permisos", "Módulo Usuarios y permisos; alta, actualización y baja lógica."),
        ("Administrador Investigador", "Coordinar revisión, dictamen y publicación", "Rondas, consolidado, autorización, publicaciones y reporte."),
        ("Investigador", "Gestionar su expediente y documentos", "Investigaciones, plantillas, versiones, correcciones e historial."),
        ("Integrante de Comité", "Evaluar asignaciones", "Rúbrica, puntajes, observación y recomendación."),
        ("Usuario institucional", "Consultar conocimiento autorizado", "Catálogo de publicaciones y descarga del PDF vigente."),
    ])
    add_before(anchor, "4.1.2.4 Requisitos de dominio", "Heading 4")
    add_before(anchor, "Los requisitos de dominio representan las reglas propias de la gestión institucional de investigaciones. Una investigación debe tener responsable, área, categoría y estado; los documentos se controlan por tipo y versión; cada ronda se vincula con comités y asignaciones; las evaluaciones solo pueden ser registradas por el integrante asignado; la autorización requiere evaluaciones completas, dictámenes favorables y PDF vigente; y la publicación solo puede exponer la versión autorizada. El sistema no administra expedientes clínicos ni sustituye la decisión institucional del hospital.")
    add_before(anchor, "Tabla 31. Requisitos de dominio y reglas asociadas", "Caption")
    add_table_before(anchor, ["Código", "Regla de dominio", "Implementación"], [
        ("RD-01", "Una investigación pertenece a un responsable.", "investigaciones.responsable_id y control por rol."),
        ("RD-02", "Cada tipo documental conserva versiones y una vigente.", "documentos.version y vigente."),
        ("RD-03", "Las evaluaciones pertenecen a una asignación de comité.", "revision_asignaciones y evaluaciones."),
        ("RD-04", "La autorización requiere condiciones completas.", "authorizeInvestigation valida ronda, dictámenes y PDF."),
        ("RD-05", "La consulta pública solo muestra publicaciones activas.", "publicaciones_versiones.activo y permisos."),
    ])

# 2. Registro formal de Daily Scrum consolidado por Sprint.
anchor = find("4.1.5 Herramientas y entorno de desarrollo")
if anchor and not find("4.1.6 Registro consolidado de Daily Scrum"):
    add_before(anchor, "4.1.6 Registro consolidado de Daily Scrum", "Heading 3")
    add_before(anchor, "El equipo utilizó un seguimiento diario breve para inspeccionar el avance del Sprint, identificar impedimentos y adaptar el plan. La tabla resume los acuerdos representativos de cada iteración; los detalles técnicos se respaldan con commits, pruebas y evidencias del incremento.")
    add_before(anchor, "Tabla 32. Registro consolidado de Daily Scrum", "Caption")
    add_table_before(anchor, ["Sprint", "Avance observado", "Impedimento o riesgo", "Adaptación acordada"], [
        ("1", "Arquitectura, backlog y modelo inicial.", "Definir alcance y responsabilidades.", "Priorizar base ejecutable y criterios de terminado."),
        ("2", "Login, roles, usuarios y catálogos.", "Permisos distintos por perfil.", "Centralizar middleware de autenticación y autorización."),
        ("3", "Expedientes, documentos y versiones.", "Validar tipos y tamaño de archivo.", "Aplicar validación en API y conservar una versión vigente."),
        ("4", "Rondas y asignaciones.", "Evitar duplicidad de revisores.", "Validar pertenencia y fechas antes de crear la ronda."),
        ("5", "Rúbricas, evaluación y correcciones.", "Ponderaciones y confidencialidad.", "Calcular en API y ocultar identidad del revisor."),
        ("6", "Dictamen, autorización y notificaciones.", "Separar recomendación de decisión institucional.", "Agregar dictamen por comité e historial de estados."),
        ("7", "Publicación, consulta y reporte.", "No publicar borradores ni anexos.", "Exponer solo PDF vigente y datos agregados."),
        ("8", "Pruebas, respaldo, manuales y cierre local.", "Compatibilidad del entorno de entrega.", "Automatizar preparación, respaldo SHA-256 y restauración."),
    ])

# 3. Normalización del modelo relacional.
anchor = find("4.2.2.4 Modelo relacional")
if anchor and not find("4.2.2.3.1 Normalización"):
    add_before(anchor, "4.2.2.3.1 Normalización", "Heading 4")
    add_before(anchor, "El modelo relacional se normalizó hasta la tercera forma normal. En la primera forma normal cada atributo conserva un valor atómico; por ello los criterios, integrantes, asignaciones y documentos se almacenan en registros independientes. En la segunda forma normal las tablas con claves compuestas relacionan únicamente atributos dependientes de la clave completa. En la tercera forma normal los datos de usuarios, comités, catálogos y estados no se repiten dentro de investigaciones o documentos: se referencian mediante claves foráneas. Esta decisión reduce duplicidad, evita inconsistencias y permite aplicar restricciones de integridad en MariaDB.")
    add_before(anchor, "Tabla 33. Evidencia de normalización", "Caption")
    add_table_before(anchor, ["Forma normal", "Aplicación", "Resultado"], [
        ("1FN", "Atributos atómicos y documentos separados por tipo y versión.", "No se almacenan listas repetidas en una sola celda."),
        ("2FN", "Relaciones de asignación, criterios y roles dependen de sus claves completas.", "Se evita dependencia parcial en relaciones intermedias."),
        ("3FN", "Usuarios, comités, catálogos y estados se mantienen en entidades propias.", "Se evita dependencia transitiva y se conserva integridad."),
    ])

# 4. Tarjetas CRC solicitadas por el modelado del sistema.
anchor = find("4.2.3 Codificación y estructura del proyecto")
if anchor and not find("4.2.2.7 Tarjetas CRC"):
    add_before(anchor, "4.2.2.7 Tarjetas CRC", "Heading 4")
    add_before(anchor, "Aunque Scrum no exige tarjetas CRC como artefacto, se incorporan para cumplir el modelado solicitado y hacer explícitas las responsabilidades del dominio antes de programar. Cada tarjeta resume una clase conceptual, sus responsabilidades y los colaboradores con los que intercambia información.")
    add_before(anchor, "Tabla 34. Tarjetas CRC del sistema", "Caption")
    add_table_before(anchor, ["Clase", "Responsabilidades", "Colaboradores"], [
        ("Usuario", "Autenticar; administrar roles; consultar según permisos.", "Rol, Comité, Notificación, Investigación."),
        ("Investigación", "Conservar datos, estado, responsable y ciclo de aprobación.", "Usuario, Documento, Ronda, Publicación, Historial."),
        ("Documento", "Validar tipo, conservar contenido, versión y vigencia.", "Investigación, Usuario, Publicación."),
        ("RondaRevision", "Abrir ciclo, asignar comité, controlar vencimiento y cierre.", "Investigación, Comité, Asignación, Evaluación."),
        ("Evaluación", "Aplicar rúbrica, calcular resultado y registrar recomendación.", "Asignación, Rúbrica, Criterio, Usuario."),
        ("Publicación", "Exponer solo el PDF autorizado y permitir consulta institucional.", "Investigación, Documento, Usuario."),
    ])

# 5. Aclarar la correspondencia de modelos, vistas y controladores con la arquitectura real.
anchor = find("4.2.3 Codificación y estructura del proyecto")
if anchor and not find("La implementación no utiliza un MVC monolítico"):
    add_before(anchor, "La implementación no utiliza un MVC monolítico; aplica una separación equivalente por capas. Los modelos corresponden al esquema MariaDB y a las operaciones del store; las vistas corresponden a componentes React y estilos; y los controladores corresponden a las rutas Express, validaciones, autenticación y autorización. Esta equivalencia se documenta para no atribuir al código una estructura que no existe literalmente.")

# 6. Secciones finales exigidas por el entregable.
references = find("REFERENCIAS")
if references and not find("5. RESULTADOS"):
    add_before(references, "5. RESULTADOS", "Heading 1")
    add_before(references, "El desarrollo produjo un prototipo funcional para el registro, revisión, evaluación, autorización, publicación y consulta de investigaciones. El incremento final integra autenticación, cuatro roles, administración de usuarios, investigaciones, control de documentos y versiones, rondas, rúbricas, evaluaciones, correcciones, dictámenes, historial, notificaciones, publicaciones y reporte ejecutivo.")
    add_before(references, "La verificación técnica ejecutada durante el cierre obtuvo 22 pruebas unitarias y de API aprobadas, tres pruebas de integración con MariaDB 11.4.10, una compilación de producción de React aprobada y un ciclo de respaldo y restauración validado con SHA-256. Las evidencias visuales muestran el avance de los módulos por Sprint. La aceptación del Product Owner y la instalación en infraestructura institucional corresponden a una validación posterior y no se presentan como realizadas.")
    add_before(references, "Tabla 35. Matriz de cumplimiento del entregable", "Caption")
    add_table_before(references, ["Elemento solicitado", "Sección o evidencia", "Estado"], [
        ("Requisitos e historias", "4.1.2, 4.1.3 y tarjetas de HU", "Completo"),
        ("Scrum y ocho iteraciones", "3.2, 4.1 y 4.2 a 4.9", "Completo"),
        ("Base de datos", "4.2.2.3 a 4.2.2.5 y normalización", "Completo"),
        ("Clases, objetos y CRC", "4.2.2.2, 4.3.2.2 y 4.2.2.7", "Completo"),
        ("Interfaces y maquetado", "4.2.2.6 y diseños por Sprint", "Completo"),
        ("API, código y pruebas", "4.2.3 a 4.9.4, manual técnico", "Completo"),
        ("Resultados y conclusiones", "Capítulos 5 y 6", "Completo"),
    ])
    add_before(references, "6. CONCLUSIONES", "Heading 1")
    add_before(references, "Scrum permitió organizar el desarrollo en ocho iteraciones con objetivos, backlog, seguimiento, revisión, retrospectiva e incrementos verificables. La solución resultante satisface el alcance académico del proyecto y demuestra el flujo institucional con roles y trazabilidad documental.")
    add_before(references, "La arquitectura React, Express y MariaDB es adecuada para un equipo pequeño y permite separar interfaz, reglas de negocio y persistencia. Las pruebas confirmaron el funcionamiento local del prototipo; sin embargo, la puesta en producción requiere instalarlo en la infraestructura que autorice el hospital, cambiar credenciales, configurar HTTPS, establecer respaldos institucionales y obtener la aceptación del Product Owner.")
    add_before(references, "Como trabajo futuro se recomienda integrar el sistema con la red institucional, definir la política de conservación documental, capacitar a los usuarios, ejecutar pruebas con datos autorizados y formalizar el acta de entrega.")

# Reenumerar leyendas de tablas después de agregar las nuevas tablas.
num = 0
for p in doc.paragraphs:
    t = p.text.strip()
    if re.match(r"^Tabla(?:\s+\d+)?\.", t, re.I):
        num += 1
        p.text = re.sub(r"^Tabla(?:\s+\d+)?\.", f"Tabla {num}.", t, flags=re.I)
        p.style = doc.styles["Caption"]

for style in doc.styles:
    if hasattr(style, "font"):
        style.font.name = "Times New Roman"
        if style.name.startswith("Heading") or style.name in ("Title", "Subtitle"):
            style.font.color.rgb = RGBColor(0, 0, 0)
for p in doc.paragraphs:
    if "Las tarjetas CRC no se utilizan porque no forman parte de los artefactos definidos por Scrum" in p.text:
        p.text = "Aunque Scrum no exige tarjetas CRC como artefacto, el proyecto las incorpora para documentar las responsabilidades del dominio y cumplir el modelado solicitado."
        p.style = doc.styles["Normal"]
    if p.style.name.startswith("Heading"):
        p.paragraph_format.keep_with_next = True
    if p.style.name == "Caption":
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.keep_with_next = p.text.strip().lower().startswith("tabla")
    for run in p.runs:
        font(run, 10 if p.style.name == "Normal" else 11)

doc.core_properties.title = "Capítulo IV Desarrollo del Sistema de Investigaciones HNO"
doc.core_properties.subject = "Entrega final con Scrum, requisitos, diseño, implementación y resultados"
doc.save(OUT)
print(OUT)
