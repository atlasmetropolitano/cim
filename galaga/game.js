/* Galaga Web ULTRA — HTML5 Canvas + JS puro
 * Mejoras:
 * - Selector de dificultad persistente.
 * - Sprites opcionales (auto-fallback a vectorial).
 * - Coreografías JSON: sine swarm, figura-8, espiral in/out.
 * - Partículas con blending additive.
 * - Dives Bezier restaurados (con regreso a formación).
 * - Leaderboard por nombre, mobile, pooling, deltaTime.
 */

const W=480, H=640, TWO_PI=Math.PI*2;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rand=(a,b)=>a+Math.random()*(b-a);
const chance=p=>Math.random()<p;
const nowMs=()=>performance.now();

const COLORS={
  normal:{player:"#55ccff",enemyBasic:"#ff5577",enemyFast:"#ffd166",enemyTank:"#9b59b6",boss:"#ff914d",
          bulletPlayer:"#aaf",bulletEnemy:"#ff7a7a",powerShield:"#5af0c8",powerDouble:"#7fa6ff",powerRapid:"#f7df1e",
          hudText:"#cfe7ff",hudDim:"#88a1c7"},
  daltonico:{player:"#00ffff",enemyBasic:"#ff00ff",enemyFast:"#ffff00",enemyTank:"#00ff00",boss:"#ff8800",
             bulletPlayer:"#00ffff",bulletEnemy:"#ff00ff",powerShield:"#00ffbf",powerDouble:"#00a6ff",powerRapid:"#ffe600",
             hudText:"#ffffff",hudDim:"#a0a0a0"}
};
const STATE={MENU:0,PLAYING:1,PAUSED:2,GAME_OVER:3};
const DIFFS={
  easy:{ name:"easy", enemySpeed:0.92, enemyFire:0.9, bossHp:0.9, playerLives:4, playerROF:0.95, scoreMul:0.9 },
  normal:{ name:"normal", enemySpeed:1.0, enemyFire:1.0, bossHp:1.0, playerLives:3, playerROF:1.0, scoreMul:1.0 },
  hard:{ name:"hard", enemySpeed:1.18, enemyFire:1.2, bossHp:1.25, playerLives:3, playerROF:0.95, scoreMul:1.15 }
};

/* ---------- Audio ---------- */
class AudioManager{
  constructor(){ this.ctx=null; this.muted=false; this.master=0.7; }
  ensureCtx(){ if(!this.ctx){ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); } }
  toggleMute(){ this.muted=!this.muted; }
  beep(freq=880,dur=0.08,type="sine"){
    if(this.muted) return; this.ensureCtx();
    const t0=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t0);
    g.gain.value=this.master*0.25; o.connect(g).connect(this.ctx.destination);
    o.start(); o.stop(t0+dur);
  }
  shoot(){ this.beep(1100,0.05,"square"); }
  power(){ if(this.muted) return; [600,900,1200].forEach((f,i)=>setTimeout(()=>this.beep(f,0.05,"triangle"),i*50)); }
  explosion(){
    if(this.muted) return; this.ensureCtx();
    const t0=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();
    o.type="sawtooth"; o.frequency.setValueAtTime(220,t0);
    o.frequency.exponentialRampToValueAtTime(60,t0+0.25);
    g.gain.setValueAtTime(this.master*0.35,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+0.28);
    o.connect(g).connect(this.ctx.destination); o.start(); o.stop(t0+0.3);
    // ruido
    const b=this.ctx.createBuffer(1,this.ctx.sampleRate*0.2,this.ctx.sampleRate),d=b.getChannelData(0);
    for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
    const s=this.ctx.createBufferSource(); s.buffer=b; const gn=this.ctx.createGain(); gn.gain.value=this.master*0.12;
    s.connect(gn).connect(this.ctx.destination); s.start(t0);
  }
}

/* ---------- Assets (sprites opcionales) ---------- */
class AssetManager{
  constructor(){
    this.map={
      player:"assets/player.png",
      enemy_basic:"assets/enemy_basic.png",
      enemy_fast:"assets/enemy_fast.png",
      enemy_tank:"assets/enemy_tank.png",
      boss:"assets/boss.png"
    };
    this.img={}; this.loaded=false;
  }
  async loadAll(){
    const load=(key,src)=>new Promise(res=>{
      const im=new Image(); im.onload=()=>res({key,im}); im.onerror=()=>res({key,im:null}); im.src=src;
    });
    const entries=await Promise.all(Object.entries(this.map).map(([k,v])=>load(k,v)));
    entries.forEach(({key,im})=>{ this.img[key]=im; });
    this.loaded=true;
  }
  has(key){ return !!this.img[key]; }
}

