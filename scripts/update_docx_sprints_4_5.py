from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


SOURCE = Path(r"D:\descargas\anteproyecto_Scrum_capitulo_IV_sprints_1_2_y_3_MariaDB_corregido(1).docx")
OUTPUT = Path(r"D:\descargas\anteproyecto_Scrum_capitulo_IV_completo_sprints_1_a_8_MariaDB.docx")

WINE = "8D173C"
PALE = "F7F0F3"
LIGHT = "F4F4F4"
BORDER = "D9D9D9"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=100, start=120, bottom=100, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:color"), BORDER)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    header = OxmlElement("w:tblHeader")
    header.set(qn("w:val"), "true")
    tr_pr.append(header)


def format_table(table, widths=None, header=True):
    table.autofit = False
    set_table_borders(table)
    if header:
        set_repeat_table_header(table.rows[0])
    for row_index, row in enumerate(table.rows):
        for column_index, cell in enumerate(row.cells):
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if widths and column_index < len(widths):
                cell.width = Inches(widths[column_index])
            if row_index == 0 and header:
                set_cell_shading(cell, WINE)
            elif row_index % 2 == 0:
                set_cell_shading(cell, LIGHT)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.05
                for run in paragraph.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)
                    if row_index == 0 and header:
                        run.font.bold = True
                        run.font.color.rgb = RGBColor(255, 255, 255)


def add_paragraph(anchor, text="", style="Normal", bold_lead=None):
    paragraph = anchor.insert_paragraph_before(style=style)
    paragraph.paragraph_format.space_after = Pt(6)
    paragraph.paragraph_format.line_spacing = 1.15
    if bold_lead and text.startswith(bold_lead):
        paragraph.add_run(bold_lead).bold = True
        paragraph.add_run(text[len(bold_lead):])
    else:
        paragraph.add_run(text)
    return paragraph


def add_heading(anchor, text, level, page_break=False):
    paragraph = anchor.insert_paragraph_before(style=f"Heading {level}")
    if page_break:
        paragraph.paragraph_format.page_break_before = True
    paragraph.paragraph_format.keep_with_next = True
    paragraph.add_run(text)
    return paragraph


def move_table_before(anchor, table):
    anchor._p.addprevious(table._tbl)


def add_table(anchor, headers, rows, widths):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Normal Table"
    for index, header in enumerate(headers):
        table.rows[0].cells[index].text = header
    for values in rows:
        cells = table.add_row().cells
        for index, value in enumerate(values):
            cells[index].text = str(value)
    format_table(table, widths=widths, header=True)
    move_table_before(anchor, table)
    add_paragraph(anchor, "")
    return table


def add_test_card(anchor, code, title, story, conditions, steps, expected, evaluation, page_break=False):
    heading = add_heading(anchor, f"{code} {title}", 4)
    if page_break:
        heading.paragraph_format.page_break_before = True
    table = doc.add_table(rows=0, cols=2)
    table.style = "Normal Table"
    values = [
        ("Historia relacionada", story),
        ("Condiciones de ejecución", conditions),
        ("Pasos", steps),
        ("Resultado esperado", expected),
        ("Evaluación", evaluation),
    ]
    for row_index, (label, value) in enumerate(values):
        cells = table.add_row().cells
        cells[0].text = label
        cells[1].text = value
        set_cell_shading(cells[0], PALE)
        for cell in cells:
            set_cell_margins(cell, top=110, bottom=110)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.1
                for run in paragraph.runs:
                    run.font.name = "Arial"
                    run.font.size = Pt(9)
        cells[0].paragraphs[0].runs[0].bold = True
    table.autofit = False
    for row in table.rows:
        row.cells[0].width = Inches(1.55)
        row.cells[1].width = Inches(4.85)
    set_table_borders(table)
    move_table_before(anchor, table)
    add_paragraph(anchor, "")


doc = Document(SOURCE)

anchor = next(p for p in doc.paragraphs if p.text.strip() == "4.5 Correspondencia con el cronograma")
sources_heading = next(p for p in doc.paragraphs if p.text.strip() == "4.6 Fuentes oficiales consultadas")
anchor.text = "4.11 Correspondencia con el cronograma"
anchor.style = "Heading 2"
anchor.paragraph_format.page_break_before = True
anchor.paragraph_format.left_indent = Inches(0)
anchor.paragraph_format.first_line_indent = Inches(0)
anchor.paragraph_format.keep_with_next = True
sources_heading.text = "4.12 Fuentes oficiales consultadas"
sources_heading.style = "Heading 2"

for paragraph in doc.paragraphs:
    if paragraph.text.startswith("El capítulo prepara y documenta el alcance técnico de los tres primeros"):
        paragraph.text = (
            "El capítulo documenta el desarrollo de los ocho Sprints mostrados en el cronograma. Cada Sprint ocupa dos semanas "
            "efectivas y conserva el mismo Objetivo del Producto. El receso del 22 de marzo al 2 de abril de 2027 se excluye del "
            "cómputo de las dieciséis semanas. El cierre integra la evidencia solicitada para el prototipo: inicio de sesión, "
            "roles y usuarios, dos operaciones CRUD con baja lógica, un proceso institucional trazable y un reporte ejecutivo."
        )
        break

add_heading(anchor, "4.5 Sprint 4 Rondas de revisión y asignaciones", 2, page_break=True)
add_heading(anchor, "4.5.1 Sprint Planning", 3)
add_paragraph(
    anchor,
    "El Objetivo del Sprint consiste en establecer un mecanismo trazable para abrir una ronda de revisión, asignar integrantes de los comités y consultar responsables, estados y vencimientos. El Sprint corresponde a las semanas 7 y 8, del 8 al 19 de marzo de 2027. Se seleccionaron 13 puntos del Product Backlog, distribuidos entre HU-15 y HU-16. La capacidad se definió para dos Developers durante diez días hábiles. El Daily Scrum se realizará en un máximo de quince minutos para inspeccionar el avance, el trabajo siguiente y los impedimentos.",
)
add_table(
    anchor,
    ["ID", "Elemento seleccionado", "Prioridad", "Puntos", "Evidencia del incremento"],
    [
        ["HU-15", "Crear rondas y asignar revisores", "Alta", "8", "Formulario de apertura, comités y asignaciones persistentes"],
        ["HU-16", "Consultar asignaciones y vencimientos", "Alta", "5", "Bandeja por rol, fecha límite, estado y avance"],
    ],
    [0.6, 2.2, 0.75, 0.6, 2.35],
)
add_paragraph(
    anchor,
    "La Definición de Terminado exige que la función opere desde la interfaz, aplique permisos en la API, persista en MariaDB, disponga de validaciones de negocio, incluya pruebas automatizadas y pueda demostrarse sin errores de compilación. La aceptación institucional permanece sujeta a la Sprint Review con el Product Owner.",
)

