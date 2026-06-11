/* ═══════════════════════════════════════════
   HERO BACKGROUND — Particle / Constellation Canvas
   Floating molecular nodes + faint connecting lines
   + slow mouse-parallax drift
═══════════════════════════════════════════ */

(function () {
  'use strict';

  // Respect reduced-motion preference
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ── Config ──────────────────────────────
  const CONFIG = {
    nodeCount: 52,
    connectionDistance: 160,  // px — max distance to draw a line
    nodeMinR: 1.2,
    nodeMaxR: 2.8,
    speedMin: 0.12,
    speedMax: 0.38,
    // Blue accent pulled from CSS token --color-primary: #5B8CFF
    accentR: 91, accentG: 140, accentB: 255,
    lineOpacityMax: 0.13,
    dotOpacityMin: 0.18,
    dotOpacityMax: 0.55,
    parallaxStrength: 18,   // px max shift on mouse move
    fadeInDuration: 1800,   // ms — canvas fades in on load
  };

  // ── State ───────────────────────────────
  let W, H, dpr;
  let nodes = [];
  let mouse = { x: 0, y: 0 };
  let parallaxOffset = { x: 0, y: 0 };
  let startTime = null;
  let raf;

  // ── Node factory ────────────────────────
  function makeNode(w, h) {
    const speed = CONFIG.speedMin + Math.random() * (CONFIG.speedMax - CONFIG.speedMin);
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      r: CONFIG.nodeMinR + Math.random() * (CONFIG.nodeMaxR - CONFIG.nodeMinR),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      opacity: CONFIG.dotOpacityMin + Math.random() * (CONFIG.dotOpacityMax - CONFIG.dotOpacityMin),
      // subtle opacity breathing
      breathPhase: Math.random() * Math.PI * 2,
      breathSpeed: 0.004 + Math.random() * 0.006,
    };
  }

  // ── Resize ──────────────────────────────
  function resize() {
    const hero = canvas.parentElement.parentElement; // .hero-bg → .hero
    W = hero.offsetWidth;
    H = hero.offsetHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // Repopulate on resize
    nodes = Array.from({ length: CONFIG.nodeCount }, () => makeNode(W, H));
  }

  // ── Mouse parallax ──────────────────────
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }

  // ── Draw ────────────────────────────────
  function draw(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const fadeAlpha = Math.min(elapsed / CONFIG.fadeInDuration, 1);

    // Smooth parallax lerp
    const targetX = ((mouse.x / W) - 0.5) * -CONFIG.parallaxStrength;
    const targetY = ((mouse.y / H) - 0.5) * -CONFIG.parallaxStrength;
    parallaxOffset.x += (targetX - parallaxOffset.x) * 0.04;
    parallaxOffset.y += (targetY - parallaxOffset.y) * 0.04;

    ctx.clearRect(0, 0, W, H);

    // Apply parallax via transform
    ctx.save();
    ctx.translate(parallaxOffset.x, parallaxOffset.y);

    const { accentR: r, accentG: g, accentB: b } = CONFIG;

    // ── Draw connections ──
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], bN = nodes[j];
        const dx = a.x - bN.x;
        const dy = a.y - bN.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONFIG.connectionDistance) {
          const strength = 1 - dist / CONFIG.connectionDistance;
          const alpha = strength * CONFIG.lineOpacityMax * fadeAlpha;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(bN.x, bN.y);
          ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // ── Draw nodes ──
    for (const node of nodes) {
      node.breathPhase += node.breathSpeed;
      const breathMod = 0.5 + 0.5 * Math.sin(node.breathPhase);
      const alpha = (node.opacity * (0.6 + 0.4 * breathMod)) * fadeAlpha;

      // Outer glow
      const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, node.r * 4);
      grd.addColorStop(0, `rgba(${r},${g},${b},${alpha * 0.5})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * 4, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Core dot
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();

      // Move node
      node.x += node.vx;
      node.y += node.vy;

      // Wrap edges (with a small buffer so nodes fade in smoothly)
      const buf = 20;
      if (node.x < -buf) node.x = W + buf;
      if (node.x > W + buf) node.x = -buf;
      if (node.y < -buf) node.y = H + buf;
      if (node.y > H + buf) node.y = -buf;
    }

    ctx.restore();
    raf = requestAnimationFrame(draw);
  }

  // ── Init ────────────────────────────────
  function init() {
    resize();
    window.addEventListener('resize', () => {
      cancelAnimationFrame(raf);
      ctx.setTransform(1, 0, 0, 1, 0, 0); // reset before resize rescales
      resize();
      startTime = null;
      raf = requestAnimationFrame(draw);
    }, { passive: true });

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    raf = requestAnimationFrame(draw);
  }

  // Wait for hero to be sized
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