/* ---------- Input ---------- */
class Input{
  constructor(canvas,touchLayer,fireBtn,pauseBtn){
    this.left=false; this.right=false; this.fire=false; this.pausePressed=false;
    this.pointerActive=false; this.pointerX=null; this.canvas=canvas;

    window.addEventListener('keydown',e=>{
      if(e.code==="ArrowLeft"||e.code==="KeyA") this.left=true;
      if(e.code==="ArrowRight"||e.code==="KeyD") this.right=true;
      if(e.code==="Space"){ this.fire=true; e.preventDefault(); }
      if(e.code==="KeyP"){ this.pausePressed=true; }
      if(e.code==="KeyM"){ /* mute lo maneja Game.loop */ }
    });
    window.addEventListener('keyup',e=>{
      if(e.code==="ArrowLeft"||e.code==="KeyA") this.left=false;
      if(e.code==="ArrowRight"||e.code==="KeyD") this.right=false;
      if(e.code==="Space") this.fire=false;
    });

    const toX=(clientX)=>{ const r=this.canvas.getBoundingClientRect(); return (clientX-r.left)*(W/r.width); };
    const onStart=e=>{ e.preventDefault(); this.pointerActive=true; this.pointerX=toX(e.touches[0].clientX); this.fire=true; };
    const onMove =e=>{ e.preventDefault(); if(this.pointerActive) this.pointerX=toX(e.touches[0].clientX); };
    const onEnd  =e=>{ e.preventDefault(); this.pointerActive=false; this.fire=false; };
    touchLayer.addEventListener('touchstart',onStart,{passive:false});
    touchLayer.addEventListener('touchmove', onMove ,{passive:false});
    touchLayer.addEventListener('touchend',  onEnd  ,{passive:false});
    touchLayer.addEventListener('touchcancel',onEnd ,{passive:false});

    fireBtn.addEventListener('touchstart',e=>{e.preventDefault(); this.fire=true;});
    fireBtn.addEventListener('touchend',  e=>{e.preventDefault(); this.fire=false;});
    fireBtn.addEventListener('mousedown', ()=>{this.fire=true;});
    fireBtn.addEventListener('mouseup',   ()=>{this.fire=false;});
    fireBtn.addEventListener('mouseleave',()=>{this.fire=false;});
    pauseBtn.addEventListener('click',()=>{ this.pausePressed=true; });
  }
  consumePause(){ const p=this.pausePressed; this.pausePressed=false; return p; }
}

/* ---------- Storage & Leaderboard ---------- */
class Storage{
  static hiKey="galagaHighScore";
  static boardKey="galagaLeaderboard";
  static diffKey="galagaDifficulty";
  static spritesKey="galagaSprites";
  static getHigh(){ const v=localStorage.getItem(this.hiKey); return v?parseInt(v,10):0; }
  static setHigh(v){ localStorage.setItem(this.hiKey,String(v)); }
  static getBoard(){ try{ return JSON.parse(localStorage.getItem(this.boardKey)||"[]"); }catch{ return []; } }
  static setBoard(list){ localStorage.setItem(this.boardKey, JSON.stringify(list)); }
  static getDiff(){ return localStorage.getItem(this.diffKey)||"normal"; }
  static setDiff(v){ localStorage.setItem(this.diffKey,v); }
  static getSprites(){ return (localStorage.getItem(this.spritesKey)||"0")==="1"; }
  static setSprites(on){ localStorage.setItem(this.spritesKey, on?"1":"0"); }
}
class Leaderboard{
  constructor(max=10){ this.max=max; this.entries=Storage.getBoard(); }
  load(){ this.entries=Storage.getBoard(); }
  save(){ Storage.setBoard(this.entries); }
  qualifies(score){
    if(this.entries.length<this.max) return score>0;
    const min=Math.min(...this.entries.map(e=>e.score)); return score>min;
  }
  add(name,score,diff){
    const date=new Date(); this.entries.push({name:name||"Anon",score,ts:date.toISOString(),diff});
    this.entries.sort((a,b)=>b.score-a.score); this.entries=this.entries.slice(0,this.max);
    this.save(); if(score>Storage.getHigh()) Storage.setHigh(score);
  }
  render(){
    this.load();
    const list=document.getElementById('boardList'); list.innerHTML="";
    if(this.entries.length===0){ list.innerHTML="<li><span>No hay récords aún</span></li>"; return; }
    this.entries.forEach((e,i)=>{
      const li=document.createElement('li');
      const date=new Date(e.ts); const ds=date.toLocaleDateString();
      li.innerHTML=`${i+1}. <strong>${e.name}</strong> — <span>${e.score.toString().padStart(6,"0")}</span> <span>(${e.diff||"normal"} · ${ds})</span>`;
      list.appendChild(li);
    });
  }
}

/* ---------- Entidades ---------- */
class Bullet{
  constructor(){ this.active=false; this.x=0; this.y=0; this.vx=0; this.vy=0; this.r=3; this.friendly=true; }
  spawn(x,y,vy,friendly=true,vx=0){ this.active=true; this.x=x; this.y=y; this.vy=vy; this.vx=vx; this.friendly=friendly; }
  update(dt){ if(!this.active) return; this.x+=this.vx*dt; this.y+=this.vy*dt; if(this.y<-20||this.y>H+20||this.x<-20||this.x>W+20) this.active=false; }
  draw(ctx,pal){ if(!this.active) return; ctx.fillStyle=this.friendly?pal.bulletPlayer:pal.bulletEnemy; ctx.beginPath(); ctx.arc(this.x,this.y,this.r,0,TWO_PI); ctx.fill(); }
}
class BulletPool{
  constructor(n=220){ this.pool=Array.from({length:n},()=>new Bullet()); }
  spawn(x,y,vy,fr=true,vx=0){ const b=this.pool.find(k=>!k.active)||(this.pool.push(new Bullet()),this.pool[this.pool.length-1]); b.spawn(x,y,vy,fr,vx); }
  update(dt){ this.pool.forEach(b=>b.update(dt)); }
  draw(ctx,pal){ this.pool.forEach(b=>b.draw(ctx,pal)); }
  eachActive(cb){ for(const b of this.pool){ if(b.active) cb(b); } }
}

