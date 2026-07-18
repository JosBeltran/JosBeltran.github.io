const { google } = require('googleapis');
const stripe = require('stripe')('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'); // 🔑 Reemplaza con tu clave real
const path = require('path');

// Configuración de Google Sheets
const SPREADSHEET_ID = '1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw'; // El código largo que sale en la URL de tu navegador
const NOMBRE_HOJA = 'Catalogo'; // Cambiado según la pestaña de tu imagen
const RANGE_LECTURA = `${NOMBRE_HOJA}!A2:K500`; // Leemos hasta la K para mapear el link existente

async function obtenerAutenticacionGoogle() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credenciales.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return auth.getClient();
}

async function procesarCatalogoYSheets() {
  try {
    const authClient = await obtenerAutenticacionGoogle();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // 1. Leer los productos desde Google Sheets
    const respuestaSheets = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: RANGE_LECTURA,
    });

    const filas = respuestaSheets.data.values;
    if (!filas || filas.length === 0) {
      console.log('No se encontraron datos en la hoja Catalogo.');
      return;
    }

    console.log(`Leyendo ${filas.length} filas desde Google Sheets...`);

    // 2. Traer todos los productos activos de Stripe
    console.log('Sincronizando catálogo activo de Stripe...');
    const productosStripe = await stripe.products.list({
      active: true,
      limit: 100
    }).autoPagingToArray({ limit: 10000 });

    // Mapeo buscando coincidencia estricta por el identificador/nombre de la Columna B
    const mapaProductosStripe = new Map(
      productosStripe.map(p => [p.name.trim().toLowerCase(), p])
    );

    // Iteramos por cada fila de tu Google Sheet
    for (let i = 0; i < filas.length; i++) {
      const filaActual = filas[i];
      const nombreProductoSheet = filaActual[2]?.trim(); // 📌 Columna B (Índice 1)
      const linkExistente = filaActual[10]?.trim();     // 📌 Columna K (Índice 10)

      if (!nombreProductoSheet) continue;
      
      // Si ya hay un link que empiece con http en la columna K, lo saltamos para evitar duplicar
      if (linkExistente && linkExistente.startsWith('http')) {
        console.log(`⏭️ Saltando "${nombreProductoSheet}": ya tiene un link registrado en la Columna K.`);
        continue;
      }

      console.log(`\n🔍 Procesando producto: "${nombreProductoSheet}"`);

      // Buscar si el producto existe y está activo en Stripe
      const productoEncontrado = mapaProductosStripe.get(nombreProductoSheet.toLowerCase());

      if (!productoEncontrado) {
        console.warn(`⚠️ El producto "${nombreProductoSheet}" no se encontró activo en Stripe. Verifica si el nombre coincide exacto.`);
        continue;
      }

      if (!productoEncontrado.default_price) {
        console.warn(`⚠️ El producto "${nombreProductoSheet}" no tiene asignado un precio por defecto en Stripe.`);
        continue;
      }

      try {
        // 3. Crear el Payment Link requiriendo dirección
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price: productoEncontrado.default_price,
              quantity: 1,
            },
          ],
          // Requiere obligatoriamente los datos de envío
          shipping_address_collection: {
            allowed_countries: ['MX', 'US', 'CA'], // Ajusta los países de envío permitidos
          },
          billing_address_collection: 'required' // Requiere dirección de facturación
        });

        console.log(`✅ Payment Link creado: ${paymentLink.url}`);

        // 4. Escribir el link de regreso en la Columna K de tu Google Sheet
        const numeroFilaReal = i + 2; // +2 por el desfase del índice 0 y la fila 1 de encabezados
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${NOMBRE_HOJA}!K${numeroFilaReal}`, // 📌 Apunta directo a la columna K
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[paymentLink.url]],
          },
        });

        console.log(`💾 Link guardado en la fila ${numeroFilaReal} (Columna K)`);

      } catch (errorStripe) {
        console.error(`❌ Error en Stripe para "${nombreProductoSheet}":`, errorStripe.message);
      }
    }

    console.log('\n El proceso ha concluido.');

  } catch (errorGeneral) {
    console.error('Error crítico en la ejecución:', errorGeneral.message);
  }
}

procesarCatalogoYSheets();