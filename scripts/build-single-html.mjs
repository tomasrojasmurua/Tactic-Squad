// Empaqueta el juego en un solo HTML autocontenido (todos los módulos en línea),
// listo para publicarse como Artefacto o abrirse sin servidor.
// Uso: npm run build  ->  dist/tactic-squad.html
// El worker de audio (src/audio/bakeWorker.js) se incrusta como texto y se carga
// desde un blob; si el navegador lo bloquea, SoundBank ya hornea en el hilo principal.
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
const root = process.argv[2] || '.';
const out = process.argv[3] || 'dist/tactic-squad.html';
fs.mkdirSync(path.dirname(out), { recursive: true });
const patch = { name: 'patch', setup(b) {
  b.onLoad({ filter: /SoundBank\.js$/ }, async (a) => {
    let s = fs.readFileSync(a.path, 'utf8');
    const from = "new Worker(new URL('./bakeWorker.js', import.meta.url), { type: 'module' })";
    if (!s.includes(from)) throw new Error('worker line not found');
    s = s.replace(from, "new Worker(URL.createObjectURL(new Blob([__WORKER_SRC__], { type: 'text/javascript' })))");
    return { contents: s, loader: 'js' };
  });
}};
const w = await esbuild.build({ entryPoints: [path.join(root, 'src/audio/bakeWorker.js')], bundle: true, format: 'iife', write: false, minify: true, define: { __WORKER_SRC__: '""' }, plugins: [patch] });
const workerSrc = w.outputFiles[0].text;
const m = await esbuild.build({ entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'esm', write: false, minify: true, define: { __WORKER_SRC__: JSON.stringify(workerSrc) }, plugins: [patch] });
const js = m.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(root, 'src/ui/styles.css'), 'utf8');
const html = `<title>Tactic Squad</title>
<meta name="theme-color" content="#000000">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow+Semi+Condensed:wght@500;600;700&display=swap">
<style>
:root{color-scheme:dark}
html,body{margin:0;padding:0;background:#000;color:#fff}
${css}
</style>
<div id="app"><canvas id="view" tabindex="0"></canvas><div id="ui"></div></div>
<script type="module">
${js}
</script>`;
fs.writeFileSync(out, html);
console.log('bytes', html.length, 'worker', workerSrc.length);
