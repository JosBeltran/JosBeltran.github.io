/**
 * ==========================================================================
 * ENGINE: Galería, Tienda y Archivo Editorial (JBU)
 * Carga dinámica desde Google Sheets (Publicado como CSV)
 * Versión Unificada, Estable y Optimizada
 * ==========================================================================
 */

// --- ESTADO GLOBAL ---
let galleryDataset = { series: [] };
let flatArtworks = [];      // Lista plana de obras
let filteredArtworks = [];  // Obras tras aplicar filtros/búsqueda
let currentPage = 1;
const ITEMS_PER_PAGE = 12;

// CONFIGURACIÓN DE GOOGLE SHEETS
const SPREADSHEET_ID = "1uY0_p8BCl4Fs-MZMzWWYVdT33_d4BHEI-BVJtS3ednw"; 
const SHEET_NAME = "Catalogo"; 
const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRU6VDnbC00SbibTH3o8zEmOUplzNQKNV-3I99GB8MI9NVBz1J4PUdHahXGqSi_4JBVvFerrpQpwlYw/pub?output=csv`;

// Variables para Lightbox
let currentWorkIndex = 0;
let touchStartX = 0;
let touchEndX = 0;

// --- INICIALIZACIÓN ÚNICA DEL DOM ---
document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar datos principales
    loadGalleryData();

    // 2. Inicializar Lightbox
    initLightboxEngine();

    // 3. Hidratación en página de detalle (si aplica)
    if (document.getElementById("live-original-cta")) {
        hydrateDetailPage();
    }

    // 4. Configurar escuchadores de los filtros
    setupFilterListeners();
});

/**
 * Carga los datos de Google Sheets
 */
async function loadGalleryData() {
    try {
        console.log("Sincronizando con Google Sheets...");
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        
        const csvText = await response.text();
        
        // Parsea CSV a lista plana y reconstruye dataset estructurado
        flatArtworks = parseCSVToFlatArray(csvText);
        console.log(JSON.stringify(flatArtworks));
        galleryDataset = buildGalleryDatasetFromFlat(flatArtworks);
console.log(`Se organizaron ${galleryDataset.series.length} series de obras.`);
        // Configurar dropdowns de filtro e inicializar vista
        populateSeriesDropdown();
        applyFiltersAndRender();
        
        // Activar vista previa de Hero/Sidebar con la primera obra
        const firstWork = getFirstAvailableArtwork();
        if (firstWork) setupInitialState(firstWork);

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

// ==========================================================================
// PARSER CSV A DATASET (LINEAL Y SEGURO)
function parseCSVToFlatArray(csvText) {
    if (!csvText) return [];
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    // Normalizar encabezados: minúsculas, sin comillas, y removiendo espacios internos
    const headers = parseCSVLine(lines[0]).map(h => 
        h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '')
    );
    
    const items = [];
    console.log(`Encabezados normalizados: ${headers.join(", ")}`);

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index].trim() : "";
        });

        // Mapeo flexible detectando nombres de columnas
        const code = row.code || row.codigo || row.id || "";
        const title = row.title || row.titulo || row.obra || row.nombre || "";

        if (code || title) {
            const availableVal = String(row.isavailable || row.disponible || row.estatus || "").toUpperCase();
            const isAvailable = availableVal !== "FALSE" && availableVal !== "VENDIDO" && availableVal !== "SOLD";

            // Normalización del nombre de la serie
            const seriesName = row.seriestitle || row.series || row.serie || row.serietitulo || "General";

            items.push({
                code: code,
                title: title || "Sin Título",
                series: seriesName,
                seriesTitle: seriesName, // Por compatibilidad si otra función usa esta propiedad
                year: row.year || row.anio || row.año || "",
                medium: row.medium || row.technique || row.tecnica || row.medio || "",
                technique: row.technique || row.medium || row.tecnica || row.medio || "",
                dimensions: row.dimensions || row.size || row.medidas || row.dimensiones || "",
                size: row.size || row.dimensions || row.medidas || row.dimensiones || "",
                image: row.image || row.imagen || row.foto || row.url || "",
                description: row.description || row.descripcion || "",
                isAvailable: isAvailable,
                originalPrice: row.originalprice || row.precio || row.price || "",
                price: row.price || row.originalprice || row.precio || "0",
                stripeUrl: row.stripeurl || row.stripe || row.link || "",
                status: row.status || row.estatus || (isAvailable ? "AVAILABLE" : "SOLD")
            });
        }
    }
    return items;
}

function parseCSVLine(line) {
    const values = [];
    let currentValue = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
        } else {
            currentValue += char;
        }
    }
    values.push(currentValue.trim().replace(/^"|"$/g, ''));
    return values;
}

function buildGalleryDatasetFromFlat(flatList) {
    const seriesMap = {};
    flatList.forEach(item => {
        const sName = item.seriestitle || "General";
        if (!seriesMap[sName]) {
            seriesMap[sName] = {
                seriesTitle: sName,
                seriesDescription: "",
                works: []
            };
        }
        seriesMap[sName].works.push(item);
    });
    return { series: Object.values(seriesMap) };
}

// ==========================================================================
// FILTRADO, PAGINACIÓN Y RENDERIZADO
// ==========================================================================

function setupFilterListeners() {
    const searchInput = document.getElementById("filterSearch");
    const seriesSelect = document.getElementById("filterSeries") || document.getElementById("filter-series");
    const statusSelect = document.getElementById("filterStatus") || document.getElementById("filter-status");
    const sortSelect = document.getElementById("sortOrder") || document.getElementById("sort-by");
    const btnLoadMore = document.getElementById("btnLoadMore");

    if (searchInput) searchInput.addEventListener("input", applyFiltersAndRender);
    if (seriesSelect) seriesSelect.addEventListener("change", applyFiltersAndRender);
    if (statusSelect) statusSelect.addEventListener("change", applyFiltersAndRender);
    if (sortSelect) sortSelect.addEventListener("change", applyFiltersAndRender);

    if (btnLoadMore) {
        btnLoadMore.addEventListener("click", () => {
            currentPage++;
            renderCurrentPage(true);
        });
    }
}

function populateSeriesDropdown() {
    const seriesSelect = document.getElementById("filterSeries") || document.getElementById("filter-series");
    if (!seriesSelect) return;

    seriesSelect.innerHTML = `<option value="ALL">Todas las series</option>`;
    const seriesSet = new Set(flatArtworks.map(art => art.series).filter(Boolean));
    
    seriesSet.forEach(seriesName => {
        const option = document.createElement("option");
        option.value = seriesName;
        option.textContent = seriesName;
        seriesSelect.appendChild(option);
    });
}

function applyFiltersAndRender() {
    const searchVal = document.getElementById("filterSearch")?.value.toLowerCase().trim() || "";
    const seriesVal = (document.getElementById("filterSeries") || document.getElementById("filter-series"))?.value || "ALL";
    const statusVal = (document.getElementById("filterStatus") || document.getElementById("filter-status"))?.value || "ALL";
    const sortVal = (document.getElementById("sortOrder") || document.getElementById("sort-by"))?.value || "DEFAULT";

    // 1. Filtrar
    filteredArtworks = flatArtworks.filter(art => {
        const matchesSearch = !searchVal || 
            (art.title && art.title.toLowerCase().includes(searchVal)) ||
            (art.medium && art.medium.toLowerCase().includes(searchVal));
            
        const matchesSeries = (seriesVal === "ALL") || (art.series === seriesVal);
        const matchesStatus = (statusVal === "ALL") || 
            (statusVal === "AVAILABLE" && art.isAvailable) || 
            (statusVal === "SOLD" && !art.isAvailable);

        return matchesSearch && matchesSeries && matchesStatus;
    });

    // 2. Ordenar
    filteredArtworks.sort((a, b) => {
        if (sortVal === "TITLE_ASC") return (a.title || "").localeCompare(b.title || "");
        if (sortVal === "TITLE_DESC") return (b.title || "").localeCompare(a.title || "");
        if (sortVal === "PRICE_ASC") return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
        if (sortVal === "PRICE_DESC") return (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0);
        if (sortVal === "NEWEST") return (b.year || 0) - (a.year || 0);
        if (sortVal === "OLDEST") return (a.year || 0) - (b.year || 0);
        return 0;
    });

    // 3. Resetear Paginación y Dibujar
    currentPage = 1;
    renderCurrentPage(false);
}

function renderCurrentPage(append = false) {
    const grid = document.getElementById("codeGrid");
    const loadMoreContainer = document.getElementById("loadMoreContainer");
    if (!grid) return;

    if (!append) grid.innerHTML = "";

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const itemsToShow = filteredArtworks.slice(startIndex, endIndex);

    let htmlChunk = "";
    itemsToShow.forEach(art => {
        htmlChunk += `
            <article class="editorial-artwork-card dynamic-load" data-code="${art.code}">
                <div class="card-media-canvas">
                    <img class="card-image" src="${art.image}" alt="${art.title}" loading="lazy" />
                </div>
                <div class="card-caption-overlay">
                    <h4 class="mosaic-title">${art.title || 'Sin Título'}</h4>
                    <p class="mosaic-meta">${art.year || ''} ${art.dimensions ? '• ' + art.dimensions : ''}</p>
                    <span class="mosaic-medium">${art.medium || ''}</span>
                </div>
            </article>
        `;
    });

    grid.insertAdjacentHTML("beforeend", htmlChunk);

    // Manejo de visibilidad del botón "Cargar Más"
    if (loadMoreContainer) {
        loadMoreContainer.style.display = endIndex < filteredArtworks.length ? "block" : "none";
    }

    setupInteractionsForCards();
    setupLazyLoadingObserver();
}

// ==========================================================================
// INTERACCIONES Y HERO / SIDEBAR
// ==========================================================================

function setupInteractionsForCards() {
    const cards = document.querySelectorAll(".editorial-artwork-card.dynamic-load");
    
    cards.forEach(card => {
        card.classList.remove("dynamic-load");
        const artCode = card.getAttribute("data-code");
        const selectedArt = findArtworkByCode(artCode);
        if (!selectedArt) return;

        card.addEventListener("mouseenter", () => updateSidebarMetadata(selectedArt));
        
        card.addEventListener("click", (e) => {
            e.preventDefault();
            updateSidebarMetadata(selectedArt);
            updateHeroSection(selectedArt);

            if (typeof openLightboxByCode === "function") {
                openLightboxByCode(selectedArt.code);
            }
        });
    });

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

function updateSidebarMetadata(art) {
    const titleEl = document.getElementById("meta-title");
    const mediumEl = document.getElementById("meta-medium");
    const sizeEl = document.getElementById("meta-size");
    const yearEl = document.getElementById("meta-year");
    const ctaWrapper = document.getElementById("original-cta-wrapper");

    if (titleEl) titleEl.textContent = art.title;
    if (mediumEl) mediumEl.textContent = art.technique || art.medium;
    if (sizeEl) sizeEl.textContent = art.size || art.dimensions;
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
        if (heroSpecs) heroSpecs.textContent = `${art.technique || art.medium} — ${art.size || art.dimensions} (${art.year})`;

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
    if (document.getElementById("hero-specs-display")) document.getElementById("hero-specs-display").textContent = `${initialArt.technique || initialArt.medium} — ${initialArt.size || initialArt.dimensions} (${initialArt.year})`;
}

// ==========================================================================
// PÁGINA DE DETALLE (HIDRATACIÓN)
// ==========================================================================

async function hydrateDetailPage() {
    const originalContainer = document.getElementById("live-original-cta");
    const printsContainer = document.getElementById("live-prints-cta");
    if (!originalContainer) return;
    
    const WORK_CODE = originalContainer.getAttribute("data-work-code");
    if (!WORK_CODE) return;

    try {
        if (flatArtworks.length === 0) {
            const response = await fetch(GOOGLE_SHEETS_CSV_URL);
            if (!response.ok) throw new Error("Error leyendo base de datos");
            const csvText = await response.text();
            flatArtworks = parseCSVToFlatArray(csvText);
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
                            Pasarela de pago directo en línea para esta pieza en proceso de configuración. Contacta vía WhatsApp para comprarla hoy.
                        </p>
                    </div>`;
            } else {
                originalContainer.innerHTML = `
                    <div class="original-sold-container" style="border: 1px dashed var(--border-color); padding: 18px; background-color: rgba(255,255,255,0.02); text-align: center; margin-bottom: 8px;">
                        <div class="btn-original-sold" style="margin-bottom: 12px; font-weight: 600; color: #888;">Obra Original: Vendida</div>
                    </div>`;
            }
        }
    } catch (e) {
        console.error("Error al hidratar los detalles:", e);
        originalContainer.classList.remove("loading-pulse");
        originalContainer.innerHTML = `<div class="btn-original-sold" style="color: var(--text-muted);">Precios online temporalmente no disponibles</div>`;
    }
}

