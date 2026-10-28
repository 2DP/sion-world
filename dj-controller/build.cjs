const fs=require('node:fs'),path=require('node:path');
const root=__dirname,dest=path.join(root,'dist');fs.mkdirSync(dest,{recursive:true});
for(const name of ['index.html','styles.css','icon.svg','app.js','core.js','audio.js','dsp.js','processor.js','analysis.js','music-manifest.json'])fs.copyFileSync(path.join(root,name),path.join(dest,name));
fs.cpSync(path.join(root,'assets'),path.join(dest,'assets'),{recursive:true});
console.log('MIXROOM static build ready: dist/');