/* Partículas con additive blending */
class Particle{
  constructor(){ this.active=false; this.x=0; this.y=0; this.vx=0; this.vy=0; this.life=0; this.max=0.4; this.size=2; this.color="#fff"; }
  spawn(x,y,vx,vy,life=0.4,size=2,color="#fff"){ this.active=true; this.x=x; this.y=y; this.vx=vx; this.vy=vy; this.life=life; this.max=life; this.size=size; this.color=color; }
  update(dt){ if(!this.active) return; this.life-=dt; if(this.life<=0){ this.active=false; return; } this.x+=this.vx*dt; this.y+=this.vy*dt; this.vy+=40*dt; }
  draw(ctx){ if(!this.active) return; const a=clamp(this.life/this.max,0,1); ctx.globalAlpha=a; ctx.fillStyle=this.color; ctx.fillRect(this.x-this.size/2,this.y-this.size/2,this.size,this.size); ctx.globalAlpha=1; }
}
class ParticlePool{
  constructor(n=700){ this.pool=Array.from({length:n},()=>new Particle()); }
  spawn(x,y,vx,vy,life,size,color){ const p=this.pool.find(k=>!k.active)||(this.pool.push(new Particle()),this.pool[this.pool.length-1]); p.spawn(x,y,vx,vy,life,size,color); }
  burst(x,y,c,color){ for(let i=0;i<c;i++){ const ang=rand(0,TWO_PI), sp=rand(40,180); this.spawn(x,y,Math.cos(ang)*sp,Math.sin(ang)*sp,rand(0.25,0.6),rand(1.5,3.8),color); } }
  trail(x,y,color){ this.spawn(x+rand(-3,3),y+10+rand(-2,2),rand(-10,10),rand(20,50),rand(0.15,0.3),1.5,color); }
  update(dt){ this.pool.forEach(p=>p.update(dt)); }
  draw(ctx){
    const prev=ctx.globalCompositeOperation;
    ctx.globalCompositeOperation='lighter';
    this.pool.forEach(p=>p.draw(ctx));
    ctx.globalCompositeOperation=prev;
  }
}

/* Bezier helper */
function bezier(p0,p1,p2,p3,t){
  const u=1-t, tt=t*t, uu=u*u, uuu=uu*u, ttt=tt*t;
  return { x: uuu*p0.x + 3*uu*t*p1.x + 3*u*tt*p2.x + ttt*p3.x,
           y: uuu*p0.y + 3*uu*t*p1.y + 3*u*tt*p2.y + ttt*p3.y };
}

class Enemy{
  constructor(type,baseX,baseY){
    this.type=type; this.baseX=baseX; this.baseY=baseY; this.x=baseX; this.y=baseY;
    this.r=(type==="boss")?22:12; this.hp=(type==="tank")?2:(type==="boss")?20:1; this.speed=(type==="fast")?1.25:1;
    this.alive=true; this.diving=false; this.t=0; this.path=null; this.cool=rand(0.5,1.8); this.stray=false;
  }
  startDive(){
    this.diving=true; this.t=0; this.stray=false;
    const dir=Math.random()<0.5?-1:1;
    const p0={x:this.x,y:this.y};
    const p1={x:this.x+dir*rand(40,90), y:this.y+rand(60,120)};
    const p2={x:W/2+dir*rand(80,140), y:H-120};
    const p3={x:W/2+dir*rand(120,160), y:H+40};
    this.path={mode:"bezier",p0,p1,p2,p3};
  }
  /* Param: trayectoria f(t,i,n) 0..1, duración secs */
  startParam(pathFn, duration=2, idx=0, count=1){
    this.diving=true; this.t=0; this.stray=true;
    this.path={mode:"param", f:pathFn, dur:duration, idx, count};
  }
  startSineSweep(side="left"){
    this.diving=true; this.t=0; this.stray=true;
    const y0=rand(100,240), amp=rand(30,70), len=W+60, x0=side==="left"?-30:W+30, dir=side==="left"?1:-1;
    this.path={mode:"sine", y0, amp, x0, dir, len};
  }
  update(dt,time,formationOffsetX){
    if(!this.alive) return;
    if(this.diving){
      const sp=(this.type==="boss")?0.35:0.5*this.speed;
      this.t+=dt*sp;
      const m=this.path?.mode;
      if(m==="bezier"){
        const P=bezier(this.path.p0,this.path.p1,this.path.p2,this.path.p3,this.t); this.x=P.x; this.y=P.y;
        if(this.t>=1){ this.diving=false; if(!this.stray){ this.x=this.baseX; this.y=this.baseY; } }
      }else if(m==="sine"){
        const prog=this.t; this.x=this.path.x0+(prog*this.path.len)*this.path.dir; this.y=this.path.y0+Math.sin(prog*4*Math.PI)*this.path.amp+prog*40;
        if(prog>=1){ this.alive=false; }
      }else if(m==="param"){
        const tt=clamp(this.t*(1/(2/this.path.dur)),0,1);
        const P=this.path.f(tt,this.path.idx,this.path.count);
        this.x=P.x; this.y=P.y;
        if(this.t>=(this.path.dur/2)){ this.alive=false; } // salen de escena
      }
    }else{
      const osc=Math.sin(time*1.2*this.speed)*24;
      this.x=this.baseX+formationOffsetX+osc;
      this.y=this.baseY+Math.sin(time*0.9+this.baseX*0.01)*4;
    }
    if(this.cool>0) this.cool-=dt;
  }
  tryShoot(enemyBullets,levelMul){ if(!this.alive||this.cool>0) return; const vy=140+20*levelMul; enemyBullets.spawn(this.x,this.y+10,vy,false,0); this.cool=rand(1.2,2.2)/this.speed/Math.max(1,levelMul*0.8); }
}