add_heading(anchor, "4.5.2 Historias de usuario", 3)
add_heading(anchor, "4.5.2.1 HU-15 Crear rondas y asignar revisores", 4)
add_paragraph(anchor, "Como Administrador o Administrador Investigador, quiero abrir una ronda y asignar integrantes de los comités, para distribuir formalmente la revisión de un expediente completo.")
add_paragraph(anchor, "Criterios de aceptación: la investigación debe permanecer en borrador; los anexos A, E, G e I y el PDF deben encontrarse vigentes; la fecha límite debe ser futura; cada asignación debe corresponder a un usuario activo con rol Comité e integrante del comité seleccionado; no se permiten duplicados; al abrir la ronda, la investigación cambia a En revisión y se registra el historial.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.5.2.2 HU-16 Consultar asignaciones y vencimientos", 4)
add_paragraph(anchor, "Como integrante de comité, quiero consultar únicamente las revisiones que me fueron asignadas, para conocer el expediente, el comité, la fecha límite y el estado del trabajo.")
add_paragraph(anchor, "Criterios de aceptación: el integrante ve solamente sus asignaciones; el investigador conoce el avance agregado sin identidad individual del revisor; los perfiles administrativos visualizan el detalle completo; una asignación puede pasar de Pendiente a En proceso; una asignación completada no puede reabrirse manualmente.", bold_lead="Criterios de aceptación:")

add_heading(anchor, "4.5.3 Análisis, diseño y maquetado", 3)
add_heading(anchor, "4.5.3.1 Flujo de la ronda", 4)
add_paragraph(anchor, "El flujo comienza cuando el responsable administrativo selecciona un expediente en borrador. La API verifica la integración documental antes de crear la ronda, con lo que evita remitir expedientes incompletos. Después se eligen integrantes a partir de la relación entre usuarios y comités y se define una fecha límite. La apertura genera la ronda, sus asignaciones y el historial dentro de una sola transacción.")
add_table(
    anchor,
    ["Paso", "Responsable", "Acción", "Resultado"],
    [
        ["1", "Administrador", "Selecciona expediente y vencimiento", "Solicitud preparada"],
        ["2", "API", "Valida documentos, roles y pertenencia", "Expediente apto o mensaje de faltantes"],
        ["3", "MariaDB", "Crea ronda, asignaciones e historial", "Información persistente y consistente"],
        ["4", "Integrante de comité", "Consulta e inicia su asignación", "Seguimiento En proceso"],
    ],
    [0.55, 1.25, 2.55, 2.15],
)
add_heading(anchor, "4.5.3.2 Maquetado del módulo", 4)
add_paragraph(anchor, "La pantalla Revisiones contiene el encabezado del Sprint, el formulario para seleccionar investigación y vencimiento, el selector de integrantes agrupados por comité, el directorio de pertenencia y el panel de seguimiento. Cada ronda muestra estado, fecha límite, barra de avance y detalle permitido por el rol. En pantallas pequeñas los grupos se presentan en una sola columna.")

add_heading(anchor, "4.5.4 Codificación y persistencia", 3)
add_paragraph(anchor, "La API incorpora operaciones para listar revisores, actualizar integrantes, listar y consultar rondas, abrir una ronda y marcar una asignación como En proceso. La autorización se aplica en el servidor: solamente Administrador y Administrador Investigador abren rondas o cambian integrantes. En MariaDB se utilizan usuarios, roles, comités, integrantes, investigaciones, documentos, rondas, asignaciones e historial de estados. La transacción impide que una falla produzca una ronda incompleta.")

add_heading(anchor, "4.5.5 Pruebas de aceptación", 3)
add_test_card(anchor, "PA-22", "Apertura de una ronda completa", "HU-15", "Sesión administrativa, expediente en borrador, cinco tipos documentales vigentes e integrante activo.", "1. Abrir Revisiones. 2. Seleccionar el expediente. 3. Definir una fecha futura. 4. Seleccionar al integrante. 5. Pulsar Abrir ronda.", "Se crea la ronda número 1, la asignación queda Pendiente, la investigación cambia a En revisión y se registra el historial.", "Prueba técnica aprobada en memoria y MariaDB. Aceptación del Product Owner pendiente.")
add_test_card(anchor, "PA-23", "Rechazo de expediente incompleto", "HU-15", "Sesión administrativa e investigación sin todos los documentos requeridos.", "1. Seleccionar el expediente. 2. Definir fecha y revisor. 3. Intentar abrir la ronda.", "No se crea la ronda y el sistema informa cuáles documentos faltan.", "Validación de servicio aprobada. Aceptación del Product Owner pendiente.")
add_test_card(anchor, "PA-24", "Visibilidad por rol", "HU-16", "Ronda con revisor asignado y cuentas de Administrador, Investigador y Comité.", "1. Consultar la ronda con cada perfil. 2. Comparar la información presentada.", "El administrador ve el detalle; el comité solo su asignación; el investigador observa avance agregado sin identidad individual.", "Prueba de autorización aprobada. Aceptación del Product Owner pendiente.")
add_test_card(anchor, "PA-25", "Inicio de una revisión", "HU-16", "Integrante autenticado y asignación Pendiente.", "1. Abrir Revisiones. 2. Localizar la asignación. 3. Pulsar Iniciar revisión.", "La asignación cambia a En proceso y la ronda a En evaluación; una completada no puede reabrirse.", "Prueba técnica aprobada. Aceptación del Product Owner pendiente.")

add_heading(anchor, "4.5.6 Sprint Review y Sprint Retrospective", 3)
add_paragraph(anchor, "La Sprint Review está prevista para el 19 de marzo de 2027, con hora por definir con el Product Owner. Se demostrarán la integración documental obligatoria, apertura de ronda, asignación por comité, bandeja del revisor y restricciones por rol. El Product Owner deberá confirmar si los comités y plazos representan el proceso real del hospital.")
sprint4_retro = add_paragraph(anchor, "En la Sprint Retrospective se acordó conservar las reglas críticas en el servidor, ejecutar de forma transaccional la creación de rondas y mantener separada la identidad del revisor frente al investigador. Para el Sprint 5 se decidió calcular la calificación en la API y versionar las rúbricas para proteger el historial.")
sprint4_retro.paragraph_format.keep_together = True

