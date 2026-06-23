import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATA = ROOT / "artworks.json"
TEMPLATE = ROOT / "work.html"
OUT = ROOT / "obras"

OUT.mkdir(exist_ok=True)
works = json.loads(DATA.read_text(encoding="utf-8"))["works"]
base = TEMPLATE.read_text(encoding="utf-8")

for work in works:
    code = work["code"]
    html = base.replace('src="styles.css"', 'src="../styles.css"')
    html = html.replace('href="styles.css"', 'href="../styles.css"')
    html = html.replace('src="work.js"', 'src="../work.js"')
    html = html.replace('href="index.html"', 'href="../index.html"')
    html = html.replace('src="assets/logo.png"', 'src="../assets/logo.png"')
    html = html.replace('</body>', f'<script>history.replaceState(null,"","?code={code}")</script>\n</body>')
    (OUT / f"{code}.html").write_text(html, encoding="utf-8")

print(f"Generated {len(works)} pages in {OUT}")