/* ---------- Sprites renderer ---------- */
class Renderer{
  constructor(assets){ this.assets=assets; this.useSprites=Storage.getSprites(); }
  toggle(){ this.useSprites=!this.useSprites; Storage.setSprites(this.useSprites); }
  drawPlayer(ctx,x,y,pal){
    const im=this.assets.img.player;
    if(this.useSprites && im){ const w=24,h=24; ctx.drawImage(im, x-w/2, y-h/2, w, h); }
    else{ ctx.fillStyle=pal.player; ctx.beginPath(); ctx.moveTo(x,y-14); ctx.lineTo(x+12,y+12); ctx.lineTo(x-12,y+12); ctx.closePath(); ctx.fill(); }
  }
  drawEnemy(ctx,e,pal){
    if(!e.alive) return; // guardia
    let key="enemy_basic"; if(e.type==="fast") key="enemy_fast"; if(e.type==="tank") key="enemy_tank"; if(e.type==="boss") key="boss";
    const im=this.assets.img[key];
    if(this.useSprites && im){
      const w=(e.type==="boss")?48:24, h=(e.type==="boss")?24:16;
      ctx.drawImage(im, e.x-w/2, e.y-h/2, w, h);
    }else{
      ctx.save(); ctx.translate(e.x,e.y);
      let c=pal.enemyBasic; if(e.type==="fast") c=pal.enemyFast; if(e.type==="tank") c=pal.enemyTank; if(e.type==="boss") c=pal.boss;
      ctx.fillStyle=c; const w=(e.type==="boss")?44:24, h=(e.type==="boss")?20:16;
      ctx.fillRect(-w/2,-h/2,w,h); ctx.fillRect(-w/2-6,-4,6,8); ctx.fillRect(w/2,-4,6,8);
      if(e.type!=="basic"&&e.hp>1){ ctx.strokeStyle="#fff8"; ctx.strokeRect(-w/2,-h/2,w,h); }
      ctx.restore();
    }
  }
}

/* ---------- Spawner / niveles + coreografías ---------- */
const LevelTable={
  1:{rows:4,cols:6,types:["basic"], diveEvery:2.2, enemySpeedMul:1.0, enemyFireMul:1.0, boss:false, swarms:0},
  2:{rows:5,cols:6,types:["basic","fast"], diveEvery:1.8, enemySpeedMul:1.08, enemyFireMul:1.1, boss:false, swarms:1},
  3:{rows:5,cols:7,types:["basic","fast","tank"], diveEvery:1.6, enemySpeedMul:1.15, enemyFireMul:1.18, boss:false, swarms:1},
  4:{rows:1,cols:1,types:["boss"], diveEvery:2.0, enemySpeedMul:1.0, enemyFireMul:1.0, boss:true, swarms:0}
};
function pickType(types){ const r=Math.random(); if(types.includes("boss")) return "boss"; if(r<0.6&&types.includes("basic")) return "basic"; if(r<0.85&&types.includes("fast")) return "fast"; return types.includes("tank")?"tank":"basic"; }

/* Biblioteca de patrones “JSON” (coreografías) */
const ChoreoLibrary=[
  { name:"sine_swarm", params:(lvl)=>({side: chance(0.5)?"left":"right", count: 5+Math.floor(lvl*0.4) }) },
  { name:"figure8", params:(lvl)=>({ cx: W/2, cy: H/3, r: rand(60,90), count: 6+Math.floor(lvl*0.3), duration: 3 }) },
  { name:"spiral_in", params:(lvl)=>({ side: chance(0.5)?"left":"right", count: 6+Math.floor(lvl*0.2), turns: rand(1.5,2.5), duration: 2.8 }) }
];

/* Generadores a partir de los JSON */
const ChoreoFns={
  sine_swarm(game, cfg){
    const side=cfg.side||"left", count=cfg.count||6;
    for(let i=0;i<count;i++){ const e=new Enemy("fast", side==="left"? -30:W+30, rand(40,120)); e.startSineSweep(side); game.enemies.push(e); }
  },
  figure8(game, cfg){
    const {cx=W/2, cy=H/3, r=80, count=8, duration=3}=cfg;
    const pathFn=(t,i,n)=>{
      const phase=i/n;
      const ang=TWO_PI*(t+phase);
      const x=cx + r*Math.sin(ang);
      const y=cy + r*0.6*Math.sin(2*ang);
      return {x,y};
    };
    for(let i=0;i<count;i++){ const e=new Enemy("fast", cx, cy-100); e.startParam(pathFn,duration,i,count); game.enemies.push(e); }
  },
  spiral_in(game, cfg){
    const {side="left", count=8, duration=2.8, turns=2}=cfg;
    const cx=W/2, cy=H/3, r0=20, r1=110;
    const dir=side==="left"?1:-1;
    const pathFn=(t,i,n)=>{
      const phase=i/n;
      const ang=(turns*TWO_PI*t + phase*TWO_PI)*dir;
      const r=r0 + (r1-r0)*t;
      return { x: cx + Math.cos(ang)*r, y: cy + Math.sin(ang)*r + t*70 };
    };
    for(let i=0;i<count;i++){ const e=new Enemy("basic", side==="left"?-30:W+30, 60); e.startParam(pathFn,duration,i,count); game.enemies.push(e); }
  }
};

class Spawner{
  constructor(game){ this.game=game; this.level=1; this.time=0; this.diveTimer=2; this.swarmTimer=5; this.patternTimer=6; }
  reset(){ this.level=1; }
  configFor(level){
    if(LevelTable[level]) return LevelTable[level];
    const L=level, boss=(L%4===0);
    const rows=boss?1:(5+Math.floor((L-1)/3)%2);
    const cols=boss?1:clamp(6+Math.floor(L/3),6,8);
    return { rows, cols, types:boss?["boss"]:["basic","fast","tank"],
      diveEvery:clamp(1.6-(L*0.03),0.85,2), enemySpeedMul:1+(L-1)*0.08, enemyFireMul:1+(L-1)*0.1, boss, swarms: boss?0:1 };
  }
  buildLevel(level){
    const cfg=this.configFor(level), enemies=[];
    const gapX=52, gapY=44, startX=W/2-(cfg.cols-1)*gapX/2, startY=110;
    if(cfg.boss){ const e=new Enemy("boss", W/2, 160); e.hp=20+Math.floor(level*2.5); e.r=22+Math.min(10,level); enemies.push(e); }
    else{
      for(let r=0;r<cfg.rows;r++) for(let c=0;c<cfg.cols;c++){
        const bx=startX+c*gapX, by=startY+r*gapY; const t=pickType(cfg.types); const e=new Enemy(t,bx,by);
        if(t==="fast") e.r=11; if(t==="tank") e.hp=2+Math.floor((level-1)/3); enemies.push(e);
      }
    }
    return { enemies, cfg };
  }
}

