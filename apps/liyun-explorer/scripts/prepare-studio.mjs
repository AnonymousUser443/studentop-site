import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {seedStudioDocument} from '../shared/authoring.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),target=path.join(root,'.author-resources');
fs.mkdirSync(path.join(target,'seed-media'),{recursive:true});
fs.copyFileSync(path.join(root,'public/assets/maps/calibrated/campus_no_labels.webp'),path.join(target,'map.webp'));
const source=JSON.parse(fs.readFileSync(path.join(root,'src/content/regions.json'),'utf8'));
fs.writeFileSync(path.join(target,'seed.json'),JSON.stringify(seedStudioDocument(source)));
for(const point of source.checkInPoints){const photo=path.join(root,'public/assets/landmarks',point.id,'hero.webp');if(fs.existsSync(photo))fs.copyFileSync(photo,path.join(target,'seed-media',point.id+'.webp'));}
console.log('Local studio resources prepared; existing drafts and game files unchanged.');
