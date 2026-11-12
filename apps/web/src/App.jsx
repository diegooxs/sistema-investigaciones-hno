import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001/api/v1";
const navigation = [
  { key: "panel", label: "Panel general", icon: "⌂" },
  {
    key: "investigaciones",
    label: "Investigaciones",
    icon: "▤",
    researchOnly: true,
  },
  { key: "revisiones", label: "Revisiones", icon: "✓" },
  { key: "evaluaciones", label: "Evaluaciones", icon: "☆" },
  { key: "publicaciones", label: "Publicaciones", icon: "◫" },
  { key: "usuarios", label: "Usuarios y permisos", icon: "♙", adminOnly: true },
];
const documentTypes = [
  ["ANEXO_A", "Anexo A — Ficha de registro"],
  ["ANEXO_E", "Anexo E — Protocolo"],
  ["ANEXO_G", "Anexo G — Carta compromiso"],
  ["ANEXO_I", "Anexo I — Consentimiento informado"],
  ["INVESTIGACION_PDF", "Investigación PDF"],
  ["OTRO", "Otro documento"],
];
const documentTypeLabels = Object.fromEntries(documentTypes);
const requiredDocumentTypes = [
  "ANEXO_A",
  "ANEXO_E",
  "ANEXO_G",
  "ANEXO_I",
  "INVESTIGACION_PDF",
];
const researchStateLabels = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  CON_OBSERVACIONES: "Con observaciones",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  PUBLICADA: "Publicada",
};

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function api(path, session, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof Blob)
        ? { "Content-Type": "application/json" }
        : {}),
      Authorization: `Bearer ${session.token}`,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.error ?? "No fue posible completar la operación");
  return data;
}

async function download(path, session, fallbackName) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({}))).error ??
        "No fue posible descargar el archivo",
    );
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") ?? "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = encodedName ? decodeURIComponent(encodedName) : fallbackName;
  link.click();
  URL.revokeObjectURL(link.href);
}

