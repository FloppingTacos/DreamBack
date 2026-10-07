/* Run via File > Scripts > Run Script File. Adds an undoable QA folder;
   never closes, saves, or restarts the existing project. */
(function(){
    app.beginUndoGroup('DreamBack Host QA');var report=[],passed=0;
    function check(condition,why){if(!condition)throw Error(why);report.push('PASS '+why);passed++;}
    function checkExpressions(c,t){c.containingComp.time=t;var layers=DBRig.copies(c);for(var i=0;i<layers.length;i++){
        var l=layers[i],tr=l.property('ADBE Transform Group');var names=['ADBE Position','ADBE Anchor Point','ADBE Scale','ADBE Orientation','ADBE Rotate X','ADBE Rotate Y','ADBE Rotate Z','ADBE Opacity'];
        for(var j=0;j<names.length;j++){var p=tr.property(names[j]);p.valueAtTime(t,false);if(p.expressionError)throw Error(names[j]+': '+p.expressionError);}
        var tm=l.property('ADBE Time Remapping');tm.valueAtTime(t,false);if(tm.expressionError)throw Error(tm.expressionError);
        var radius=l.property('ADBE Effect Parade').property('DB Lens Blur').property('Radius');radius.valueAtTime(t,false);if(radius.expressionError)throw Error(radius.expressionError);
    }}
    try{
        if(!app.project)app.newProject();var folder=app.project.items.addFolder('DreamBack Host QA');var src=app.project.items.addComp('DB QA Source',64,64,1,10,30);src.parentFolder=folder;
        var shape=src.layers.addShape();shape.name='QA graphic';
        for(var m=0;m<2;m++){
            var mode=m?'Emit':'Echo',co=app.project.items.addComp('DB QA '+mode,640,360,1,10,30);co.parentFolder=folder;co.openInViewer();var s=co.layers.add(src);s.threeDLayer=true;DBRig.select(s);
            var c=DBRig.create(mode,3,1,BlendingMode.NORMAL);check(DBRig.copies(c).length===3,mode+' exact count');checkExpressions(c,2);check(true,mode+' expressions at t=2');
            DBRig.effect(c,'Distance').setValueAtTime(0,100);DBRig.effect(c,'Distance').setValueAtTime(4,200);DBRig.update(c,5);check(DBRig.effect(c,'Distance').numKeys===2,mode+' retains keyframes after copy update');
            for(var sh=1;sh<=3;sh++){DBRig.effect(c,'Focus Shape').setValue(sh);DBRig.effect(c,'Focus Enabled').setValue(2);checkExpressions(c,2);}check(true,mode+' sphere/cube/band expressions');
            if(m){var life=DBRig.effect(c,'Life');life.setValueAtTime(0,2);life.setValueAtTime(1,4);DBRig.update(c,5);checkExpressions(c,6.2);check(true,'keyframed Life schedule');
                var layer=DBRig.copies(c)[0],tm=layer.property('ADBE Time Remapping');DBRig.effect(c,'Delay Frames').setValue(0);DBRig.effect(c,'Focus Time Frames').setValue(0);DBRig.effect(c,'Playback Mode').setValue(2);
                check(Math.abs(tm.valueAtTime(6.2,false)-tm.valueAtTime(7,false))<1e-5,'held birth frame');DBRig.effect(c,'Playback Mode').setValue(1);check(tm.valueAtTime(7,false)>tm.valueAtTime(6.2,false),'exclusive advancing mode');}
            checkExpressions(c,8);checkExpressions(c,1);checkExpressions(c,8);check(true,mode+' random seeks without expression errors');
            DBRig.preview(c,false);check(!DBRig.copies(c)[0].property('ADBE Effect Parade').property('DB Lens Blur').enabled,'actual blur bypass');
        }
        report.push('AE '+app.version+' / '+passed+' host checks passed.');
    }catch(e){report.push('FAIL '+e.toString());}
    finally{app.endUndoGroup();alert(report.join('\n'));}
}());
