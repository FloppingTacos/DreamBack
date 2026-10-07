import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
let active;
class Prop{
 constructor(owner,type,value=0){this.owner=owner;this.type=type;this._value=value;this.keys=[];this._expression='';this.expressionError='';this.canSetExpression=true;this.dimensionsSeparated=false;}
 get value(){if(this.ref)return this.ref.index;return this._expression&&/^[0-9]+$/.test(this._expression)?Number(this._expression):this.valueAtTime(active.time);}
 setValue(v){if(this.type==='layer')this.ref=this.owner.containingComp.layer(v);else this._value=v;}
 get numKeys(){return this.keys.length;}keyTime(i){return this.keys[i-1][0];}keyValue(i){return this.keys[i-1][1];}
 setValueAtTime(t,v){let k=this.keys.find(k=>k[0]===t);if(k)k[1]=v;else{this.keys.push([t,v]);this.keys.sort((a,b)=>a[0]-b[0]);}}
 valueAtTime(t){let v=this._value;for(const [kt,kv]of this.keys)if(kt<=t)v=kv;return v;}
 get expression(){return this._expression;}set expression(s){this._expression=s;}get expressionEnabled(){return !!this._expression;}
 setPropertyParameters(items){this.items=items;}
}
class Effects{
 constructor(owner){this.owner=owner;this.items=[];}get numProperties(){return this.items.length;}
 canAddProperty(){return true;}
 property(n){return typeof n==='number'?this.items[n-1]:this.items.find(x=>x.name===n);}
 addProperty(match){const type=match==='ADBE Layer Control'?'layer':'number';let p=new Prop(this.owner,type);let e={name:match,enabled:true,property:n=>n==='Radius'||n===1?p:null};e.remove=()=>this.items.splice(this.items.indexOf(e),1);this.items.push(e);return e;}
}
class AVLayer{
 constructor(co,source=null){this.containingComp=co;this.source=source||{duration:co.duration};this.name='Source';this.comment='user notes';this.threeDLayer=true;this.nullLayer=false;this.selected=false;this.canSetTimeRemapEnabled=true;this.inPoint=0;this.outPoint=co.duration;this.fx=new Effects(this);this.remap=new Prop(this,'number');this.tr={};
 for(const n of ['ADBE Position','ADBE Anchor Point','ADBE Orientation','ADBE Scale','ADBE Rotate X','ADBE Rotate Y','ADBE Rotate Z','ADBE Opacity'])this.tr[n]=new Prop(this,'number',/Scale/.test(n)?[100,100,100]:/Position|Anchor|Orientation/.test(n)?[0,0,0]:/Opacity/.test(n)?100:0);}
 get index(){return this.containingComp.array.indexOf(this)+1;}
 property(n){return n==='ADBE Effect Parade'?this.fx:n==='ADBE Transform Group'?{property:n=>this.tr[n]}:n==='ADBE Time Remapping'?this.remap:null;}
 duplicate(){let l=new AVLayer(this.containingComp,this.source);l.comment=this.comment;l.parent=this.parent;l.inPoint=this.inPoint;this.containingComp.array.splice(this.index-1,0,l);return l;}
 remove(){this.containingComp.array.splice(this.index-1,1);}
 moveAfter(other){this.remove();this.containingComp.array.splice(other.index,0,this);}
}
class CompItem{
 constructor(){this.array=[];this.duration=10;this.frameDuration=1/30;this.time=0;this.layers={addNull:()=>{let l=new AVLayer(this);l.nullLayer=true;this.array.unshift(l);return l;}};}
 get numLayers(){return this.array.length;}get selectedLayers(){return this.array.filter(x=>x.selected);}layer(i){return this.array[i-1];}
}
const context={AVLayer,CompItem,app:{project:{get activeItem(){return active;}}},console};vm.createContext(context);
for(const f of ['src/core.js','src/schema.js','src/expressions.js','src/rig.jsx'])vm.runInContext(fs.readFileSync(f,'utf8'),context);
const R=context.DBRig;let checks=0;function ok(v,msg){checks++;assert.ok(v,msg);}
active=new CompItem();let s=new AVLayer(active);s.selected=true;active.array.push(s);let unrelated=new AVLayer(active);active.array.push(unrelated);
let c=R.create('Echo',3,1,42);ok(R.copies(c).length===3&&R.count(c)===3,'exact count');
ok(R.source(c)===s&&R.focus(c).parent===c&&s.parent===c,'persistent controller/source/focus links');
ok(s.comment.startsWith('user notes'),'source comments preserved');
let first=R.copies(c)[0];R.effect(c,'Distance').setValueAtTime(0,120);R.effect(c,'Distance').setValueAtTime(2,300);R.update(c,6,42);
ok(R.copies(c).length===6&&R.copies(c)[0]===first,'copies added without replacing survivors');
ok(R.effect(c,'Distance').numKeys===2&&R.effect(c,'Distance').keyValue(2)===300,'control keyframes preserved');
R.update(c,2);ok(R.copies(c).length===2&&active.array.includes(unrelated),'removes owned extras only');
c.name='Renamed controller';s.name='Renamed source';R.select(first);ok(R.resolve()===c&&R.source(c)===s,'renaming and reordering do not break layer control links');
R.preview(c,false);ok(R.copies(c).every(x=>!x.fx.property('DB Lens Blur').enabled),'preview disables actual blur effects');
R.blend(c,73);ok(R.copies(c).every(x=>x.blendingMode===73),'blending all copies');
active.time=3;R.set(c,'Distance',400);ok(R.effect(c,'Distance').numKeys===3&&R.effect(c,'Distance').keyTime(3)===3,'panel edits keyed controls at current time');
active=new CompItem();s=new AVLayer(active);s.selected=true;active.array.push(s);c=R.create('Emit',2,2,42);
ok(R.effect(c,'Playback Mode').value===2&&!R.dirty(c),'exclusive mode and clean schedule');
R.effect(c,'Life').setValueAtTime(0,2);R.effect(c,'Life').setValueAtTime(1,4);ok(R.dirty(c),'Life keyframes mark schedule dirty');R.update(c,2);ok(!R.dirty(c),'schedule update persists new fingerprint');
const expr=R.copies(c)[0].tr['ADBE Position'].expression;ok(expr.includes('particle([0,2,2,4,6,4],time)'),'Life at birth baked into each recycled slot');
R.set(c,'Playback Mode',1);ok(R.effect(c,'Playback Mode').value===1&&R.copies(c).length===2,'mode switch requires no rebuild');
assert.throws(()=>R.update(c,0),/Copies/);checks++;
// Regression: reopen the panel with no in-memory controller, then use the
// three controls reported broken by the user (including the opposite tab).
const windows=[],alerts=[];
class Widget{
 constructor(type,text){this.type=type;this.text=typeof text==='string'?text:'';this.children=[];this.items=Array.isArray(text)?text.map((text,index)=>({text,index})):[];this.graphics={};this.preferredSize={};this.layout={layout(){},resize(){}};this.value=false;}
 add(type,bounds,text){const w=new Widget(type,text);w.parent=this;w.index=this.children.length;this.children.push(w);if(type==='slider')w.value=text;return w;}
 set selection(value){this._selection=typeof value==='number'?(this.items.length?this.items[value]:this.children[value]):value;}get selection(){return this._selection;}
 show(){}find(text){if(this.text===text)return this;for(const c of this.children){const w=c.find(text);if(w)return w;}return null;}
}
context.Panel=class extends Widget{};context.Window=class extends Widget{constructor(){super('window','DreamBack');windows.push(this);}};
context.ScriptUI={newFont(){return {};}};context.BlendingMode={NORMAL:1,ADD:2,SCREEN:3,MULTIPLY:4,OVERLAY:5,SOFT_LIGHT:6,DIFFERENCE:7};
context.app.beginUndoGroup=()=>{};context.app.endUndoGroup=()=>{};context.alert=text=>alerts.push(text);
R.select(R.copies(c)[0]);
vm.runInContext(fs.readFileSync('src/panel.jsx','utf8'),context);
let panel=windows.at(-1);panel.find('Select Controls').onClick();
ok(active.selectedLayers.length===1&&active.selectedLayers[0]===c,'Select Controls auto-loads the selected system after panel reopen');
panel.find('Select Focus').onClick();ok(active.selectedLayers[0]===R.focus(c),'Select Focus selects the actual target');
vm.runInContext(fs.readFileSync('src/panel.jsx','utf8'),context);panel=windows.at(-1);
let checkbox=panel.find('Render generated Fast Camera Lens Blur');checkbox.value=false;checkbox.onClick();
ok(alerts.length===0&&R.copies(c).every(l=>!l.fx.property('DB Lens Blur').enabled),'blur toggle auto-loads selected Focus system without an alert');
for(const layer of active.array)layer.selected=false;
ok(R.resolve()===c,'single-system composition auto-discovery');
c.comment=c.comment.replace(/\n/g,'\r');R.select(c);ok(R.resolve()===c,'AE comment CR line endings preserve system discovery');
const emitter=c;let second=new AVLayer(active);active.array.push(second);R.select(second);const echo=R.create('Echo',1,1,42);
R.select(R.copies(echo)[0]);ok(R.resolve(emitter)===echo,'explicit selection overrides a stale loaded system');
for(const layer of active.array)layer.selected=false;
ok(R.resolve(emitter)===emitter&&R.resolve(null,'Echo')===echo,'cached system and tab-specific unique lookup');
emitter.selected=true;echo.selected=true;assert.throws(()=>R.resolve(emitter),/only one/);checks++;
for(const layer of active.array)layer.selected=false;assert.throws(()=>R.resolve(),/Multiple systems/);checks++;
console.log(`Passed ${checks} AE adapter and panel-event mock checks (not host validation).`);
