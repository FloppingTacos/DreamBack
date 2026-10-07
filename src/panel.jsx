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
    function action(label,fn){app.beginUndoGroup('DreamBack: '+label);try{fn();message(label+' complete.');return true;}catch(e){message(e.toString());alert('DreamBack\n'+e.toString());return false;}finally{app.endUndoGroup();}}
    function current(mode){try{controller=DBRig.resolve(controller,mode);}catch(e){controller=null;throw e;}if(mode&&DBRig.meta(controller).mode!==mode)throw Error('The selected system is '+DBRig.meta(controller).mode+'. Use Load Selected to switch tabs.');return controller;}
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
            (function(field){function commit(value){if(loading)return;if(!controller){try{current(mode);}catch(noSystem){return;}}action('Set '+field.def[1],function(){var c=current(mode);DBRig.set(c,field.def[1],value);if(field.def[1]==='Life')DBRig.update(c,DBRig.count(c));});hydrate();}
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
        load.onClick=function(){try{controller=DBRig.resolve(controller);hydrate();}catch(e){message(e.toString());}};
        update.onClick=function(){action('Update Copies',function(){controller=DBRig.update(current(mode),Number(count.text),blends[blend.selection.index]);});hydrate();};
        prepare.onClick=function(){action('Prepare Source',function(){DBRig.prepare();});};
        reveal.onClick=function(){try{DBRig.select(current());hydrate();message('Controller selected. Press U to reveal its keyframes.');}catch(e){message(e.toString());alert('DreamBack\n'+e.toString());}};
        target.onClick=function(){try{var f=DBRig.focus(current());if(!f)throw Error('The Focus target was removed. Undo its removal or recreate the system.');DBRig.select(f);hydrate();message('Focus target selected. Move or rotate it in the Composition view.');}catch(e){message(e.toString());alert('DreamBack\n'+e.toString());}};
        preview.onClick=function(){var requested=preview.value;var success=action('Preview Blur',function(){var c=current();DBRig.preview(c,requested);});if(success)hydrate();else preview.value=!requested;};
        blend.onChange=function(){if(loading)return;try{current(mode);}catch(noSystem){return;}action('Set Blending',function(){DBRig.blend(current(mode),blends[blend.selection.index]);});};
        if(timing)timing.onClick=function(){action('Update Emit Timing',function(){DBRig.update(current(mode),DBRig.count(controller));});hydrate();};
        return tab;
    }
    makeTab('Echo');makeTab('Emit');tabs.selection=0;
    w.onResizing=w.onResize=function(){this.layout.resize();};w.layout.layout(true);w.layout.resize();if(w instanceof Window)w.show();
}(this));
