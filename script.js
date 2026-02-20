var CHANNEL = '3260324';
var READ_KEY = 'RSDE9TXRGDX5HIL0';
var WRITE_KEY = 'W0R5AL9YS3DDDJHL';
var UPDATE_INTERVAL = 5000;

var fc = 0, minTemp = 999, maxTemp = -999, globalLastLight = 0, lastSentForecast = -1, lastUpdateTime = 0;
var deviceState = { room1: { r: 255, g: 255, b: 255 }, room2: { r: 255, g: 255, b: 255 } };
var historicalData = { pressure: [], temperature: [], humidity: [], timestamps: [], maxHistory: 720 };
var currentForecastCode = -1;

function $(id){return document.getElementById(id)}

// Send weather forecast every 3 minutes
setInterval(function() { if (currentForecastCode > 0) sendForecastToThingSpeak(currentForecastCode); }, 180000);

const weatherConditions = [
  { id: 'heavy-rain', icon: '🌧️', name: 'Heavy Rain Soon', p: '📉 Pressure: Dropping Fast', h: '💧 Humidity: Rising', t: '🌡️ Temperature: Variable', desc: 'Strong weather system approaching. Precipitation likely within 1-3 hours.' },
  { id: 'rain-likely', icon: '🌦️', name: 'Rain Likely', p: '📉 Pressure: Falling', h: '💧 Humidity: High (>75%)', t: '🌡️ Temperature: Moderate', desc: 'Atmospheric conditions favor precipitation within 3-6 hours.' },
  { id: 'clear-skies', icon: '☀️', name: 'Clear Skies Ahead', p: '📈 Pressure: Rising Rapidly', h: '💧 Humidity: Decreasing', t: '🌡️ Temperature: Variable', desc: 'High-pressure system building. Sunny weather conditions expected.' },
  { id: 'fair-stable', icon: '☀️', name: 'Fair & Stable', p: '➡️ Pressure: High & Stable', h: '💧 Humidity: Low (<60%)', t: '🌡️ Temperature: Comfortable', desc: 'Stable, pleasant conditions with clear skies.' }
];

function renderWeatherCards() {
  const grid = $('conditionsGrid');
  if(!grid) return;
  grid.innerHTML = weatherConditions.map(c => `<div class="condition-card" data-condition="${c.id}"><div class="condition-header"><div class="condition-icon">${c.icon}</div><div class="condition-name">${c.name}</div></div><div class="condition-indicators"><span class="indicator">${c.p}</span><span class="indicator">${c.h}</span></div><div class="condition-description">${c.desc}</div></div>`).join('');
}
renderWeatherCards();

function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if($(page + '-page')) $(page + '-page').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => { if(b.textContent.toLowerCase().includes(page) || (page === 'home' && b.textContent.includes('Home'))) b.classList.add('active'); });
}

function updateClock(){
  var n = new Date();
  if($('clockHeader')) $('clockHeader').textContent = n.toLocaleTimeString('en-GB');
}
setInterval(updateClock, 1000);

function sendForecastToThingSpeak(forecastCode) {
  if (forecastCode <= 0) return; 
  fetch(`https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field7=${forecastCode}&t=${Date.now()}`).catch(err => console.error(err));
}

function processEntryLogs(feeds) {
  const allowedUsers = { "21 4D 5D 5D": "PANG SHENG YUAN", "F1 96 EA 01": "THIRSHEN S/O SIVA BALAN", "51 FC BA 5D": "CHEW QIBIN BRYANT" };
  let html = '', todayCount = 0, todayStr = new Date().toDateString();
  for(let i = feeds.length - 1; i >= 0; i--) {
    let uid = (feeds[i].field5 || "").trim().toUpperCase();
    if(allowedUsers[uid]) {
      let dateObj = new Date(feeds[i].created_at);
      if(dateObj.toDateString() === todayStr) todayCount++;
      html += `<tr><td>${dateObj.toLocaleString()}</td><td style="color:var(--accent);font-weight:600">${allowedUsers[uid]}</td><td>${uid}</td><td>ENTRY</td></tr>`;
    }
  }
  if($('logTableBody')) $('logTableBody').innerHTML = html || '<tr><td colspan="4">Waiting for RFID taps...</td></tr>';
  if($('homeEntries')) $('homeEntries').textContent = todayCount;
}

