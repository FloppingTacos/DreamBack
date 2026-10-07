#target aftereffects
#targetengine "DreamBackPanel"
/* DreamBack 0.2: ES3-compatible maths, shared by panel, expressions and tests. */
var DBCore = (function () {
    function clamp(x,a,b) { return Math.max(a,Math.min(b,x)); }
    function curve(u,bias) {
        u=clamp(u,0,1);var p=Math.pow(2,Math.abs(clamp(bias,-100,100))/25);
        return bias>=0?Math.pow(u,p):1-Math.pow(1-u,p);
    }
    function weight(p,shape,range,feather,bias) {
        if(range<=0)return 0;
        var d=shape===1?Math.sqrt(p[0]*p[0]+p[1]*p[1]+p[2]*p[2]):shape===2?Math.max(Math.abs(p[0]),Math.abs(p[1]),Math.abs(p[2])):Math.abs(p[2]);
        var inner=range*(1-clamp(feather,0,100)/100);
        if(d>=range)return 0;if(d<=inner)return 1;
        return 1-curve((d-inner)/(range-inner),bias);
    }
    function schedule(slot,count,start,end,lifeAt,minimum) {
        var initial=Number(lifeAt(start));
        if(!isFinite(initial)||initial<=0)throw Error('Life must be positive and finite.');
        var birth=start+slot*Math.max(minimum,initial)/count,events=[];
        while(birth<end) {
            var life=Number(lifeAt(birth));
            if(!isFinite(life)||life<=0)throw Error('Life must be positive and finite.');
            life=Math.max(minimum,life);events.push(birth,life);
            if(events.length>40000)throw Error('Too many emission events. Increase Life or shorten the composition.');
            birth+=life;
        }
        return events;
    }
    function particle(events,time) {
        var n=events.length/2,lo=0,hi=n-1,k=-1;
        while(lo<=hi) {var mid=Math.floor((lo+hi)/2);if(events[mid*2]<=time){k=mid;lo=mid+1;}else hi=mid-1;}
        if(k<0)return {alive:false,birth:0,life:1,age:0,u:0};
        var b=events[k*2],life=events[k*2+1],age=time-b;
        return {alive:age>=0&&age<life,birth:b,life:life,age:age,u:clamp(age/life,0,1)};
    }
    function sourceTime(mode,current,birth,offset,focusOffset) {
        return (mode===1?current:birth)+offset+focusOffset;
    }
    function boundary(time,duration,frameDuration,mode) {
        var last=Math.max(0,duration-frameDuration);
        if(mode===2)return duration>0?((time%duration)+duration)%duration:0;
        return clamp(time,0,last);
    }
    function fade(age,life,fadeIn,fadeOut) {
        if(age<0||age>=life)return 0;
        return clamp(fadeIn>0?age/fadeIn:1,0,1)*clamp(fadeOut>0?(life-age)/fadeOut:1,0,1);
    }
    return {clamp:clamp,curve:curve,weight:weight,schedule:schedule,particle:particle,sourceTime:sourceTime,boundary:boundary,fade:fade};
}());
if(typeof module!=='undefined')module.exports=DBCore;

