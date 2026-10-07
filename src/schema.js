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