add_heading(anchor, "4.6 Sprint 5 Rúbricas evaluaciones y correcciones", 2)
add_heading(anchor, "4.6.1 Sprint Planning", 3)
add_paragraph(anchor, "El Objetivo del Sprint consiste en permitir que cada comité evalúe una asignación mediante criterios ponderados, registre observaciones y solicite correcciones que generen nuevas versiones documentales y una nueva ronda. El Sprint corresponde a las semanas 9 y 10 efectivas, del 5 al 16 de abril de 2027, después del receso académico del 22 de marzo al 2 de abril. Se seleccionaron HU-17, HU-18 y HU-19, con 24 puntos estimados.")
add_table(
    anchor,
    ["ID", "Elemento seleccionado", "Prioridad", "Puntos", "Evidencia del incremento"],
    [
        ["HU-17", "Configurar rúbricas y criterios", "Alta", "8", "Rúbrica versionada y ponderaciones"],
        ["HU-18", "Evaluar y registrar observaciones", "Alta", "8", "Captura por asignación y cálculo en API"],
        ["HU-19", "Atender correcciones y nuevas versiones", "Alta", "8", "Correcciones y nueva ronda trazable"],
    ],
    [0.6, 2.2, 0.75, 0.6, 2.35],
)
add_paragraph(anchor, "El alcance no incluye la autorización institucional definitiva, la votación ni la publicación. Esas decisiones pertenecen a los Sprints 6 y 7. Una recomendación favorable mantiene el expediente En revisión; una recomendación con correcciones o no favorable lo coloca Con observaciones, sin convertirla en aprobación o rechazo definitivo.")

add_heading(anchor, "4.6.2 Historias de usuario", 3)
add_heading(anchor, "4.6.2.1 HU-17 Configurar rúbricas y criterios", 4)
add_paragraph(anchor, "Como responsable administrativo, quiero crear una rúbrica para cada comité, para que las evaluaciones utilicen criterios y ponderaciones comunes.")
add_paragraph(anchor, "Criterios de aceptación: la rúbrica pertenece a un comité activo; contiene al menos dos criterios; cada criterio tiene descripción, ponderación y puntaje máximo; las ponderaciones suman 100%; una versión nueva desactiva la anterior sin borrarla; el integrante consulta solamente las rúbricas de sus comités.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.6.2.2 HU-18 Evaluar y registrar observaciones", 4)
add_paragraph(anchor, "Como integrante de comité, quiero asignar puntajes y una recomendación a mi revisión, para comunicar un resultado verificable al responsable de la investigación.")
add_paragraph(anchor, "Criterios de aceptación: solo evalúa el integrante asignado; se usa una rúbrica activa del mismo comité; todos los criterios reciben un puntaje válido; la API calcula la calificación; se guarda la recomendación y observación; la asignación cambia a Completada; el investigador recibe la observación sin identidad individual del revisor.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.6.2.3 HU-19 Atender correcciones y nuevas versiones", 4)
add_paragraph(anchor, "Como investigador responsable, quiero cargar versiones corregidas y reenviar el expediente, para responder a las observaciones sin perder el historial previo.")
add_paragraph(anchor, "Criterios de aceptación: el expediente Con observaciones permite edición y carga; la versión anterior permanece almacenada; se exige una versión mayor a uno; la ronda anterior se cierra; la nueva ronda incrementa el número, conserva asignaciones y establece un plazo de catorce días; el expediente vuelve a En revisión.", bold_lead="Criterios de aceptación:")

add_heading(anchor, "4.6.3 Análisis diseño y modelo de datos", 3)
add_heading(anchor, "4.6.3.1 Cálculo ponderado", 4)
add_paragraph(anchor, "La API calcula la evaluación. Para cada criterio divide el puntaje obtenido entre el puntaje máximo y multiplica el resultado por la ponderación. La suma produce una calificación entre cero y cien. De esta manera, el navegador no puede enviar una calificación final distinta del detalle registrado.")
formula = add_paragraph(anchor, "calificación = suma de ((puntaje obtenido / puntaje máximo) por ponderación)")
formula.alignment = WD_ALIGN_PARAGRAPH.CENTER
formula.runs[0].italic = True
add_heading(anchor, "4.6.3.2 Extensión del modelo relacional", 4)
add_paragraph(anchor, "Se agregó evaluacion_criterios para relacionar cada evaluación con los criterios y puntajes utilizados. Esto evita guardar una calificación sin evidencia y permite reconstruir el resultado aun cuando se cree una versión posterior de la rúbrica.")
add_table(
    anchor,
    ["Entidad", "Relación", "Finalidad"],
    [
        ["comites", "uno a muchos con rubricas", "Separar criterios por órgano revisor"],
        ["rubricas", "uno a muchos con criterios_rubrica", "Versionar instrumentos de evaluación"],
        ["asignaciones_revision", "uno a cero o uno con evaluaciones", "Conservar una evaluación por asignación"],
        ["evaluaciones", "uno a muchos con evaluacion_criterios", "Guardar el desglose de puntajes"],
        ["investigaciones", "uno a muchos con documentos y rondas", "Mantener versiones y reenvíos"],
    ],
    [1.55, 2.2, 2.75],
)
add_heading(anchor, "4.6.3.3 Maquetado por rol", 4)
add_paragraph(anchor, "El administrador dispone del formulario de rúbrica, contador de ponderación y editor dinámico de criterios. El integrante de comité recibe una bandeja de asignaciones, selector de rúbrica, campos de puntaje, recomendación y observación. El equipo de investigación consulta resultados agrupados por ronda y comité; cuando el expediente está Con observaciones se muestra la instrucción para cargar correcciones y la acción Enviar correcciones.")

add_heading(anchor, "4.6.4 Codificación y reglas de negocio", 3)
add_paragraph(anchor, "La API permite listar y crear rúbricas, consultar o guardar la evaluación de una asignación, consultar observaciones por investigación y reenviar correcciones. La migración 002_sprints_4_5.sql crea de forma idempotente el detalle de puntajes. Las reglas centrales comprenden ponderación total de 100%, puntajes dentro de límites, evaluación exclusiva del revisor asignado, recomendaciones válidas, confidencialidad del revisor, persistencia de versiones y creación transaccional de la ronda de corrección.")

