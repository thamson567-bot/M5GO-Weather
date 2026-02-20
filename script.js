var CHANNEL = '3260324', READ_KEY = 'RSDE9TXRGDX5HIL0', WRITE_KEY = 'W0R5AL9YS3DDDJHL', UPDATE_INTERVAL = 5000;
var fc = 0, minTemp = 999, maxTemp = -999, lastUpdateTime = 0;
var deviceState = { room1: { r: 255, g: 255, b: 255 }, room2: { r: 255, g: 255, b: 255 } };
var historicalData = { pressure: [], temperature: [], humidity: [], maxHistory: 720 };

function $(id){return document.getElementById(id)}

// --- RESTORED 11 WEATHER CONDITIONS ---
const weatherConditions = [
  { id: 'heavy-rain', icon: '🌧️', name: 'Heavy Rain Soon', p: '📉 Pressure: Dropping Fast', h: '💧 Humidity: Rising', t: '🌡️ Temperature: Variable', desc: 'Strong weather system approaching. Precipitation within 1-3 hours.' },
  { id: 'rain-likely', icon: '🌦️', name: 'Rain Likely', p: '📉 Pressure: Falling', h: '💧 Humidity: High (>75%)', t: '🌡️ Temperature: Moderate', desc: 'Atmospheric conditions favor rain within 3-6 hours.' },
  { id: 'cloudy', icon: '☁️', name: 'Cloudy Weather', p: '📉 Pressure: Declining Steadily', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Stable', desc: 'Overcast skies likely with no immediate precipitation.' },
  { id: 'clear-skies', icon: '☀️', name: 'Clear Skies Ahead', p: '📈 Pressure: Rising Rapidly', h: '💧 Humidity: Decreasing', t: '🌡️ Temperature: Variable', desc: 'High-pressure system building. Sunny weather expected.' },
  { id: 'improving', icon: '🌤️', name: 'Weather Improving', p: '📈 Pressure: Rising Steadily', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Stable', desc: 'Conditions clearing with reduced precipitation chance.' },
  { id: 'fair-stable', icon: '☀️', name: 'Fair & Stable', p: '➡️ Pressure: High & Stable', h: '💧 Humidity: Low (<60%)', t: '🌡️ Temperature: Comfortable', desc: 'Stable, pleasant conditions with clear skies.' },
  { id: 'unsettled', icon: '🌧️', name: 'Unsettled Weather', p: '📉 Pressure: Low (<1010 hPa)', h: '💧 Humidity: High (>70%)', t: '🌡️ Temperature: Variable', desc: 'Low pressure creates potential for showers.' },
  { id: 'cold-front', icon: '❄️', name: 'Cold Front Moving In', p: '📈 Pressure: Rising', h: '💧 Humidity: Variable', t: '🌡️ Temperature: Dropping', desc: 'Cooler, clearer conditions ahead.' },
  { id: 'warm-front', icon: '🌡️', name: 'Warm Front Approaching', p: '📉 Pressure: Falling', h: '💧 Humidity: Rising', t: '🌡️ Temperature: Rising', desc: 'Warmer, more humid conditions developing.' },
  { id: 'stable', icon: '⛅', name: 'Stable Conditions', p: '➡️ Pressure: Stable', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Stable', desc: 'Current weather pattern expected to persist.' },
  { id: 'partly-cloudy', icon: '⛅', name: 'Partly Cloudy', p: '➡️ Pressure: Variable', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Moderate', desc: 'Mix of sun and clouds with no significant changes.' }
];

function renderWeatherCards() {
  const grid = $('conditionsGrid');
  if(!grid) return;
  grid.innerHTML = weatherConditions.map(c => `
    <div class="condition-card" data-condition="${c.id}">
      <div class="condition-header"><div class="condition-icon">${c.icon}</div><div class="condition-name">${c.name}</div></div>
      <div class="condition-indicators"><span class="indicator">${c.p}</span><span class="indicator">${c.h}</span></div>
      <div class="condition-description">${c.desc}</div>
    </div>
  `).join('');
}
renderWeatherCards();

// --- RESTORED FORECAST & STATS LOGIC ---
function highlightCurrentCondition(forecastText) {
  document.querySelectorAll('.condition-card').forEach(card => card.classList.remove('active'));
  const map = { 'Heavy Rain Soon': 'heavy-rain', 'Clear Skies Ahead': 'clear-skies', 'Fair & Stable': 'fair-stable', 'Partly Cloudy': 'partly-cloudy', 'Stable Conditions': 'stable' };
  const card = document.querySelector(`.condition-card[data-condition="${map[forecastText]}"]`);
  if(card) card.classList.add('active');
}

function updateOfficeLights(val) {
  const iconM5 = $('bulb2'), iconArdu = $('bulb4');
  [iconM5, iconArdu].forEach(i => { if(i) i.classList.remove('on'); i.style.boxShadow = 'none'; });
  if(val > 0) {
    const intensity = Math.min(val, 100), glow = `0 0 ${intensity}px rgba(255,255,153,${intensity/100})`;
    if(iconM5) { iconM5.classList.add('on'); iconM5.style.boxShadow = glow; }
    if(iconArdu) { iconArdu.classList.add('on'); iconArdu.style.boxShadow = glow; }
    if($('status2')) $('status2').textContent = intensity + '%';
    if($('status4')) $('status4').textContent = intensity + '%';
  }
}

function drawChart(canvasId, data, color, unit, minId, maxId, avgId) {
  const canvas = $(canvasId);
  if(!canvas || data.length === 0) return;
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; ctx.scale(dpr, dpr);
  const mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * canvas.clientWidth, canvas.clientHeight - ((v - mn) / range) * (canvas.clientHeight - 40)]);
  ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
  ctx.stroke();
  if($(minId)) $(minId).textContent = mn.toFixed(1) + unit;
  if($(maxId)) $(maxId).textContent = mx.toFixed(1) + unit;
  if(avgId && $(avgId)) $(avgId).textContent = (data.reduce((a,b)=>a+b,0)/data.length).toFixed(1) + unit;
}

function fetchData() {
  fetch(`https://api.thingspeak.com/channels/${CHANNEL}/feeds.json?api_key=${READ_KEY}&results=100`)
    .then(res => res.json()).then(d => {
      if(!d.feeds.length) return;
      fc++; const f = d.feeds[d.feeds.length-1];
      const t = parseFloat(f.field1), h = parseFloat(f.field2), p = parseFloat(f.field3);
      historicalData.pressure.push(p);
      
      if($('tv')) $('tv').innerHTML = t.toFixed(1) + '°C';
      if($('hv')) $('hv').innerHTML = h.toFixed(1) + '%';
      if($('pv')) $('pv').innerHTML = p.toFixed(1) + ' hPa';

      if(t < minTemp) minTemp = t; if(t > maxTemp) maxTemp = t;
      if($('weatherHi')) $('weatherHi').textContent = maxTemp.toFixed(1);
      if($('weatherLo')) $('weatherLo').textContent = minTemp.toFixed(1);

      // Simple Forecast Logic
      let trend = p - (historicalData.pressure[historicalData.pressure.length - 12] || p);
      let forecast = trend < -1 ? 'Heavy Rain Soon' : trend > 1 ? 'Clear Skies Ahead' : 'Stable Conditions';
      if($('forecast')) $('forecast').textContent = forecast;
      highlightCurrentCondition(forecast);

      updateOfficeLights(parseInt(f.field4) || 0);
      drawChart('c1', d.feeds.map(x => parseFloat(x.field1)||0), '#ff6b6b', '°C', 'tempMin', 'tempMax', 'tempAvg');
      drawChart('c2', d.feeds.map(x => parseFloat(x.field2)||0), '#4ecdc4', '%', 'humMin', 'humMax');
      drawChart('c3', d.feeds.map(x => parseFloat(x.field3)||0), '#ffd93d', 'hPa', 'presMin', 'presMax');
      drawChart('c4', d.feeds.map(x => parseInt(x.field4)||0), '#ffd93d', '%', 'lightMin', 'lightMax');
    });
}
fetchData(); setInterval(fetchData, UPDATE_INTERVAL);
