/**
 * ==========================================================================
 * ENGINE: Galería, Tienda y Archivo Editorial (JBU)
 * Carga dinámica desde Google Sheets (Publicado como CSV)
 * ==========================================================================
 */

// Estado global de la aplicación para guardar los datos una vez cargados
let galleryDataset = { series: [] };

// CONFIGURACIÓN DE GOOGLE SHEETS
// 1. Reemplaza este ID con tu ID de Google Sheet real
const SPREADSHEET_ID = "1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw"; 
// 2. Nombre exacto de tu pestaña en Google Sheets
const SHEET_NAME = "Catalogo"; 
// URL para consultar la hoja publicada como CSV
const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRU6VDnbC00SbibTH3o8zEmOUplzNQKNV-3I99GB8MI9NVBz1J4PUdHahXGqSi_4JBVvFerrpQpwlYw/pub?output=csv`;

// 1. Inicialización del Motor de la Galería al cargar el DOM
document.addEventListener("DOMContentLoaded", () => {
    loadGalleryData();
});

/**
 * Carga los datos de la hoja de cálculo de Google y los procesa
 */
async function loadGalleryData() {
    try {
        console.log("Sincronizando con Google Sheets...");
        console.log("Intentando conectar a:", GOOGLE_SHEETS_CSV_URL); // Añade esto

        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) {
            throw new Error(`Error al leer Google Sheets: ${response.statusText}`);
        }
        
        const csvText = await response.text();
        
        // Convertimos el CSV plano a la estructura agrupada por series que usa la UI
        galleryDataset = parseCSVToGalleryDataset(csvText);
        
        // Inicializar los componentes visuales con los datos cargados
        initGalleryEngine();
        
    } catch (error) {
        console.error("No se pudo inicializar la galería desde Google Sheets:", error);
        // Fallback visual amigable en el grid por si falla la carga
        const gridContainer = document.getElementById("codeGrid");
        if (gridContainer) {
            gridContainer.innerHTML = `
                <div style="grid-column: span 12; text-align: center; padding: 40px 0;">
                    <p class="metadata-label">Error de conexión</p>
                    <p class="artist-manifesto">No se pudieron sincronizar las colecciones de arte en este momento.</p>
                </div>
            `;
        }
    }
}

/**
 * Utilidad robusta para procesar el CSV respetando comillas y saltos de línea
 */
function parseCSVToGalleryDataset(csvText) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    // Procesamiento caracter por caracter para evitar fallos con comas dentro de descripciones
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                row[row.length - 1] += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            row.push('');
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += char;
        }
    }
    if (row.length > 1 || row[0] !== '') {
        lines.push(row);
    }

    if (lines.length < 2) return { series: [] };

    // Extraemos las cabeceras (Fila 1) y removemos posibles espacios
    const headers = lines[0].map(h => h.trim());
    const rawRows = lines.slice(1);

    // Mapeamos los índices de las columnas según tu estructura
    const colIdx = {
        seriesTitle: headers.indexOf("Series Title"),
        code: headers.indexOf("Code"),
        title: headers.indexOf("Title"),
        year: headers.indexOf("Year"),
        technique: headers.indexOf("Technique"),
        size: headers.indexOf("Size"),
        image: headers.indexOf("Image"),
        description: headers.indexOf("Description"),
        isAvailable: headers.indexOf("IsAvailable"),
        originalPrice: headers.indexOf("Original Price"),
        stripeUrl: headers.indexOf("Stripe URL"),
        printsJson: headers.indexOf("Prints JSON"),
        marketplaceTitle: headers.indexOf("Marketplace Title")
    };

    const seriesMap = new Map();

    rawRows.forEach(cells => {
        // Ignoramos filas vacías o sin código de obra
        if (cells.length < headers.length || !cells[colIdx.code]) return;

        const seriesTitle = cells[colIdx.seriesTitle].trim();
        
        // Creamos la serie en el mapa si aún no existe
        if (!seriesMap.has(seriesTitle)) {
            seriesMap.set(seriesTitle, {
                seriesTitle: seriesTitle,
                seriesDescription: `Colección de obras pertenecientes a la serie ${seriesTitle}.`, // Descripción por defecto o dinámica
                works: []
            });
        }

        // Parseo seguro de Prints JSON si está presente
        let prints = [];
        try {
            const rawPrints = cells[colIdx.printsJson];
            if (rawPrints && rawPrints.trim() !== "" && rawPrints !== "[]") {
                prints = JSON.parse(rawPrints);
            }
        } catch (e) {
            console.warn(`Error parseando prints para la obra ${cells[colIdx.code]}:`, e);
        }

        // Construimos el objeto de la obra idéntico a tu JSON original
        const artwork = {
            code: cells[colIdx.code].trim(),
            title: cells[colIdx.title].trim(),
            year: cells[colIdx.year].trim(),
            technique: cells[colIdx.technique].trim(),
            size: cells[colIdx.size].trim(),
            image: cells[colIdx.image].trim(),
            description: cells[colIdx.description].trim(),
            isAvailable: cells[colIdx.isAvailable].trim().toUpperCase() === "TRUE",
            originalPrice: cells[colIdx.originalPrice] ? cells[colIdx.originalPrice].trim() : "",
            stripeUrl: cells[colIdx.stripeUrl] ? cells[colIdx.stripeUrl].trim() : "",
            prints: prints,
            marketplaceTitle: cells[colIdx.marketplaceTitle] ? cells[colIdx.marketplaceTitle].trim() : ""
        };

        seriesMap.get(seriesTitle).works.push(artwork);
    });

    return {
        series: Array.from(seriesMap.values())
    };
}

/**
 * Orquesta la renderización y eventos tras una carga exitosa
 */
function initGalleryEngine() {
    renderEditorialCatalog();
    
    // Extraer la primera obra de la primera serie para el estado inicial del Hero
    const firstActiveWork = getFirstAvailableArtwork();
    if (firstActiveWork) {
        setupInitialState(firstActiveWork);
    }
    
    setupLazyLoadingObserver();
}

/**
 * Obtiene la primera obra física del set de datos sin importar la serie
 */
function getFirstAvailableArtwork() {
    if (galleryDataset.series && galleryDataset.series.length > 0) {
        const firstSeriesWithWorks = galleryDataset.series.find(s => s.works && s.works.length > 0);
        if (firstSeriesWithWorks) {
            return firstSeriesWithWorks.works[0];
        }
    }
    return null;
}

/**
 * Renderiza el Catálogo agrupando por las series de tu JSON
 */
function renderEditorialCatalog() {
    const gridContainer = document.getElementById("codeGrid");
    if (!gridContainer) return;

    gridContainer.innerHTML = ""; // Limpieza previa

    // Buscamos el bloque de cabecera de la sección para hacerlo dinámico también
    const catalogHeaderBlock = document.querySelector(".catalog-header-block");

    galleryDataset.series.forEach((currentSeries, seriesIndex) => {
        
        // Si es la primera serie, podemos actualizar el título principal del catálogo si existe
        if (seriesIndex === 0 && catalogHeaderBlock) {
            catalogHeaderBlock.innerHTML = `
                <span class="metadata-label">Archivo de Obra</span>
                <h3 class="catalog-section-title">Colección ${currentSeries.seriesTitle}</h3>
                <p class="artist-manifesto" style="margin-top: 12px; max-width: 600px; font-size: 0.95rem; line-height: 1.6;">
                    ${currentSeries.seriesDescription || ''}
                </p>
            `;
        } else if (seriesIndex > 0) {
            // Para series subsecuentes, creamos un nuevo bloque separador dentro del grid
            const seriesHeaderHTML = `
                <div class="catalog-header-block" style="grid-column: span 12; width: 100%; margin-top: 60px; margin-bottom: 30px;">
                    <span class="metadata-label">Colección</span>
                    <h3 class="catalog-section-title" style="margin-top: 5px;">${currentSeries.seriesTitle}</h3>
                    <p class="artist-manifesto" style="margin-top: 12px; max-width: 600px; font-size: 0.95rem; line-height: 1.6;">
                        ${currentSeries.seriesDescription || ''}
                    </p>
                    <hr class="separator-line" style="margin-top: 20px; border: 0; border-top: 1px solid var(--cds-border-subtle, #e0e0e0);">
                </div>
            `;
            gridContainer.insertAdjacentHTML("beforeend", seriesHeaderHTML);
        }

        // Inyectar las obras correspondientes a esta serie específica
        currentSeries.works.forEach((art) => {
            const cardHTML = `
                <article class="editorial-artwork-card" data-code="${art.code}">
                    <div class="card-media-canvas">
                        <img class="card-image" src="${art.image}" alt="${art.title}" loading="lazy">
                    </div>
                    <div class="card-caption-details">
                        <div class="card-title-line">
                            <h4 class="card-title">${art.title}</h4>
                            <span class="card-year">${art.year}</span>
                        </div>
                        <p class="card-medium">${art.technique}</p>
                    </div>
                </article>
            `;
            gridContainer.insertAdjacentHTML("beforeend", cardHTML);
        });
    });

    // Enlazar interacciones táctiles y de cursor
    setupInteractions();
}

/**
 * Configura los eventos de interacción para Sidebar (hover) y Hero (click/dblclick).
 */
function setupInteractions() {
    const cards = document.querySelectorAll(".editorial-artwork-card");
    
    cards.forEach(card => {
        const artCode = card.getAttribute("data-code");
        const selectedArt = findArtworkByCode(artCode);

        if (!selectedArt) return;

        // ACCIÓN 1: Al pasar el cursor, actualizamos los datos en el Sidebar Izquierdo (Hover)
        card.addEventListener("mouseenter", () => {
            updateSidebarMetadata(selectedArt);
        });

        // ACCIÓN 2: Al hacer click simple, cambiamos la obra destacada en el Hero con transición suave
        card.addEventListener("click", (e) => {
            e.preventDefault();
            updateHeroSection(selectedArt);
            
            // Si está en dispositivo móvil o tablet, hace un scroll suave hacia el Hero para ver el cambio visual
            if (window.innerWidth <= 1024) {
                const heroSection = document.getElementById("hero-editorial-section");
                if (heroSection) {
                    heroSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });

        // ACCIÓN NUEVA: Doble click sobre la tarjeta del catálogo para abrir la obra directamente
        card.addEventListener("dblclick", () => {
            window.location.href = `obras/${selectedArt.code}.html`;
        });
    });

    // ACCIÓN NUEVA: Doble click sobre la imagen principal del Hero para abrir la obra
    const heroImg = document.getElementById("hero-img-display");
    if (heroImg) {
        heroImg.addEventListener("dblclick", () => {
            // Buscamos el código actual que tenga asignado el Hero en el título u otro contenedor
            const heroTitleEl = document.getElementById("hero-title-display");
            if (heroTitleEl) {
                // Buscamos la obra por el nombre/título para obtener el código exacto
                const activeArt = findArtworkByTitle(heroTitleEl.textContent);
                if (activeArt) {
                    window.location.href = `obras/${activeArt.code}.html`;
                }
            }
        });
        // Agregar cursor pointer a la imagen del Hero para que el usuario intuya interacción
        heroImg.style.cursor = "pointer";
    }
}

/**
 * Busca una obra por su código único JBU-XXX a lo largo de todas las series.
 */
function findArtworkByCode(code) {
    let foundArtwork = null;
    if (galleryDataset.series) {
        galleryDataset.series.forEach(s => {
            const art = s.works.find(w => w.code === code);
            if (art) foundArtwork = art;
        });
    }
    return foundArtwork;
}

/**
 * Busca una obra auxiliar por su título para resolver interacciones en el Hero.
 */
function findArtworkByTitle(title) {
    let foundArtwork = null;
    if (galleryDataset.series) {
        galleryDataset.series.forEach(s => {
            const art = s.works.find(w => w.title === title);
            if (art) foundArtwork = art;
        });
    }
    return foundArtwork;
}

/**
 * Actualiza los metadatos en el Panel Sticky Izquierdo (Sidebar).
 */
function updateSidebarMetadata(art) {
    const titleEl = document.getElementById("meta-title");
    const mediumEl = document.getElementById("meta-medium");
    const sizeEl = document.getElementById("meta-size");
    const yearEl = document.getElementById("meta-year");
    const ctaWrapper = document.getElementById("original-cta-wrapper");

    if (titleEl) titleEl.textContent = art.title;
    if (mediumEl) mediumEl.textContent = art.technique;
    if (sizeEl) sizeEl.textContent = art.size;
    if (yearEl) yearEl.textContent = art.year;

    // Redirección directa a su respectiva página obras/JBU-XXX.html
    if (ctaWrapper) {
        if (art.marketplaceTitle) {
            ctaWrapper.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
                    <span class="meta-value" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #198038; font-weight: 600;">
                        ✓ Disponible para adquisición
                    </span>
                    <a href="obras/${art.code}.html" class="btn-editorial-action" style="display: block; text-align: center; text-decoration: none; padding: 10px; background: #0f1115; color: #fff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                        Consultar Adquisición
                    </a>
                </div>
            `;
        } else {
            ctaWrapper.innerHTML = `
                <div style="margin-top: 15px;">
                    <span class="label-editorial-sold" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f;">
                        Colección Privada
                    </span>
                </div>
            `;
        }
    }
}

