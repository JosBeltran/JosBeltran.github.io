# JBU Portfolio

## Cómo administrarlo
1. Edita `artworks.json`.
2. Para cada obra agrega: `code`, `title`, `year`, `technique`, `size`, `image`, `description`.
3. Sube la imagen en `assets/artworks/` usando el mismo nombre, por ejemplo: `JBU-001.jpg`.
4. La página principal genera automáticamente los botones/cuadritos desde el JSON.
5. Cada botón abre `work.html?code=JBU-001`.

## Generar subpáginas físicas opcionales
Ejecuta:

```bash
python tools/generate-pages.py
```

Esto crea archivos dentro de `/obras`, por ejemplo:
`obras/JBU-001.html`.

## Para publicar
Puedes subir toda la carpeta a Netlify, Vercel, Hostinger o GitHub Pages.