/* ---------- PowerUps & Player ---------- */
class PowerUp{
  constructor(x,y,type){ this.x=x; this.y=y; this.type=type; this.r=10; this.vy=70; this.alive=true; }
  update(dt){ this.y+=this.vy*dt; if(this.y>H+15) this.alive=false; }
  draw(ctx,pal){ ctx.save(); ctx.translate(this.x,this.y);
    ctx.fillStyle=(this.type==="shield")?pal.powerShield:(this.type==="double")?pal.powerDouble:pal.powerRapid;
    ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(10,0); ctx.lineTo(0,10); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill(); ctx.restore(); }
}
class Player{
  constructor(audio){ this.x=W/2; this.y=H-60; this.r=12; this.speed=220; this.fireCooldownBase=0.28; this.fireCooldown=0;
    this.doubleUntil=0; this.rapidUntil=0; this.shield=0; this.invuln=0; this.lives=3; this.alive=true; this.audio=audio; this.trailTimer=0; }
  resetRun(lives=3,rofMul=1){ this.x=W/2; this.y=H-60; this.lives=lives; this.alive=true; this.doubleUntil=0; this.rapidUntil=0; this.shield=0; this.invuln=0; this.fireCooldown=0; this.fireCooldownBase=0.28*rofMul; }
  hasDouble(){ return this.doubleUntil>0; } hasRapid(){ return this.rapidUntil>0; } canFire(){ return this.fireCooldown<=0; }
  fire(bullets){ this.audio.shoot(); const vy=-420; if(this.hasDouble()){ bullets.spawn(this.x-8,this.y-14,vy,true,0); bullets.spawn(this.x+8,this.y-14,vy,true,0); } else bullets.spawn(this.x,this.y-14,vy,true,0);
    const base=this.fireCooldownBase*(this.hasRapid()?0.7:1); this.fireCooldown=base; }
  givePower(type){ if(type==="shield") this.shield=Math.min(1,this.shield+1); if(type==="double") this.doubleUntil=Math.max(this.doubleUntil,10); if(type==="rapid") this.rapidUntil=Math.max(this.rapidUntil,10); }
  hit(){ if(this.invuln>0) return false; if(this.shield>0){ this.shield--; this.invuln=0.6; return false; } this.lives--; this.invuln=1.5; if(this.lives<0) this.alive=false; return true; }
  update(dt,input,particles,pal){ let vx=0; if(input.left) vx-=this.speed; if(input.right) vx+=this.speed;
    if(input.pointerActive && input.pointerX!=null){ const target=clamp(input.pointerX,18,W-18); const dx=target-this.x; vx=clamp(dx*8,-this.speed*1.3,this.speed*1.3); }
    this.x=clamp(this.x+vx*dt,18,W-18); if(this.fireCooldown>0) this.fireCooldown-=dt;
    this.trailTimer-=dt; if(this.trailTimer<=0){ particles.trail(this.x,this.y, pal.bulletPlayer); this.trailTimer=0.03; } }
}

/* ---------- Juego principal ---------- */
class Game{
  constructor(canvas){
    this.canvas=canvas; this.ctx=canvas.getContext('2d');
    this.audio=new AudioManager(); this.assets=new AssetManager(); // carga async sin bloquear
    this.assets.loadAll().then(()=>{/* ok */});

    // UI
    this.btnMute=document.getElementById('btnMute');
    this.btnDaltonico=document.getElementById('btnDaltonico');
    this.btnBoard=document.getElementById('btnBoard');
    this.btnSprites=document.getElementById('btnSprites');
    this.selDiff=document.getElementById('difficultySelect');
    this.overlay=document.getElementById('overlay');
    this.namePrompt=document.getElementById('namePrompt');
    this.nameInput=document.getElementById('nameInput');
    this.nameOk=document.getElementById('nameOk');
    this.nameSkip=document.getElementById('nameSkip');
    this.boardPanel=document.getElementById('boardPanel');
    this.boardList=document.getElementById('boardList');
    this.boardClose=document.getElementById('boardClose');
    this.boardReset=document.getElementById('boardReset');

    this.input=new Input(canvas, document.getElementById('touchLayer'),
      document.getElementById('fireBtn'), document.getElementById('pauseBtn'));

    // eventos UI
    this.btnMute.addEventListener('click',()=>{ this.audio.toggleMute(); this.btnMute.textContent=this.audio.muted?"🔇":"🔈"; });
    this.btnDaltonico.addEventListener('click',()=>{ this.colorblind=!this.colorblind; });
    this.btnBoard.addEventListener('click',()=>this.showBoard());
    this.boardClose.addEventListener('click',()=>this.hideOverlays());
    this.boardReset.addEventListener('click',()=>{ localStorage.removeItem(Storage.boardKey); this.board.render(); });

    this.renderer=new Renderer(this.assets);
    this.btnSprites.addEventListener('click',()=>{ this.renderer.toggle(); this.updateSpritesButton(); });
    this.updateSpritesButton();

    // dificultad persistente
    const d=Storage.getDiff(); this.selDiff.value=d; this.diff=DIFFS[d]||DIFFS.normal;
    this.selDiff.addEventListener('change',()=>{ Storage.setDiff(this.selDiff.value); this.diff=DIFFS[this.selDiff.value]||DIFFS.normal; });

    // nombre récord
    this.nameOk.addEventListener('click',()=>this.saveName());
    this.nameSkip.addEventListener('click',()=>this.hideOverlays());

    this.state=STATE.MENU; this.time=0; this.colorblind=false;
    this.player=new Player(this.audio);
    this.playerBullets=new BulletPool(220);
    this.enemyBullets=new BulletPool(260);
    this.particles=new ParticlePool(800);
    this.powerUps=[];
    this.spawner=new Spawner(this);
    this.enemies=[];
    this.level=1; this.score=0; this.high=Storage.getHigh();
    this.messageTimer=0; this.messageText="";
    this.levelData=null; this.formationOffset=0; this.levelMul=1;
    this.board=new Leaderboard(10); this.askedName=false;

    this.lastT=nowMs();
    requestAnimationFrame(this.loop.bind(this));
  }