var DBSchema = [
    ['Stack','Distance',120,0,2000],['Stack','Distance Curve',0,-100,100],
    ['Stack','Direction',1,['Backward (+Z)','Forward (-Z)']],
    ['Stack','X Step',0,-1000,1000],['Stack','Y Step',0,-1000,1000],
    ['Scale & Rotation','Scale Step',0,-50,50],['Scale & Rotation','Scale Curve',0,-100,100],
    ['Scale & Rotation','Rotation X Step',0,-180,180],['Scale & Rotation','Rotation Y Step',0,-180,180],['Scale & Rotation','Rotation Z Step',0,-180,180],['Scale & Rotation','Rotation Curve',0,-100,100],
    ['Opacity & Blur','Opacity Falloff',0,0,100],['Opacity & Blur','Opacity Curve',0,-100,100],
    ['Opacity & Blur','Maximum Blur',0,0,150],['Opacity & Blur','Blur Curve',0,-100,100],
    ['Time','Delay Frames',0,-30,30],['Time','Delay Direction',1,['Front to Back','Back to Front']],['Time','Source Boundary',1,['Hold Ends','Loop','Transparent']],
    ['Emit','Life',2,0.033333333,30],['Emit','Speed',250,-2000,2000],
    ['Emit','Fade In',0.1,0,5],['Emit','Fade Out',0.3,0,5],
    ['Emit','Start Size',100,0,300],['Emit','End Size',100,0,300],
    ['Emit','Playback Mode',1,['Advancing Frames','Hold Birth Frame']],
    ['Focus Shape & Falloff','Focus Enabled',1,['Off','On']],['Focus Shape & Falloff','Focus Shape',1,['Sphere','Cube','Linear Band']],
    ['Focus Shape & Falloff','Focus Range',500,0,3000],['Focus Shape & Falloff','Focus Feather',100,0,100],['Focus Shape & Falloff','Focus Curve',0,-100,100],
    ['Focus Transform','Focus Scale',0,-100,100],['Focus Transform','Focus X',0,-1000,1000],['Focus Transform','Focus Y',0,-1000,1000],['Focus Transform','Focus Z',0,-1000,1000],
    ['Focus Transform','Focus Rotation X',0,-180,180],['Focus Transform','Focus Rotation Y',0,-180,180],['Focus Transform','Focus Rotation Z',0,-180,180],
    ['Focus Time & Blur','Focus Time Frames',0,-120,120],['Focus Time & Blur','Focus Blur',0,-150,150]
];
if(typeof module!=='undefined')module.exports=DBSchema;

