/**
 * @file firestore.js
 * @description Módulo de persistencia en Cloud Firestore para Favoritos y Vistas.
 */

import { db } from "./firebase-config.js";
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  collection, 
  query,       // 👈 Agrega esta función aquí
  where,
  serverTimestamp , 
   getDoc, 
  addDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


/**
 * Registra o actualiza la última visualización de una obra por un usuario.
 * @param {string} userId - ID del usuario autenticado.
 * @param {string} obraId - Código o identificador de la obra.
 */
export async function guardarVista(userId, workCode) {
  // Creamos un ID único combinando el usuario y el código de la obra
  const vistaId = `${userId}_${workCode}`;
  const vistaRef = doc(db, "vistas", vistaId);
  
  const vistaSnap = await getDoc(vistaRef);
  
  // Si no existe la vista de este usuario para esta obra, la creamos
  if (!vistaSnap.exists()) {
    await setDoc(vistaRef, {
      userId: userId,
      workCode: workCode,
      timestamp: new Date()
    });
    return true; // Indica que fue una vista NUEVA
  }
  
  return false; // Indica que YA EXISTÍA la vista
}

export async function obtenerTotalVistas(workCode) {
  // Consulta cuántos registros únicos existen para esta obra
  const q = query(collection(db, "vistas"), where("workCode", "==", workCode));
  const querySnapshot = await getDocs(q);
  return querySnapshot.size;
}

/**
 * Guarda una obra en la lista de favoritos del usuario.
 * @param {string} userId - ID del usuario autenticado.
 * @param {string} obraId - Código o identificador de la obra.
 */
export async function guardarFavorito(userId, obraId) {
  if (!userId || !obraId) return;
  try {
    const favRef = doc(db, `usuarios/${userId}/favoritos`, obraId);
    await setDoc(favRef, {
      obraId: obraId,
      guardadoEn: serverTimestamp()
    });
  } catch (error) {
    console.error("Error al guardar favorito:", error);
    throw error;
  }
}

/**
 * Remueve una obra de la lista de favoritos del usuario.
 * @param {string} userId - ID del usuario autenticado.
 * @param {string} obraId - Código o identificador de la obra.
 */
export async function quitarFavorito(userId, obraId) {
  if (!userId || !obraId) return;
  try {
    const favRef = doc(db, `usuarios/${userId}/favoritos`, obraId);
    await deleteDoc(favRef);
  } catch (error) {
    console.error("Error al eliminar favorito:", error);
    throw error;
  }
}

/**
 * Obtiene la lista completa de IDs de obras favoritas del usuario.
 * @param {string} userId - ID del usuario autenticado.
 * @returns {Promise<Array<string>>}
 */
export async function obtenerFavoritos(userId) {
  if (!userId) return [];
  try {
    const favsRef = collection(db, `usuarios/${userId}/favoritos`);
    const snapshot = await getDocs(favsRef);
    return snapshot.docs.map(d => d.id);
  } catch (error) {
    console.error("Error al obtener favoritos:", error);
    return [];
  }
}

// Métodos preparados para la siguiente fase (Comentarios)
export async function obtenerComentarios(obraId) { return []; }
export async function agregarComentario(obraId, userId, texto) {}
export async function eliminarComentario(comentarioId) {}