/* Third-person city exploration. Positions are in metres, north is -Z. */
(() => {
  'use strict';

  const LIMIT = 132;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const distance = (x, z, a, b) => Math.hypot(x - a, z - b);
  const wrap = r => Math.atan2(Math.sin(r), Math.cos(r));
  const follow = (a, b, responsiveness, dt) => a + (b - a) * (1 - Math.exp(-responsiveness * dt));
  const keyMap = {KeyW:'forward',ArrowUp:'forward',KeyS:'back',ArrowDown:'back',
    KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',ShiftLeft:'sprint',ShiftRight:'sprint'};
  const overlaps = (x, z, r, b) => x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r;

  function create(container, hooks = {}) {
    const T = window.THREE, world = window.CityWorld;
    if (!container || !T || typeof world?.build !== 'function') throw Error('3D 城市场景未加载');
    const renderer = new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;outline:0;touch-action:none;cursor:grab;';
    canvas.setAttribute('aria-label','三维城市街区。方向键移动，E 互动，拖动画面环视，轻点让镜头回正。');
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
    else if (T.sRGBEncoding) renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(55,1,0.15,470);
    scene.background = new T.Color(0x9cd8e4);
    scene.fog = new T.FogExp2(0xbadbdc, .0040);
    const soft = new T.HemisphereLight(0xfff4d8,0x8ea5bd,1.5);
    const sun = new T.DirectionalLight(0xffedd1,1.45);
    sun.position.set(-62,96,45); scene.add(soft,sun);
    const rim = new T.DirectionalLight(0xb4e8ff,.35);
    rim.position.set(55,28,-80); scene.add(rim);
    const sky = new T.Mesh(new T.SphereGeometry(390,20,12),new T.ShaderMaterial({
      side:T.BackSide,depthWrite:false,fog:false,
      uniforms:{top:{value:new T.Color(0x74c7d9)},bottom:{value:new T.Color(0xffc9b0)}},
      vertexShader:'varying vec3 dir; void main(){dir=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:[
        'varying vec3 dir; uniform vec3 top; uniform vec3 bottom;',
        'void main() {',
        '  vec3 ray=normalize(dir);',
        '  vec3 sky=mix(bottom,top,smoothstep(-0.06,0.54,ray.y));',
        '  float sun=dot(ray,normalize(vec3(0.22,0.193,-1.0)));',
        '  sky=mix(sky,vec3(1.0,0.67,0.39),0.46*smoothstep(0.951,0.9996,sun));',
        '  sky=mix(sky,vec3(1.0,0.91,0.65),smoothstep(0.9986,0.9988,sun));',
        '  gl_FragColor=vec4(sky,1.0);',
        '#include <tonemapping_fragment>',
        T.ShaderChunk.colorspace_fragment?'#include <colorspace_fragment>':'#include <encodings_fragment>',
        '}'
      ].join('\n')
    }));
    sky.frustumCulled=false; sky.renderOrder=-50; scene.add(sky);

    let layout;
    try { layout = world.build(T,scene); }
    catch (error) { renderer.dispose(); throw error; }
    const obstacles = layout?.obstacles || world.obstacles || [];
    const group = parent => {const g=new T.Group(); parent.add(g);return g;};
    const materials = new Map(), geometries = new Map();
    function material(color) {
      if (typeof color === 'object') return color;
      if (!materials.has(color)) materials.set(color,new T.MeshStandardMaterial({color,flatShading:true,roughness:.76}));
      return materials.get(color);
    }
    function geometry(key, build) {
      if (!geometries.has(key)) geometries.set(key,build());
      return geometries.get(key);
    }
    const cube=geometry('box',()=>new T.BoxGeometry(1,1,1));
    const gem=geometry('gem',()=>new T.OctahedronGeometry(1));
    const globe=geometry('head',()=>new T.SphereGeometry(1,9,6));
    const tire=geometry('tire',()=>new T.CylinderGeometry(1,1,1,12));
    function mesh(parent, shape, color, x,y,z,sx,sy,sz) {
      const m=new T.Mesh(shape,material(color));
      m.position.set(x,y,z);m.scale.set(sx,sy,sz);parent.add(m);return m;
    }
    const box=(g,c,x,y,z,w,h,d)=>mesh(g,cube,c,x,y,z,w,h,d);
    const oval=(g,c,x,y,z,w,h,d)=>mesh(g,globe,c,x,y,z,w,h,d);
    const shadowGeometry=geometry('shadow',()=>new T.CircleGeometry(1,16));
    const shadowMaterial=new T.MeshBasicMaterial({color:0x172b43,transparent:true,opacity:.2,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    function contactShadow(g,w,l) {
      const shadow=mesh(g,shadowGeometry,shadowMaterial,0,.065,0,w,l,1);
      shadow.rotation.x=-Math.PI/2;return shadow;
    }
    function human(parent,coat,cap,skin,backpack=false) {
      const holder=group(parent), body=group(holder);
      contactShadow(holder,.50,.31);
      const limbs=[];
      for (const s of [-1,1]) {
        const leg=group(body);leg.position.set(s*.145,.85,.015);
        box(leg,0x30405a,0,-.32,0,.21,.61,.24);
        box(leg,0xf5e4bc,0,-.65,-.05,.24,.13,.34);limbs.push(leg);
      }
      box(body,coat,0,1.1,0,.59,.52,.38);
      box(body,0xf3e9cd,0,1.09,-.202,.047,.46,.025);
      box(body,0xeeb35c,0,1.32,-.22,.32,.11,.07);
      for (const s of [-1,1]) {
        const arm=group(body);arm.position.set(s*.36,1.27,0);
        box(arm,coat,0,-.13,0,.18,.34,.24);
        box(arm,skin,0,-.33,0,.15,.17,.17);limbs.push(arm);
      }
      oval(body,skin,0,1.61,-.012,.266,.278,.247);
      oval(body,0x342d35,0,1.67,.059,.266,.255,.229);
      box(body,skin,0,1.58,-.142,.36,.27,.16);
      for(const s of [-1,1])box(body,0x313038,s*.091,1.60,-.235,.046,.035,.024);
      oval(body,cap,0,1.80,0,.29,.178,.254);
      box(body,cap,0,1.76,-.207,.38,.065,.18);
      if(backpack) {
        box(body,0x30586a,0,1.06,.237,.43,.43,.18);
        box(body,0xe9ac58,0,1.20,.337,.41,.13,.05);
        for(const s of [-1,1])box(body,0x3f5963,s*.20,1.19,-.208,.05,.31,.031);
      }
      function animate(phase, strength) {
        body.position.y=.04+Math.abs(Math.sin(phase))*.04*strength;
        limbs.forEach((limb,i)=>{limb.rotation.x=Math.sin(phase+(i===0||i===3?0:Math.PI))*.62*strength;});
      }
      return {holder,animate};
    }
    const glass=new T.MeshStandardMaterial({color:0xa2ebe7,transparent:true,opacity:.52,roughness:.13,metalness:.15,side:T.DoubleSide});
    function automobile(parent,color,convertible=false) {
      const root=group(parent),paint=new T.MeshStandardMaterial({color,metalness:.23,roughness:.37,flatShading:true});
      const shell=group(root), wheels=[];
      contactShadow(root,1.28,2.14);
      box(shell,0x243641,0,.38,0,1.80,.23,3.75);
      box(shell,paint,0,.69,.01,2.03,.48,3.98);
      box(shell,paint,0,.935,-1.19,1.92,.15,1.28);
      box(shell,paint,0,.935,1.34,1.94,.19,1.22);
      box(shell,0x2f3844,0,.93,.03,1.68,.10,1.80);
      box(shell,0xc6bfb4,0,.50,-2.02,1.97,.13,.12);
      box(shell,0x273542,0,.64,-2.042,.84,.14,.045);
      box(shell,0xfce2a0,0,.70,2.025,.40,.15,.04);
      for(const sign of [-1,1]) {
        box(shell,0xffe6b9,sign*.72,.77,-2.013,.39,.15,.058);
        box(shell,0xe65547,sign*.73,.74,2.016,.38,.12,.052);
        box(shell,paint,sign*.95,1.00,.00,.14,.17,1.78);
        box(shell,0xdce1d0,sign*1.017,.88,.19,.027,.045,.22);
        box(shell,paint,sign*1.07,1.105,-.62,.20,.12,.24);
        for (const z of [-1.28,1.28]) {
          const pivot=group(shell);pivot.position.set(sign*.995,.41,z);
          const wheel=mesh(pivot,tire,0x202b36,0,0,0,.412,.235,.412);
          wheel.rotation.z=Math.PI/2;
          const rim=mesh(pivot,tire,0xa8aaae,sign*.128,0,0,.237,.038,.237);
          rim.rotation.z=Math.PI/2;
          const hub=mesh(pivot,tire,0x394d59,sign*.155,0,0,.116,.022,.116);
          hub.rotation.z=Math.PI/2;wheels.push(pivot);
        }
      }
      const windshield=box(shell,glass,0,1.21,-.69,1.65,.62,.045);windshield.rotation.x=.35;
      for(const s of [-1,1]) {
        const post=box(shell,0xdad8bb,s*.835,1.21,-.69,.059,.62,.062);post.rotation.x=.35;
        box(shell,0xa86745,s*.43,1.105,.44,.62,.53,.20);
        box(shell,0xd79964,s*.43,1.35,.45,.38,.26,.19);
      }
      box(shell,0xded9b8,0,1.49,-.59,1.70,.052,.060);
      if(!convertible) {
        box(shell,glass,0,1.23,.01,1.58,.55,1.43);
        box(shell,paint,0,1.53,.02,1.64,.12,1.42);
        box(shell,paint,0,1.20,.73,1.72,.56,.18);
      } else {
        for(const s of [-1,1])box(shell,0xffe9c7,s*.13,1.02,-1.19,.10,.018,1.23);
        const steer=mesh(shell,geometry('steering',()=>new T.TorusGeometry(.175,.032,4,10)),0x293540,-.42,1.13,-.26,1,1,1);
        steer.rotation.x=-.45;
      }
      return {root,paint,wheels};
    }

    const hero=human(scene,0x1e968e,0xe8a83b,0xcf966c,true);
    const car=automobile(scene,0xe07850,true);
    const driver=human(car.root,0x1e968e,0xe8a83b,0xcf966c,false);
    driver.holder.scale.setScalar(.64);driver.holder.position.set(-.40,.29,.23);driver.holder.visible=false;
    let x=1.5,z=2,heading=0,carX=4,carZ=0,carHeading=.14,velocity=0,driving=false;
    car.root.position.set(carX,0,carZ);car.root.rotation.y=-carHeading;

    // Traffic stays on closed rectangular routes, keeps its lane and yields nearby.
    const traffic=[],walkers=[];
    function loop(x0,z0,x1,z1,offset,clockwise) {
      const pad=clockwise ? offset : -offset;
      const corners=[[x0+pad,z0+pad],[x1-pad,z0+pad],[x1-pad,z1-pad],[x0+pad,z1-pad]];
      return clockwise ? corners : [corners[0],corners[3],corners[2],corners[1]];
    }
    function addActor(model,path,segment,t,speed,isPedestrian) {
      const a=path[segment],b=path[(segment+1)%path.length];
      const actor={model,path,segment,t,speed,phase:segment+2*t,isPedestrian,x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t};
      model.holder.position.set(actor.x,0,actor.z);
      model.holder.rotation.y=-Math.atan2(b[0]-a[0],a[1]-b[1]);
      (isPedestrian?walkers:traffic).push(actor);
    }
    [[-96,-96,0,0,.32,0,0x447da1], [0,-96,96,0,.64,1,0xe9b056],
     [-96,0,0,96,.58,3,0x749b82],[0,0,96,96,.75,0,0x667eae],[-48,-48,48,48,.56,0,0xb86d5c]].forEach(([a,b,c,d,t,i,col],idx)=>{
      const vehicle=automobile(scene,col);
      addActor({holder:vehicle.root},loop(a,b,c,d,2.35,idx%2===0),i,t,5+idx*.46,false);
    });
    [[-48,-48,0,0],[0,-48,48,0],[-48,0,0,48],[0,0,48,48],[-96,-96,-48,-48],[48,-48,96,0]].forEach(([a,b,c,d],i)=>{
      const person=human(scene,[0x537ea2,0xd28665,0x739375][i%3],[0xb48958,0x855a45,0x4a5a68][i%3],0xbf8a68);
      addActor(person,loop(a,b,c,d,7.8,true),i%4,.32+i*.08,1.0+i*.07,true);
    });
    const contacts=[
      [6,-24,0xef8063,0x50777f,2.7], [72,-90,0x24939b,0xf3d39c,2.95],
      [-90,24,0xb1864d,0x6b615b,-1.7], [24,54,0x9476ab,0xd7ba9e,-.9]
    ].map(([cx,cz,coat,cap,facing])=>{
      const npc=human(scene,coat,cap,0xc19476);
      npc.holder.position.set(cx,0,cz);npc.holder.rotation.y=facing;
      npc.x=cx;npc.z=cz;npc.isPedestrian=true;
      return npc;
    });

    // Batch the opaque trim of each rigid part into a single draw call. Limbs,
    // steering wheels, glass and the repaintable body keep their own transforms.
    const vertexFinish=new T.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:.76});
    function batchRigid(anchor,recursive,keepPaint) {
      anchor.updateWorldMatrix(true,true);
      const objects=[];
      const select=obj=>{
        if(obj.isMesh && obj.material?.isMeshStandardMaterial && !obj.material.transparent &&
           obj.material!==keepPaint && !obj.material.vertexColors)objects.push(obj);
      };
      if(recursive)anchor.traverse(select);else anchor.children.forEach(select);
      if(objects.length<2)return;
      const inverse=anchor.matrixWorld.clone().invert(),transform=new T.Matrix4();
      const xyz=[],normals=[],colors=[];
      for(const obj of objects) {
        const g=obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
        g.applyMatrix4(transform.multiplyMatrices(inverse,obj.matrixWorld));
        const p=g.getAttribute('position'),n=g.getAttribute('normal'),c=obj.material.color;
        for(let j=0;j<p.count;j++){
          xyz.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j),n.getY(j),n.getZ(j));
          colors.push(c.r,c.g,c.b);
        }
        g.dispose();obj.parent.remove(obj);
      }
      const bundled=new T.BufferGeometry();
      bundled.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
      bundled.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
      bundled.setAttribute('color',new T.Float32BufferAttribute(colors,3));
      bundled.computeBoundingSphere();anchor.add(new T.Mesh(bundled,vertexFinish));
    }
    const groupsOf=parent=>{const nodes=[];parent.traverse(o=>{if(o.isGroup)nodes.push(o);});return nodes;};
    // Traffic and greeters are rigid models, walking people animate their limbs.
    for(const a of traffic)batchRigid(a.model.holder,true);
    for(const npc of contacts)batchRigid(npc.holder,true);
    for(const node of groupsOf(car.root))batchRigid(node,false,car.paint);
    for(const actor of [hero,...walkers.map(a=>a.model)])for(const node of groupsOf(actor.holder))batchRigid(node,false);
    const beacons=new Map();
    const innerRing=geometry('beaconRing',()=>new T.RingGeometry(1.58,1.79,36));
    const outerRing=geometry('outerRing',()=>new T.RingGeometry(1.97,2.05,36));
    const columnShape=geometry('column',()=>new T.CylinderGeometry(1.05,1.65,3.9,16,1,true));

    function signLabel(label,color) {
      const el=document.createElement('canvas'),pen=el.getContext('2d');
      if(!pen)return null;
      const size=32, title=[...label].slice(0,22).join('');
      pen.font='700 '+size+'px system-ui, sans-serif';
      const textWidth=Math.ceil(pen.measureText(title).width);
      el.width=Math.max(100,textWidth+64);el.height=64;
      pen.fillStyle='#142d37';pen.fillRect(0,0,el.width,el.height);
      pen.strokeStyle=new T.Color(color).getStyle();pen.lineWidth=5;
      pen.strokeRect(2.5,2.5,el.width-5,el.height-5);
      pen.fillStyle='#fff9df';pen.font='700 '+size+'px system-ui, sans-serif';
      pen.textAlign='center';pen.textBaseline='middle';pen.fillText(title,el.width/2,el.height/2+1);
      const texture=new T.CanvasTexture(el);
      if('colorSpace' in texture)texture.colorSpace=T.SRGBColorSpace;
      else if(T.sRGBEncoding)texture.encoding=T.sRGBEncoding;
      texture.minFilter=T.LinearFilter;texture.generateMipmaps=false;
      const sign=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true}));
      sign.scale.set(el.width/el.height*1.11,1.11,1);sign.position.y=4.55;
      return sign;
    }

    function beaconFor(point,key) {
      const hue=point.color||'#ffc954',label=String(point.label||point.name||'任务地点');
      const base=group(scene);base.position.set(point.x,0,point.z);
      const rimMat=new T.MeshBasicMaterial({color:hue,transparent:true,opacity:.87,depthWrite:false,side:T.DoubleSide});
      const ring=mesh(base,innerRing,rimMat,0,.145,0,1,1,1);
      ring.rotation.x=-Math.PI/2;
      const outer=mesh(base,outerRing,rimMat,0,.15,0,1,1,1);outer.rotation.x=-Math.PI/2;
      const beamMat=new T.MeshBasicMaterial({color:hue,transparent:true,opacity:.09,depthWrite:false,side:T.DoubleSide});
      mesh(base,columnShape,beamMat,0,2.12,0,1,1,1);
      const gemMat=new T.MeshStandardMaterial({color:hue,emissive:hue,emissiveIntensity:.38,flatShading:true});
      const diamond=mesh(base,gem,gemMat,0,3.4,0,.39,.55,.39);
      const sign=signLabel(label,hue);if(sign)base.add(sign);
      return {key,base,outer,rimMat,gemMat,beamMat,diamond,sign,x:point.x,z:point.z,hue,label};
    }

    function removeBeacon(beacon) {
      scene.remove(beacon.base);
      beacon.rimMat.dispose();beacon.gemMat.dispose();beacon.beamMat.dispose();
      beacon.sign?.material.map.dispose();beacon.sign?.material.dispose();
    }
    function setTargets(points) {
      const keep=new Set();
      for(const p of Array.isArray(points)?points:[]) {
        if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;
        const key=String(p.id??(p.x+','+p.z)),old=beacons.get(key);
        keep.add(key);
        if(old && old.x===p.x&&old.z===p.z&&old.label===String(p.label||p.name||'任务地点')&&old.hue===(p.color||'#ffc954'))continue;
        if(old)removeBeacon(old);
        beacons.set(key,beaconFor(p,key));
      }
      for(const [key,b] of beacons)if(!keep.has(key)){removeBeacon(b);beacons.delete(key);}
    }
    const keyboard=new Set(),touch=new Set();
    let running=true,destroyed=false,contextLost=false,request=0,last=0,elapsed=0,stride=0,lookHeading=0;
    let drag=null,orbitYaw=0,orbitPitch=0,releaseTime=0,recentering=false;
    const focusPoint=new T.Vector3(0,1,-2),cameraGoal=new T.Vector3(),focusGoal=new T.Vector3();
    const blocked=(px,pz,r)=>Math.abs(px)>LIMIT-r || Math.abs(pz)>LIMIT-r || obstacles.some(b=>overlaps(px,pz,r,b));
    function objectBlocked(px,pz,angle,isCar) {
      if (!isCar) return blocked(px,pz,.29);
      const vx=Math.sin(angle)*1.32,vz=-Math.cos(angle)*1.32;
      return blocked(px,pz,.99)||blocked(px+vx,pz+vz,.9)||blocked(px-vx,pz-vz,.9);
    }
    function move(dx,dz,isCar) {
      const len=Math.hypot(dx,dz);
      if(len<.0001)return;
      // A friendly buffer prevents the player and passers-by moving through each other.
      for(const a of [...traffic,...walkers,...contacts]) {
        const gap=(isCar?1.22:.34)+(a.isPedestrian?.38:1.40);
        if(distance(x+dx,z+dz,a.x,a.z)<gap && distance(x+dx,z+dz,a.x,a.z)<distance(x,z,a.x,a.z)) {
          if(isCar)velocity=0;
          return;
        }
      }
      if(!isCar && distance(x+dx,z+dz,carX,carZ)<1.33 && distance(x+dx,z+dz,carX,carZ)<distance(x,z,carX,carZ))return;
      if (!objectBlocked(x+dx,z+dz,heading,isCar)) { x+=dx;z+=dz;return; }
      if (isCar) {velocity=0;return;}
      if (!objectBlocked(x+dx,z,heading,false)) x+=dx;
      if (!objectBlocked(x,z+dz,heading,false)) z+=dz;
    }
    function canEnter(){return distance(x,z,carX,carZ)<=3.55;}
    function interactVehicle() {
      if (!running||destroyed||contextLost)return false;
      if (!driving) {
        if(!canEnter())return false;
        driving=true;x=carX;z=carZ;heading=carHeading;velocity=0;
        hero.holder.visible=false;driver.holder.visible=true;
      } else {
        const cos=Math.cos(heading),sin=Math.sin(heading);
        const exits=[[-1.85,0],[1.85,0],[-2.3,.9],[2.3,.9],[0,3.1],[0,-3.1],[-3.6,0],[3.6,0]];
        const spot=exits.map(([side,along])=>[x+cos*side+sin*along,z+sin*side-cos*along])
          .find(([ex,ez])=>!blocked(ex,ez,.35)&&![...walkers,...traffic,...contacts].some(a=>distance(ex,ez,a.x,a.z)<(a.isPedestrian?.73:1.9)));
        if(!spot)return false;
        driving=false;velocity=0;carX=x;carZ=z;carHeading=heading;
        [x,z]=spot;hero.holder.visible=true;driver.holder.visible=false;
      }
      sync();report();return true;
    }
    function setTarget(point) {setTargets(point?[point]:[]);}
    function setInput(key,on) {
      if(!['forward','back','left','right','sprint'].includes(key))return;
      if(on && running && !contextLost)touch.add(key);else touch.delete(key);
    }
    const held=k=>touch.has(k)||[...keyboard].some(code=>keyMap[code]===k);
    function keyDown(e) {
      if(!running||destroyed||contextLost||e.defaultPrevented||e.ctrlKey||e.metaKey||e.altKey)return;
      const target=e.target;
      if(target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target?.tagName))return;
      if(e.code==='KeyE'||(e.code==='Enter'&& !target?.closest?.('button,a,[role=button]'))) {
        e.preventDefault();if(!e.repeat)hooks.onInteract?.();return;
      }
      if(keyMap[e.code]){e.preventDefault();keyboard.add(e.code);}
    }
    const keyUp=e=>{keyboard.delete(e.code);};
    function clearDrag() {
      if(!drag)return;
      const id=drag.id;
      drag=null;
      if(canvas.hasPointerCapture?.(id))canvas.releasePointerCapture(id);
      canvas.style.cursor='grab';
    }
    function resetInput(){keyboard.clear();touch.clear();clearDrag();}
    function beginLook(event) {
      if(!running || destroyed || contextLost || drag || event.button!==0)return;
      drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,
        x:event.clientX,y:event.clientY,time:event.timeStamp,moved:false};
      recentering=false;
      canvas.setPointerCapture?.(event.pointerId);
      canvas.style.cursor='grabbing';
    }
    function updateLook(event) {
      if(!drag || drag.id!==event.pointerId)return;
      const x=event.clientX,y=event.clientY;
      if(!drag.moved && Math.hypot(x-drag.startX,y-drag.startY)<5)return;
      drag.moved=true;
      const gain=clamp(5.4/Math.max(1,container.clientWidth),.004,.010);
      orbitYaw=wrap(orbitYaw-(x-drag.x)*gain);
      orbitPitch=clamp(orbitPitch+(y-drag.y)*gain*.70,-.31,.67);
      drag.x=x;drag.y=y;
    }
    function endLook(event) {
      if(!drag || drag.id!==event.pointerId)return;
      if(event.type==='pointerup') {
        updateLook(event);
        recentering=!drag.moved && event.timeStamp-drag.time<360;
      }
      clearDrag();releaseTime=elapsed;
    }
    function advanceActors(dt) {
      const all=[...traffic,...walkers];
      for(const a of all) {
        let q=a.path[a.segment],r=a.path[(a.segment+1)%a.path.length];
        const len=distance(q[0],q[1],r[0],r[1]),dx=(r[0]-q[0])/len,dz=(r[1]-q[1])/len;
        const ahead=(px,pz,radius)=>{const vx=px-a.x,vz=pz-a.z,dot=vx*dx+vz*dz;
          return dot>=-.15 && dot<radius && Math.abs(vx*dz-vz*dx)<(a.isPedestrian?1.07:2.20);};
        const slow=ahead(x,z,a.isPedestrian?1.65:5.2)||(!driving&&ahead(carX,carZ,4.5))
          || all.some(other=>other!==a && ahead(other.x,other.z,a.isPedestrian?1.48:4.5));
        if(slow) {if(a.isPedestrian)a.model.animate(a.phase,0);continue;}
        a.t+=dt*a.speed/len;
        if(a.t>=1) {a.t=0;a.segment=(a.segment+1)%a.path.length;q=a.path[a.segment];r=a.path[(a.segment+1)%a.path.length];}
        a.x=q[0]+(r[0]-q[0])*a.t;a.z=q[1]+(r[1]-q[1])*a.t;
        a.model.holder.position.set(a.x,0,a.z);
        const h=-Math.atan2(r[0]-q[0],q[1]-r[1]);
        a.model.holder.rotation.y+=wrap(h-a.model.holder.rotation.y)*(1-Math.exp(-10*dt));
        if(a.isPedestrian){a.phase+=dt*5.2;a.model.animate(a.phase,.8);}
      }
    }
    function sync() {
      if(driving) {
        carX=x;carZ=z;carHeading=heading;
        car.root.position.set(x,0,z);car.root.rotation.y=-heading;
      } else {
        hero.holder.position.set(x,0,z);hero.holder.rotation.y=-heading;
      }
    }
    function report() {
      hooks.onFrame?.({x,z,heading,driving,speed:Math.abs(velocity)*3.6,nearCar:!driving&&canEnter(),carX,carZ});
    }
    function resize() {
      if(destroyed || contextLost)return;
      const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
      renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
    }
    const observer=typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    function aim(dt,instant=false) {
      lookHeading+=wrap(heading-lookHeading)*(instant?1:1-Math.exp(-5.7*dt));
      if(!drag && (recentering || (Math.abs(velocity)>.48 && elapsed-releaseTime>.55))) {
        orbitYaw=follow(orbitYaw,0,3.2,dt);
        orbitPitch=follow(orbitPitch,0,3.2,dt);
        if(Math.abs(orbitYaw)+Math.abs(orbitPitch)<.001) {
          orbitYaw=0;orbitPitch=0;recentering=false;
        }
      }
      const sx=Math.sin(lookHeading+orbitYaw),sz=-Math.cos(lookHeading+orbitYaw);
      const length=driving?10.3:7.25, height=driving?5.65:4.1, pivot=driving?1.08:1.0;
      const radius=Math.hypot(length,height-pivot), pitch=Math.atan2(height-pivot,length)+orbitPitch;
      const len=radius*Math.cos(pitch),high=pivot+radius*Math.sin(pitch);
      let back=len;
      // Pull the follow camera forward when backing the character up to a wall.
      for(let d=.8;d<len;d+=.48) {
        if(obstacles.some(b=>overlaps(x-sx*d,z-sz*d,.17,b))){back=Math.max(1.05,d-.48);break;}
      }
      cameraGoal.set(x-sx*back,high+(1-back/len)*1.8,z-sz*back);
      focusGoal.set(x+sx*(driving?3.6:1.6),driving?1.08:1.0,z+sz*(driving?3.6:1.6));
      const n=instant?1:1-Math.exp(-9*dt);
      camera.position.lerp(cameraGoal,n);focusPoint.lerp(focusGoal,n);camera.lookAt(focusPoint);
      sky.position.copy(camera.position);
    }
    function queueFrame() {
      if(running&&!destroyed&&!contextLost&&!request)request=requestAnimationFrame(tick);
    }
    function stopFrames() {
      if(request)cancelAnimationFrame(request);
      request=0;last=0;
    }
    function loseContext(event) {
      event.preventDefault();
      if(destroyed||contextLost)return;
      contextLost=true;stopFrames();resetInput();
      hooks.onContextLost?.();
    }
    function restoreContext() {
      if(destroyed||!contextLost)return;
      contextLost=false;resize();queueFrame();
    }
    const canvasEvents=[
      ['pointerdown',beginLook],['pointermove',updateLook],['pointerup',endLook],
      ['pointercancel',endLook],['lostpointercapture',endLook],
      ['webglcontextlost',loseContext],['webglcontextrestored',restoreContext]
    ];
    function tick(time) {
      request=0;if(!running||destroyed||contextLost)return;
      const dt=last?clamp((time-last)/1000,0,.050):1/60;last=time;elapsed+=dt;
      const steer=Number(held('right'))-Number(held('left'));
      const f=held('forward'),b=held('back');
      if(driving) {
        if(f&&!b)velocity=clamp(velocity+(velocity<-.1?16:8.0)*dt,-4.3,16);
        else if(b&&!f)velocity=clamp(velocity-(velocity>.1?17:4.5)*dt,-4.3,16);
        else velocity=Math.sign(velocity)*Math.max(0,Math.abs(velocity)-dt*(f&&b?16:2.8));
        const nextHeading=wrap(heading+steer*Math.sign(velocity)*Math.min(1,Math.abs(velocity)/2.1)*(1.28-Math.min(Math.abs(velocity),16)*.033)*dt);
        if(!objectBlocked(x,z,nextHeading,true))heading=nextHeading;
        car.root.rotation.z=follow(car.root.rotation.z,-steer*Math.min(1,Math.abs(velocity)/9)*.033,5,dt);
        for(const wheel of car.wheels)wheel.rotation.x-=velocity*dt/.42;
      } else {
        heading=wrap(heading+steer*2.25*dt);
        const desired=(Number(f)-Number(b))*(held('sprint')?6.2:3.75)*(b?.7:1);
        velocity=follow(velocity,desired,12,dt);
        if(Math.abs(velocity)<.025)velocity=0;
        stride+=dt*Math.abs(velocity)*2.19;hero.animate(stride,Math.min(1,Math.abs(velocity)/3.4));
      }
      move(Math.sin(heading)*velocity*dt,-Math.cos(heading)*velocity*dt,driving);
      sync();advanceActors(dt);aim(dt);
      for(const target of beacons.values()) {
        target.diamond.rotation.y+=dt*.84;
        target.diamond.position.y=3.33+Math.sin(elapsed*2.6)*.14;
        target.outer.scale.setScalar(1+.065*Math.sin(elapsed*2.6));
        target.rimMat.opacity=.80+.15*Math.sin(elapsed*2.6);
        // Scale labels gently with distance, like roadside signs, to help find a contact.
        if(target.sign) {
          const scale=clamp(distance(x,z,target.x,target.z)/31,1,2.7);
          target.sign.scale.y=1.11*scale;
          target.sign.scale.x=target.sign.scale.y*target.sign.material.map.image.width/64;
        }
      }
      renderer.render(scene,camera);
      if(!destroyed&&!contextLost)report();
      queueFrame();
    }
    function pause(value) {
      if(destroyed)return;
      running=!value;resetInput();last=0;
      if(!running)stopFrames();else queueFrame();
    }
    function dispose() {
      if(destroyed)return;destroyed=true;
      stopFrames();
      resetInput();observer?.disconnect();
      canvasEvents.forEach(([name,listener])=>canvas.removeEventListener(name,listener));
      window.removeEventListener('resize',resize);window.removeEventListener('keydown',keyDown);
      window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',resetInput);
      setTargets([]);
      const geo=new Set(),mats=new Set(),textures=new Set();
      scene.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});
      mats.forEach(m=>{Object.values(m).forEach(v=>{if(v?.isTexture)textures.add(v);});m.dispose();});
      geo.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());renderer.dispose();canvas.remove();
    }
    container.appendChild(canvas);resize();observer?.observe(container);
    canvasEvents.forEach(([name,listener])=>canvas.addEventListener(name,listener));
    window.addEventListener('resize',resize);window.addEventListener('keydown',keyDown);
    window.addEventListener('keyup',keyUp);window.addEventListener('blur',resetInput);
    sync();aim(0,true);queueFrame();
    return {setInput,interactVehicle,setTarget,setTargets,setDrivingColor(hex){try{car.paint.color.set(hex);}catch{}},pause,dispose};
  }
  window.CityEngine = Object.freeze({create});
})();
