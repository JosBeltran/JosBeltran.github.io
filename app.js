/**
 * ==========================================================================
 * ENGINE: Galería, Tienda y Archivo Editorial (JBU)
 * Carga dinámica desde Google Sheets (Publicado como CSV)
 * Optimized for Incremental / Lazy Rendering (2026)
 * ==========================================================================
 */

let galleryDataset = { series: [] };

// CONFIGURACIÓN DE GOOGLE SHEETS
const SPREADSHEET_ID = "1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw"; 
const SHEET_NAME = "Catalogo"; 
const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRU6VDnbC00SbibTH3o8zEmOUplzNQKNV-3I99GB8MI9NVBz1J4PUdHahXGqSi_4JBVvFerrpQpwlYw/pub?output=csv`;

// Variables para control de carga incremental
let pendingSeriesToRender = [];
const SERIES_BATCH_SIZE = 1; // Renderiza 1 serie completa a la vez durante el scroll

document.addEventListener("DOMContentLoaded", () => {
    loadGalleryData();
    
    // Inicializar hidratación si estamos en página de detalle
    if (document.getElementById("live-original-cta")) {
        hydrateDetailPage();
    }
});

/**
 * Carga los datos de Google Sheets de forma eficiente
 */
async function loadGalleryData() {
    try {
        console.log("Sincronizando de forma incremental con Google Sheets...");
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        
        const csvText = await response.text();
        galleryDataset = parseCSVToGalleryDataset(csvText);
        
        initGalleryEngine();
    } catch (error) {
        console.error("No se pudo inicializar la galería:", error);
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
 * Parser CSV Ultra-Rápido basado en Expresiones Regulares
 */
/**
 * Parser CSV Seguro y de Alto Rendimiento (Corrige el bucle infinito)
 */
function parseCSVToGalleryDataset(csvText) {
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return { series: [] };

    // Función auxiliar para parsear una sola línea respetando comillas dobles
    const parseCSVLine = (line) => {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++; // Ignora la segunda comilla
                } else {
                    inQuotes = !inQuotes; // Entra o sale de comillas
                }
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    };

    // Extraer cabeceras limpias de la primera fila
    const headers = parseCSVLine(lines[0]).map(h => h.trim());

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

    // Procesar las filas de datos
    for (let i = 1; i < lines.length; i++) {
        const rowText = lines[i];
        if (!rowText.trim()) continue; // Ignorar filas vacías de separación

        const cells = parseCSVLine(rowText);

        // Validar que al menos exista el código de la obra para procesar
        if (cells.length < headers.length || !cells[colIdx.code]) continue;

        const seriesTitle = (cells[colIdx.seriesTitle] || "General").trim();
        if (!seriesMap.has(seriesTitle)) {
            seriesMap.set(seriesTitle, {
                seriesTitle: seriesTitle,
                seriesDescription: `Colección de obras pertenecientes a la serie ${seriesTitle}.`,
                works: []
            });
        }

        let prints = [];
        const rawPrints = cells[colIdx.printsJson];
        if (rawPrints && rawPrints.trim() !== "" && rawPrints !== "[]") {
            try { 
                prints = JSON.parse(rawPrints); 
            } catch(e) {
                console.warn(`Error parseando prints en fila ${i}:`, e);
            }
        }

        seriesMap.get(seriesTitle).works.push({
            code: (cells[colIdx.code] || "").trim(),
            title: (cells[colIdx.title] || "").trim(),
            year: (cells[colIdx.year] || "").trim(),
            technique: (cells[colIdx.technique] || "").trim(),
            size: (cells[colIdx.size] || "").trim(),
            image: (cells[colIdx.image] || "").trim(),
            description: (cells[colIdx.description] || "").trim(),
            isAvailable: (cells[colIdx.isAvailable] || "").trim().toUpperCase() === "TRUE",
            originalPrice: cells[colIdx.originalPrice] ? cells[colIdx.originalPrice].trim() : "",
            stripeUrl: cells[colIdx.stripeUrl] ? cells[colIdx.stripeUrl].trim() : "",
            prints: prints,
            marketplaceTitle: cells[colIdx.marketplaceTitle] ? cells[colIdx.marketplaceTitle].trim() : ""
        });
    }

    return { series: Array.from(seriesMap.values()) };
}

/**
 * Inicialización asíncrona y progresiva del catálogo
 */
function initGalleryEngine() {
    const firstActiveWork = getFirstAvailableArtwork();
    if (firstActiveWork) {
        setupInitialState(firstActiveWork);
    }

    // Clonamos las series para el renderizado por demanda
    pendingSeriesToRender = [...galleryDataset.series];
    
    const gridContainer = document.getElementById("codeGrid");
    if (gridContainer) gridContainer.innerHTML = ""; 

    // Renderizado del lote inicial (Primera serie) de manera inmediata
    renderNextSeriesBatch();

    // Configurar el scroll infinito / incremental para el resto
    setupIncrementalRenderObserver();
}

/**
 * Renderiza el lote de series en formato Masonry continuo
 */
function renderNextSeriesBatch() {
    const gridContainer = document.getElementById("codeGrid");
    if (!gridContainer || pendingSeriesToRender.length === 0) return;

    const catalogHeaderBlock = document.querySelector(".catalog-header-block");
    const batch = pendingSeriesToRender.splice(0, SERIES_BATCH_SIZE);
    
    const currentIndex = galleryDataset.series.length - pendingSeriesToRender.length - batch.length;
    let htmlBuffer = "";

    batch.forEach((currentSeries, index) => {
        const absoluteIndex = currentIndex + index;

        if (absoluteIndex === 0 && catalogHeaderBlock) {
            catalogHeaderBlock.innerHTML = `
                <span class="metadata-label">Archivo de Obra</span>
                <h3 class="catalog-section-title">Colección ${currentSeries.seriesTitle}</h3>
                <p class="artist-manifesto" style="margin-top: 12px; max-width: 600px; font-size: 0.95rem; line-height: 1.6;">
                    ${currentSeries.seriesDescription || ''}
                </p>
            `;
        } else {
            htmlBuffer += `
                <div class="catalog-header-block" style="column-span: all; width: 100%; margin-top: 50px; margin-bottom: 25px;">
                    <span class="metadata-label">Colección</span>
                    <h3 class="catalog-section-title" style="margin-top: 5px;">${currentSeries.seriesTitle}</h3>
                    <p class="artist-manifesto" style="margin-top: 8px; max-width: 600px; font-size: 0.95rem; line-height: 1.6;">
                        ${currentSeries.seriesDescription || ''}
                    </p>
                    <hr class="separator-line" style="margin-top: 20px; border: 0; border-top: 1px solid var(--cds-border-subtle, #e0e0e0);">
                </div>
            `;
        }

        currentSeries.works.forEach(art => {
            htmlBuffer += `
                <article class="editorial-artwork-card dynamic-load" data-code="${art.code}">
                    <div class="card-media-canvas">
                        <img class="card-image" src="${art.image}" alt="${art.title}" loading="lazy">
                    </div>
                    <div class="card-caption-overlay">
                        <h4 class="mosaic-title">${art.title}</h4>
                        <span class="mosaic-meta">${art.year} — ${art.size}</span>
                        <span class="mosaic-medium">${art.technique}</span>
                    </div>
                </article>
            `;
        });
    });

    gridContainer.insertAdjacentHTML("beforeend", htmlBuffer);

    setupInteractionsForCards();
    setupLazyLoadingObserver();
}

/**
 * Observer para detectar cuándo el usuario se acerca al final de la página y cargar más series
 */
function setupIncrementalRenderObserver() {
    const gridContainer = document.getElementById("codeGrid");
    if (!gridContainer) return;

    // Elemento centinela al final del grid
    let sentinel = document.getElementById("render-sentinel");
    if (!sentinel) {
        sentinel = document.createElement("div");
        sentinel.id = "render-sentinel";
        sentinel.style.height = "20px";
        sentinel.style.gridColumn = "span 12";
        gridContainer.after(sentinel);
    }

    const scrollObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && pendingSeriesToRender.length > 0) {
            renderNextSeriesBatch();
        }
    }, { rootMargin: "300px" }); // Empieza a cargar 300px antes de llegar al fondo

    scrollObserver.observe(sentinel);
}

function setupInteractionsForCards() {
    const cards = document.querySelectorAll(".editorial-artwork-card.dynamic-load");
    
    cards.forEach(card => {
        card.classList.remove("dynamic-load"); // Evitamos duplicar eventos
        const artCode = card.getAttribute("data-code");
        const selectedArt = findArtworkByCode(artCode);
        if (!selectedArt) return;

        // 1. En Desktop (mouse): Actualiza el panel lateral al pasar el cursor
        card.addEventListener("mouseenter", () => updateSidebarMetadata(selectedArt));
        
        // 2. Clic directo: Abre el Lightbox para navegar obra por obra en pantalla completa
        card.addEventListener("click", (e) => {
            e.preventDefault();
            
            // Actualiza la barra lateral/hero en segundo plano por si el usuario cierra el modal
            updateSidebarMetadata(selectedArt);
            updateHeroSection(selectedArt);

            // ABRE EL LIGHTBOX INTERACTIVO
            if (typeof openLightboxByCode === "function") {
                openLightboxByCode(selectedArt.code);
            }
        });
    });

    // Configuración del Hero (mantiene la interacción si el usuario hace doble clic en el panel)
    const heroImg = document.getElementById("hero-img-display");
    if (heroImg && !heroImg.dataset.hooked) {
        heroImg.dataset.hooked = "true";
        heroImg.style.cursor = "pointer";
        heroImg.addEventListener("click", () => {
            const heroTitleEl = document.getElementById("meta-title") || document.getElementById("hero-title-display");
            if (heroTitleEl) {
                const activeArt = findArtworkByTitle(heroTitleEl.textContent);
                if (activeArt && typeof openLightboxByCode === "function") {
                    openLightboxByCode(activeArt.code);
                }
            }
        });
    }
}
/**
 * IntersectionObserver para efectos visuales Fade-In nativos en las tarjetas
 */
function setupLazyLoadingObserver() {
    const cards = document.querySelectorAll(".editorial-artwork-card:not(.observed)");
    
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                obs.unobserve(entry.target);
            }
        });
    }, { threshold: 0.05 });

    cards.forEach(card => {
        card.classList.add("observed");
        observer.observe(card);
    });
}

// ==========================================================================
// FUNCIONES AUXILIARES Y DE BÚSQUEDA (Mantenidas idénticas para compatibilidad)
// ==========================================================================

function getFirstAvailableArtwork() {
    if (galleryDataset.series?.length > 0) {
        const firstSeriesWithWorks = galleryDataset.series.find(s => s.works?.length > 0);
        return firstSeriesWithWorks ? firstSeriesWithWorks.works[0] : null;
    }
    return null;
}

function findArtworkByCode(code) {
    let found = null;
    if (galleryDataset.series) {
        for (const s of galleryDataset.series) {
            found = s.works.find(w => w.code === code);
            if (found) break;
        }
    }
    return found;
}

function findArtworkByTitle(title) {
    let found = null;
    if (galleryDataset.series) {
        for (const s of galleryDataset.series) {
            found = s.works.find(w => w.title === title);
            if (found) break;
        }
    }
    return found;
}

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

    if (ctaWrapper) {
        if (art.isAvailable) {
            ctaWrapper.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 15px;">
                    <span class="meta-value" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #198038; font-weight: 600;">
                        ✓ Disponible para adquisición — ${art.originalPrice || ''}
                    </span>
                    <a href="obras/${art.code}.html" class="btn-editorial-action" style="display: block; text-align: center; text-decoration: none; padding: 10px; background: #0f1115; color: #fff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                        Consultar Adquisición
                    </a>
                </div>`;
        } else {
            ctaWrapper.innerHTML = `
                <div style="margin-top: 15px;">
                    <span class="label-editorial-sold" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f;">
                        Colección Privada
                    </span>
                </div>`;
        }
    }
}

