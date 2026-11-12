/* Efeitos 3D: pérola líquida em WebGL, inclinação 3D com o mouse e foto do topo em perspectiva no scroll.
   Projeto conceitual de Yago Moreira (yagoportfolio.com.br) */
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
  function hex(h){h=h.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255]}

  /* ---------- 1. Pérola 3D (raymarching em shader) ---------- */
  var FS=[
  'precision highp float;',
  'uniform vec2 R;uniform float T;uniform vec2 M;uniform float S;uniform vec3 C1,C2,C3;',
  'mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}',
  'float map(vec3 p){',
  ' p.xz*=rot(T*.25+M.x*.8+S*2.2); p.yz*=rot(M.y*.6+S*1.2);',
  ' float d=length(p)-1.;',
  ' d+=.11*sin(2.6*p.x+T*1.1)*sin(2.4*p.y+T*.9)*sin(2.8*p.z+T*.7);',
  ' d+=.04*sin(6.*p.y+T*1.6)*sin(5.*p.x-T);',
  ' return d*.62;}',
  'vec3 nor(vec3 p){vec2 e=vec2(.002,0);return normalize(vec3(map(p+e.xyy)-map(p-e.xyy),map(p+e.yxy)-map(p-e.yxy),map(p+e.yyx)-map(p-e.yyx)));}',
  'void main(){',
  ' vec2 uv=(gl_FragCoord.xy-.5*R)/R.y;',
  ' vec3 ro=vec3(0,0,4.4),rd=normalize(vec3(uv,-1.6));',
  ' float t=0.,d;bool hit=false;',
  ' for(int i=0;i<72;i++){d=map(ro+rd*t);if(d<.001){hit=true;break;}t+=d;if(t>8.)break;}',
  ' if(!hit){gl_FragColor=vec4(0);return;}',
  ' vec3 p=ro+rd*t,n=nor(p);',
  ' vec3 L=normalize(vec3(-.5,.8,.6)),L2=normalize(vec3(.7,-.3,.4));',
  ' float dif=max(dot(n,L),0.),dif2=max(dot(n,L2),0.);',
  ' float fre=pow(1.-max(dot(n,-rd),0.),2.6);',
  ' float spe=pow(max(dot(reflect(rd,n),L),0.),48.);',
  ' vec3 base=mix(C2,C1,.5+.5*n.y);',
  ' vec3 irid=.5+.5*cos(6.2831*(fre*.9+n.x*.15+vec3(0.,.33,.67)));',
  ' vec3 col=base*(.55+.45*dif)+C2*dif2*.15;',
  ' col=mix(col,C3,fre*.55);',
  ' col+=irid*fre*.18+spe*.9;',
  ' gl_FragColor=vec4(col,1.);}'].join('\n');
  var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';

  function pearl(cv){
    var gl=cv.getContext('webgl',{premultipliedAlpha:true,alpha:true,antialias:true});if(!gl)return;
    function sh(t,src){var s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);return s}
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