function Sidebar({
  collapsed,
  setCollapsed,
  onLogout,
  currentView,
  onNavigate,
  roles,
}) {
  const availableNavigation = navigation.filter(
    (item) =>
      (!item.adminOnly || roles.includes("ADMINISTRADOR")) &&
      (!item.researchOnly ||
        roles.some((role) =>
          ["ADMINISTRADOR", "ADMIN_INVESTIGADOR", "INVESTIGADOR"].includes(
            role,
          ),
        )),
  );
  return (
    <aside className={`sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="sidebar-brand-panel">
        <img
          className="sidebar-logo-full"
          src="/hno-logo.png"
          alt="Hospital de la Niñez Oaxaqueña"
        />
        <span className="sidebar-logo-symbol" aria-hidden="true">
          <img src="/hno-logo.png" alt="" />
        </span>
      </div>
      <button
        className="collapse-button"
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Mostrar menú" : "Ocultar menú"}
      >
        {collapsed ? "›" : "‹"}
      </button>
      <nav aria-label="Navegación principal">
        {availableNavigation.map((item) => (
          <button
            className={currentView === item.key ? "active" : ""}
            type="button"
            onClick={() => onNavigate(item.key)}
            key={item.key}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Cerrar sesión" : undefined}
        >
          <span className="nav-icon" aria-hidden="true">
            ↪
          </span>
          <span className="nav-label">Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

function Panel({ investigations, onOpenResearch }) {
  const summary = [
    {
      label: "Investigaciones registradas",
      value: investigations.length,
      detail: investigations.length
        ? "Expedientes disponibles"
        : "Sin registros",
      tone: "wine",
    },
    {
      label: "Borradores",
      value: investigations.filter((item) => item.state === "BORRADOR").length,
      detail: "En preparación",
      tone: "gold",
    },
    {
      label: "Documentos vigentes",
      value: investigations.reduce(
        (total, item) => total + (item.documentCount ?? 0),
        0,
      ),
      detail: "Control de versiones",
      tone: "teal",
    },
    {
      label: "Expedientes con documentos",
      value: investigations.filter((item) => item.documentCount > 0).length,
      detail: "Con avance documental",
      tone: "purple",
    },
  ];
  return (
    <>
      <section className="welcome">
        <div>
          <p className="section-label light">Hospital de la Niñez Oaxaqueña</p>
          <h2>Bienvenido al sistema de investigaciones</h2>
          <p>Registra investigaciones y conserva sus documentos por versión.</p>
        </div>
        <div className="welcome-emblem">
          <img src="/hno-logo.png" alt="Hospital de la Niñez Oaxaqueña" />
        </div>
      </section>
      <section className="summary-grid" aria-label="Resumen general">
        {summary.map((item) => (
          <article className={`summary-card ${item.tone}`} key={item.label}>
            <div className="card-accent" />
            <p>{item.label}</p>
            <strong>{item.value}</strong>
            <span>{item.detail}</span>
          </article>
        ))}
      </section>
      <section className="content-grid">
        <article className="activity-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Sprint 3</p>
              <h2>Registro y gestión documental</h2>
            </div>
            <button
              type="button"
              className="outline-button"
              onClick={onOpenResearch}
            >
              Abrir módulo
            </button>
          </div>
          <div className="empty-state">
            <div className="empty-icon">▤</div>
            <h3>
              {investigations.length
                ? `${investigations.length} expediente(s) registrado(s)`
                : "Aún no hay investigaciones"}
            </h3>
            <p>
              El módulo permite registrar datos, descargar plantillas y
              controlar versiones de anexos y PDF.
            </p>
          </div>
        </article>
        <aside className="quick-panel">
          <p className="section-label">Alcance actual</p>
          <h2>Incremento del Sprint 3</h2>
          <div className="scope-list">
            <span>✓ Registro y actualización</span>
            <span>✓ Descarga de plantillas</span>
            <span>✓ Carga de anexos y PDF</span>
            <span>✓ Historial de versiones</span>
          </div>
        </aside>
      </section>
    </>
  );
}

function ResearchForm({
  initialValues,
  researchers = [],
  currentUser,
  onSaved,
  onCancel,
}) {
  const [saving, setSaving] = useState(false);
  const canAssignResponsible =
    !initialValues &&
    currentUser?.roles.some((role) =>
      ["ADMINISTRADOR", "ADMIN_INVESTIGADOR"].includes(role),
    );
  const fixedResponsible = initialValues?.investigator ?? currentUser;
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await onSaved(Object.fromEntries(form));
      if (!initialValues) formElement.reset();
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="research-form" onSubmit={submit}>
      <div className="form-heading">
        <div>
          <p className="section-label">
            {initialValues ? "Edición del expediente" : "Nuevo expediente"}
          </p>
          <h2>
            {initialValues
              ? "Actualizar investigación"
              : "Registrar investigación"}
          </h2>
        </div>
        {onCancel && (
          <button type="button" className="text-button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
      {canAssignResponsible ? (
        <label className="wide">
          Responsable de la investigación
          <select name="investigatorId" required defaultValue="">
            <option value="" disabled>
              Selecciona al investigador responsable
            </option>
            {researchers.map((researcher) => (
              <option value={researcher.id} key={researcher.id}>
                {researcher.name} — {researcher.email}
              </option>
            ))}
          </select>
          <small>
            El expediente aparecerá en la cuenta de la persona seleccionada.
          </small>
        </label>
      ) : (
        <div className="responsible-card wide">
          <span>Responsable de la investigación</span>
          <strong>{fixedResponsible?.name}</strong>
          <small>{fixedResponsible?.email}</small>
        </div>
      )}
      <label className="wide">
        Título de la investigación
        <input
          name="title"
          required
          maxLength="500"
          defaultValue={initialValues?.title ?? ""}
          placeholder="Escribe el título completo"
        />
      </label>
      <label>
        Área de conocimiento
        <input
          name="area"
          maxLength="150"
          defaultValue={initialValues?.area ?? ""}
          placeholder="Ej. Pediatría"
        />
      </label>
      <label>
        Categoría
        <input
          name="category"
          maxLength="100"
          defaultValue={initialValues?.category ?? ""}
          placeholder="Ej. Investigación clínica"
        />
      </label>
      <label className="wide">
        Resumen
        <textarea
          name="summary"
          rows="4"
          defaultValue={initialValues?.summary ?? ""}
          placeholder="Describe el propósito y alcance de la investigación"
        />
      </label>
      <div className="form-actions wide">
        <button
          className="primary-button"
          disabled={
            saving || (canAssignResponsible && researchers.length === 0)
          }
        >
          {saving
            ? "Guardando..."
            : initialValues
              ? "Guardar cambios"
              : "Guardar borrador"}
        </button>
      </div>
    </form>
  );
}

function DocumentManager({
  research,
  documents,
  researchers,
  session,
  onUploaded,
  onUpdated,
  setMessage,
}) {
  const [uploading, setUploading] = useState(false);
  const [selectedType, setSelectedType] = useState("ANEXO_A");
  const [editing, setEditing] = useState(false);
  const currentTypes = new Set(
    documents.filter((item) => item.current).map((item) => item.type),
  );
  const completedRequired = requiredDocumentTypes.filter((type) =>
    currentTypes.has(type),
  ).length;
  const completion = Math.round(
    (completedRequired / requiredDocumentTypes.length) * 100,
  );
  async function uploadFile(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return;
    setUploading(true);
    try {
      const response = await fetch(
        `${API_URL}/investigations/${research.id}/documents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.token}`,
            "Content-Type": "application/octet-stream",
            "X-Document-Type": form.get("type"),
            "X-File-Name": encodeURIComponent(file.name),
            "X-File-Mime": file.type || "application/octet-stream",
          },
          body: file,
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error ?? "No fue posible cargar el archivo");
      formElement.reset();
      setMessage("Documento cargado y versión registrada.");
      await onUploaded();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setUploading(false);
    }
  }
  const canCorrect = ["BORRADOR", "CON_OBSERVACIONES"].includes(research.state);
  if (editing)
    return (
      <ResearchForm
        initialValues={research}
        researchers={researchers}
        currentUser={session.user}
        onCancel={() => setEditing(false)}
        onSaved={async (payload) => {
          await onUpdated(payload);
          setEditing(false);
        }}
      />
    );
  return (
    <section className="document-panel">
      <div className="detail-heading">
        <div>
          <p className="section-label">Expediente #{research.id}</p>
          <h2>{research.title}</h2>
          <p>
            {research.investigator.name} ·{" "}
            <span className="state-badge">
              {researchStateLabels[research.state] ?? research.state}
            </span>
          </p>
        </div>
        {canCorrect && (
          <button
            type="button"
            className="outline-button"
            onClick={() => setEditing(true)}
          >
            Editar datos
          </button>
        )}
      </div>
      <dl className="research-meta">
        <div>
          <dt>Área</dt>
          <dd>{research.area || "Sin especificar"}</dd>
        </div>
        <div>
          <dt>Categoría</dt>
          <dd>{research.category || "Sin especificar"}</dd>
        </div>
        <div>
          <dt>Actualización</dt>
          <dd>{new Date(research.updatedAt).toLocaleDateString("es-MX")}</dd>
        </div>
      </dl>
      {research.summary && (
        <p className="research-summary">{research.summary}</p>
      )}
      <section className="document-progress">
        <div className="progress-heading">
          <div>
            <strong>Integración del expediente</strong>
            <span>
              {completedRequired} de {requiredDocumentTypes.length} documentos
              requeridos
            </span>
          </div>
          <b>{completion}%</b>
        </div>
        <div className="progress-track">
          <span style={{ width: `${completion}%` }} />
        </div>
        <div className="document-checklist">
          {requiredDocumentTypes.map((type) => (
            <span
              className={currentTypes.has(type) ? "complete" : ""}
              key={type}
            >
              {currentTypes.has(type) ? "✓" : "○"} {documentTypeLabels[type]}
            </span>
          ))}
        </div>
      </section>
      {canCorrect ? (
        <form className="upload-form" onSubmit={uploadFile}>
          <label>
            Tipo documental
            <select
              name="type"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value)}
            >
              {documentTypes.map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="file-field">
            Archivo
            <input
              name="file"
              type="file"
              required
              accept={
                selectedType === "INVESTIGACION_PDF"
                  ? ".pdf,application/pdf"
                  : ".pdf,.doc,.docx,.rtf,.odt"
              }
            />
            <small>
              {research.state === "CON_OBSERVACIONES"
                ? "Carga la versión corregida antes de reenviar el expediente."
                : selectedType === "INVESTIGACION_PDF"
                  ? "Solamente archivos PDF."
                  : "PDF, DOC, DOCX, RTF u ODT. Máximo 10 MB."}
            </small>
          </label>
          <button className="primary-button" disabled={uploading}>
            {uploading
              ? "Cargando..."
              : research.state === "CON_OBSERVACIONES"
                ? "Cargar corrección"
                : "Cargar versión"}
          </button>
        </form>
      ) : (
        <p className="locked-notice">
          La carga documental está cerrada durante la revisión. Se habilitará si
          el comité solicita correcciones.
        </p>
      )}
      <div className="version-list">
        <div className="panel-heading">
          <div>
            <p className="section-label">Control documental</p>
            <h3>Versiones registradas</h3>
          </div>
          <span>{documents.length} archivo(s)</span>
        </div>
        {documents.length === 0 ? (
          <p className="muted-message">No se han cargado documentos.</p>
        ) : (
          documents.map((item) => (
            <article key={item.id}>
              <div className="file-icon">
                {item.mimeType === "application/pdf" ? "PDF" : "DOC"}
              </div>
              <div>
                <strong>{item.originalName}</strong>
                <span>
                  {documentTypeLabels[item.type] ?? item.type} · versión{" "}
                  {item.version} · {formatFileSize(item.size)}
                </span>
                <small>
                  Cargado por {item.uploadedByName || "usuario institucional"}{" "}
                  el{" "}
                  {new Date(item.createdAt).toLocaleString("es-MX", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </small>
              </div>
              {item.current && <b>Vigente</b>}
              <button
                type="button"
                onClick={() =>
                  download(
                    `/documents/${item.id}/download`,
                    session,
                    item.originalName,
                  )
                }
              >
                Descargar
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ResearchWorkspace({
  session,
  investigations,
  refreshInvestigations,
  setMessage,
}) {
  const [showForm, setShowForm] = useState(investigations.length === 0);
  const [selectedId, setSelectedId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("TODOS");
  const selected = investigations.find((item) => item.id === selectedId);
  const [templates, setTemplates] = useState([]);
  const [researchers, setResearchers] = useState([]);
  const filteredInvestigations = useMemo(
    () =>
      investigations.filter((item) => {
        const term = query.trim().toLocaleLowerCase("es-MX");
        const matchesText =
          !term ||
          [item.title, item.area, item.category, item.investigator.name].some(
            (value) =>
              String(value ?? "")
                .toLocaleLowerCase("es-MX")
                .includes(term),
          );
        return (
          matchesText && (stateFilter === "TODOS" || item.state === stateFilter)
        );
      }),
    [investigations, query, stateFilter],
  );
  useEffect(() => {
    api("/templates", session)
      .then((result) => setTemplates(result.data))
      .catch((error) => setMessage(error.message));
  }, [session, setMessage]);
  useEffect(() => {
    api("/researchers", session)
      .then((result) => setResearchers(result.data))
      .catch((error) => setMessage(error.message));
  }, [session, setMessage]);
  async function createResearch(payload) {
    try {
      const result = await api("/investigations", session, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refreshInvestigations();
      setSelectedId(result.data.id);
      setShowForm(false);
      setMessage("Investigación registrada como borrador.");
      await loadDocuments(result.data.id);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function updateResearch(id, payload) {
    try {
      await api(`/investigations/${id}`, session, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      await refreshInvestigations();
      setMessage("Los datos de la investigación fueron actualizados.");
    } catch (error) {
      setMessage(error.message);
      throw error;
    }
  }
  async function loadDocuments(id) {
    try {
      const result = await api(`/investigations/${id}/documents`, session);
      setDocuments(result.data);
    } catch (error) {
      setMessage(error.message);
    }
  }
  function selectResearch(id) {
    setSelectedId(id);
    setShowForm(false);
    loadDocuments(id);
  }
  return (
    <div className="research-workspace">
      <div className="workspace-header">
        <div>
          <p className="section-label">Sprint 3</p>
          <h2>Investigaciones y documentos</h2>
          <p>
            Registra expedientes, utiliza las plantillas y conserva cada versión
            documental.
          </p>
        </div>
        <button
          className="primary-button compact"
          type="button"
          onClick={() => {
            setShowForm(true);
            setSelectedId(null);
          }}
        >
          Nueva investigación
        </button>
      </div>
      {showForm && (
        <ResearchForm
          researchers={researchers}
          currentUser={session.user}
          onSaved={createResearch}
          onCancel={investigations.length ? () => setShowForm(false) : null}
        />
      )}
      <div className="workspace-grid">
        <section className="research-list">
          <div className="list-heading">
            <h3>Expedientes</h3>
            <span>{filteredInvestigations.length}</span>
          </div>
          <div className="research-filters">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por título, área o responsable"
              aria-label="Buscar expedientes"
            />
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              aria-label="Filtrar por estado"
            >
              <option value="TODOS">Todos los estados</option>
              {Object.entries(researchStateLabels).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {investigations.length === 0 ? (
            <p className="muted-message">
              Registra la primera investigación para comenzar.
            </p>
          ) : filteredInvestigations.length === 0 ? (
            <p className="muted-message">
              No hay expedientes que coincidan con la búsqueda.
            </p>
          ) : (
            filteredInvestigations.map((item) => (
              <button
                type="button"
                className={selectedId === item.id ? "selected" : ""}
                onClick={() => selectResearch(item.id)}
                key={item.id}
              >
                <span className="research-number">#{item.id}</span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {item.area || "Área sin especificar"} ·{" "}
                    {researchStateLabels[item.state] ?? item.state}
                  </small>
                </div>
                <b>›</b>
              </button>
            ))
          )}
        </section>
        <div>
          {selected ? (
            <DocumentManager
              research={selected}
              documents={documents}
              researchers={researchers}
              session={session}
              setMessage={setMessage}
              onUpdated={(payload) => updateResearch(selected.id, payload)}
              onUploaded={async () => {
                await loadDocuments(selected.id);
                await refreshInvestigations();
              }}
            />
          ) : (
            !showForm && (
              <div className="selection-placeholder">
                <div>▤</div>
                <h3>Selecciona una investigación</h3>
                <p>
                  Consulta sus datos y administra los documentos del expediente.
                </p>
              </div>
            )
          )}
        </div>
      </div>
      <section className="templates-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">Formatos de apoyo</p>
            <h2>Plantillas descargables</h2>
          </div>
          <span>La institución deberá validar el contenido definitivo.</span>
        </div>
        <div className="template-grid">
          {templates.map((template) => (
            <article key={template.code}>
              <div className="template-icon">W</div>
              <div>
                <strong>{template.name}</strong>
                <span>Documento editable de Word</span>
              </div>
              <button
                type="button"
                onClick={() =>
                  download(
                    `/templates/${template.code}/download`,
                    session,
                    template.fileName,
                  )
                }
              >
                Descargar
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function UserManagement({ session, setMessage }) {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  async function loadUsers() {
    const [userResult, roleResult] = await Promise.all([
      api("/users", session),
      api("/meta/roles", session),
    ]);
    setUsers(userResult.data);
    setRoles(roleResult.data);
  }
  useEffect(() => {
    loadUsers().catch((error) => setMessage(error.message));
  }, [session, setMessage]);

  async function createUser(event) {
    event.preventDefault();
    setSaving(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/users", session, {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          password: form.get("password"),
          roles: form.getAll("roles"),
        }),
      });
      formElement.reset();
      setShowForm(false);
      await loadUsers();
      setMessage("Usuario registrado correctamente.");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }
  async function updateUser(id, changes, successMessage) {
    try {
      await api(`/users/${id}`, session, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      await loadUsers();
      setMessage(successMessage);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function submitPassword(event, userId) {
    event.preventDefault();
    if (resetPassword.length < 8)
      return setMessage("La contraseña debe tener al menos 8 caracteres.");
    await updateUser(
      userId,
      { password: resetPassword },
      "Contraseña restablecida correctamente.",
    );
    setResetPassword("");
    setResetUserId(null);
  }
  return (
    <section className="user-management">
      <div className="workspace-header">
        <div>
          <p className="section-label">Administración</p>
          <h2>Usuarios y permisos</h2>
          <p>
            Registra cuentas, asigna funciones y controla el acceso al sistema.
          </p>
        </div>
        <button
          className="primary-button compact"
          type="button"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Cerrar formulario" : "Nuevo usuario"}
        </button>
      </div>
      {showForm && (
        <form className="user-form" onSubmit={createUser}>
          <div className="form-heading">
            <div>
              <p className="section-label">Nueva cuenta</p>
              <h2>Registrar usuario</h2>
            </div>
          </div>
          <label>
            Nombre completo
            <input
              name="name"
              required
              maxLength="120"
              placeholder="Nombre y apellidos"
            />
          </label>
          <label>
            Correo institucional
            <input
              name="email"
              type="email"
              required
              maxLength="190"
              placeholder="usuario@institucion.mx"
            />
          </label>
          <label>
            Contraseña temporal
            <input
              name="password"
              type="password"
              required
              minLength="8"
              placeholder="Mínimo 8 caracteres"
            />
          </label>
          <fieldset className="role-selector">
            <legend>Roles asignados</legend>
            {roles.map((role) => (
              <label key={role.code}>
                <input type="checkbox" name="roles" value={role.code} />
                <span>{role.name}</span>
              </label>
            ))}
          </fieldset>
          <div className="form-actions wide">
            <button className="primary-button" disabled={saving}>
              {saving ? "Registrando..." : "Registrar usuario"}
            </button>
          </div>
        </form>
      )}
      <div className="users-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">Directorio institucional</p>
            <h2>Cuentas registradas</h2>
          </div>
          <span>{users.length} usuario(s)</span>
        </div>
        <div className="users-table-wrap">
          <table className="users-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Roles</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <React.Fragment key={user.id}>
                  <tr>
                    <td>
                      <strong>{user.name}</strong>
                      <span>{user.email}</span>
                    </td>
                    <td>
                      <div className="inline-roles">
                        {roles.map((role) => (
                          <label key={role.code} title={role.name}>
                            <input
                              type="checkbox"
                              checked={user.roles.includes(role.code)}
                              disabled={
                                user.id === session.user.id &&
                                role.code === "ADMINISTRADOR"
                              }
                              onChange={(event) => {
                                const nextRoles = event.target.checked
                                  ? [...user.roles, role.code]
                                  : user.roles.filter(
                                      (item) => item !== role.code,
                                    );
                                updateUser(
                                  user.id,
                                  { roles: nextRoles },
                                  "Roles actualizados.",
                                );
                              }}
                            />
                            <span>{role.name}</span>
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`user-status ${user.active ? "active" : "inactive"}`}
                      >
                        {user.active ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div className="user-actions">
                        <button
                          type="button"
                          className="outline-button"
                          disabled={user.id === session.user.id}
                          onClick={() =>
                            updateUser(
                              user.id,
                              { active: !user.active },
                              user.active
                                ? "Usuario desactivado."
                                : "Usuario activado.",
                            )
                          }
                        >
                          {user.active ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => {
                            setResetUserId(
                              resetUserId === user.id ? null : user.id,
                            );
                            setResetPassword("");
                          }}
                        >
                          Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                  {resetUserId === user.id && (
                    <tr className="password-row">
                      <td colSpan="4">
                        <form
                          onSubmit={(event) => submitPassword(event, user.id)}
                        >
                          <label>
                            Nueva contraseña para {user.name}
                            <input
                              type="password"
                              value={resetPassword}
                              onChange={(event) =>
                                setResetPassword(event.target.value)
                              }
                              required
                              minLength="8"
                              placeholder="Mínimo 8 caracteres"
                            />
                          </label>
                          <button className="primary-button compact">
                            Guardar contraseña
                          </button>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setResetUserId(null)}
                          >
                            Cancelar
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function CommitteeMembers({ committee, reviewers, onSave }) {
  const [memberIds, setMemberIds] = useState(committee.memberIds);
  useEffect(() => setMemberIds(committee.memberIds), [committee.memberIds]);
  return (
    <article>
      <strong>{committee.name}</strong>
      <small>{committee.type}</small>
      <div>
        {reviewers.map((reviewer) => (
          <label key={reviewer.id}>
            <input
              type="checkbox"
              checked={memberIds.includes(reviewer.id)}
              onChange={(event) =>
                setMemberIds((current) =>
                  event.target.checked
                    ? [...current, reviewer.id]
                    : current.filter((id) => id !== reviewer.id),
                )
              }
            />
            <span>{reviewer.name}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        className="outline-button"
        onClick={() => onSave(committee, memberIds)}
      >
        Guardar integrantes
      </button>
    </article>
  );
}

function ReviewWorkspace({
  session,
  investigations,
  refreshInvestigations,
  setMessage,
}) {
  const isManager = session.user.roles.some((role) =>
    ["ADMINISTRADOR", "ADMIN_INVESTIGADOR"].includes(role),
  );
  const [rounds, setRounds] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [reviewers, setReviewers] = useState([]);
  const [selectedResearch, setSelectedResearch] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [selectedAssignments, setSelectedAssignments] = useState([]);

  async function load() {
    const requests = [api("/rounds", session), api("/committees", session)];
    if (isManager) requests.push(api("/reviewers", session));
    const [roundResult, committeeResult, reviewerResult] =
      await Promise.all(requests);
    setRounds(roundResult.data);
    setCommittees(committeeResult.data);
    setReviewers(reviewerResult?.data ?? []);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [session, isManager]);

  function toggleAssignment(committeeId, memberId) {
    const key = `${committeeId}:${memberId}`;
    setSelectedAssignments((current) =>
      current.some((item) => item.key === key)
        ? current.filter((item) => item.key !== key)
        : [...current, { key, committeeId, memberId }],
    );
  }
  async function saveMembers(committee, memberIds) {
    try {
      await api(`/committees/${committee.id}/members`, session, {
        method: "PATCH",
        body: JSON.stringify({ memberIds }),
      });
      await load();
      setMessage(`Integrantes de ${committee.name} actualizados.`);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function createRound(event) {
    event.preventDefault();
    try {
      await api(`/investigations/${selectedResearch}/rounds`, session, {
        method: "POST",
        body: JSON.stringify({
          dueAt: new Date(dueAt).toISOString(),
          assignments: selectedAssignments.map(({ committeeId, memberId }) => ({
            committeeId,
            memberId,
          })),
        }),
      });
      setSelectedResearch("");
      setDueAt("");
      setSelectedAssignments([]);
      await Promise.all([load(), refreshInvestigations()]);
      setMessage("Ronda abierta y asignada a los revisores seleccionados.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function startAssignment(id) {
    try {
      await api(`/assignments/${id}/status`, session, {
        method: "PATCH",
        body: JSON.stringify({ status: "EN_PROCESO" }),
      });
      await load();
      setMessage("La revisión quedó marcada como en proceso.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <section className="review-workspace">
      <div className="workspace-header">
        <div>
          <p className="section-label">Sprint 4</p>
          <h2>Rondas y asignaciones</h2>
          <p>Organiza la revisión por comité, responsable y fecha límite.</p>
        </div>
        <span className="sprint-chip">Incremento operativo</span>
      </div>
      {isManager && (
        <>
          <form className="round-form" onSubmit={createRound}>
            <div className="form-heading">
              <div>
                <p className="section-label">Nueva ronda</p>
                <h3>Asignar expediente a revisión</h3>
              </div>
            </div>
            <label>
              Investigación en borrador
              <select
                value={selectedResearch}
                onChange={(event) => setSelectedResearch(event.target.value)}
                required
              >
                <option value="">Selecciona un expediente</option>
                {investigations
                  .filter((item) => item.state === "BORRADOR")
                  .map((item) => (
                    <option value={item.id} key={item.id}>
                      #{item.id} — {item.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Fecha y hora límite
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                required
              />
            </label>
            <fieldset className="assignment-selector">
              <legend>Integrantes asignados</legend>
              {committees.map((committee) => {
                const available = reviewers.filter((reviewer) =>
                  committee.memberIds.includes(reviewer.id),
                );
                return (
                  <div key={committee.id}>
                    <strong>{committee.name}</strong>
                    {available.map((reviewer) => {
                      const key = `${committee.id}:${reviewer.id}`;
                      return (
                        <label key={key}>
                          <input
                            type="checkbox"
                            checked={selectedAssignments.some(
                              (item) => item.key === key,
                            )}
                            onChange={() =>
                              toggleAssignment(committee.id, reviewer.id)
                            }
                          />
                          <span>{reviewer.name}</span>
                        </label>
                      );
                    })}
                    {!available.length && (
                      <small>Configura integrantes para este comité.</small>
                    )}
                  </div>
                );
              })}
            </fieldset>
            <button
              className="primary-button"
              disabled={!selectedAssignments.length}
            >
              Abrir ronda
            </button>
          </form>
          <section className="committee-config">
            <div className="panel-heading">
              <div>
                <p className="section-label">Directorio</p>
                <h3>Integrantes de los comités</h3>
              </div>
            </div>
            <div className="committee-grid">
              {committees.map((committee) => (
                <CommitteeMembers
                  key={committee.id}
                  committee={committee}
                  reviewers={reviewers}
                  onSave={saveMembers}
                />
              ))}
            </div>
          </section>
        </>
      )}
      <section className="rounds-panel">
        <div className="panel-heading">
          <div>
            <p className="section-label">Seguimiento</p>
            <h3>Rondas visibles para tu rol</h3>
          </div>
          <span>{rounds.length} ronda(s)</span>
        </div>
        {!rounds.length ? (
          <p className="muted-message">Todavía no hay rondas asignadas.</p>
        ) : (
          <div className="round-list">
            {rounds.map((round) => (
              <article key={round.id}>
                <div className="round-summary">
                  <span className="round-number">Ronda {round.number}</span>
                  <div>
                    <strong>{round.research.title}</strong>
                    <small>
                      Vence{" "}
                      {new Date(round.dueAt).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </small>
                  </div>
                  <span className="status-pill">
                    {round.state.replaceAll("_", " ")}
                  </span>
                </div>
                <div className="round-progress">
                  <span
                    style={{
                      width: `${round.assignmentCount ? Math.round((round.completedCount / round.assignmentCount) * 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="round-count">
                  {round.completedCount} de {round.assignmentCount} revisiones
                  completadas
                </p>
                {round.assignments.map((assignment) => (
                  <div className="assignment-row" key={assignment.id}>
                    <div>
                      <strong>{assignment.committee.name}</strong>
                      <span>
                        {assignment.member.name} ·{" "}
                        {assignment.state.replaceAll("_", " ")}
                      </span>
                    </div>
                    {assignment.evaluation ? (
                      <b>{assignment.evaluation.score.toFixed(1)} / 100</b>
                    ) : assignment.state === "PENDIENTE" &&
                      session.user.id === assignment.memberId ? (
                      <button
                        type="button"
                        className="outline-button"
                        onClick={() => startAssignment(assignment.id)}
                      >
                        Iniciar revisión
                      </button>
                    ) : (
                      <span>Pendiente de evaluación</span>
                    )}
                  </div>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function EvaluationWorkspace({
  session,
  investigations,
  refreshInvestigations,
  setMessage,
}) {
  const isManager = session.user.roles.some((role) =>
    ["ADMINISTRADOR", "ADMIN_INVESTIGADOR"].includes(role),
  );
  const isReviewer = session.user.roles.includes("COMITE");
  const canSeeFeedback = session.user.roles.some((role) =>
    ["ADMINISTRADOR", "ADMIN_INVESTIGADOR", "INVESTIGADOR"].includes(role),
  );
  const [rounds, setRounds] = useState([]);
  const [rubrics, setRubrics] = useState([]);
  const [committees, setCommittees] = useState([]);
  const [criteria, setCriteria] = useState([
    { description: "", weight: 50, maximumScore: 10 },
    { description: "", weight: 50, maximumScore: 10 },
  ]);
  const [selectedAssignment, setSelectedAssignment] = useState("");
  const [selectedRubric, setSelectedRubric] = useState("");
  const [scores, setScores] = useState({});
  const [feedbackResearch, setFeedbackResearch] = useState("");
  const [feedback, setFeedback] = useState([]);

  async function load() {
    const [roundResult, rubricResult, committeeResult] = await Promise.all([
      api("/rounds", session),
      api("/rubrics", session),
      api("/committees", session),
    ]);
    setRounds(roundResult.data);
    setRubrics(rubricResult.data);
    setCommittees(committeeResult.data);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [session]);
  const assignments = rounds.flatMap((round) =>
    round.assignments.map((assignment) => ({ ...assignment, round })),
  );
  const assignment = assignments.find(
    (item) => item.id === Number(selectedAssignment),
  );
  const matchingRubrics = rubrics.filter(
    (item) => !assignment || item.committeeId === assignment.committeeId,
  );
  const rubric = matchingRubrics.find(
    (item) => item.id === Number(selectedRubric),
  );

  async function createRubric(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/rubrics", session, {
        method: "POST",
        body: JSON.stringify({
          committeeId: Number(form.get("committeeId")),
          name: form.get("name"),
          criteria,
        }),
      });
      setCriteria([
        { description: "", weight: 50, maximumScore: 10 },
        { description: "", weight: 50, maximumScore: 10 },
      ]);
      formElement.reset();
      await load();
      setMessage("Rúbrica guardada y activada para el comité.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function submitEvaluation(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/assignments/${selectedAssignment}/evaluation`, session, {
        method: "PUT",
        body: JSON.stringify({
          rubricId: Number(selectedRubric),
          scores: rubric.criteria.map((item) => ({
            criterionId: item.id,
            score: Number(scores[item.id]),
          })),
          recommendation: form.get("recommendation"),
          generalObservation: form.get("generalObservation"),
        }),
      });
      await Promise.all([load(), refreshInvestigations()]);
      setMessage("Evaluación registrada y calificación calculada.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function loadFeedback(id) {
    setFeedbackResearch(id);
    if (!id) return setFeedback([]);
    try {
      setFeedback((await api(`/investigations/${id}/feedback`, session)).data);
    } catch (error) {
      setMessage(error.message);
    }
  }
  async function resubmit(id) {
    try {
      await api(`/investigations/${id}/resubmit`, session, { method: "POST" });
      await Promise.all([load(), refreshInvestigations()]);
      await loadFeedback(id);
      setMessage("Las correcciones se enviaron a una nueva ronda.");
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <section className="evaluation-workspace">
      <div className="workspace-header">
        <div>
          <p className="section-label">Sprint 5</p>
          <h2>Rúbricas, evaluación y correcciones</h2>
          <p>
            Evalúa con criterios objetivos y conserva la trazabilidad de las
            observaciones.
          </p>
        </div>
        <span className="sprint-chip">Incremento operativo</span>
      </div>
      {isManager && (
        <form className="rubric-form" onSubmit={createRubric}>
          <div className="form-heading">
            <div>
              <p className="section-label">Configuración</p>
              <h3>Nueva versión de rúbrica</h3>
            </div>
            <b>
              {criteria.reduce(
                (total, item) => total + Number(item.weight || 0),
                0,
              )}
              % ponderado
            </b>
          </div>
          <label>
            Comité
            <select name="committeeId" required defaultValue="">
              <option value="" disabled>
                Selecciona un comité
              </option>
              {committees.map((committee) => (
                <option value={committee.id} key={committee.id}>
                  {committee.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Nombre de la rúbrica
            <input
              name="name"
              required
              placeholder="Ej. Evaluación ética del protocolo"
            />
          </label>
          <div className="criteria-editor">
            {criteria.map((criterion, index) => (
              <div key={index}>
                <input
                  aria-label={`Criterio ${index + 1}`}
                  value={criterion.description}
                  onChange={(event) =>
                    setCriteria((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    )
                  }
                  required
                  placeholder="Descripción del criterio"
                />
                <label>
                  Peso %
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={criterion.weight}
                    onChange={(event) =>
                      setCriteria((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, weight: event.target.value }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                </label>
                <label>
                  Puntaje máximo
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={criterion.maximumScore}
                    onChange={(event) =>
                      setCriteria((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, maximumScore: event.target.value }
                            : item,
                        ),
                      )
                    }
                    required
                  />
                </label>
                {criteria.length > 2 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setCriteria((current) =>
                        current.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                  >
                    Quitar
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="outline-button"
              onClick={() =>
                setCriteria((current) => [
                  ...current,
                  { description: "", weight: 0, maximumScore: 10 },
                ])
              }
            >
              Agregar criterio
            </button>
            <button className="primary-button">Guardar rúbrica</button>
          </div>
        </form>
      )}
      {isReviewer && (
        <form className="evaluation-form" onSubmit={submitEvaluation}>
          <div className="form-heading">
            <div>
              <p className="section-label">Bandeja del revisor</p>
              <h3>Registrar evaluación</h3>
            </div>
          </div>
          <label>
            Asignación
            <select
              value={selectedAssignment}
              onChange={(event) => {
                setSelectedAssignment(event.target.value);
                setSelectedRubric("");
                setScores({});
              }}
              required
            >
              <option value="">Selecciona una revisión</option>
              {assignments
                .filter(
                  (item) =>
                    item.memberId === session.user.id &&
                    item.state !== "COMPLETADA",
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    Ronda {item.round.number} · {item.round.research.title} ·{" "}
                    {item.committee.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Rúbrica activa
            <select
              value={selectedRubric}
              onChange={(event) => {
                setSelectedRubric(event.target.value);
                setScores({});
              }}
              required
              disabled={!assignment}
            >
              <option value="">Selecciona la rúbrica</option>
              {matchingRubrics
                .filter((item) => item.active)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · v{item.version}
                  </option>
                ))}
            </select>
          </label>
          {rubric && (
            <div className="score-grid">
              {rubric.criteria.map((criterion) => (
                <label key={criterion.id}>
                  <span>
                    {criterion.description}
                    <small>
                      {criterion.weight}% · máximo {criterion.maximumScore}
                    </small>
                  </span>
                  <input
                    type="number"
                    min="0"
                    max={criterion.maximumScore}
                    step="0.1"
                    value={scores[criterion.id] ?? ""}
                    onChange={(event) =>
                      setScores((current) => ({
                        ...current,
                        [criterion.id]: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
              ))}
            </div>
          )}
          <label>
            Recomendación
            <select name="recommendation" required defaultValue="">
              <option value="" disabled>
                Selecciona una recomendación
              </option>
              <option value="APROBADA">Sin correcciones</option>
              <option value="CON_CORRECCIONES">Con correcciones</option>
              <option value="RECHAZADA">No favorable para la ronda</option>
            </select>
          </label>
          <label className="wide">
            Observación general
            <textarea
              name="generalObservation"
              rows="4"
              required
              placeholder="Explica con claridad los ajustes solicitados"
            />
          </label>
          <button className="primary-button" disabled={!rubric}>
            Guardar evaluación
          </button>
        </form>
      )}
      {canSeeFeedback && (
        <section className="feedback-panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Seguimiento</p>
              <h3>Observaciones del expediente</h3>
            </div>
            <select
              value={feedbackResearch}
              onChange={(event) => loadFeedback(event.target.value)}
            >
              <option value="">Selecciona una investigación</option>
              {investigations.map((item) => (
                <option value={item.id} key={item.id}>
                  #{item.id} — {item.title}
                </option>
              ))}
            </select>
          </div>
          {feedbackResearch && !feedback.length ? (
            <p className="muted-message">
              Aún no hay evaluaciones registradas para este expediente.
            </p>
          ) : (
            <div className="feedback-list">
              {feedback.map((item, index) => (
                <article key={`${item.roundId}-${index}`}>
                  <div>
                    <span className="round-number">
                      Ronda {item.roundNumber}
                    </span>
                    <strong>{item.committee.name}</strong>
                    <small>
                      {item.rubricName} ·{" "}
                      {new Date(item.evaluatedAt).toLocaleDateString("es-MX")}
                    </small>
                  </div>
                  <b>{item.score.toFixed(1)} / 100</b>
                  <span className="status-pill">
                    {item.recommendation.replaceAll("_", " ")}
                  </span>
                  <p>{item.generalObservation || "Sin observación general."}</p>
                  <ul>
                    {item.criteria.map((score) => (
                      <li key={score.criterionId}>
                        {score.criterion.description}: {score.score} /{" "}
                        {score.criterion.maximumScore}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          )}
          {investigations.find((item) => item.id === Number(feedbackResearch))
            ?.state === "CON_OBSERVACIONES" && (
            <div className="correction-action">
              <p>
                Carga primero las versiones corregidas en “Investigaciones” y
                después envíalas a revisión.
              </p>
              <button
                type="button"
                className="primary-button"
                onClick={() => resubmit(feedbackResearch)}
              >
                Enviar correcciones
              </button>
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function NotificationCenter({ session, setMessage }) {
  const [items, setItems] = useState([]);
  async function load() {
    setItems((await api("/notifications", session)).data);
  }
  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [session]);
  async function markRead(id) {
    try {
      await api(`/notifications/${id}/read`, session, { method: "PATCH" });
      await load();
    } catch (error) {
      setMessage(error.message);
    }
  }
  return (
    <section className="notification-center">
      <div className="panel-heading">
        <div><p className="section-label">Seguimiento</p><h3>Notificaciones recientes</h3></div>
        <span className="status-pill">{items.filter((item) => !item.read).length} sin leer</span>
      </div>
      {!items.length ? <p className="muted-message">No hay notificaciones pendientes.</p> : (
        <div className="notification-list">
          {items.slice(0, 6).map((item) => (
            <article className={item.read ? "is-read" : ""} key={item.id}>
              <div><strong>{item.title}</strong><p>{item.message}</p><small>{new Date(item.createdAt).toLocaleString("es-MX")}</small></div>
              {!item.read && <button type="button" className="text-button" onClick={() => markRead(item.id)}>Marcar leída</button>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function DecisionWorkspace({ session, investigations, refreshInvestigations, setMessage }) {
  const isManager = session.user.roles.some((role) => ["ADMINISTRADOR", "ADMIN_INVESTIGADOR"].includes(role));
  const [researchId, setResearchId] = useState("");
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  async function load(id = researchId) {
    if (!id) { setSummary(null); setHistory([]); return; }
    const [decisionResult, historyResult] = await Promise.all([
      api(`/investigations/${id}/decision-summary`, session),
      api(`/investigations/${id}/history`, session),
    ]);
    setSummary(decisionResult.data);
    setHistory(historyResult.data);
  }
  async function saveDecision(event, committeeId) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/investigations/${researchId}/committee-decisions`, session, { method: "POST", body: JSON.stringify({ committeeId, decision: form.get("decision"), observations: form.get("observations") }) });
      await load();
      await refreshInvestigations();
      setMessage("Dictamen del comité registrado.");
    } catch (error) { setMessage(error.message); }
  }
  async function authorize() {
    try {
      await api(`/investigations/${researchId}/authorize`, session, { method: "POST", body: JSON.stringify({ reason: "Autorización institucional posterior a dictámenes favorables" }) });
      await Promise.all([load(), refreshInvestigations()]);
      setMessage("Investigación autorizada institucionalmente.");
    } catch (error) { setMessage(error.message); }
  }
  return (
    <section className="decision-workspace">
      <div className="workspace-header"><div><p className="section-label">Sprint 6</p><h2>Dictamen y autorización</h2><p>Consolida las evaluaciones de los comités y conserva la trazabilidad de la decisión.</p></div><span className="sprint-chip">Control institucional</span></div>
      <label className="research-selector">Expediente
        <select value={researchId} onChange={(event) => { setResearchId(event.target.value); load(event.target.value).catch((error) => setMessage(error.message)); }}>
          <option value="">Selecciona una investigación con ronda</option>
          {investigations.filter((item) => item.state !== "BORRADOR").map((item) => <option value={item.id} key={item.id}>#{item.id} — {item.title} · {researchStateLabels[item.state]}</option>)}
        </select>
      </label>
      {summary && <>
        <div className="decision-grid">{summary.committees.map((item) => (
          <article className="decision-card" key={item.committee.id}>
            <div><strong>{item.committee.name}</strong><span>{item.completedCount} de {item.assignmentCount} evaluaciones</span></div>
            <p>Recomendaciones: {item.recommendations.join(", ").replaceAll("_", " ") || "Pendientes"}</p>
            {item.decision && <span className="status-pill">Dictamen: {item.decision.decision.replaceAll("_", " ")}</span>}
            {isManager && <form onSubmit={(event) => saveDecision(event, item.committee.id)}>
              <select name="decision" required defaultValue={item.decision?.decision ?? ""}><option value="" disabled>Selecciona el dictamen</option><option value="APROBADA">Aprobada</option><option value="CON_CORRECCIONES">Con correcciones</option><option value="RECHAZADA">Rechazada</option></select>
              <textarea name="observations" rows="3" defaultValue={item.decision?.observations ?? ""} placeholder="Fundamento u observaciones" />
              <button className="outline-button" disabled={item.completedCount !== item.assignmentCount}>Guardar dictamen</button>
            </form>}
          </article>
        ))}</div>
        {isManager && <div className="authorization-action"><div><strong>Autorización final</strong><p>{summary.allCommitteesApproved ? "Todos los comités emitieron un dictamen favorable." : "Se requieren dictámenes favorables de todos los comités."}</p></div><button type="button" className="primary-button" disabled={!summary.canAuthorize} onClick={authorize}>Autorizar investigación</button></div>}
        <div className="history-list"><h3>Historial del expediente</h3>{history.map((item) => <div key={item.id}><span>{researchStateLabels[item.previousState] ?? item.previousState ?? "Inicio"} → {researchStateLabels[item.nextState] ?? item.nextState}</span><small>{item.changedByName} · {new Date(item.createdAt).toLocaleString("es-MX")}</small><p>{item.reason}</p></div>)}</div>
      </>}
    </section>
  );
}

function PublicationWorkspace({ session, investigations, refreshInvestigations, setMessage }) {
  const isManager = session.user.roles.some((role) => ["ADMINISTRADOR", "ADMIN_INVESTIGADOR"].includes(role));
  const [items, setItems] = useState([]);
  const [report, setReport] = useState(null);
  const [query, setQuery] = useState("");
  async function load(search = query) {
    setItems((await api(`/publications?query=${encodeURIComponent(search)}`, session)).data);
    if (isManager) setReport((await api("/reports/executive", session)).data);
  }
  useEffect(() => { load("").catch((error) => setMessage(error.message)); }, [session]);
  async function publish(id) {
    try { await api(`/investigations/${id}/publish`, session, { method: "POST" }); await Promise.all([load(), refreshInvestigations()]); setMessage("La investigación quedó publicada para consulta institucional."); }
    catch (error) { setMessage(error.message); }
  }
  return (
    <section className="publication-workspace">
      <div className="workspace-header"><div><p className="section-label">Sprint 7</p><h2>Publicación, consulta y reporte</h2><p>Difunde únicamente la versión autorizada y consulta indicadores institucionales.</p></div><span className="sprint-chip">Incremento funcional</span></div>
      {isManager && <div className="publish-queue"><h3>Investigaciones autorizadas</h3>{investigations.filter((item) => item.state === "APROBADA").length ? investigations.filter((item) => item.state === "APROBADA").map((item) => <div key={item.id}><span>#{item.id} — <strong>{item.title}</strong></span><button type="button" className="primary-button" onClick={() => publish(item.id)}>Publicar versión vigente</button></div>) : <p className="muted-message">No hay investigaciones pendientes de publicación.</p>}</div>}
      <form className="publication-search" onSubmit={(event) => { event.preventDefault(); load().catch((error) => setMessage(error.message)); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título o resumen" /><button className="outline-button">Buscar</button></form>
      <div className="publication-grid">{items.map((item) => <article key={item.id}><p className="section-label">Publicación #{item.id}</p><h3>{item.research.title}</h3><p>{item.research.summary || "Sin resumen registrado."}</p><span>{item.research.area} · {item.research.category}</span><small>{item.research.investigator.name} · {new Date(item.publishedAt).toLocaleDateString("es-MX")}</small><button type="button" className="outline-button" onClick={() => download(`/publications/${item.id}/download`, session, item.document.originalName).catch((error) => setMessage(error.message))}>Descargar PDF publicado</button></article>)}</div>
      {!items.length && <p className="muted-message">Todavía no existen publicaciones activas.</p>}
      {report && <section className="executive-report"><div className="panel-heading"><div><p className="section-label">Reporte ejecutivo</p><h3>Indicadores acumulados</h3></div><small>Generado {new Date(report.generatedAt).toLocaleString("es-MX")}</small></div><div className="report-grid"><div><strong>{report.totals.investigations}</strong><span>Investigaciones</span></div><div><strong>{report.totals.inReview}</strong><span>En revisión</span></div><div><strong>{report.totals.authorized}</strong><span>Autorizadas</span></div><div><strong>{report.totals.published}</strong><span>Publicadas</span></div></div><div className="report-breakdown"><div><h4>Por estado</h4>{report.byState.map((item) => <p key={item.label}><span>{researchStateLabels[item.label] ?? item.label}</span><b>{item.total}</b></p>)}</div><div><h4>Por área</h4>{report.byArea.map((item) => <p key={item.label}><span>{item.label}</span><b>{item.total}</b></p>)}</div></div></section>}
    </section>
  );
}

function FutureModule({ title }) {
  return (
    <section className="future-module">
      <div>◌</div>
      <p className="section-label">Planificado</p>
      <h2>{title}</h2>
      <p>
        Este módulo corresponde a un Sprint posterior y todavía no forma parte
        del incremento funcional.
      </p>
    </section>
  );
}

function Dashboard({ session, onLogout }) {
  const [collapsed, setCollapsed] = useState(() => window.innerWidth <= 760);
  const [currentView, setCurrentView] = useState("panel");
  const [investigations, setInvestigations] = useState([]);
  const [message, setMessage] = useState("");
  const user = session?.user;
  const initials = useMemo(
    () =>
      user?.name
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [user],
  );
  async function refreshInvestigations() {
    if (
      !user?.roles.some((role) =>
        ["ADMINISTRADOR", "ADMIN_INVESTIGADOR", "INVESTIGADOR"].includes(role),
      )
    ) {
      setInvestigations([]);
      return;
    }
    const result = await api("/investigations", session);
    setInvestigations(result.data);
  }
  useEffect(() => {
    if (session)
      refreshInvestigations().catch((error) => setMessage(error.message));
  }, [session]);
  useEffect(() => {
    if (!message) return undefined;
    const timeout = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timeout);
  }, [message]);
  if (!user) return <Navigate to="/acceso" replace />;
  const titles = {
    panel: ["Panel general", "Administración de investigaciones científicas"],
    investigaciones: ["Investigaciones", "Registro y gestión documental"],
    revisiones: ["Revisiones", "Rondas y asignaciones"],
    evaluaciones: ["Evaluaciones", "Rúbricas y dictámenes"],
    publicaciones: ["Publicaciones", "Consulta institucional"],
    usuarios: [
      "Usuarios y permisos",
      "Administración de cuentas institucionales",
    ],
  };
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        onLogout={onLogout}
        currentView={currentView}
        roles={user.roles}
        onNavigate={(view) => {
          setCurrentView(view);
          if (window.innerWidth <= 760) setCollapsed(true);
        }}
      />
      <main>
        <header className="topbar">
          <div className="heading-group">
            <button
              className="mobile-menu"
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label="Abrir menú"
            >
              ☰
            </button>
            <div>
              <p className="section-label">Sistema institucional</p>
              <h1>{titles[currentView][0]}</h1>
              <p className="page-subtitle">{titles[currentView][1]}</p>
            </div>
          </div>
          <div className="user-menu">
            <div className="user-text">
              <strong>{user.name}</strong>
              <span>
                {user.roles.map((role) => role.replaceAll("_", " ")).join(", ")}
              </span>
            </div>
            <div className="avatar">{initials}</div>
          </div>
        </header>
        {message && (
          <div className="status-message" role="status">
            {message}
            <button type="button" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {currentView === "panel" && (
          <>
            <Panel
              investigations={investigations}
              onOpenResearch={() =>
                setCurrentView(
                  user.roles.includes("COMITE") &&
                    !user.roles.some((role) =>
                      ["ADMINISTRADOR", "ADMIN_INVESTIGADOR", "INVESTIGADOR"].includes(role),
                    )
                    ? "revisiones"
                    : "investigaciones",
                )
              }
            />
            <NotificationCenter session={session} setMessage={setMessage} />
          </>
        )}{" "}
        {currentView === "investigaciones" && (
          <ResearchWorkspace
            session={session}
            investigations={investigations}
            refreshInvestigations={refreshInvestigations}
            setMessage={setMessage}
          />
        )}{" "}
        {currentView === "revisiones" && (
          <ReviewWorkspace
            session={session}
            investigations={investigations}
            refreshInvestigations={refreshInvestigations}
            setMessage={setMessage}
          />
        )}{" "}
        {currentView === "evaluaciones" && (
          <>
            <EvaluationWorkspace
              session={session}
              investigations={investigations}
              refreshInvestigations={refreshInvestigations}
              setMessage={setMessage}
            />
            {user.roles.some((role) => ["ADMINISTRADOR", "ADMIN_INVESTIGADOR", "INVESTIGADOR"].includes(role)) && (
              <DecisionWorkspace
                session={session}
                investigations={investigations}
                refreshInvestigations={refreshInvestigations}
                setMessage={setMessage}
              />
            )}
          </>
        )}{" "}
        {currentView === "publicaciones" && (
          <PublicationWorkspace
            session={session}
            investigations={investigations}
            refreshInvestigations={refreshInvestigations}
            setMessage={setMessage}
          />
        )}{" "}
        {currentView === "usuarios" && user.roles.includes("ADMINISTRADOR") && (
          <UserManagement session={session} setMessage={setMessage} />
        )}
      </main>
    </div>
  );
}

function Login({ onLogin }) {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.get("email"),
          password: form.get("password"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onLogin(data);
      navigate("/");
    } catch (error) {
      setError(error.message ?? "No fue posible iniciar sesión");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="login-page">
      <section className="login-identity">
        <div className="identity-pattern" />
        <div className="login-brand">
          <img
            className="login-logo"
            src="/hno-logo.png"
            alt="Hospital de la Niñez Oaxaqueña"
          />
        </div>
        <div className="identity-content">
          <p className="section-label light">Gestión institucional</p>
          <h1>Investigación, conocimiento y servicio</h1>
          <p>
            Plataforma para la administración y seguimiento de investigaciones
            científicas.
          </p>
        </div>
        <p className="identity-footer">Hospital de la Niñez Oaxaqueña</p>
      </section>
      <section className="login-area">
        <form className="login-card" onSubmit={submit}>
          <div className="login-title">
            <p className="section-label">Acceso al sistema</p>
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus credenciales institucionales.</p>
          </div>
          <label>
            Correo institucional
            <input
              name="email"
              type="email"
              autoComplete="username"
              placeholder="correo@institucion.mx"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Ingresa tu contraseña"
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Verificando..." : "Continuar"}
          </button>
          <p className="login-help">
            Si tienes problemas para acceder, comunícate con la administración
            del sistema.
          </p>
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("hno-session"));
    } catch {
      return null;
    }
  });
  function login(data) {
    sessionStorage.setItem("hno-session", JSON.stringify(data));
    setSession(data);
  }
  function logout() {
    sessionStorage.removeItem("hno-session");
    setSession(null);
  }
  return (
    <Routes>
      <Route
        path="/"
        element={<Dashboard session={session} onLogout={logout} />}
      />
      <Route path="/acceso" element={<Login onLogin={login} />} />
    </Routes>
  );
}
