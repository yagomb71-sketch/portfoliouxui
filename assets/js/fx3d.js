/* Efeitos 3D: pérola líquida em WebGL, inclinação 3D com o mouse e foto do topo em perspectiva no scroll.
   Projeto conceitual de Yago Moreira (yagoportfolio.com.br) */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  function hex(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]}

  /* ---------- 1. Objeto 3D por nicho (raymarching em shader): dente ou frasco de sérum ---------- */
  var COMMON=[
  'precision highp float;',
  'uniform vec2 R;uniform float T;uniform vec2 M;uniform float S;uniform vec3 C1,C2,C3;',
  'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
  'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
  'float smax(float a,float b,float k){return -smin(-a,-b,k);}',
  'float rbox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}',
  'float rcone(vec3 p,vec3 a,vec3 b,float r1,float r2){vec3 ba=b-a,pa=p-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-mix(r1,r2,h);}',
  'float cyl(vec3 p,float r,float h,float k){vec2 d=abs(vec2(length(p.xz),p.y))-vec2(r-k,h-k);return min(max(d.x,d.y),0.)+length(max(d,0.))-k;}',
  'float mat;'
  ].join('\n');
  var SHAPES={
   tooth:[
   'float map(vec3 p){',
   ' p.y+=sin(T*.8)*.05;',
   ' p.xz*=rot(T*.35+M.x*1.2+S*3.); p.yz*=rot(.22+M.y*.5);',
   ' vec3 q=p-vec3(0,.38,0);',
   ' float c=rbox(q,vec3(.66,.36,.56),.3);',
   ' float cu=1e9;',
   ' for(int i=0;i<4;i++){float fi=float(i);vec2 o=vec2(mod(fi,2.)<1.?-.3:.3,fi<2.?-.24:.24);cu=min(cu,length(p-vec3(o.x,.7,o.y))-.3);}',
   ' c=smin(c,cu,.18);',
   ' c=smax(c,-(length(p-vec3(0,1.08,0))-.34),.12);',
   ' float r1=rcone(p,vec3(-.3,0.,0.),vec3(-.36,-1.05,.04),.34,.1);',
   ' float r2=rcone(p,vec3(.3,0.,0.),vec3(.34,-1.,-.04),.34,.1);',
   ' float d=smin(c,smin(r1,r2,.12),.28);',
   ' mat=1.;return d*.8;}',
   'vec3 shade(vec3 p,vec3 n,vec3 rd,float ao){',
   ' vec3 L=normalize(vec3(-.5,.8,.6));float dif=max(dot(n,L),0.),fre=pow(1.-max(dot(n,-rd),0.),2.5),spe=pow(max(dot(reflect(rd,n),L),0.),60.);',
   ' vec3 enamel=mix(C2,C1,.55+.45*dif);',
   ' vec3 col=enamel*(.62+.38*ao)+C3*fre*.28+spe*.95;',
   ' col+=vec3(1.,.97,.9)*pow(max(dot(n,normalize(vec3(.6,-.2,.7))),0.),3.)*.08;',
   ' return col;}'].join('\n'),
   serum:[
   'float map(vec3 p){',
   ' p.y+=sin(T*.8)*.05;',
   ' vec3 b=p; b.xz*=rot(T*.25+M.x*1.+S*2.); b.xy*=rot(-.12+M.y*.25);',
   ' float body=cyl(b-vec3(0,-.42,0),.56,.62,.16);',
   ' float neck=cyl(b-vec3(0,.26,0),.24,.14,.05);',
   ' float glass=smin(body,neck,.16);',
   ' float collar=cyl(b-vec3(0,.48,0),.29,.14,.05);',
   ' float bulb=rcone(b,vec3(0,.66,0),vec3(0,1.12,0),.2,.17);',
   ' vec3 dp=p-vec3(.98,-.15+sin(T*1.1)*.12,.1);',
   ' float drop=smin(length(dp)-.15,rcone(dp,vec3(0),vec3(0,.28,0),.15,.0),.08);',
   ' float d=glass;mat=1.;',
   ' if(collar<d){d=collar;mat=2.;}',
   ' if(bulb<d){d=bulb;mat=3.;}',
   ' if(drop<d){d=drop;mat=4.;}',
   ' return d*.85;}',
   'vec3 shade(vec3 p,vec3 n,vec3 rd,float ao){',
   ' vec3 L=normalize(vec3(-.5,.8,.6));float dif=max(dot(n,L),0.),fre=pow(1.-max(dot(n,-rd),0.),2.2),spe=pow(max(dot(reflect(rd,n),L),0.),80.);',
   ' if(mat<1.5||mat>3.5){',
   '  vec3 g=mix(C2*.82,C2,.5+.5*n.y)*(.55+.45*dif);',
   '  float band=smoothstep(.02,0.,abs(p.y+.42)-.2)*step(mat,1.5);',
   '  g=mix(g,C1*(.75+.25*dif),band*.9);',
   '  return g*(.7+.3*ao)+vec3(1.)*fre*.45+spe*1.2;}',
   ' if(mat<2.5){vec3 gold=vec3(.86,.68,.38);return gold*(.35+.75*dif)+gold*pow(max(n.y,0.),2.)*.3+spe*1.4+fre*vec3(1.,.9,.7)*.3;}',
   ' return C3*(.55+.45*dif)*(.7+.3*ao)+spe*.25+fre*.12;}'].join('\n'),
   attar:[
   'float hexp(vec3 p,vec2 h){const vec3 k=vec3(-.8660254,.5,.57735);p=abs(p);p.xy-=2.*min(dot(k.xy,p.xy),0.)*k.xy;vec2 d=vec2(length(p.xy-vec2(clamp(p.x,-k.z*h.x,k.z*h.x),h.x))*sign(p.y-h.x),p.z-h.y);return min(max(d.x,d.y),0.)+length(max(d,0.));}',
   'float map(vec3 p){',
   ' p.y+=sin(T*.8)*.05+.08;',
   ' p.xz*=rot(T*.3+M.x*1.2+S*2.4); p.yz*=rot(.12+M.y*.35);',
   ' vec3 b=p-vec3(0,-.42,0);',
   ' float body=max(hexp(b.xzy,vec2(.6,.5))-.02,length(b*vec3(1.,1.15,1.))-.78);',
   ' float neck=cyl(p-vec3(0,.2,0),.13,.14,.03);',
   ' float collar=cyl(p-vec3(0,.12,0),.26,.05,.025);',
   ' float dome=length((p-vec3(0,.46,0))*vec3(1.,1.25,1.))-.2;',
   ' float ball=length(p-vec3(0,.72,0))-.075;',
   ' float spire=rcone(p,vec3(0,.6,0),vec3(0,1.18,0),.075,.008);',
   ' float gold=min(min(min(neck,collar),dome),min(ball,spire));',
   ' float d=body;mat=1.;if(gold<d){d=gold;mat=2.;}',
   ' return d*.85;}',
   'vec3 env(vec3 r){vec3 c=mix(vec3(.05,.07,.16),vec3(.75,.7,.6),smoothstep(-.2,.9,r.y));c+=vec3(1.,.9,.7)*pow(max(dot(r,normalize(vec3(-.5,.6,.6))),0.),24.);return c;}',
   'vec3 shade(vec3 p,vec3 n,vec3 rd,float ao){',
   ' vec3 L=normalize(vec3(-.5,.8,.6));float dif=max(dot(n,L),0.),fre=pow(1.-max(dot(n,-rd),0.),2.4),spe=pow(max(dot(reflect(rd,n),L),0.),90.);vec3 r=reflect(rd,n);',
   ' if(mat<1.5){vec3 g=C2*(.35+.5*dif)+C2*1.6*pow(max(dot(n,normalize(vec3(.4,-.3,.8))),0.),3.)*.6;',
   '  g+=C3*fre*.55+env(r)*fre*.35+spe*1.5;return g*(.75+.25*ao);}',
   ' vec3 gold=C3;return gold*(.25+.85*dif)+env(r)*gold*.6+spe*1.6+fre*gold*.4;}'].join('\n'),
   syringe:[
   'vec3 X(vec3 p){p.y+=sin(T*.8)*.05; p.xy*=rot(-.95+M.y*.25); p.xz*=rot(T*.3+M.x*1.1+S*2.2); return p;}',
   'float gelTop(){return .22+.06*sin(T*.6);}',
   'float map(vec3 p){',
   ' p=X(p)*1.;',
   ' float needle=cyl(p-vec3(0,-1.28,0),.016,.36,.008);',
   ' float hub=rcone(p,vec3(0,-.96,0),vec3(0,-.78,0),.055,.1);',
   ' float gt=gelTop();float gel=cyl(p-vec3(0,(-.74+gt)*.5,0),.168,(gt+.74)*.5,.03);',
   ' float stop=cyl(p-vec3(0,gt+.07,0),.172,.07,.02);',
   ' vec3 q=p-vec3(0,gt+.14+.7,0);',
   ' float rod=min(rbox(q,vec3(.075,.7,.012),.008),rbox(q,vec3(.012,.7,.075),.008));',
   ' float thumb=cyl(p-vec3(0,gt+.86,0),.21,.028,.012);',
   ' float flange=rbox(p-vec3(0,.76,0),vec3(.42,.026,.17),.02);',
   ' float d=gel;mat=1.;',
   ' if(needle<d){d=needle;mat=2.;}',
   ' if(hub<d){d=hub;mat=3.;}',
   ' if(stop<d){d=stop;mat=4.;}',
   ' float wp=min(min(rod,thumb),flange);if(wp<d){d=wp;mat=3.;}',
   ' return d;}',
   'float mapG(vec3 p){p=X(p)*1.;float b=cyl(p-vec3(0,0,0),.2,.74,.035);float tip=rcone(p,vec3(0,-.74,0),vec3(0,-.84,0),.19,.07);',
   ' float g=smin(b,tip,.06);g=max(g,-(cyl(p-vec3(0,0,0),.18,.72,.03)));return g;}',
   'vec3 env(vec3 r){vec3 c=mix(vec3(.80,.80,.82),vec3(1.),smoothstep(-.3,.7,r.y));c+=vec3(1.)*pow(max(dot(r,normalize(vec3(-.4,.6,.7))),0.),30.)*.8;c+=vec3(1.)*smoothstep(.97,.99,dot(r,normalize(vec3(.8,.1,.6))))*.8;return c;}',
   'vec3 shadeO(vec3 p,vec3 n,vec3 rd,float ao){',
   ' vec3 L=normalize(vec3(-.5,.8,.6));float dif=max(dot(n,L),0.),fre=pow(1.-max(dot(n,-rd),0.),3.),spe=pow(max(dot(reflect(rd,n),L),0.),90.);vec3 r=reflect(rd,n);',
   ' if(mat<1.5){vec3 g=mix(C2,vec3(1.),.35)*(.55+.45*dif);return g*(.75+.25*ao)+env(r)*fre*.6+spe*1.3;}',
   ' if(mat<2.5){return mix(vec3(.55),env(r),.8)*(.6+.4*dif)+spe*1.5;}',
   ' if(mat<3.5){return C1*(.62+.38*dif)*(.7+.3*ao)+spe*.5+fre*.15;}',
   ' return C3*(.6+.5*dif)*(.75+.25*ao)+spe*.35;}',
   'vec3 norO(vec3 p){vec2 e=vec2(.0015,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
   'vec3 norG(vec3 p){vec2 e=vec2(.0015,0);return normalize(vec3(mapG(p+e.xyy)-mapG(p-e.xyy),mapG(p+e.yxy)-mapG(p-e.yxy),mapG(p+e.yyx)-mapG(p-e.yyx)));}',
   'void main(){',
   ' vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;',
   ' vec3 ro=vec3(0,0,5.4),rd=normalize(vec3(uv,-1.75));',
   ' float t=0.,d;bool hit=false;',
   ' for(int i=0;i<100;i++){d=map(ro+rd*t);if(d<.0006){hit=true;break;}t+=d;if(t>9.)break;}',
   ' float tg=0.;bool hg=false;',
   ' for(int i=0;i<80;i++){d=mapG(ro+rd*tg);if(d<.0008){hg=true;break;}tg+=d;if(tg>9.)break;}',
   ' vec3 col=vec3(0);float a=0.;',
   ' if(hit){vec3 p=ro+rd*t;float m=mat;vec3 n=norO(p);mat=m;float ao=clamp(map(p+n*.12)/.12,0.,1.);mat=m;col=shadeO(p,n,rd,ao);a=1.;}',
   ' if(hg&&(!hit||tg<t)){vec3 p=ro+rd*tg;vec3 n=norG(p);float fre=pow(1.-abs(dot(n,-rd)),2.4);vec3 L=normalize(vec3(-.5,.8,.6));',
   '  float spe=pow(max(dot(reflect(rd,n),L),0.),120.);vec3 gc=env(reflect(rd,n))*.95;',
   '  float ga=clamp(.10+fre*.85,0.,1.);',
   '  col=mix(col*vec3(.97,.99,1.),gc,ga*(hit?1.:1.))+spe*1.6;a=max(a,ga+spe);',
   ' }',
   ' gl_FragColor=vec4(col*a,a);}'].join('\n'),
  };
  var MAIN=[
  'vec3 nor(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
  'void main(){',
  ' vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;',
  ' vec3 ro=vec3(0,0,5.4),rd=normalize(vec3(uv,-1.75));',
  ' float t=0.,d;bool hit=false;',
  ' for(int i=0;i<90;i++){d=map(ro+rd*t);if(d<.0008){hit=true;break;}t+=d;if(t>9.)break;}',
  ' if(!hit){gl_FragColor=vec4(0);return;}',
  ' vec3 p=ro+rd*t;float m=mat;vec3 n=nor(p);mat=m;',
  ' float ao=clamp(map(p+n*.18)/.18,0.,1.);mat=m;',
  ' gl_FragColor=vec4(shade(p,n,rd,ao),1.);}'].join('\n');
  var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  function pearl(cv){
    var gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:true});if(!gl)return;
    var SRC=SHAPES[cv.dataset.shape]||SHAPES.tooth;var FS=COMMON+'\n'+SRC+'\n'+(SRC.indexOf('void main')>-1?'':MAIN);
    function sh(t,src){var s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.warn(gl.getShaderInfoLog(s));return s}
    var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
    var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var al=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
    var U={};['R','T','M','S','C1','C2','C3'].forEach(function(k){U[k]=gl.getUniformLocation(pr,k)});
    gl.uniform3fv(U.C1,hex(cv.dataset.c1||'#ffffff'));gl.uniform3fv(U.C2,hex(cv.dataset.c2||'#dddddd'));gl.uniform3fv(U.C3,hex(cv.dataset.c3||'#888888'));
    var vis=false,mx=0,my=0,tx=0,ty=0,sc=0,t0=performance.now();
    var Q=Math.min(devicePixelRatio||1,1.3),slow=0,last=0;
    function size(){var r=cv.getBoundingClientRect();cv.width=Math.max(1,Math.round(r.width*Q));cv.height=Math.max(1,Math.round(r.height*Q));gl.viewport(0,0,cv.width,cv.height)}
    size();addEventListener('resize',size);
    if(fine)addEventListener('mousemove',function(e){tx=(e.clientX/innerWidth-.5);ty=(e.clientY/innerHeight-.5)});
    var go=false;(function wait(){if(document.body&&document.body.classList.contains('ready')){setTimeout(function(){go=true;if(vis)requestAnimationFrame(draw)},900)}else setTimeout(wait,120)})();
    new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis&&go)requestAnimationFrame(draw)}).observe(cv);
    function draw(now){
      if(vis&&!reduce&&now-last<30){requestAnimationFrame(draw);return}var dt=now-last;last=now;
      if(dt>0&&dt<1000){slow=dt>55?slow+1:Math.max(0,slow-1);if(slow>8&&Q>.5){Q=Math.max(.5,Q*.75);slow=0;size()}}
      mx+=(tx-mx)*.05;my+=(ty-my)*.05;
      var r=cv.getBoundingClientRect();sc+=(((innerHeight-r.top)/(innerHeight+r.height))-sc)*.08;
      gl.uniform2f(U.R,cv.width,cv.height);gl.uniform1f(U.T,reduce?0:(now-t0)/1000);gl.uniform2f(U.M,mx,my);gl.uniform1f(U.S,reduce?0:sc);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
      cv.style.transform='translate3d(0,'+((.5-sc)*60).toFixed(1)+'px,0)';
      if(vis&&go&&!reduce)requestAnimationFrame(draw);
    }
  }
  document.querySelectorAll('canvas.pearl').forEach(pearl);

  /* ---------- 2. Inclinação 3D com o mouse ---------- */
  if(fine&&!reduce){
    document.querySelectorAll('[data-tilt]').forEach(function(el){
      var max=+(el.dataset.tilt||8),raf=0,rx=0,ry=0,cx=0,cy=0;
      el.style.transformStyle='preserve-3d';
      function loop(){cx+=(rx-cx)*.12;cy+=(ry-cy)*.12;el.style.transform='perspective(1000px) rotateX('+cx.toFixed(2)+'deg) rotateY('+cy.toFixed(2)+'deg)';
        if(Math.abs(rx-cx)>.01||Math.abs(ry-cy)>.01)raf=requestAnimationFrame(loop);else raf=0}
      el.addEventListener('mousemove',function(e){var r=el.getBoundingClientRect();ry=((e.clientX-r.left)/r.width-.5)*max*2;rx=-((e.clientY-r.top)/r.height-.5)*max*2;if(!raf)raf=requestAnimationFrame(loop)});
      el.addEventListener('mouseleave',function(){rx=ry=0;if(!raf)raf=requestAnimationFrame(loop)});
    });
  }

  /* ---------- 3. Foto do topo deita em perspectiva ao rolar ---------- */
  var hm=document.querySelector('.hero-media');
  if(hm&&!reduce){
    var hp=hm.parentElement;hp.style.perspective='1400px';hm.style.transformOrigin='50% 0%';hm.style.willChange='transform';
    var tick=false;
    function upd(){var r=hm.getBoundingClientRect(),p=Math.min(1,Math.max(0,(innerHeight-r.top-r.height*.35)/innerHeight-.35));
      hm.style.transform='rotateX('+(p*16).toFixed(2)+'deg) scale('+(1-p*.06).toFixed(3)+')';tick=false}
    addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(upd)}},{passive:true});upd();
  }
})();
