/**
 * ==========================================================================
 * ENGINE: Dynamic Interactive Module for Case Devices (JBU)
 * Synchronizes with Google Sheets & organizes cases by iPhone model (Year)
 * ==========================================================================
 */

const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRU6VDnbC00SbibTH3o8zEmOUplzNQKNV-3I99GB8MI9NVBz1J4PUdHahXGqSi_4JBVvFerrpQpwlYw/pub?output=csv`;

let allCaseDevices = [];
let groupedByModel = {}; // Object: { "17 MAX": [item1, item2], "16 PRO": [...] }
let currentModel = "";
let currentActiveCaseIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
    loadCasesData();
});

/**
 * Loads and filters items that belong to Case Devices
 */
async function loadCasesData() {
    try {
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        
        const csvText = await response.text();
        const flatItems = parseCSVToFlatArray(csvText);

        // 1. Filter items belonging to Case Devices
        allCaseDevices = flatItems.filter(item => {
            const seriesNorm = (item.series || "").toLowerCase();
            const codeNorm = (item.code || "").toLowerCase();
            const titleNorm = (item.title || "").toLowerCase();

            return seriesNorm.includes("case") || 
                   codeNorm.includes("case") || 
                   titleNorm.includes("case");
        });

        if (allCaseDevices.length === 0) {
            allCaseDevices = flatItems.filter(item => Boolean(item.year));
        }

        // 2. Group Cases by iPhone Model (Year column)
        groupCasesByModel();

        // 3. Populate Model Selector Dropdown
        populateModelDropdown();

        // 4. Select Default Model (e.g., 17 MAX or first available)
        selectDefaultModel();

    } catch (error) {
        console.error("Error loading Case Devices:", error);
        const stage = document.getElementById("casesStage");
        if (stage) {
            stage.innerHTML = `
                <div style="text-align: center; padding: 40px 0;">
                    <p style="color: #666;">Unable to sync phone case models at this time.</p>
                </div>
            `;
        }
    }
}

/**
 * Groups cases according to the `year` column
 */
function groupCasesByModel() {
    groupedByModel = {};
    allCaseDevices.forEach(item => {
        let modelKey = item.year ? item.year.trim().toUpperCase() : "GENERAL";
        
        if (!groupedByModel[modelKey]) {
            groupedByModel[modelKey] = [];
        }
        groupedByModel[modelKey].push(item);
    });
}

/**
 * Fills the `<select>` element with the available iPhone models
 */
function populateModelDropdown() {
    const selectEl = document.getElementById("deviceModelSelect");
    if (!selectEl) return;

    selectEl.innerHTML = "";
    const models = Object.keys(groupedByModel);

    if (models.length === 0) {
        selectEl.innerHTML = `<option value="">No models available</option>`;
        return;
    }

    models.forEach(model => {
        const option = document.createElement("option");
        option.value = model;
        option.textContent = model.includes("IPHONE") ? model : `iPhone ${model}`;
        selectEl.appendChild(option);
    });

    selectEl.addEventListener("change", (e) => {
        onModelChange(e.target.value);
    });
}

/**
 * Selects '17 MAX' or closest match by default
 */
function selectDefaultModel() {
    const selectEl = document.getElementById("deviceModelSelect");
    const availableModels = Object.keys(groupedByModel);

    if (availableModels.length === 0) return;

    const targetDefault = availableModels.find(m => 
        m.includes("17 MAX") || m.includes("17 PRO MAX") || m.includes("17")
    ) || availableModels[0];

    selectEl.value = targetDefault;
    onModelChange(targetDefault);
}

/**
 * Triggered on model change from dropdown
 */
function onModelChange(modelKey) {
    currentModel = modelKey;
    currentActiveCaseIndex = 0;
    renderModelCases();
}

/**
 * Renders the main display and circular carousel
 */
function renderModelCases() {
    const modelCases = groupedByModel[currentModel] || [];
    const circularCarousel = document.getElementById("circularCarousel");
    
    if (modelCases.length === 0) return;

    // 1. Draw Circular Carousel
    if (circularCarousel) {
        circularCarousel.innerHTML = "";
        modelCases.forEach((art, index) => {
            const circleBtn = document.createElement("div");
            circleBtn.className = `thumb-circle ${index === currentActiveCaseIndex ? 'active' : ''}`;
            circleBtn.title = art.title;
            circleBtn.innerHTML = `<img src="${art.image}" alt="${art.title}" />`;
            
            circleBtn.addEventListener("click", () => {
                setActiveCase(index);
            });

            circularCarousel.appendChild(circleBtn);
        });
    }

    // 2. Render first active item
    setActiveCase(currentActiveCaseIndex);
}

/**
 * Updates active image, title, subpage links, and specs
 */
function setActiveCase(index) {
    const modelCases = groupedByModel[currentModel] || [];
    if (!modelCases[index]) return;

    currentActiveCaseIndex = index;
    const activeArt = modelCases[index];
    const itemSubpageUrl = `obras/${activeArt.code}.html`;

    // 1. Update active states on carousel thumbnails
    const circles = document.querySelectorAll(".thumb-circle");
    circles.forEach((c, idx) => {
        if (idx === index) c.classList.add("active");
        else c.classList.remove("active");
    });

    // 2. Update Image & Link to Subpage
    const mainImg = document.getElementById("mainCaseImg");
    const mainLink = document.getElementById("mainCaseLink");

    if (mainLink) {
        mainLink.href = itemSubpageUrl;
    }

    if (mainImg) {
        mainImg.style.opacity = "0";
        mainImg.style.transform = "scale(0.95)";

        setTimeout(() => {
            mainImg.src = activeArt.image;
            mainImg.alt = activeArt.title;
            mainImg.style.opacity = "1";
            mainImg.style.transform = "scale(1)";
        }, 150);
    }

    // 3. Update Title & Title Link
    const titleEl = document.getElementById("caseTitle");
    const titleLink = document.getElementById("caseTitleLink");
    
    if (titleLink) {
        titleLink.textContent = activeArt.title;
        titleLink.href = itemSubpageUrl;
    } else if (titleEl) {
        titleEl.innerHTML = `<a href="${itemSubpageUrl}" style="color: inherit; text-decoration: none;">${activeArt.title}</a>`;
    }

    // 4. Update Specs & Pricing
    const metaEl = document.getElementById("caseMeta");
    const priceEl = document.getElementById("casePrice");
    const ctaWrapper = document.getElementById("caseCtaWrapper");

    if (metaEl) metaEl.textContent = `${activeArt.technique || activeArt.medium || 'Premium Tough Case'} — iPhone ${currentModel}`;
    if (priceEl) priceEl.textContent = activeArt.originalPrice || activeArt.price ? `$${activeArt.price} USD` : "Check Pricing";

    // 5. Update Action Buttons (Buy Now + View Details)
    if (ctaWrapper) {
        let buyButtonHtml = "";

        if (activeArt.stripeUrl && activeArt.stripeUrl.trim() !== "") {
            buyButtonHtml = `
                <a href="${activeArt.stripeUrl}" target="_blank" class="btn-buy-case">
                    Buy Now
                </a>`;
        } else {
            buyButtonHtml = `
                <a href="info/soporte.html?code=${activeArt.code}" class="btn-buy-case">
                    Inquire — ${activeArt.code}
                </a>`;
        }

        const detailsButtonHtml = `
            <a href="${itemSubpageUrl}" class="btn-details-case">
                View Details
            </a>`;

        ctaWrapper.innerHTML = buyButtonHtml + detailsButtonHtml;
    }
}

// ==========================================================================
// CSV PARSER
// ==========================================================================
function parseCSVToFlatArray(csvText) {
    if (!csvText) return [];
    const lines = csvText.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = parseCSVLine(lines[0]).map(h => 
        h.trim().toLowerCase().replace(/['"]/g, '').replace(/\s+/g, '')
    );
    
    const items = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = parseCSVLine(line);
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] !== undefined ? values[index].trim() : "";
        });

        const code = row.code || row.codigo || row.id || "";
        const title = row.title || row.titulo || row.obra || row.nombre || "";

        if (code || title) {
            const availableVal = String(row.isavailable || row.disponible || row.estatus || "").toUpperCase();
            const isAvailable = availableVal !== "FALSE" && availableVal !== "VENDIDO" && availableVal !== "SOLD";
            const seriesName = row.seriestitle || row.series || row.serie || row.serietitulo || "General";

            items.push({
                code: code,
                title: title || "Untitled",
                series: seriesName,
                year: row.year || row.anio || row.año || "",
                medium: row.medium || row.technique || row.tecnica || row.medio || "",
                technique: row.technique || row.medium || row.tecnica || row.medio || "",
                dimensions: row.dimensions || row.size || row.medidas || row.dimensiones || "",
                image: row.image || row.imagen || row.foto || row.url || "",
                description: row.description || row.descripcion || "",
                isAvailable: isAvailable,
                originalPrice: row.originalprice || row.precio || row.price || "",
                price: row.price || row.originalprice || row.precio || "0",
                stripeUrl: row.stripeurl || row.stripe || row.link || ""
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