// ==========================================================================
// MÓDULO LIGHTBOX
// ==========================================================================

function initLightboxEngine() {
    const modal = document.getElementById("artwork-lightbox");
    const closeBtn = document.getElementById("lightbox-close");
    const prevBtn = document.getElementById("lightbox-prev");
    const nextBtn = document.getElementById("lightbox-next");

    if (!modal) return;

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeLightbox();
    });

    if (prevBtn) prevBtn.addEventListener("click", showPrevArtwork);
    if (nextBtn) nextBtn.addEventListener("click", showNextArtwork);

    document.addEventListener("keydown", (e) => {
        if (!modal.classList.contains("active")) return;
        if (e.key === "ArrowLeft") showPrevArtwork();
        if (e.key === "ArrowRight") showNextArtwork();
        if (e.key === "Escape") closeLightbox();
    });

    modal.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, false);

    modal.addEventListener("touchend", (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipeGesture();
    }, false);
}

function openLightboxByCode(code) {
    const index = filteredArtworks.findIndex(w => w.code === code);
    if (index !== -1) {
        currentWorkIndex = index;
        renderLightboxActiveWork();
        const modal = document.getElementById("artwork-lightbox");
        if (modal) {
            modal.classList.add("active");
            modal.setAttribute("aria-hidden", "false");
            document.body.style.overflow = "hidden";
        }
    }
}

