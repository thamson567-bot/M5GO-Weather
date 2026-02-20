var CHANNEL = '3260324';
var READ_KEY = 'RSDE9TXRGDX5HIL0';
var WRITE_KEY = 'W0R5AL9YS3DDDJHL';
var UPDATE_INTERVAL = 5000;

var fc = 0;
var currentPage = 'home';
var minTemp = 999, maxTemp = -999;
var globalLastLight = 0; 
var lastSentForecast = -1; 
var lastUpdateTime = 0; // Added for 15s safeguard

// --- LED STATE (Restored & Updated to 2 Rooms) ---
var deviceState = {
    room1: { r: 255, g: 255, b: 255 }, 
    room2: { r: 255, g: 255, b: 255 }  
};

var historicalData = {
  pressure: [], temperature: [], humidity: [], timestamps: [], maxHistory: 720
};

var currentForecastCode = -1;

// Send weather forecast every 3 minutes (180,000 ms)
setInterval(function() {
  if (currentForecastCode > 0) {
    sendForecastToThingSpeak(currentForecastCode);
  }
}, 180000);

const weatherConditions = [
  { id: 'heavy-rain', icon: '🌧️', name: 'Heavy Rain Soon', p: '📉 Pressure: Dropping Fast (<-3 hPa/hr)', h: '💧 Humidity: Rising (>+5%)', t: '🌡️ Temperature: Variable', desc: 'Strong weather system approaching. Rapid pressure drop combined with increasing humidity indicates heavy precipitation within 1-3 hours.' },
  { id: 'rain-likely', icon: '🌦️', name: 'Rain Likely', p: '📉 Pressure: Falling (<-2 hPa/30min)', h: '💧 Humidity: High (>75%)', t: '🌡️ Temperature: Moderate', desc: 'Atmospheric conditions favor precipitation. Sustained pressure decline with high humidity levels indicate rain within 3-6 hours.' },
  { id: 'cloudy', icon: '☁️', name: 'Cloudy Weather', p: '📉 Pressure: Declining Steadily', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Stable', desc: 'Gradual pressure decrease indicates cloud cover increasing. Overcast skies likely with no immediate precipitation expected.' },
  { id: 'clear-skies', icon: '☀️', name: 'Clear Skies Ahead', p: '📈 Pressure: Rising Rapidly (>+3 hPa/hr)', h: '💧 Humidity: Decreasing', t: '🌡️ Temperature: Variable', desc: 'Strong high-pressure system building. Rapid pressure increase clears clouds and brings sunny weather conditions.' },
  { id: 'improving', icon: '🌤️', name: 'Weather Improving', p: '📈 Pressure: Rising Steadily (>+1.5 hPa)', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Stable', desc: 'Conditions clearing as pressure rises. Clouds breaking up with improving visibility and reduced precipitation chance.' },
  { id: 'fair-stable', icon: '☀️', name: 'Fair & Stable', p: '➡️ Pressure: High & Stable (>1013 hPa)', h: '💧 Humidity: Low (<60%)', t: '🌡️ Temperature: Comfortable', desc: 'Excellent weather conditions. High pressure system with low humidity creates stable, pleasant conditions with clear skies.' },
  { id: 'unsettled', icon: '🌧️', name: 'Unsettled Weather', p: '📉 Pressure: Low (<1010 hPa)', h: '💧 Humidity: High (>70%)', t: '🌡️ Temperature: Variable', desc: 'Unstable atmospheric conditions. Low pressure combined with high humidity creates potential for cloudy skies and showers.' },
  { id: 'cold-front', icon: '❄️', name: 'Cold Front Moving In', p: '📈 Pressure: Rising', h: '💧 Humidity: Variable', t: '🌡️ Temperature: Dropping (<-1°C)', desc: 'Cold front passage detected. Temperature decrease with rising pressure brings cooler, clearer conditions ahead.' },
  { id: 'warm-front', icon: '🌡️', name: 'Warm Front Approaching', p: '📉 Pressure: Falling', h: '💧 Humidity: Rising', t: '🌡️ Temperature: Rising (>+1°C)', desc: 'Warm front advancing. Temperature increase with falling pressure develops warmer, more humid conditions.' },
  { id: 'stable', icon: '⛅', name: 'Stable Conditions', p: '➡️ Pressure: Stable (±0.5 hPa)', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Stable', desc: 'Atmospheric equilibrium. No significant changes in pressure, temperature, or humidity. Current weather pattern expected to persist.' },
  { id: 'partly-cloudy', icon: '⛅', name: 'Partly Cloudy', p: '➡️ Pressure: Variable', h: '💧 Humidity: Moderate', t: '🌡️ Temperature: Moderate', desc: 'Variable conditions with no strong weather signals. Mix of sun and clouds with no significant atmospheric changes detected.' }
];

function $(id){return document.getElementById(id)}

function renderWeatherCards() {
  const grid = $('conditionsGrid');
  if(!grid) return;
  grid.innerHTML = weatherConditions.map(c => `
    <div class="condition-card" data-condition="${c.id}">
      <div class="condition-header">
        <div class="condition-icon">${c.icon}</div>
        <div class="condition-name">${c.name}</div>
      </div>
      <div class="condition-indicators">
        <span class="indicator pressure">${c.p}</span>
        <span class="indicator humidity">${c.h}</span>
        <span class="indicator temp">${c.t}</span>
      </div>
      <div class="condition-description">${c.desc}</div>
    </div>
  `).join('');
}
renderWeatherCards();

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  var targetPage = $(page + '-page');
  if(targetPage) targetPage.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    if(b.textContent.toLowerCase().includes(page) || (page === 'home' && b.textContent.includes('Home'))) {
      b.classList.add('active');
    }
  });
}