  updateSpritesButton(){ this.btnSprites.textContent=this.renderer.useSprites?"🖼️✓":"🖼️"; }
  getPalette(){ return this.colorblind?COLORS.daltonico:COLORS.normal; }
  message(txt,dur=1.5){ this.messageText=txt; this.messageTimer=dur; }

  newRun(){
    this.player.resetRun(this.diff.playerLives, this.diff.playerROF);
    this.level=1; this.score=0; this.high=Storage.getHigh(); this.askedName=false;
    this.powerUps.length=0;
    this.playerBullets.pool.forEach(b=>b.active=false);
    this.enemyBullets.pool.forEach(b=>b.active=false);
    this.particles.pool.forEach(p=>p.active=false);
    this.spawnLevel(this.level); this.message("Ready!"); this.state=STATE.PLAYING;
  }
  spawnLevel(n){
    const {enemies,cfg}=this.spawner.buildLevel(n);
    cfg.enemySpeedMul*=this.diff.enemySpeed;
    cfg.enemyFireMul *=this.diff.enemyFire;
    if(cfg.boss){ const boss=enemies[0]; if(boss) boss.hp=Math.floor(boss.hp*this.diff.bossHp); }
    this.enemies=enemies; this.levelData=cfg; this.levelMul=Math.max(1,(n-1)*0.2+(cfg.boss?0:1));
    this.spawner.time=0;
    this.spawner.diveTimer=cfg.diveEvery;                // ← dive inicial basado en nivel
    this.spawner.swarmTimer=(cfg.swarms>0)?rand(4,7):9999;
    this.spawner.patternTimer=rand(6,10);
  }
  nextLevel(){ this.level++; this.score+=Math.floor(200*this.diff.scoreMul); this.spawnLevel(this.level); this.message("Level Up!"); }

  handleStateInputs(){ if(this.input.consumePause()){ if(this.state===STATE.PLAYING) this.state=STATE.PAUSED; else if(this.state===STATE.PAUSED) this.state=STATE.PLAYING; } }

