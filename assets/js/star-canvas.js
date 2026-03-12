(function () {
  var canvas = document.getElementById('star-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W, H, stars = [], shooters = [];

  function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();

  function makeStar() {
    return { x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.05+0.2,
      alpha: Math.random()*0.45+0.08, speed: Math.random()*0.008+0.003,
      offset: Math.random()*Math.PI*2, warm: Math.random()<0.28 };
  }
  for (var i = 0; i < 150; i++) stars.push(makeStar());

  function makeShooter() {
    var x = W*0.35+Math.random()*W*0.65, y = Math.random()*H*0.55;
    var ang = Math.PI*(0.72+Math.random()*0.16), spd = 2.8+Math.random()*2.4;
    return { x:x, y:y, vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd,
      alpha:0.85+Math.random()*0.15, life:1, decay:0.012+Math.random()*0.01, warm:Math.random()<0.45 };
  }
  function spawnShooter() { shooters.push(makeShooter()); setTimeout(spawnShooter, 1800+Math.random()*1700); }
  setTimeout(spawnShooter, 800);

  var t = 0;
  function draw() {
    requestAnimationFrame(draw);
    ctx.clearRect(0, 0, W, H);
    t += 0.016;
    stars.forEach(function(s) {
      var a = s.alpha * (0.65 + 0.35 * Math.sin(t * s.speed * 60 + s.offset));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = s.warm ? 'rgba(255,190,100,'+a+')' : 'rgba(240,240,255,'+a+')';
      ctx.fill();
    });
    shooters = shooters.filter(function(s) { return s.life > 0; });
    shooters.forEach(function(s) {
      var tx = s.x - s.vx*6, ty = s.y - s.vy*6;
      var g = ctx.createLinearGradient(tx, ty, s.x, s.y);
      if (s.warm) {
        g.addColorStop(0, 'rgba(255,160,60,0)');
        g.addColorStop(0.6, 'rgba(255,190,80,'+(s.life*0.35)+')');
        g.addColorStop(1, 'rgba(255,220,140,'+(s.life*s.alpha)+')');
      } else {
        g.addColorStop(0, 'rgba(200,210,255,0)');
        g.addColorStop(0.6, 'rgba(220,225,255,'+(s.life*0.3)+')');
        g.addColorStop(1, 'rgba(255,255,255,'+(s.life*s.alpha)+')');
      }
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = g; ctx.lineWidth = s.life*1.6; ctx.lineCap = 'round'; ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x, s.y, s.life*1.4, 0, Math.PI*2);
      ctx.fillStyle = s.warm ? 'rgba(255,220,140,'+(s.life*0.9)+')' : 'rgba(255,255,255,'+(s.life*0.9)+')';
      ctx.fill();
      s.x += s.vx; s.y += s.vy; s.life -= s.decay;
    });
  }
  draw();
})();
