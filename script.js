var CHANNEL = '3260324', READ_KEY = 'RSDE9TXRGDX5HIL0', WRITE_KEY = 'W0R5AL9YS3DDDJHL', UPDATE_INTERVAL = 5000;
var fc = 0, minTemp = 999, maxTemp = -999, lastUpdateTime = 0;
var deviceState = { room1: { r: 255, g: 255, b: 255 }, room2: { r: 255, g: 255, b: 255 } };
var historicalData = { pressure: [], temperature: [], humidity: [], maxHistory: 720 };

function $(id){return document.getElementById(id)}

const weatherConditions = [
  { id: 'heavy-rain', icon: '🌧️', name: 'Heavy Rain Soon', p: '📉 Pres: Dropping Fast', desc: 'Precipitation likely within 1-3 hours.' },
  { id: 'rain-likely', icon: '🌦️', name: 'Rain Likely', p: '📉 Pres: Falling', desc: 'Atmospheric conditions favor rain within 3-6 hours.' },
  { id: 'cloudy', icon: '☁️', name: 'Cloudy Weather', p: '📉 Pres: Declining', desc: 'Overcast skies likely.' },
  { id: 'clear-skies', icon: '☀️', name: 'Clear Skies Ahead', p: '📈 Pres: Rising Fast', desc: 'High-pressure system building. Sunny weather expected.' },
  { id: 'improving', icon: '🌤️', name: 'Weather Improving', p: '📈 Pres: Rising', desc: 'Conditions clearing.' },
  { id: 'fair-stable', icon: '☀️', name: 'Fair & Stable', p: '➡️ Pres: High/Stable', desc: 'Stable, pleasant clear skies.' },
  { id: 'unsettled', icon: '🌧️', name: 'Unsettled', p: '📉 Pres: Low', desc: 'Potential for showers.' },
  { id: 'cold-front', icon: '❄️', name: 'Cold Front', p: '📈 Pres: Rising', desc: 'Cooler conditions ahead.' },
  { id: 'warm-front', icon: '🌡️', name: 'Warm Front', p: '📉 Pres: Falling', desc: 'Warmer, more humid conditions.' },
  { id: 'stable', icon: '⛅', name: 'Stable Conditions', p: '➡️ Pres: Stable', desc: 'Current weather pattern persists.' },
  { id: 'partly-cloudy', icon: '⛅', name: 'Partly Cloudy', p: '➡️ Pres: Variable', desc: 'Mix of sun and clouds.' }
];

function renderWeatherCards() {
  const grid = $('conditionsGrid');
  if(!grid) return;
  grid.innerHTML = weatherConditions.map(c => `
    <div class="condition-card" data-condition="${c.id}">
      <h4>${c.icon} ${c.name}</h4><p style="font-size:0.8rem; opacity:0.7">${c.p}</p><p>${c.desc}</p>
    </div>
  `).join('');
}
renderWeatherCards();

function showPage(p) {
  document.querySelectorAll('.page').forEach(pg => pg.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if($(p + '-page')) $(p + '-page').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => { if(b.textContent.toLowerCase().includes(p) || (p==='home' && b.textContent.includes('Home'))) b.classList.add('active'); });
}

function updateClock(){ if($('clockHeader')) $('clockHeader').textContent = new Date().toLocaleTimeString('en-GB'); }
setInterval(updateClock, 1000);

