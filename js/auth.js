/**
 * @file auth.js
 * @description Módulo encargo de la autenticación de usuarios mediante Google y manejo de estado.
 */

import { auth, googleProvider } from "./firebase-config.js";
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

/**
 * Inicia sesión utilizando el proveedor de Google mediante ventana emergente (Popup).
 * @returns {Promise<import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js").UserCredential>}
 */
export async function loginConGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result;
  } catch (error) {
    console.error("Error al iniciar sesión con Google:", error);
    throw error;
  }
}

/**
 * Cierra la sesión activa del usuario.
 * @returns {Promise<void>}
 */
export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    throw error;
  }
}

/**
 * Obtiene el objeto del usuario actualmente autenticado.
 * @returns {import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js").User|null}
 */
export function obtenerUsuarioActual() {
  return auth.currentUser;
}

/**
 * Escucha los cambios en el estado de autenticación (login/logout).
 * @param {function(import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js").User|null): void} callback
 * @returns {import("https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js").Unsubscribe}
 */
export function detectarCambiosDeSesion(callback) {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
}