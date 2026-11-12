from copy import deepcopy
from pathlib import Path
import re
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

SRC=Path(r'D:\descargas\anteproyecto_Scrum_capitulo_IV_completo_CORREGIDO_Times_New_Roman.docx')
OUT=Path(r'D:\descargas\DOCUMENTACION_FINAL_PROYECTO_HNO_SCRUM.docx')
BURG='7D173F'; PALE='F6EEF2'; BORDER='D9D9D9'; WHITE='FFFFFF'; BLACK='000000'
d=Document(SRC)

def para(prefix):
    return next((p for p in d.paragraphs if p.text.strip().startswith(prefix)),None)

def set_text(p,text,style=None):
    p.text=text
    if style: p.style=d.styles[style]

def insert_before(anchor,text,style=None):
    p=d.add_paragraph(text,style=style)
    anchor._p.addprevious(p._p)
    return p

def move_before(p,anchor):
    p._p.getparent().remove(p._p); anchor._p.addprevious(p._p)

def set_shading(cell,fill):
    pr=cell._tc.get_or_add_tcPr(); sh=pr.find(qn('w:shd'))
    if sh is None: sh=OxmlElement('w:shd'); pr.append(sh)
    sh.set(qn('w:fill'),fill); sh.set(qn('w:val'),'clear')

def borders(table):
    pr=table._tbl.tblPr; tb=pr.find(qn('w:tblBorders'))
    if tb is None: tb=OxmlElement('w:tblBorders'); pr.append(tb)
    for edge in ('top','left','bottom','right','insideH','insideV'):
        el=tb.find(qn('w:'+edge))
        if el is None: el=OxmlElement('w:'+edge); tb.append(el)
        el.set(qn('w:val'),'single'); el.set(qn('w:sz'),'4'); el.set(qn('w:color'),BORDER)

def set_run_font(run,size=None,color=None,bold=None):
    run.font.name='Times New Roman'
    if size: run.font.size=Pt(size)
    if color: run.font.color.rgb=RGBColor.from_string(color)
    if bold is not None: run.bold=bold
    rp=run._element.get_or_add_rPr(); rf=rp.rFonts
    if rf is None: rf=OxmlElement('w:rFonts'); rp.insert(0,rf)
    for a in ('ascii','hAnsi','eastAsia','cs'): rf.set(qn('w:'+a),'Times New Roman')

def format_cell(cell,fill=None,white=False,bold=False,center=False):
    if fill: set_shading(cell,fill)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
    for p in cell.paragraphs:
        p.paragraph_format.space_before=Pt(2); p.paragraph_format.space_after=Pt(2)
        if center: p.alignment=WD_ALIGN_PARAGRAPH.CENTER
        for r in p.runs: set_run_font(r,9,WHITE if white else BLACK,bold)

def cant_split(row):
    pr=row._tr.get_or_add_trPr(); el=pr.find(qn('w:cantSplit'))
    if el is None: pr.append(OxmlElement('w:cantSplit'))

# Introducción correcta de los ocho Sprints.
p=para('Este capítulo documenta el desarrollo de las tres primeras iteraciones')
if p:
    set_text(p,'Este capítulo documenta la planificación, diseño, desarrollo y pruebas de los ocho Sprints previstos en el cronograma del proyecto (del 25 de enero al 28 de mayo de 2027), detallando la evolución del producto a través de sus iteraciones. Se presentan los requisitos, el Product Backlog, las historias de usuario, los modelos aplicables, el maquetado, la estructura del proyecto, las pruebas y la evidencia disponible. El código fuente se conserva en el repositorio y no se reproduce íntegramente en este capítulo.')

# Correcciones de títulos y puntuación.
replacements={
'4.6 Sprint 5 Rúbricas evaluaciones y correcciones':'4.6 Sprint 5 Rúbricas, evaluaciones y correcciones',
'4.7 Sprint 6 Dictamen autorización y notificaciones':'4.7 Sprint 6 Dictamen, autorización y notificaciones',
'4.8 Sprint 7 Publicación consulta reporte y aceptación':'4.8 Sprint 7 Publicación, consulta, reporte y aceptación',
'4.9 Sprint 8 Estabilización despliegue y entrega':'4.9 Sprint 8 Estabilización, despliegue y entrega',
'4.9.5 Sprint Review Sprint Retrospective y cierre':'4.9.5 Sprint Review, Sprint Retrospective y cierre',
'4.2.2.3 Diagrama Entidad-Relación (DER).':'4.2.2.3 Diagrama entidad-relación',
'4.3.5.1 Tarjetas de pruebas de aceptación':'4.3.4.1 Tarjetas de pruebas de aceptación',
}
for old,new in replacements.items():
    p=para(old)
    if p: set_text(p,new,'Heading 4' if new.startswith(('4.2.2','4.3.4.1')) else p.style.name)

