const { google } = require('googleapis');
// Reemplaza con tu Secret Key real (sk_test_... o sk_live_...)
const stripe = require('stripe')('test--'); 
const path = require('path');

// Configuración de Google Sheets
const SPREADSHEET_ID = '1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw';
const NOMBRE_HOJA = 'Catalogo';
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

    for (let index = 0; index < filas.length; index++) {
      const fila = filas[index];
      const numeroFila = index + 2; // Índice 0 = Fila 2 en Sheets

      const codeB = fila[1] ? fila[1].toString().trim() : '';
      const titleC = fila[2] ? fila[2].toString().trim() : '';
      const priceJ = fila[9] ? parseFloat(fila[9]) : 0;
      const stripeUrlK = fila[10] ? fila[10].toString().trim() : '';
      const descO = fila[14] ? fila[14].toString().trim() : '';
      
      // FORZADO A USD para todos los casos sin link de Stripe
      const currency = 'usd';

      // Evaluar si la columna K está VACÍA, tiene código y precio > 0
      if (stripeUrlK === '' && codeB !== '' && priceJ > 0) {
        
        const productName = `${codeB} ${titleC}`.trim();
        const description = descO || `Original artwork ${codeB}`;
        const amountCentavos = Math.round(priceJ * 100);

        console.log(`⏳ Procesando fila ${numeroFila}: "${productName}" - $${priceJ} USD`);

        // 1. Crear Producto y Precio Default en USD
        const product = await stripe.products.create({
          name: productName,
          description: description,
          metadata: {
            product_code: codeB
          },
          default_price_data: {
            currency: currency,
            unit_amount: amountCentavos,
          },
        });

        // 2. Crear Enlace de Pago (Payment Link)
        const paymentLink = await stripe.paymentLinks.create({
          line_items: [
            {
              price: product.default_price,
              quantity: 1,
            },
          ],
          shipping_address_collection: {
            allowed_countries: ['MX', 'US', 'CA'],
          },
          metadata: {
            product_code: codeB
          }
        });

        // 3. Actualizar ID del Producto en Columna Q
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${NOMBRE_HOJA}!Q${numeroFila}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[product.id]],
          },
        });

        // 4. Actualizar URL del Link de Pago en Columna K
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