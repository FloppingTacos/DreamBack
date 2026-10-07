import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ctx={console};vm.createContext(ctx);
for(const file of ['src/core.js','src/schema.js','src/expressions.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
const M=ctx.DBCore;let checks=0;
function ok(value,message){checks++;assert.ok(value,message);}
for(const bias of [-100,-30,0,30,100]){
  ok(M.curve(0,bias)===0&&M.curve(1,bias)===1,'curve endpoints');
  let prev=0;for(let i=0;i<=100;i++){let x=M.curve(i/100,bias);assert.ok(x>=prev&&x>=0&&x<=1);prev=x;}checks++;
}
ok(M.curve(.5,30)<.5&&M.curve(.5,-30)>.5,'opposite distribution biases');
ok(M.weight([100,0,0],1,100,100,0)===0,'sphere boundary');
ok(M.weight([80,80,0],1,100,0,0)===0&&M.weight([80,80,0],2,100,0,0)===1,'sphere/cube difference');
ok(M.weight([10000,10000,0],3,100,100,0)===1,'linear band ignores XY');
ok(M.weight([0,0,0],1,0,100,0)===0,'zero range');
ok(M.weight([50,0,0],1,100,100,0)===.5,'feather');
const events=M.schedule(0,1,0,10,t=>t<1?2:4,1/30);
ok(events.join(',')==='0,2,2,4,6,4','Life captured at birth; existing particle retains its Life');
ok(M.particle(events,1.5).life===2&&M.particle(events,2.5).life===4,'Life changes only newborns');
ok(M.particle(events,6).birth===6&&M.particle(events,6).age===0,'slot recycled at new absolute birth');
ok(M.sourceTime(2,6.2,6,0,0)===6,'held frame advances between lifetimes');
ok(M.sourceTime(1,6.2,6,-.4,0)===5.8,'advancing delay uses current global time');
ok(!M.particle(events,-1).alive,'prebirth invisible');
const a=M.particle(events,7);M.particle(events,2);M.particle(events,9);ok(JSON.stringify(a)===JSON.stringify(M.particle(events,7)),'random seek deterministic');
ok(M.schedule(2,4,0,5,()=>2,1/30)[0]===1,'initial emissions staggered evenly');
ok(M.boundary(-1,8,1/30,1)===0&&M.boundary(9,8,1/30,1)<8,'held source endpoints');
ok(M.boundary(-1,8,1/30,2)===7,'source looping handles negative time');
ok(M.fade(.5,2,1,1)===.5&&M.fade(1.5,2,1,1)===.5&&M.fade(2,2,1,1)===0,'age fade');
// Execute the generated expression strings with AE-style property/vector mocks.
const controls={};for(const d of ctx.DBSchema)controls[d[1]]=d[2];
const prop=value=>({value,valueAtTime:()=>value,valueOf:()=>value});
const S={transform:{position:prop([0,0,0]),anchorPoint:prop([0,0,0]),orientation:prop([0,0,0]),scale:prop([100,100,100]),opacity:prop(100),xRotation:0,yRotation:0,zRotation:0},source:{duration:100,frameDuration:1/30},timeRemap:{valueAtTime:t=>t}};
const F={fromWorld:p=>p};const C={effect:n=>()=>n==='DB Source'?S:n==='DB Focus'?F:prop(controls[n]),toWorld:p=>p};
function run(expression,time,extra={}){return vm.runInNewContext(expression,{effect:()=>()=>C,time,thisComp:{frameDuration:1/30},add:(a,b)=>a.map((x,i)=>x+b[i]),mul:(a,b)=>a.map(x=>x*b),Math,...extra});}
const echo=ctx.DBExpressions.all('Echo',2,3,[]);
ok(run(echo.position,1)[2]===360,'last copy receives full span');
ok(run(echo.scale,1).join(',')==='100,100,100','default scale');
controls['Delay Frames']=3;ok(Math.abs(run(echo.time,4)-3.7)<1e-10,'per-copy frame delay');
controls['Delay Direction']=2;ok(Math.abs(run(echo.time,4)-3.9)<1e-10,'reverse delay preserves the same offsets in reversed order');
controls['Maximum Blur']=15;ok(run(echo.blur,1)===15,'last copy gets maximum blur');
controls['Focus Enabled']=2;controls['Focus Range']=1000;controls['Focus Feather']=0;controls['Focus Scale']=5;
ok(run(echo.scale,1).join(',')==='105,105,105','Focus +5 is 5 percent');
controls['Focus X']=40;ok(run(echo.position,1)[0]===40,'Focus modifies base position once');
controls['Focus Enabled']=1;controls['Playback Mode']=2;controls['Delay Frames']=0;
const emit=ctx.DBExpressions.all('Emit',0,1,events);
ok(run(emit.time,6.2)===6&&run(emit.time,7.8)===6,'birth frame remains held within life');
controls['Playback Mode']=1;ok(run(emit.time,7.8)===7.8,'exclusive mode changes without rebuilding');
controls['Fade In']=0;controls['Fade Out']=0;
ok(run(emit.opacity,-1)===0&&run(emit.opacity,3)===100,'emit visibility');
controls['Maximum Blur']=15;controls['DB Near Depth']=120;controls['DB Far Depth']=360;
const camera={fromWorld:p=>p};
ok(run(echo.blur,2,{thisComp:{frameDuration:1/30,activeCamera:camera},thisLayer:{anchorPoint:[0,0,0],toWorld:()=>[0,0,360]}})===15,'camera farthest copy receives maximum blur');
ok(run(echo.blur,2,{thisComp:{frameDuration:1/30,activeCamera:camera},thisLayer:{anchorPoint:[0,0,0],toWorld:()=>[0,0,120]}})===0,'camera nearest copy receives zero base blur');
const depths=[150,420,320];const depthEffect=n=>()=>n==='Copies (built)'?prop(3):{active:true,anchorPoint:[0,0,0],toWorld:()=>[0,0,depths[Number(n.split(' ').pop())-1]]};
ok(vm.runInNewContext(ctx.DBExpressions.depth(false),{effect:depthEffect,thisComp:{activeCamera:camera},Math})===150&&vm.runInNewContext(ctx.DBExpressions.depth(true),{effect:depthEffect,thisComp:{activeCamera:camera},Math})===420,'shared depth bounds scan actual camera positions');
S.source.duration=8;S.timeRemap={numKeys:2,key:i=>i===1?{time:0,value:0}:{time:8,value:8},valueAtTime:t=>Math.max(0,Math.min(8,t))};
controls['Source Boundary']=2;controls['Delay Frames']=0;
ok(run(echo.time,-1)===7,'source clock extrapolates before keys so Loop remains correct');
S.source.duration=100;S.timeRemap={valueAtTime:t=>t};
// Ensure every generated expression is syntactically valid, including axis controls.
for(const mode of ['Echo','Emit'])for(const expression of Object.values(ctx.DBExpressions.all(mode,0,3,events)))new vm.Script(expression);checks++;
for(const file of ['src/rig.jsx','src/panel.jsx'])new vm.Script(fs.readFileSync(file,'utf8'));checks++;
console.log(`Passed ${checks} core, lifecycle, generated-expression and syntax checks.`);
