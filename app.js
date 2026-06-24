async function loadCatalog() {
    const res = await fetch('artworks.json');
    const data = await res.json();

    document.getElementById('logo').src = data.logo || 'assets/logo.png';
    document.getElementById('homePhrase').textContent = data.homePhrase;

    const grid = document.getElementById('codeGrid');
    grid.innerHTML = '';

    data.works.forEach((work, index) => {
        const a = document.createElement('a');
        a.className = 'code-btn';
        a.href = `obras/${work.code}.html`;
        a.textContent = work.code;
        a.title = work.title;
        a.style.setProperty('--i', index);
        grid.appendChild(a);
    });

    startHomeBackground(data.works);
}

function startHomeBackground(works) {
    const images = works.map(w => w.image).filter(Boolean);

    if (!images.length) return;

    const bgA = document.getElementById('homeBgA');
    const bgB = document.getElementById('homeBgB');
    const focusA = document.getElementById('homeFocusA');
    const focusB = document.getElementById('homeFocusB');

    let index = 0;
    let showingA = true;

    bgA.src = images[0];
    focusA.src = images[0];

    setInterval(() => {
        index = (index + 1) % images.length;

        const currentBg = showingA ? bgA : bgB;
        const nextBg = showingA ? bgB : bgA;

        const currentFocus = showingA ? focusA : focusB;
        const nextFocus = showingA ? focusB : focusA;

        nextBg.src = images[index];
        nextFocus.src = images[index];

        nextBg.classList.add('visible');
        nextFocus.classList.add('visible');

        currentBg.classList.remove('visible');
        currentFocus.classList.remove('visible');

        showingA = !showingA;
    }, 7000);
}

loadCatalog();