function updateHeroSection(art) {
    const heroImg = document.getElementById("hero-img-display");
    const heroTitle = document.getElementById("hero-title-display");
    const heroSpecs = document.getElementById("hero-specs-display");
    const heroActionContainer = document.getElementById("hero-action-container");

    if (!heroImg) return;
    heroImg.style.opacity = "0";

    setTimeout(() => {
        heroImg.src = art.image;
        heroImg.alt = `Obra seleccionada: ${art.title}`;
        
        if (heroTitle) heroTitle.textContent = art.title;
        if (heroSpecs) heroSpecs.textContent = `${art.technique} — ${art.size} (${art.year})`;

        if (heroActionContainer) {
            heroActionContainer.innerHTML = art.isAvailable ? `
                <a href="obras/${art.code}.html" class="btn-editorial-action" style="text-decoration: none; display: inline-block; padding: 10px 20px; background: #0f1115; color: #fff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                    Solicitar Ficha Técnica — ${art.code}
                </a>` : `
                <span class="label-editorial-sold" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f; font-weight: 600;">
                    Colección Privada
                </span>`;
        }
        heroImg.style.opacity = "1";
    }, 250);
}

function setupInitialState(initialArt) {
    updateSidebarMetadata(initialArt);
    
    const heroImg = document.getElementById("hero-img-display");
    if (heroImg) {
        heroImg.src = initialArt.image;
        heroImg.alt = `Obra destacada: ${initialArt.title}`;
        heroImg.style.opacity = "1";
    }
    
    if (document.getElementById("hero-title-display")) document.getElementById("hero-title-display").textContent = initialArt.title;
    if (document.getElementById("hero-specs-display")) document.getElementById("hero-specs-display").textContent = `${initialArt.technique} — ${initialArt.size} (${initialArt.year})`;
    
    const heroActionContainer = document.getElementById("hero-action-container");
    if (heroActionContainer) {
        heroActionContainer.innerHTML = initialArt.isAvailable ? `
            <a href="obras/${initialArt.code}.html" class="btn-editorial-action" style="text-decoration: none; display: inline-block; padding: 10px 20px; background: #0f1115; color: #fff; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px;">
                Solicitar Ficha Técnica — ${initialArt.code}
            </a>` : `
            <span class="label-editorial-sold" style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #6f6f6f; font-weight: 600;">
                Colección Privada
            </span>`;
    }
}