var DBExpressions = (function () {
    function text(s) {return '"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';}
    function header(mode,slot,count,events) {
        return '// DreamBack 0.2 '+mode+'\n'+
            'var C=effect("DB Controller")(1);\nvar S=C.effect("DB Source")(1);\nvar F=C.effect("DB Focus")(1);\n'+
            'function v(n){return C.effect(n)(1).value;}\nfunction vb(n,t){return C.effect(n)(1).valueAtTime(t);}\n'+
            'function sourceClock(t){var p=S.timeRemap,n=p.numKeys;if(n>=2){var k=t<p.key(1).time?1:t>p.key(n).time?n-1:0;if(k){var a=p.key(k),b=p.key(k+1);return a.value+(t-a.time)*(b.value-a.value)/(b.time-a.time);}}return p.valueAtTime(t);}\n'+
            'var clamp='+DBCore.clamp.toString()+';\nvar curve='+DBCore.curve.toString()+';\nvar weight='+DBCore.weight.toString()+';\n'+
            'var N='+count+',I='+slot+',emit='+String(mode==='Emit')+';\n'+
            (mode==='Emit'?'var particle='+DBCore.particle.toString()+';\nvar A=particle(['+events.join(',')+'],time);\n':'var A={alive:true,birth:time,life:1,age:0,u:0};\n')+
            'var u=emit?A.u:(I+1)/N;\n'+
            'var sign=v("Direction")===1?1:-1;\n'+
            'var depth=emit?C.effect("Speed")(1).valueAtTime(A.birth)*A.life*curve(u,v("Distance Curve"))*sign:v("Distance")*N*curve(u,v("Distance Curve"))*sign;\n'+
            'var P=add(emit?S.transform.position.valueAtTime(A.birth):S.transform.position.value,[v("X Step")*N*curve(u,v("Distance Curve")),v("Y Step")*N*curve(u,v("Distance Curve")),depth]);\n'+
            'var W=0;if(v("Focus Enabled")===2){var Q=F.fromWorld(C.toWorld(P));W=weight(Q,v("Focus Shape"),v("Focus Range"),v("Focus Feather"),v("Focus Curve"));}\n';
    }
    function all(mode,slot,count,events) {
        var h=header(mode,slot,count,events),p={};
        p.position=h+'add(P,mul([v("Focus X"),v("Focus Y"),v("Focus Z")],W));';
        p.anchor='var S=effect("DB Controller")(1).effect("DB Source")(1);S.transform.anchorPoint;';
        p.orientation=h+'emit?S.transform.orientation.valueAtTime(A.birth):S.transform.orientation.value;';
        p.scale=h+'var factor=emit?(v("Start Size")+(v("End Size")-v("Start Size"))*curve(u,v("Scale Curve")))/100:Math.pow(Math.max(0.001,1+v("Scale Step")/100),N*curve(u,v("Scale Curve")));\nmul(emit?S.transform.scale.valueAtTime(A.birth):S.transform.scale.value,factor*Math.max(0,1+v("Focus Scale")*W/100));';
        var axes=['X','Y','Z'],properties=['xRotation','yRotation','zRotation'];
        for(var a=0;a<3;a++)p['rotation'+axes[a]]=h+'(emit?S.transform.'+properties[a]+'.valueAtTime(A.birth):S.transform.'+properties[a]+'.value)+v("Rotation '+axes[a]+' Step")*N*curve(u,v("Rotation Curve"))+v("Focus Rotation '+axes[a]+'")*W;';
        var sample='var rank=emit?(v("Delay Direction")===1?N*u:N*(1-u)):(v("Delay Direction")===1?I+1:N-1-I);\n'+
            'var sampleClock=time;var offset=-v("Delay Frames")*rank*thisComp.frameDuration+v("Focus Time Frames")*W*thisComp.frameDuration;\n'+
            'if(emit&&v("Playback Mode")===2){sampleClock=A.birth;var birthRank=vb("Delay Direction",A.birth)===1?I+1:N-1-I;var BW=0;if(vb("Focus Enabled",A.birth)===2){var BQ=F.fromWorld(C.toWorld(S.transform.position.valueAtTime(A.birth),A.birth),A.birth);BW=weight(BQ,vb("Focus Shape",A.birth),vb("Focus Range",A.birth),vb("Focus Feather",A.birth),vb("Focus Curve",A.birth));}offset=-vb("Delay Frames",A.birth)*birthRank*thisComp.frameDuration+vb("Focus Time Frames",A.birth)*BW*thisComp.frameDuration;}\n'+
            'var sampleTime=sourceClock(sampleClock+offset);\n';
        p.opacity=h+sample+'var fade='+DBCore.fade.toString()+';\n'+
            'var alpha=S.transform.opacity*(1-clamp(v("Opacity Falloff")/100,0,1)*curve(u,v("Opacity Curve")));\n'+
            'var valid=v("Source Boundary")!==3||(sampleTime>=0&&sampleTime<S.source.duration);\n'+
            'alpha*(emit?(A.alive?1:0)*fade(A.age,A.life,v("Fade In"),v("Fade Out")):1)*(valid?1:0);';
        p.time=h+sample+'var boundary='+DBCore.boundary.toString()+';\n'+
            'boundary(sampleTime,S.source.duration,S.source.frameDuration,v("Source Boundary"));';
        p.blur=h+'var bu=emit?u:(N>1?I/(N-1):1);var cam=thisComp.activeCamera;if(cam){var near=v("DB Near Depth"),far=v("DB Far Depth");var d=cam.fromWorld(thisLayer.toWorld(thisLayer.anchorPoint))[2];bu=far>near?clamp((d-near)/(far-near),0,1):1;}else if(!emit&&sign<0){bu=1-bu;}\nMath.max(0,v("Maximum Blur")*curve(bu,v("Blur Curve"))+v("Focus Blur")*W);';
        return p;
    }
    function depth(far){return '// Shared camera-depth bounds\nvar cam=thisComp.activeCamera;var result='+(far?'-1e20':'1e20')+';var found=false;if(cam){for(var i=1;i<=Math.round(effect("Copies (built)")(1));i++){var l=effect("DB Copy "+i)(1);if(l&&l.active){var d=cam.fromWorld(l.toWorld(l.anchorPoint))[2];result=Math.'+(far?'max':'min')+'(result,d);found=true;}}}found?result:0;';}
    return {all:all,text:text,depth:depth};
}());
if(typeof module!=='undefined')module.exports=DBExpressions;

