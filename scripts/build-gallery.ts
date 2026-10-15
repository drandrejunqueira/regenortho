/**
 * Monta a galeria HTML a partir de tests/visual/gallery/manifest.json.
 * Abre em qualquer navegador, sem servidor:
 *
 *   npx tsx scripts/build-gallery.ts && open tests/visual/gallery/index.html
 */
import fs from 'node:fs'
import path from 'node:path'

interface Shot {
  route: string; label: string; area: string; viewport: string
  width: number; height: number; file: string
  overflowPx: number; consoleErrors: string[]
}

const GALLERY = path.join(process.cwd(), 'tests/visual/gallery')
const MANIFEST = path.join(GALLERY, 'manifest.json')

if (!fs.existsSync(MANIFEST)) {
  console.error('❌ manifest.json não existe. Rode `npm run screens` antes.')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as {
  generatedAt: string; scope: string; authenticated: boolean
  viewports: { label: string; width: number; persona: string }[]
  shots: Shot[]
}

const { shots, viewports } = manifest
const areas = [...new Set(shots.map((s) => s.area))]
const routes = [...new Map(shots.map((s) => [s.route, s])).values()]

const withOverflow = shots.filter((s) => s.overflowPx > 1)
const withErrors = shots.filter((s) => s.consoleErrors.length > 0)

const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

const rows = routes.map((r) => {
  const cells = viewports.map((vp) => {
    const shot = shots.find((s) => s.route === r.route && s.viewport === vp.label)
    if (!shot) return `<td class="miss" data-vp="${vp.label}">—</td>`
    const flags: string[] = []
    if (shot.overflowPx > 1) flags.push(`<span class="flag err">overflow ${shot.overflowPx}px</span>`)
    if (shot.consoleErrors.length) flags.push(`<span class="flag warn">${shot.consoleErrors.length} erro(s) console</span>`)
    return `<td data-vp="${vp.label}">
      <a href="${esc(shot.file)}" target="_blank" class="thumb">
        <img loading="lazy" src="${esc(shot.file)}" alt="${esc(r.label)} em ${vp.label}">
      </a>
      <div class="meta">${vp.width}px${flags.join('')}</div>
    </td>`
  }).join('')
  return `<tr data-area="${r.area}" data-route="${esc(r.route)}">
    <th scope="row">
      <div class="rt">${esc(r.label)}</div>
      <code>${esc(r.route)}</code>
      <span class="area area-${r.area}">${r.area}</span>
    </th>${cells}
  </tr>`
}).join('\n')

const html = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RegenOrtho — Galeria de Telas</title>
<style>
  :root{
    --bg:#0e1116; --surface:#161b22; --surface-2:#1c232c; --line:#2a323d;
    --text:#e6edf3; --muted:#8b98a5; --accent:#61d8dd; --err:#ff6b6b; --warn:#e6c364;
    --space:8px;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);
    font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  header{position:sticky;top:0;z-index:10;background:rgba(14,17,22,.92);
    backdrop-filter:blur(12px);border-bottom:1px solid var(--line);padding:24px 32px 16px}
  h1{margin:0 0 4px;font-size:24px;letter-spacing:-.02em}
  .sub{color:var(--muted);font-size:13px;margin-bottom:16px}
  .stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px}
  .stat{background:var(--surface);border:1px solid var(--line);border-radius:8px;
    padding:8px 16px}
  .stat b{display:block;font-size:20px;line-height:1.2}
  .stat.bad b{color:var(--err)} .stat.warn b{color:var(--warn)}
  .stat span{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em}
  .controls{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}
  fieldset{border:0;padding:0;margin:0}
  legend{color:var(--muted);font-size:11px;text-transform:uppercase;
    letter-spacing:.06em;margin-bottom:8px}
  .chips{display:flex;gap:8px;flex-wrap:wrap}
  .chip{background:var(--surface);border:1px solid var(--line);color:var(--text);
    border-radius:999px;padding:6px 16px;font-size:12px;cursor:pointer;
    min-height:32px;transition:background .15s,border-color .15s}
  .chip:hover{background:var(--surface-2)}
  .chip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .chip[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#06212a;font-weight:600}
  main{padding:24px 32px 64px;overflow-x:auto}
  table{border-collapse:separate;border-spacing:8px;width:max-content}
  th[scope="row"]{text-align:left;vertical-align:top;width:240px;position:sticky;left:0;
    background:var(--bg);z-index:2;padding-right:16px}
  .rt{font-weight:600;margin-bottom:4px}
  th code{color:var(--muted);font-size:11px;display:block;margin-bottom:8px}
  .area{font-size:10px;text-transform:uppercase;letter-spacing:.06em;
    padding:2px 8px;border-radius:4px;background:var(--surface-2);color:var(--muted)}
  .area-site{color:#a8d5a2} .area-dashboard{color:var(--accent))}
  .area-configuracoes{color:var(--warn)} .area-portal{color:#c9a8ff} .area-auth{color:#ffb4ab}
  thead th{color:var(--muted);font-size:11px;text-transform:uppercase;
    letter-spacing:.06em;font-weight:600;text-align:left;padding-bottom:8px}
  thead th small{display:block;text-transform:none;letter-spacing:0;
    font-weight:400;font-size:11px;opacity:.7;max-width:200px}
  td{vertical-align:top;width:220px}
  .thumb{display:block;border:1px solid var(--line);border-radius:8px;overflow:hidden;
    background:var(--surface);max-height:320px}
  .thumb:hover{border-color:var(--accent)}
  .thumb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .thumb img{display:block;width:100%;height:auto;vertical-align:top}
  .meta{font-size:11px;color:var(--muted);margin-top:4px;display:flex;
    gap:4px;flex-wrap:wrap;align-items:center}
  .flag{padding:1px 6px;border-radius:4px;font-size:10px;font-weight:600}
  .flag.err{background:rgba(255,107,107,.15);color:var(--err)}
  .flag.warn{background:rgba(230,195,100,.15);color:var(--warn)}
  .miss{color:var(--muted);text-align:center;padding-top:32px}
  tr[hidden],td[hidden]{display:none}
</style></head><body>
<header>
  <h1>RegenOrtho — Galeria de Telas</h1>
  <p class="sub">Capturado em ${new Date(manifest.generatedAt).toLocaleString('pt-BR')} ·
     escopo <b>${manifest.scope}</b> ·
     ${manifest.authenticated ? 'com login' : '<b style="color:var(--warn)">sem login — rotas do dashboard ausentes</b>'}</p>
  <div class="stats">
    <div class="stat"><b>${routes.length}</b><span>rotas</span></div>
    <div class="stat"><b>${viewports.length}</b><span>viewports</span></div>
    <div class="stat"><b>${shots.length}</b><span>capturas</span></div>
    <div class="stat ${withOverflow.length ? 'bad' : ''}"><b>${withOverflow.length}</b><span>overflow horizontal</span></div>
    <div class="stat ${withErrors.length ? 'warn' : ''}"><b>${withErrors.length}</b><span>com erro de console</span></div>
  </div>
  <div class="controls">
    <fieldset><legend>Área</legend><div class="chips" id="areas">
      <button class="chip" aria-pressed="true" data-all>todas</button>
      ${areas.map((a) => `<button class="chip" aria-pressed="true" data-area="${a}">${a}</button>`).join('')}
    </div></fieldset>
    <fieldset><legend>Viewport</legend><div class="chips" id="vps">
      <button class="chip" aria-pressed="true" data-all>todos</button>
      ${viewports.map((v) => `<button class="chip" aria-pressed="true" data-vp="${v.label}">${v.label}</button>`).join('')}
    </div></fieldset>
  </div>
</header>
<main>
<table>
  <thead><tr><th scope="col">Rota</th>
    ${viewports.map((v) => `<th scope="col" data-vp="${v.label}">${v.label}<small>${esc(v.persona)}</small></th>`).join('')}
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</main>
<script>
function wire(containerId, attr, apply){
  const box = document.getElementById(containerId)
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip'); if (!btn) return
    const chips = [...box.querySelectorAll('.chip:not([data-all])')]
    if (btn.hasAttribute('data-all')) {
      const on = btn.getAttribute('aria-pressed') !== 'true'
      btn.setAttribute('aria-pressed', String(on))
      chips.forEach(c => c.setAttribute('aria-pressed', String(on)))
    } else {
      btn.setAttribute('aria-pressed', String(btn.getAttribute('aria-pressed') !== 'true'))
      const allOn = chips.every(c => c.getAttribute('aria-pressed') === 'true')
      box.querySelector('[data-all]').setAttribute('aria-pressed', String(allOn))
    }
    apply(new Set(chips.filter(c => c.getAttribute('aria-pressed') === 'true')
      .map(c => c.dataset[attr])))
  })
}
wire('areas','area', (on) => {
  document.querySelectorAll('tbody tr').forEach(tr => { tr.hidden = !on.has(tr.dataset.area) })
})
wire('vps','vp', (on) => {
  document.querySelectorAll('[data-vp]').forEach(el => { el.hidden = !on.has(el.dataset.vp) })
})
</script>
</body></html>`

fs.writeFileSync(path.join(GALLERY, 'index.html'), html)
console.log(`✅ galeria: tests/visual/gallery/index.html`)
console.log(`   ${routes.length} rotas × ${viewports.length} viewports = ${shots.length} capturas`)
if (withOverflow.length) console.log(`   ⚠️  ${withOverflow.length} com overflow horizontal`)
if (withErrors.length) console.log(`   ⚠️  ${withErrors.length} com erro de console`)