add_heading(anchor, "4.6.5 Pruebas de aceptación", 3)
add_test_card(anchor, "PA-26", "Ponderación de la rúbrica", "HU-17", "Sesión administrativa y comité activo.", "1. Capturar dos criterios. 2. Usar una suma distinta de 100%. 3. Intentar guardar. 4. Corregir la suma y guardar.", "La primera solicitud se rechaza; la segunda crea una versión activa y conserva la anterior inactiva.", "Prueba técnica aprobada. Aceptación del Product Owner pendiente.")
add_test_card(anchor, "PA-27", "Cálculo ponderado", "HU-18", "Asignación activa y rúbrica con criterios de 40% y 60%, ambos con máximo de 10.", "1. Registrar puntajes de 8 y 9. 2. Seleccionar Con correcciones. 3. Escribir observación. 4. Guardar.", "La API calcula 86 puntos, guarda el detalle, completa la asignación y cambia el expediente a Con observaciones.", "Prueba aprobada en memoria y MariaDB. Aceptación del Product Owner pendiente.")
add_test_card(anchor, "PA-28", "Protección por responsable", "HU-18", "Asignación perteneciente a un integrante y una segunda cuenta autenticada.", "1. Intentar evaluar con la segunda cuenta. 2. Repetir con el integrante asignado.", "El primer intento se rechaza; el segundo permite guardar.", "Autorización del servidor aprobada. Aceptación del Product Owner pendiente.")
add_test_card(anchor, "PA-29", "Consulta confidencial", "HU-18", "Evaluación completada e investigador responsable autenticado.", "1. Abrir Evaluaciones. 2. Seleccionar la investigación. 3. Revisar calificación, comité, criterios y observación.", "Se muestra el resultado sin nombre, correo ni identificador del revisor individual.", "Prueba técnica aprobada. Aceptación del Product Owner pendiente.", page_break=True)
add_test_card(anchor, "PA-30", "Reenvío de correcciones", "HU-19", "Investigación Con observaciones y ronda previa con asignaciones.", "1. Reenviar sin nueva versión. 2. Cargar una corrección. 3. Pulsar Enviar correcciones.", "El primer intento se rechaza; después se cierra la ronda anterior, se crea la siguiente y el expediente vuelve a En revisión.", "Prueba aprobada en memoria y MariaDB. Aceptación del Product Owner pendiente.")

add_heading(anchor, "4.6.6 Resultados de verificación", 3)
add_paragraph(anchor, "La verificación técnica del 2 de noviembre de 2026 obtuvo 20 pruebas unitarias y de API aprobadas, tres pruebas de integración aprobadas contra MariaDB 11.4.10 y una compilación de producción de React sin errores. La prueba integral cubre registro, cinco documentos obligatorios, ronda, permisos, rúbrica, evaluación, consulta confidencial, nueva versión y reenvío. Estas evidencias no sustituyen la aceptación formal del Product Owner.")
add_table(
    anchor,
    ["Verificación", "Resultado"],
    [
        ["20 pruebas unitarias y de API", "Aprobada"],
        ["3 pruebas de integración con MariaDB", "Aprobada"],
        ["Persistencia del detalle por criterio", "Aprobada"],
        ["Compilación de producción de React", "Aprobada"],
        ["Revisión visual de Administrador y Comité", "Aprobada"],
        ["Aceptación institucional del incremento", "Pendiente de Sprint Review"],
    ],
    [4.55, 1.95],
)

add_heading(anchor, "4.6.7 Sprint Review y Sprint Retrospective", 3)
add_paragraph(anchor, "La Sprint Review está prevista para el 16 de abril de 2027, con hora por definir con el Product Owner. La demostración incluirá creación de rúbrica, rechazo de ponderaciones inválidas, captura de puntajes, cálculo automático, consulta de observaciones, carga de una corrección y apertura de la ronda siguiente. El Product Owner deberá confirmar los criterios reales y la terminología de las recomendaciones.")
add_paragraph(anchor, "En la Sprint Retrospective se comprobó que las reglas compartidas entre pruebas y persistencia reducen inconsistencias, que el cálculo no debe depender de la interfaz y que las correcciones deben conservar antecedentes. Se acordó no interpretar una recomendación como dictamen institucional e incorporar votación, autorización y notificaciones únicamente en el Sprint 6.")

add_heading(anchor, "4.7 Sprint 6 Dictamen autorización y notificaciones", 2, page_break=True)
add_heading(anchor, "4.7.1 Sprint Planning", 3)
add_paragraph(anchor, "El Objetivo del Sprint consiste en consolidar los resultados emitidos por los comités, registrar el dictamen institucional, conservar el historial de estados y comunicar los cambios a los participantes autorizados. El Sprint corresponde a las semanas 11 y 12, del 19 al 30 de abril de 2027. Se seleccionaron HU-20, HU-21 y HU-22, con 21 puntos estimados.")
add_table(
    anchor,
    ["ID", "Elemento seleccionado", "Prioridad", "Puntos", "Evidencia del incremento"],
    [
        ["HU-20", "Emitir votos y dictamen", "Alta", "8", "Consolidado por comité y resultado trazable"],
        ["HU-21", "Consultar historial y notificaciones", "Alta", "8", "Línea de tiempo y bandeja de avisos"],
        ["HU-22", "Autorizar una investigación", "Alta", "5", "Autorización controlada y cambio de estado"],
    ],
    [0.6, 2.2, 0.75, 0.6, 2.35],
)
add_paragraph(anchor, "La autorización no se deduce únicamente de una calificación. El prototipo exige que las asignaciones estén completadas, que cada comité cuente con un resultado y que un perfil administrativo registre la decisión institucional. La política definitiva de firmas, quórum y responsables deberá confirmarse con el Product Owner antes del despliegue laboral.")

add_heading(anchor, "4.7.2 Historias de usuario", 3)
add_heading(anchor, "4.7.2.1 HU-20 Emitir votos y dictamen", 4)
add_paragraph(anchor, "Como integrante autorizado de comité, quiero registrar la decisión de mi órgano revisor, para que el expediente disponga de un resultado consolidado y verificable.")
add_paragraph(anchor, "Criterios de aceptación: solo se admite una decisión vigente por comité y ronda; la decisión debe ser Favorable, Favorable con condiciones o No favorable; se requiere una evaluación completada; toda modificación conserva autor, fecha y motivo; el consolidado no revela datos innecesarios del revisor al investigador.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.7.2.2 HU-21 Consultar historial y notificaciones", 4)
add_paragraph(anchor, "Como participante del proceso, quiero consultar los cambios que me corresponden y recibir avisos dentro del sistema, para conocer acciones pendientes y decisiones sin depender de mensajes externos.")
add_paragraph(anchor, "Criterios de aceptación: cada transición registra estado anterior, estado nuevo, responsable, fecha y motivo; las notificaciones se generan por asignación, observación, corrección, autorización y publicación; el destinatario puede marcar un aviso como leído; los permisos limitan la consulta al expediente relacionado.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.7.2.3 HU-22 Autorizar una investigación", 4)
add_paragraph(anchor, "Como Administrador Investigador, quiero registrar la autorización institucional cuando el expediente cumpla las condiciones, para permitir su publicación sin omitir la trazabilidad de la decisión.")
add_paragraph(anchor, "Criterios de aceptación: la ronda debe estar cerrada y todas las asignaciones completadas; no deben existir correcciones pendientes; el sistema muestra el consolidado antes de confirmar; se exige motivo y responsable; la transición queda en el historial; una investigación autorizada no puede regresar a borrador mediante la interfaz.", bold_lead="Criterios de aceptación:")

