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
        var sample='var rank=emit?(v("Delay Direction")===1?N*u:N*(1-u)):(v("Delay Direction")===1?I+1:N-I);\n'+
            'var sampleClock=time;var offset=-v("Delay Frames")*rank*thisComp.frameDuration+v("Focus Time Frames")*W*thisComp.frameDuration;\n'+
            'if(emit&&v("Playback Mode")===2){sampleClock=A.birth;var birthRank=vb("Delay Direction",A.birth)===1?I+1:N-I;var BW=0;if(vb("Focus Enabled",A.birth)===2){var BQ=F.fromWorld(C.toWorld(S.transform.position.valueAtTime(A.birth),A.birth),A.birth);BW=weight(BQ,vb("Focus Shape",A.birth),vb("Focus Range",A.birth),vb("Focus Feather",A.birth),vb("Focus Curve",A.birth));}offset=-vb("Delay Frames",A.birth)*birthRank*thisComp.frameDuration+vb("Focus Time Frames",A.birth)*BW*thisComp.frameDuration;}\n'+
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
