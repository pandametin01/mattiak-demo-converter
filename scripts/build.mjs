import fs from 'node:fs/promises';
import {build} from 'esbuild';
await fs.mkdir('dist',{recursive:true});
for(const name of ['index.html','style.css','_headers'])await fs.copyFile('public/'+name,'dist/'+name);
await build({entryPoints:{app:'src/app.mjs',worker:'src/worker.mjs'},outdir:'dist',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,external:['fs','path'],loader:{'.wasm':'file'},logLevel:'info'});
await fs.writeFile('dist/_routes.json',JSON.stringify({version:1,include:['/api/*'],exclude:[]}));
await fs.mkdir('dist/licenses',{recursive:true});
for(const [path,name] of [['cs2parser/LICENSE','cs2parser.txt'],['@foxglove/wasm-bz2/LICENSE','wasm-bz2.txt'],['fflate/LICENSE','fflate.txt']])await fs.copyFile('node_modules/'+path,'dist/licenses/'+name);
