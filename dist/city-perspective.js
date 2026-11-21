/* A perspective street renderer for browsers that provide Canvas but no WebGL. */
(() => {
  'use strict';
  const TAU=2*Math.PI, axes=[-96,-48,0,48,96], near=.38;
  const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pastel=[
    ['#dfaaa8','#f5cfbb','#a76e7b'],['#96c6bc','#cfdfc5','#5d9d9b'],
    ['#dcbb91','#ffe0ac','#ab917c'],['#afa9ca','#dbcbdb','#867da8'],
    ['#d6a38c','#ffe0b8','#ac806f'],['#a2c2c9','#e0d9cb','#7296a5'],
    ['#d8a9b7','#f8d3cd','#ae819e'],['#cbd1ab','#f0e2bd','#92a68b']
  ];
  const shopNames=['CORAL CLUB','SUNSET','RADIO 88','PALM HOTEL','海风书局','OCEANIC','CAFÉ SOL','TIDE MAPS','滨海剧场','MIRAGE','SEA SALT','海湾唱片','MUSEUM'];
  const shortNames=['CORAL','SUNSET','RADIO','PALM','BOOKS','OCEAN','CAFE','TIDE','CINEMA','MIRAGE','SALTS','VINYL','ARTS'];
  const glass=['#517d8a','#668e9a','#658994','#577d8d','#7da2a6'];
  const hash=v=>{const f=Math.sin(v*127.1+311.7)*43758.5453;return f-Math.floor(f);};
  const shadow='#596b77';
  function create(canvas, plan={}) {
    if(Array.isArray(plan))plan={buildings:plan};
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Canvas 2D unavailable');
    const tex=new Map(), fixed=[],land=[], roads=plan.roads||axes, shore=plan.shore||114;
    const lots=plan.lots||[];
    let w=1,h=1,f=1,horizon=1,cx=0,cy=0,cz=0,cs=1,sn=0,edge=1,time=0,dead=false,shadowInk=shadow;
    const cam=(x,y,z)=>[(x-cx)*cs+(z-cz)*sn,y-cy,(x-cx)*sn-(z-cz)*cs];
    const proj=p=>[w/2+p[0]*f/p[2],horizon-p[1]*f/p[2]];
    function clipFront(src){
      let out=[],a=src[src.length-1];
      for(const b of src){
        if((a[2]<near)!==(b[2]<near)){
          const t=(near-a[2])/(b[2]-a[2]);
          out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),near]);
        }
        if(b[2]>=near)out.push(b);a=b;
      } return out;
    }
    function paintPoly(points,ink){
      if(points.length<3)return;
      ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
      for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();
      ctx.fillStyle=ink;ctx.fill();
    }
    function poly(points,ink){
      let v=points.map(p=>cam(...p));
      if(v.every(p=>p[2]<near)||v.every(p=>p[0]>p[2]*edge)||v.every(p=>p[0]<-p[2]*edge))return;
      if(v.some(p=>p[2]<near))v=clipFront(v);
      paintPoly(v.map(proj),ink);
    }
    function flat(x,z,ww,dd,ink,y=.02){const x1=x+ww,z1=z+dd;poly([[x,y,z],[x1,y,z],[x1,y,z1],[x,y,z1]],ink);}
    function dist(x,z){return (x-cx)*sn-(z-cz)*cs;}
    function visible(x,z,r,far=144){const a=cam(x,0,z);return a[2]>-r&&a[2]<far+r&&Math.abs(a[0])<Math.max(1,a[2])*edge+r*(1+edge);}
    function floorRect(x,z,ww,dd,ink,y=.02){land.push([x,z,ww,dd,ink,y]);}
    function oval(x,z,rx,rz,ink,yy=.07){
      const arr=[];for(let j=0;j<14;j++){const a=j*TAU/14;arr.push([x+rx*Math.cos(a),yy,z+rz*Math.sin(a)]);}poly(arr,ink);
    }
    function line(p,q,color,size){
      let a=cam(...p),b=cam(...q);if(a[2]<near&&b[2]<near)return;
      if(a[2]<near||b[2]<near){const t=(near-a[2])/(b[2]-a[2]),cut=a.map((v,i)=>v+(b[i]-v)*t);if(a[2]<near)a=cut;else b=cut;}
      const from=proj(a),to=proj(b);
      ctx.strokeStyle=color;ctx.lineWidth=Math.max(.48,Math.min(30,size*f/((a[2]+b[2])*.5)));
      ctx.beginPath();ctx.moveTo(...from);ctx.lineTo(...to);ctx.stroke();
    }
    function block(x,y,z,ww,hh,dd,colors){
      const x0=x-ww/2,x1=x+ww/2,z0=z-dd/2,z1=z+dd/2,hi=y+hh;
      if(cx<x0)poly([[x0,y,z0],[x0,y,z1],[x0,hi,z1],[x0,hi,z0]],colors[2]||colors[0]);
      if(cx>x1)poly([[x1,y,z1],[x1,y,z0],[x1,hi,z0],[x1,hi,z1]],colors[1]||colors[0]);
      if(cz<z0)poly([[x1,y,z0],[x0,y,z0],[x0,hi,z0],[x1,hi,z0]],colors[1]||colors[0]);
      if(cz>z1)poly([[x0,y,z1],[x1,y,z1],[x1,hi,z1],[x0,hi,z1]],colors[0]);
      if(cy>hi)poly([[x0,hi,z0],[x1,hi,z0],[x1,hi,z1],[x0,hi,z1]],colors[3]||colors[0]);
    }

    function facade(seed,story,side){
      const key=seed%35+':'+story+':'+side;
      if(tex.has(key))return tex.get(key);
      const img=canvas.ownerDocument.createElement('canvas'),pw=264,ph=72+story*37;
      img.width=pw;img.height=ph;
      const c=img.getContext('2d'), [body,cream,accent]=pastel[seed%pastel.length],style=seed%4;
      const rect=(x,y,aw,ah,col)=>{c.fillStyle=col;c.fillRect(x,y,aw,ah);};
      rect(0,0,pw,ph,body);rect(0,0,pw,4,cream);rect(0,4,pw,2,accent);rect(0,8,pw,1,cream);
      const cols=4+seed%3,unit=(pw-18)/cols;
      for(let j=0;j<story;j++){
        const y=13+j*37,windowH=21;
        if(style===1||style===3){rect(4,y-2,pw-8,25,accent);rect(0,y+23,pw,3,cream);}
        for(let i=0;i<cols;i++){
          const x=10+i*unit, wid=unit*(style===2?.55:.82);
          rect(x-1,y-1,wid+2,windowH+2,accent);rect(x,y,wid,windowH,glass[(i+seed+j)%glass.length]);
          rect(x,y,wid,2,'#bdd0c1');rect(x+wid*.45,y+1,1.8,windowH,cream);
          rect(x+wid-2,y+4,1.2,windowH-5,'#a3bbb4');
          if((i+seed+j)%4===1){rect(x+1,y+1,wid*.32,windowH-2,'#d1bb9e');rect(x+wid*.68,y+1,wid*.32,windowH-2,'#dcbda4');}
          if(style===0||style===2){rect(x-3,y+windowH+1,wid+6,3,cream);rect(x-2,y+windowH+4,wid+4,1,accent);}
        }
      }
      const k=ph-58;
      rect(0,k,pw,4,cream);rect(0,k+4,pw,17,side?accent:'#4e717b');
      if(!side){
        c.fillStyle='#fff0ca';c.font='bold 13px Georgia,serif';c.textAlign='center';
        c.fillText(shopNames[seed%shopNames.length],pw/2,k+17);
        rect(5,k+11,39,1,'#e9ceb1');rect(pw-45,k+11,39,1,'#e9ceb1');
      }else {for(let i=0;i<3;i++)rect(0,k+8+i*4,pw,1,cream);}
      rect(0,k+22,pw,30,'#476c76');
      for(let j=0;j<7;j++){
        const px=3+j*38,sz=j===2?28:33;
        rect(px,k+24,sz,25,j===2?'#547982':glass[(j+seed)%5]);rect(px+1,k+25,sz-2,2,'#a2b7ad');
        if(j===2){rect(px+2,k+26,24,18,'#a0b8ac');rect(px+20,k+38,2,4,'#ebcc92');}
        else{c.fillStyle='#a3beb7';c.beginPath();c.moveTo(px+4,k+26);c.lineTo(px+15,k+26);c.lineTo(px+4,k+39);c.fill();}
      }
      if(style===0||style===3){
        for(let i=0;i<22;i++)rect(i*12,k+21,12,5,i%2?cream:accent);
      }
      rect(0,ph-6,pw,6,cream);rect(0,ph-3,pw,3,accent);
      if(seed%5===1){for(const at of [5,9,pw-9,pw-5])rect(at,0,1.8,k,cream);}
      if(side){rect(0,0,pw,ph,'rgba(59,68,96,.18)');}
      tex.set(key,img);return img;
    }
    // Project each sliver as an affine patch. Vertical edges stay vertical with this lens.
    function wall(ax,az,bx,bz,y,ht,image){
      let a=cam(ax,y,az),b=cam(bx,y,bz),u0=0,u1=1;
      if(a[2]<near&&b[2]<near)return;
      if(a[2]<near||b[2]<near){
        const t=(near-a[2])/(b[2]-a[2]),cut=a.map((v,i)=>v+(b[i]-v)*t);
        if(a[2]<near){a=cut;u0=t;}else{b=cut;u1=t;}
      }
      const p0=proj(a),p1=proj(b),px=p1[0]-p0[0];
      if(Math.abs(px)<.6||Math.min(p0[0],p1[0])>w||Math.max(p0[0],p1[0])<0)return;
      const aY=horizon-(a[1]+ht)*f/a[2],bY=horizon-(b[1]+ht)*f/b[2];
      const p=[[p0[0],aY],[p1[0],bY],p1,p0];ctx.save();ctx.beginPath();ctx.moveTo(...p[0]);for(let j=1;j<4;j++)ctx.lineTo(...p[j]);ctx.closePath();ctx.clip();
      // Projective horizontal sampling uses more slices only on close, strongly receding faces.
      const steps=limit(Math.ceil(Math.abs(a[2]-b[2])/Math.min(a[2],b[2])*9),1,30);
      const dw=image.width,dh=image.height;
      for(let j=0;j<steps;j++){
        const s0=j/steps,s1=(j+1)/steps;
        const d0=1/((1-s0)/a[2]+s0/b[2]),d1=1/((1-s1)/a[2]+s1/b[2]);
        const t0=s0*d0/b[2],t1=s1*d1/b[2];
        const tx=(u0+(u1-u0)*t0)*dw,sw=Math.max(.002,(u1-u0)*(t1-t0)*dw);
        const x=p0[0]+px*s0,dx=px/steps,y0=horizon-(a[1]+ht)*f/d0,y1=horizon-(b[1]+ht)*f/d1;
        if(Math.max(x,x+dx)<0||Math.min(x,x+dx)>w)continue;
        ctx.save();ctx.transform((dx+Math.sign(dx)*.36)/sw,(y1-y0)/sw,0,ht*f/Math.min(d0,d1)/dh,x,y0);
        ctx.drawImage(image,tx,0,Math.min(sw,dw-tx),dh,0,0,sw,dh);ctx.restore();
      }ctx.restore();
    }
    function makeBuilding(b){
      const {x,z,w:bw,h:bd,seed:k}=b,xx=x+bw,zz=z+bd, mx=(x+xx)/2,mz=(z+zz)/2;
      const stories=1+(k%4)+(k%9===0?2:0), ht=3.15+2.37*stories, cols=pastel[k%8];
      return { x:mx,z:mz,r:Math.hypot(bw,bd)/2+1, draw(){
        if(cx>x-.01&&cx<xx+.01&&cz>z-.01&&cz<zz+.01)return;
        const fg=facade(k,stories,false),side=facade(k,stories,true);
        if(cz<z)wall(xx,z,x,z,.18,ht,side);
        if(cx>xx)wall(xx,zz,xx,z,.18,ht,fg);
        if(cx<x)wall(x,z,x,zz,.18,ht,side);
        if(cz>zz)wall(x,zz,xx,zz,.18,ht,fg);
        block(mx,ht+.18,mz,bw+.36,.28,bd+.36,[cols[1],cols[1],cols[0],cols[1]]);
        if(k%3!==1){
          block(mx,ht+.46,mz,bw*.67,.58,bd*.75,[cols[0],cols[0],cols[2],cols[1]]);
          block(mx,ht+.99,mz,bw*.70,.15,bd*.78,[cols[1],cols[1],cols[0],cols[1]]);
        }
        if(k%7===1){
          block(mx,ht+1.08,mz,bw*.29,1.12,bd*.48,[cols[0],cols[0],cols[2],cols[1]]);
          line([mx,ht+2.1,mz],[mx,ht+3.8,mz],'#8f8c95',.07);
        }
      }};
    }
    const footprintList=plan.buildings||[];
    for(const b of footprintList)fixed.push(makeBuilding(b));
    function addPalm(x,z,seed,ht){
      const crownX=x+.31*Math.sin(seed), crownZ=z+.32*Math.cos(seed);
      const leaves=[];
      for(let j=0;j<11;j++){
        const a=seed+j*2.39996,dy=(j%3===0?.62:.22)*ht*.18;
        const span=(.34+hash(j+seed)*.115)*ht,mx=Math.cos(a),mz=Math.sin(a),wx=-mz,wz=mx;
        let l=[],r=[],mid=[];
        for(let i=0;i<=9;i++){
          const t=i/9,stretch=t*span,yy=ht+dy*Math.sin(t*Math.PI)+span*(.36*Math.sin(Math.PI*t)-.18*t*t);
          const breadth=Math.pow(Math.sin(Math.PI*t),.8)*span*.16*(i%2?.74:1);
          const qx=crownX+stretch*mx,qz=crownZ+stretch*mz;
          mid.push([qx,yy+.025,qz]);
          l.push([qx+wx*breadth,yy-breadth*.24,qz+wz*breadth]);r.push([qx-wx*breadth,yy-breadth*.31,qz-wz*breadth]);
        }
        leaves.push([l,mid,r,j]);
      }
      fixed.push({x,z,r:5,draw(){
        const a=cam(x,0,z);if(a[2]<near)return;
        const stem=(yy)=>[x+(crownX-x)*(yy/ht)**1.5,yy,z+(crownZ-z)*(yy/ht)**1.5];
        line(stem(.13),stem(ht*.53),'#927366',.3);line(stem(ht*.53),stem(ht),'#9b816a',.23);
        for(let i=1;i<7;i++){const y=ht*i/7;line(stem(y),stem(y+.063),'#786c63',.29);}
        for(const [l,m,r,j] of leaves){
          poly(l.concat([...m].reverse()),['#387d69','#40886f','#286d64','#52936d'][j%4]);
          poly(m.concat([...r].reverse()),['#78a56f','#64a27a','#509170','#77a775'][j%4]);
        }
      }});
    }
    for(const axis of roads)for(const t of [-119,-72,-24,24,72,119]){
      for(const s of [-1,1]){
        if(axis===96&&s>0)continue;
        addPalm(axis+s*8.76,t+s*4.1,axis+t+s*7,7.35+hash(axis+t)*2.8);
      }
      if(t<113){addPalm(t-6.5,axis-8.6,axis-t+3,8.4);if((axis+t)%3===0)addPalm(t+7,axis+8.8,axis+t+4,7.8);}
    }
    for(let z=-128;z<130;z+=12)addPalm(108.9,z,2+z,7.2+hash(z)*2);
    for(const l of lots){
      floorRect(l.x-2.05,l.z-2.05,l.w+4.10,l.h+4.10,'#b1a69b',.035);
      floorRect(l.x-1.72,l.z-1.72,l.w+3.44,l.h+3.44,'#d8c2ae',.055);
      floorRect(l.x-.40,l.z-.40,l.w+.8,l.h+.8,l.park?'#98ae8b':'#c4b59c',.07);
      if(l.park){
        floorRect(l.x+l.w*.43,l.z,l.w*.12,l.h,'#ddccb0',.08);floorRect(l.x,l.z+l.h*.43,l.w,l.h*.12,'#ddccb0',.09);
        addPalm(l.x+l.w*.25,l.z+l.h*.28,l.seed+8,6.7);addPalm(l.x+l.w*.7,l.z+l.h*.7,l.seed+33,8.6);
      }
    }
    // Lane paint and crossings are coplanar layers painted ahead of the street furniture.
    const groundMarks=[];
    for(const axis of roads)for(let t=-140;t<135;t+=5){
      if(roads.some(a=>Math.abs(a-t)<8.8))continue;
      for(const s of [-1,1]){
        groundMarks.push([axis+s*.14-.055,t,.11,2.65,'#dfbd8a'],[t,axis+s*.14-.055,2.65,.11,'#dfbd8a']);
      }
    }
    for(const x of roads)for(const z of roads){
      for(let i=-5.65;i<6;i+=1.67)for(const s of [-1,1])
        groundMarks.push([x+i,z+s*7.91-.77,.70,1.54,'#d7d3bc'],[x+s*7.91-.77,z+i,1.54,.70,'#d7d3bc']);
      const px=x-7.55,pz=z-7.62;
      fixed.push({x:px,z:pz,r:2,draw(){
        line([px,0,pz],[px,5.08,pz],'#6f848a',.12);
        line([px,5.02,pz],[px+.72,5.37,pz],'#749092',.11);
        block(px+.94,5.26,pz,.68,.14,.38,['#68818a','#8da4a4','#677e86','#abb4a7']);
        block(px,2.84,pz,.42,.79,.28,['#485b65','#617783','#435768','#778690']);
        const glow= (Math.floor(time/15)+x+z)%3===1?'#f5a58f':'#a9e0a8';
        block(px,3.24,pz+.17,.19,.19,.06,[glow]);
      }});
    }
    for(let i=0;i<150;i++){
      const axis=roads[i%5],t=-142+hash(i+6)*279,side=hash(i+96)*11-5.5;
      if(i%2)groundMarks.push([axis+side,t,.035+hash(i)*.04,1.5+hash(-i)*2.3,'#77838a']);
      else groundMarks.push([t,axis+side,1.1+hash(i+7)*2,.052,'#73818a']);
    }
    // Buildings and street furniture cast long, quiet blue-grey contact shadows.
    const skyBands=[
      [122,.034,'#acacb8','#aeaab2'],[92,.021,'#b2a2ad','#b49fab'],
      [76,.015,'#998fa5','#a298ae']
    ];
    const wrapping=(a)=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
    function sky(yaw){
      const grad=ctx.createLinearGradient(0,0,0,horizon);
      grad.addColorStop(0,'#70adc6');grad.addColorStop(.34,'#a8c3d1');grad.addColorStop(.67,'#e5c5cb');
      grad.addColorStop(.88,'#f6c9ad');grad.addColorStop(1,'#ffdcaa');
      ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
      const sun=wrapping(.34-yaw);
      if(Math.abs(sun)<1.49){
        const sx=w/2+Math.tan(sun)*f,sy=horizon-f*.17,rad=Math.max(8,.045*f);
        const halo=ctx.createRadialGradient(sx,sy,rad*.36,sx,sy,rad*5);
        halo.addColorStop(0,'rgba(255,235,171,.76)');halo.addColorStop(.3,'rgba(255,219,159,.49)');halo.addColorStop(1,'rgba(255,226,174,0)');
        ctx.fillStyle=halo;ctx.fillRect(sx-rad*5,sy-rad*5,rad*10,rad*10);
        ctx.fillStyle='#fff0b3';ctx.beginPath();ctx.arc(sx,sy,rad,0,TAU);ctx.fill();
      }
      for(let i=0;i<44;i++){
        const a=wrapping(i*TAU/44+hash(i+67)*.052-yaw);if(Math.abs(a)>1.39)continue;
        const x=w*.5+Math.tan(a)*f,y=horizon-f*(.16+hash(i+2)*.60),sz=f*(.027+hash(i+12)*.055);
        ctx.fillStyle=i%3?'rgba(255,228,211,.52)':'rgba(247,223,224,.66)';
        ctx.beginPath();ctx.moveTo(x-sz,y);
        ctx.quadraticCurveTo(x-sz*.8,y-sz*.13,x-sz*.36,y-sz*.12);
        ctx.quadraticCurveTo(x-sz*.12,y-sz*.42,x+sz*.12,y-sz*.18);
        ctx.quadraticCurveTo(x+sz*.49,y-sz*.23,x+sz*.61,y-sz*.07);
        ctx.quadraticCurveTo(x+sz*.96,y-sz*.05,x+sz*1.23,y+sz*.012);
        ctx.lineTo(x-sz,y+sz*.05);ctx.fill();
      }
      for(let j=0;j<skyBands.length;j++){
        const [n,elev,c,c2]=skyBands[j],delta=TAU/n;
        for(let i=0;i<n;i++){
          const a=wrapping(i*delta-yaw);if(Math.abs(a)>1.39)continue;
          const x=w/2+f*Math.tan(a),x2=w/2+f*Math.tan(a+delta*.96),sw=x2-x;
          const bh=f*(elev+hash(i*13+j*53)*(.075+j*.011));
          ctx.fillStyle=i%3===0?c2:c;ctx.fillRect(x,horizon-bh,sw+.45,bh+1);
          if(i%4===1)ctx.fillRect(x+sw*.18,horizon-bh-f*.009,sw*.64,f*.012);
          if(j===2&&i%3===0){
            ctx.fillStyle='#beb4b6';
            for(let t=1;t<4;t++)ctx.fillRect(x+sw*t*.2,horizon-bh*.84,Math.max(.7,sw*.025),bh*.71);
          }
        }
      }
      const ground=ctx.createLinearGradient(0,horizon,0,h);ground.addColorStop(0,'#9a9a9d');
      ground.addColorStop(.12,'#858d95');ground.addColorStop(.55,'#70808a');ground.addColorStop(1,'#5c6e7a');
      ctx.fillStyle=ground;ctx.fillRect(0,horizon,w,h-horizon+1);
    }
    const worldPoint=(x,z,angle)=>(u,y,v)=>[x+u*Math.cos(angle)-v*Math.sin(angle),y,z+u*Math.sin(angle)+v*Math.cos(angle)];
    const tinted=(color,amount)=>{
      const val=parseInt(String(color).replace('#',''),16);if(!Number.isFinite(val))return '#db907a';
      const parts=[val>>16&255,val>>8&255,val&255].map(v=>Math.round(amount>0?v+(255-v)*amount:v*(1+amount)));
      return 'rgb('+parts.join(',')+')';
    };
    function actorMesh(toWorld){
      const faces=[];
      const face=(coords,color,order=0)=>{
        const v=coords.map(p=>toWorld(...p));const depth=v.reduce((t,q)=>t+dist(q[0],q[2]),0)/v.length;
        faces.push({v,color,d:depth+order});
      };
      function cub(x,y,z,bw,bh,bd,c){
        const l=x-bw/2,r=x+bw/2,n=z-bd/2,s=z+bd/2,b=y,t=y+bh;
        const c0=toWorld(x,y,z);
        const left=toWorld(-1,0,0),o=toWorld(0,0,0),front=toWorld(0,0,-1);
        const side=(cx-c0[0])*(o[0]-left[0])+(cz-c0[2])*(o[2]-left[2]);
        const nearSide=(cx-c0[0])*(front[0]-o[0])+(cz-c0[2])*(front[2]-o[2]);
        if(side<0)face([[l,b,n],[l,b,s],[l,t,s],[l,t,n]],c[2]||c[0]);
        else face([[r,b,s],[r,b,n],[r,t,n],[r,t,s]],c[1]||c[0]);
        if(nearSide>0)face([[r,b,n],[l,b,n],[l,t,n],[r,t,n]],c[1]||c[0]);
        else face([[l,b,s],[r,b,s],[r,t,s],[l,t,s]],c[0]);
        if(cy>t)face([[l,t,n],[r,t,n],[r,t,s],[l,t,s]],c[3]||c[0]);
      }
      return {face,cub,finish(){faces.sort((a,b)=>b.d-a.d);for(const m of faces)poly(m.v,m.color);}};
    }
    function car(x,z,angle,col,driver,sedan=false){
      const toWorld=worldPoint(x,z,angle),mesh=actorMesh(toWorld),{cub,face}=mesh;
      const body=col||'#d99071',shade=tinted(body,-.27),light=tinted(body,.18),top=tinted(body,.28);
      cub(0,.36,.02,1.87,.40,3.95,[shade,body,shade,body]);
      const profiles=[[-2.08,.78,.66],[-1.74,.99,.89],[-.8,1.05,.96],[.82,1.06,.91],[1.54,.98,.87],[2.05,.87,.73]];
      for(let j=0;j<profiles.length-1;j++){
        const [v,sw,y]=profiles[j],[v2,sw2,y2]=profiles[j+1];
        face([[-sw,y,v],[sw,y,v],[sw2,y2,v2],[-sw2,y2,v2]],j===2?'#344b59':top);
        for(const side of [-1,1]){
          face([[side*sw,.45,v],[side*sw2,.45,v2],[side*sw2,y2,v2],[side*sw,y,v]],side<0?shade:body);
          face([[side*(sw+.008),.64,v],[side*(sw2+.008),.64,v2],[side*(sw2+.008),.675,v2],[side*(sw+.008),.675,v]],'#d8c4ad',-.012);
        }
      }
      cub(0,.40,2.01,1.78,.30,.10,[body,shade,shade,light]);
      cub(0,.34,2.075,1.85,.13,.16,['#b4babe','#bec4c4','#899aa4','#d9d7ca']);
      cub(0,.44,-2.05,1.66,.15,.18,['#c0c4be','#d7d4c4','#889ba4','#d8d9cc']);
      for(const side of [-1,1]){
        cub(side*.68,.62,2.056,.37,.13,.045,['#ee726d','#e68879','#a9535e','#ffb48d']);
        cub(side*.69,.65,-2.045,.32,.17,.05,['#ffdfaa','#ffecba','#d2c9ab','#fff2bd']);
        for(const vz of [-1.23,1.23]){
          const wx=side*1.015, sy=.40, radius=.39;
          for(const [rd,xx,ink] of [[radius,wx,'#354451'],[radius*.72,wx+side*.035,'#bbc3bb'],[radius*.46,wx+side*.048,'#718793'],[radius*.20,wx+side*.054,'#d6d5c5']]){
            const p=[];for(let a=0;a<12;a++)p.push([xx,sy+Math.cos(TAU*a/12)*rd,vz+Math.sin(TAU*a/12)*rd]);face(p,ink,-.025);
          }
        }
        cub(side*.97,.91,-.54,.25,.11,.20,[body,shade,shade,light]);
        cub(side*.936,.82,.03,.055,.055,.25,['#dce0d0']);
      }
      cub(0,.52,2.108,.54,.16,.042,['#ecdec2']);
      cub(0,.535,2.137,.34,.045,.015,['#74828a']);
      face([[-.88,.94,-.88],[.88,.94,-.88],[.78,1.48,-.57],[-.78,1.48,-.57]],'#83abb5',-.01);
      face([[-.82,1.01,-.842],[-.37,1.01,-.842],[.12,1.44,-.59],[-.22,1.44,-.59]],'#adc8c8',-.025);
      cub(0,1.47,-.57,1.61,.045,.07,['#e0d5bf']);
      for(const side of [-1,1]){
        face([[side*.89,.93,-.89],[side*.82,1.50,-.57],[side*.76,1.50,-.57],[side*.84,.93,-.89]],'#e4cfba',-.035);
        cub(side*.43,.91,.24,.59,.26,.35,['#986d66','#a88477','#815f61','#c7a28b']);
        cub(side*.43,1.15,.25,.34,.16,.19,['#bc9585','#cba28f','#9b7976','#dab99d']);
      }
      if(driver){
        cub(-.43,1.04,-.014,.38,.31,.29,['#4a7e8a','#62909a','#38606f','#739797']);
        cub(-.43,1.31,-.021,.27,.24,.23,['#c28d78','#dfac8e','#bd8673','#deb399']);
        cub(-.43,1.50,-.014,.29,.10,.25,['#504957','#5a505c','#403b4a','#66606c']);
      }
      if(sedan){
        cub(0,1.31,.1,1.56,.16,1.52,[light,body,shade,top]);
        face([[-.84,.91,.94],[.84,.91,.94],[.75,1.35,.55],[-.75,1.35,.55]],'#7597a6');
      }
      mesh.finish();
    }
    function figure(x,z,angle,phase,coat='#e8a36e',hero=false){
      const toWorld=worldPoint(x,z,angle),mesh=actorMesh(toWorld),{cub}=mesh;
      const stride=Math.sin(phase)*.21, jacket=[coat,tinted(coat,.18),tinted(coat,-.20),tinted(coat,.24)];
      const pants=['#424f62','#52657a','#374859','#637485'], skin=['#ca9280','#e5ae8e','#b98073','#edbd99'];
      for(const side of [-1,1]){
        let v=side*stride;
        cub(side*.13,.12,v,.202,.64,.225,pants);
        cub(side*.13,.02,v-.062,.23,.16,.36,['#e2d5bd','#ebdac4','#9faaa7','#f3e1c9']);
        cub(side*.13,.025,v-.062,.237,.042,.37,['#6d8290']);
      }
      cub(0,.73,0,.48,.54,.32,jacket);
      cub(0,1.22,0,.51,.12,.33,jacket);
      for(const side of [-1,1]){
        const v=-side*stride*.62;
        cub(side*.305,.94,v,.17,.30,.22,jacket);
        cub(side*.30,.76,v-.026,.139,.20,.17,skin);
      }
      cub(0,1.32,0,.19,.13,.19,skin);
      cub(0,1.41,-.018,.32,.33,.285,skin);
      cub(0,1.65,.009,.345,.14,.31,['#4c4b55','#68555c','#403e4a','#63555c']);
      if(hero){
        cub(0,1.72,-.012,.39,.13,.35,['#d98d71','#e8a17a','#b8796d','#f1b887']);
        cub(0,1.73,-.206,.36,.046,.13,['#efd09c']);
        for(const side of [-1,1])cub(side*.169,1.04,.166,.049,.27,.025,['#4e7482']);
        cub(0,.88,.201,.34,.38,.18,['#476b79','#5d8890','#355462','#789996']);
        cub(0,.90,.305,.28,.18,.048,['#5b8a90','#739e9f','#486f7b','#86aba6']);
        cub(0,1.12,.30,.3,.042,.05,['#e0ba89']);
      }
      mesh.finish();
    }
    fixed.push({x:112,z:103,r:6,draw(){
      const colors=['#f2d9b7','#e9bea4','#cba9a1','#ffe2bd'],rose=['#dc9587','#e99e8b','#bf7d7e','#f0b292'];
      block(112,.06,103,4.8,.64,4.8,colors);block(112,.7,103,2.49,4.15,2.49,colors);
      block(112,4.85,103,2.24,1.65,2.24,rose);block(112,6.5,103,2.15,2.1,2.15,colors);
      block(112,8.58,103,2.8,.26,2.8,rose);block(112,8.84,103,1.75,1.18,1.75,['#8bb1b2','#9ac3bd','#7096a1','#b3cfbd']);
      block(112,10.03,103,2.31,.32,2.31,rose);block(112,10.35,103,1.53,.38,1.53,rose);
      line([112,10.65,103],[112,11.28,103],'#aaa0a0',.09);
    }});
    const trafficData=[
      [2.64,-47,0,3.8,'#7eb6b0'],[-2.65,-32,Math.PI,3.3,'#cf8f93'],
      [47,-45.35,Math.PI/2,4.2,'#e6bf87'],[-70,-50.66,-Math.PI/2,4.7,'#aaa6c1'],
      [50.65,47,0,3.8,'#deb285'],[-50.65,76,Math.PI,4.1,'#8ab0b9'],
      [58,50.66,Math.PI/2,5.1,'#ba92a3'],[94,-98.65,-Math.PI/2,4.2,'#b9c08e']
    ];
    const people=[
      [-8.44,-17,0,'#c38596'],[8.42,-36,Math.PI,'#66a99e'],[-13,-40.4,Math.PI/2,'#e6b66f'],
      [-21,-55.88,-Math.PI/2,'#ab94b4'],[55.8,63,0,'#c38d84'],[-88.1,19,Math.PI,'#7f9eb4'],
      [-41,39.8,Math.PI/2,'#d3a677'],[103.7,16,0,'#74ab94'],[59,-88.2,Math.PI/2,'#74aabb']
    ];
    function dynamic(s,targets,yaw){
      const items=[];
      const push=(x,z,r,draw)=>{if(visible(x,z,r))items.push({x,z,r,draw});};
      const addShadow=(x,z,rx,rz)=>{if(visible(x,z,3))oval(x-.24,z+.16,rx,rz,shadowInk,.115);};
      const wrapPos=n=>((n+112)%224+224)%224-112;
      for(const [x,z,a,v,col] of trafficData){
        const tx=wrapPos(x+Math.sin(a)*v*time),tz=wrapPos(z-Math.cos(a)*v*time);
        if(Math.hypot(s.x-tx,s.z-tz)<3.6||Math.hypot(s.carX-tx,s.carZ-tz)<3.9)continue;
        addShadow(tx,tz,1.28,2.21);push(tx,tz,2.4,()=>car(tx,tz,a,col,true,true));
      }
      for(let i=0;i<people.length;i++){
        const [x,z,a,col]=people[i],t=(time*.67+i*2.65)%12,v=t<6?t:12-t;
        const px=x+Math.sin(a)*v,pz=z-Math.cos(a)*v;
        addShadow(px,pz,.4,.42);push(px,pz,1,()=>figure(px,pz,a+(t<6?0:Math.PI),time*5+i,col));
      }
      for(const b of fixed)if(visible(b.x,b.z,b.r))items.push(b);
      const carX=Number.isFinite(s.carX)?s.carX:4,carZ=Number.isFinite(s.carZ)?s.carZ:0;
      addShadow(carX,carZ,1.17,2.2);
      push(carX,carZ,2.4,()=>car(carX,carZ,s.carHeading??(s.driving?s.heading:0),s.carColor||'#ee9968',s.driving));
      if(!s.driving){
        addShadow(s.x,s.z,.39,.44);
        push(s.x,s.z,1.25,()=>figure(s.x,s.z,s.heading,s.walk||0,'#ecad79',true));
      }
      for(const m of targets){
        if(!Number.isFinite(m?.x)||!Number.isFinite(m?.z)||!visible(m.x,m.z,3.2,100))continue;
        const pc=m.color||'#f5ca78',glow=.5+.5*Math.sin(time*3.8),parts=28;
        for(let j=0;j<parts;j++){
          const a=j*TAU/parts,b=(j+1)*TAU/parts,rr=1.54+glow*.19,inn=rr-.19;
          poly([[m.x+rr*Math.cos(a),.10,m.z+rr*Math.sin(a)],[m.x+rr*Math.cos(b),.10,m.z+rr*Math.sin(b)],
            [m.x+inn*Math.cos(b),.10,m.z+inn*Math.sin(b)],[m.x+inn*Math.cos(a),.10,m.z+inn*Math.sin(a)]],pc);
        }
        const pt=cam(m.x,3.15+.16*glow,m.z);
        if(pt[2]<1.3)continue;
        push(m.x,m.z,.75,()=>{
          if(m.type==='contact'||window.CityWorld&&Object.values(window.CityWorld.places).slice(0,4).some(q=>Math.hypot(q.x-m.x,q.z-m.z)<1)){
            figure(m.x,m.z,Math.PI*.60,0,pc);
          }
          const xy=proj(pt),size=limit(f/pt[2]*.37,3.5,23);
          paintPoly([[xy[0],xy[1]-size*1.4],[xy[0]+size,xy[1]],[xy[0],xy[1]+size*1.4],[xy[0]-size,xy[1]]],pc);
          paintPoly([[xy[0],xy[1]-size*1.4],[xy[0]+size,xy[1]],[xy[0],xy[1]+size*1.4]],'rgba(58,63,74,.29)');
          if(pt[2]>49||(!m.highlighted&&pt[2]>32)||!m.label)return;
          const label=String(m.label).slice(0,20),py=xy[1]-size*1.4-7;
          const fs=limit(f/pt[2]*.48,10,15);ctx.font='600 '+fs+'px system-ui,sans-serif';
          const lw=ctx.measureText(label).width+14;
          ctx.fillStyle='rgba(38,57,67,.87)';ctx.fillRect(xy[0]-lw/2,py-fs-4,lw,fs+8);
          ctx.fillStyle=pc;ctx.fillRect(xy[0]-lw/2,py+4,lw,1.5);
          ctx.fillStyle='#fff6dd';ctx.textBaseline='alphabetic';ctx.textAlign='center';ctx.fillText(label,xy[0],py);
        });
      }
      items.sort((a,b)=>dist(b.x,b.z)-dist(a.x,a.z));
      for(const item of items)item.draw();
    }
    let stage=null,lastSize='';
    function draw(s,targets=[],seconds=0,paint,meta){
      if(dead||!s)return false;
      if(paint||meta)s={...s,...meta,carColor:paint||s.carColor};
      w=s.viewportWidth||canvas.clientWidth||canvas.width;h=s.viewportHeight||canvas.clientHeight||canvas.height;
      if(!w||!h)return true;time=seconds;
      ctx.setTransform(canvas.width/w,0,0,canvas.height/h,0,0);
      ctx.lineCap='round';ctx.lineJoin='round';ctx.imageSmoothingEnabled=true;
      const yaw=(s.heading||0)+(s.orbitYaw||0),pitch=limit(s.orbitPitch||0,-.31,.67);
      cs=Math.cos(yaw);sn=Math.sin(yaw);f=h*.83;
      const distance=s.driving?7.35:5.45;
      let cameraBack=distance;
      for(let d=.83;d<distance;d+=.47){
        const qx=s.x-sn*d,qz=s.z+cs*d;
        if(footprintList.some(b=>qx>b.x-.14&&qx<b.x+b.w+.14&&qz>b.z-.14&&qz<b.z+b.h+.14)){cameraBack=Math.max(.68,d-.47);break;}
      }
      cx=s.x-sn*cameraBack;cz=s.z+cs*cameraBack;
      const baseY=s.driving?3.12:2.78;
      cy=baseY+pitch*1.44-(distance-cameraBack)*.18;
      horizon=h*(.421-pitch*.20);edge=w/(2*f)+.015;
      ctx.clearRect(0,0,w,h);sky(yaw);
      flat(shore,-175,220,350,'#72b8bb',.018);
      flat(shore-10,-156,10,312,'#ddbb91',.028);
      flat(shore-10,-156,3.15,312,'#d6c8ae',.035);
      for(let i=0;i<91;i++){
        const wx=shore+1.2+hash(i+111)*131,wz=-150+hash(i+67)*300;
        if(visible(wx,wz,6,135))flat(wx,wz,.11+hash(i)*.25,1+hash(i+31)*3.6,'#b1d8cd',.045);
      }
      for(const a of roads){
        flat(shore-1,a-3.3,20,6.6,'#b99880',.06);
        for(let j=0;j<13;j++)flat(shore+j*1.4,a-3.29,.065,6.58,'#8f8279',.07);
      }
      for(const [x,z,bw,bd,ink,y] of land)if(visible(x+bw/2,z+bd/2,(bw+bd)*.38))flat(x,z,bw,bd,ink,y);
      for(const b of footprintList){
        const {x,z,w:bw,h:bd}=b;if(!visible(x+bw/2,z+bd/2,(bw+bd)*.4,94))continue;
        poly([[x,.082,z],[x+bw,.082,z],[x+bw,.082,z+bd],[x+bw-2,.082,z+bd+2.2],[x-2,.082,z+bd+2.2],[x-2,.082,z+2.2]],'rgba(91,87,98,.19)');
      }
      for(const [x,z,bw,bd,ink] of groundMarks){
        if(visible(x+bw/2,z+bd/2,2.5,100))flat(x,z,bw,bd,ink,.075);
      }
      shadowInk='rgba(53,67,79,.34)';
      dynamic(s,Array.isArray(targets)?targets:[],yaw);
      const ss=w+','+h;
      if(!stage||lastSize!==ss){
        stage=ctx.createRadialGradient(w*.55,h*.44,Math.min(w,h)*.25,w*.5,h*.45,Math.hypot(w,h)*.65);
        stage.addColorStop(0,'rgba(24,41,56,0)');stage.addColorStop(1,'rgba(28,47,64,.12)');lastSize=ss;
      }
      ctx.fillStyle=stage;ctx.fillRect(0,0,w,h);
      return true;
    }
    return { draw, render:(s,targets,ms)=>draw(s,targets,ms/1000), dispose(){
      dead=true;for(const texture of tex.values())texture.width=texture.height=0;tex.clear();stage=null;
    }};
  }
  window.CityPerspective={create};
})();
