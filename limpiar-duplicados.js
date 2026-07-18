const stripe = require('stripe')('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'); // 🔑 Reemplaza con tu clave de Stripe
async function rescatarYAsignarPrecios() {
  try {
    console.log('Obteniendo todos los productos ARCHIVADOS de Stripe...');
    
    // 1. Traemos los productos inactivos (los que acabamos de archivar)
    const productosArchivados = await stripe.products.list({
      active: false,
      limit: 100
    }).autoPagingToArray({ limit: 10000 });

    console.log(`Se encontraron ${productosArchivados.length} productos archivados. Analizando tarifas asociadas...\n`);

    let contadorRescatados = 0;

    for (const producto of productosArchivados) {
      try {
        // 2. Buscar las tarifas (prices) que pertenecen a este producto específico
        const tarifas = await stripe.prices.list({
          product: producto.id,
          active: true,
          limit: 1
        });

        // Si el producto sí tiene una tarifa asociada guardada en Stripe
        if (tarifas.data.length > 0) {
          const tarifaAsociada = tarifas.data[0];
          
          console.log(`💡 Encontrada tarifa (${tarifaAsociada.id}) para "${producto.name}". Reparando...`);

          // 3. Asignamos la tarifa como predeterminada y reactivamos el producto
          await stripe.products.update(producto.id, {
            active: true,
            default_price: tarifaAsociada.id
          });

          console.log(`✅ ¡Rescatado! "${producto.name}" vuelve a estar activo con su precio por defecto.`);
          contadorRescatados++;
        } else {
          // Si de verdad no tiene ninguna tarifa, lo dejamos archivado
          console.log(`⏭️ Se mantiene archivado: "${producto.name}" (De verdad no tiene ninguna tarifa asociada).`);
        }

      } catch (errorProducto) {
        console.error(`❌ Error procesando producto ${producto.name}:`, errorProducto.message);
      }
    }

    console.log(`\n Proceso de rescate terminado.`);
    console.log(`Se revisaron ${productosArchivados.length} productos y se reactivaron ${contadorRescatados} exitosamente con su tarifa correcta.`);

  } catch (errorGeneral) {
    console.error('❌ Error crítico en el script de rescate:', errorGeneral.message);
  }
}

rescatarYAsignarPrecios();