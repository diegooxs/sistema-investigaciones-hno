USE hno_investigaciones;

ALTER TABLE documentos MODIFY tipo ENUM(
  'ANEXO_1','ANEXO_2','ANEXO_3','ANEXO_4',
  'ANEXO_A','ANEXO_E','ANEXO_G','ANEXO_I',
  'INVESTIGACION_PDF','OTRO'
) NOT NULL;

UPDATE documentos SET tipo = 'ANEXO_A' WHERE tipo = 'ANEXO_1';
UPDATE documentos SET tipo = 'ANEXO_E' WHERE tipo = 'ANEXO_2';
UPDATE documentos SET tipo = 'ANEXO_G' WHERE tipo = 'ANEXO_3';
UPDATE documentos SET tipo = 'ANEXO_I' WHERE tipo = 'ANEXO_4';

ALTER TABLE documentos MODIFY tipo ENUM(
  'ANEXO_A','ANEXO_E','ANEXO_G','ANEXO_I','INVESTIGACION_PDF','OTRO'
) NOT NULL;