/**
 * Actualiza el Hero Visual y sus etiquetas usando una transición de opacidad.
 */
function updateHeroSection(art) {
    const heroImg = document.getElementById("hero-img-display");
    const heroTitle = document.getElementById("hero-title-display");
    const heroSpecs = document.getElementById("hero-specs-display");
    const heroActionContainer = document.getElementById("hero-action-container");

    if (!heroImg) return;

    // 1. Desvanecer la imagen actual
    heroImg.style.opacity = "0";

    // 2. Intercambiar la metadata y el src de la imagen a mitad del fade
    setTimeout(() => {
        heroImg.src = art.image;
        heroImg.alt = `Obra seleccionada: ${art.title}`;
        
        if (heroTitle) heroTitle.textContent = art.title;
        if (heroSpecs) heroSpecs.textContent = `${art.technique} — ${art.size} (${art.year})`;

        // Redirección directa a obras/JBU-XXX.html desde el botón del Hero
        if (heroActionContainer) {
            if (art.marketplaceTitle) {
                heroActionContainer.innerHTML = `
                    <a href="obras/${art.code}.html" class="btn-editorial-action" style="text-decoration: none; display: inline-block; padding: 10px 20px; background: #0f1115; color: #fff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                        Solicitar Ficha Técnica — ${art.code}
                    </a>
                `;
            } else {
                heroActionContainer.innerHTML = `
                    <span class="label-editorial-sold" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f; font-weight: 600;">
                        Colección Privada
                    </span>
                `;
            }
        }

        // 3. Devolver opacidad para la animación de Fade In
        heroImg.style.opacity = "1";
    }, 250); // Emparejado exactamente con el tiempo de transición CSS (250ms)
}