/**
 * Hidratación optimizada para páginas de detalles individuales
 */
async function hydrateDetailPage() {
    const originalContainer = document.getElementById("live-original-cta");
    const printsContainer = document.getElementById("live-prints-cta");
    if (!originalContainer) return;
    
    const WORK_CODE = originalContainer.getAttribute("data-work-code");
    if (!WORK_CODE) return;

    try {
        if (!galleryDataset.series || galleryDataset.series.length === 0) {
            const response = await fetch(GOOGLE_SHEETS_CSV_URL);
            if (!response.ok) throw new Error("Error leyendo base de datos");
            const csvText = await response.text();
            galleryDataset = parseCSVToGalleryDataset(csvText);
        }

        const currentWork = findArtworkByCode(WORK_CODE);
        if (currentWork) {
            originalContainer.classList.remove("loading-pulse");
            
            if (currentWork.isAvailable) {
                originalContainer.innerHTML = currentWork.stripeUrl?.trim() ? `
                    <a href="${currentWork.stripeUrl}" target="_blank" class="btn-original-buy">
                        Adquirir Original — ${currentWork.originalPrice}
                    </a>` : `
                    <div class="original-sold-container" style="border: 1px dashed var(--border-color); padding: 18px; background-color: rgba(255,255,255,0.02); text-align: center; margin-bottom: 8px;">
                        <div style="margin-bottom: 12px; font-weight: 600; color: var(--text-muted);">Disponible — ${currentWork.originalPrice}</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">
                            Pasarela de pago directo en línea para esta pieza en proceso de configuración. Si deseas adquirirla hoy, puedes contactarme directamente dando clic al botón de WhatsApp de abajo.
                        </p>
                    </div>`;
            } else {
                originalContainer.innerHTML = `
                    <div class="original-sold-container" style="border: 1px dashed var(--border-color); padding: 18px; background-color: rgba(255,255,255,0.02); text-align: center; margin-bottom: 8px;">
                        <div class="btn-original-sold" style="margin-bottom: 12px; font-weight: 600; color: #888;">Obra Original: Vendida</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">
                            Esta pieza única ya forma parte de una colección privada. Sin embargo, puedes adquirir una <strong>reproducción Giclée autorizada</strong> abajo o contactarme directamente para encargar una obra comisionada similar.
                        </p>
                    </div>`;
            }

            if (printsContainer && currentWork.prints?.length > 0) {
                const printButtons = currentWork.prints.map(print => {
                    const buttonText = print.label || "Adquirir Reproducción";
                    let finalUrl = print.url || "#";

                    if (finalUrl !== "#") {
                        const separator = finalUrl.includes("?") ? "&" : "?";
                        finalUrl = `${finalUrl}${separator}client_reference_id=${currentWork.code}`;
                    }

                    let displayLabel = buttonText;
                    let displayAction = "Adquirir →";
                    if (buttonText.includes(" - ")) {
                        const parts = buttonText.split(" - ");
                        displayLabel = parts[0];
                        displayAction = `${parts[1]} →`;
                    }

                    return `
                        <a class="print-order-btn" href="${finalUrl}" target="_blank">
                            <span>${displayLabel}</span>
                            <strong>${displayAction}</strong>
                        </a>`;
                }).join("");

                printsContainer.innerHTML = `
                    <div class="prints-box" style="margin-top: 16px;">
                        <span class="prints-title">Reproducciones Giclée (Prints)</span>
                        <p class="prints-desc">Impresión fine art de calidad de museo bajo demanda, gestionada por Prodigi.</p>
                        <div class="print-options-grid">${printButtons}</div>
                    </div>`;
            } else if (printsContainer) {
                printsContainer.innerHTML = "";
            }
        }
    } catch (e) {
        console.error("Error al hidratar los detalles:", e);
        originalContainer.classList.remove("loading-pulse");
        originalContainer.innerHTML = `<div class="btn-original-sold" style="color: var(--text-muted);">Precios online temporalmente no disponibles</div>`;
    }
}

