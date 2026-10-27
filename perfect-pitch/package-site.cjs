/* Prepare a standalone static Site without creating a nested Git repository. */
const fs = require('node:fs');
const path = require('node:path');
const output = process.argv[2];
if (!output || !path.isAbsolute(output)) throw new Error('Provide an absolute output directory.');
if (path.resolve(output).toLowerCase().startsWith(path.resolve(__dirname).toLowerCase() + path.sep)) throw new Error('Use a separate staging directory outside the game source.');
fs.mkdirSync(path.join(output, 'dist', 'assets'), { recursive: true });
fs.mkdirSync(path.join(output, '.openai'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'engine.js', 'rhythm.js', 'game.js']) {
  let content = fs.readFileSync(path.join(__dirname, file), 'utf8');
  if (file === 'index.html') content = content.replace('class="home-link" href="../"', 'class="home-link" href="https://2dp.github.io/sion-world/"');
  fs.writeFileSync(path.join(output, 'dist', file), content);
}
for (const file of ['icon.svg', 'preview.svg']) fs.copyFileSync(path.join(__dirname, 'assets', file), path.join(output, 'dist', 'assets', file));
fs.copyFileSync(path.join(__dirname, '.openai', 'hosting.json'), path.join(output, '.openai', 'hosting.json'));
fs.writeFileSync(path.join(output, 'README.md'), '# 음표 비행\n\nStatic Site export of SION WORLD/perfect-pitch. Source implementation is maintained in the SION WORLD repository.\n');
console.log('Prepared static Site: ' + output);