/**
 * Configura la carga inicial en el Hero y el Sidebar sin provocar retrasos de animación.
 */
function setupInitialState(initialArt) {
    updateSidebarMetadata(initialArt);
    
    const heroImg = document.getElementById("hero-img-display");
    if (heroImg) {
        heroImg.src = initialArt.image;
        heroImg.alt = `Obra destacada: ${initialArt.title}`;
        heroImg.style.opacity = "1";
    }
    
    const heroTitle = document.getElementById("hero-title-display");
    const heroSpecs = document.getElementById("hero-specs-display");
    const heroActionContainer = document.getElementById("hero-action-container");

    if (heroTitle) heroTitle.textContent = initialArt.title;
    if (heroSpecs) heroSpecs.textContent = `${initialArt.technique} — ${initialArt.size} (${initialArt.year})`;
    
    // Redirección directa a obras/JBU-XXX.html desde el estado inicial
    if (heroActionContainer) {
        if (initialArt.marketplaceTitle) {
            heroActionContainer.innerHTML = `
                <a href="obras/${initialArt.code}.html" class="btn-editorial-action" style="text-decoration: none; display: inline-block; padding: 10px 20px; background: #0f1115; color: #fff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                    Solicitar Ficha Técnica — ${initialArt.code}
                </a>
            `;
        } else {
            heroActionContainer.innerHTML = `
                <span class="label-editorial-sold" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f; font-weight: 600;">
                    Colección Privada
                </span>
            `;
        }
    }
}

/**
 * IntersectionObserver para que las tarjetas de obra aparezcan con un sutil Fade-In al hacer scroll.
 */
function setupLazyLoadingObserver() {
    const cards = document.querySelectorAll(".editorial-artwork-card");
    
    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.05
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    cards.forEach(card => observer.observe(card));
}