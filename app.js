async function loadCatalog() {
    const res = await fetch('artworks.json');
    const data = await res.json();

    document.getElementById('logo').src = data.logo || 'assets/logo.png';
    document.getElementById('homePhrase').textContent = data.homePhrase;

    const mainCatalogContainer = document.getElementById('codeGrid');
    mainCatalogContainer.innerHTML = '';

    const allWorks = [];

    // Recorremos la estructura por series
    data.series.forEach((serie) => {
        // 1. Crear el wrapper de la serie
        const seriesGroup = document.createElement('div');
        seriesGroup.style.marginBottom = '2rem';

        // 2. Insertar el título formateado de la colección
        const title = document.createElement('h3');
        title.className = 'series-title';
        title.textContent = serie.seriesTitle;
        seriesGroup.appendChild(title);

        // 3. Crear la rejilla de botones exclusiva para esta serie
        const subGrid = document.createElement('section');
        subGrid.className = 'code-grid';
        subGrid.setAttribute('aria-label', `Colección ${serie.seriesTitle}`);

        serie.works.forEach((work, index) => {
            allWorks.push(work); // Almacenamos en plano para el carrusel global

            const a = document.createElement('a');
            a.className = 'code-btn';
            a.href = `obras/${work.code}.html`;
            a.title = work.title;
            a.innerHTML = `<span>${work.code}</span>`;
            a.style.setProperty('--i', index);

            subGrid.appendChild(a);
        });

        // Ensamblar la serie en el catálogo principal
        seriesGroup.appendChild(subGrid);
        mainCatalogContainer.appendChild(seriesGroup);
    });

    // Arrancar carrusel unificado de imágenes completas
    startHomeBackground(allWorks);
}

function startHomeBackground(works) {
    const images = works.map(w => w.image).filter(Boolean);
    if (!images.length) return;

    const bgA = document.getElementById('homeBgA');
    const bgB = document.getElementById('homeBgB');
    const titleBar = document.getElementById('artworkTitle');

    let index = 0;
    let showingA = true;

    bgA.src = images[0];
    if (titleBar && works[0]) {
        titleBar.textContent = works[0].title || works[0].code;
    }

    setInterval(() => {
        index = (index + 1) % images.length;

        const currentBg = showingA ? bgA : bgB;
        const nextBg = showingA ? bgB : bgA;

        nextBg.src = images[index];

        const currentWork = works[index];
        if (titleBar && currentWork) {
            titleBar.textContent = currentWork.title || currentWork.code;
        }

        nextBg.classList.add('visible');
        currentBg.classList.remove('visible');

        showingA = !showingA;
    }, 7000);
}

loadCatalog();