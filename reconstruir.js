const stripe = require('stripe')( 'test');
const { JWT } = require('google-auth-library');

// -------------------------------------------------------------
// CONFIGURACIÓN DE GOOGLE SHEETS
// -------------------------------------------------------------
const creds = require('./credentials.json');
const SPREADSHEET_ID = '1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw';
async function obtenerFilasGoogleSheet() {
  const { GoogleSpreadsheet } = await import('google-spreadsheet');

  const serviceAccountAuth = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  return { sheet, rows };
}

async function vincularLinksExistentes() {
  console.log('🔍 [1/2] Obteniendo lista de Payment Links activos en Stripe (solo USD)...\n');

  // Mapa para relacionar Product ID -> Payment Link URL
  const productToLinkMap = new Map();

  for await (const link of stripe.paymentLinks.list({ limit: 100, active: true, expand: ['data.line_items'] })) {
    if (link.line_items && link.line_items.data.length > 0) {
      const lineItem = link.line_items.data[0];
      const price = lineItem.price;

      // 🛑 FILTRO: Solo tomamos en cuenta precios en Dólares (USD)
      if (price && price.currency && price.currency.toLowerCase() === 'usd') {
        const productId = price.product;
        productToLinkMap.set(productId, link.url);
      }
    }
  }

  console.log('📦 [2/2] Obteniendo mapa de Productos en Stripe...\n');
  
  // Mapa para relacionar Nombre del Producto -> Payment Link URL
  const nameToLinkMap = new Map();

  for await (const product of stripe.products.list({ limit: 100, active: true })) {
    const linkUrl = productToLinkMap.get(product.id);
    if (linkUrl) {
      // Guardamos en minúsculas y sin espacios extra para facilitar la búsqueda
      const claveBusqueda = product.name.trim().toLowerCase();
      nameToLinkMap.set(claveBusqueda, linkUrl);
    }
  }

  console.log('📝 Leyendo Google Sheet y rellenando la columna "Stripe URL"...\n');
  const { rows } = await obtenerFilasGoogleSheet();

  let actualizados = 0;

  for (const row of rows) {
    const code = row.get('Code') ? row.get('Code').toString().trim() : '';
    const title = row.get('Title') ? row.get('Title').toString().trim() : '';
    const urlActual = row.get('Stripe URL') ? row.get('Stripe URL').toString().trim() : '';

    if (!title && !code) continue;

    const nombreBuscado = `${code} ${title}`.trim().toLowerCase();
    const linkEncontrado = nameToLinkMap.get(nombreBuscado);

    if (linkEncontrado) {
      // Si la celda está vacía o si quieres asegurarte de actualizarla
      if (!urlActual || urlActual !== linkEncontrado) {
        row.set('Stripe URL', linkEncontrado);
        await row.save();
        console.log(`✅ Asignado (USD): "${code} ${title}" ➔ ${linkEncontrado}`);
        actualizados++;
      } else {
        console.log(`ℹ️ Ya estaba asignado: "${code} ${title}"`);
      }
    } else {
      console.log(`⚠️ No se encontró Payment Link activo en USD para: "${code} ${title}"`);
    }
  }

  console.log(`\n🎉 Proceso terminado. Se actualizaron ${actualizados} filas en tu Google Sheet.`);
}

vincularLinksExistentes().catch((err) => {
  console.error('❌ Error vinculando links:', err);
});