const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { google } = require("googleapis");

const SITE_URL = "https://josuebeltranuresti.com";
const WHATSAPP_NUMBER = "528123518298";

// CONFIGURACIÓN MAESTRA DE GOOGLE SHEETS
const SPREADSHEET_ID = "1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw"; 
const RANGE = "Catalogo!A2:N"; 

const outputDir = path.join(__dirname, "obras");
const qrDir = path.join(__dirname, "assets", "qr");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(qrDir, { recursive: true });

const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "credentials.json"), 
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
});

async function getSheetsData() {
    const sheets = google.sheets({ version: "v4", auth });
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: RANGE,
        });
        return response.data.values || [];
    } catch (error) {
        console.error("Error obteniendo datos:", error);
        return [];
    }
}

function parsePrints(printsString) {
    if (!printsString) return [];
    try { return JSON.parse(printsString); } catch (e) { return []; }
}

function transformRowsToSeriesStructure(rows) {
    const seriesMap = new Map();
    for (const row of rows) {
        const [
            seriesTitle, code, title, year, technique, size, image, description,
            isAvailableStr, originalPrice, stripeUrl, printsJson, sketchUrl, notes
        ] = row;

        if (!code || !seriesTitle) continue;

        const isAvailable = String(isAvailableStr).toUpperCase() === "TRUE";

        const workObj = {
            code: code.trim(),
            title: title.trim(),
            year: year ? year.trim() : "",
            technique: technique ? technique.trim() : "",
            size: size ? size.trim() : "",
            image: image ? image.trim() : "",
            description: description ? description.trim() : "",
            availability: {
                isAvailable,
                price: originalPrice ? originalPrice.trim() : "",
                stripeUrl: stripeUrl ? stripeUrl.trim() : ""
            },
            prints: parsePrints(printsJson),
            documentation: (sketchUrl || notes) ? {
                sketchUrl: sketchUrl ? sketchUrl.trim() : "",
                notes: notes ? notes.trim() : ""
            } : null
        };

        const currentSeriesTitle = seriesTitle.trim();
        if (!seriesMap.has(currentSeriesTitle)) {
            seriesMap.set(currentSeriesTitle, { seriesTitle: currentSeriesTitle, works: [] });
        }
        seriesMap.get(currentSeriesTitle).works.push(workObj);
    }
    return Array.from(seriesMap.values());
}

