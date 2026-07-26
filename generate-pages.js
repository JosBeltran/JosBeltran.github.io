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

    // Process rows into JSON objects
    const works = rows.map(row => {
      const series = row[0] ? row[0].trim() : "";

const code = row[1] ? row[1].trim() : "";

const title = row[2] ? row[2].trim() : "Untitled";

const year = row[3] ? row[3].trim() : new Date().getFullYear().toString();

const technique = row[4] ? row[4].trim() : "Mixed Media";

const dimensions = row[5] ? row[5].trim() : "";

const mainImage = row[6] ? row[6].trim() : "";

const description = row[7] ? row[7].trim() : "";

const status = row[8] && row[8].toUpperCase() === "TRUE"
    ? "AVAILABLE"
    : "SOLD";

const price = row[9] ? row[9].trim() : "";

const stripeLink = row[10] ? row[10].trim() : "";

const galleryImages =[];

const sketchPath = row[12] ? row[12].trim() : "";

const processNotes = row[13] ? row[13].trim() : "";

const marketplaceTitle = row[14] ? row[14].trim() : "";

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
            galleryImages
        };
    }).filter(work => work.code !== "");

    console.log(`🚀 Generating ${works.length} artwork detail pages...`);

    for (const work of works) {
        // Safe URLs and paths
        const pageUrl = `${SITE_URL}/obras/${work.cleanCode}.html`;
        const qrPath = path.join(qrDir, `${work.cleanCode}.png`);
        await QRCode.toFile(qrPath, pageUrl, { width: 300, margin: 2 });

        const isAvailable = work.status === "AVAILABLE" || work.status === "DISPONIBLE";
        const statusBadge = isAvailable 
            ? '<span class="status-badge available">● Available</span>' 
            : '<span class="status-badge sold">○ Sold / Private Collection</span>';

        const buyButtonHtml = isAvailable && work.stripeLink 
            ? `<a href="${encodeURI(work.stripeLink)}" target="_blank" rel="noopener noreferrer" class="btn-primary-action">Acquire Artwork — ${escapeHtml(work.price)}</a>`
            : `<a href="https://wa.me/${WHATSAPP_NUMBER}?text=Hello,%20I%20am%20interested%20in%20the%20artwork%20${encodeURIComponent(work.title)}%20(${encodeURIComponent(work.code)})" target="_blank" rel="noopener noreferrer" class="btn-secondary-action">Inquire / Reserve</a>`;

        // Generate Gallery Grid HTML
        const allImages = [work.mainImage, ...work.galleryImages].filter(Boolean);
        const galleryHtml = allImages.map((img, index) => {
    const imagePath = img.startsWith("http")
        ? img
        : `../${img}`;

    return `
    <div class="artwork-image-wrapper">
        <img src="${encodeURI(imagePath)}"
             alt="${escapeHtml(work.title)} - View ${index + 1}"
             class="artwork-detail-img"
             loading="lazy" />
    </div>`;
}).join("");

        // Build Master Page Template
        const htmlContent = `<!DOCTYPE html>
<html lang="en" data-theme="white">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(work.title)} (${escapeHtml(work.year)}) — JBU Artwork Archive</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@carbon/styles@1/css/styles.min.css">
    <link rel="stylesheet" href="../styles.css" />
    <link rel="icon" type="image/png" href="../assets/logo.png" />
</head>
<body class="editorial-detail-body">
    <header class="gallery-header" role="banner">
        <div class="header-inner">
            <a href="../index.html" class="brand-logo" aria-label="JBU Home">
                <img src="../assets/logo.png" alt="JBU Logo" class="logo-clean" />
            </a>
            <nav class="main-nav" role="navigation">
                <ul class="nav-list" role="menubar">
                    <li role="none"><a class="nav-link" href="../index.html" role="menuitem">Gallery</a></li>
                    <li role="none"><a class="nav-link" href="../cases.html" role="menuitem">Case Devices</a></li>
                    <li role="none"><a class="nav-link" href="../info/soporte.html" role="menuitem">Contact</a></li>
                </ul>
            </nav>
            <div id="global-user-status" class="user-status-container"></div>
        </div>
    </header>

    <main class="cds--grid main-editorial-wrapper" style="padding-top: 2rem;">
        <div class="cds--row">
            <section class="cds--col-lg-10 cds--col-md-5 cds--col-sm-4">
                <div class="artwork-gallery-container">
                    ${galleryHtml}
                </div>
            </section>

            <aside class="cds--col-lg-6 cds--col-md-3 cds--col-sm-4">
                <div class="artwork-meta-panel sticky-panel">
                    <div class="meta-header">
                        <span class="series-tag">${escapeHtml(work.series)}</span>
                        ${statusBadge}
                    </div>

                    <h1 class="artwork-title">${escapeHtml(work.title)}</h1>
                    <p class="artwork-specs">${escapeHtml(work.technique)}, ${escapeHtml(work.dimensions)} (${escapeHtml(work.year)})</p>
                    
                    <div class="artwork-pricing">
                        <span class="price-label">Price:</span>
                        <span class="price-value">${escapeHtml(work.price)}</span>
                    </div>

                    <p class="artwork-description">${escapeHtml(work.description) || "Original artwork signed by the artist. Certificate of authenticity included."}</p>

                    <div class="interaction-block">
                        <div class="like-counter-wrapper">
                            <span id="contador-vistas" class="like-badge">❤️ 0 likes</span>
                            <span id="dossier-status-tag" class="like-status">Unsaved</span>
                        </div>

                        <button id="btn-ver-obra" class="btn-like-action">
                            ❤️ Like Artwork
                        </button>

                        <div id="dossier-content" class="dossier-expanded-panel" style="display: none; margin-top: 10px; font-size: 0.85rem; color: #555;">
                            <p>✨ Added to your saved favorites!</p>
                        </div>
                    </div>

                    <div class="purchase-actions" style="margin-top: 1.5rem;">
                        ${buyButtonHtml}
                    </div>

                    <div class="qr-verification-block" style="margin-top: 2rem;">
                        <img src="../assets/qr/${work.cleanCode}.png" alt="Verification QR Code" class="qr-code-img" style="width: 100px; height: 100px;" />
                        <span class="qr-code-label">Code: ${escapeHtml(work.code)}</span>
                    </div>
                </div>
            </aside>
        </div>
    </main>

    <footer class="gallery-footer" role="contentinfo">
        <div class="footer-inner">
            <span class="footer-copyright">© 2026 JBU. All rights reserved.</span>
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

        // 1. Fetch and display total likes count
        async function cargarTotalVistas() {
            if (!contadorVistas) return;
            try {
                const total = await obtenerTotalVistas(WORK_CODE);
                contadorVistas.textContent = "❤️ " + total + " likes";
            } catch (err) {
                console.error("💥 Error querying likes count:", err);
                contadorVistas.textContent = "❤️ 0 likes";
            }
        }

        // Public execution on load
        cargarTotalVistas();

        // 2. Real-time User Auth Listener
        onAuthStateChanged(auth, (user) => {
            if (user && globalUserStatus) {
                const name = user.displayName || user.email.split('@')[0];
                const photo = user.photoURL 
                    ? '<img src="' + user.photoURL + '" alt="' + name + '" class="user-avatar-img" />' 
                    : '<span class="user-status-dot"></span>';
                
                globalUserStatus.innerHTML = '<div class="user-badge">' + photo + '<span>Connected: <strong>' + name + '</strong></span></div>';
            } else if (globalUserStatus) {
                globalUserStatus.innerHTML = '<span style="color: #777;">👤 Guest (Not signed in)</span>';
            }
        });

        // 3. Like Button Action
        if (btnVerObra) {
            btnVerObra.addEventListener("click", async () => {
                let user = auth.currentUser;

                // Toggle off if already liked
                if (liked) {
                    liked = false;
                    btnVerObra.textContent = "❤️ Like Artwork";
                    if (dossierContent) dossierContent.style.display = "none";
                    if (statusTag) statusTag.textContent = "Unsaved";
                    return;
                }

                // Require login if user is not authenticated
                if (!user) {
                    try {
                        console.log("🔒 [Auth] Login required to like artwork...");
                        const result = await signInWithPopup(auth, provider);
                        user = result.user;
                        console.log("✅ [Auth] Signed in as:", user.displayName);
                    } catch (error) {
                        console.error("💥 [Auth] Login cancelled or failed:", error);
                        alert("Please sign in with your Google account to like and save this artwork.");
                        return;
                    }
                }

                // Mark as liked upon successful auth
                liked = true;
                btnVerObra.textContent = "💖 Liked";
                if (dossierContent) dossierContent.style.display = "block";
                if (statusTag) statusTag.textContent = "Liked";

                // Record like in Firestore
                try {
                    const esNuevaVista = await guardarVista(user.uid, WORK_CODE);
                    if (esNuevaVista) {
                        console.log("✅ [Firestore] New like recorded for:", WORK_CODE);
                        await cargarTotalVistas();
                    } else {
                        console.log("ℹ️ [Firestore] Existing like found. Count not duplicated.");
                    }
                } catch (err) {
                    console.error("💥 [Firestore] Error saving like:", err);
                }
            });
        }
    </script>
</body>
</html>`;
console.log(outputDir);
        fs.writeFileSync(path.join(outputDir, `${work.cleanCode}.html`), htmlContent, "utf8");
    }

    console.log("✅ Custom English detail pages with Likes feature created successfully.");
})();