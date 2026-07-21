const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// 1. Ruta al archivo Excel
const excelPath = path.join(__dirname, 'josuebeltranurestiart-devices-list.xlsx');

if (!fs.existsSync(excelPath)) {
  console.error(`❌ No se encontró el archivo Excel en: ${excelPath}`);
  process.exit(1);
}

const workbook = xlsx.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

console.log(`🚀 Procesando ${data.length} filas...`);

// Función auxiliar para renombrar archivo
function renameFile(originalPath, newBaseName) {
  if (!originalPath) return;

  const fullPath = path.resolve(__dirname, String(originalPath).trim());

  // Validar si el archivo original existe
  if (!fs.existsSync(fullPath)) {
    console.warn(`⚠️ Archivo no encontrado: ${originalPath}`);
    return;
  }

  // Conservar directorio y extensión original
  const parsed = path.parse(fullPath);
  const newPath = path.join(parsed.dir, `${newBaseName}${parsed.ext}`);

  // Evitar renombrar si ya tiene el nombre destino
  if (fullPath === newPath) {
    console.log(`ℹ️ Ya está renombrado: ${parsed.base}`);
    return;
  }

  try {
    fs.renameSync(fullPath, newPath);
    console.log(`✅ Renombrado: ${parsed.base} ➔ ${path.basename(newPath)}`);
  } catch (err) {
    console.error(`❌ Error renombrando ${parsed.base}:`, err.message);
  }
}

// 2. Recorrer cada fila de la nueva estructura
data.forEach((row) => {
  // Obtener los valores según las columnas del nuevo Excel
  const code = row['Code (ID)'] || row['Code'];
  const originalFilePath = row['Nombre del Archivo Original en la Ruta (Image / rutaBoceto)'] || row['Image'] || row['rutaBoceto'];
  const rol = String(row['Rol / Campo en Hoja'] || '').toLowerCase();

  if (!code || !originalFilePath) return;

  const cleanCode = String(code).trim();

  // Determinar si es la vista principal o la lateral/secundaria
  if (rol.includes('boceto') || rol.includes('lateral') || rol.includes('rutaboceto')) {
    // Es vista lateral -> "CASE-IP12-01_side"
    renameFile(originalFilePath, `${cleanCode}_side`);
  } else {
    // Es vista principal -> "CASE-IP12-01"
    renameFile(originalFilePath, cleanCode);
  }
});

console.log('\n✨ Proceso de renombrado finalizado.');