  update(dt){
    this.handleStateInputs();
    if(this.state===STATE.MENU){ if(this.input.fire){ this.newRun(); } return; }
    if(this.state===STATE.PAUSED) return;
    if(this.state===STATE.GAME_OVER){ if(this.input.fire){ this.state=STATE.MENU; } return; }

    this.time+=dt; if(this.messageTimer>0) this.messageTimer-=dt;
    const pal=this.getPalette();

    // Player
    this.player.update(dt,this.input,this.particles,pal);
    if(this.player.invuln>0) this.player.invuln-=dt;
    if(this.input.fire && this.player.canFire()){ this.player.fire(this.playerBullets); }

    // Enemigos (formación base)
    this.spawner.time+=dt; this.formationOffset=Math.sin(this.spawner.time*0.9)*24;
    for(const e of this.enemies){
      if(!e.alive) continue;
      e.update(dt, this.spawner.time*this.levelData.enemySpeedMul, this.formationOffset);
      if(!this.levelData.boss && Math.random()<0.002*this.levelData.enemyFireMul) e.tryShoot(this.enemyBullets,this.levelMul);
    }

    // --- NUEVO: ataques en picada con regreso a formación ---
    if(!this.levelData.boss){
      this.spawner.diveTimer -= dt;
      if(this.spawner.diveTimer <= 0){
        const candidates=this.enemies.filter(e=>e.alive && !e.diving && !e.stray);
        if(candidates.length){
          const simultaneous = clamp(1+Math.floor(this.level/3),1,3); // más dives en niveles altos
          for(let k=0;k<Math.min(simultaneous,candidates.length);k++){
            const idx=Math.floor(rand(0,candidates.length));
            const e=candidates.splice(idx,1)[0];
            e.startDive(); // Bezier hacia abajo y vuelve
          }
        }
        // próximo dive: alrededor de diveEvery, ajustado por dificultad
        const base=this.levelData.diveEvery/this.diff.enemySpeed;
        this.spawner.diveTimer = rand(base*0.75, base*1.25);
      }
    }

    // Jefe: espiral doble + ráfagas
    if(this.levelData.boss){
      const boss=this.enemies.find(e=>e.alive);
      if(boss){
        boss.baseX=W/2+Math.sin(this.spawner.time*0.7)*120;
        this._spiralTimer=(this._spiralTimer||0)-dt;
        if(this._spiralTimer<=0){
          const base=(this._spiralAng||0), speed=200;
          for(let k=0;k<2;k++){ const ang=base+k*Math.PI; const vx=Math.cos(ang)*speed, vy=Math.sin(ang)*speed;
            this.enemyBullets.spawn(boss.x,boss.y,vy,false,vx); }
          this._spiralAng=(base+0.35)%TWO_PI; this._spiralTimer=0.09;
        }
        if(Math.random()<0.006){ this.enemyBullets.spawn(boss.x-14,boss.y+8,190,false,0); this.enemyBullets.spawn(boss.x,boss.y+12,210,false,0); this.enemyBullets.spawn(boss.x+14,boss.y+8,190,false,0); }
      }
    }

    // Enjambres + coreografías
    if(this.levelData.swarms>0){
      this.spawner.swarmTimer-=dt;
      if(this.spawner.swarmTimer<=0){
        ChoreoFns.sine_swarm(this,{side: chance(0.5)?"left":"right", count: 5+Math.floor(this.level*0.4) });
        this.spawner.swarmTimer=rand(6,10);
      }
      this.spawner.patternTimer-=dt;
      if(this.spawner.patternTimer<=0){
        const pat=ChoreoLibrary[Math.floor(rand(0,ChoreoLibrary.length))];
        const cfg=pat.params(this.level);
        (ChoreoFns[pat.name]||(()=>{}))(this,cfg);
        this.spawner.patternTimer=rand(8,13);
      }
    }

    // Balas
    this.playerBullets.update(dt); this.enemyBullets.update(dt);

    // PowerUps
    for(const p of this.powerUps) p.update(dt);
    this.powerUps=this.powerUps.filter(p=>p.alive);

    // Colisiones: jugador -> enemigos
    this.playerBullets.eachActive(b=>{
      if(!b.friendly) return;
      for(const e of this.enemies){
        if(!e.alive) continue;
        const dx=e.x-b.x, dy=e.y-b.y, rr=(e.r+4)*(e.r+4);
        if(dx*dx+dy*dy<=rr){
          b.active=false; e.hp--;
          this.particles.burst(b.x,b.y,8,pal.bulletPlayer);
          if(e.hp<=0){
            e.alive=false; this.audio.explosion();
            const pts=(e.type==="basic")?50:(e.type==="fast")?70:(e.type==="tank")?120:500;
            this.score+=Math.floor(pts*this.diff.scoreMul);
            const col=(e.type==="fast")?pal.enemyFast:(e.type==="tank")?pal.enemyTank:(e.type==="boss")?pal.boss:pal.enemyBasic;
            this.particles.burst(e.x,e.y,(e.type==="boss")?60:24,col);
            if(e.type!=="boss" && chance(0.12)){
              const kind=chance(0.33)?"shield":(chance(0.5)?"double":"rapid");
              this.powerUps.push(new PowerUp(e.x,e.y,kind)); this.audio.power();
            }
          }
          break;
        }
      }
    });

    // Balas enemigas -> jugador
    this.enemyBullets.eachActive(b=>{
      if(!this.player.alive||!b.active) return;
      const dx=this.player.x-b.x, dy=this.player.y-b.y, rr=(this.player.r+b.r)*(this.player.r+b.r);
      if(dx*dx+dy*dy<=rr){ b.active=false; const took=this.player.hit(); this.particles.burst(this.player.x,this.player.y,18,pal.bulletEnemy); if(took) this.audio.explosion(); }
    });

    // Enemigo golpea jugador
    for(const e of this.enemies){
      if(!e.alive) continue;
      const dx=e.x-this.player.x, dy=e.y-this.player.y, rr=(e.r+this.player.r)*(e.r+this.player.r);
      if(dx*dx+dy*dy<=rr){ e.alive=false; if(this.player.hit()) this.audio.explosion(); this.particles.burst(this.player.x,this.player.y,24,pal.enemyBasic); }
    }

    // PowerUps recogidos
    for(const p of this.powerUps){
      const dx=p.x-this.player.x, dy=p.y-this.player.y, rr=(p.r+this.player.r)*(p.r+this.player.r);
      if(dx*dx+dy*dy<=rr){ p.alive=false; this.player.givePower(p.type); this.audio.power(); }
    }

    // Timers power-ups
    if(this.player.doubleUntil>0) this.player.doubleUntil-=dt;
    if(this.player.rapidUntil>0)  this.player.rapidUntil-=dt;

    // Partículas
    this.particles.update(dt);

    // Limpieza y progreso de nivel
    this.enemies = this.enemies.filter(e => e.alive);
    if (this.enemies.length === 0) { this.nextLevel(); }

    // Fin de partida
    if(!this.player.alive){
      this.state=STATE.GAME_OVER;
      if(this.score>this.high){ this.high=this.score; Storage.setHigh(this.high); }
      if(!this.askedName && this.board.qualifies(this.score)){ this.askedName=true; setTimeout(()=>this.askName(),350); }
    }
  }

  /* ---------- UI overlays ---------- */
  askName(){ this.overlay.classList.remove('hidden'); this.namePrompt.classList.remove('hidden'); this.boardPanel.classList.add('hidden'); this.nameInput.value=""; this.nameInput.focus(); }
  saveName(){ const name=(this.nameInput.value||"Anon").trim().slice(0,12); this.board.add(name,this.score,this.selDiff.value); this.hideOverlays(); }
  showBoard(){ this.board.render(); this.overlay.classList.remove('hidden'); this.namePrompt.classList.add('hidden'); this.boardPanel.classList.remove('hidden'); }
  hideOverlays(){ this.overlay.classList.add('hidden'); this.namePrompt.classList.add('hidden'); this.boardPanel.classList.add('hidden'); }

