(() => {
  window.TUMBLEBLOCK_SCREEN_ORBIT = true;
  window.TUMBLEBLOCK_SHOW_CAMERA_AXES ||= false;
  const quarter = Math.PI / 2, pixelsPerQuarter = 150;
  let viewBasis = currentView(), orbitPointer = null, viewSnap = null;
  const baseRender = render;
  const drawAxisPreview = () => {
    if (!orbitPointer?.moved) return;
    const center = { x: canvas.clientWidth / 2, y: canvas.clientHeight * .65 }, length = Math.min(canvas.clientWidth, canvas.clientHeight) * .19;
    const horizontalAmount = Math.abs(orbitPointer.horizontal), verticalAmount = Math.abs(orbitPointer.vertical), maximum = Math.max(horizontalAmount, verticalAmount);
    const drawAxis = (direction, amount, color) => { if (amount < .02) return; const start={x:center.x-direction[0]*length,y:center.y-direction[1]*length},end={x:center.x+direction[0]*length,y:center.y+direction[1]*length}; ctx.save();ctx.globalAlpha=amount===maximum?1:.35;ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=amount===maximum?3:2;ctx.setLineDash([8,6]);ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();ctx.setLineDash([]);for(const point of [start,center,end]){ctx.beginPath();ctx.arc(point.x,point.y,point===center?6:4,0,Math.PI*2);ctx.fill();}ctx.restore(); };
    drawAxis([0,1],horizontalAmount,"#1687ff"); drawAxis([1,0],verticalAmount,"#ff315b");
    const dominantHorizontal=horizontalAmount>=verticalAmount,label=dominantHorizontal?"BLUE: FIXED SCREEN VERTICAL AXIS":"RED: FIXED SCREEN HORIZONTAL AXIS";ctx.save();ctx.font="600 11px system-ui, sans-serif";ctx.textAlign="center";const textWidth=ctx.measureText(label).width,labelY=center.y+length+22;ctx.fillStyle="rgba(247, 244, 237, .92)";ctx.fillRect(center.x-textWidth/2-7,labelY-13,textWidth+14,18);ctx.fillStyle=dominantHorizontal?"#1687ff":"#ff315b";ctx.fillText(label,center.x,labelY);ctx.restore();
  };
  render = function(){baseRender(); if (window.TUMBLEBLOCK_SHOW_CAMERA_AXES) drawAxisPreview();};
  const normalized=vector=>{const length=Math.hypot(...vector);return vector.map(value=>value/length);};
  const rotateAround=(vector,axis,angle)=>{const cosine=Math.cos(angle),sine=Math.sin(angle),crossed=cross(axis,vector),aligned=dot(axis,vector)*(1-cosine);return vector.map((value,index)=>value*cosine+crossed[index]*sine+axis[index]*aligned);};
  const basisAt=(start,horizontal,vertical)=>{const afterHorizontal={right:rotateAround(start.right,start.up,horizontal),up:start.up,depth:rotateAround(start.depth,start.up,horizontal)};return{right:afterHorizontal.right,up:rotateAround(afterHorizontal.up,start.right,vertical),depth:rotateAround(afterHorizontal.depth,start.right,vertical)};};
  const orthonormal=basis=>{const right=normalized(basis.right),depth=normalized(cross(right,basis.up)),up=normalized(cross(depth,right));return{right,up,depth};};
  const isometricViews=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>{const depth=normalized([x,y,z]),right=normalized([depth[1],-depth[0],0]),up=normalized(cross(right,depth));return{right,up,depth};})));
  const nearestIsometric=basis=>isometricViews.map(view=>({view,score:dot(view.depth,basis.depth)})).sort((a,b)=>b.score-a.score)[0].view;
  currentView=function(now=performance.now()){if(!viewSnap)return viewBasis;const raw=Math.min(1,(now-viewSnap.started)/viewSnap.duration),eased=raw*raw*(3-2*raw);return orthonormal({right:viewSnap.from.right.map((value,index)=>value+(viewSnap.to.right[index]-value)*eased),up:viewSnap.from.up.map((value,index)=>value+(viewSnap.to.up[index]-value)*eased),depth:viewSnap.from.depth.map((value,index)=>value+(viewSnap.to.depth[index]-value)*eased)});};
  canvas.addEventListener("pointerdown",event=>{if(animation||cameraSnap)return;const point=localPoint(event),face=[...hitFaces].reverse().find(item=>pointInPoly(point,item.poly));if(face)return;event.stopImmediatePropagation();canvas.setPointerCapture(event.pointerId);orbitPointer={pointerId:event.pointerId,start:point,startBasis:viewBasis,horizontal:0,vertical:0,moved:false};},true);
  canvas.addEventListener("pointermove",event=>{if(!orbitPointer||event.pointerId!==orbitPointer.pointerId||animation)return;event.stopImmediatePropagation();const point=localPoint(event),dx=point.x-orbitPointer.start.x,dy=point.y-orbitPointer.start.y;if(Math.hypot(dx,dy)<3)return;orbitPointer.moved=true;orbitPointer.horizontal=-dx/pixelsPerQuarter*quarter;orbitPointer.vertical=-dy/pixelsPerQuarter*quarter;viewBasis=orthonormal(basisAt(orbitPointer.startBasis,orbitPointer.horizontal,orbitPointer.vertical));render();},true);
  const finishOrbit=event=>{if(!orbitPointer||event.pointerId!==orbitPointer.pointerId)return;event.stopImmediatePropagation();const finished=orbitPointer;orbitPointer=null;if(!finished.moved)return;viewSnap={from:viewBasis,to:nearestIsometric(viewBasis),started:performance.now(),duration:260};cameraSnap=viewSnap;playSound("camera");render();setTimeout(()=>{viewBasis=viewSnap.to;viewSnap=null;cameraSnap=null;render();},viewSnap.duration);};
  canvas.addEventListener("pointerup",finishOrbit,true);canvas.addEventListener("pointercancel",finishOrbit,true);
})();
