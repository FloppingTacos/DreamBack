import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const shared=['src/core.js','src/schema.js','src/expressions.js','src/rig.jsx'].map(f=>readFileSync(f,'utf8')).join('\n');
const bundles={
 'DreamBack.jsx':'#target aftereffects\n#targetengine "DreamBackPanel"\n'+shared+'\n'+readFileSync('src/panel.jsx','utf8'),
 'DreamBack_Demo.jsx':'#target aftereffects\n'+shared+'\n'+readFileSync('demo/demo.jsx','utf8'),
 'DreamBack_Host_QA.jsx':'#target aftereffects\n'+shared+'\n'+readFileSync('tests/host.jsx','utf8')
};
for(const dir of ['dist','output/panel']){mkdirSync(dir,{recursive:true});for(const [name,body] of Object.entries(bundles))writeFileSync(`${dir}/${name}`,body);}
console.log('Built installable panel, demo and host QA scripts in dist/ and output/panel/.');