  /* ---------- Render ---------- */
  draw(){
    const ctx=this.ctx, pal=this.getPalette();
    ctx.clearRect(0,0,W,H); this.drawStars();

    if(this.state===STATE.MENU){ this.drawTitle(pal); this.drawHUD(pal,true); return; }

    for(const p of this.powerUps) p.draw(ctx,pal);

    // solo enemigos vivos
    for(const e of this.enemies){ if(e.alive) this.renderer.drawEnemy(ctx,e,pal); }

    this.playerBullets.draw(ctx,pal);
    this.enemyBullets.draw(ctx,pal);

    if(this.player.alive){
      const t=this.time, alpha=(this.player.invuln>0 && Math.floor(t*20)%2===0)?0.5:1;
      ctx.save(); ctx.globalAlpha=alpha; this.renderer.drawPlayer(ctx,this.player.x,this.player.y,pal); ctx.restore();
      if(this.player.shield>0){ ctx.strokeStyle=pal.powerShield; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(this.player.x,this.player.y,16,0,TWO_PI); ctx.stroke(); }
    }

    this.particles.draw(ctx);
    this.drawHUD(pal,false);

    if(this.state===STATE.PAUSED) this.banner("PAUSED", pal.hudText);
    if(this.state===STATE.GAME_OVER) this.banner("GAME OVER\nTap/Space para menú", pal.hudText);
    if(this.messageTimer>0) this.banner(this.messageText, pal.hudText);
  }

  drawStars(){
    const ctx=this.ctx, t=this.time;
    const layer=(n,s,a)=>{ ctx.globalAlpha=a; ctx.fillStyle="#fff";
      for(let i=0;i<n;i++){ const x=(i*53)%W; const y=((i*97 + (t*s*60))%H); ctx.fillRect(x,y,1,1); } };
    layer(80,0.12,0.4); layer(60,0.20,0.7); layer(40,0.28,1.0); ctx.globalAlpha=1;
  }
  drawTitle(pal){
    const ctx=this.ctx; ctx.save(); ctx.fillStyle=pal.hudText; ctx.textAlign="center";
    ctx.font="bold 28px system-ui"; ctx.fillText("GALAGA ULTRA", W/2, 200);
    ctx.font="14px system-ui"; ctx.fillStyle=pal.hudDim;
    ctx.fillText("←/→ o A/D mover — Espacio disparar — P pausar — M mute", W/2, 230);
    ctx.fillText("Mobile: arrastrá abajo para mover — botón 🔥 para disparar", W/2, 252);
    ctx.fillText("Tap/Space para jugar — 🏆 récords — 🖼️ sprites — 🎯 daltónico", W/2, 290);
    ctx.restore();
  }
  drawHUD(pal,menu){
    const ctx=this.ctx; ctx.save(); ctx.fillStyle="#0008"; ctx.fillRect(0,0,W,24);
    ctx.textBaseline="middle"; ctx.fillStyle=pal.hudText; ctx.font="bold 12px system-ui";
    let lx=6; for(let i=0;i<Math.max(0,this.player.lives);i++){ ctx.fillStyle="#4fe38c"; ctx.beginPath();
      ctx.moveTo(lx+6,12); ctx.arc(lx+3,12,3,Math.PI*.2,Math.PI*1.8); ctx.arc(lx+9,12,3,Math.PI*1.2,Math.PI*2.8); ctx.fill(); lx+=14; }
    ctx.fillStyle=pal.hudText; ctx.fillText(`LV ${this.level}`, 90,12);
    ctx.textAlign="right"; ctx.fillText(`HI ${this.high.toString().padStart(6,"0")}`, W-6,12);
    ctx.textAlign="center"; ctx.fillText(`SCORE ${this.score.toString().padStart(6,"0")}`, W/2,12);
    // Power-ups
    let px=160; ctx.textAlign="left"; ctx.fillStyle=pal.hudDim; ctx.fillText("PWR:",px,12); px+=30;
    const drawP=(color,tLeft,label)=>{ if(tLeft>0){ ctx.fillStyle=color; ctx.fillRect(px,5,28,14);
      ctx.fillStyle="#000"; ctx.font="10px system-ui"; ctx.textAlign="center"; ctx.fillText(label,px+14,12);
      const bw=clamp((tLeft/10)*28,0,28); ctx.fillStyle="#0006"; ctx.fillRect(px,18,28,2); ctx.fillStyle="#fff8"; ctx.fillRect(px,18,bw,2); px+=34; } };
    drawP(pal.powerDouble,this.player.doubleUntil,"2x"); drawP(pal.powerRapid,this.player.rapidUntil,"ROF");
    if(this.player.shield>0){ ctx.fillStyle=pal.powerShield; ctx.fillRect(px,5,28,14); ctx.fillStyle="#000"; ctx.font="10px system-ui"; ctx.textAlign="center"; ctx.fillText("SH",px+14,12); }
    ctx.restore();

    if(menu){ ctx.save(); ctx.fillStyle=pal.hudDim; ctx.font="12px system-ui"; ctx.textAlign="center"; ctx.fillText("Mute: M — Daltónico: 🎯 — Récords: 🏆 — Sprites: 🖼️ — Dificultad: menú superior", W/2, H-20); ctx.restore(); }
  }
  banner(text,color){
    const ctx=this.ctx; ctx.save(); ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle="#000a"; ctx.fillRect(40,H/2-40,W-80,80); ctx.strokeStyle="#fff2"; ctx.strokeRect(40,H/2-40,W-80,80);
    ctx.fillStyle=color; ctx.font="bold 24px system-ui"; text.split("\n").forEach((ln,i)=>ctx.fillText(ln,W/2,H/2+(i*24)-12)); ctx.restore();
  }

  loop(ts){
    const dt=Math.min(0.05,(ts-this.lastT)/1000); this.lastT=ts;
    window.onkeydown=(e)=>{ if(e.code==="KeyM"){ this.audio.toggleMute(); this.btnMute.textContent=this.audio.muted?"🔇":"🔈"; } };
    this.update(dt); this.draw(); requestAnimationFrame(this.loop.bind(this));
  }
}

/* ---------- Boot ---------- */
(function(){
  const canvas=document.getElementById('game');
  const game=new Game(canvas);
  game.state=STATE.MENU;
})();
