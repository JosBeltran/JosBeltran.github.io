const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");
const { google } = require("googleapis");

const SITE_URL = "https://josuebeltranuresti.com";
const WHATSAPP_NUMBER = "528123518298";

// MASTER GOOGLE SHEETS CONFIGURATION
const SPREADSHEET_ID = "1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw";
const RANGE = "Catalogo!A2:N";

const outputDir = path.join(__dirname, "obras");
const qrDir = path.join(__dirname, "assets", "qr");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(qrDir, { recursive: true });

// Helper function to safely escape HTML entities
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Helper function to sanitize filenames
function sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9_-]/g, "_");
}

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
        console.error("Error reading Google Sheets:", error);
        return [];
    }
}

(async () => {
    const rows = await getSheetsData();

    if (rows.length === 0) {
        console.log("⚠️ No data found in Google Sheets.");
        return;
    }

    // Process rows into structured objects
    const works = rows.map(row => {
        const series = row[0] ? row[0].trim() : "Art Objects";
        const code = row[1] ? row[1].trim() : "";
        const title = row[2] ? row[2].trim() : "Untitled";
        const year = row[3] ? row[3].trim() : new Date().getFullYear().toString();
        const technique = row[4] ? row[4].trim() : "Mixed Media";
        const dimensions = row[5] ? row[5].trim() : "";
        
        // Normalizar ruta de imagen (removiendo barras invertidas de Windows)
        let mainImage = row[6] ? row[6].trim().replace(/\\/g, '/') : "";
        
        const description = row[7] ? row[7].trim() : "";
        const status = row[8] && row[8].toUpperCase() === "TRUE" ? "AVAILABLE" : "SOLD";
        const price = row[9] ? row[9].trim() : "";
        const stripeLink = row[10] ? row[10].trim() : "";
        
        // Carga de bocetos / imágenes adicionales de proceso
        let sketchPath = row[12] ? row[12].trim().replace(/\\/g, '/') : "";
        const processNotes = row[13] ? row[13].trim() : "";

        const galleryImages = [];
        if (sketchPath) {
            galleryImages.push({ url: sketchPath, isSketch: true });
        }

        return {
            code,
            cleanCode: sanitizeFilename(code),
            title,
            technique,
            dimensions,
            year,
            price,
            status,
            mainImage,
            stripeLink,
            description,
            series,
            galleryImages,
            processNotes
        };
    }).filter(work => work.code !== "");

    console.log(`🚀 Generating ${works.length} detail pages for all categories...`);

    for (const work of works) {
        const pageUrl = `${SITE_URL}/obras/${work.cleanCode}.html`;
        const qrPath = path.join(qrDir, `${work.cleanCode}.png`);
        await QRCode.toFile(qrPath, pageUrl, { width: 300, margin: 2 });

        // Normalizar la URL absoluta de la imagen para Open Graph Previews (WhatsApp, X, FB)
        const absoluteImageUrl = work.mainImage.startsWith("http") 
            ? work.mainImage 
            : `${SITE_URL}/${work.mainImage.replace(/^\.\//, '')}`;

        // Identificación dinámica del tipo de producto
        const seriesNorm = work.series.toLowerCase();
        const techNorm = work.technique.toLowerCase();

        let productCategory = "artwork"; // default
        if (seriesNorm.includes("case") || work.code.toLowerCase().includes("case")) {
            productCategory = "case";
        } else if (seriesNorm.includes("textile") || techNorm.includes("textile") || work.code.toLowerCase().includes("cush")) {
            productCategory = "textile";
        } else if (seriesNorm.includes("timepiece") || techNorm.includes("timepiece") || work.code.toLowerCase().includes("clck")) {
            productCategory = "timepiece";
        }

        // UI & Navigation Configurations
        let ui = {
            pageTitle: "JBU Artwork Archive",
            typeLabel: "Original Artwork",
            navActive: "originals",
            likeText: "❤️ Like Artwork",
            savedMessage: "✨ Item added to your favorites!"
        };

        if (productCategory === "case") {
            ui = {
                pageTitle: "JBU Case Devices",
                typeLabel: "Phone Case Edition",
                navActive: "cases",
                likeText: "❤️ Like Case",
                savedMessage: "✨ Case saved to favorites!"
            };
        } else if (productCategory === "textile" || productCategory === "timepiece") {
            ui = {
                pageTitle: "JBU Art Objects",
                typeLabel: productCategory === "textile" ? "Textile & Cushion Edition" : "Functional Timepiece",
                navActive: "objects",
                likeText: "❤️ Like Object",
                savedMessage: "✨ Art object saved to favorites!"
            };
        }

        const isAvailable = work.status === "AVAILABLE" || work.status === "DISPONIBLE";
        const statusBadge = isAvailable 
            ? '<span class="status-badge available">● Available</span>' 
            : '<span class="status-badge sold">○ Sold / Private Collection</span>';

        // Acción Principal: Inquire / Reserve vía WhatsApp o Direct Link
        const buyButtonHtml = isAvailable && work.stripeLink 
            ? `<a href="${encodeURI(work.stripeLink)}" target="_blank" rel="noopener noreferrer" class="btn-primary-action">Acquire — ${escapeHtml(work.price ? '$' + work.price + ' USD' : 'Inquire')}</a>`
            : `<a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hello,%20I%20am%20interested%20in%20the%20piece%20${encodeURIComponent(work.title)}%20(${encodeURIComponent(work.code)})" target="_blank" rel="noopener noreferrer" class="btn-secondary-action">Inquire / Reserve Piece</a>`;

        // Generar Galería con Control de Tamaño y Espacio para Bocetos
        const mainImgPath = work.mainImage.startsWith("http") ? work.mainImage : `../${work.mainImage}`;
        
        let galleryHtml = `
            <div class="artwork-image-wrapper main-image-container" style="text-align: center; margin-bottom: 1.5rem;">
                <img src="${encodeURI(mainImgPath)}"
                     alt="${escapeHtml(work.title)}"
                     class="artwork-detail-img-main"
                     style="max-height: 480px; width: auto; object-fit: contain; border-radius: 4px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.08));" />
            </div>`;

        if (work.galleryImages.length > 0) {
            galleryHtml += `<div class="additional-sketches-grid" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">`;
            work.galleryImages.forEach((item, index) => {
                const sketchImgPath = item.url.startsWith("http") ? item.url : `../${item.url}`;
                galleryHtml += `
                    <div class="sketch-wrapper" style="max-width: 200px; text-align: center;">
                        <img src="${encodeURI(sketchImgPath)}" 
                             alt="${escapeHtml(work.title)} - Sketch ${index + 1}" 
                             style="max-height: 180px; width: 100%; object-fit: contain; border: 1px solid #eee; border-radius: 4px;" />
                        <span style="display: block; font-size: 0.7rem; color: #888; margin-top: 4px;">Process Sketch</span>
                    </div>`;
            });
            galleryHtml += `</div>`;
        }

        // Plantilla HTML de la Subpágina
        const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="white">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(work.title)} (${escapeHtml(work.year)}) — JBU</title>
    
    <!-- Open Graph Meta Tags para Excelentes Previews al Compartir -->
    <meta property="og:title" content="${escapeHtml(work.title)} — JBU ${ui.typeLabel}" />
    <meta property="og:description" content="${escapeHtml(work.description || work.technique + ' ' + work.dimensions)}" />
    <meta property="og:image" content="${encodeURI(absoluteImageUrl)}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:type" content="article" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(work.title)}" />
    <meta name="twitter:image" content="${encodeURI(absoluteImageUrl)}" />

    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@carbon/styles@1/css/styles.min.css">
    <link rel="stylesheet" href="../styles.css" />
    <link rel="icon" type="image/png" href="../assets/logo.png" />
</head>
<body class="editorial-detail-body">
    <header class="gallery-header" role="banner">
        <div class="header-inner" style="display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; padding: 1rem;">
            <a href="../index.html" class="brand-logo" aria-label="JBU Home">
                <img src="../assets/logo.png" alt="JBU Logo" class="logo-clean" style="height: 35px;" />
            </a>
            <nav class="main-nav" role="navigation">
                <ul class="nav-list" role="menubar" style="display: flex; gap: 1.5rem; list-style: none; margin: 0;">
                    <li><a class="nav-link" href="../index.html" style="${ui.navActive === 'originals' ? 'font-weight: bold;' : ''}">Originals</a></li>
                    <li><a class="nav-link" href="../cases.html" style="${ui.navActive === 'cases' ? 'font-weight: bold;' : ''}">Case Devices</a></li>
                    <li><a class="nav-link" href="../art-objects.html" style="${ui.navActive === 'objects' ? 'font-weight: bold;' : ''}">Art Objects</a></li>
                    <li><a class="nav-link" href="../info/soporte.html">Contact</a></li>
                </ul>
            </nav>
            <div id="global-user-status" class="user-status-container"></div>
        </div>
    </header>

    <main class="cds--grid main-editorial-wrapper" style="padding-top: 2rem; max-width: 1200px; margin: 0 auto;">
        <div class="cds--row" style="display: flex; flex-wrap: wrap; gap: 2rem;">
            
            <!-- Contenedor Visual (Imagen Principal Regulada + Bocetos) -->
            <section style="flex: 1 1 500px; max-width: 650px;">
                <div class="artwork-gallery-container">
                    ${galleryHtml}
                </div>
            </section>

            <!-- Panel de Información & Acciones -->
            <aside style="flex: 1 1 350px;">
                <div class="artwork-meta-panel sticky-panel">
                    <div class="meta-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span class="series-tag" style="text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; color: #777;">${escapeHtml(work.series)}</span>
                        ${statusBadge}
                    </div>

                    <h1 class="artwork-title" style="font-size: 2rem; margin: 0.3rem 0;">${escapeHtml(work.title)}</h1>
                    <p class="artwork-specs" style="color: #666; font-size: 0.9rem; margin-bottom: 1.5rem;">
                        ${escapeHtml(work.technique)}${work.dimensions ? ' — ' + escapeHtml(work.dimensions) : ''} (${escapeHtml(work.year)})
                    </p>

                    ${work.description ? `<p class="artwork-description" style="line-height: 1.6; color: #444; margin-bottom: 1.5rem;">${escapeHtml(work.description)}</p>` : ''}

                    <div class="interaction-block" style="margin-bottom: 1.5rem; background: #fafafa; padding: 1rem; border-radius: 6px; border: 1px solid #eee;">
                        <div class="like-counter-wrapper" style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.8rem;">
                            <span id="contador-vistas" class="like-badge">❤️ 0 likes</span>
                            <span id="dossier-status-tag" class="like-status" style="color: #888;">Unsaved</span>
                        </div>

                        <button id="btn-ver-obra" class="btn-like-action" style="width: 100%; padding: 0.6rem; background: #fff; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; font-weight: 600;">
                            ${ui.likeText}
                        </button>

                        <div id="dossier-content" class="dossier-expanded-panel" style="display: none; margin-top: 10px; font-size: 0.85rem; color: #2e7d32; text-align: center;">
                            <p>${ui.savedMessage}</p>
                        </div>
                    </div>

                    <div class="purchase-actions">
                        ${buyButtonHtml}
                    </div>

                    <div class="qr-verification-block" style="margin-top: 2rem; display: flex; align-items: center; gap: 1rem; border-top: 1px solid #eee; padding-top: 1rem;">
                        <img src="../assets/qr/${work.cleanCode}.png" alt="Verification QR Code" class="qr-code-img" style="width: 75px; height: 75px;" />
                        <span class="qr-code-label" style="font-size: 0.8rem; color: #888;">Catalog Code:<br><strong style="color: #333;">${escapeHtml(work.code)}</strong></span>
                    </div>
                </div>
            </aside>
        </div>
    </main>

    <footer class="gallery-footer" role="contentinfo" style="margin-top: 4rem; padding: 2rem 0; border-top: 1px solid #eee; text-align: center;">
        <div class="footer-inner">
            <span class="footer-copyright" style="font-size: 0.85rem; color: #777;">© 2026 JBU. All rights reserved.</span>
        </div>
    </footer>

    <script type="module">
        import { guardarVista, obtenerTotalVistas } from "../js/firestore.js";
        import { auth } from "../js/firebase-config.js";
        import { 
            GoogleAuthProvider, 
            signInWithPopup,
            onAuthStateChanged 
        } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

        const globalUserStatus = document.getElementById("global-user-status");
        const btnVerObra = document.getElementById("btn-ver-obra");
        const contadorVistas = document.getElementById("contador-vistas");
        const dossierContent = document.getElementById("dossier-content");
        const statusTag = document.getElementById("dossier-status-tag");

        const WORK_CODE = ${JSON.stringify(work.code)};
        let liked = false;
        const provider = new GoogleAuthProvider();

        async function cargarTotalVistas() {
            if (!contadorVistas) return;
            try {
                const total = await obtenerTotalVistas(WORK_CODE);
                contadorVistas.textContent = "❤️ " + total + " likes";
            } catch (err) {
                console.error("Error querying likes count:", err);
                contadorVistas.textContent = "❤️ 0 likes";
            }
        }

        cargarTotalVistas();

        onAuthStateChanged(auth, (user) => {
            if (user && globalUserStatus) {
                const name = user.displayName || user.email.split('@')[0];
                globalUserStatus.innerHTML = '<span style="font-size: 0.8rem;">Connected: <strong>' + name + '</strong></span>';
            } else if (globalUserStatus) {
                globalUserStatus.innerHTML = '<span style="font-size: 0.8rem; color: #888;">Guest</span>';
            }
        });

        if (btnVerObra) {
            btnVerObra.addEventListener("click", async () => {
                let user = auth.currentUser;

                if (liked) {
                    liked = false;
                    btnVerObra.textContent = "${ui.likeText}";
                    if (dossierContent) dossierContent.style.display = "none";
                    if (statusTag) statusTag.textContent = "Unsaved";
                    return;
                }

                if (!user) {
                    try {
                        const result = await signInWithPopup(auth, provider);
                        user = result.user;
                    } catch (error) {
                        alert("Please sign in with your account to save this item.");
                        return;
                    }
                }

                liked = true;
                btnVerObra.textContent = "💖 Liked";
                if (dossierContent) dossierContent.style.display = "block";
                if (statusTag) statusTag.textContent = "Liked";

                try {
                    const esNuevaVista = await guardarVista(user.uid, WORK_CODE);
                    if (esNuevaVista) {
                        await cargarTotalVistas();
                    }
                } catch (err) {
                    console.error("Error saving like:", err);
                }
            });
        }
    </script>
</body>
</html>`;

        fs.writeFileSync(path.join(outputDir, `${work.cleanCode}.html`), htmlContent, "utf8");
    }

    console.log("✅ Custom detail subpages generated successfully with OG meta previews.");
})();