(async () => {
    const rows = await getSheetsData();
    if (rows.length === 0) return;

    const seriesData = transformRowsToSeriesStructure(rows);

    // =======================================================
    // 1. GENERACIÓN DE SUBPÁGINAS INDIVIDUALES (obras/*.html)
    // =======================================================
    for (const serie of seriesData) {
        const isCase = serie.seriesTitle === "Case Devices";

        for (const work of serie.works) {
            const pageUrl = `${SITE_URL}/obras/${work.code}.html`;
            const qrPath = path.join(qrDir, `${work.code}.png`);

            await QRCode.toFile(qrPath, pageUrl, { width: 500, margin: 2 });

            // Textos dinámicos según el tipo de producto
            const backLinkText = isCase ? "← Volver a Case Devices" : "← Volver al catálogo";
            const backLinkHref = isCase ? "../cases.html" : "../index.html";
            const itemLabel = isCase ? "Funda" : "Obra";
            const buyBtnText = isCase ? "Comprar Funda" : "Adquirir Original";
            const soldBtnText = isCase ? "Agotado" : "Obra Vendida";

            const whatsappText = encodeURIComponent(
                isCase 
                  ? `Hola, me interesa la funda ${work.code} - ${work.title} de Case Devices`
                  : `Hola, me interesa la obra ${work.code} - ${work.title} de la serie ${serie.seriesTitle}`
            );

            let documentationHtml = "";
            if (work.documentation && !isCase) {
                const hasSketch = !!work.documentation.sketchUrl;
                documentationHtml = `
                <div class="documentation-panel" style="margin-top: 2rem; background: #f9f9f9; border: 1px solid #e0e0e0; padding: 24px;">
                    <h3 style="color: #666666; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px; font-size: 0.75rem; margin-top: 0;">Proceso & Documentación</h3>
                    ${hasSketch ? `<div style="background: #ffffff; padding: 12px; border: 1px solid #e0e0e0; margin-bottom: 1rem; display: flex; justify-content: center;">
                        <img src="../${work.documentation.sketchUrl}" alt="Boceto de ${work.title}" style="width: 100%; max-height: 300px; object-fit: contain;" />
                    </div>` : ''}
                    ${work.documentation.notes ? `<p style="font-style: italic; color: #555555; line-height: 1.5; font-size: 14px; margin: 0;">"${work.documentation.notes}"</p>` : ''}
                </div>`;
            }

            // Bloque dinámico para botón de Stripe/Compra
            let purchaseBtnHtml = "";
            if (work.availability.isAvailable && work.availability.stripeUrl) {
                purchaseBtnHtml = `<a class="btn-original-buy" target="_blank" href="${work.availability.stripeUrl}">${buyBtnText} (${work.availability.price})</a>`;
            } else if (work.availability.isAvailable) {
                purchaseBtnHtml = `<a class="btn-original-buy" target="_blank" href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}">Consultar Disponibilidad</a>`;
            } else {
                purchaseBtnHtml = `<div class="btn-original-sold">${soldBtnText}</div>`;
            }

            const html = `<!DOCTYPE html>
<html lang="es" data-theme="white">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${work.code} | ${work.title}</title>
  <meta name="description" content="${work.description.replace(/"/g, '&quot;')}" />
  <link rel="stylesheet" href="../styles.css" />
  <style>
    body {
      background-color: #ffffff; color: #111111;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0; padding: 0;
    }
    .artwork-container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
    .back-link { display: inline-flex; align-items: center; text-decoration: none; color: #666666; font-size: 0.9rem; margin-bottom: 32px; transition: all 0.2s; }
    .back-link:hover { color: #111111; transform: translateX(-4px); }
    .artwork-layout { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 64px; align-items: start; }
    @media (max-width: 900px) { .artwork-layout { grid-template-columns: 1fr; gap: 40px; } }
    .artwork-image-column { display: flex; flex-direction: column; gap: 20px; }
    .artwork-image-wrap { background-color: #fcfcfc; border: 1px solid #e5e5e5; padding: 24px; display: flex; justify-content: center; align-items: center; }
    .artwork-image { max-width: 100%; max-height: 70vh; object-fit: contain; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05); }
    .artwork-details { position: sticky; top: 40px; }
    .artwork-code { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px; color: #666666; margin: 0 0 12px 0; }
    h1 { font-size: 2.5rem; font-weight: 400; line-height: 1.2; margin: 0 0 24px 0; letter-spacing: -0.5px; }
    .meta-grid { border-top: 1px solid #e5e5e5; border-bottom: 1px solid #e5e5e5; padding: 16px 0; margin-bottom: 24px; }
    .meta-item { display: flex; justify-content: space-between; font-size: 0.95rem; padding: 6px 0; }
    .meta-item strong { color: #666666; font-weight: 400; }
    .description { font-size: 1rem; line-height: 1.6; color: #333333; margin-bottom: 32px; }
    .btn-original-buy { display: block; width: 100%; text-align: center; box-sizing: border-box; padding: 16px; background-color: #111111; color: #ffffff; text-decoration: none; font-weight: 500; font-size: 15px; transition: background-color 0.2s; }
    .btn-original-buy:hover { background-color: #333333; }
    .btn-original-sold { display: block; width: 100%; text-align: center; box-sizing: border-box; padding: 16px; background-color: #f5f5f5; color: #999999; border: 1px solid #e5e5e5; font-size: 15px; cursor: not-allowed; }
    .whatsapp-btn-secondary { display: block; width: 100%; text-align: center; box-sizing: border-box; padding: 14px; border: 1px solid #e5e5e5; background-color: transparent; color: #555555; text-decoration: none; font-size: 14px; margin-top: 12px; transition: all 0.2s; }
    .whatsapp-btn-secondary:hover { background-color: #f9f9f9; color: #111111; border-color: #888888; }
    .qr-box { text-align: center; margin-top: 32px; padding: 20px; border: 1px dashed #e5e5e5; }
    .qr-img { width: 110px; height: 110px; display: block; margin: 0 auto 12px; }
    .qr-text { color: #666666; font-size: 0.75rem; margin: 0; }
  </style>
</head>
<body>
<main class="artwork-container">
  <a href="${backLinkHref}" class="back-link">${backLinkText}</a>
  <section class="artwork-layout">
    <div class="artwork-image-column">
      <div class="artwork-image-wrap"><img src="../${work.image}" alt="${work.title}" class="artwork-image" /></div>
      ${documentationHtml}
    </div>
    <aside class="artwork-details">
      <p class="artwork-code">${work.code} — ${isCase ? 'Colección' : 'Serie'}: ${serie.seriesTitle}</p>
      <h1>${work.title}</h1>
      <div class="meta-grid">
        <div class="meta-item"><strong>Año:</strong><span>${work.year}</span></div>
        <div class="meta-item"><strong>${isCase ? 'Compatibilidad / Modelo' : 'Técnica'}:</strong><span>${work.technique}</span></div>
        <div class="meta-item"><strong>${isCase ? 'Dimensiones' : 'Medida'}:</strong><span>${work.size}</span></div>
      </div>
      <p class="description">${work.description}</p>
      <div class="purchase-section">
        <div id="live-original-cta">
            ${purchaseBtnHtml}
        </div>
        <a class="whatsapp-btn-secondary" target="_blank" href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}">Preguntar por WhatsApp</a>
      </div>
      <div class="qr-box">
        <img src="../assets/qr/${work.code}.png" alt="QR ${work.code}" class="qr-img" />
        <p class="qr-text">Escanea para abrir en tu móvil</p>
      </div>
    </aside>
  </section>
</main>
<script src="../app.js"></script>
</body>
</html>`;

            fs.writeFileSync(path.join(outputDir, `${work.code}.html`), html, "utf8");
        }
    }

    // =======================================================
    // 2. GENERACIÓN ÚNICA DE LA PÁGINA DE FUNDAS (cases.html)
    // =======================================================
    const caseSeries = seriesData.filter(s => s.seriesTitle === "Case Devices");
    fs.writeFileSync(path.join(__dirname, "cases.html"), buildCasesCatalogTemplate(caseSeries), "utf8");

    console.log("¡Hecho! Se generaron las subpáginas personalizadas y la sección cases.html.");
})();

