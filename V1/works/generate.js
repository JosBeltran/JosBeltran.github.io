const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const inputCsv = process.argv[2] || 'obras.csv';

const safe = (value, fallback = '') => {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
};

const normalizeStatus = (status) => {
  const value = safe(status, 'Available').toLowerCase();

  if (['sold', 'vendido', 'private collection', 'coleccion privada', 'colección privada'].includes(value)) {
    return 'Sold';
  }

  if (['reserved', 'reservado', 'hold', 'on hold'].includes(value)) {
    return 'Reserved';
  }

  return 'Available';
};

const isAvailable = (status) => normalizeStatus(status) === 'Available';
const isSold = (status) => normalizeStatus(status) === 'Sold';
const isReserved = (status) => normalizeStatus(status) === 'Reserved';

const getFolderFromId = (id) => {
  return safe(id).split('-')[0].toUpperCase();
};

const getCollectionName = (row, folder) => {
  return (
    safe(row.Colleccion) ||
    safe(row.Coleccion) ||
    safe(row.Collection) ||
    folder.charAt(0) + folder.slice(1).toLowerCase()
  );
};

const cleanPath = (value) => {
  const text = safe(value);
  if (!text) return '';

  // If it already looks like a web path, keep it.
  if (text.startsWith('/')) return text;
  if (text.startsWith('./')) return text.replace('.', '');
  if (text.startsWith('../')) return text.replace('..', '');

  return `/${text}`;
};

const imagePathForHtml = (imagePath) => {
  const clean = cleanPath(imagePath);
  if (!clean) return '';
  return `..${clean}`;
};

const imagePathForOg = (imagePath) => {
  const clean = cleanPath(imagePath);
  if (!clean) return 'https://josbeltran.github.io/assets/preview.png';
  return `https://josbeltran.github.io${clean}`;
};

const buildImagePathFromName = (folder, imageName, ext = 'JPEG') => {
  const name = safe(imageName);
  if (!name) return '';

  if (name.startsWith('/images/')) return name;
  if (name.startsWith('./images/')) return name.replace('.', '');
  if (name.startsWith('../images/')) return name.replace('..', '');

  // If the filename already has an extension, use it directly.
  if (/\.(jpg|jpeg|png|webp)$/i.test(name)) {
    return `/images/${folder}/${name}`;
  }

  return `/images/${folder}/${name}.${ext}`;
};

const getMainImage = (row, folder) => {
  const directPath = safe(row['artwork-hero_full-artwork-image']);
  if (directPath) return cleanPath(directPath);

  const imageName =
    safe(row['Hero Image']) ||
    safe(row['Main Image']) ||
    safe(row['Imagen Principal']) ||
    safe(row['artwork-image']);

  const ext = safe(row['Image Ext'], 'JPEG');
  return buildImagePathFromName(folder, imageName, ext);
};

const getFramedImage = (row, folder, mainImage) => {
  const imageName =
    safe(row['artwork-image']) ||
    safe(row['Framed Image']) ||
    safe(row['Imagen Enmarcada']);

  const ext = safe(row['Framed Ext']) || safe(row['Image Ext'], 'JPEG');

  if (!imageName) return mainImage;

  return buildImagePathFromName(folder, imageName, ext);
};

const renderButton = ({ href, label, className }) => {
  const url = safe(href);
  if (!url || url === '#') return '';

  return `<a class="${className}" href="${url}" target="_blank" rel="noreferrer">${label}</a>`;
};

const renderAvailabilityButtons = (data) => {
  const status = normalizeStatus(data.estado);

  if (isSold(status)) {
    const saatchiPrints = renderButton({
      href: data.p_saatchi,
      label: 'Prints on Saatchi',
      className: 'btn btn-primary'
    });

    return `
          <span class="btn btn-sold">Sold · Private Collection</span>
          ${saatchiPrints}
          <a class="btn btn-secondary" href="mailto:josue.beltran.u@gmail.com?subject=Inquiry about ${data.nombre}">Contact</a>`;
  }

  if (isReserved(status)) {
    return `
          <span class="btn btn-reserved">Reserved</span>
          <a class="btn btn-secondary" href="mailto:josue.beltran.u@gmail.com?subject=Inquiry about ${data.nombre}">Contact</a>`;
  }

  const saatchi = renderButton({
    href: data.p_saatchi,
    label: 'View on Saatchi',
    className: 'btn btn-primary'
  });

  const ml = renderButton({
    href: data.p_ml,
    label: 'View on Mercado Libre',
    className: 'btn btn-secondary'
  });

  return `
          ${saatchi}
          ${ml}
          <a class="btn btn-secondary" href="mailto:josue.beltran.u@gmail.com?subject=Interest in ${data.nombre}">Contact</a>`;
};

