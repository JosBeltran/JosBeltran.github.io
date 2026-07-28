/**
 * ==========================================================================
 * ENGINE: Dynamic Interactive Module for Art Objects (Textile/Timepiece) (JBU)
 * ==========================================================================
 */

const GOOGLE_SHEETS_CSV_URL = `https://docs.google.com/spreadsheets/d/e/2PACX-1vRU6VDnbC00SbibTH3o8zEmOUplzNQKNV-3I99GB8MI9NVBz1J4PUdHahXGqSi_4JBVvFerrpQpwlYw/pub?output=csv`;

let allArtObjects = [];
let groupedByCategory = {
    textile: [],
    timepiece: []
};
let currentCategory = "";
let currentActiveObjectIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
    loadObjectsData();
});

/**
 * Loads and filters items that belong to Art Objects
 */
async function loadObjectsData() {
    try {
        const response = await fetch(GOOGLE_SHEETS_CSV_URL);
        if (!response.ok) throw new Error(`Error: ${response.statusText}`);
        
        const csvText = await response.text();
        const flatItems = parseCSVToFlatArray(csvText);

        // 1. Filter items belonging to Art Objects
        allArtObjects = flatItems.filter(item => {
            const seriesNorm = (item.series || "").toLowerCase();
            const mediumNorm = (item.medium || "").toLowerCase();
            const codeNorm = (item.code || "").toLowerCase();

            return seriesNorm.includes("art objects") || 
                   codeNorm.includes("obj-") || 
                   mediumNorm.includes("textile") || 
                   mediumNorm.includes("timepiece");
        });

        // 2. Group Objects strictly by medium / technique
        groupObjectsByCategory();

        // 3. Listen for Dropdown Change
        setupDropdownListener();

    } catch (error) {
        console.error("Error loading Art Objects:", error);
    }
}

/**
 * Groups objects strictly according to 'medium' column (Textile vs Timepiece)
 */
function groupObjectsByCategory() {
    groupedByCategory = {
        textile: [],
        timepiece: []
    };

    allArtObjects.forEach(item => {
        const mediumNorm = (item.medium || "").toLowerCase();
        const codeNorm = (item.code || "").toLowerCase();

        if (mediumNorm.includes("timepiece") || codeNorm.includes("clck")) {
            groupedByCategory.timepiece.push(item);
        } else if (mediumNorm.includes("textile") || codeNorm.includes("cush")) {
            groupedByCategory.textile.push(item);
        }
    });
}

/**
 * Listens for the <select> element change
 */
function setupDropdownListener() {
    const selectEl = document.getElementById("objectTypeSelect");
    if (!selectEl) return;

    selectEl.addEventListener("change", (e) => {
        if (e.target.value) {
            onCategoryChange(e.target.value);
        } else {
            showIntro();
        }
    });
}

/**
 * Triggered on category change
 */
function onCategoryChange(categoryKey) {
    if (!groupedByCategory[categoryKey] || groupedByCategory[categoryKey].length === 0) {
        alert("No items available in this category yet.");
        return; 
    }

    currentCategory = categoryKey;
    currentActiveObjectIndex = 0;
    
    hideIntro();
    
    const selectEl = document.getElementById("objectTypeSelect");
    if (selectEl && selectEl.value !== categoryKey) {
        selectEl.value = categoryKey;
    }

    renderCategoryObjects();
}

function selectCategoryFromIntro(categoryKey) {
    onCategoryChange(categoryKey);
}

function showIntro() {
    const introStage = document.getElementById("objectsIntroStage");
    const stage = document.getElementById("objectsStage");
    if (introStage) introStage.style.display = "grid";
    if (stage) stage.style.display = "none";
}

function hideIntro() {
    const introStage = document.getElementById("objectsIntroStage");
    const stage = document.getElementById("objectsStage");
    if (introStage) introStage.style.display = "none";
    if (stage) stage.style.display = "flex";
}

/**
 * Renders the carousel and active item for the active category
 */
function renderCategoryObjects() {
    const categoryObjects = groupedByCategory[currentCategory] || [];
    const circularCarousel = document.getElementById("circularCarousel");
    
    if (categoryObjects.length === 0) return;

    if (circularCarousel) {
        circularCarousel.innerHTML = "";
        categoryObjects.forEach((art, index) => {
            const circleBtn = document.createElement("div");
            circleBtn.className = `thumb-circle ${index === currentActiveObjectIndex ? 'active' : ''}`;
            circleBtn.title = art.title;
            circleBtn.innerHTML = `<img src="${art.image}" alt="${art.title}" />`;
            
            circleBtn.addEventListener("click", () => {
                setActiveObject(index);
            });

            circularCarousel.appendChild(circleBtn);
        });
    }

    setActiveObject(currentActiveObjectIndex);
}

/**
 * Updates active image and details
 */
function setActiveObject(index) {
    const categoryObjects = groupedByCategory[currentCategory] || [];
    if (!categoryObjects[index]) return;

    currentActiveObjectIndex = index;
    const activeArt = categoryObjects[index];
    const itemSubpageUrl = `obras/${activeArt.code}.html`;

    const circles = document.querySelectorAll(".thumb-circle");
    circles.forEach((c, idx) => {
        if (idx === index) c.classList.add("active");
        else c.classList.remove("active");
    });

    const mainImg = document.getElementById("mainObjectImg");
    const mainLink = document.getElementById("mainObjectLink");

    if (mainLink) mainLink.href = itemSubpageUrl;

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

    const titleLink = document.getElementById("objectTitleLink");
    if (titleLink) {
        titleLink.textContent = activeArt.title;
        titleLink.href = itemSubpageUrl;
    }

    const metaEl = document.getElementById("objectMeta");
    const priceEl = document.getElementById("objectPrice");
    const ctaWrapper = document.getElementById("objectCtaWrapper");

    const categoryTitle = currentCategory === 'textile' ? 'Premium Cushion Edition' : 'Functional Art Clock';

    if (metaEl) metaEl.textContent = `${activeArt.technique || categoryTitle} — US Shipping Only`;
    if (priceEl) priceEl.textContent = activeArt.price ? `$${activeArt.price} USD` : "Check Pricing";

    if (ctaWrapper) {
        let buyButtonHtml = activeArt.stripeUrl ? 
            `<a href="${activeArt.stripeUrl}" target="_blank" class="btn-buy-object">Buy Now</a>` :
            `<a href="info/soporte.html?code=${activeArt.code}" class="btn-buy-object">Inquire — ${activeArt.code}</a>`;

        const detailsButtonHtml = `<a href="${itemSubpageUrl}" class="btn-details-object">View Details</a>`;

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
            // CORRECCIÓN CLAVE 1: Normalización de barras invertidas '\' a '/' en la ruta de imagen
            let imagePath = row.image || row.imagen || row.foto || row.url || "";
            imagePath = imagePath.replace(/\\/g, '/');

            items.push({
                code: code,
                title: title || "Untitled",
                series: row.seriestitle || row.series || row.serie || "Art Objects",
                year: row.year || row.anio || "",
                medium: row.medium || row.technique || row.tecnica || row.medio || "",
                technique: row.technique || row.medium || "",
                dimensions: row.dimensions || row.size || "",
                image: imagePath,
                description: row.description || row.descripcion || "",
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