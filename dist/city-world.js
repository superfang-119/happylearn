/* Coastal city scenery. All geometry and shop lettering are built on the device. */
(() => {
  'use strict';
  const avenues = [-96, -48, 0, 48, 96];
  const roads = { x: avenues.slice(), z: avenues.slice(), width: 14 };
  const bounds = { minX: -132, maxX: 132, minZ: -132, maxZ: 132 };
  const parked = { x: 4, z: 0, heading: 0 };
  const places = Object.fromEntries([
    ['english', '英语电台', 6, -24, '#f7996c'],
    ['geography', '海图站', 72, -90, '#42c9cc'],
    ['history', '时光档案馆', -90, 24, '#ebbb69'],
    ['chinese', '海风书院', 24, 54, '#bb90da'],
    ['pier', '观潮码头', 120, -96, '#43c6c0'],
    ['market', '滨海集市', -48, -72, '#f69080'],
    ['museum', '城市博物馆', -96, 72, '#e9bd76'],
    ['lighthouse', '白沙灯塔', 96, 96, '#f1a984']
  ].map(([id, name, x, z, color]) => [id, { id, name, x, z, color }]));
  const obstacles = [];
  const TAU = 2 * Math.PI;
  const signNames = [
    ['PALM', '海 棕 酒 店'], ['WAVE 88', '海 湾 电 台'], ['CORAL', '珊 瑚 剧 场'],
    ['TIDE MAPS', '海 图 测 绘 站'], ['BAY ARCHIVE', '时 光 档 案 馆'], ['INK & TIDE', '海 风 书 院'],
    ['MERCADO', '滨 海 集 市'], ['MUSEUM', '海 岸 博 物 馆'], ['SURF CLUB', '海 岸 俱 乐 部'],
    ['SUNDAE', '冰 淇 淋 店'], ['CINEMA', '日 落 影 院'], ['OCEANIC', '蓝 湾 旅 社'],
    ['MIRAGE', '海 市 画 廊'], ['CAFE SOL', '阳 光 咖 啡'], ['VINYL', '唱 片 商 店'],
    ['BLUE LINE', '海 湾 电 车'], ['PIER 06', '观 潮 码 头'], ['SHELL', '贝 壳 商 店']
  ];
  function seeded(seed) {
    return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
  }

  function build(T, scene) {
    const city = new T.Group();
    city.name = '快乐学 · 海湾市';
    scene.add(city);
    obstacles.length = 0;
    const rand = seeded(88219);
    const pick = array => array[Math.floor(rand() * array.length)];
    const range = (a, b) => a + (b - a) * rand();
    const mat = new T.MeshLambertMaterial({ color: 0xffffff });
    const luminous = new T.MeshBasicMaterial({ color: 0xffffff });
    const boxes = new T.BoxGeometry(1, 1, 1);
    const cylinder = new T.CylinderGeometry(.5, .5, 1, 9);
    const octagon = new T.CylinderGeometry(.5, .5, 1, 8);
    const round = new T.CylinderGeometry(.5, .5, 1, 18);
    const roundTop = new T.SphereGeometry(.5, 10, 6);
    const rocks = new T.IcosahedronGeometry(.5, 0);
    const pyramid = new T.ConeGeometry(.5, 1, 4);
    const pole = new T.CylinderGeometry(.42, .52, 1, 8);
    const groups = new Map();
    const v1 = new T.Vector3(), v2 = new T.Vector3(), up = new T.Vector3(0, 1, 0);
    const transform = new T.Object3D();
    const signage = [];
    function add(geo, x, y, z, sx, sy, sz, color, ry = 0, rx = 0, rz = 0, material = mat) {
      transform.position.set(x, y, z);
      transform.rotation.set(rx, ry, rz, 'YXZ');
      transform.scale.set(sx, sy, sz);
      transform.updateMatrix();
      queue(geo, material, color);
    }
    function queue(geo, material, color) {
      const key = geo.uuid + material.uuid;
      let batch = groups.get(key);
      if (!batch) { batch = { geo, material, matrices: [], colors: [] }; groups.set(key, batch); }
      batch.matrices.push(transform.matrix.clone());
      batch.colors.push(color);
    }
    function box(x, y, z, w, h, d, c, ry = 0) { add(boxes, x, y, z, w, h, d, c, ry); }
    function glow(x, y, z, w, h, d, c, ry = 0) { add(boxes, x, y, z, w, h, d, c, ry, 0, 0, luminous); }
    function rod(x, y, z, x2, y2, z2, diameter, color, geo = cylinder) {
      v1.set(x, y, z); v2.set(x2, y2, z2).sub(v1);
      transform.position.copy(v1).addScaledVector(v2, .5);
      transform.scale.set(diameter, v2.length(), diameter);
      transform.quaternion.setFromUnitVectors(up, v2.normalize());
      transform.updateMatrix(); queue(geo, mat, color);
    }
    function obstacle(x,z,w,d) { obstacles.push({ minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2 }); }
    function panel(x,y,z,w,h,angle,index) { signage.push({x,y,z,w,h,angle,index}); }

    // Build a palm crown from individually folded leaflets, all in one instanced mesh.
    const leaf = (() => {
      const verts = [], indices = [];
      for(let i=0; i<=12; i++) {
        const t=i/12, breadth=Math.sin(Math.PI * Math.pow(t,.87))*.17;
        const path=.19*Math.sin(t*Math.PI)-t*t*.22;
        verts.push(-breadth*(i%2?.76:1),path-.035*Math.sin(Math.PI*t),t,
                    0,path+.024*Math.sin(Math.PI*t),t,
                    breadth*(i%2?.78:1),path-.04*Math.sin(Math.PI*t),t);
        if(i<12){const q=i*3; indices.push(q,q+3,q+1,q+1,q+3,q+4,q+1,q+4,q+2,q+2,q+4,q+5);}
      }
      const geo=new T.BufferGeometry(); geo.setAttribute('position',new T.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
    })();
    const leafMat = new T.MeshLambertMaterial({ color:0xffffff, side:T.DoubleSide });
    const water = ['#50c2c0','#85d9cc','#8ae6d1','#b4eee0'];
    function palm(x,z,h = 8) {
      const lean=range(-.9,.9), drift=range(-.85,.85), topX=x+lean, topZ=z+drift;
      const a=.54, midX=x+lean*.28, midZ=z+drift*.28;
      rod(x,.16,z,midX,h*a,midZ,h*.054,'#927468',pole);
      rod(midX,h*a,midZ,topX,h,topZ,h*.043,'#ab8d72',pole);
      for(let i=1;i<6;i++) {
        const t=i/6, x1=x+lean*(t<a?t*.28/a:.28+(t-a)*.72/(1-a)), z1=z+drift*(t<a?t*.28/a:.28+(t-a)*.72/(1-a));
        add(cylinder,x1,h*t,z1,h*(.056-.013*t),.085,h*(.056-.013*t),'#827467');
      }
      const a0=rand()*TAU;
      for(let i=0;i<10;i++) {
        const wide=range(.85,1.1), span=h*(i<6?.43:.34)*range(.88,1.08);
        add(leaf,topX,h,topZ,span*wide,span,span,pick(i<6?['#29776b','#337e69','#2e8a72']:['#60a365','#71af70','#438d64']),a0+i*2.39996,i<6?range(.02,.24):range(-.35,-.17),range(-.1,.1),leafMat);
      }
      add(roundTop,topX,h-.12,topZ,.7,.8,.7,'#6f8562');
    }
    function shrub(x,z,s) {
      add(rocks,x,.3+s*.28,z,s,s*.73,s*.92,pick(['#70a27d','#5c9774','#448d7c']),rand()*TAU);
      add(rocks,x+s*.36,.31+s*.21,z+s*.12,s*.8,s*.62,s*.72,'#81b082',rand()*TAU);
    }
    // Roads use continuous asphalt. Raised pavement defines each block and its curb.
    box(-11,-.49,0,292,.82,311,'#6c8291');
    box(-11,-.10,0,292,.10,311,'#566d7d');
    const centers=[-120,-72,-24,24,72,120];
    const eastLand=[-120,-72,-24,24,72];
    for(const x of eastLand) for(const z of centers) {
      box(x,.035,z,33.95,.20,33.95,'#d5c6b6');
      box(x,.145,z,33.15,.12,33.15,'#ebbfae');
      box(x,.209,z,29.7,.025,29.7,'#ddccb4');
    }
    for(const x of avenues) for(let z=-143;z<=143;z+=6) {
      if(avenues.some(c=>Math.abs(z-c)<9))continue;
      box(x-.17,.005,z,.13,.04,2.65,'#ffdb99'); box(x+.17,.005,z,.13,.04,2.65,'#e7bf91');
    }
    for(const z of avenues) for(let x=-143;x<=119;x+=6) {
      if(avenues.some(c=>Math.abs(x-c)<9))continue;
      box(x,.021,z-.17,2.65,.037,.13,'#ffdb99');box(x,.021,z+.17,2.65,.037,.13,'#e7bf91');
    }
    for(const x of avenues) for(const z of avenues) {
      for(const sign of [-1,1]) for(let s=-5.4;s<6;s+=1.55){
        box(x+s,.04,z+sign*8,.87,.05,2.2,'#e7ddd0');
        box(x+sign*8,.048,z+s,2.2,.05,.87,'#e7ddd0');
      }
    }
    // A sandy strip runs the whole eastern waterfront with a promenade behind it.
    box(117,-.026,0,28,.095,308,'#eac28b');
    box(107,.11,0,6,.28,309,'#e4d4b9');
    box(103.9,.13,0,.32,.29,308,'#f0ddc6');
    box(130.6,-.028,0,6,.05,308,'#e9ce9d');
    box(135,-.09,0,7,.08,308,'#a5dfce');
    box(227,-.22,0,198,.28,900,'#64bfc4');
    box(330,-.39,0,500,.30,1100,'#76bac9');
    for(let i=0;i<300;i++) {
      const x=range(132,312), z=range(-166,166);
      box(x,-.044,z,range(.10,.31),.032,range(.6,3.5),pick(water));
    }
    for(let i=0;i<95;i++) {
      const z=range(-150,150);
      box(range(129,132),.006,z,range(.18,.55),.038,range(.5,2.1),pick(['#f7ead0','#e3e4bd','#e7d0a3']));
    }

    const palace=['#e8a5a6','#8fc6bd','#e5ba90','#dfb0aa','#a5c1be','#b5b2cc','#eab5a7','#a8b5d1'];
    const rails=['#efc6b2','#eadfc6','#c6d9d4'];
    const glass=['#3f7585','#548891','#64969b','#3e6f80','#649093'];
    const trim=['#f9dfbf','#f5d8ca','#e8e5d2'];
    const highWindows=['#b9dad1','#d9e0ce','#a9c9cd','#9ebac4'];
    // Building-local positive Z is the main street-facing facade.
    function building(x,z,w,d,h,angle,kind,label,body) {
      const ca=Math.cos(angle),sa=Math.sin(angle);
      const pos=(u,v)=>[x+ca*u+sa*v,z-sa*u+ca*v];
      const local=(u,y,v,sw,sh,sd,col)=>{const [wx,wz]=pos(u,v);box(wx,y,wz,sw,sh,sd,col,angle);};
      const roundLocal=(u,y,v,sw,sh,sd,col)=>{const [wx,wz]=pos(u,v);add(round,wx,y,wz,sw,sh,sd,col,angle);};
      const facade=d/2, half=w/2, band=pick(trim),pane=pick(glass);
      const blockW = Math.abs(ca)*w+Math.abs(sa)*d,blockD=Math.abs(sa)*w+Math.abs(ca)*d;
      obstacle(x,z,blockW,blockD);
      const base=.22, storefront=3.6;
      local(0,base+h/2,0,w,h,d,body);
      local(0,.57,facade+.04,w,.68,.15,pick(rails));
      local(0,h+.30,0,w+.44,.30,d+.44,band);
      local(0,h+.55,0,w-.5,.25,d-.5,'#a58e89');
      // Shopfronts, inset mullions and a canvas or Art Deco canopy.
      local(0,1.75,facade+.09,w-.7,2.75,.22,'#4b717c');
      const bayN=Math.max(2,Math.round(w/2.5));
      for(let i=0;i<bayN;i++) {
        const u=(i+.5)*w/bayN-half;
        local(u,1.94,facade+.226,w/bayN-.22,2.18,.10,pick(['#7caaa8','#7eaaa6','#98b8ae','#668e96']));
        local(u+(i%2?-.3:.3),2.82,facade+.289,w/bayN*.47,.095,.02,'#c3d1bb');
      }
      const entry=-w*.27;
      local(entry,1.44,facade+.27,1.4,2.44,.13,'#365f69');
      local(entry,1.45,facade+.36,1.04,2.02,.06,'#83acaa');
      local(entry+.34,1.42,facade+.414,.045,.38,.04,'#f0d4a5');
      local(0,3.62,facade+.44,w+.45,.24,1.16,band);
      if(kind===0 || kind===3) {
        for(let i=0;i<bayN*2;i++){
          const u=(i+.5)*w/(bayN*2)-half, c=i%2?'#f4e1c5':(kind===0?'#d4807d':'#72b7ad');
          local(u,3.52,facade+.72,w/(bayN*2)+.005,.12,1.42,c);
          local(u,3.36,facade+1.38,w/(bayN*2)+.005,.31,.11,c);
        }
      }
      const levels=Math.max(0,Math.floor((h-3.9)/2.85));
      for(let i=0;i<levels;i++){
        const y=storefront+(i+.57)*(h-storefront)/(levels+.15);
        if(kind===1 || kind===4) {
          local(0,y,facade+.036,w-.82,1.33,.11,pane);
          local(0,y-.72,facade+.20,w+.11,.16,.63,band);
          for(let j=0;j<bayN;j++){const u=(j+.51)*w/bayN-half;local(u,y,facade+.105,.12,1.34,.05,body);}
          if(kind===4) local(0,y+.73,facade+.16,w+.18,.12,.32,band);
        }else{
          for(let j=0;j<bayN;j++){
            const u=(j+.5)*w/bayN-half;
            local(u,y,facade+.035,Math.min(1.7,w/bayN-.4),1.51,.12,pane);
            local(u+.10,y+.16,facade+.104,.11,1.02,.04,'#a4bbaf');
            if((i+j)%6===0) local(u-.30,y+.24,facade+.105,.33,.82,.04,pick(highWindows));
            local(u,y-.81,facade+.21,Math.min(2.0,w/bayN-.18),.16,.48,band);
          }
        }
        // Side windows give the corners depth as the camera drives past.
        for(const side of [-1,1]){
          for(let j=0;j<Math.max(2,Math.floor(d/3));j++) {
            const count=Math.max(2,Math.floor(d/3)), v=(j+.5)*d/count-d/2;
            local(side*(half+.024),y,v,.11,1.23,Math.min(1.8,d/count-.5),pane);
          }
        }
      }
      if(kind===1 || kind===2) {
        const step=Math.min(w*.33,4.1), off=kind===2 ? half-step*.64 : 0;
        local(off,h+.61,.30,step+.66,.70,d*.58,body);
        local(off,h+1.20,.30,step,.62,d*.54,band);
        local(off,h+1.55,.30,step*.72,.32,d*.48,body);
        for(const s of [-1,1]) local(off+s*step*.27,(h+3.4)/2+.45,facade+.22,.19,h-2.6,.42,band);
      }
      if(kind===4){
        const [wx,wz]=pos(half-1.15,facade-1.05);
        add(round,wx,h*.49+.65,wz,2.45,h-.55,2.45,body);
        for(let n=0;n<3;n++)roundLocal(half-1.15,h-.24-n*.30,facade-1.05,2.74,.12,2.74,band);
      }
      if(label!==null){
        const pw=Math.min(w-1.2,8), py=levels? Math.min(h-1,4.88):h+.12;
        const [wx,wz]=pos(0,facade+.50);
        local(0,py,facade+.30,pw+.26,1.26,.32,band);
        panel(wx,py,wz,pw,1.05,angle,label);
      }
      if(h>7 && rand()<.68){
        local(-w*.22,h+1.0,-d*.22,w*.23,1.23,d*.20,'#98a4a3');
        for(let i=0;i<3;i++)local(-w*.22,h+1.61,-d*.22+(i-1)*.35,w*.19,.08,.13,'#657d83');
      }
    }
    // Shops face their nearest avenue. A few whole blocks have a distinctive civic landmark.
    const districts = {
      '24,-24': { face:-Math.PI/2, label:1, tint:'#ecaaa0', type:'radio', height:10.5 },
      '72,-72': { face:Math.PI, label:3, tint:'#8fcabf', type:'maps', height:8.5 },
      '-72,24': { face:-Math.PI/2, label:4, tint:'#d7ac84', type:'archive', height:9 },
      '24,72': { face:Math.PI, label:5, tint:'#bdadb9', type:'book', height:6 },
      '-24,-72': { face:-Math.PI/2, label:6, tint:'#e6b287', type:'market', height:6.4 },
      '-120,72': { face:Math.PI/2, label:7, tint:'#e7cdad', type:'museum', height:7.7 }
    };
    const greenParcels = new Set(['-72,-72','72,72','-120,-120','-24,120']);
    function flowerbed(x,z,w,d) {
      box(x,.34,z,w,.42,d,'#c0b09c'); box(x,.61,z,w-.30,.18,d-.30,'#89aa84');
      for(let i=0;i<Math.round(w*d/7);i++) {
        const px=x+range(-w*.43,w*.43),pz=z+range(-d*.4,d*.4);
        shrub(px,pz,range(.65,1.45));
        if(i%2===0)add(rocks,px,.96,pz,.34,.29,.32,pick(['#f2ba9c','#eece86','#db94a6']));
      }
    }
    function park(x,z) {
      box(x,.25,z,28,.10,28,'#a8bd8c');
      box(x,.32,z,3.1,.08,28,'#dfd1ae');
      box(x,.33,z,28,.08,3.1,'#e2d1b1');
      for(const u of [-7.6,7.6])for(const v of [-7.3,7.3]){
        flowerbed(x+u,z+v,8,6);
        if(u*v>0)palm(x+u,z+v,range(8,11));
      }
      add(round,x,.5,z,6,.65,6,'#d1c1a8');
      add(round,x,.83,z,5.38,.08,5.38,'#7bc1c0');
      add(round,x,1.28,z,.70,1,.70,'#e0c9ad');
      add(round,x,1.74,z,2.25,.25,2.25,'#edddc3');
      add(roundTop,x,2.18,z,.27,.80,.27,'#a1ddd4');
    }
    for(const cx of eastLand) for(const cz of centers) {
      const plot=cx+','+cz,special=districts[plot];
      if(greenParcels.has(plot)){park(cx,cz);continue;}
      if(special){
        const a=special.face,s=Math.sin(a),c=Math.cos(a),x=cx+s*3,z=cz+c*3;
        building(x,z,21.6,14.3,special.height,a,2,special.label,special.tint);
        const frame=(u,v)=>[x+c*u+s*v,z-s*u+c*v];
        if(special.type==='radio'){
          const [px,pz]=frame(5.4,-2.5), yh=special.height+.5;
          for(const u of [-1,1])for(const v of [-1,1])rod(px+u*.66,yh,pz+v*.66,px,yh+6.6,pz,.10,'#c77a79');
          for(let t=1;t<=4;t++)box(px,yh+1.22*t,pz,1.25-t*.2,.10,1.25-t*.2,'#e8beac');
          glow(px,yh+6.7,pz,.31,.32,.31,'#ff806d');
        }
        if(special.type==='maps'){
          const [px,pz]=frame(0,-1.5);
          add(round,px,special.height+1.03,pz,5.15,1.42,5.15,'#eee0bc');
          add(roundTop,px,special.height+1.38,pz,4.95,2.96,4.95,'#6fa8ac');
          rod(px,special.height+2.7,pz,px,special.height+3.65,pz,.09,'#eee0bc');
        }
        if(special.type==='archive'||special.type==='museum'){
          for(const u of [-7,-3.5,3.5,7]){
            const [px,pz]=frame(u,8.0);
            add(octagon,px,2.03,pz,.73,3.5,.73,'#e7d5b2');
            add(octagon,px,.43,pz,1.04,.36,1.04,'#e6d1aa');
            add(octagon,px,3.7,pz,1.08,.33,1.08,'#eeddbf');
          }
        }
        if(special.type==='book'){
          const [px,pz]=frame(-1,-1);box(px,special.height+1.31,pz,15,.25,5,'#906e76',a);
          box(px,special.height+1.56,pz,13.6,.28,4.1,'#a28286',a);
        }
        if(special.type==='market'){
          for(let j=0;j<3;j++){
            const [px,pz]=frame(j*5.2-5.2,10.4);
            box(px,1.06,pz,3.4,1.5,1.3,'#ce9879',a);
            box(px,2.91,pz,3.8,.33,2.02,pick(['#e19383','#6eb5ad','#e7bb7f']),a);
            for(const u of [-1,1]){const [qx,qz]=frame(j*5.2-5.2+u*1.52,10.4);rod(qx,.36,qz,qx,2.83,qz,.085,'#947e76');}
          }
        }
        for(const u of [-10,10]){const [px,pz]=frame(u,-8.8);palm(px,pz,range(7,10));}
        continue;
      }
      for(const dx of [-7.48,7.48])for(const dz of [-7.36,7.36]){
        const x=cx+dx, z=cz+dz;
        let a=rand()<.53?(dx>0?Math.PI/2:-Math.PI/2):(dz>0?0:Math.PI);
        // Mid-height storefronts enclose the opening street, with clear sky along its axis.
        if(cx===-24 && cz===-24 && dx>0)a=Math.PI/2;
        if(cx===24 && cz===24 && dx<0)a=-Math.PI/2;
        const w=range(10.35,13.15),d=range(9.7,12.95);
        const downtown=cx>=-72 && cx<60 && Math.abs(cz)<90;
        const h=(downtown?range(5.3,14.3):range(4.4,10.2))+(rand()<.12?range(3.5,8.7):0);
        const label=rand()<.61?pick([0,2,8,9,10,11,12,13,14,17]):null;
        building(x,z,w,d,h,a,Math.floor(rand()*5),label,pick(palace));
      }
    }
    function lamp(x,z,a){
      const dx=Math.sin(a), dz=Math.cos(a), metal='#6e8b92';
      add(octagon,x,.42,z,.64,.66,.64,'#879b9b');
      rod(x,.24,z,x,5.96,z,.17,metal);
      rod(x,5.76,z,x+dx*.40,6.23,z+dz*.40,.14,metal);
      rod(x+dx*.40,6.23,z+dz*.40,x+dx*1.24,6.23,z+dz*1.24,.12,metal);
      box(x+dx*1.32,6.16,z+dz*1.32,.42,.18,.78,'#617d87',a);
      glow(x+dx*1.32,6.045,z+dz*1.32,.32,.08,.58,'#fff0b9',a);
    }
    function bench(x,z,a){
      const ca=Math.cos(a),sa=Math.sin(a);
      const seat=(u,y,v,w,h,d,c)=>box(x+u*ca+v*sa,y,z-u*sa+v*ca,w,h,d,c,a);
      for(const u of [-.76,.76]){
        seat(u,.55,0,.13,.63,.55,'#70858a');
        seat(u,.98,-.29,.115,.84,.13,'#70858a');
      }
      for(let j=0;j<3;j++)seat(0,.91,j*.16-.17,2,.105,.105,'#c09476');
      seat(0,1.26,-.32,2,.18,.12,'#c69a78');seat(0,1.47,-.32,2,.17,.12,'#cfab8a');
    }
    function busStop(x,z,a){
      const ca=Math.cos(a),sa=Math.sin(a);
      const q=(u,v)=>[x+ca*u+sa*v,z-sa*u+ca*v];
      for(const u of [-2.2,2.2]){const [px,pz]=q(u,-.52);rod(px,.19,pz,px,3.2,pz,.12,'#637f86');}
      const [px,pz]=q(0,-.5);box(px,1.68,pz,4.55,2.45,.08,'#abc9c4',a);
      box(x,3.2,z,5.3,.22,2.2,'#eab590',a);
      const [tx,tz]=q(0,-.36);panel(tx,2.61,tz,2.55,.49,a,15);
      bench(x,z,a);
    }
    // Furniture sits behind curb lines so a player following a street has generous clearance.
    for(const v of avenues)for(const c of centers){
      if(c===120)continue;
      for(const side of [-1,1]){
        const a=side===1?-Math.PI/2:Math.PI/2;
        const px=v+side*9.28,pz=c+side*10.45;
        if(v!==96||side===-1)palm(px,pz,range(7.2,10.1));
        lamp(v+side*8.54,c-side*11.1,a);
        if((v+c+side)%3===0)bench(v+side*9.0,c+3,a);
      }
      for(const side of [-1,1]){
        const pz=v+side*9.55;
        if(rand()<.70)palm(c+side*10.6,pz,range(7.3,9.8));
      }
    }
    busStop(-9.05,-20,Math.PI/2);busStop(9,69,-Math.PI/2);busStop(-68,8.5,Math.PI);
    // Wayfinding signs and slim traffic signals on alternating corners.
    for(const x of avenues)for(const z of avenues){
      for(const s of [-1,1]){
        const px=x+s*7.72,pz=z+s*7.72;
        rod(px,.1,pz,px,3.55,pz,.115,'#6c8a8e');
        box(px,3.27,pz,.53,.94,.35,'#4e686e');
        glow(px,3.47,pz+s*.183,.21,.20,.04,s>0?'#fb9f90':'#b5e5b3');
        glow(px,3.12,pz+s*.183,.21,.20,.04,s>0?'#98ba9e':'#c9a69b');
        if(s===1)box(px+.41,2.60,pz,1.03,.23,.15,'#739e9c');
      }
    }
    // Piers and beach scenery sit beyond the final avenue.
    for(const z of [-96,0,72]) {
      const length = z===-96?42:25,x=106+length/2;
      box(x,-.16,z,length,.54,4.9,'#ac8b75');
      box(x,.135,z,length,.075,4.7,'#deba94');
      for(let u=107;u<106+length;u+=.93) box(u,.177,z,.052,.014,4.68,'#bf9b83');
      for(let u=110;u<106+length;u+=5.1)for(const s of [-1,1]){
        if(u<132)continue;
        const vz=z+s*2.22;
        add(cylinder,u,.35,vz,.35,2.52,.35,'#967964');
        box(u+1.98,1.30,vz,4.25,.13,.12,'#d0af92');
      }
    }
    for(let z=-132;z<=128;z+=11){
      if([-96,0,72,96].some(n=>Math.abs(z-n)<8))continue;
      palm(range(108.4,110.2),z,range(7.5,11.4));
      if(rand()<.66){
        const x=range(116.5,124),uz=z+range(-2,2);
        rod(x,.07,uz,x,2.96,uz,.095,'#c29b76');
        const col=pick(['#db8d83','#76b4b1','#c7a9c2','#e2b47e']);
        add(pyramid,x,2.75,uz,4.15,.9,4.15,col,Math.PI*.25);
        box(x+.32,.18,uz+.7,1.05,.11,2.5,'#efdfba',.17);
      }
    }
    const lx=118,lz=98;
    add(round,lx,.39,lz,7,.64,7,'#c9b7a1');
    const lighthouseBody=new T.CylinderGeometry(.37,.55,1,14);
    add(lighthouseBody,lx,5.35,lz,5.0,9.5,5.0,'#f1ddc0');
    add(lighthouseBody,lx,6.77,lz,4.73,2.15,4.73,'#d49085');
    add(round,lx,10.18,lz,4.65,.40,4.65,'#b98d80');
    add(octagon,lx,10.93,lz,3.32,1.35,3.32,'#66939c');
    add(roundTop,lx,10.93,lz,1.32,.94,1.32,'#ffe0a4',0,0,0,luminous);
    for(let i=0;i<8;i++){const th=i*TAU/8;rod(lx+Math.sin(th)*1.66,10.41,lz+Math.cos(th)*1.66,lx+Math.sin(th)*1.66,11.62,lz+Math.cos(th)*1.66,.10,'#6a7d87');}
    const lightRoof = new T.ConeGeometry(.5,1,12);
    add(lightRoof,lx,12.07,lz,4.34,1.29,4.34,'#c3877b');
    rod(lx,12.60,lz,lx,13.51,lz,.11,'#b68a7e');obstacle(lx,lz,4.2,4.2);
    const [archX,archZ]=[112.4,-96];
    for(const side of [-1,1])box(archX,2.6,archZ+side*2.75,.32,4.5,.33,'#ba9881');
    box(archX,4.64,archZ,.48,1.0,5.87,'#cfaa82');
    panel(archX-.255,4.64,archZ,5.43,.80,-Math.PI/2,16);

    // Distant buildings and hills continue the skyline past the playable avenues.
    const farPalette=['#9daabb','#a0b2c1','#c6afb7','#aaaac2','#9eafb9','#c2afbd'];
    function skyline(x,z,w,d,h) {
      const c=pick(farPalette);
      box(x,h/2-.3,z,w,h,d,c);box(x,h-.15,z,w*.89,1.0,d*.89,c);
      if(rand()<.52)box(x,h+.68,z,w*.55,1.8,d*.58,c);
      for(let k=0;k<3;k++)box(x+(k-1)*w*.26,h*.52,z+d*.501,.21,h*.79,.07,'#b9bdc5');
    }
    box(-34,-.48,-225,407,.32,153,'#9daeb2');
    box(-218,-.53,0,145,.30,448,'#9daeb2');
    for(let i=0;i<39;i++){
      const x=-161+i*7.6+range(-2.4,2.4);
      skyline(x,range(-193,-151),range(5,12),range(5,12),range(8,27)+(i%7===1?10:0));
    }
    for(let i=0;i<25;i++)skyline(range(-179,-151),-136+i*11.3,range(6,12),range(6,13),range(8,23));
    for(let i=0;i<25;i++){
      const x=-154+i*12.3;
      skyline(x,range(156,181),range(5,12),range(5,13),range(7,20));
    }
    for(let i=0;i<22;i++){
      const x=-285+i*27+range(-8,8),h=range(10,41),z=range(-294,-258);
      add(rocks,x,-8,z,range(51,85),2*h,range(41,72),pick(['#b0bac9','#a5b6c7','#b4b9cc']),rand()*TAU);
    }

    const color = new T.Color();
    for(const batch of groups.values()) {
      const mesh=new T.InstancedMesh(batch.geo,batch.material,batch.matrices.length);
      for(let i=0;i<batch.matrices.length;i++){
        mesh.setMatrixAt(i,batch.matrices[i]);
        mesh.setColorAt(i,color.set(batch.colors[i]));
      }
      mesh.instanceMatrix.needsUpdate=true;
      mesh.instanceColor.needsUpdate=true;
      mesh.computeBoundingSphere();city.add(mesh);
    }
    if(typeof document!=='undefined') drawSignAtlas(T,city,signage);
    return city;
  }

  function drawSignAtlas(T,city,panels) {
    const canvas=document.createElement('canvas'), cols=4, cellW=256, cellH=88;
    canvas.width=cellW*cols;canvas.height=512;
    const ctx=canvas.getContext('2d');
    if(!ctx)return;
    const tones=['#44686b','#64768b','#99767f','#457c7e','#7e706c','#7d6b81','#9f7568'];
    for(let i=0;i<signNames.length;i++){
      const x=(i%cols)*cellW,y=Math.floor(i/cols)*cellH;
      ctx.fillStyle=tones[i%tones.length];ctx.fillRect(x,y,cellW,cellH);
      ctx.strokeStyle='#e2c1a3';ctx.lineWidth=2;ctx.strokeRect(x+3,y+4,cellW-6,cellH-8);
      ctx.textAlign='center';ctx.fillStyle='#fff0cf';
      ctx.font='bold '+(signNames[i][0].length>9?'26':'32')+'px Georgia, serif';
      ctx.fillText(signNames[i][0],x+cellW/2,y+41,cellW-20);
      ctx.font='18px "Microsoft YaHei", "Noto Sans CJK SC", sans-serif';ctx.fillText(signNames[i][1],x+cellW/2,y+68,cellW-16);
    }
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace; texture.anisotropy=4;
    const pos=[],uv=[],indices=[];
    panels.forEach((s,i)=>{
      const dx=Math.cos(s.angle)*s.w/2,dz=-Math.sin(s.angle)*s.w/2;
      pos.push(s.x-dx,s.y-s.h/2,s.z-dz,s.x+dx,s.y-s.h/2,s.z+dz,s.x+dx,s.y+s.h/2,s.z+dz,s.x-dx,s.y+s.h/2,s.z-dz);
      const u0=((s.index%cols)*cellW+1)/canvas.width,u1=((s.index%cols+1)*cellW-1)/canvas.width;
      const v1=1-(Math.floor(s.index/cols)*cellH+1)/canvas.height,v0=1-((Math.floor(s.index/cols)+1)*cellH-1)/canvas.height;
      uv.push(u0,v0,u1,v0,u1,v1,u0,v1);const j=i*4;indices.push(j,j+1,j+2,j,j+2,j+3);
    });
    const geo=new T.BufferGeometry();
    geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
    const labels=new T.Mesh(geo,new T.MeshBasicMaterial({map:texture}));labels.name='Street and shop signs';city.add(labels);
  }
  window.CityWorld = {build, roads, places, obstacles, parked, bounds};
})();
