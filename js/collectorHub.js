/**
 * @file collectorHub.js
 * @description Módulo de interfaz para el Dossier del Coleccionista usando Carbon Design.
 */

import { loginConGoogle, obtenerUsuarioActual } from "./auth.js";
import { guardarVista } from "./firestore.js";

export class CollectorHub {
  constructor() {
    this.modalBackdrop = null;
    this.init();
  }

  init() {
    this.crearModalVacio();
  }

  crearModalVacio() {
    if (document.getElementById("collector-hub-backdrop")) {
      this.modalBackdrop = document.getElementById("collector-hub-backdrop");
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.id = "collector-hub-backdrop";
    backdrop.className = "collector-modal-backdrop";
    backdrop.style.display = "none";

    backdrop.innerHTML = `
      <div class="collector-modal-container" role="dialog" aria-modal="true">
        <div class="collector-modal-header">
          <div>
            <span class="collector-modal-subtitle">Dossier de Coleccionista</span>
            <h3 class="collector-modal-title">Acceso Exclusivo</h3>
          </div>
          <button id="collector-hub-close" class="collector-modal-close" aria-label="Cerrar">&times;</button>
        </div>
        <div id="collector-hub-body" class="collector-modal-body"></div>
      </div>
    `;

    document.body.appendChild(backdrop);
    this.modalBackdrop = backdrop;

    backdrop.querySelector("#collector-hub-close")?.addEventListener("click", () => this.cerrarModal());
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) this.cerrarModal();
    });
  }

  /**
   * Abre el Dossier del Coleccionista para una obra dada.
   * @param {string} artworkId - Identificador dinámico de la obra.
   */
  async openCollectorHub(artworkId) {
    let usuario = obtenerUsuarioActual();

    if (!usuario) {
      try {
        const credencial = await loginConGoogle();
        usuario = credencial.user;
      } catch (error) {
        console.warn("Autenticación no completada por el usuario.");
        return;
      }
    }

    if (usuario) {
      // Pasamos tanto el usuario como el ID dinámico de la obra
      this.mostrarMensajeBienvenida(usuario, artworkId);
    }
  }

  /**
   * Muestra el mensaje y registra la vista automáticamente en Firestore.
   * @param {Object} usuario 
   * @param {string} artworkId 
   */
  async mostrarMensajeBienvenida(usuario, artworkId) {
    // 1. Registro dinámico en Firestore
    if (artworkId) {
      await guardarVista(usuario.uid, artworkId);
    }

    // 2. Renderizado de la interfaz
    const body = this.modalBackdrop.querySelector("#collector-hub-body");
    if (body) {
      body.innerHTML = `
        <p>Bienvenido al <strong>Dossier del Coleccionista</strong>. Desde aquí podrás consultar documentación técnica, guardar obras en tu colección privada e interactuar con el archivo.</p>
        
        <div class="collector-user-badge">
          ${usuario.photoURL ? `<img src="${usuario.photoURL}" class="collector-user-avatar" alt="${usuario.displayName}" />` : ''}
          <div class="collector-user-info">
            <span class="collector-user-name">${usuario.displayName || 'Coleccionista'}</span>
            <span class="collector-user-email">${usuario.email}</span>
          </div>
        </div>
      `;
    }

    this.modalBackdrop.style.display = "flex";
    setTimeout(() => this.modalBackdrop.classList.add("is-visible"), 10);
  }

  cerrarModal() {
    if (this.modalBackdrop) {
      this.modalBackdrop.classList.remove("is-visible");
      setTimeout(() => {
        this.modalBackdrop.style.display = "none";
      }, 200);
    }
  }
}