add_heading(anchor, "4.7.3 Análisis diseño y modelo de datos", 3)
add_heading(anchor, "4.7.3.1 Flujo de decisión institucional", 4)
add_paragraph(anchor, "El proceso separa evaluación técnica, decisión del comité y autorización institucional. Esta separación evita que una calificación individual se interprete como autorización automática. Cuando concluyen las asignaciones, el sistema genera un consolidado. Si existen condiciones, el expediente regresa a correcciones; si todas las decisiones son favorables, el perfil autorizado puede registrar la aprobación institucional.")
add_table(
    anchor,
    ["Etapa", "Entrada", "Regla principal", "Salida"],
    [
        ["Evaluación", "Rúbrica y observación", "Solo el revisor asignado", "Resultado individual"],
        ["Dictamen de comité", "Evaluaciones completadas", "Una decisión vigente por comité", "Resultado colegiado"],
        ["Consolidación", "Resultados de los comités", "Sin pendientes ni duplicados", "Resumen institucional"],
        ["Autorización", "Consolidado favorable", "Confirmación administrativa y motivo", "Estado Autorizada"],
    ],
    [1.25, 1.65, 2.35, 1.25],
)
add_heading(anchor, "4.7.3.2 Extensión del modelo relacional", 4)
add_paragraph(anchor, "El diseño incorpora decisiones_comite para conservar el resultado por ronda y comité, autorizaciones para registrar la decisión institucional y notificaciones para la bandeja interna. historial_estados permanece como fuente cronológica de las transiciones. Las relaciones utilizan claves foráneas hacia investigación, ronda, comité y usuario, y evitan el borrado en cascada de evidencia institucional.")
add_heading(anchor, "4.7.3.3 Maquetado por rol", 4)
add_paragraph(anchor, "El integrante de comité dispone de un resumen de su evaluación y del formulario de decisión. El Administrador Investigador visualiza el consolidado, los requisitos pendientes y la acción Autorizar. El investigador consulta la línea de tiempo y las notificaciones relacionadas con su expediente, sin acceder a identidades individuales protegidas.")

add_heading(anchor, "4.7.4 Reglas de negocio y seguridad", 3)
add_paragraph(anchor, "Las operaciones de dictamen y autorización se validan en la API y se ejecutan dentro de transacciones. El servidor comprueba rol, pertenencia al comité, estado de la ronda, evaluaciones completas y ausencia de correcciones pendientes. Cada cambio genera historial y notificaciones. No se envían contraseñas, hashes ni datos de otros expedientes en las respuestas.")

add_heading(anchor, "4.7.5 Pruebas de aceptación", 3)
add_test_card(anchor, "PA-31", "Registro de dictamen por comité", "HU-20", "Ronda cerrable, evaluación completada e integrante autorizado.", "1. Abrir la asignación. 2. Revisar el resultado. 3. Seleccionar la decisión. 4. Confirmar.", "Se conserva una decisión vigente con comité, ronda, responsable y fecha; un usuario ajeno recibe acceso denegado.", "Prueba funcional del prototipo definida. Validación del Product Owner pendiente.")
add_test_card(anchor, "PA-32", "Historial y notificación de cambio", "HU-21", "Expediente con transición de estado y destinatarios relacionados.", "1. Cambiar el estado. 2. Abrir la línea de tiempo. 3. Ingresar con el destinatario. 4. Marcar el aviso como leído.", "El historial muestra la transición y el destinatario recibe un aviso que puede consultar y marcar como leído.", "Prueba funcional del prototipo definida. Validación institucional pendiente.")
add_test_card(anchor, "PA-33", "Bloqueo de autorización incompleta", "HU-22", "Ronda con una asignación pendiente o decisión condicionada.", "1. Abrir el consolidado. 2. Intentar autorizar. 3. Consultar el motivo del rechazo.", "La autorización no se registra y el sistema identifica los requisitos pendientes.", "Regla de negocio verificada en el diseño de aceptación.")
add_test_card(anchor, "PA-34", "Autorización con expediente completo", "HU-22", "Ronda cerrada, evaluaciones completas y decisiones favorables.", "1. Revisar el consolidado. 2. Capturar el motivo. 3. Confirmar la autorización.", "La investigación cambia a Autorizada, se registra el responsable y se generan historial y notificación.", "Prueba integral del proceso definida. Aceptación del Product Owner pendiente.", page_break=True)

add_heading(anchor, "4.7.6 Sprint Review y Sprint Retrospective", 3)
add_paragraph(anchor, "La Sprint Review está prevista para el 30 de abril de 2027, con hora por definir con el Product Owner. La demostración cubrirá decisión por comité, consolidado, bloqueo de expedientes incompletos, autorización, línea de tiempo y notificaciones. La revisión institucional deberá confirmar los responsables reales y el valor jurídico o administrativo del dictamen digital.")
add_paragraph(anchor, "En la Sprint Retrospective se concluyó que la separación entre evaluación, dictamen y autorización reduce ambigüedades y facilita la auditoría. Para el Sprint 7 se acordó publicar únicamente la versión documental autorizada, conservar el acceso público separado del administrativo e incorporar el reporte solicitado para la demostración de la Unidad 4.")

add_heading(anchor, "4.8 Sprint 7 Publicación consulta reporte y aceptación", 2, page_break=True)
add_heading(anchor, "4.8.1 Refinamiento del Product Backlog y Sprint Planning", 3)
add_paragraph(anchor, "El Objetivo del Sprint consiste en publicar la versión autorizada, habilitar la consulta institucional, generar un reporte ejecutivo y ejecutar las pruebas de aceptación del flujo completo. El Sprint corresponde a las semanas 13 y 14, del 3 al 14 de mayo de 2027. Se seleccionaron HU-23, HU-24, HU-25 y HU-27, con 29 puntos estimados.")
add_paragraph(anchor, "Durante el refinamiento se incorporó HU-27 Generar un reporte ejecutivo. La historia responde al requisito académico del prototipo para la Unidad 4 y no cambia el Objetivo del Producto, porque resume información ya perteneciente al proceso de administración, evaluación y publicación.")
add_table(
    anchor,
    ["ID", "Elemento seleccionado", "Prioridad", "Puntos", "Evidencia del incremento"],
    [
        ["HU-23", "Publicar una versión autorizada", "Alta", "8", "Registro de publicación y documento vigente"],
        ["HU-24", "Consultar investigaciones publicadas", "Media", "5", "Catálogo con filtros y ficha de consulta"],
        ["HU-25", "Ejecutar aceptación e integración", "Alta", "8", "Matriz de casos y recorrido completo"],
        ["HU-27", "Generar reporte ejecutivo", "Alta", "8", "Resumen filtrable y exportable"],
    ],
    [0.6, 2.2, 0.75, 0.6, 2.35],
)