# Reordenar encabezados padres y subapartados de Sprints 4, 5 y 6.
for parent,child,newchild in [
('4.5.4 Codificación y persistencia','4.5.4 Documentación de la estructura','4.5.4.1 Documentación de la estructura del código y persistencia'),
('4.6.4 Codificación y reglas de negocio','4.6.4 Documentación de la estructura','4.6.4.1 Documentación de la estructura del código y reglas de negocio'),
('4.7.4 Reglas de negocio y seguridad','4.7.4 Documentación prevista','4.7.4.1 Documentación prevista del código y seguridad')]:
    pp,cc=para(parent),para(child)
    if pp and cc:
        move_before(pp,cc); set_text(cc,newchild,'Heading 4')

for old,new in [('4.5.4.1 Evidencia visual','4.5.4.2 Evidencia visual del incremento'),('4.6.4.1 Evidencia visual','4.6.4.2 Evidencia visual del incremento')]:
    p=para(old)
    if p:set_text(p,new,'Heading 4')

# Reordenar por completo el bloque de diseño/documentación del Sprint 7.
start=para('4.8.3.4 Diagrama de secuencia')
analysis=para('4.8.3 Análisis diseño y maquetado')
tests=para('4.8.4 Pruebas de aceptación')
if start and analysis and tests:
    elems=[]; cur=start._p
    while cur is not None and cur is not analysis._p:
        nxt=cur.getnext(); elems.append(cur); cur=nxt
    for e in elems:
        e.getparent().remove(e); tests._p.addprevious(e)
    set_text(analysis,'4.8.3 Análisis, diseño y maquetado','Heading 3')
    p=para('4.8.3.5 Documentación prevista');
    if p:set_text(p,'4.8.4 Documentación prevista del código','Heading 3')
    p=para('4.8.3.5.1 Evidencia visual');
    if p:set_text(p,'4.8.4.1 Estado actual del módulo','Heading 4')
    set_text(tests,'4.8.5 Pruebas de aceptación','Heading 3')
    p=para('4.8.5 Sprint Review');
    if p:set_text(p,'4.8.6 Sprint Review y Sprint Retrospective','Heading 3')

p=para('4.9.3.2.1 Evidencia visual')
if p:set_text(p,'4.9.3.3 Evidencia visual de verificación','Heading 4')

# Declarar con precisión el estado de los Sprints aún no implementados.
state_notes={
'4.7 Sprint 6':'Estado del Sprint: diseño funcional documentado. La implementación completa, las pruebas ejecutadas y la aceptación institucional permanecen pendientes; por ello, los elementos siguientes describen el comportamiento previsto y no se presentan como incremento terminado.',
'4.8 Sprint 7':'Estado del Sprint: planificación, historias, diseño y criterios de prueba documentados. El módulo de publicaciones continúa planificado y su implementación, verificación y aceptación por el Product Owner permanecen pendientes.',
'4.9 Sprint 8':'Estado del Sprint: plan de estabilización, despliegue y entrega documentado. Su ejecución depende de contar con los incrementos anteriores terminados y de la validación del entorno institucional.'}
for key,note in state_notes.items():
    h=para(key)
    if h:
        # Insertar después del primer párrafo de objetivo del Sprint.
        e=h._p.getnext()
        while e is not None and e.tag!=qn('w:p'): e=e.getnext()
        if e is not None:
            np=d.add_paragraph(note); e.addnext(np._p)

# Corregir afirmaciones de implementación no respaldadas en Sprint 6.
p=para('Las operaciones de dictamen y autorización se validan en la API')
if p:set_text(p,'Las operaciones de dictamen y autorización deberán ejecutarse mediante servicios protegidos y transacciones en MariaDB. La implementación prevista comprobará el rol, la pertenencia al comité, el estado de la ronda, las evaluaciones completas y la ausencia de correcciones pendientes. Cada cambio deberá generar historial y notificaciones sin exponer contraseñas, hashes ni datos de otros expedientes.')