/* AE integration. Every mutation is initiated by a panel action and undoable. */
var DBRig=(function(){
    var prefix='DB2|',serial=0,blurMatch='TumoiYorozu FastCameraLensBlur';
    function meta(layer){var m=/(?:^|\n)DB2\|([A-Za-z0-9_-]+)\|(source|copy|controller|focus)\|(Echo|Emit)(?:\n|$)/.exec(layer.comment||'');return m?{id:m[1],role:m[2],mode:m[3]}:null;}
    function tag(layer,id,role,mode){var s=(layer.comment||'').replace(/(?:^|\n)DB2\|[^\n]*/g,'');layer.comment=s+'\n'+prefix+id+'|'+role+'|'+mode;}
    function comp(){var c=app.project&&app.project.activeItem;if(!(c instanceof CompItem))throw Error('Open a composition first.');return c;}
    function effect(layer,name){var e=layer.property('ADBE Effect Parade').property(name);if(!e)throw Error('Missing control: '+name);return e.property(1);}
    function add(layer,name,value,choices){var fx=layer.property('ADBE Effect Parade'),n=fx.numProperties+1;fx.addProperty(choices?'ADBE Dropdown Control':'ADBE Slider Control');
        if(choices){fx.property(n).property(1).setPropertyParameters(choices);}var e=fx.property(n);e.name=name;e.property(1).setValue(value);return e.property(1);}
    function addLayerControl(layer,name,target){var fx=layer.property('ADBE Effect Parade');var e=fx.addProperty('ADBE Layer Control');e.name=name;e.property(1).setValue(target.index);}
    function source(c){var index=Math.round(effect(c,'DB Source').value);if(index<1||index>c.containingComp.numLayers)throw Error('Source layer was removed.');return c.containingComp.layer(index);}
    function focus(c){var i=Math.round(effect(c,'DB Focus').value);return i>0?c.containingComp.layer(i):null;}
    function copies(c){var a=[],m=meta(c),co=c.containingComp;for(var i=1;i<=co.numLayers;i++){var l=co.layer(i),t=meta(l);if(t&&t.id===m.id&&t.role==='copy')a.push(l);}a.sort(function(a,b){return effect(a,'DB Slot').value-effect(b,'DB Slot').value;});return a;}
    function resolve(){var co=comp(),selected=co.selectedLayers;if(!selected.length)throw Error('Select the source, controller, focus target, or a generated copy.');var m=meta(selected[0]);if(!m)throw Error('Selected layer is not part of a DreamBack system.');
        for(var i=1;i<=co.numLayers;i++){var l=co.layer(i),t=meta(l);if(t&&t.id===m.id&&t.role==='controller')return l;}throw Error('DreamBack controller was removed.');}
    function set(c,name,value){var p=effect(c,name);if(p.numKeys||p.expressionEnabled)p.setValueAtTime(c.containingComp.time,value);else p.setValue(value);}
    function select(layer){var co=layer.containingComp;for(var i=1;i<=co.numLayers;i++)co.layer(i).selected=false;layer.selected=true;}
    function blurEffect(layer){return layer.property('ADBE Effect Parade').property('DB Lens Blur');}
    function ensureBlur(layer){var e=blurEffect(layer);if(!e){var fx=layer.property('ADBE Effect Parade');if(!fx.canAddProperty(blurMatch))throw Error('Fast Camera Lens Blur is unavailable in this AE session.');e=fx.addProperty(blurMatch);e.name='DB Lens Blur';}return e;}
    function count(c){return Math.round(effect(c,'Copies (built)').value);}
    function applyExpressions(layer,c,slot,n,events){var mode=meta(c).mode,ex=DBExpressions.all(mode,slot,n,events),tr=layer.property('ADBE Transform Group');
        var map=[['ADBE Position','position'],['ADBE Anchor Point','anchor'],['ADBE Orientation','orientation'],['ADBE Scale','scale'],['ADBE Rotate X','rotationX'],['ADBE Rotate Y','rotationY'],['ADBE Rotate Z','rotationZ'],['ADBE Opacity','opacity']];
        if(tr.property('ADBE Position').dimensionsSeparated)tr.property('ADBE Position').dimensionsSeparated=false;
        for(var i=0;i<map.length;i++){var p=tr.property(map[i][0]);p.expression=ex[map[i][1]];if(p.expressionError)throw Error(p.expressionError);}
        layer.timeRemapEnabled=true;layer.property('ADBE Time Remapping').expression=ex.time;
        var blur=ensureBlur(layer),radius=blur.property('Radius');if(!radius)throw Error('Fast Camera Lens Blur Radius parameter was not found.');radius.expression=ex.blur;
        blur.enabled=effect(c,'Preview Blur').value!==0;
    }
    function schedules(c,n){var s=source(c),co=c.containingComp,start=s.inPoint,end=co.duration,life=effect(c,'Life'),result=[],total=0;
        for(var i=0;i<n;i++){result[i]=meta(c).mode==='Emit'?DBCore.schedule(i,n,start,end,function(t){return life.valueAtTime(t,false);},co.frameDuration):[];total+=result[i].length/2;if(result[i].join(',').length>20000)throw Error('This slot has too much timing history. Increase Life or shorten the comp.');}
        if(total>20000)throw Error('More than 20,000 births. Increase Life, shorten the comp, or reduce copies.');return result;}
    function fingerprint(c){var p=effect(c,'Life'),s=source(c),a=[s.inPoint,c.containingComp.duration,count(c),p.numKeys?'keyed':p.value,p.expression];for(var i=1;i<=p.numKeys;i++)a.push(p.keyTime(i),p.keyValue(i));return a.join('|');}
    function storeFingerprint(c){c.comment=(c.comment||'').replace(/\nDBSIG\|[^\n]*/g,'')+'\nDBSIG|'+encodeURIComponent(fingerprint(c));}
    function dirty(c){if(meta(c).mode!=='Emit')return false;var m=/\nDBSIG\|([^\n]*)/.exec(c.comment||'');return !m||m[1]!==encodeURIComponent(fingerprint(c))||effect(c,'Life').expressionEnabled;}
    function update(c,n,blend){n=Math.round(n);if(!isFinite(n)||n<1||n>200)throw Error('Copies must be between 1 and 200.');
        var s=source(c),co=c.containingComp,m=meta(c),events=schedules(c,n),list=copies(c);
        // Validate the source and blur BEFORE removing or adding any layers.
        if(!s.canSetTimeRemapEnabled)throw Error('This source cannot be time-remapped. Precompose it first.');
        if(!s.property('ADBE Effect Parade').canAddProperty(blurMatch))throw Error('Fast Camera Lens Blur is not loaded.');
        while(list.length>n){list.pop().remove();}
        if(!s.timeRemapEnabled){var sourceIn=s.inPoint,sourceOut=s.outPoint;s.timeRemapEnabled=true;s.inPoint=sourceIn;s.outPoint=sourceOut;}
        while(list.length<n){var index=list.length,l=s.duplicate();l.name='DB '+m.mode+' '+m.id+' / '+(index+1);tag(l,m.id,'copy',m.mode);l.parent=c;l.audioEnabled=false;l.shy=true;
            addLayerControl(l,'DB Controller',c);add(l,'DB Slot',index);l.moveAfter(s);list.push(l);}
        var links=c.property('ADBE Effect Parade');for(var r=links.numProperties;r>=1;r--){var match=/^DB Copy (\d+)$/.exec(links.property(r).name);if(match&&Number(match[1])>n)links.property(r).remove();}
        for(var link=0;link<n;link++){var name='DB Copy '+(link+1);var existing=c.property('ADBE Effect Parade').property(name);if(existing)existing.property(1).setValue(list[link].index);else addLayerControl(c,name,list[link]);}
        var built=effect(c,'Copies (built)');built.expression=String(n);effect(c,'DB Near Depth').expression=DBExpressions.depth(false);effect(c,'DB Far Depth').expression=DBExpressions.depth(true);
        for(var i=0;i<list.length;i++){var layer=list[i];layer.outPoint=co.duration;layer.inPoint=m.mode==='Emit'&&events[i].length?events[i][0]:s.inPoint;
            layer.enabled=m.mode!=='Emit'||events[i].length>0;if(blend!==undefined)layer.blendingMode=blend;applyExpressions(layer,c,i,n,events[i]);}
        if(m.mode==='Emit')storeFingerprint(c);return c;
    }
    function create(mode,n,playback,blend,setup){var co=comp(),selected=co.selectedLayers;if(selected.length!==1)throw Error('Select exactly one 3D precomp or footage layer.');var s=selected[0];
        if(!(s instanceof AVLayer)||!s.threeDLayer||s.nullLayer)throw Error('Select a 3D precomp or footage layer.');
        if(meta(s))throw Error('This source already belongs to a system. Use Load Selected System.');
        if(!s.canSetTimeRemapEnabled)throw Error('Use Prepare Selected Source first for text, shapes, or stills.');
        if(!s.property('ADBE Effect Parade').canAddProperty(blurMatch))throw Error('Fast Camera Lens Blur is not loaded in AE.');
        n=Math.round(n);if(!isFinite(n)||n<1||n>200)throw Error('Copies must be between 1 and 200.');
        var id=String(new Date().getTime())+'_'+(++serial),ctrl=co.layers.addNull(co.duration);ctrl.name='DreamBack '+mode+' Controls ['+id+']';ctrl.threeDLayer=true;ctrl.label=9;
        var tr=ctrl.property('ADBE Transform Group');tr.property('ADBE Anchor Point').setValue([0,0,0]);ctrl.parent=s.parent;tr.property('ADBE Position').setValue(s.property('ADBE Transform Group').property('ADBE Position').value);
        tag(ctrl,id,'controller',mode);s.parent=ctrl;tag(s,id,'source',mode);
        addLayerControl(ctrl,'DB Source',s);
        var target=co.layers.addNull(co.duration);target.name='DreamBack Focus ['+id+']';target.threeDLayer=true;target.label=14;target.parent=ctrl;
        target.property('ADBE Transform Group').property('ADBE Anchor Point').setValue([0,0,0]);target.property('ADBE Transform Group').property('ADBE Position').setValue([0,0,300]);tag(target,id,'focus',mode);addLayerControl(ctrl,'DB Focus',target);
        add(ctrl,'Copies (built)',n);add(ctrl,'Preview Blur',1);add(ctrl,'DB Near Depth',0);add(ctrl,'DB Far Depth',0);
        for(var i=0;i<DBSchema.length;i++){var d=DBSchema[i];add(ctrl,d[1],d[2],d[3] instanceof Array?d[3]:null);}
        effect(ctrl,'Playback Mode').setValue(playback||1);
        if(setup)for(var name in setup)if(setup.hasOwnProperty(name))effect(ctrl,name).setValue(setup[name]);
        update(ctrl,n,blend);select(ctrl);return ctrl;
    }
    function prepare(){var co=comp(),a=co.selectedLayers;if(a.length!==1||!(a[0] instanceof AVLayer))throw Error('Select one content layer.');if(meta(a[0]))throw Error('Prepare a source before creating its system.');
        var i=a[0].index,name=a[0].name;co.layers.precompose([i],name+' - DreamBack Source',true);var layer=co.layer(i);layer.threeDLayer=true;select(layer);return layer;}
    function preview(c,on){effect(c,'Preview Blur').setValue(on?1:0);var list=copies(c);for(var i=0;i<list.length;i++){var e=blurEffect(list[i]);if(e)e.enabled=on;}}
    function blend(c,value){var list=copies(c);for(var i=0;i<list.length;i++)list[i].blendingMode=value;}
    return {meta:meta,comp:comp,effect:effect,source:source,focus:focus,copies:copies,count:count,create:create,update:update,resolve:resolve,set:set,select:select,prepare:prepare,preview:preview,blend:blend,dirty:dirty};
}());