function buildCasesCatalogTemplate(filteredSeries) {
    const contentHtml = filteredSeries.map(serie => {
        const worksGrid = serie.works.map(work => `
            <div class="artwork-card" style="border: 1px solid #e5e5e5; padding: 16px; background: #ffffff; transition: transform 0.2s ease, border-color 0.2s ease; position: relative;">
                <a href="obras/${work.code}.html" style="text-decoration: none; color: inherit; display: block;">
                    <div style="background: #fbfbfb; padding: 16px; display: flex; justify-content: center; align-items: center; margin-bottom: 16px; border: 1px solid #f0f0f0; height: 260px; overflow: hidden;">
                        <img src="${work.image}" alt="${work.title}" style="max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" />
                    </div>
                    <div style="font-size: 0.75rem; color: #666666; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">${work.code}</div>
                    <h3 style="font-size: 1.25rem; font-weight: 400; line-height: 1.3; margin: 0 0 8px 0; color: #111111; letter-spacing: -0.3px;">${work.title}</h3>
                    <p style="font-size: 0.85rem; color: #666666; margin: 0 0 16px 0; line-height: 1.4;">${work.technique}</p>
                    <div style="border-top: 1px solid #e5e5e5; padding-top: 12px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 0.95rem; font-weight: 500; color: #111111;">${work.availability.price || "Consultar"}</span>
                        <span style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; color: #198038;">Disponible</span>
                    </div>
                </a>
            </div>
        `).join("");

        return `
            <div class="catalog-header-block" style="margin-bottom: 32px;">
                <span class="metadata-label">Colección Exclusiva</span>
                <h3 class="catalog-section-title">Case Devices</h3>
            </div>
            <div class="editorial-gallery-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 32px; margin-bottom: 64px;">
                ${worksGrid}
            </div>
        `;
    }).join("");

    return `<!DOCTYPE html>
<html lang="es" data-theme="white">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>JBU — Case Devices Colección</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@carbon/styles@1/css/styles.min.css">
    <link rel="stylesheet" href="styles.css" />
    <link rel="icon" type="image/png" href="assets/logo.png" />
    <style>
        .artwork-card:hover { transform: translateY(-4px); border-color: #111111 !important; }
    </style>
</head>
<body class="editorial-gallery-body">

    <header class="gallery-header" role="banner">
        <div class="header-container">
            <a class="gallery-brand" href="index.html" aria-label="JBU - Volver al inicio">
                <span class="brand-prefix">JBU</span>
                <span class="brand-suffix">Galería & Archivo</span>
            </a>
            <nav class="gallery-nav" aria-label="Navegación principal de la galería">
                <ul class="nav-menu" role="menubar">
                    <li role="none"><a class="nav-link" href="index.html#galeria" role="menuitem">Colecciones</a></li>
                    <li role="none"><a class="nav-link" href="index.html#archivo" role="menuitem">Archivo</a></li>
                    <li role="none"><a class="nav-link" href="cases.html" role="menuitem" style="font-weight: 500; color: #111111;">Case Devices</a></li>
                    <li role="none"><a class="nav-link" href="index.html#sobre-artista" role="menuitem">Sobre el Artista</a></li>
                    <li role="none"><a class="nav-link" href="info/soporte.html" role="menuitem">Contacto</a></li>
                </ul>
            </nav>
        </div>
    </header>

    <main class="cds--grid main-editorial-wrapper" style="padding-top: 2rem;">
        <div class="cds--row">
            <section class="content-editorial-panel cds--col-lg-16 cds--col-md-8 cds--col-sm-4">
                <div class="catalog-editorial-container">
                    ${contentHtml || '<p style="color: #666666; text-align: center; margin-top: 40px;">Próximamente disponible.</p>'}
                </div>
            </section>
        </div>
    </main>

    <footer class="gallery-footer" role="contentinfo">
        <div class="footer-inner">
            <span class="footer-copyright">© 2026 JBU. Todos los derechos reservados.</span>
            <div class="footer-utility-links">
                <a href="info/terminos-de-servicio.html">Términos</a>
                <a href="info/politica-de-privacidad.html">Privacidad</a>
            </div>
        </div>
    </footer>

</body>
</html>`;
}