const { google } = require('googleapis');
// Reemplaza con tu Secret Key real (sk_test_... o sk_live_...)
const stripe = require('stripe')('ttest'); 
const path = require('path');

// Configuración de Google Sheets
const SPREADSHEET_ID = '1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw';
const NOMBRE_HOJA = 'Catalogo';
// Leemos de la columna A hasta la Q para evaluar la K (link) y escribir Q (ID)
const RANGE_LECTURA = `${NOMBRE_HOJA}!A2:Q500`;

async function obtenerAutenticacionGoogle() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'credentials.json'),
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
      console.log('No se encontraron datos en la hoja.');
      return;
    }

    console.log(`🚀 Procesando ${filas.length} registros desde Google Sheets...\n`);

    // Iteramos fila por fila
    for (let index = 0; index < filas.length; index++) {
      const fila = filas[index];
      const numeroFila = index + 2; // +2 porque el rango empieza en A2 (índice 0 = Fila 2)

      // Mapeo de columnas (Índice base 0):
      // Col B = [1], Col C = [2], Col J = [9], Col K = [10], Col O = [14], Col P = [15]
      const codeB = fila[1] ? fila[1].toString().trim() : '';
      const titleC = fila[2] ? fila[2].toString().trim() : '';
      const priceJ = fila[9] ? parseFloat(fila[9]) : 0;
      const stripeUrlK = fila[10] ? fila[10].toString().trim() : '';
      const descO = fila[14] ? fila[14].toString().trim() : '';
      const currencyP = fila[15] ? fila[15].toString().trim() : 'usd';

      // Filtrar: Ejecutar solo si la columna K está VACÍA, tiene precio y código de producto
      if (stripeUrlK === '' && codeB !== '' && priceJ > 0) {
        
        // A. Nombre concatenado (B + C)
        const productName = `${codeB} ${titleC}`.trim();
        const description = descO || `Original artwork ${codeB}`;
        const currency = currencyP.toLowerCase();
        
        // Stripe requiere el monto en centavos (ej. 1000.00 -> 100000)
        const amountCentavos = Math.round(priceJ * 100);

        console.log(`⏳ Procesando fila ${numeroFila}: "${productName}" - $${priceJ} ${currency.toUpperCase()}`);

        // B. Crear Producto en Stripe
        const product = await stripe.products.create({
          name: productName,
          description: description,
          metadata: {
            product_code: codeB // Guarda la clave para que la reconozca tu Webhook
          },
          default_price_data: {
            currency: currency,
            unit_amount: amountCentavos,
          },
        });

        // C. Crear Enlace de Pago (Payment Link) en Stripe
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price: product.default_price,
              quantity: 1,
            },
          ],
          shipping_address_collection: {
            allowed_countries: ['MX', 'US', 'CA'], // Solicita dirección de envío
          },
          metadata: {
            product_code: codeB // Pasa la clave en el Payment Link
          }
        });

        // D. Actualizar ID del Producto en Columna Q
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${NOMBRE_HOJA}!Q${numeroFila}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[product.id]],
          },
        });

        // E. Actualizar URL del Link de Pago en Columna K
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${NOMBRE_HOJA}!K${numeroFila}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[paymentLink.url]],
          },
        });

        console.log(`✅ Fila ${numeroFila} completada con éxito:`);
        console.log(`   - Product ID (Q): ${product.id}`);
        console.log(`   - Payment Link (K): ${paymentLink.url}\n`);
      }
    }

    console.log('🎉 ¡Proceso de sincronización completado!');

  } catch (error) {
    console.error('❌ Error ejecutando el script:', error.message);
  }
}

procesarCatalogoYSheets();