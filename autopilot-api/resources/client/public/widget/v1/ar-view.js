(function(l){"use strict";function d(t){return new Promise((n,r)=>{if(document.querySelector(`script[src="${t}"]`)){n();return}const a=document.createElement("script");a.src=t,a.async=!0,a.onload=()=>n(),a.onerror=()=>r(new Error(`Failed to load ${t}`)),document.head.appendChild(a)})}const h="https://aframe.io/releases/1.5.0/aframe.min.js",f="https://cdn.jsdelivr.net/gh/AR-js-org/AR.js@3.4.7/aframe/build/aframe-ar-nft.js";async function u(t){await d(h),await d(f);const n=document.createElement("div");n.id="ap-ar-overlay",n.style.cssText="position:fixed;inset:0;z-index:2147483646;background:#000;font-family:system-ui,sans-serif;";const r=document.createElement("button");r.type="button",r.textContent="✕ Close AR",r.style.cssText="position:absolute;top:16px;right:16px;z-index:10;padding:10px 16px;border:none;border-radius:10px;background:rgba(255,255,255,0.95);font-weight:600;cursor:pointer;",n.appendChild(r);const a=document.createElement("div");a.textContent=t.markerUrl?"Point your camera at the marker image":"Move your phone to place the agent in view",a.style.cssText="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);z-index:10;color:#fff;font-size:13px;background:rgba(0,0,0,0.55);padding:8px 14px;border-radius:999px;white-space:nowrap;",n.appendChild(a);const g=t.markerUrl?`
    <a-scene
      embedded
      arjs="sourceType: webcam; debugUIEnabled: false; detectionMode: mono_and_matrix; matrixCodeType: 3x3;"
      vr-mode-ui="enabled: false"
      renderer="alpha: true; antialias: true;"
      style="width:100%;height:100%;"
    >
      <a-nft
        type="nft"
        url="${y(t.markerUrl.replace(/\.(png|jpg|jpeg|webp)$/i,""))}"
        smooth="true"
        smoothCount="10"
        smoothTolerance="0.01"
        smoothThreshold="5"
      >
        <a-entity id="ap-ar-avatar" position="0 0 0" scale="5 5 5"></a-entity>
      </a-nft>
      <a-entity camera></a-entity>
    </a-scene>`:`
    <a-scene
      embedded
      arjs="sourceType: webcam; debugUIEnabled: false;"
      vr-mode-ui="enabled: false"
      renderer="alpha: true; antialias: true;"
      style="width:100%;height:100%;"
    >
      <a-entity id="ap-ar-avatar" position="0 0 -1.2" scale="0.5 0.5 0.5"></a-entity>
      <a-entity camera></a-entity>
    </a-scene>`;n.insertAdjacentHTML("beforeend",g),document.body.appendChild(n);const o=n.querySelector("#ap-ar-avatar");if(t.modelUrl&&(o!=null&&o.setAttribute))o.setAttribute("gltf-model",`url(${t.modelUrl})`);else if(o!=null&&o.setAttribute){o.setAttribute("geometry","primitive: box; width: 0.4; height: 0.8; depth: 0.3"),o.setAttribute("material",`color: ${t.primaryColor}`);const e=document.createElement("a-sphere");e.setAttribute("radius","0.22"),e.setAttribute("position","0 0.55 0"),e.setAttribute("material","color: #ffdbac"),o.appendChild(e)}let s=t.controller.getState(),c=0,i=0;const A=t.controller.onState(e=>{s=e}),x=t.controller.onLipSync(e=>{c=e});let p=0;function m(){p=requestAnimationFrame(m),i+=.016;const e=o;e!=null&&e.object3D&&(s==="speaking"?(e.object3D.rotation.y=Math.sin(i*2)*.1,e.object3D.position.y=Math.sin(i*10)*.02*c,e.object3D.scale.y=1+c*.06):s==="thinking"?(e.object3D.rotation.x=-.15+Math.sin(i)*.05,e.object3D.rotation.y=Math.sin(i*.7)*.12):s==="listening"?e.object3D.rotation.y=Math.sin(i*.5)*.08:(e.object3D.rotation.y=Math.sin(i*.35)*.05,e.object3D.rotation.x*=.95))}m();function b(){cancelAnimationFrame(p),A(),x(),n.remove()}return r.addEventListener("click",b),{close:b}}function y(t){return t.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;")}window.AutopilotArView=u,l.openArView=u,Object.defineProperty(l,Symbol.toStringTag,{value:"Module"})})(this.AutopilotArView=this.AutopilotArView||{});
