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
   ' return C3*(.55+.45*dif)*(.7+.3*ao)+spe*.25+fre*.12;}'].join('\n')
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
    var FS=COMMON+'\n'+(SHAPES[cv.dataset.shape]||SHAPES.tooth)+'\n'+MAIN;
    function sh(t,src){var s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))console.warn(gl.getShaderInfoLog(s));return s}
    var pr=gl.createProgram();gl.attachShader(pr,sh(gl.VERTEX_SHADER,VS));gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,FS));gl.linkProgram(pr);
    if(!gl.getProgramParameter(pr,gl.LINK_STATUS))return;gl.useProgram(pr);
    var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var al=gl.getAttribLocation(pr,'a');gl.enableVertexAttribArray(al);gl.vertexAttribPointer(al,2,gl.FLOAT,false,0,0);
    var U={};['R','T','M','S','C1','C2','C3'].forEach(function(k){U[k]=gl.getUniformLocation(pr,k)});
    gl.uniform3fv(U.C1,hex(cv.dataset.c1||'#ffffff'));gl.uniform3fv(U.C2,hex(cv.dataset.c2||'#dddddd'));gl.uniform3fv(U.C3,hex(cv.dataset.c3||'#888888'));
    var vis=false,mx=0,my=0,tx=0,ty=0,sc=0,t0=performance.now();
    function size(){var d=Math.min(devicePixelRatio||1,1.6),r=cv.getBoundingClientRect();cv.width=Math.max(1,r.width*d);cv.height=Math.max(1,r.height*d);gl.viewport(0,0,cv.width,cv.height)}
    size();addEventListener('resize',size);
    if(fine)addEventListener('mousemove',function(e){tx=(e.clientX/innerWidth-.5);ty=(e.clientY/innerHeight-.5)});
    new IntersectionObserver(function(es){vis=es[0].isIntersecting;if(vis)requestAnimationFrame(draw)}).observe(cv);
    function draw(now){
      mx+=(tx-mx)*.05;my+=(ty-my)*.05;
      var r=cv.getBoundingClientRect();sc+=(((innerHeight-r.top)/(innerHeight+r.height))-sc)*.08;
      gl.uniform2f(U.R,cv.width,cv.height);gl.uniform1f(U.T,reduce?0:(now-t0)/1000);gl.uniform2f(U.M,mx,my);gl.uniform1f(U.S,reduce?0:sc);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
      cv.style.transform='translate3d(0,'+((.5-sc)*60).toFixed(1)+'px,0)';
      if(vis&&!reduce)requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
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