const renderPlatformCards = (data) => {
  const status = normalizeStatus(data.estado);

  const saatchiCard = safe(data.p_saatchi) && data.p_saatchi !== '#'
    ? `
        <article class="platform-card">
          <div class="platform-logo platform-logo-text"><span>SAATCHI <em>ART</em></span></div>
          <span class="platform-badge">${isSold(status) ? 'Fine Art Prints' : 'International Platform'}</span>
          <p>${isSold(status)
            ? 'The original work is sold. Print options may be available through Saatchi Art.'
            : 'Available through an international art platform for collectors and curated interiors.'}</p>
          <a href="${data.p_saatchi}" target="_blank" rel="noreferrer" class="platform-button platform-button-primary">
            ${isSold(status) ? 'View prints on Saatchi' : 'Visit Saatchi Art'}
          </a>
        </article>`
    : '';

  const mlCard = safe(data.p_ml) && data.p_ml !== '#' && isAvailable(status)
    ? `
        <article class="platform-card">
          <div class="platform-logo mercado-logo"><span class="ml-icon">ML</span><span>Mercado Libre</span></div>
          <span class="platform-badge platform-badge-yellow">Mexico · Local Purchase</span>
          <p>Compra local en México mediante una plataforma conocida y familiar.</p>
          <a href="${data.p_ml}" target="_blank" rel="noreferrer" class="platform-button platform-button-outline">
            View on Mercado Libre
          </a>
        </article>`
    : '';

  const contactCard = `
        <article class="platform-card platform-card-dashed">
          <div class="platform-logo collaboration-logo"><span>☕</span></div>
          <span class="platform-badge platform-badge-blue">B2B / Consignment</span>
          <p>Available for offices, boutique hotels, cafés, interior projects or private inquiries.</p>
          <a href="mailto:josue.beltran.u@gmail.com?subject=Inquiry about ${data.nombre}" class="platform-button platform-button-blue">
            Contact JBeltran
          </a>
        </article>`;

  return [saatchiCard, mlCard, contactCard].filter(Boolean).join('\n');
};

