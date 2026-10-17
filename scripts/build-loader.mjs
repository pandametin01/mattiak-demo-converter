import fs from 'node:fs/promises';

const dir = new URL('../output/loader/', import.meta.url);
const runtime = await fs.readFile(new URL('../experimental/runtime.js', import.meta.url), 'utf8');
const protocol = await fs.readFile(new URL('../experimental/import_protocol.js', import.meta.url), 'utf8');
const commit = '\ninstallPlanImporter(Instance, plan=>{PLAN=plan; phase="idle"; index=0; score=0; attempts=0; rehearsal=false; message="Training imported. personal_rehearse to begin";});\n';
const source = runtime.replace('// __PLAN__', 'let PLAN=null;').replace('// __IMPORTER__', protocol + commit);
await fs.mkdir(dir, {recursive:true});
await fs.writeFile(new URL('personal_loader.js', dir), source);
await fs.copyFile(new URL('../experimental/mattiak_personal_loader.cfg', import.meta.url), new URL('mattiak_personal_loader.cfg', dir));
console.log('Generated output/loader. Compile with CS2 Workshop Tools in the isolated mattiak_personal addon.');
