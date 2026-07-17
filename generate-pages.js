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
            code,
            title,
            year,
            technique,
            size,
            image,
            description,
            availability: {
                isAvailable,
                price: originalPrice || "",
                stripeUrl: stripeUrl || ""
            },
            prints: parsePrints(printsJson),
            documentation: (sketchUrl || notes) ? {
                sketchUrl: sketchUrl || "",
                notes: notes || ""
            } : null
        };

        if (!seriesMap.has(seriesTitle)) {
            seriesMap.set(seriesTitle, { seriesTitle, works: [] });
        }
        seriesMap.get(seriesTitle).works.push(workObj);
    }
    return Array.from(seriesMap.values());
}

(async () => {
    const rows = await getSheetsData();
    if (rows.length === 0) return;

    const seriesData = transformRowsToSeriesStructure(rows);

    for (const serie of seriesData) {
        for (const work of serie.works) {
            const pageUrl = `${SITE_URL}/obras/${work.code}.html`;
            const qrPath = path.join(qrDir, `${work.code}.png`);

            // Generar QR físico estático
            await QRCode.toFile(qrPath, pageUrl, { width: 500, margin: 2 });

            const whatsappText = encodeURIComponent(
                `Hola, me interesa la obra ${work.code} - ${work.title} de la serie ${serie.seriesTitle}`
            );

            // Bloque de documentación estático
            let documentationHtml = "";
            if (work.documentation) {
                const hasSketch = !!work.documentation.sketchUrl;
                documentationHtml = `
                <div class="cds--tile documentation-panel" style="margin-top: 2rem; background: var(--bg-card); border: 1px solid var(--border-color); padding: 24px;">
                    <h3 style="color: var(--text-muted); margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 1px; font-size: 0.75rem; margin-top: 0;">Proceso & Documentación</h3>
                    ${hasSketch ? `<div style="background: #000; padding: 12px; border: 1px solid var(--border-color); margin-bottom: 1rem; display: flex; justify-content: center;">
                        <img src="../${work.documentation.sketchUrl}" alt="Boceto de ${work.title}" style="width: 100%; max-height: 300px; object-fit: contain; opacity: 0.7;" />
                    </div>` : ''}
                    ${work.documentation.notes ? `<p style="font-style: italic; color: var(--text-muted); line-height: 1.5; font-size: 14px; margin: 0;">"${work.documentation.notes}"</p>` : ''}
                </div>`;
            }

            const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  
  <!-- SEO & Social Previews Estáticos para Pinterest y WhatsApp -->
  <title>${work.code} | ${work.title}</title>
  <meta name="description" content="${work.description.replace(/"/g, '&quot;')}" />
  <meta property="og:title" content="${work.code} | ${work.title}" />
  <meta property="og:description" content="${work.description.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="${SITE_URL}/${work.image}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="article" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="stylesheet" href="../styles.css" />
  <style>
    :root {
      --bg-dark: #161616;
      --bg-card: #1f1f1f;
      --border-color: #2d2d2d;
      --text-main: #f4f4f4;
      --text-muted: #a0a0a0;
    }
    body {
      background-color: var(--bg-dark); color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0; padding: 0;
    }
    .artwork-container { max-width: 1200px; margin: 0 auto; padding: 40px 24px; }
    .back-link { display: inline-flex; align-items: center; text-decoration: none; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 32px; transition: all 0.2s; }
    .back-link:hover { color: var(--text-main); transform: translateX(-4px); }
    .artwork-layout { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 64px; align-items: start; }
    @media (max-width: 900px) { .artwork-layout { grid-template-columns: 1fr; gap: 40px; } }
    .artwork-image-column { display: flex; flex-direction: column; gap: 20px; }
    .artwork-image-wrap { background-color: #101010; border: 1px solid var(--border-color); padding: 24px; display: flex; justify-content: center; align-items: center; }
    .artwork-image { max-width: 100%; max-height: 70vh; object-fit: contain; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4); }
    .artwork-details { position: sticky; top: 40px; }
    .artwork-code { font-size: 0.85rem; text-transform: uppercase; letter-spacing: 2px; color: var(--text-muted); margin: 0 0 12px 0; }
    h1 { font-size: 2.5rem; font-weight: 400; line-height: 1.2; margin: 0 0 24px 0; letter-spacing: -0.5px; }
    .meta-grid { border-top: 1px solid var(--border-color); border-bottom: 1px solid var(--border-color); padding: 16px 0; margin-bottom: 24px; }
    .meta-item { display: flex; justify-content: space-between; font-size: 0.95rem; padding: 6px 0; }
    .meta-item strong { color: var(--text-muted); font-weight: 400; }
    .description { font-size: 1rem; line-height: 1.6; color: #cccccc; margin-bottom: 32px; }
    .purchase-section { display: flex; flex-direction: column; gap: 16px; }
    .btn-original-buy { display: block; width: 100%; text-align: center; box-sizing: border-box; padding: 16px; background-color: var(--text-main); color: var(--bg-dark); text-decoration: none; font-weight: 500; font-size: 15px; transition: background-color 0.2s; }
    .btn-original-buy:hover { background-color: #e0e0e0; }
    .btn-original-sold { display: block; width: 100%; text-align: center; box-sizing: border-box; padding: 16px; background-color: transparent; color: #555555; border: 1px solid #333333; font-size: 15px; cursor: not-allowed; }
    .prints-box { border: 1px solid var(--border-color); background-color: var(--bg-card); padding: 20px; }
    .prints-title { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 6px; display: block; }
    .prints-desc { font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin: 0 0 16px 0; }
    .print-options-grid { display: flex; flex-direction: column; gap: 10px; }
    .print-order-btn { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background-color: #282828; border: 1px solid #383838; color: var(--text-main); text-decoration: none; font-size: 0.85rem; transition: all 0.2s; }
    .print-order-btn:hover { background-color: #333333; border-color: #444444; }
    .print-order-btn strong { color: #9cdb24; }
    .whatsapp-btn-secondary { display: block; width: 100%; text-align: center; box-sizing: border-box; padding: 14px; border: 1px solid var(--border-color); background-color: transparent; color: var(--text-muted); text-decoration: none; font-size: 14px; transition: all 0.2s; }
    .whatsapp-btn-secondary:hover { background-color: #222222; color: var(--text-main); border-color: #444444; }
    .qr-box { text-align: center; margin-top: 32px; padding: 20px; border: 1px dashed var(--border-color); }
    .qr-img { width: 110px; height: 110px; filter: invert(0.9); display: block; margin: 0 auto 12px; }
    .qr-text { color: var(--text-muted); font-size: 0.75rem; margin: 0; }
    
    .loading-pulse { animation: pulse 1.5s infinite ease-in-out; opacity: 0.6; }
    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 0.8; } 100% { opacity: 0.4; } }
  </style>
</head>
<body>

<main class="artwork-container">
  <a href="../index.html" class="back-link">← Volver al catálogo</a>
  <section class="artwork-layout">
    
    <div class="artwork-image-column">
      <div class="artwork-image-wrap">
        <img src="../${work.image}" alt="${work.title}" class="artwork-image" />
      </div>
      ${documentationHtml}
    </div>

    <aside class="artwork-details">
      <p class="artwork-code">${work.code} — Serie: ${serie.seriesTitle}</p>
      <h1>${work.title}</h1>
      <div class="meta-grid">
        <div class="meta-item"><strong>Año:</strong><span>${work.year}</span></div>
        <div class="meta-item"><strong>Técnica:</strong><span>${work.technique}</span></div>
        <div class="meta-item"><strong>Medida:</strong><span>${work.size}</span></div>
      </div>
      <p class="description">${work.description}</p>
      
      <div class="purchase-section">
        <!-- Loader inicial de disponibilidad en tiempo real -->
        <div id="live-original-cta" class="loading-pulse">
            <div class="btn-original-sold">Sincronizando estado actual...</div>
        </div>
        
        <div id="live-prints-cta"></div>

        <a class="whatsapp-btn-secondary" target="_blank" href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}">
          Preguntar por WhatsApp
        </a>
      </div>

      <div class="qr-box">
        <img src="../assets/qr/${work.code}.png" alt="QR ${work.code}" class="qr-img" />
        <p class="qr-text">Escanea para compartir o abrir en dispositivo móvil</p>
      </div>
    </aside>
  </section>
</main>

<script>
  (async function hydratePage() {
    const WORK_CODE = "${work.code}";
    const API_URL = "https://script.google.com/macros/s/TU_SCRIPT_ID/exec"; // Tu URL de Google Apps Script
    
    const STRIPE_CONFIG = {
        generic_print_a4_url: "https://buy.stripe.com/genericA4Link",
        generic_print_a3_url: "https://buy.stripe.com/genericA3Link"
    };

    try {
      const response = await fetch(API_URL);
      const artworks = await response.json();
      const currentWork = artworks.find(w => w.code.toLowerCase() === WORK_CODE.toLowerCase());

      if (currentWork) {
        const originalContainer = document.getElementById("live-original-cta");
        originalContainer.classList.remove("loading-pulse");
        
        // Comprobar si la obra está marcada como disponible y tiene un link de Stripe activo en Google Sheets
        if (currentWork.availability && currentWork.availability.isAvailable) {
            if (currentWork.availability.stripeUrl && currentWork.availability.stripeUrl.trim() !== "") {
                // Si ya tiene link de Stripe mañana, se habilita el CTA de compra directa
                originalContainer.innerHTML = \`
                <a href="\${currentWork.availability.stripeUrl}" target="_blank" class="btn-original-buy">
                    Adquirir Original — \${currentWork.availability.price}
                </a>\`;
            } else {
                // Si la obra es disponible pero aún no colocas el link de Stripe (por ejemplo hoy)
                originalContainer.innerHTML = \`
                <div class="original-sold-container" style="border: 1px dashed var(--border-color); padding: 18px; background-color: rgba(255,255,255,0.02); text-align: center; margin-bottom: 8px;">
                    <div style="margin-bottom: 12px; font-weight: 600; color: var(--text-muted);">
                        Disponible — \${currentWork.availability.price}
                    </div>
                    <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">
                        Pasarela de pago directo en línea para esta pieza en proceso de configuración. Si deseas adquirirla hoy, puedes contactarme directamente dando clic al botón de WhatsApp de abajo.
                    </p>
                </div>\`;
            }
        } else {
            // Si está vendida
            originalContainer.innerHTML = \`
            <div class="original-sold-container" style="border: 1px dashed var(--border-color); padding: 18px; background-color: rgba(255,255,255,0.02); text-align: center; margin-bottom: 8px;">
                <div class="btn-original-sold" style="margin-bottom: 12px; font-weight: 600; color: #888;">
                    Obra Original: Vendida
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">
                    Esta pieza única ya forma parte de una colección privada. Sin embargo, puedes adquirir una <strong>reproducción Giclée autorizada</strong> abajo o contactarme directamente para encargar una obra comisionada similar.
                </p>
            </div>\`;
        }

        // 2. Cargar sección de Prints
        const printsContainer = document.getElementById("live-prints-cta");
        if (currentWork.prints && currentWork.prints.length > 0) {
            const printButtons = currentWork.prints.map(print => {
                let baseStripeUrl = "";
                if (print.size.includes("A4")) {
                    baseStripeUrl = STRIPE_CONFIG.generic_print_a4_url;
                } else if (print.size.includes("A3")) {
                    baseStripeUrl = STRIPE_CONFIG.generic_print_a3_url;
                }

                const descriptionText = encodeURIComponent(\`Reproducción de la obra: \${currentWork.title} (\${currentWork.code})\`);
                const dynamicPrintUrl = baseStripeUrl 
                    ? \`\${baseStripeUrl}?client_reference_id=\${currentWork.code}&description=\${descriptionText}\`
                    : "#";

                return \`
                <a class="print-order-btn" href="\${dynamicPrintUrl}" target="_blank">
                    <span>\${print.size}</span>
                    <strong>\${print.price} →</strong>
                </a>\`;
            }).join("");

            printsContainer.innerHTML = \`
            <div class="prints-box" style="margin-top: 16px;">
                <span class="prints-title">Reproducciones Giclée (Prints)</span>
                <p class="prints-desc">Impresión fine art de calidad de museo bajo demanda, gestionada por Prodigi.</p>
                <div class="print-options-grid">
                    \${printButtons}
                </div>
            </div>\`;
        }
      }
    } catch (e) {
      console.error("Error al sincronizar datos en tiempo real de Google Sheets:", e);
      const originalContainer = document.getElementById("live-original-cta");
      originalContainer.classList.remove("loading-pulse");
      originalContainer.innerHTML = \`
      <div class="btn-original-sold" style="color: var(--text-muted);">
          Precios online temporalmente no disponibles
      </div>\`;
    }
  })();
</script>

</body>
</html>`;

            fs.writeFileSync(path.join(outputDir, `${work.code}.html`), html, "utf8");
        }
    }

    console.log("¡Hecho! Páginas estáticas generadas. Listas para recibir enlaces dinámicos de Stripe sin necesidad de re-compilar.");
})();