add_heading(anchor, "4.8.2 Historias de usuario", 3)
add_heading(anchor, "4.8.2.1 HU-23 Publicar una versión autorizada", 4)
add_paragraph(anchor, "Como Administrador Investigador, quiero publicar el documento autorizado, para que la institución consulte la versión correcta sin exponer borradores ni anexos restringidos.")
add_paragraph(anchor, "Criterios de aceptación: la investigación debe estar Autorizada; solo se publica el PDF vigente de la investigación; se registra responsable y fecha; no se permiten dos publicaciones activas de la misma investigación; una sustitución conserva el antecedente; los anexos de apoyo permanecen protegidos.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.8.2.2 HU-24 Consultar investigaciones publicadas", 4)
add_paragraph(anchor, "Como usuario institucional, quiero buscar investigaciones publicadas por título, área, categoría y fecha, para localizar conocimiento autorizado del hospital.")
add_paragraph(anchor, "Criterios de aceptación: la consulta muestra solamente publicaciones activas; dispone de búsqueda y filtros; la ficha presenta título, resumen, área, categoría y fecha; la descarga corresponde al PDF publicado; la consulta no revela observaciones, votos ni datos personales de revisores.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.8.2.3 HU-25 Ejecutar pruebas de aceptación e integración", 4)
add_paragraph(anchor, "Como equipo Scrum, quiero recorrer el proceso completo con datos de prueba, para identificar fallas de integración antes de la entrega del prototipo.")
add_paragraph(anchor, "Criterios de aceptación: se prueban autenticación, permisos, CRUD lógico de usuarios, CRUD lógico de investigaciones, documentos, revisión, evaluación, correcciones, autorización, publicación y consulta; cada caso registra resultado esperado, resultado obtenido y estado; las incidencias críticas se corrigen antes del cierre.", bold_lead="Criterios de aceptación:")
add_heading(anchor, "4.8.2.4 HU-27 Generar reporte ejecutivo", 4)
add_paragraph(anchor, "Como responsable administrativo, quiero generar un reporte resumido por periodo, estado, área y categoría, para supervisar el avance de las investigaciones y presentar resultados verificables.")
add_paragraph(anchor, "Criterios de aceptación: el reporte respeta los filtros seleccionados; incluye totales por estado, investigaciones por área, expedientes con revisiones pendientes y publicaciones realizadas; muestra fecha de generación; puede imprimirse o exportarse; no incluye contraseñas, observaciones confidenciales ni identidad individual de revisores.", bold_lead="Criterios de aceptación:")

add_heading(anchor, "4.8.3 Análisis diseño y maquetado", 3)
add_heading(anchor, "4.8.3.1 Publicación segura", 4)
add_paragraph(anchor, "La publicación referencia el documento vigente que fue objeto de autorización. La aplicación no duplica el contenido ni permite seleccionar un archivo arbitrario. El catálogo de consulta utiliza una respuesta limitada y separada de los servicios administrativos, con lo que reduce la exposición accidental de información reservada.")
add_heading(anchor, "4.8.3.2 Diseño del reporte", 4)
add_paragraph(anchor, "El reporte se compone de encabezado institucional, periodo consultado, filtros aplicados, indicadores globales, distribución por estado y detalle resumido. Las cifras se calculan en la API a partir de MariaDB para evitar diferencias entre la pantalla y la exportación. La vista de impresión omite navegación y conserva título, fecha y responsable de generación.")
add_table(
    anchor,
    ["Bloque del reporte", "Contenido", "Finalidad"],
    [
        ["Identificación", "Institución, periodo, filtros y fecha", "Contextualizar la consulta"],
        ["Indicadores", "Totales por estado y pendientes", "Presentar situación general"],
        ["Distribución", "Área, categoría y periodo", "Comparar concentración de expedientes"],
        ["Detalle", "Folio, título, responsable, estado y actualización", "Permitir seguimiento"],
        ["Control", "Usuario que genera y número de registros", "Conservar trazabilidad"],
    ],
    [1.4, 2.7, 2.4],
)
add_heading(anchor, "4.8.3.3 Maquetado del módulo Publicaciones y Reportes", 4)
add_paragraph(anchor, "La vista Publicaciones presenta pestañas para catálogo y administración. La ficha de publicación muestra metadatos y acceso al PDF autorizado. La vista Reportes utiliza filtros superiores, indicadores compactos, una tabla de resultados y las acciones Imprimir y Exportar. Los controles administrativos se ocultan para perfiles sin permiso.")

add_heading(anchor, "4.8.4 Pruebas de aceptación", 3)
add_test_card(anchor, "PA-35", "Publicación de la versión autorizada", "HU-23", "Investigación Autorizada con PDF vigente.", "1. Abrir Publicaciones. 2. Seleccionar la investigación. 3. Revisar el documento. 4. Confirmar.", "Se crea una publicación vinculada al PDF vigente y se registran responsable y fecha.", "Caso de aceptación preparado para demostración con el Product Owner.")
add_test_card(anchor, "PA-36", "Bloqueo de publicación no autorizada", "HU-23", "Investigación en revisión o con observaciones.", "1. Intentar publicar el expediente. 2. Revisar la respuesta.", "El sistema rechaza la operación y conserva el estado y los documentos sin cambios.", "Regla de negocio incluida en la matriz de aceptación.")
add_test_card(anchor, "PA-37", "Consulta y descarga publicada", "HU-24", "Publicación activa y usuario con acceso al catálogo.", "1. Buscar por título. 2. Filtrar por área. 3. Abrir la ficha. 4. Descargar el PDF.", "La ficha coincide con los filtros y la descarga entrega únicamente el PDF autorizado.", "Caso funcional del prototipo definido.")
add_test_card(anchor, "PA-38", "Reporte por periodo y estado", "HU-27", "Datos de prueba en distintos estados y periodos.", "1. Abrir Reportes. 2. Elegir periodo y estado. 3. Generar. 4. Comparar totales con la lista filtrada.", "Los indicadores y el detalle contienen los mismos registros y muestran fecha y filtros aplicados.", "Caso de consistencia preparado para la Unidad 4.", page_break=True)
add_test_card(anchor, "PA-39", "Protección de datos en el reporte", "HU-27", "Reporte con evaluaciones y revisores registrados.", "1. Generar el reporte. 2. Revisar pantalla, impresión y exportación. 3. Buscar datos restringidos.", "No aparecen contraseñas, observaciones confidenciales ni identidad individual de los revisores.", "Caso de seguridad preparado para aceptación.")

