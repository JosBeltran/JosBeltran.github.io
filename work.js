function getCode(){ return new URLSearchParams(location.search).get('code'); }
async function loadWork(){
  const res = await fetch('artworks.json');
  const data = await res.json();
  const code = getCode();
  const work = data.works.find(w => w.code === code) || data.works[0];
  document.title = `${work.code} | ${work.title}`;
  const page = document.getElementById('workPage');
  page.innerHTML = `
    <div>
      <img class="art-image" src="${work.image}" alt="${work.title}" onerror="this.outerHTML='<div class=\'art-image missing\'>Agrega la imagen en:<br>${work.image}</div>'" />
    </div>
    <section class="work-info">
      <div class="code">${work.code}</div>
      <h1 class="title">${work.title}</h1>
      <div class="meta">
        Año: ${work.year}<br>
        Técnica: ${work.technique}<br>
        Medidas: ${work.size}
      </div>
      <p class="description">${work.description}</p>
    </section>`;
}
loadWork();
