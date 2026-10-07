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
