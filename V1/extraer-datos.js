const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Rutas de archivos
const indexPath = path.join(__dirname, 'index.html');
const outputFile = path.join(__dirname, 'galeria-datos.js');

try {
    // 1. Leer el archivo index.html actual
    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    const $ = cheerio.load(htmlContent);
    const artworks = [];

    console.log('🔍 Analizando index.html para extraer las obras...');

    // 2. Buscar todas las tarjetas de obras en el HTML
    $('.artwork-card').each((index, element) => {
        const card = $(element);

        // Extraer ID y Colección (basado en el ID padre o el prefijo del ID)
        const id = card.attr('id') || '';
        const collection = id.split('-')[0].toLowerCase();

        // Buscar el enlace y elementos internos
        const linkAnchor = card.find('.artwork-link');
        const link = linkAnchor.attr('href') || '';

        // Detectar si la obra está vendida
        const isSold = card.find('.sold-pill').length > 0 || card.find('.artwork-watermark').length > 0;

        // Encontrar la imagen correcta (dentro de figure o dentro del wrapper de vendidos)
        let image = '';
        if (isSold) {
            image = card.find('.artwork-image-wrap img').attr('src') || '';
        } else {
            image = card.find('.artwork-frame img').attr('src') || '';
        }

        // Extraer metadatos de texto
        const title = card.find('.artwork-meta h3').text().trim();
        const subtitle = card.find('.artwork-meta .artwork-year').text().trim();
        const medium = card.find('.artwork-meta .artwork-medium').text().trim();
        const size = card.find('.artwork-meta .artwork-size').text().trim();

        // Validar que al menos tenga ID y Título para guardarlo
        if (id && title) {
            artworks.push({
                id: id.toLowerCase(),
                collection: collection,
                title: title,
                subtitle: subtitle,
                medium: medium,
                size: size,
                image: image,
                link: link,
                sold: isSold
            });
        }
    });

    // 3. Crear el formato final de JavaScript
    const outputContent = `const ARTWORKS_DATA = ${JSON.stringify(artworks, null, 2)};\n`;

    // 4. Guardar el nuevo archivo galeria-datos.js
    fs.writeFileSync(outputFile, outputContent, 'utf8');

    console.log(`\n✅ ¡Extracción completada con éxito!`);
    console.log(`📦 Se encontraron ${artworks.length} obras en total.`);
    console.log(`🚀 Archivo generado listo para usar: galeria-datos.js`);

} catch (error) {
    console.error('❌ Hubo un error procesando el archivo index.html:', error.message);
}