function closeLightbox() {
    const modal = document.getElementById("artwork-lightbox");
    if (modal) {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }
}

function showPrevArtwork() {
    if (filteredArtworks.length === 0) return;
    currentWorkIndex = (currentWorkIndex - 1 + filteredArtworks.length) % filteredArtworks.length;
    renderLightboxActiveWork();
}

function showNextArtwork() {
    if (filteredArtworks.length === 0) return;
    currentWorkIndex = (currentWorkIndex + 1) % filteredArtworks.length;
    renderLightboxActiveWork();
}

function renderLightboxActiveWork() {
    const art = filteredArtworks[currentWorkIndex];
    if (!art) return;

    const img = document.getElementById("lightbox-img");
    const title = document.getElementById("lightbox-title");
    const specs = document.getElementById("lightbox-specs");
    const cta = document.getElementById("lightbox-cta");

    if (!img) return;

    img.style.opacity = "0";
    img.style.transform = "scale(0.97)";

    setTimeout(() => {
        img.src = art.image;
        img.alt = art.title;
        if (title) title.textContent = art.title;
        if (specs) specs.textContent = `${art.technique || art.medium} — ${art.size || art.dimensions} (${art.year})`;
        if (cta) {
            cta.href = `obras/${art.code}.html`;
            cta.textContent = art.isAvailable ? `Consultar Adquisición — ${art.originalPrice || ''}` : "Ver Ficha de Obra";
        }

        img.style.opacity = "1";
        img.style.transform = "scale(1)";
    }, 150);
}

function handleSwipeGesture() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) showNextArtwork();
    if (touchEndX > touchStartX + swipeThreshold) showPrevArtwork();
}

// ==========================================================================
// BÚSQUEDAS AUXILIARES
// ==========================================================================

function getFirstAvailableArtwork() {
    return flatArtworks.length > 0 ? flatArtworks[0] : null;
}

function findArtworkByCode(code) {
    return flatArtworks.find(w => w.code === code) || null;
}

function findArtworkByTitle(title) {
    return flatArtworks.find(w => w.title === title) || null;
}