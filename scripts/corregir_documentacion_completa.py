from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from PIL import Image, ImageDraw, ImageFont

SRC = Path(r"D:\descargas\anteproyecto_Scrum_capitulo_IV_completo_sprints_1_a_8_MariaDB.docx")
OUT = Path(r"D:\descargas\anteproyecto_Scrum_capitulo_IV_completo_CORREGIDO_Times_New_Roman.docx")
ASSETS = Path(r"D:\descargas\sistema_investigaciones_hno\docs\evidencias_documentacion")
ASSETS.mkdir(parents=True, exist_ok=True)
BURGUNDY = "7D173F"
PALE = "F6EEF2"

stories = {
15:("Administrador o Administrador Investigador","Crear rondas y asignar revisores",4,"Alta",8,"Alto","Como responsable administrativo, quiero abrir una ronda y asignar integrantes de los comités, para organizar la revisión de cada investigación.","La investigación y los comités deben existir; cada asignación registra responsable y fecha límite; no se permiten asignaciones duplicadas activas; el cambio queda en el historial."),
16:("integrante de comité","Consultar asignaciones y vencimientos",4,"Alta",5,"Alto","Como integrante de comité, quiero consultar mis asignaciones, estados y vencimientos, para atender oportunamente las revisiones que me corresponden.","Solo se muestran asignaciones autorizadas para el usuario; se identifica comité, investigación, estado y fecha límite; una asignación vencida se distingue; la consulta respeta el rol."),
17:("responsable administrativo","Configurar rúbricas y criterios",5,"Alta",8,"Alto","Como responsable administrativo, quiero definir rúbricas con criterios ponderados, para que los comités evalúen con reglas homogéneas.","La rúbrica contiene nombre, versión y estado; los criterios incluyen descripción y ponderación; la suma de ponderaciones es válida; una rúbrica usada conserva su versión histórica."),
18:("integrante de comité","Evaluar y registrar observaciones",5,"Alta",8,"Alto","Como integrante de comité, quiero valorar una asignación y registrar observaciones, para emitir una recomendación sustentada.","Solo el revisor asignado puede evaluar; se requiere una rúbrica activa; cada criterio recibe valoración; la recomendación y la observación general quedan asociadas a la revisión."),
19:("investigador responsable","Atender correcciones y cargar nuevas versiones",5,"Alta",8,"Alto","Como investigador responsable, quiero consultar observaciones y cargar documentos corregidos, para atender la revisión sin perder trazabilidad.","Las observaciones son visibles únicamente para participantes autorizados; cada corrección crea una nueva versión; el antecedente permanece disponible; puede generarse una nueva ronda de revisión."),
20:("integrante autorizado de comité","Emitir votos y dictamen",6,"Alta",8,"Alto","Como integrante autorizado, quiero emitir mi voto y participar en el dictamen, para consolidar la decisión de los comités.","Solo votan integrantes habilitados; se registra una decisión por integrante y ronda; el dictamen conserva responsables y fecha; no se modifica una ronda cerrada sin reapertura controlada."),
21:("participante del proceso","Consultar historial y notificaciones",6,"Alta",8,"Alto","Como participante autorizado, quiero consultar el historial y recibir avisos de cambios relevantes, para conocer el estado vigente del expediente.","El historial se presenta en orden cronológico; cada evento identifica actor, fecha y transición; las notificaciones respetan permisos; la consulta no expone datos restringidos."),
22:("Administrador Investigador","Autorizar una investigación",6,"Alta",5,"Alto","Como Administrador Investigador, quiero registrar la autorización institucional, para permitir la publicación de una investigación aprobada.","La autorización exige dictámenes favorables y documentos vigentes; se registra responsable y fecha; una investigación autorizada no vuelve a borrador sin un proceso controlado."),
23:("Administrador Investigador","Publicar una versión autorizada",7,"Alta",8,"Alto","Como Administrador Investigador, quiero publicar el documento autorizado, para que la institución consulte la versión correcta sin exponer borradores ni anexos restringidos.","La investigación debe estar autorizada; solo se publica el PDF vigente; se registra responsable y fecha; no se permiten dos publicaciones activas; una sustitución conserva el antecedente."),
24:("usuario institucional","Consultar investigaciones publicadas",7,"Media",5,"Medio","Como usuario institucional, quiero buscar investigaciones publicadas por título, área, categoría y fecha, para localizar conocimiento autorizado del hospital.","La consulta muestra únicamente publicaciones activas; dispone de búsqueda y filtros; la ficha presenta metadatos autorizados; la descarga corresponde al PDF publicado y no revela datos personales."),
25:("equipo Scrum","Ejecutar pruebas de aceptación e integración",7,"Alta",8,"Alto","Como equipo Scrum, quiero recorrer el proceso completo con datos de prueba, para identificar fallas de integración antes de la entrega.","Se prueban autenticación, permisos, usuarios, investigaciones, documentos, revisión, evaluación, correcciones, autorización, publicación y reporte; los resultados se registran con evidencia y estado."),
27:("responsable administrativo","Generar reporte ejecutivo",7,"Alta",8,"Alto","Como responsable administrativo, quiero generar un reporte ejecutivo, para consultar indicadores del proceso y apoyar la toma de decisiones.","El reporte aplica filtros autorizados; muestra totales por estado, área y periodo; no incluye información clínica sensible; la fecha de generación y los criterios utilizados quedan visibles."),
26:("institución receptora","Desplegar, documentar y capacitar",8,"Alta",8,"Alto","Como institución receptora, quiero disponer de instalación, respaldo, manuales y capacitación, para operar el sistema de manera controlada.","Se documentan requisitos, configuración y restauración; se verifica el arranque de interfaz, API y MariaDB; los manuales cubren roles y flujo; la aceptación final queda pendiente del Product Owner."),
}