# Mover el cronograma desde el final al Marco Teórico, conservando su sección horizontal.
body=d._element.body; els=list(body)
cron=next((e for e in els if e.tag==qn('w:p') and ''.join(e.itertext()).strip().startswith('CRONOGRAMA PRELIMINAR')),None)
chapter4=para('4. DESARROLLO')
if cron is not None and chapter4 is not None:
    ci=list(body).index(cron); start=ci
    if ci>0 and list(body)[ci-1].find('.//'+qn('w:sectPr')) is not None: start=ci-1
    movable=list(body)[start:-1]  # conservar el sectPr final del cuerpo
    old_portrait=deepcopy(movable[0].find('.//'+qn('w:sectPr')))
    landscape=deepcopy(list(body)[-1])
    for e in movable: body.remove(e)
    anchor=chapter4._p
    # Título y explicación antes del salto a horizontal.
    h2=d.add_paragraph('3.6 Planificación temporal del proyecto',style='Heading 2')
    intro=d.add_paragraph('La ejecución se organiza en ocho Sprints de dos semanas efectivas. El cronograma relaciona cada incremento con las dieciséis semanas de trabajo comprendidas entre el 25 de enero y el 28 de mayo de 2027; el receso del 22 de marzo al 2 de abril se excluye del cómputo. Las fechas de Sprint Review se mantienen sujetas a coordinación con el Product Owner.')
    h3=d.add_paragraph('3.6.1 Cronograma de actividades',style='Heading 3')
    for e in (h2._p,intro._p,h3._p): anchor.addprevious(e)
    for e in movable: anchor.addprevious(e)
    # Terminar la sección horizontal y restablecer orientación vertical.
    endp=OxmlElement('w:p'); ppr=OxmlElement('w:pPr'); ppr.append(landscape); endp.append(ppr); anchor.addprevious(endp)
    final=list(body)[-1]
    if old_portrait is not None:
        body.remove(final); body.append(old_portrait)
    set_text(para('CRONOGRAMA PRELIMINAR DE ACTIVIDADES'),'CRONOGRAMA DE ACTIVIDADES')

# Consolidar referencias: un solo encabezado y eliminar duplicación visible.
p=para('4.12 Fuentes oficiales consultadas')
if p:set_text(p,'REFERENCIAS','Heading 1')
p2=para('REFERENCIAS')
if p2 and p2 is not p:
    # Si existe un segundo título normal, se elimina y se conservan las entradas.
    p2._p.getparent().remove(p2._p)

# Numeración consecutiva y automática visible de tablas y figuras.
fig=tab=0
for p in d.paragraphs:
    t=p.text.strip()
    if re.match(r'^Figura(?:\s+\d+)?\.',t,re.I):
        fig+=1; p.text=re.sub(r'^Figura(?:\s+\d+)?\.',f'Figura {fig}.',t,flags=re.I); p.style=d.styles['Caption']
    elif re.match(r'^Tabla(?:\s+\d+)?\.',t,re.I):
        tab+=1; p.text=re.sub(r'^Tabla(?:\s+\d+)?\.',f'Tabla {tab}.',t,flags=re.I); p.style=d.styles['Caption']

# Sistema visual único para todas las tablas de contenido (sin alterar tablas de diseño/logotipos ni el Gantt).
for table in d.tables:
    text=' '.join(c.text for row in table.rows for c in row.cells)
    meaningful=len(table.rows)>=2 and len(table.columns)>=2 and len(text.strip())>15
    gantt=('ACTIVIDADES' in text and '25-29' in text)
    if not meaningful: continue
    if gantt:
        borders(table)
        for cell in table.rows[0].cells: format_cell(cell,BURG,True,True,True)
        for row in table.rows: cant_split(row)
        continue
    borders(table)
    story=(len(table.columns)==2 and any(c.text.strip()=='Número' for row in table.rows for c in row.cells))
    for i,row in enumerate(table.rows):
        cant_split(row)
        for j,cell in enumerate(row.cells):
            if story and j==0: format_cell(cell,BURG,True,True)
            elif not story and i==0: format_cell(cell,BURG,True,True,True)
            else: format_cell(cell,WHITE if i%2 else PALE,False,False,j>0 and len(cell.text)<18)
    if story:
        # Mantener completa cada tarjeta de historia en una misma página cuando sea posible.
        for ri,row in enumerate(table.rows):
            for cell in row.cells:
                for p in cell.paragraphs: p.paragraph_format.keep_with_next=(ri<len(table.rows)-1)

# Leyendas unidas a su objeto y títulos unidos al contenido siguiente.
for p in d.paragraphs:
    if p.style.name=='Caption':
        p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.keep_with_next=True
        for r in p.runs: r.italic=True; set_run_font(r,10,BLACK)
    elif p.style.name.startswith('Heading'):
        p.paragraph_format.keep_with_next=True

# Times New Roman y títulos negros en todo el documento.
for st in d.styles:
    if hasattr(st,'font'):
        st.font.name='Times New Roman'
        if st.name.startswith('Heading') or st.name in ('Title','Subtitle'): st.font.color.rgb=RGBColor(0,0,0)
for p in d.paragraphs:
    for r in p.runs: set_run_font(r)
for table in d.tables:
    for row in table.rows:
        for cell in row.cells:
            for p in cell.paragraphs:
                for r in p.runs: set_run_font(r)
for sec in d.sections:
    for part in (sec.header,sec.footer):
        for p in part.paragraphs:
            for r in p.runs:set_run_font(r)

d.core_properties.title='Documentación final del sistema de investigaciones científicas del Hospital de la Niñez Oaxaqueña'
d.core_properties.subject='Anteproyecto y Capítulo IV desarrollado con Scrum'
d.save(OUT)
print(OUT)