(function DreamBackPanel(thisObj){
    var w=(thisObj instanceof Panel)?thisObj:new Window('palette','DreamBack',{x:0,y:0,width:410,height:730},{resizeable:true});
    w.minimumSize=[370,650];w.orientation='column';w.alignChildren=['fill','top'];w.spacing=10;w.margins=16;
    var title=w.add('group');title.alignChildren=['left','center'];var name=title.add('statictext',undefined,'DREAMBACK');try{name.graphics.font=ScriptUI.newFont('Arial','BOLD',20);}catch(fontError){}
    var version=title.add('statictext',undefined,'0.2  /  SPACE + TIME');try{version.graphics.font=ScriptUI.newFont('Arial','REGULAR',10);}catch(fontError){}
    var intro=w.add('statictext',undefined,'Layer systems with depth, timing and spatial influence.');
    var tabs=w.add('tabbedpanel');tabs.alignChildren=['fill','top'];tabs.preferredSize=[375,550];
    var status=w.add('statictext',undefined,'Select a 3D source to begin.',{multiline:true});status.preferredSize.height=40;
    var controller=null,views=[],loading=false;
    var blendKeys=['NORMAL','ADD','SCREEN','MULTIPLY','OVERLAY','SOFT_LIGHT','HARD_LIGHT','DARKEN','LIGHTEN','DARKER_COLOR','LIGHTER_COLOR','COLOR_BURN','CLASSIC_COLOR_BURN','LINEAR_BURN','COLOR_DODGE','CLASSIC_COLOR_DODGE','LINEAR_DODGE','LINEAR_LIGHT','VIVID_LIGHT','PIN_LIGHT','HARD_MIX','DIFFERENCE','CLASSIC_DIFFERENCE','EXCLUSION','SUBTRACT','DIVIDE','HUE','SATURATION','COLOR','LUMINOSITY','DISSOLVE','DANCING_DISSOLVE','STENCIL_ALPHA','STENCIL_LUMA','SILHOUETE_ALPHA','SILHOUETTE_LUMA','ALPHA_ADD','LUMINESCENT_PREMUL'];
    var blendNames=[],blends=[];for(var bk=0;bk<blendKeys.length;bk++)if(BlendingMode[blendKeys[bk]]!==undefined){blendNames.push(blendKeys[bk].replace(/_/g,' ').toLowerCase());blends.push(BlendingMode[blendKeys[bk]]);}
    function message(s){status.text=s;w.layout.layout(true);}
    function action(label,fn){app.beginUndoGroup('DreamBack: '+label);try{fn();message(label+' complete.');}catch(e){message(e.toString());alert('DreamBack\n'+e.toString());}finally{app.endUndoGroup();}}
    function current(mode){if(!controller)throw Error('Create or load a system first.');if(DBRig.meta(controller).mode!==mode)throw Error('Load a '+mode+' system for this tab.');return controller;}
    function hydrate(){if(!controller)return;loading=true;var m=DBRig.meta(controller);tabs.selection=m.mode==='Echo'?0:1;
        for(var t=0;t<views.length;t++){var ui=views[t];ui.count.text=String(DBRig.count(controller));for(var i=0;i<ui.fields.length;i++){var f=ui.fields[i],value=DBRig.effect(controller,f.def[1]).value;if(f.menu)f.input.selection=Math.max(0,Math.round(value)-1);else{f.input.text=String(Math.round(value*1000)/1000);f.slider.value=value;}}
            ui.preview.value=DBRig.effect(controller,'Preview Blur').value!==0;var list=DBRig.copies(controller);if(list.length){for(var b=0;b<blends.length;b++)if(list[0].blendingMode===blends[b])ui.blend.selection=b;}}
        loading=false;message('Loaded '+m.mode+' / '+DBRig.count(controller)+' copies'+(DBRig.dirty(controller)?' — update Emit timing.':'.'));
    }
    function makeTab(mode){var tab=tabs.add('tab',undefined,mode);tab.orientation='column';tab.alignChildren=['fill','top'];tab.margins=12;tab.spacing=10;
        var top=tab.add('group');top.add('statictext',undefined,'COPIES');var count=top.add('edittext',undefined,'10');count.characters=4;var create=top.add('button',undefined,'Create System');
        var tools=tab.add('group');var load=tools.add('button',undefined,'Load Selected');var update=tools.add('button',undefined,'Update Copies');
        var prepare=tab.add('button',undefined,'Prepare Selected Source (Precompose + 3D)');
        var settings=tab.add('panel',undefined,'SYSTEM CONTROLS');settings.orientation='column';settings.alignChildren=['fill','top'];settings.margins=12;
        var groupNames=['Stack','Scale & Rotation','Opacity & Blur','Time'];if(mode==='Emit')groupNames.push('Emit');groupNames.push('Focus Shape & Falloff','Focus Transform','Focus Time & Blur');
        var choose=settings.add('dropdownlist',undefined,groupNames);choose.selection=0;
        var deck=settings.add('group');deck.orientation='stack';deck.alignChildren=['fill','top'];
        var pages=[],fields=[];
        for(var g=0;g<groupNames.length;g++){var pg=deck.add('group');pg.orientation='column';pg.alignChildren=['fill','top'];pg.spacing=6;pages.push(pg);}
        for(var i=0;i<DBSchema.length;i++){var d=DBSchema[i],pageIndex=-1;if(mode==='Emit'&&d[1]==='Distance')continue;for(var j=0;j<groupNames.length;j++)if(groupNames[j]===d[0])pageIndex=j;if(pageIndex<0)continue;
            var row=pages[pageIndex].add('group');row.alignChildren=['left','center'];var label=row.add('statictext',undefined,mode==='Emit'&&d[1]==='Distance Curve'?'Travel Curve':d[1]);label.preferredSize.width=135;
            var f={def:d,menu:d[3] instanceof Array};
            if(f.menu){f.input=row.add('dropdownlist',undefined,d[3]);f.input.selection=d[2]-1;f.input.preferredSize.width=170;}
            else{f.slider=row.add('slider',undefined,d[2],d[3],d[4]);f.slider.preferredSize.width=90;f.input=row.add('edittext',undefined,String(d[2]));f.input.characters=6;}
            fields.push(f);
            (function(field){function commit(value){if(loading||!controller||DBRig.meta(controller).mode!==mode)return;action('Set '+field.def[1],function(){var c=current(mode);DBRig.set(c,field.def[1],value);if(field.def[1]==='Life')DBRig.update(c,DBRig.count(c));});hydrate();}
                if(field.menu)field.input.onChange=function(){if(field.input.selection)commit(field.input.selection.index+1);};
                else{field.slider.onChanging=function(){field.input.text=String(Math.round(field.slider.value*1000)/1000);};field.slider.onChange=function(){commit(field.slider.value);};field.input.onChange=function(){var v=Number(field.input.text);if(!isFinite(v)){message('Enter a number.');return;}field.slider.value=v;commit(v);};}
            }(f));
        }
        function showPage(){for(var i=0;i<pages.length;i++)pages[i].visible=i===choose.selection.index;settings.layout.layout(true);w.layout.layout(true);}choose.onChange=showPage;showPage();
        var blendRow=tab.add('group');blendRow.add('statictext',undefined,'Blending');var blend=blendRow.add('dropdownlist',undefined,blendNames);blend.selection=0;
        var preview=tab.add('checkbox',undefined,'Render generated Fast Camera Lens Blur');preview.value=true;
        var buttons=tab.add('group');var reveal=buttons.add('button',undefined,'Select Controls');var target=buttons.add('button',undefined,'Select Focus');
        var timing=null;if(mode==='Emit')timing=tab.add('button',undefined,'Update Emit Timing / Life Keyframes');
        var hint=tab.add('statictext',undefined,mode==='Emit'?'Life is sampled at birth. Update timing after editing Life keyframes on the null.':'Count is a setup value. Update Copies preserves existing control keyframes.',{multiline:true});hint.preferredSize=[340,36];
        var ui={count:count,fields:fields,blend:blend,preview:preview};views.push(ui);
        create.onClick=function(){action('Create '+mode,function(){var playback=1;for(var i=0;i<fields.length;i++)if(fields[i].def[1]==='Playback Mode')playback=fields[i].input.selection.index+1;
            var setup={};for(var f=0;f<fields.length;f++)setup[fields[f].def[1]]=fields[f].menu?fields[f].input.selection.index+1:Number(fields[f].input.text);controller=DBRig.create(mode,Number(count.text),playback,blends[blend.selection.index],setup);});hydrate();};
        load.onClick=function(){try{controller=DBRig.resolve();hydrate();}catch(e){message(e.toString());}};
        update.onClick=function(){action('Update Copies',function(){controller=DBRig.update(current(mode),Number(count.text),blends[blend.selection.index]);});hydrate();};
        prepare.onClick=function(){action('Prepare Source',function(){DBRig.prepare();});};
        reveal.onClick=function(){try{DBRig.select(current(mode));message('Controller selected. Press U to reveal its keyframes.');}catch(e){message(e.toString());}};
        target.onClick=function(){try{var f=DBRig.focus(current(mode));if(f)DBRig.select(f);message('Focus target selected. Move or rotate it in the Composition view.');}catch(e){message(e.toString());}};
        preview.onClick=function(){action('Preview Blur',function(){DBRig.preview(current(mode),preview.value);});};
        blend.onChange=function(){if(loading||!controller||DBRig.meta(controller).mode!==mode)return;action('Set Blending',function(){DBRig.blend(current(mode),blends[blend.selection.index]);});};
        if(timing)timing.onClick=function(){action('Update Emit Timing',function(){DBRig.update(current(mode),DBRig.count(controller));});hydrate();};
        return tab;
    }
    makeTab('Echo');makeTab('Emit');tabs.selection=0;
    w.onResizing=w.onResize=function(){this.layout.resize();};w.layout.layout(true);w.layout.resize();if(w instanceof Window)w.show();
}(this));
