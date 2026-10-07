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
