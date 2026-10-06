/* DreamBack 0.1 demo. Run with File > Scripts > Run Script File.
   Adds a folder and comps to the existing project; never closes or saves it. */
(function () {
    app.beginUndoGroup("Create DreamBack Demo");
    try {
        if (!app.project) app.newProject();
        var folder = app.project.items.addFolder("DreamBack Demo");
        var W=1920, H=1080, FPS=30, DURATION=8;
        function comp(name) {
            var c=app.project.items.addComp(name,W,H,1,DURATION,FPS);
            c.parentFolder=folder; return c;
        }
        function rect(c,name,size,color,position,strokeOnly) {
            var layer=c.layers.addShape();layer.name=name;
            var contents=layer.property("ADBE Root Vectors Group");
            var group=contents.addProperty("ADBE Vector Group");
            var shapes=group.property("ADBE Vectors Group");
            var path=shapes.addProperty("ADBE Vector Shape - Rect");
            path.property("ADBE Vector Rect Size").setValue(size);
            path.property("ADBE Vector Rect Roundness").setValue(0);
            if(strokeOnly) {
                var stroke=shapes.addProperty("ADBE Vector Graphic - Stroke");
                stroke.property("ADBE Vector Stroke Color").setValue(color);
                stroke.property("ADBE Vector Stroke Width").setValue(12);
            } else {
                var fill=shapes.addProperty("ADBE Vector Graphic - Fill");
                fill.property("ADBE Vector Fill Color").setValue(color);
            }
            layer.property("ADBE Transform Group").property("ADBE Position").setValue(position);
            return layer;
        }
        function source(name,opaque) {
            var c=comp(name);
            if(opaque)c.layers.addSolid([.018,.025,.05],"Opaque background",W,H,1,DURATION);
            rect(c,"Screen frame",[1760,920],[.06,.8,1],[960,540],true);
            rect(c,"Asymmetric top-left marker",[180,90],[1,.18,.08],[260,200],false);
            rect(c,"Marker vertical arm",[60,160],[1,.18,.08],[200,260],false);
            var moving=rect(c,"Moving shape",[140,140],[.3,1,.2],[500,750],false);
            var p=moving.property("ADBE Transform Group").property("ADBE Position");
            p.setValueAtTime(0,[480,750]);p.setValueAtTime(2,[1400,750]);p.setValueAtTime(4,[900,350]);p.setValueAtTime(8,[480,750]);
            var flash=rect(c,"Brief element - disappears at 3 seconds",[260,100],[1,.75,.04],[1200,260],false);
            flash.inPoint=2.5;flash.outPoint=3;
            var text=c.layers.addText("DREAMBACK");text.name="Typography";
            var td=text.property("ADBE Text Properties").property("ADBE Text Document");var value=td.value;
            value.fontSize=100;value.fillColor=[1,1,1];td.setValue(value);
            text.property("ADBE Transform Group").property("ADBE Position").setValue([550,570]);
            return c;
        }
        var opaque=source("DB Source - Opaque",true);
        var transparent=source("DB Source - Transparent",false);
        function main(name,src,mode) {
            var c=comp(name),layer=c.layers.add(src);
            var f=layer.property("ADBE Effect Parade").addProperty("FloppingTacos DreamBack");
            if(!f)throw new Error("DreamBack is not installed. Install the plugin and restart After Effects.");
            f.property(1).setValue(mode);f.property(2).setValue(3);f.property(3).setValue(12);
            f.property(4).setValue(90);f.property(5).setValue(90);f.property(6).setValue([0,0]);
            f.property(7).setValue(0);f.property(8).setValue([960,540]);f.property(9).setValue(100);
            return {comp:c,effect:f};
        }
        var centered=main("01 - Centered tunnel",opaque,1);
        var rotation=main("02 - Rotation gesture",opaque,1);
        var r=rotation.effect.property(7);
        r.setValueAtTime(0,0);r.setValueAtTime(1,0);r.setValueAtTime(1.2,16);r.setValueAtTime(1.4,-12);r.setValueAtTime(1.6,0);r.setValueAtTime(8,0);
        var position=main("03 - Position wave",opaque,1);
        var p=position.effect.property(6);
        p.setValueAtTime(0,[0,0]);p.setValueAtTime(2,[0,0]);p.setValueAtTime(2.2,[100,-35]);p.setValueAtTime(2.4,[-65,30]);p.setValueAtTime(2.6,[0,0]);p.setValueAtTime(8,[0,0]);
        main("04 - Disappearing element history",opaque,1);
        var overlay=main("05 - Transparent overlay",transparent,2);
        overlay.effect.property(4).setValue(70);
        // A background UNDER the processed layer makes trail alpha observable.
        var bg=overlay.comp.layers.addSolid([.05,.015,.1],"Background below transparent feedback",W,H,1,DURATION);bg.moveToEnd();
        centered.comp.time=1;centered.comp.openInViewer();
        alert("DreamBack demo created: 1920x1080, 30 fps.\nPreview comps 01-05. Rotation: 1-1.6s; Position: 2-2.6s; Flash ends at 3s.\nThe existing project has not been saved or closed.");
    } catch(e) {alert("DreamBack demo: "+e.toString());}
    finally {app.endUndoGroup();}
})();