def set_cell_shading(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr(); shd = tcPr.find(qn('w:shd'))
    if shd is None: shd = OxmlElement('w:shd'); tcPr.append(shd)
    shd.set(qn('w:fill'), fill)

def set_font_run(run, size=None, bold=None, color=None):
    run.font.name='Times New Roman'
    rPr=run._element.get_or_add_rPr(); fonts=rPr.rFonts
    if fonts is None: fonts=OxmlElement('w:rFonts'); rPr.insert(0,fonts)
    for a in ('ascii','hAnsi','eastAsia','cs'): fonts.set(qn('w:'+a),'Times New Roman')
    if size: run.font.size=Pt(size)
    if bold is not None: run.bold=bold
    if color: run.font.color.rgb=RGBColor(*color)

def normalize_paragraph(p):
    for r in p.runs: set_font_run(r)

def insert_table_after(p, rows, widths=(1.55,5.25)):
    table=doc.add_table(rows=len(rows), cols=2)
    table.autofit=False
    for i,(label,value) in enumerate(rows):
        table.cell(i,0).width=Inches(widths[0]); table.cell(i,1).width=Inches(widths[1])
        table.cell(i,0).vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
        set_cell_shading(table.cell(i,0),BURGUNDY); set_cell_shading(table.cell(i,1),PALE if i%2 else "FFFFFF")
        table.cell(i,0).text=label; table.cell(i,1).text=str(value)
        for r in table.cell(i,0).paragraphs[0].runs: set_font_run(r,10,True,(255,255,255))
        for r in table.cell(i,1).paragraphs[0].runs: set_font_run(r,10)
        for c in (table.cell(i,0),table.cell(i,1)):
            for par in c.paragraphs:
                par.paragraph_format.space_after=Pt(0); par.paragraph_format.space_before=Pt(0)
    p._p.addnext(table._tbl)
    return table

def insert_paragraph_before(anchor,text,style=None):
    p=anchor.insert_paragraph_before(text,style=style)
    normalize_paragraph(p); return p

def add_picture_before(anchor,path,caption):
    p=insert_paragraph_before(anchor,'')
    p.alignment=WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(path),width=Inches(6.4))
    normalize_paragraph(p)
    c=insert_paragraph_before(anchor,caption)
    c.alignment=WD_ALIGN_PARAGRAPH.CENTER
    for r in c.runs: set_font_run(r,10); r.italic=True