function updateClock(){
  var n = new Date();
  var h = n.getHours(), m = n.getMinutes(), s = n.getSeconds();
  var clockEl = $('clockHeader');
  if(clockEl) clockEl.textContent = (h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}
setInterval(updateClock, 1000);
updateClock();

function sendForecastToThingSpeak(forecastCode) {
  if (forecastCode <= 0) return; 
  var url = `https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field7=${forecastCode}&t=${new Date().getTime()}`;
  fetch(url).then(res => res.text()).catch(err => console.error("Forecast failed:", err));
}

function processEntryLogs(feeds) {
  const allowedUsers = { "21 4D 5D 5D": "PANG SHENG YUAN", "F1 96 EA 01": "THIRSHEN S/O SIVA BALAN", "51 FC BA 5D": "CHEW QIBIN BRYANT" };
  let html = '', todayCount = 0, todayStr = new Date().toDateString();
  for(let i = feeds.length - 1; i >= 0; i--) {
    let uid = feeds[i].field5;
    if(uid && typeof uid === 'string') {
      uid = uid.trim().toUpperCase();
      if(allowedUsers[uid]) {
        let dateObj = new Date(feeds[i].created_at);
        let timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        if(dateObj.toDateString() === todayStr) todayCount++;
        html += `<tr><td>${timeStr}</td><td style="color: var(--accent); font-weight: 600;">${allowedUsers[uid]}</td><td style="font-family: monospace;">${uid}</td><td><span class="log-status entry">ENTRY</span></td></tr>`;
      }
    }
  }
  if($('logTableBody')) $('logTableBody').innerHTML = html || '<tr><td colspan="4" style="text-align:center; opacity:0.5; padding: 20px;">Waiting for authorized RFID taps...</td></tr>';
  if($('todayCount')) $('todayCount').textContent = todayCount;
  if($('homeEntries')) $('homeEntries').textContent = todayCount;
}

// --- RESTORED & UPDATED LED LOGIC (2 ROOMS) ---
function updateLocalState(room) {
    const picker = $(`colorPicker${room}`), input = $(`colorInput${room}`), preview = $(`ledPreview${room}`);
    if(!picker) return;
    const hex = picker.value.replace('#', '');
    deviceState[`room${room}`] = { r: parseInt(hex.substring(0, 2), 16), g: parseInt(hex.substring(2, 4), 16), b: parseInt(hex.substring(4, 6), 16) };
    if(input) input.value = picker.value.toUpperCase();
    if(preview) preview.style.backgroundColor = picker.value;
}

function applyColor(room) {
    const now = Date.now(), btn = document.querySelector(`button[onclick="applyColor(${room})"]`);
    const timeSinceLastUpdate = (now - lastUpdateTime) / 1000;
    if (timeSinceLastUpdate < 15) {
        const rem = Math.ceil(15 - timeSinceLastUpdate);
        const originalText = btn.textContent;
        btn.textContent = `⏳ Cool down (${rem}s)`;
        btn.style.background = "#ffb347";
        setTimeout(() => { btn.textContent = originalText; btn.style.background = ""; }, 2000);
        return; 
    }
    const s = deviceState;
    const combinedData = `${s.room1.r},${s.room1.g},${s.room1.b},${s.room2.r},${s.room2.g},${s.room2.b}`;
    btn.textContent = "🚀 Sending..."; btn.disabled = true;
    fetch(`https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field8=${combinedData}&_=${Date.now()}`)
        .then(res => res.text()).then(data => {
            if (data !== "0") { lastUpdateTime = Date.now(); btn.style.background = "#4ecdc4"; btn.textContent = "✅ Synced Both"; } 
            else { btn.style.background = "#ff6b6b"; btn.textContent = "❌ Server Busy"; }
            setTimeout(() => { btn.disabled = false; btn.textContent = `Apply to Room ${room}`; btn.style.background = ""; }, 3000);
        });
}

for(let i = 1; i <= 2; i++) {
    let picker = $('colorPicker' + i), input = $('colorInput' + i);
    if(picker) picker.addEventListener('input', () => updateLocalState(i));
    if(input) input.addEventListener('input', () => { if(input.value.length === 7) { picker.value = input.value; updateLocalState(i); } });
    updateLocalState(i);
}

// --- FULLY RESTORED ORIGINAL OFFICE LOGIC ---
function updateOfficeLights(lightValue) {
  var icon1 = $('bulb2'), icon2 = $('bulb4'), room1bg = $('room2bg'), room2bg = $('room4bg');
  var status1 = $('status2'), status2 = $('status4'), levelText = $('lightLevelText'), statusText = $('lightStatus');
  [icon1, icon2].forEach(ic => { if(ic) { ic.classList.remove('on'); ic.style.boxShadow = 'none'; ic.style.borderColor = '#555'; }});
  if(room1bg) room1bg.style.background = '#2a2a3e'; if(room2bg) room2bg.style.background = '#2a2a3e';
  if(status1) { status1.textContent = 'OFF'; status1.className = 'room-status off'; }
  if(status2) { status2.textContent = 'OFF'; status2.className = 'room-status off'; }
  
  var activeRooms = [];
  if(lightValue > 0) {
    var intensity = Math.min(Math.max(lightValue, 0), 100), opacity = intensity / 100;
    var color = intensity <= 25 ? '#ffff99' : intensity <= 50 ? '#ffffaa' : intensity <= 75 ? '#99ffff' : '#ffffff';
    var glow = `0 0 ${intensity}px rgba(255, 255, 153, ${opacity})`;
    var roomBg = `rgba(255, 255, 153, ${opacity * 0.25})`;
    
    if(icon1 && room1bg && status1) {
      icon1.classList.add('on'); icon1.style.boxShadow = glow; icon1.style.borderColor = color;
      room1bg.style.background = roomBg; status1.textContent = intensity + '%'; status1.className = 'room-status lit';
      activeRooms.push('Room 1');
    }
    if(icon2 && room2bg && status2) {
      icon2.classList.add('on'); icon2.style.boxShadow = glow; icon2.style.borderColor = color;
      room2bg.style.background = roomBg; status2.textContent = intensity + '%'; status2.className = 'room-status lit';
      activeRooms.push('Room 2');
    }
  }
  if($('homeLights')) $('homeLights').textContent = activeRooms.length;
  if(levelText && statusText) {
    if(lightValue === 0) { levelText.textContent = 'OFF (0%)'; levelText.style.color = '#888'; statusText.textContent = 'All lights are OFF'; } 
    else {
      var lMode = lightValue <= 25 ? 'ECO' : lightValue <= 50 ? 'NORMAL' : lightValue <= 75 ? 'BRIGHT' : 'MAX';
      levelText.textContent = lMode + ' (' + lightValue + '%)';
      levelText.style.color = lightValue <= 25 ? '#ffd93d' : lightValue <= 50 ? '#4ecdc4' : '#ff6b6b';
      statusText.textContent = activeRooms.join(' & ') + ' active';
    }
  }
}

// --- FULLY RESTORED ORIGINAL CHART LOGIC ---
function drawChart(canvas, data, color, unit, statsIds) {
  if(!canvas || data.length === 0) return;
  var c = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr; c.scale(dpr, dpr);
  c.clearRect(0, 0, W, H);
  
  var mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  var sum = data.reduce((a,b) => a+b, 0), avg = sum / data.length;
  var pts = [];
  for(var i = 0; i < data.length; i++) pts.push([(i / (data.length - 1)) * W, H - ((data[i] - mn) / range) * (H - 40)]);
  
  var gradient = c.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, color + '40'); gradient.addColorStop(1, color + '00');
  c.fillStyle = gradient; c.beginPath(); c.moveTo(pts[0][0], H);
  for(var i = 0; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.lineTo(pts[pts.length-1][0], H); c.closePath(); c.fill();

  c.strokeStyle = color; c.lineWidth = 3 * dpr; c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for(var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();

  for(var i = 0; i < pts.length; i++) {
    c.fillStyle = color; c.beginPath(); c.arc(pts[i][0], pts[i][1], 4*dpr, 0, Math.PI*2); c.fill();
    c.strokeStyle = '#1a1a2e'; c.lineWidth = 2*dpr; c.stroke();
  }

  c.fillStyle = 'rgba(255,255,255,.7)'; c.font = (12*dpr) + 'px sans-serif';
  c.textAlign = 'left'; c.fillText(mn.toFixed(1) + unit, 8, H - 8);
  c.textAlign = 'right'; c.fillText(mx.toFixed(1) + unit, W - 8, 20*dpr);
  
  if(statsIds) {
    if($(statsIds.min)) $(statsIds.min).innerHTML = mn.toFixed(1) + unit;
    if($(statsIds.max)) $(statsIds.max).innerHTML = mx.toFixed(1) + unit;
    if(statsIds.avg && $(statsIds.avg)) $(statsIds.avg).innerHTML = avg.toFixed(1) + unit; 
    if(statsIds.count && $(statsIds.count)) $(statsIds.count).textContent = data.length;
  }
}

function getAdvancedForecast(currentTemp, currentHum, currentPres) {
  var forecast = { icon: '⛅', text: 'Partly Cloudy', confidence: 'low', details: 'Monitoring trends', code: 11 };
  if(historicalData.pressure.length < 12) return { icon: '⛅', text: 'Collecting Data...', details: 'Please wait', code: 0 };
  var len = historicalData.pressure.length;
  var pres15 = len > 36 ? historicalData.pressure[len - 36] : historicalData.pressure[0];
  var trend15 = currentPres - pres15;
  if(trend15 < -1 && currentHum > 80) forecast = { icon: '🌧️', text: 'Heavy Rain Soon', details: 'Pressure dropping, high humidity', code: 1 };
  else if(trend15 > 1) forecast = { icon: '☀️', text: 'Clear Skies Ahead', details: 'Pressure rising', code: 4 };
  else if(currentPres > 1013 && currentHum < 60) forecast = { icon: '☀️', text: 'Fair & Stable', details: 'High pressure', code: 6 };
  return forecast;
}

function highlightCurrentCondition(forecastText) {
  document.querySelectorAll('.condition-card').forEach(card => card.classList.remove('active'));
  var conditionMap = { 'Heavy Rain Soon': 'heavy-rain', 'Clear Skies Ahead': 'clear-skies', 'Fair & Stable': 'fair-stable', 'Partly Cloudy': 'partly-cloudy' };
  var conditionKey = conditionMap[forecastText];
  if(conditionKey) {
    var activeCard = document.querySelector('.condition-card[data-condition="' + conditionKey + '"]');
    if(activeCard) activeCard.classList.add('active');
  }
}

// --- FULLY RESTORED ORIGINAL FETCH & UI DATA PARSING ---
function fetchData() {
  fetch(`https://api.thingspeak.com/channels/${CHANNEL}/feeds.json?api_key=${READ_KEY}&results=100`)
    .then(res => res.json()).then(d => {
      if(!d.feeds || d.feeds.length === 0) throw new Error('No data');
      fc++; var f = d.feeds[d.feeds.length - 1];
      var temp = parseFloat(f.field1) || 0, hum = parseFloat(f.field2) || 0, pres = parseFloat(f.field3) || 0;
      processEntryLogs(d.feeds);
      historicalData.pressure.push(pres); historicalData.temperature.push(temp); historicalData.humidity.push(hum);
      if(historicalData.pressure.length > historicalData.maxHistory) { historicalData.pressure.shift(); historicalData.temperature.shift(); historicalData.humidity.shift(); }

      if($('tv')) $('tv').innerHTML = temp.toFixed(1) + '<span class="un">°C</span>';
      if($('hv')) $('hv').innerHTML = hum.toFixed(1) + '<span class="un">%</span>';
      if($('pv')) $('pv').innerHTML = pres.toFixed(1) + '<span class="un">hPa</span>';
      if($('weatherTemp')) $('weatherTemp').textContent = temp.toFixed(1);
      if(temp < minTemp) minTemp = temp; if(temp > maxTemp) maxTemp = temp;
      if($('weatherHi')) $('weatherHi').textContent = maxTemp.toFixed(1); 
      if($('weatherLo')) $('weatherLo').textContent = minTemp.toFixed(1);
      
      var icon = '🌤️', desc = 'Pleasant';
      if(temp < 10) { icon = '❄️'; desc = 'Very Cold'; } else if(temp < 18) { icon = '🌥️'; desc = 'Cold'; }
      else if(temp < 25) { icon = '🌤️'; desc = 'Comfortable'; } else if(temp < 30) { icon = '🌞'; desc = 'Warm'; }
      else { icon = '🔥'; desc = 'Hot'; }
      if($('weatherIcon')) $('weatherIcon').textContent = icon;
      if($('weatherDesc')) $('weatherDesc').textContent = desc;

      var adv = getAdvancedForecast(temp, hum, pres);
      if($('forecast')) $('forecast').innerHTML = adv.icon + ' ' + adv.text;
      currentForecastCode = adv.code;
      highlightCurrentCondition(adv.text);
      if($('homeTemp')) $('homeTemp').innerHTML = temp.toFixed(1) + '°C';

      var tData = [], hData = [], pData = [], lData = [];
      var lT = 0, lH = 0, lP = 0;
      d.feeds.forEach(feed => {
        if (feed.field1 != null) lT = parseFloat(feed.field1);
        if (feed.field2 != null) lH = parseFloat(feed.field2);
        if (feed.field3 != null) lP = parseFloat(feed.field3);
        if (feed.field4 !== null && feed.field4 !== "") globalLastLight = parseInt(feed.field4) || 0;
        tData.push(lT); hData.push(lH); pData.push(lP); lData.push(globalLastLight);
      });

      updateOfficeLights(globalLastLight);
      drawChart($('c1'), tData, '#ff6b6b', '°C', {min:'tempMin', max:'tempMax', avg:'tempAvg', count:'tempCount'});
      drawChart($('c2'), hData, '#4ecdc4', '%', {min:'humMin', max:'humMax', avg:'humAvg', count:'humCount'});
      drawChart($('c3'), pData, '#ffd93d', 'hPa', {min:'presMin', max:'presMax', avg:'presAvg', count:null});
      drawChart($('c4'), lData, '#ffd93d', '%', {min:'lightMin', max:'lightMax', avg:'lightAvg', count:null});
      
      ['st','st2','st3','st4'].forEach(id => { if($(id)) $(id).className = 'sd ok'; });
      if($('su')) $('su').textContent = 'Live · Updated ' + fc + ' times';
      if($('homeStatus')) $('homeStatus').textContent = 'LIVE';
    }).catch(err => { console.error(err); ['st','st2','st3','st4'].forEach(id => { if($(id)) $(id).className = 'sd er'; }); });
}

fetchData(); 
setInterval(fetchData, UPDATE_INTERVAL);
