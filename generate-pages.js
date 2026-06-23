const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const SITE_URL = "https://josbeltran.github.io/"; // cambia esto
const data = JSON.parse(fs.readFileSync("artworks.json", "utf8"));

const outputDir = path.join(__dirname, "obras");
const qrDir = path.join(__dirname, "assets", "qr");

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(qrDir, { recursive: true });

(async () => {
    for (const work of data.works) {
        const pageUrl = `${SITE_URL}/obras/${work.code}.html`;
        const qrPath = path.join(qrDir, `${work.code}.png`);

        await QRCode.toFile(qrPath, pageUrl, {
            width: 500,
            margin: 2
        });

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${work.code} | ${work.title}</title>
  <link rel="stylesheet" href="../styles.css" />
</head>
<body>

<main class="artwork-page">
  <a href="../index.html" class="back-link">← Volver al catálogo</a>

  <section class="artwork-layout">
    <div class="artwork-image-wrap">
      <img src="../${work.image}" alt="${work.title}" class="artwork-image" />
    </div>

    <aside class="artwork-details">
      <img src="../${data.logo}" class="detail-logo" alt="JBU" />

      <p class="artwork-code">${work.code}</p>
      <h1>${work.title}</h1>

      <div class="meta">
        <p><strong>Año:</strong> ${work.year}</p>
        <p><strong>Técnica:</strong> ${work.technique}</p>
        <p><strong>Medida:</strong> ${work.size}</p>
      </div>

      <p class="description">${work.description}</p>

      <div class="qr-box">
        <img src="../assets/qr/${work.code}.png" alt="QR ${work.code}" />
        <p>Escanea para abrir esta obra</p>
      </div>
    </aside>
  </section>
</main>

</body>
</html>`;

        fs.writeFileSync(path.join(outputDir, `${work.code}.html`), html, "utf8");
    }

    console.log("Subpáginas y QR generados correctamente.");
})();