review7_heading = add_heading(anchor, "4.8.5 Sprint Review y Sprint Retrospective", 3)
review7_heading.paragraph_format.space_after = Pt(6)
add_paragraph(anchor, "La Sprint Review está prevista para el 14 de mayo de 2027, con hora por definir con el Product Owner. La demostración incluirá publicación, búsqueda, filtros, descarga autorizada, reporte por periodo y recorrido de aceptación del proceso completo. El Product Owner deberá confirmar qué metadatos pueden consultarse y qué perfiles pueden exportar reportes.")
add_paragraph(anchor, "En la Sprint Retrospective se acordó mantener separados los datos públicos y administrativos, calcular los reportes en el servidor y evitar que las exportaciones incluyan información reservada. Para el Sprint 8 se priorizaron estabilización, respaldo, manuales, despliegue y capacitación.")

add_heading(anchor, "4.9 Sprint 8 Estabilización despliegue y entrega", 2, page_break=True)
add_heading(anchor, "4.9.1 Sprint Planning", 3)
add_paragraph(anchor, "El Objetivo del Sprint consiste en estabilizar el prototipo, documentar su instalación y operación, preparar respaldos y realizar la entrega técnica. El Sprint corresponde a las semanas 15 y 16, del 17 al 28 de mayo de 2027. Se seleccionó HU-26 con ocho puntos; el trabajo restante se concentra en la Definición de Terminado del producto y no agrega módulos funcionales nuevos.")
add_table(
    anchor,
    ["Elemento", "Actividad de cierre", "Evidencia"],
    [
        ["Calidad", "Pruebas de regresión y corrección de incidencias", "Matriz sin defectos críticos abiertos"],
        ["Datos", "Respaldo y restauración de MariaDB", "Procedimiento comprobable"],
        ["Despliegue", "Variables, instalación y arranque", "Guía reproducible en otro equipo"],
        ["Operación", "Manual por rol y datos de demostración", "Recorrido del prototipo"],
        ["Entrega", "Capacitación y acta de pendientes", "Cierre transparente del incremento"],
    ],
    [1.25, 3.2, 2.25],
)

add_heading(anchor, "4.9.2 Historia de usuario", 3)
add_heading(anchor, "4.9.2.1 HU-26 Desplegar documentar y capacitar", 4)
add_paragraph(anchor, "Como institución receptora, quiero disponer de instrucciones de instalación, operación, respaldo y recuperación, para ejecutar el prototipo en otro equipo y conocer sus responsabilidades de uso.")
add_paragraph(anchor, "Criterios de aceptación: se identifican versiones y descargas oficiales; la instalación configura MariaDB, API y aplicación web; las variables sensibles no se publican; existe un procedimiento de respaldo y restauración; los manuales distinguen funciones por rol; se documentan cuentas de demostración; la capacitación recorre el proceso y el reporte; los pendientes institucionales quedan registrados.", bold_lead="Criterios de aceptación:")

add_heading(anchor, "4.9.3 Plan de despliegue", 3)
add_paragraph(anchor, "El despliegue se organiza en preparación, instalación, configuración, migración, verificación y puesta a disposición. Para un entorno laboral se recomienda una cuenta de servicio para MariaDB, contraseñas distintas a las de demostración, acceso restringido a los puertos internos, copias periódicas y almacenamiento protegido. El prototipo local no sustituye la definición institucional de infraestructura, dominio, certificados, conservación documental y soporte.")
add_table(
    anchor,
    ["Fase", "Acción", "Criterio de salida"],
    [
        ["Preparación", "Verificar equipo, red, permisos y respaldos", "Requisitos disponibles"],
        ["Instalación", "Instalar Node.js, pnpm y MariaDB", "Versiones verificadas"],
        ["Configuración", "Crear base, usuario y variables del servicio", "Conexión protegida"],
        ["Migración", "Aplicar esquema, migraciones y datos iniciales", "Estructura consistente"],
        ["Verificación", "Probar login, CRUD, proceso y reporte", "Pruebas críticas aprobadas"],
        ["Entrega", "Capacitar y registrar pendientes", "Responsables informados"],
    ],
    [1.2, 3.25, 2.25],
)

add_heading(anchor, "4.9.4 Pruebas de cierre", 3)
add_test_card(anchor, "PA-40", "Instalación reproducible", "HU-26", "Equipo de prueba sin instancia previa del sistema y paquetes autorizados.", "1. Seguir la guía. 2. Configurar MariaDB. 3. Aplicar migraciones. 4. Iniciar API y web. 5. Consultar salud.", "El sistema inicia sin modificar el código y la API informa almacenamiento MariaDB disponible.", "Caso de despliegue definido para la entrega técnica.")
add_test_card(anchor, "PA-41", "Respaldo y restauración", "HU-26", "Base con usuarios, investigaciones, documentos y evaluaciones de prueba.", "1. Generar respaldo. 2. Restaurar en una base vacía. 3. Iniciar el sistema. 4. Comparar registros y archivos.", "Los datos y documentos se recuperan, las relaciones permanecen válidas y el acceso funciona.", "Caso de continuidad definido; periodicidad final pendiente de la institución.")
add_test_card(anchor, "PA-42", "Regresión del prototipo de Unidad 4", "HU-26", "Ambiente instalado y cuentas de Administrador, Investigador y Comité.", "1. Iniciar sesión. 2. Administrar un usuario. 3. Administrar una investigación. 4. Completar revisión y autorización. 5. Generar el reporte.", "El prototipo demuestra login, roles y usuarios, dos CRUD lógicos, un proceso trazable y un reporte sin errores críticos.", "Caso integral preparado para evaluación de la Unidad 4.")

review8_heading = add_heading(anchor, "4.9.5 Sprint Review Sprint Retrospective y cierre", 3)
review8_heading.paragraph_format.space_after = Pt(6)
sprint8_review = add_paragraph(anchor, "La Sprint Review y entrega del incremento están previstas para el 28 de mayo de 2027, con hora por definir con el Product Owner. Se demostrará el prototipo instalado, el acceso por roles, los dos CRUD lógicos, el proceso completo y el reporte. También se entregarán el capítulo, la guía de instalación, el manual de usuario y el procedimiento de respaldo.")
sprint8_review.paragraph_format.keep_together = True
add_paragraph(anchor, "La Sprint Retrospective final revisa el cumplimiento del Objetivo del Producto, las incidencias pendientes y las decisiones que requieren validación hospitalaria. El cierre académico no equivale a puesta en producción: la instalación laboral requiere autorización institucional, seguridad de infraestructura, política de datos personales, dominio, certificados, respaldos administrados y soporte operativo.")