// --- LED LOGIC (Arduino=Room1, M5Stack=Room2) ---
function updateLocalState(room) {
    const p = $(`colorPicker${room}`), inp = $(`colorInput${room}`), prev = $(`ledPreview${room}`);
    if(!p) return;
    const hex = p.value.replace('#', '');
    deviceState[`room${room}`] = { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
    if(inp) inp.value = p.value.toUpperCase();
    if(prev) prev.style.backgroundColor = p.value;
}

function applyColor(room) {
    const now = Date.now(), btn = document.querySelector(`button[onclick="applyColor(${room})"]`);
    const diff = (now - lastUpdateTime) / 1000;
    if (diff < 15) {
        const rem = Math.ceil(15 - diff), old = btn.textContent;
        btn.textContent = `⏳ Cool down (${rem}s)`;
        setTimeout(() => { btn.textContent = old; }, 2000); return; 
    }
    const s = deviceState;
    const combinedData = `${s.room1.r},${s.room1.g},${s.room1.b},${s.room2.r},${s.room2.g},${s.room2.b}`;
    btn.textContent = "🚀 Sending..."; btn.disabled = true;
    fetch(`https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field8=${combinedData}&_=${Date.now()}`)
        .then(res => res.text()).then(data => {
            if (data !== "0") { lastUpdateTime = Date.now(); btn.textContent = "✅ Synced Both"; }
            else { btn.textContent = "❌ Busy"; }
            setTimeout(() => { btn.disabled = false; btn.textContent = `Apply to Room ${room}`; }, 3000);
        });
}

for(let i = 1; i <= 2; i++) {
    if($('colorPicker' + i)) $('colorPicker' + i).addEventListener('input', () => updateLocalState(i));
    updateLocalState(i);
}

// --- FIXED OFFICE LIGHTING MAP ---
function updateOfficeLights(lightValue) {
  var iconM5 = $('bulb2'), iconArdu = $('bulb4'), r1bg = $('room2bg'), r2bg = $('room4bg');
  var statusM5 = $('status2'), statusArdu = $('status4');
  
  [iconM5, iconArdu].forEach(ic => { if(ic) { ic.classList.remove('on'); ic.style.boxShadow = 'none'; ic.style.borderColor = '#555'; }});
  
  if(lightValue > 0) {
    var intensity = Math.min(Math.max(lightValue, 0), 100), opacity = intensity / 100;
    var glow = `0 0 ${intensity}px rgba(255, 255, 153, ${opacity})`;
    
    // Update M5GO Icon
    if(iconM5) { iconM5.classList.add('on'); iconM5.style.boxShadow = glow; iconM5.style.borderColor = '#ffffaa'; }
    // Update Arduino Icon (FIXED)
    if(iconArdu) { iconArdu.classList.add('on'); iconArdu.style.boxShadow = glow; iconArdu.style.borderColor = '#ffffaa'; }
    
    if(statusM5) statusM5.textContent = intensity + '%';
    if(statusArdu) statusArdu.textContent = intensity + '%';
  }
  if($('lightLevelText')) $('lightLevelText').textContent = lightValue + '%';
  if($('homeLights')) $('homeLights').textContent = lightValue > 0 ? "2" : "0";
}

function drawChart(canvas, data, color, unit, statsIds) {
  if(!canvas || data.length === 0) return;
  var c = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; c.scale(dpr, dpr);
  var mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
  for(var i = 0; i < data.length; i++) c.lineTo((i/(data.length-1))*W, H - ((data[i]-mn)/range)*(H-40));
  c.stroke();
  if(statsIds && $(statsIds.min)) $(statsIds.min).textContent = mn.toFixed(1) + unit;
  if(statsIds && $(statsIds.max)) $(statsIds.max).textContent = mx.toFixed(1) + unit;
}

function fetchData() {
  fetch(`https://api.thingspeak.com/channels/${CHANNEL}/feeds.json?api_key=${READ_KEY}&results=100`)
    .then(res => res.json()).then(d => {
      if(!d.feeds || d.feeds.length === 0) return;
      fc++; var f = d.feeds[d.feeds.length - 1];
      var t = parseFloat(f.field1), h = parseFloat(f.field2), p = parseFloat(f.field3);
      historicalData.pressure.push(p); historicalData.temperature.push(t); historicalData.humidity.push(h);
      
      if($('tv')) $('tv').innerHTML = t.toFixed(1) + '°C';
      if($('hv')) $('hv').innerHTML = h.toFixed(1) + '%';
      if($('pv')) $('pv').innerHTML = p.toFixed(1) + ' hPa';
      if($('weatherTemp')) $('weatherTemp').textContent = t.toFixed(1);
      if($('homeTemp')) $('homeTemp').textContent = t.toFixed(1) + '°C';

      // Restore Min/Max Tracking
      if(t < minTemp) minTemp = t; if(t > maxTemp) maxTemp = t;
      if($('weatherHi')) $('weatherHi').textContent = maxTemp.toFixed(1);
      if($('weatherLo')) $('weatherLo').textContent = minTemp.toFixed(1);

      // Weather Thresholds
      var icon = '🌤️', desc = 'Comfortable';
      if(t < 18) { icon = '🌥️'; desc = 'Cold'; } else if(t > 30) { icon = '🔥'; desc = 'Hot'; }
      if($('weatherIcon')) $('weatherIcon').textContent = icon;
      if($('weatherDesc')) $('weatherDesc').textContent = desc;

      processEntryLogs(d.feeds);
      updateOfficeLights(parseInt(f.field4) || 0);
      
      // RESTORED ALL 4 DRAW CALLS
      drawChart($('c1'), d.feeds.map(x => parseFloat(x.field1)||0), '#ff6b6b', '°C', {min:'tempMin', max:'tempMax'});
      drawChart($('c2'), d.feeds.map(x => parseFloat(x.field2)||0), '#4ecdc4', '%', {min:'humMin', max:'humMax'});
      drawChart($('c3'), d.feeds.map(x => parseFloat(x.field3)||0), '#ffd93d', 'hPa', {min:'presMin', max:'presMax'});
      drawChart($('c4'), d.feeds.map(x => parseInt(x.field4)||0), '#ffd93d', '%', {min:'lightMin', max:'lightMax'});
      
      ['st','st2','st3','st4'].forEach(id => { if($(id)) $(id).className = 'sd ok'; });
      if($('su')) $('su').textContent = 'Live · Updated ' + fc + ' times';
    }).catch(err => { ['st','st2','st3','st4'].forEach(id => { if($(id)) $(id).className = 'sd er'; }); });
}

fetchData(); setInterval(fetchData, UPDATE_INTERVAL);
