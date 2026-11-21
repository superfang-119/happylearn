/* North-up harbour radar and Canvas 2D exploration for devices without WebGL. */
(() => {
  'use strict';

  const roads = [-96, -48, 0, 48, 96];
  const limit = 132;
  const shore = 114;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const roadDistance = n => Math.min(...roads.map(axis => Math.abs(n - axis)));
  const validPoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
  const markerList = input => (Array.isArray(input) ? input : [input]).filter(validPoint);

  function path(ctx, points, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i], points[i + 1]);
    ctx.closePath();
    ctx.fill();
  }

  function box(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function disk(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A repeatable street plan, with a plaza at the centre of every block.
  const paint = [
    ['#a16e66', '#ffbf85', '#e69a77'], ['#8e72a0', '#deb3df', '#b196c5'],
    ['#64859b', '#bbd4dd', '#8fb8c7'], ['#678b84', '#b7d9bc', '#8bbda9'],
    ['#a57582', '#f4afab', '#da9199'], ['#a58059', '#f3d295', '#dfb276']
  ];
  const lots = [];
  const edges = [-134, ...roads, 114];
  for (let col = 0; col < edges.length - 1; col++) {
    for (let row = 0; row < edges.length - 1; row++) {
      const x = edges[col] + 9;
      const z = edges[row] + 9;
      const w = edges[col + 1] - edges[col] - 18;
      const h = edges[row + 1] - edges[row] - 18;
      if (w < 12 || h < 12) continue;
      const seed = col * 13 + row * 7;
      const park = (seed % 9 === 3) || (col === 2 && row === 3);
      lots.push({x, z, w, h, park, seed});
    }
  }
  const buildings = lots.flatMap(lot => {
    if (lot.park) return [];
    const {x,z,w,h,seed} = lot;
    // Two or three separate footprints leave passages through each block.
    const half = (w - 5) / 2;
    return [
      {x:x+1, z:z+1, w:half, h:h*.47, seed},
      {x:x+half+4, z:z+1, w:half-1, h:h*.68, seed:seed+1},
      {x:x+2, z:z+h*.62, w:half-1, h:h*.33, seed:seed+2}
    ];
  });

  function palm(ctx, x, z, scale) {
    ctx.save(); ctx.translate(x, z); ctx.scale(scale,scale);
    path(ctx,[0,0,4,2,6,3,4,3,0,1],'#647e6c');
    disk(ctx,.4,.6,.7,'#705d48');
    for (let i=0; i<6; i++) {
      ctx.rotate(Math.PI/3);
      path(ctx,[-.2,0,-.65,-1,-.2,-2.5,.65,-3.4,.37,-1.8,.43,-.65],i%2?'#397f71':'#539d80');
      path(ctx,[-.12,0,-.16,-1.3,.55,-3.15,.28,-1.3],'#92c49a');
    }
    disk(ctx,0,0,.42,'#c2ca80'); ctx.restore();
  }

  function atlas(ctx, detail) {
    box(ctx,-160,-160,320,320,detail?'#78b9bc':'#26515c');
    box(ctx,shore+1,-150,3,300,detail?'#acd7c7':'#589094');
    box(ctx,shore+4,-150,3,300,detail?'#89c3bc':'#3a737c');
    box(ctx,-150,-150,shore+150,300,detail?'#95b7a3':'#324b4a');
    box(ctx,105,-150,9,300,detail?'#dfc59c':'#7a8271');
    box(ctx,112,-150,2,300,detail?'#f0dbc1':'#b0afa0');
    if (detail) {
      for(let i=0;i<95;i++) {
        const x=118 + (i*17)%39, z=(i*47)%299-150;
        box(ctx,x,z,1+i%4,.27,i%3?'#a4d0c7':'#d3dfca');
      }
    }
    for (const axis of roads) {
      const edge = detail?'#c9c7aa':'#697b70', base=detail?'#536572':'#a2b1a5';
      box(ctx,axis-7,-150,14,300,edge); box(ctx,-150,axis-7,264,14,edge);
      box(ctx,axis-5.4,-150,10.8,300,base);box(ctx,-150,axis-5.4,264,10.8,base);
    }
    for (const x of roads) for (const z of roads) box(ctx,x-5.5,z-5.5,11,11,detail?'#536572':'#a2b1a5');
    for (const z of roads) {
      box(ctx,shore,z-3.8,17,8,detail?'#7b826f':'#8d937d');
      box(ctx,shore,z-3.5,16.5,6.9,detail?'#bb997c':'#a5a68e');
      if (detail) {
        for(let x=shore+1;x<130;x+=1.5) box(ctx,x,z-3.3,.12,6.6,'#937b69');
        for(let x=shore+2;x<131;x+=6){box(ctx,x,z-3.9,.8,.9,'#655c54');box(ctx,x,z+2.8,.8,1,'#655c54');}
      }
    }
    for (const lot of lots) {
      const {x,z,w,h,seed,park} = lot;
      box(ctx,x-.8,z-.8,w+1.6,h+1.6,park?(detail?'#77a996':'#426b58'):(detail?'#c3bd9e':'#54695b'));
      if (!detail || !park) continue;
      box(ctx,x+1,z+1,w-2,h-2,'#8bbd98');
      box(ctx,x+w*.43,z,w*.12,h,'#d8cfaa');
      box(ctx,x,z+h*.45,w,h*.11,'#d8cfaa');
      if(seed%2){
        disk(ctx,x+w*.48,z+h*.48,3.7,'#d6c9a5');
        disk(ctx,x+w*.48,z+h*.48,2.8,'#71abb1');
        disk(ctx,x+w*.48,z+h*.48,1.5,'#a8d9cb');
      } else {
        const a=x+w*.56,b=z+h*.11;
        box(ctx,a,b,w*.32,h*.29,'#e9d5af');box(ctx,a+.5,b+.5,w*.32-1,h*.29-1,'#92b3a6');
        box(ctx,a+w*.16,b+.25,.22,h*.29-.5,'#f0dfc1');
      }
      palm(ctx,x+w*.21,z+h*.23,1);palm(ctx,x+w*.73,z+h*.75,.85);
    }
    for(const b of buildings){
      const {x,z,w,h,seed}=b;
      if (!detail){box(ctx,x,z,w,h,'#5c7569');continue;}
      const [side,top,rim]=paint[seed%paint.length];
      path(ctx,[x,z+h,x+w,z+h,x+w,z,x+w+2.6,z+2.4,x+w+2.6,z+h+2.4,x+2.6,z+h+2.4],'#8a9988');
      box(ctx,x,z,w,h,side);
      box(ctx,x,z-.75,w,h,top);
      box(ctx,x+.6,z-.15,w-1.2,h-1.5,rim);
      box(ctx,x+1,z+.35,w-2,h-2.5,top);
      const aw=Math.min(w*.48,4);
      box(ctx,x+w*.34,z+h*.27,aw,1.4,'#a8a69d');
      box(ctx,x+w*.34,z+h*.27-.3,aw,1.25,'#e8dfc5');
      box(ctx,x+w*.34+.3,z+h*.27,aw*.65,.65,'#9faeaa');
      if(seed%4===0){
        const sx=x+1.1,sz=z+h*.49;
        box(ctx,sx+.24,sz+.24,3.8,2.23,'#879799');box(ctx,sx,sz,3.8,2.18,'#577c91');
        box(ctx,sx+1.76,sz,.16,2.18,'#bbd4d4');box(ctx,sx,sz+.95,3.8,.16,'#bbd4d4');
        box(ctx,sx+.24,sz+.22,.7,.16,'#89adb8');
      }else if(seed%4===1){
        disk(ctx,x+w*.72,z+h*.72,.77,'#b2a395');
        disk(ctx,x+w*.68,z+h*.69,.66,'#e8e1c7');disk(ctx,x+w*.68,z+h*.69,.44,'#a1afb0');
      }else if(seed%4===2){
        const sx=x+1.5,sz=z+h*.7;
        box(ctx,sx,sz,2.6,1.4,'#ac9c91');box(ctx,sx,sz-.16,2.4,1.16,'#ded7bd');
        box(ctx,sx+.3,sz+.18,1.2,.25,'#99a49e');
      }
      if(seed%3===0){
        box(ctx,x+.55,z+h-.5,w-1.15,1,'#a67d74');
        for(let t=.55;t<w-1.2;t+=1.55) box(ctx,x+t,z+h-.5,.8,.96,'#f6deb3');
      } else {
        for(let t=1;t<w-.75;t+=2) box(ctx,x+t,z+h-.45,1,.45,'#637577');
      }
    }
    if(!detail) return;
    for(let t=-139;t<114;t+=5){
      if(roadDistance(t)<7) continue;
      for(const a of roads){
        box(ctx,a-.11,t,.22,2,'#d4c79f');
        box(ctx,t,a-.11,2,.22,'#d4c79f');
      }
    }
    for(const x of roads)for(const z of roads){
      for(let d=-3.8;d<4;d+=1.55){
        box(ctx,x+d,z+6.1,.68,1.85,'#c7caba'); box(ctx,x-8,z+d,1.85,.68,'#c7caba');
      }
      disk(ctx,x+6.25,z-6.05,.55,'#afb29f');disk(ctx,x+6.25,z-6.05,.37,'#535f60');
      const bx=x-7.6,bz=z-8.2;
      box(ctx,bx+.3,bz+.35,1.7,.7,'#9d9e85');box(ctx,bx,bz,1.7,.64,'#9c7659');
      box(ctx,bx+.13,bz+.12,1.45,.15,'#c9a67e');
      box(ctx,x+6.65,z+8.3,.4,.9,'#707c7c');disk(ctx,x+6.8,z+8.3,.29,'#d6c595');
      disk(ctx,x+3.28,z+12.2,.55,'#455c66');disk(ctx,x+3.28,z+12.2,.43,'#687b80');
      box(ctx,x+2.98,z+12.14,.5,.10,'#4f626b');
    }
    for(let z=-113;z<108;z+=8){
      if(roadDistance(z)>7)palm(ctx,109,z,1.28);
    }
    for(const {x,z,w,h,seed,park} of lots){
      if(!park){palm(ctx,x+w-.5,z+h-.1,.72);if(seed%2)palm(ctx,x+.5,z+h*.54,.75);}
    }
  }

  function fitCanvas(canvas, fallbackWidth, fallbackHeight, projected = false) {
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width||fallbackWidth));
    const h=Math.max(1,Math.round(rect.height||fallbackHeight));
    const dpr=projected ? Math.min(1,1440/w,960/h) : clamp(window.devicePixelRatio||1,1,2);
    const bw=Math.round(w*dpr), bh=Math.round(h*dpr);
    if(canvas.width!==bw||canvas.height!==bh){canvas.width=bw;canvas.height=bh;}
    return {w,h,dpr};
  }

  function arrow(ctx,x,y,heading,size){
    ctx.save();ctx.translate(x,y);ctx.rotate(heading);ctx.scale(size,size);
    path(ctx,[0,-1.3,.84,.95,0,.54,-.84,.95],'#162b34');
    path(ctx,[0,-.91,.53,.64,0,.35,-.53,.64],'#fff5cd');
    path(ctx,[0,-.62,0,.28,-.35,.48],'#66e2c4');
    ctx.restore();
  }

  function carDot(ctx,x,y) {
    ctx.save();ctx.translate(x,y);
    box(ctx,-4.5,-3.5,9,7,'#263942');box(ctx,-3.5,-2.5,7,5,'#8be2f1');
    box(ctx,-2,-3,4,2,'#c4eff1');box(ctx,-3.5,2,1.6,2,'#263942');box(ctx,1.9,2,1.6,2,'#263942');
    ctx.restore();
  }

  let radarImage;
  function drawRadar(canvas,snapshot,targets=[]) {
    if(!canvas||!snapshot)return;
    const ctx=canvas.getContext('2d'); if(!ctx)return;
    const {w,h,dpr}=fitCanvas(canvas,144,144), size=Math.min(w,h);
    const left=(w-size)/2,top=(h-size)/2;
    if (!radarImage) {
      radarImage=document.createElement('canvas');radarImage.width=radarImage.height=420;
      const base=radarImage.getContext('2d');
      if (!base) {radarImage=null;return;}
      base.scale(420/(limit*2),420/(limit*2));base.translate(limit,limit);
      atlas(base,false);
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    box(ctx,0,0,w,h,'#243c40');
    ctx.drawImage(radarImage,left,top,size,size);
    const sx=x=>left+clamp((x+limit)/(2*limit),.025,.975)*size;
    const sy=z=>top+clamp((z+limit)/(2*limit),.025,.975)*size;
    const markers=markerList(targets), dot=size<135?4.4:5.8;
    if(!snapshot.driving&&Number.isFinite(snapshot.carX)&&Number.isFinite(snapshot.carZ))carDot(ctx,sx(snapshot.carX),sy(snapshot.carZ));
    const font='system-ui, sans-serif';
    ctx.textBaseline='middle';ctx.textAlign='center';
    markers.forEach((m,i)=>{
      const x=sx(m.x),y=sy(m.z),color=m.color||'#ffce65';
      if(m.highlighted){
        ctx.beginPath();ctx.arc(x,y,dot+3.7,0,Math.PI*2);
        ctx.lineWidth=2;ctx.strokeStyle='#ffdf83';ctx.stroke();
      }
      path(ctx,[x,y-dot-2,x+dot+2,y,x,y+dot+2,x-dot-2,y],'#20333d');
      path(ctx,[x,y-dot,x+dot,y,x,y+dot,x-dot,y],color);
      ctx.font='bold '+Math.max(8,dot*1.55)+'px '+font;
      ctx.fillStyle='#18303b';ctx.fillText(String(i+1),x,y+.5);
    });
    if(size>=235){
      const occupied=markers.map(m=>[sx(m.x)-dot,sy(m.z)-dot,dot*2,dot*2]);
      occupied.push([left+2,top+2,17,17]);
      if(validPoint(snapshot))occupied.push([sx(snapshot.x)-6,sy(snapshot.z)-6,12,12]);
      ctx.font='bold 10px '+font;
      markers.forEach(m=>{
        if(!m.label)return;
        const label=String(m.label).replace(/\s*·\s*/g,' ').slice(0,size>=300?16:11);
        const width=ctx.measureText(label).width+7,hgt=14,gap=dot+3,x=sx(m.x),y=sy(m.z);
        const candidates=[[x+gap,y-hgt/2],[x-gap-width,y-hgt/2],[x-width/2,y-hgt-gap],[x-width/2,y+gap]];
        const fits=candidates.map(([a,b])=>[clamp(a,left+1,left+size-width-1),clamp(b,top+1,top+size-hgt-1),width,hgt]);
        const free=fits.find(([a,b,c,d])=>!occupied.some(([e,f,g,h])=>a<e+g&&a+c>e&&b<f+h&&b+d>f));
        if(!free)return;
        const [bx,by]=free;occupied.push(free);
        box(ctx,bx,by,width,hgt,'#183038e8');ctx.fillStyle='#f3eacb';
        ctx.fillText(label,bx+width/2,by+hgt/2+.5);
      });
    }
    if(validPoint(snapshot))arrow(ctx,sx(snapshot.x),sy(snapshot.z),snapshot.heading||0,size<135?5.4:6.4);
    box(ctx,left+3,top+3,15,15,'#183038e6');ctx.font='bold 11px '+font;ctx.fillStyle='#fff4c9';
    ctx.fillText('N',left+10.5,top+11);ctx.textAlign='start';ctx.textBaseline='alphabetic';
  }

  function drawCar(ctx,x,z,heading,color) {
    ctx.save();ctx.translate(x,z);ctx.rotate(heading);
    ctx.fillStyle='rgba(25,46,54,.30)';ctx.beginPath();ctx.ellipse(.35,.45,1.57,2.75,0,0,Math.PI*2);ctx.fill();
    for (const side of [-1,1])for (const axle of [-1.35,1.25])box(ctx,side*1.12-.24,axle-.46,.48,.85,'#263940');
    path(ctx,[-1.1,-1.8,-.78,-2.45,.78,-2.45,1.1,-1.8,1.1,1.91,.8,2.3,-.8,2.3,-1.1,1.91],'#354852');
    path(ctx,[-.96,-1.75,-.71,-2.29,.71,-2.29,.96,-1.75,.96,1.78,.72,2.12,-.72,2.12,-.96,1.78],color);
    path(ctx,[-.79,-.98,-.62,-1.37,.62,-1.37,.8,-.98,.65,-.45,-.65,-.45],'#385b70');
    path(ctx,[-.64,-1.1,-.48,-1.28,.05,-1.28,-.32,-.55,-.65,-.55],'#a8d7d8');
    path(ctx,[-.73,.89,.73,.89,.81,1.38,-.81,1.38],'#486879');
    box(ctx,-.86,-2.01,.5,.24,'#fff2be');box(ctx,.36,-2.01,.5,.24,'#fff2be');
    box(ctx,-.85,1.85,.42,.2,'#f6846e');box(ctx,.43,1.85,.42,.2,'#f6846e');
    ctx.restore();
  }

  function drawPlayer(ctx,x,z,heading,walk){
    ctx.save();ctx.translate(x,z);ctx.rotate(heading);ctx.scale(1.25,1.25);
    ctx.fillStyle='rgba(33,48,55,.35)';ctx.beginPath();ctx.ellipse(.12,.29,.89,1,0,0,Math.PI*2);ctx.fill();
    const k=Math.sin(walk)*.3;
    box(ctx,-.51,.08+k,.44,1,'#353f53');box(ctx,.07,.08-k,.44,1,'#353f53');
    box(ctx,-.69,-.18,1.38,1,'#1d716e');box(ctx,-.8,-.18-k,.28,.58,'#e2ac81');box(ctx,.52,-.18+k,.28,.58,'#e2ac81');
    disk(ctx,0,-.13,.58,'#eab986');disk(ctx,0,-.02,.49,'#634747');
    path(ctx,[-.58,-.38,-.32,-.68,.49,-.62,.69,-.39,.57,-.22,-.65,-.22],'#ffc177');
    ctx.restore();
  }

  function createFallback(container,{onFrame=()=>{},onInteract=()=>{},initialState=null}={}) {
    const canvas=document.createElement('canvas');
    canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none';
    canvas.tabIndex=0;canvas.setAttribute('aria-label','港城街区，方向键或 WASD 移动，E 键互动');
    container.append(canvas);
    const ctx=canvas.getContext('2d');
    if(!ctx){canvas.remove();throw new Error('此浏览器不支持 Canvas 2D。');}
    const atlasEdge=156;
    let layer=null, perspective=null;
    try { perspective=window.CityPerspective?.create(canvas,{buildings,lots,roads,shore,bounds:limit})||null; }
    catch { perspective=null; }
    canvas.style.cursor=perspective?'grab':'crosshair';
    function overheadAtlas(){
      if(layer)return layer;
      layer=document.createElement('canvas');
      const resolution=1792;layer.width=layer.height=resolution;
      const base=layer.getContext('2d');
      base.scale(resolution/(atlasEdge*2),resolution/(atlasEdge*2));
      base.translate(atlasEdge,atlasEdge);atlas(base,true);
      return layer;
    }
    const s={x:1.5,z:2,heading:0,driving:false,speed:0,carX:4,carZ:0};
    const keys=new Set(), keyboard=new Set();
    let carHeading=.14,carColor='#ee9968', paused=false,disposed=false;
    let footSpeedMultiplier=1;
    let targets=[],lastTime=0,frame=0,walk=0,velocity=0,stick=null,cameraX=s.x,cameraZ=s.z;
    let viewScale=8,viewW=1,viewH=1,lastDraw=-Infinity;
    let look=null,orbitYaw=0,orbitPitch=0,recenter=false,releaseTime=0;
    const snapshot=()=>({...s,nearCar:!s.driving&&Math.hypot(s.x-s.carX,s.z-s.carZ)<=3.55});
    function interactVehicle(){
      if(paused||disposed)return false;
      if(s.driving){
        const exits=[[-2.4,0],[2.4,0],[0,3.1],[0,-3.1],[-3.4,0],[3.4,0]];
        const cos=Math.cos(carHeading),sin=Math.sin(carHeading);
        const place=exits.map(([side,along])=>[s.carX+cos*side+sin*along,s.carZ+sin*side-cos*along])
          .find(([x,z])=>!blocked(x,z,.4));
        if(!place)return false;
        s.driving=false;velocity=0;s.speed=0;
        [s.x,s.z]=place;
      }else{
        if(!snapshot().nearCar)return false;
        s.driving=true;s.x=s.carX;s.z=s.carZ;s.heading=carHeading;s.speed=0;velocity=0;
      }
      clearPointer();lastDraw=-Infinity;onFrame(snapshot());return true;
    }
    function blocked(x,z,radius){
      if(Math.abs(x)>limit-.45||Math.abs(z)>limit-.45)return true;
      if(x>shore+1 && roadDistance(z)>3.35)return true;
      const inside=buildings.find(b=>x>b.x-radius&&x<b.x+b.w+radius&&z>b.z-radius&&z<b.z+b.h+radius);
      if(!inside)return false;
      // A contact or parcel can be placed at a doorway by the mission module.
      return !targets.some(m=>m.x>=inside.x-2&&m.x<=inside.x+inside.w+2&&m.z>=inside.z-2&&m.z<=inside.z+inside.h+2);
    }
    // WebGL can lose its context while a contract is running. Carry the player
    // and parked vehicle across if their locations fit this street plan.
    if(initialState&&typeof initialState==='object'){
      const previousCar={x:initialState.carX,z:initialState.carZ};
      const parked=validPoint(previousCar)&&!blocked(previousCar.x,previousCar.z,.88);
      if(parked){s.carX=previousCar.x;s.carZ=previousCar.z;}
      if(Number.isFinite(initialState.carHeading))carHeading=initialState.carHeading;
      const wasDriving=initialState.driving===true;
      const fits=validPoint(initialState)&&!blocked(initialState.x,initialState.z,wasDriving ? .88 : .4);
      if(fits||wasDriving&&parked){
        s.x=fits?initialState.x:s.carX;s.z=fits?initialState.z:s.carZ;
        s.heading=Number.isFinite(initialState.heading)?initialState.heading:0;
        s.driving=wasDriving;
        if(wasDriving){s.carX=s.x;s.carZ=s.z;carHeading=s.heading;}
      }
      if(!s.driving&&Math.hypot(s.x-s.carX,s.z-s.carZ)<1.2){
        const exits=[[2.4,0],[-2.4,0],[0,3],[0,-3]];
        const place=exits.map(([dx,dz])=>[s.carX+dx,s.carZ+dz]).find(([x,z])=>!blocked(x,z,.4));
        if(place)[s.x,s.z]=place;
        else {s.x=1.5;s.z=2;s.carX=4;s.carZ=0;}
      }
      cameraX=s.x;cameraZ=s.z;
    }

    function move(dx,dz){
      const ox=s.x,oz=s.z,r=s.driving ? .88 : .4;
      if(!s.driving&&Math.hypot(s.x+dx-s.carX,s.z+dz-s.carZ)<1.2&&Math.hypot(s.x+dx-s.carX,s.z+dz-s.carZ)<Math.hypot(s.x-s.carX,s.z-s.carZ))return 0;
      if(!blocked(s.x+dx,s.z,r))s.x+=dx;
      if(!blocked(s.x,s.z+dz,r))s.z+=dz;
      return Math.hypot(s.x-ox,s.z-oz);
    }
    function setInput(key,pressed){
      if(paused||disposed)return;
      if(key==='interact'){if(pressed)onInteract();return;}
      if(pressed)keys.add(key);else keys.delete(key);
    }
    const held=key=>keys.has(key)||[...keyboard].some(code=>keymap[code]===key);
    function step(dt){
      const forward=Number(held('forward'))-Number(held('back'));
      const side=Number(held('right'))-Number(held('left'));
      let heading=null,distance=0;
      if(stick){
        const dx=(stick.x-viewW*.5)/viewScale+cameraX-s.x;
        const dz=(stick.y-viewH*.5)/viewScale+cameraZ-s.z;
        distance=Math.hypot(dx,dz);
        if(distance>1)heading=Math.atan2(dx,-dz);
      }
      let moved=0;
      if(s.driving){
        const throttle=stick ? Number(distance>1.5) : forward;
        const desired=throttle*(throttle>0?16:4.3);
        const braking=(throttle*velocity<0)||(!throttle&&held('back')&&held('forward'));
        const delta=(braking?16:throttle>0?8:throttle<0?4.5:2.8)*dt;
        velocity+=clamp(desired-velocity,-delta,delta);
        if(heading!==null){
          const angle=Math.atan2(Math.sin(heading-carHeading),Math.cos(heading-carHeading));
          carHeading+=clamp(angle,-2.8*dt,2.8*dt);
        }else{
          const turnSpeed=Math.min(1,Math.abs(velocity)/2.1)*(1.28-Math.min(Math.abs(velocity),16)*.033);
          carHeading+=side*turnSpeed*dt*Math.sign(velocity);
        }
        s.heading=carHeading;
        moved=move(Math.sin(s.heading)*velocity*dt,-Math.cos(s.heading)*velocity*dt);
        if(moved<Math.abs(velocity)*dt*.2)velocity*=.5;
        s.carX=s.x;s.carZ=s.z;
      }else{
        if(!stick)s.heading+=side*2.25*dt;
        else if(heading!==null)s.heading=heading;
        const speed=(held('sprint')?6.2:3.75)*footSpeedMultiplier;
        const desired=stick ? (distance>1?speed:0) : forward*speed*(forward < 0 ? .7 : 1);
        velocity+=(desired-velocity)*(1-Math.exp(-12*dt));
        if(Math.abs(velocity)<.025)velocity=0;
        const stride=stick?Math.min(velocity*dt,distance):velocity*dt;
        moved=move(Math.sin(s.heading)*stride,-Math.cos(s.heading)*stride);
        walk+=moved*3.1;
      }
      s.speed=dt>0?moved/dt*3.6:0;
    }

    function render(time){
      const {w,h,dpr}=fitCanvas(canvas,container.clientWidth||800,container.clientHeight||500,Boolean(perspective));
      viewW=w;viewH=h;
      if(perspective){
        // Keep controls and collision detection at display frequency, while the
        // software chase camera fits the frame budget of an integrated GPU.
        if(time-lastDraw<39)return;
        lastDraw=time;
        const frameState={...snapshot(),carHeading,carColor,walk,orbitYaw,orbitPitch,viewportWidth:w,viewportHeight:h,dpr};
        try {
          if(perspective.render(frameState,targets,time)!==false)return;
        } catch { /* Recover the current scene without resetting missions. */ }
        perspective.dispose?.();perspective=null;
        clearPointer();canvas.width=canvas.width;
      }
      const scale=clamp(Math.min(w/58,h/45),3.6,11)*(s.driving ? .84 : 1);
      viewScale=scale;
      const cx=w/2,cz=h/2;
      ctx.setTransform(dpr,0,0,dpr,0,0);
      box(ctx,0,0,w,h,'#7ab7b8');
      ctx.save();ctx.translate(cx,cz);ctx.scale(scale,scale);ctx.translate(-cameraX,-cameraZ);
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(overheadAtlas(),-atlasEdge,-atlasEdge,atlasEdge*2,atlasEdge*2);
      const pulse=(Math.sin(time*.004)+1)/2;
      targets.forEach((m,i)=>{
        ctx.lineWidth=.17;ctx.strokeStyle=m.color||'#ffcc69';
        ctx.beginPath();ctx.arc(m.x,m.z,2.2+pulse*.65,0,Math.PI*2);ctx.stroke();
        if(m.highlighted){
          ctx.beginPath();ctx.arc(m.x,m.z,2.95+pulse*.65,0,Math.PI*2);
          ctx.lineWidth=.25;ctx.strokeStyle='#ffdb73';ctx.stroke();
        }
        disk(ctx,m.x,m.z,.88,'#31474de8');
        path(ctx,[m.x,m.z-.76,m.x+.58,m.z,m.x,m.z+.76,m.x-.58,m.z],m.color||'#ffcc69');
      });
      drawCar(ctx,s.carX,s.carZ,carHeading,carColor);
      if(!s.driving)drawPlayer(ctx,s.x,s.z,s.heading,walk);
      ctx.restore();
      // Labels stay upright and readable at any device density.
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 13px system-ui, sans-serif';
      targets.forEach((m,i)=>{
        const x=cx+(m.x-cameraX)*scale,y=cz+(m.z-cameraZ)*scale-20;
        if(x<0||y<0||x>w||y>h)return;
        const name=String(m.label||'目的地');
        const text=(m.highlighted?'★ ':'')+(targets.length>1?String(i+1)+' · ':'')+name;
        const width=ctx.measureText(text).width+12,lx=clamp(x,width/2,w-width/2);
        box(ctx,lx-width/2,y-10,width,20,'#263c47e8');
        box(ctx,lx-width/2,y+8,width,2,m.color||'#ffce65');
        ctx.fillStyle='#fff5d9';ctx.fillText(text,lx,y);
      });
    }

    function loop(time){
      frame=0;if(disposed||paused)return;
      const dt=lastTime?Math.min((time-lastTime)/1000,.045):0;
      lastTime=time;
      if(!paused){
        step(dt);
        if(!look&&(recenter||(s.speed>1&&time-releaseTime>950))){
          const smoothing=Math.exp(-4*dt);
          orbitYaw*=smoothing;orbitPitch*=smoothing;
          if(Math.abs(orbitYaw)+Math.abs(orbitPitch)<.005){orbitYaw=0;orbitPitch=0;recenter=false;}
        }
        const amount=1-Math.exp(-9*dt);
        cameraX+=(s.x-cameraX)*amount;cameraZ+=(s.z-cameraZ)*amount;
        render(time);onFrame(snapshot());
      }
      if(!paused&&!disposed)frame=requestAnimationFrame(loop);
    }
    const keymap={ArrowUp:'forward',KeyW:'forward',ArrowDown:'back',KeyS:'back',ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ShiftLeft:'sprint',ShiftRight:'sprint'};
    function keyEvent(e){
      if(e.type==='keyup'){keyboard.delete(e.code);return;}
      if(paused||disposed||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;
      const target=e.target;
      if(target?.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName))return;
      if(e.code==='KeyE'||(['Enter','NumpadEnter'].includes(e.code)&&!target?.closest?.('button,a,[role=button]'))){
        e.preventDefault();if(!e.repeat)onInteract();return;
      }
      if(keymap[e.code]){e.preventDefault();keyboard.add(e.code);}
    }
    function point(e){
      if(stick&&e.pointerId!==stick.id)return;
      const rect=canvas.getBoundingClientRect();
      stick={x:e.clientX-rect.left,y:e.clientY-rect.top,id:e.pointerId};
    }
    function press(e){
      if(paused||disposed||stick||look||e.button!==0)return;
      canvas.focus({preventScroll:true});canvas.setPointerCapture?.(e.pointerId);
      if(!perspective){point(e);return;}
      look={id:e.pointerId,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,dragged:false};
      recenter=false;canvas.style.cursor='grabbing';
    }
    function drag(e){
      if(!look){if(stick)point(e);return;}
      if(look.id!==e.pointerId)return;
      if(!look.dragged&&Math.hypot(e.clientX-look.startX,e.clientY-look.startY)<5)return;
      const gain=clamp(5.4/viewW,.004,.010);
      const yaw=orbitYaw-(e.clientX-look.x)*gain;
      orbitYaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
      orbitPitch=clamp(orbitPitch+(e.clientY-look.y)*gain*.7,-.31,.67);
      look.x=e.clientX;look.y=e.clientY;look.dragged=true;
    }
    function clearPointer(){
      const id=look?.id??stick?.id;
      look=null;stick=null;
      if(id!=null&&canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
      canvas.style.cursor=perspective?'grab':'crosshair';
    }
    function lift(e){
      if(look?.id!==e.pointerId&&stick?.id!==e.pointerId)return;
      if(look&&e.type==='pointerup'){drag(e);recenter=!look.dragged;}
      releaseTime=lastTime;clearPointer();
    }
    function clear(){keys.clear();keyboard.clear();clearPointer();}
    window.addEventListener('keydown',keyEvent);window.addEventListener('keyup',keyEvent);
    canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointermove',drag);
    canvas.addEventListener('pointerup',lift);canvas.addEventListener('pointercancel',lift);canvas.addEventListener('lostpointercapture',lift);
    canvas.addEventListener('blur',clear);window.addEventListener('blur',clear);
    frame=requestAnimationFrame(loop);
    return {
      setInput,interactVehicle,
      setTarget(point){targets=markerList(point);lastDraw=-Infinity;},
      setTargets(items){targets=markerList(items);lastDraw=-Infinity;},
      setRunningShoes(enabled){footSpeedMultiplier=enabled?1.35:1;},
      setDrivingColor(color){
        if(Number.isInteger(color)&&color>=0&&color<=0xffffff)carColor='#'+color.toString(16).padStart(6,'0');
        else if(typeof color==='string'&&/^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color))carColor=color;
      },
      pause(value){
        if(disposed)return;paused=Boolean(value);clear();lastTime=0;lastDraw=-Infinity;
        if(paused&&frame){cancelAnimationFrame(frame);frame=0;}
        else if(!paused&&!frame)frame=requestAnimationFrame(loop);
      },
      dispose(){
        disposed=true;cancelAnimationFrame(frame);clear();
        window.removeEventListener('blur',clear);window.removeEventListener('keydown',keyEvent);window.removeEventListener('keyup',keyEvent);canvas.remove();perspective?.dispose?.();if(layer)layer.width=layer.height=0;
      }
    };
  }
  window.CityMap={drawRadar,createFallback};
})();