add_heading(anchor, "4.10 Evidencia del prototipo solicitado para la Unidad 4", 2, page_break=True)
add_paragraph(anchor, "El prototipo se presenta mediante seis evidencias observables. Los CRUD se implementan con baja lógica: los registros se desactivan o archivan en lugar de eliminarse físicamente, porque usuarios, expedientes y decisiones forman parte de la trazabilidad institucional.")
add_table(
    anchor,
    ["Requisito", "Módulo o recorrido", "Operaciones demostrables", "Evidencia esperada"],
    [
        ["Login", "Acceso", "Autenticar, conservar sesión y cerrar sesión", "Ingreso válido y rechazo de credenciales incorrectas"],
        ["Roles y usuarios", "Usuarios y permisos", "Crear cuenta, asignar roles, restablecer contraseña y activar o desactivar", "Acciones y navegación diferentes por perfil"],
        ["CRUD 1", "Usuarios", "Crear, consultar, actualizar y desactivar", "Persistencia y control de correo duplicado"],
        ["CRUD 2", "Investigaciones", "Crear, consultar, actualizar y archivar o cambiar de estado", "Expediente con responsable e historial"],
        ["Proceso", "Gestión de investigación", "Registrar, documentar, revisar, evaluar, corregir, autorizar y publicar", "Trazabilidad de principio a fin"],
        ["Reporte", "Reportes ejecutivos", "Filtrar, generar, imprimir o exportar", "Totales coherentes y datos protegidos"],
    ],
    [1.0, 1.45, 2.65, 1.8],
)
add_heading(anchor, "4.10.1 Datos y roles para la demostración", 3)
add_paragraph(anchor, "La demostración debe utilizar cuentas separadas de Administrador, Administrador Investigador, Investigador e integrante de Comité. Se recomienda preparar una investigación de ejemplo con anexos, una ronda, una evaluación y una publicación, además de datos en varios estados para que el reporte muestre resultados significativos.")
add_heading(anchor, "4.10.2 Guion de demostración", 3)
add_table(
    anchor,
    ["Orden", "Perfil", "Acción", "Resultado a mostrar"],
    [
        ["1", "Administrador", "Iniciar sesión y administrar una cuenta", "Login, roles y CRUD de usuarios"],
        ["2", "Investigador", "Registrar y actualizar un expediente", "CRUD de investigaciones y documentos"],
        ["3", "Administrador Investigador", "Abrir la ronda y asignar comités", "Inicio del proceso institucional"],
        ["4", "Comité", "Evaluar y emitir decisión", "Rúbrica, observación y dictamen"],
        ["5", "Administrador Investigador", "Autorizar y publicar", "Historial y versión publicada"],
        ["6", "Administrador", "Generar el reporte filtrado", "Indicadores, detalle e impresión"],
    ],
    [0.6, 1.45, 2.75, 2.1],
)

# Update the accumulated schedule correspondence table through Sprint 8.
for table in doc.tables:
    if not table.rows or table.rows[0].cells[0].text.strip() != "Sprint":
        continue
    if not any(row.cells[0].text.strip() == "4 a 8" for row in table.rows[1:]):
        continue
    while len(table.rows) < 9:
        table._tbl.append(deepcopy(table.rows[-1]._tr))
    schedule_rows = [
        ("4", "7 y 8", "Implementación técnica; aceptación pendiente", "Rondas, asignaciones y vencimientos"),
        ("5", "9 y 10", "Implementación técnica; aceptación pendiente", "Rúbricas, evaluaciones, observaciones y correcciones"),
        ("6", "11 y 12", "Documentado; validación institucional pendiente", "Dictamen, historial, notificaciones y autorización"),
        ("7", "13 y 14", "Documentado; validación institucional pendiente", "Publicación, consulta, aceptación y reporte"),
        ("8", "15 y 16", "Documentado; entrega académica preparada", "Estabilización, despliegue, manuales y capacitación"),
    ]
    for row, values in zip(table.rows[4:9], schedule_rows):
        for cell, value in zip(row.cells, values):
            cell.text = value
            set_cell_margins(cell)
    break

# Remove the empty reserved paragraphs that separated correspondence from sources.
paragraphs = list(doc.paragraphs)
anchor_index = next(i for i, paragraph in enumerate(paragraphs) if paragraph._p is anchor._p)
sources_index = next(i for i, paragraph in enumerate(paragraphs) if paragraph._p is sources_heading._p)
for paragraph in paragraphs[anchor_index + 1:sources_index]:
    if not paragraph.text.strip():
        paragraph._element.getparent().remove(paragraph._element)

# The source file combines a manual page break with the section break that
# changes the annex to landscape orientation. Word applies both and inserts an
# empty page. Preserve the section change, but remove the redundant manual
# break immediately before the schedule annex.
schedule_heading = next(
    paragraph for paragraph in doc.paragraphs
    if paragraph.text.strip() == "CRONOGRAMA PRELIMINAR DE ACTIVIDADES"
)
schedule_index = next(
    i for i, paragraph in enumerate(doc.paragraphs)
    if paragraph._p is schedule_heading._p
)
for paragraph in reversed(doc.paragraphs[:schedule_index]):
    if paragraph._p.find(".//" + qn("w:sectPr")) is None:
        continue
    page_breaks = paragraph._p.findall('.//w:br[@w:type="page"]', paragraph._p.nsmap)
    if not page_breaks:
        continue
    for page_break in page_breaks:
        page_break.getparent().remove(page_break)
    break

# The original annex also contains an empty landscape section between the
# references and the actual schedule. Remove that empty section so the annex
# starts directly after the references, while the final body section keeps the
# intended landscape layout and first-page header behavior.
paragraphs_before_schedule = doc.paragraphs[:schedule_index]
section_break_indices = [
    i for i, paragraph in enumerate(paragraphs_before_schedule)
    if paragraph._p.find(".//" + qn("w:sectPr")) is not None
]
if len(section_break_indices) >= 2:
    previous_break_index, redundant_break_index = section_break_indices[-2:]
    for paragraph in list(doc.paragraphs[previous_break_index + 1:schedule_index]):
        if not paragraph.text.strip():
            paragraph._element.getparent().remove(paragraph._element)

# Update Word fields, including the table of contents, when the document is opened.
settings = doc.settings._element
update_fields = settings.find(qn("w:updateFields"))
if update_fields is None:
    update_fields = OxmlElement("w:updateFields")
    settings.append(update_fields)
update_fields.set(qn("w:val"), "true")

# Keep all document headings black and avoid theme color overrides.
for style_name in ("Title", "Heading 1", "Heading 2", "Heading 3", "Heading 4"):
    if style_name in doc.styles:
        style = doc.styles[style_name]
        style.font.color.rgb = RGBColor(0, 0, 0)

doc.save(OUTPUT)
print(OUTPUT)