const generateTemplate = (data) => {
  const status = normalizeStatus(data.estado);
  const statusLabel =
    isSold(status) ? 'Sold · Private Collection' :
    isReserved(status) ? 'Reserved' :
    'Available';

  const statusClass =
    isSold(status) ? 'artwork-status-sold' :
    isReserved(status) ? 'artwork-status-reserved' :
    'artwork-status-available';

  const ogTitle = `${data.nombre} — Original Artwork by JBeltran`;

  const ogDescription = safe(
    data.descripcion_en,
    safe(data.descripcion_es, 'Original artwork by JBeltran.')
  );

  const pageLang = 'en';

  return `<!DOCTYPE html>
<html lang="${pageLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <title>${data.nombre} — JBeltran</title>

  <meta name="description" content="${ogDescription}" />

  <meta property="og:title" content="${ogTitle}" />
  <meta property="og:description" content="${ogDescription}" />
  <meta property="og:image" content="${imagePathForOg(data.framed_img || data.hero_img)}" />
  <meta property="og:url" content="https://josbeltran.github.io/works/${data.file_name}" />
  <meta property="og:type" content="product" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${ogTitle}" />
  <meta name="twitter:description" content="${ogDescription}" />
  <meta name="twitter:image" content="${imagePathForOg(data.framed_img || data.hero_img)}" />

  <link rel="icon" type="image/png" href="../assets/favicon.png" />
  <link rel="apple-touch-icon" href="../assets/favicon.png" />
  <link rel="stylesheet" href="../styles.css" />
</head>

<body class="artwork-body">

  <header class="artwork-header">
    <a href="../index.html?scrollTo=${data.id.toLowerCase()}" class="back-home">← Back to collection</a>
  </header>

  <main class="artwork-page">

    <section class="artwork-hero artwork-hero-atmosphere" style="--art-bg: url('${imagePathForHtml(data.hero_img)}')">
      <div class="artwork-image">
        <img src="${imagePathForHtml(data.framed_img || data.hero_img)}" alt="${data.nombre} by JBeltran" />
      </div>

      <div class="artwork-info">
        <div class="artwork-code">${data.id.toUpperCase().replace(/-/g, ' ')} · Original Artwork</div>

        <div class="${statusClass}">${statusLabel}</div>

        <h1>${data.nombre}</h1>

        <p class="artwork-description">
          ${safe(data.descripcion_en, data.descripcion_es)}
        </p>

        <div class="artwork-details">
          <div class="detail-card">
            <strong>Technique</strong>
            ${data.tecnica}
          </div>

          <div class="detail-card">
            <strong>Dimensions</strong>
            ${data.dimensiones}
          </div>

          <div class="detail-card">
            <strong>Collection</strong>
            ${data.coleccion}
          </div>

          <div class="detail-card">
            <strong>Status</strong>
            ${statusLabel}
          </div>
        </div>

        <div class="buy-buttons">
${renderAvailabilityButtons(data)}
        </div>
      </div>
    </section>

    <section class="full-artwork-section">
      <div class="full-artwork-heading">
        <span>Full artwork view</span>
        <h2>The complete work</h2>
        <p>Unframed view of the piece to appreciate composition, texture and complete color field.</p>
      </div>

      <div class="full-artwork-image">
        <img src="${imagePathForHtml(data.hero_img)}" alt="${data.nombre} full artwork by JBeltran" />
      </div>
    </section>

    <section class="platform-section">
      <div class="section-heading">
        <span class="section-kicker">Availability</span>
        <h2>Available through selected channels</h2>
        <p>Choose the acquisition or contact option that best fits your location and buying preference.</p>
      </div>

      <div class="platform-grid">
${renderPlatformCards(data)}
      </div>
    </section>

  </main>

</body>
</html>`;
};

const results = [];

fs.createReadStream(inputCsv)
  .pipe(csv())
  .on('data', (row) => results.push(row))
  .on('end', () => {
    let created = 0;

    results.forEach((row) => {
      const id = safe(row.ID || row['﻿ID']);
      if (!id) return;

      const folder = getFolderFromId(id);
      const fileName = safe(row['og:url'], `${id}.html`);

      const mainImage = getMainImage(row, folder);
      const framedImage = getFramedImage(row, folder, mainImage);

      const cleanData = {
        id,
        nombre: safe(row.Nombre, id),
        descripcion_es: safe(row['Descripcion ES']),
        descripcion_en: safe(row['Descripcion ENU']) || safe(row['Description EN']),
        hero_img: mainImage,
        framed_img: framedImage,
        file_name: fileName,
        folder,
        coleccion: getCollectionName(row, folder),
        p_ml: safe(row['P ML'], '#'),
        p_saatchi: safe(row['P SAATCHI'], '#'),
        precio: safe(row.Precio),
        estado: safe(row.Estado, 'Available'),
        tecnica: safe(row['Técnica']) || safe(row.Tecnica) || safe(row.Technique) || 'Acrylic on paper',
        dimensiones: safe(row.Dimensiones) || safe(row.Dimensions) || '13 × 19 inches'
      };

      try {
        fs.writeFileSync(fileName, generateTemplate(cleanData), 'utf8');
        console.log(`✅ Creado: ${fileName}`);
        created += 1;
      } catch (err) {
        console.error(`❌ Error en ${fileName}:`, err);
      }
    });

    console.log(`\n🚀 Proceso finalizado. ${created} páginas generadas de ${results.length} registros.`);
  })
  .on('error', (err) => {
    console.error(`❌ Error leyendo ${inputCsv}:`, err);
  });