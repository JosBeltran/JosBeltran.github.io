const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const SITE_URL = "https://josuebeltranuresti.com/";
const WHATSAPP_NUMBER = "528123518298";

const data = JSON.parse(fs.readFileSync("artworks.json", "utf8"));

const outputDir = path.join(__dirname, "obras");
const qrDir = path.join(__dirname, "assets", "qr");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(qrDir, { recursive: true });

(async () => {
    // Iterar a través de las series y luego sus obras correspondientes
    for (const serie of data.series) {
        for (const work of serie.works) {
            const pageUrl = `${SITE_URL}/obras/${work.code}.html`;
            const qrPath = path.join(qrDir, `${work.code}.png`);

            // Generar QR
            await QRCode.toFile(qrPath, pageUrl, {
                width: 500,
                margin: 2
            });

            const whatsappText = encodeURIComponent(
                `Hola, me interesa la obra ${work.code} - ${work.title} de la serie ${serie.seriesTitle}`
            );

            // Renderizar condicionalmente el nodo de documentación si trae boceto o notas
            let documentationHtml = "";
            if (work.documentation) {
                const hasSketch = work.documentation.sketchUrl ? true : false;
                documentationHtml = `
                <div class="cds--tile documentation-panel" style="margin-top: 2rem; background: var(--cds-layer-01); border: 1px solid var(--cds-border-subtle); padding: 24px;">
                    <h3 class="cds--type-label-01" style="color: var(--cds-text-secondary); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px;">Proceso & Documentación</h3>
                    ${hasSketch ? `<div class="sketch-wrap" style="background: #000; padding: 12px; border: 1px solid var(--cds-border-subtle); margin-bottom: 1rem;">
                        <img src="../${work.documentation.sketchUrl}" alt="Boceto de ${work.title}" style="width: 100%; max-height: 300px; object-fit: contain; opacity: 0.7;" />
                    </div>` : ''}
                    ${work.documentation.notes ? `<p class="cds--type-body-short-01" style="font-style: italic; color: var(--cds-text-secondary); line-height: 1.5; font-size: 14px;">"${work.documentation.notes}"</p>` : ''}
                </div>`;
            }

            const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${work.code} | ${work.title}</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body style="background-color: #161616; color: #f4f4f4;">

<main class="artwork-page">
  <div style="max-width: 1280px; margin: 0 auto; padding: 0 16px;">
    <a href="../index.html" class="back-link">← Volver al catálogo</a>

    <section class="artwork-layout">
      <div class="artwork-main-column">
        <div class="artwork-image-wrap">
          <img src="../${work.image}" alt="${work.title}" class="artwork-image" />
        </div>
        <!-- Inyección de bloque de documentación del proceso creativo -->
        ${documentationHtml}
      </div>

      <aside class="artwork-details">
        <p class="artwork-code">${work.code} — Serie: ${serie.seriesTitle}</p>
        <h1>${work.title}</h1>

        <div class="meta">
          <p><strong>Año:</strong> ${work.year}</p>
          <p><strong>Técnica:</strong> ${work.technique}</p>
          <p><strong>Medida:</strong> ${work.size}</p>
        </div>

        <p class="description">${work.description}</p>

        <div class="qr-box" style="text-align: center; margin: 2rem 0; padding: 16px; border: 1px dashed var(--cds-border-subtle);">
          <img src="../assets/qr/${work.code}.png" alt="QR ${work.code}" style="width: 120px; height: 120px; filter: invert(0.9); display: block; margin: 0 auto 8px;" />
          <p class="cds--type-label-01" style="color: var(--cds-text-secondary); font-size: 11px;">Escanea para compartir o abrir en dispositivo móvil</p>
        </div>

        <a class="whatsapp-btn"
           target="_blank"
           href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}">
          Preguntar por WhatsApp
        </a>
      </aside>
    </section>
  </div>
</main>

</body>
</html>`;

            fs.writeFileSync(
                path.join(outputDir, `${work.code}.html`),
                html,
                "utf8"
            );
        }
    }

    console.log("Subpáginas estructuradas por series con documentación y QR generados con éxito.");
})();