// ==========================================================================
// MÓDULO LIGHTBOX / NAVEGADOR OBRAPOR OBRA (CARRUSEL FULLSCREEN)
// ==========================================================================

let allWorksFlat = []; // Arreglo plano para navegar fácilmente
let currentWorkIndex = 0;

// Variables para gestos táctiles (Swipe en móvil)
let touchStartX = 0;
let touchEndX = 0;

function initLightboxEngine() {
    const modal = document.getElementById("artwork-lightbox");
    const closeBtn = document.getElementById("lightbox-close");
    const prevBtn = document.getElementById("lightbox-prev");
    const nextBtn = document.getElementById("lightbox-next");

    if (!modal) return;

    // Cerrar modal
    closeBtn.addEventListener("click", closeLightbox);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeLightbox();
    });

    // Navegación con botones
    prevBtn.addEventListener("click", showPrevArtwork);
    nextBtn.addEventListener("click", showNextArtwork);

    // Navegación con teclado (Flechas y ESC)
    document.addEventListener("keydown", (e) => {
        if (!modal.classList.contains("active")) return;
        if (e.key === "ArrowLeft") showPrevArtwork();
        if (e.key === "ArrowRight") showNextArtwork();
        if (e.key === "Escape") closeLightbox();
    });

    // Soporte para gestos táctiles (Móvil)
    modal.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    modal.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, false);
}

