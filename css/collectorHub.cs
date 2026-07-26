/**
 * collectorHub.css — Dossier del Coleccionista
 * Integrado con los tokens tipográficos y contenedores de Carbon Design System.
 */

/* Backdrop (Fondo oscuro transparente) */
.collector-modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(22, 22, 22, 0.6);
  backdrop-filter: blur(4px);
  z-index: 9000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem;
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
}

.collector-modal-backdrop.is-visible {
  opacity: 1;
}

/* Modal Surface con diseño Carbon */
.collector-modal-container {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  width: 100%;
  max-width: 560px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  position: relative;
  display: flex;
  flex-direction: column;
}

/* Encabezado */
.collector-modal-header {
  padding: 1.5rem 1.5rem 1rem 1.5rem;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.collector-modal-title {
  font-size: 1.25rem;
  font-weight: 400;
  color: #161616;
  margin: 0;
  letter-spacing: -0.3px;
}

.collector-modal-subtitle {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: #525252;
  margin-bottom: 0.25rem;
  display: block;
}

/* Botón Cierre de Carbon */
.collector-modal-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  color: #525252;
  cursor: pointer;
  padding: 0.5rem;
  transition: background-color 0.15s, color 0.15s;
}

.collector-modal-close:hover {
  background-color: #e5e5e5;
  color: #161616;
}

/* Cuerpo del Modal */
.collector-modal-body {
  padding: 1.5rem;
  color: #393939;
  font-size: 0.9375rem;
  line-height: 1.5;
}

/* Tarjeta informativa interior */
.collector-user-badge {
  background-color: #f4f4f4;
  border-left: 4px solid #0f62fe;
  padding: 1rem;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.collector-user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.collector-user-info {
  display: flex;
  flex-direction: column;
}

.collector-user-name {
  font-weight: 600;
  color: #161616;
  font-size: 0.875rem;
}

.collector-user-email {
  color: #6f6f6f;
  font-size: 0.75rem;
}