def insert_matrix_before(anchor, headers, data):
    table=doc.add_table(rows=1+len(data),cols=len(headers)); table.autofit=True
    for j,h in enumerate(headers):
        table.cell(0,j).text=h; set_cell_shading(table.cell(0,j),BURGUNDY)
        for r in table.cell(0,j).paragraphs[0].runs:set_font_run(r,9,True,(255,255,255))
    for i,row in enumerate(data,1):
        for j,v in enumerate(row):
            table.cell(i,j).text=str(v); set_cell_shading(table.cell(i,j),PALE if i%2 else 'FFFFFF')
            for r in table.cell(i,j).paragraphs[0].runs:set_font_run(r,9)
    anchor._p.addprevious(table._tbl)
    return table

def font(sz,bold=False):
    f=r'C:\Windows\Fonts\timesbd.ttf' if bold else r'C:\Windows\Fonts\times.ttf'
    return ImageFont.truetype(f,sz)

def sequence_diagram(name,title,actors,messages):
    W,H=1500,900; im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
    d.text((W//2,35),title,font=font(34,True),fill=(45,25,35),anchor='ma')
    xs=[120+i*(1260//(len(actors)-1)) for i in range(len(actors))]
    for x,a in zip(xs,actors):
        d.rounded_rectangle((x-105,90,x+105,150),12,fill=(125,23,63),outline=(90,12,42),width=2)
        d.text((x,120),a,font=font(21,True),fill='white',anchor='mm')
        d.line((x,150,x,835),fill=(110,110,110),width=2)
    y=205
    for src,dst,label,reply in messages:
        x1,x2=xs[src],xs[dst]; col=(125,23,63) if not reply else (30,130,125)
        d.line((x1,y,x2,y),fill=col,width=3)
        direction=1 if x2>x1 else -1
        d.polygon([(x2,y),(x2-13*direction,y-7),(x2-13*direction,y+7)],fill=col)
        d.text(((x1+x2)//2,y-12),label,font=font(18),fill=(35,35,35),anchor='ms')
        y+=85
    d.text((W//2,875),'Fuente: elaboración propia con base en el flujo funcional del Sprint.',font=font(17),fill=(80,80,80),anchor='ms')
    path=ASSETS/name; im.save(path); return path

diagrams={
4:sequence_diagram('secuencia_sprint4.png','Sprint 4: apertura de ronda y asignación',['Administrador','Interfaz web','API REST','MariaDB','Revisor'],[(0,1,'Selecciona investigación y revisores',False),(1,2,'POST /review-rounds',False),(2,3,'Valida y registra ronda/asignaciones',False),(3,2,'Identificadores y estado',True),(2,1,'Ronda creada',True),(1,4,'Asignación visible por rol',False)]),
5:sequence_diagram('secuencia_sprint5.png','Sprint 5: evaluación y corrección',['Revisor','Interfaz web','API REST','MariaDB','Investigador'],[(0,1,'Captura criterios y observaciones',False),(1,2,'POST /evaluations',False),(2,3,'Guarda evaluación y recomendación',False),(3,2,'Confirmación',True),(2,4,'Notifica correcciones',False),(4,2,'Carga nueva versión',False),(2,3,'Registra versión e historial',False)]),
6:sequence_diagram('secuencia_sprint6.png','Sprint 6: dictamen y autorización',['Comité','Interfaz web','API REST','MariaDB','Admin. Investigador'],[(0,1,'Emite voto',False),(1,2,'POST /votes',False),(2,3,'Registra voto por ronda',False),(4,1,'Solicita consolidación',False),(1,2,'POST /decisions',False),(2,3,'Cierra dictamen y registra estado',False),(2,1,'Autorización e historial',True)]),
7:sequence_diagram('secuencia_sprint7.png','Sprint 7: publicación, consulta y reporte',['Administrador','Interfaz web','API REST','MariaDB','Usuario institucional'],[(0,1,'Autoriza publicación',False),(1,2,'POST /publications',False),(2,3,'Valida estado y PDF vigente',False),(3,2,'Publicación registrada',True),(4,1,'Busca y aplica filtros',False),(1,2,'GET /publications',False),(2,3,'Consulta metadatos autorizados',False),(2,1,'Resultados y reporte',True)]),
8:sequence_diagram('secuencia_sprint8.png','Sprint 8: despliegue y verificación',['Equipo Scrum','Equipo destino','Aplicación','MariaDB'],[(0,1,'Entrega paquete y manuales',False),(1,2,'Configura entorno',False),(2,3,'Ejecuta esquema y datos iniciales',False),(3,2,'Conexión disponible',True),(1,2,'Prueba acceso, CRUD y proceso',False),(2,1,'Resultados de verificación',True),(1,0,'Acta de observaciones/aceptación',False)]),
}

doc=Document(SRC)

# Restaurar las historias de usuario como tablas uniformes.
for hu,data in stories.items():
    target=next((p for p in doc.paragraphs if f'HU-{hu:02d} ' in p.text and p.text.strip().startswith('4.')),None)
    if not target: continue
    user,name,sprint,priority,points,risk,desc,criteria=data
    target.text=f'Tabla. Historia de usuario HU-{hu:02d} {name}'
    target.style=doc.styles['Normal']; normalize_paragraph(target)
    if target.runs: target.runs[0].bold=True
    nxt=target._p.getnext()
    # Eliminar descripción y criterios que estaban como párrafos sueltos.
    for _ in range(2):
        if nxt is not None and nxt.tag==qn('w:p'):
            following=nxt.getnext(); nxt.getparent().remove(nxt); nxt=following
    rows=[('Número',f'HU-{hu:02d}'),('Usuario',user),('Nombre',name),('Sprint',sprint),('Prioridad',priority),('Puntos',points),('Riesgo',risk),('Responsables','Santiago González Diego y Romero Reyes Mario Jersain'),('Descripción',desc),('Criterios de aceptación',criteria)]
    insert_table_after(target,rows)

sections={
'4.5.4 Codificación y persistencia':(4,'4.5.3.3 Diagrama de secuencia: apertura de ronda y asignación','4.5.4 Documentación de la estructura del código y persistencia',[
('apps/api/src/app.js','Rutas de rondas, asignaciones y controles de acceso.'),('apps/api/src/store.js','Consultas transaccionales de revisiones y responsables.'),('apps/web/src/App.jsx','Vistas de rondas, estados, responsables y vencimientos.'),('database/schema.sql','Tablas revision_rondas y revision_asignaciones, llaves y estados.'),('apps/api/test/app.test.js','Pruebas de permisos, duplicados y consulta por rol.')],Path(r'D:\descargas\sistema_investigaciones_hno\docs\evidencia_sprint4_revisiones.png'),'Figura. Evidencia real del incremento del Sprint 4: módulo de rondas y asignaciones.'),
'4.6.4 Codificación y reglas de negocio':(5,'4.6.3.4 Diagrama de secuencia: evaluación y corrección','4.6.4 Documentación de la estructura del código y reglas de negocio',[
('apps/api/src/app.js','Servicios de rúbricas, evaluaciones, observaciones y correcciones.'),('apps/api/src/store.js','Persistencia de criterios, resultados y transiciones.'),('apps/web/src/App.jsx','Formulario de evaluación y bandeja del revisor.'),('database/schema.sql','Rúbricas, criterios, evaluaciones y detalle por criterio.'),('apps/api/test/app.test.js','Pruebas de valoración, versión de rúbrica y nueva versión documental.')],Path(r'D:\descargas\sistema_investigaciones_hno\docs\evidencia_sprint5_evaluaciones.png'),'Figura. Evidencia real del incremento del Sprint 5: módulo de rúbricas y evaluaciones.'),
'4.7.4 Reglas de negocio y seguridad':(6,'4.7.3.4 Diagrama de secuencia: dictamen y autorización','4.7.4 Documentación prevista de código y seguridad',[
('API de votación','Registro único por integrante, comité y ronda.'),('Servicio de dictamen','Consolidación de decisiones y cierre controlado.'),('Servicio de historial','Registro inmutable de actor, fecha y transición.'),('Servicio de notificaciones','Avisos internos sin exposición de información restringida.'),('Control de autorización','Verificación de dictámenes y documentos vigentes.')],None,None),
'4.8.3 Análisis diseño y maquetado':(7,'4.8.3.4 Diagrama de secuencia: publicación y reporte','4.8.3.5 Documentación prevista del código',[
('Módulo de publicaciones','Alta y sustitución controlada del PDF autorizado.'),('Consulta institucional','Búsqueda, filtros y ficha de metadatos autorizados.'),('Reporte ejecutivo','Indicadores agregados por estado, área y periodo.'),('Pruebas de integración','Recorrido del flujo completo y controles de permisos.'),('Protección documental','Exclusión de borradores, anexos y datos personales.')],Path(r'D:\descargas\sistema_investigaciones_hno\docs\evidencia_sprint7_publicaciones_actual.png'),'Figura. Estado actual del módulo del Sprint 7: planificación visible; no se presenta como incremento terminado.'),
'4.9.4 Pruebas de cierre':(8,'4.9.3.1 Diagrama de secuencia: despliegue y verificación','4.9.3.2 Documentación de instalación, operación y código',[
('README y manual de instalación','Requisitos, variables, arranque y solución de fallas.'),('scripts/mariadb-local.ps1','Inicio, detención y verificación de MariaDB local.'),('database/schema.sql y seed.sql','Creación reproducible del esquema y usuarios iniciales.'),('Manual de usuario','Acciones permitidas por rol y flujo institucional.'),('Respaldo y restauración','Procedimiento probado antes de la entrega técnica.')],Path(r'D:\descargas\sistema_investigaciones_hno\docs\evidencia_panel_actual.png'),'Figura. Evidencia del prototipo integrado utilizado para la verificación de cierre; la aceptación institucional permanece pendiente.'),
}

for anchor_text,(sprint,diag_heading,code_heading,rows,pic,caption) in sections.items():
    anchor=next((p for p in doc.paragraphs if p.text.strip()==anchor_text),None)
    if not anchor: continue
    insert_paragraph_before(anchor,diag_heading,'Heading 4')
    insert_paragraph_before(anchor,'El diagrama representa la interacción principal entre el actor, la interfaz, los servicios y MariaDB. Su propósito es documentar responsabilidades, validaciones y persistencia sin incorporar código fuente en el cuerpo del capítulo.')
    add_picture_before(anchor,diagrams[sprint],f'Figura. Diagrama de secuencia del Sprint {sprint}. Fuente: elaboración propia.')
    insert_paragraph_before(anchor,code_heading,'Heading 4')
    insert_paragraph_before(anchor,'La documentación del código se presenta mediante responsabilidades de componentes y reglas de negocio. El código fuente completo permanece en el repositorio o en anexos, conforme a la indicación académica.')
    insert_matrix_before(anchor,['Componente o archivo','Responsabilidad documentada'],rows)
    if pic and pic.exists():
        insert_paragraph_before(anchor,f'{code_heading.split()[0]}.1 Evidencia visual del incremento','Heading 4')
        add_picture_before(anchor,pic,caption)

# Normalización tipográfica integral.
for style in doc.styles:
    if hasattr(style,'font'):
        style.font.name='Times New Roman'
        try:
            rPr=style.element.get_or_add_rPr(); rf=rPr.rFonts
            if rf is None: rf=OxmlElement('w:rFonts'); rPr.insert(0,rf)
            for a in ('ascii','hAnsi','eastAsia','cs'): rf.set(qn('w:'+a),'Times New Roman')
        except Exception: pass
for p in doc.paragraphs: normalize_paragraph(p)
for table in doc.tables:
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs: normalize_paragraph(p)
for sec in doc.sections:
    for part in (sec.header,sec.footer):
        for p in part.paragraphs: normalize_paragraph(p)
        for t in part.tables:
            for row in t.rows:
                for c in row.cells:
                    for p in c.paragraphs: normalize_paragraph(p)

doc.core_properties.title='Anteproyecto Scrum — Capítulo IV completo y corregido'
doc.core_properties.subject='Historias de usuario, diagramas de secuencia, documentación de código y evidencias por Sprint'
doc.save(OUT)
print(OUT)
