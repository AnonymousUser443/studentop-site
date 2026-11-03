import fs from 'node:fs';
fs.copyFileSync(new URL('../public/assets/fonts/NotoSerifSC-OFL.txt',import.meta.url),new URL('../dist-studio/assets/NotoSerifSC-OFL.txt',import.meta.url));
console.log('Studio font license included.');
