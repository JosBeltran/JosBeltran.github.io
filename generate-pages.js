const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const SITE_URL = "https://josuebeltranuresti.com/"; // cambia esto
const WHATSAPP_NUMBER = "528123518298"; // cambia esto

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

        const whatsappText = encodeURIComponent(
            `Hola, me interesa la obra ${work.code} - ${work.title}`
        );

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
      <img src="../${data.logo}" class="detail-logo" alt="JBU Logo" />

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

      <a class="whatsapp-btn"
         target="_blank"
         href="https://wa.me/${WHATSAPP_NUMBER}?text=${whatsappText}">
        Preguntar por WhatsApp
      </a>
    </aside>
  </section>
</main>

<script>
  const likeBtn = document.querySelector(".like-btn");
  const code = likeBtn.dataset.code;
  const key = "likes-" + code;
  const span = likeBtn.querySelector("span");

  let likes = Number(localStorage.getItem(key) || 0);
  span.textContent = likes;

  likeBtn.addEventListener("click", () => {
    likes++;
    localStorage.setItem(key, likes);
    span.textContent = likes;
  });
</script>

</body>
</html>`;

        fs.writeFileSync(
            path.join(outputDir, `${work.code}.html`),
            html,
            "utf8"
        );
    }

    console.log("Subpáginas y QR generados correctamente.");
})();