function updateFlatWorksList() {
    allWorksFlat = [];
    if (galleryDataset.series) {
        galleryDataset.series.forEach(s => {
            if (s.works) allWorksFlat.push(...s.works);
        });
    }
}

function openLightboxByCode(code) {
    updateFlatWorksList();
    const index = allWorksFlat.findIndex(w => w.code === code);
    if (index !== -1) {
        currentWorkIndex = index;
        renderLightboxActiveWork();
        const modal = document.getElementById("artwork-lightbox");
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden"; // Evita el scroll de fondo
    }
}

function closeLightbox() {
    const modal = document.getElementById("artwork-lightbox");
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = ""; // Restaura el scroll
}

function showPrevArtwork() {
    if (allWorksFlat.length === 0) return;
    currentWorkIndex = (currentWorkIndex - 1 + allWorksFlat.length) % allWorksFlat.length;
    renderLightboxActiveWork();
}

function showNextArtwork() {
    if (allWorksFlat.length === 0) return;
    currentWorkIndex = (currentWorkIndex + 1) % allWorksFlat.length;
    renderLightboxActiveWork();
}

function renderLightboxActiveWork() {
    const art = allWorksFlat[currentWorkIndex];
    if (!art) return;

    const img = document.getElementById("lightbox-img");
    const title = document.getElementById("lightbox-title");
    const specs = document.getElementById("lightbox-specs");
    const cta = document.getElementById("lightbox-cta");

    // Efecto de transición suave
    img.style.opacity = "0";
    img.style.transform = "scale(0.97)";

    setTimeout(() => {
        img.src = art.image;
        img.alt = art.title;
        title.textContent = art.title;
        specs.textContent = `${art.technique} — ${art.size} (${art.year})`;
        cta.href = `obras/${art.code}.html`;
        cta.textContent = art.isAvailable ? `Consultar Adquisición — ${art.originalPrice || ''}` : "Ver Ficha de Obra";

        img.style.opacity = "1";
        img.style.transform = "scale(1)";
    }, 150);
}

function handleSwipeGesture() {
    const swipeThreshold = 50; // Mínimo de distancia en px para detectar el swipe
    if (touchEndX < touchStartX - swipeThreshold) {
        showNextArtwork(); // Swipe hacia la izquierda -> Siguiente
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        showPrevArtwork(); // Swipe hacia la derecha -> Anterior
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
    initLightboxEngine();
});