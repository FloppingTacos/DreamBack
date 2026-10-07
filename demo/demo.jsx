(function(){
    app.beginUndoGroup('DreamBack Demo');
    try{
        if(!app.project)app.newProject();
        var folder=app.project.items.addFolder('DreamBack 0.2 Demo');
        var src=app.project.items.addComp('DB Bouncing Ball Source',640,360,1,12,30);src.parentFolder=folder;
        var ball=src.layers.addShape();ball.name='Animated ball on alpha';
        var group=ball.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group');var contents=group.property('ADBE Vectors Group');
        var circle=contents.addProperty('ADBE Vector Shape - Ellipse');circle.property('ADBE Vector Ellipse Size').setValue([90,90]);
        var fill=contents.addProperty('ADBE Vector Graphic - Fill');fill.property('ADBE Vector Fill Color').setValue([0.08,0.8,1]);
        ball.property('ADBE Transform Group').property('ADBE Position').expression='[320+120*Math.sin(time*2),180+90*Math.abs(Math.sin(time*3))]';
        var text=src.layers.addText('DREAMBACK');text.property('ADBE Transform Group').property('ADBE Position').setValue([135,110]);
        var p=text.property('ADBE Text Properties').property('ADBE Text Document'),doc=p.value;doc.fontSize=48;p.setValue(doc);
        var modes=['Echo','Emit','Emit'],labels=['Echo + Focus','Emit - Advancing Frames','Emit - Hold Birth Frame'];
        var last;
        for(var i=0;i<3;i++){
            var co=app.project.items.addComp('DB '+labels[i],1920,1080,1,12,30);co.parentFolder=folder;co.openInViewer();
            var layer=co.layers.add(src);layer.threeDLayer=true;layer.property('ADBE Transform Group').property('ADBE Position').setValue([960,540,0]);DBRig.select(layer);
            var c=DBRig.create(modes[i],8,i===2?2:1,BlendingMode.NORMAL);
            DBRig.effect(c,'Distance').setValue(160);DBRig.effect(c,'Rotation Z Step').setValue(i===0?5:2);
            DBRig.effect(c,'Delay Frames').setValue(i===0?3:2);DBRig.effect(c,'Maximum Blur').setValue(6);
            if(i===0){DBRig.effect(c,'Focus Enabled').setValue(2);DBRig.effect(c,'Focus Shape').setValue(1);DBRig.effect(c,'Focus Range').setValue(400);DBRig.effect(c,'Focus Scale').setValue(25);var f=DBRig.focus(c);f.property('ADBE Transform Group').property('ADBE Position').setValueAtTime(0,[0,0,0]);f.property('ADBE Transform Group').property('ADBE Position').setValueAtTime(6,[0,0,1400]);}
            else{var life=DBRig.effect(c,'Life');life.setValueAtTime(0,2);life.setValueAtTime(4,4);DBRig.effect(c,'Speed').setValue(300);DBRig.effect(c,'End Size').setValue(60);DBRig.update(c,8);}
            co.time=3;last=c;
        }
        DBRig.select(last);alert('DreamBack demo created.\nEcho, advancing Emit and held-frame Emit are ready.\nThe project has not been saved or closed.');
    }catch(e){alert('DreamBack Demo: '+e.toString()+'\nUndo once to remove this demo if creation was incomplete.');}
    finally{app.endUndoGroup();}
}());
