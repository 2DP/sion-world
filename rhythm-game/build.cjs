'use strict';
const fs = require('node:fs');
const path = require('node:path');
const files = ['index.html', 'styles.css', 'engine.js', 'charts.js', 'storage.js', 'audio.js', 'game.js', 'lumi.svg', 'cover.svg'];
const destination = path.join(__dirname, 'dist');
fs.mkdirSync(destination, { recursive: true });
for (const file of files) fs.copyFileSync(path.join(__dirname, file), path.join(destination, file));
console.log(`Prepared ${files.length} static files in dist/`);