function applyColor(room) {
    const now = Date.now(), btn = document.querySelector(`button[onclick="applyColor(${room})"]`);
    if ((now - lastUpdateTime) / 1000 < 15) {
        const rem = Math.ceil(15 - (now - lastUpdateTime) / 1000);
        btn.textContent = `⏳ Wait ${rem}s`;
        setTimeout(() => { btn.textContent = room === 1 ? "Apply to Arduino" : "Apply to M5Stack"; }, 2000); return; 
    }
    const hex = $(`colorPicker${room}`).value.replace('#', '');
    deviceState[`room${room}`] = { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
    const s = deviceState;
    const data = `${s.room1.r},${s.room1.g},${s.room1.b},${s.room2.r},${s.room2.g},${s.room2.b}`;
    fetch(`https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field8=${data}`).then(() => { 
        lastUpdateTime = Date.now(); btn.textContent = "✅ Synced"; 
        setTimeout(() => { btn.textContent = room === 1 ? "Apply to Arduino" : "Apply to M5Stack"; }, 3000);
    });
}

function updateOfficeLights(val) {
  const iconM5 = $('bulb2'), iconArdu = $('bulb4'), s2 = $('status2'), s4 = $('status4');
  [iconM5, iconArdu].forEach(i => { if(i) { i.classList.remove('on'); i.style.boxShadow = 'none'; }});
  if(val > 0) {
    [iconM5, iconArdu].forEach(i => { if(i) { i.classList.add('on'); i.style.boxShadow = `0 0 ${val}px yellow`; }});
    if(s2) s2.textContent = val + '%'; if(s4) s4.textContent = val + '%';
  }
}

function drawChart(canvasId, data, color, unit, minId, maxId, avgId) {
  const canvas = $(canvasId); if(!canvas || !data.length) return;
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; ctx.scale(dpr, dpr);
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  data.forEach((v, i) => ctx.lineTo((i/(data.length-1))*canvas.clientWidth, canvas.clientHeight - ((v-mn)/range)*(canvas.clientHeight-40)));
  ctx.stroke();
  if($(minId)) $(minId).textContent = mn.toFixed(1) + unit;
  if($(maxId)) $(maxId).textContent = mx.toFixed(1) + unit;
  if(avgId && $(avgId)) $(avgId).textContent = (data.reduce((a,b)=>a+b,0)/data.length).toFixed(1) + unit;
}

function fetchData() {
  fetch(`https://api.thingspeak.com/channels/${CHANNEL}/feeds.json?api_key=${READ_KEY}&results=100`)
    .then(res => res.json()).then(d => {
      const f = d.feeds[d.feeds.length-1];
      const t = parseFloat(f.field1), h = parseFloat(f.field2), p = parseFloat(f.field3);
      historicalData.pressure.push(p);
      if($('tv')) $('tv').textContent = t.toFixed(1) + '°C';
      if($('hv')) $('hv').textContent = h.toFixed(1) + '%';
      if($('pv')) $('pv').textContent = p.toFixed(1) + 'hPa';
      if(t < minTemp) minTemp = t; if(t > maxTemp) maxTemp = t;
      if($('weatherHi')) $('weatherHi').textContent = maxTemp.toFixed(1);
      if($('weatherLo')) $('weatherLo').textContent = minTemp.toFixed(1);
      
      const trend = p - (historicalData.pressure[historicalData.pressure.length - 12] || p);
      const forecast = trend < -1 ? 'Heavy Rain Soon' : trend > 1 ? 'Clear Skies Ahead' : 'Stable Conditions';
      if($('forecast')) $('forecast').textContent = forecast;
      
      updateOfficeLights(parseInt(f.field4) || 0);
      drawChart('c1', d.feeds.map(x => parseFloat(x.field1)||0), '#ff6b6b', '°C', 'tempMin', 'tempMax', 'tempAvg');
      drawChart('c2', d.feeds.map(x => parseFloat(x.field2)||0), '#4ecdc4', '%', 'humMin', 'humMax');
      drawChart('c3', d.feeds.map(x => parseFloat(x.field3)||0), '#ffd93d', 'hPa', 'presMin', 'presMax');
      drawChart('c4', d.feeds.map(x => parseInt(x.field4)||0), '#ffd93d', '%', 'lightMin', 'lightMax');
      ['st','st2','st3','st4'].forEach(id => { if($(id)) $(id).className = 'sd ok'; });
    });
}
fetchData(); setInterval(fetchData, 5000);
