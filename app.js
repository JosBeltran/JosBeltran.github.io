async function loadCatalog(){
  const res = await fetch('artworks.json');
  const data = await res.json();
  document.getElementById('logo').src = data.logo || 'assets/logo.png';
  document.getElementById('homePhrase').textContent = data.homePhrase;
  const grid = document.getElementById('codeGrid');
  grid.innerHTML = '';
    data.works.forEach((work, index) => {
    const a = document.createElement('a');
    a.className = 'code-btn';
      a.href = `obras/${work.code}.html`
    a.textContent = work.code;
    a.title = work.title;
        a.style.setProperty('--i', index);
    grid.appendChild(a);
  });
}
loadCatalog();
