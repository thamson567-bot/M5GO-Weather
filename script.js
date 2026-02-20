var CHANNEL = '3260324';
var READ_KEY = 'RSDE9TXRGDX5HIL0';
var WRITE_KEY = 'W0R5AL9YS3DDDJHL';
var UPDATE_INTERVAL = 5000;

var fc = 0;
var currentPage = 'home';
var minTemp = 999, maxTemp = -999;
var globalLastLight = 0; 
var lastSentForecast = -1; 
var lastUpdateTime = 0; // Tracks ThingSpeak 15s limit

// Global state to remember colors so updating one room doesn't reset the other
var deviceState = {
    room1: { r: 255, g: 255, b: 255 }, // Default White
    room2: { r: 255, g: 255, b: 255 }  // Default White
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
  const allowedUsers = {
    "21 4D 5D 5D": "PANG SHENG YUAN",
    "F1 96 EA 01": "THIRSHEN S/O SIVA BALAN",
    "51 FC BA 5D": "CHEW QIBIN BRYANT"
  };
  let html = '';
  let todayCount = 0;
  let todayStr = new Date().toDateString();

  for(let i = feeds.length - 1; i >= 0; i--) {
    let uid = feeds[i].field5;
    if(uid && typeof uid === 'string') {
      uid = uid.trim().toUpperCase();
      if(allowedUsers[uid]) {
        let dateObj = new Date(feeds[i].created_at);
        let timeStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
        if(dateObj.toDateString() === todayStr) todayCount++;
        html += `<tr><td>${timeStr}</td><td style="color:var(--accent);font-weight:600">${allowedUsers[uid]}</td><td style="font-family:monospace">${uid}</td><td><span class="log-status entry">ENTRY</span></td></tr>`;
      }
    }
  }
  if($('logTableBody')) $('logTableBody').innerHTML = html || '<tr><td colspan="4">No entries today.</td></tr>';
  if($('todayCount')) $('todayCount').textContent = todayCount;
  if($('homeEntries')) $('homeEntries').textContent = todayCount;
}

// ==========================================
// 3. STATE-AWARE LED CONTROL (FIELD 8)
// ==========================================

function updateLocalState(room) {
    const picker = $(`colorPicker${room}`);
    const input = $(`colorInput${room}`);
    const preview = $(`ledPreview${room}`);
    if(!picker) return;
    const hex = picker.value.replace('#', '');
    deviceState[`room${room}`] = {
        r: parseInt(hex.substring(0, 2), 16),
        g: parseInt(hex.substring(2, 4), 16),
        b: parseInt(hex.substring(4, 6), 16)
    };
    if(input) input.value = picker.value.toUpperCase();
    if(preview) preview.style.backgroundColor = picker.value;
}

function applyColor(room) {
    const now = Date.now();
    const btn = document.querySelector(`button[onclick="applyColor(${room})"]`);
    const timeSinceLastUpdate = (now - lastUpdateTime) / 1000;

    // Visual safeguard for ThingSpeak rate limit
    if (timeSinceLastUpdate < 15) {
        const remaining = Math.ceil(15 - timeSinceLastUpdate);
        const originalText = btn.textContent;
        btn.textContent = `⏳ Cool down (${remaining}s)`;
        btn.style.background = "#ffb347";
        setTimeout(() => { btn.textContent = originalText; btn.style.background = ""; }, 2000);
        return; 
    }

    const s = deviceState;
    // Formatting: R1,G1,B1,R2,G2,B2 for friend's logic
    const combinedData = `${s.room1.r},${s.room1.g},${s.room1.b},${s.room2.r},${s.room2.g},${s.room2.b}`;
    const url = `https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field8=${combinedData}`;

    btn.textContent = "🚀 Sending...";
    btn.disabled = true;

    fetch(url).then(res => res.text()).then(data => {
        if (data !== "0") {
            lastUpdateTime = Date.now();
            btn.style.background = "#4ecdc4";
            btn.textContent = "✅ Synced Both";
        } else {
            btn.style.background = "#ff6b6b";
            btn.textContent = "❌ Server Busy";
        }
        setTimeout(() => { btn.disabled = false; btn.textContent = `Apply to Room ${room}`; btn.style.background = ""; }, 3000);
    }).catch(() => { btn.disabled = false; btn.textContent = "⚠️ Error"; });
}

for(let i = 1; i <= 2; i++) {
    let picker = $('colorPicker' + i);
    let input = $('colorInput' + i);
    if(picker) picker.addEventListener('input', () => updateLocalState(i));
    if(input) input.addEventListener('input', () => { if(input.value.length === 7) { picker.value = input.value; updateLocalState(i); } });
    updateLocalState(i); // Set initial defaults to White
}

function updateOfficeLights(lightValue) {
  var icon1 = $('bulb2'), icon2 = $('bulb4'), room1bg = $('room2bg'), room2bg = $('room4bg');
  var status1 = $('status2'), status2 = $('status4'), levelText = $('lightLevelText'), statusText = $('lightStatus');
  if(icon1) { icon1.classList.remove('on'); icon1.style.boxShadow = 'none'; icon1.style.borderColor = '#555'; }
  if(icon2) { icon2.classList.remove('on'); icon2.style.boxShadow = 'none'; icon2.style.borderColor = '#555'; }
  if(room1bg) room1bg.style.background = '#2a2a3e';
  if(room2bg) room2bg.style.background = '#2a2a3e';
  
  if(lightValue > 0) {
    var intensity = Math.min(Math.max(lightValue, 0), 100); 
    var opacity = intensity / 100;
    var glowStyle = '0 0 ' + (intensity) + 'px rgba(255, 255, 153, ' + opacity + ')';
    if(icon1) { icon1.classList.add('on'); icon1.style.boxShadow = glowStyle; icon1.style.borderColor = '#ffffaa'; }
    if(room1bg) room1bg.style.background = 'rgba(255,255,153,'+(opacity*0.25)+')';
    if(status1) status1.textContent = intensity + '%';
  }
}

function drawChart(canvas, data, color, unit, statsIds) {
  if(!canvas || data.length === 0) return;
  var c = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  c.scale(dpr, dpr);
  var mn = Math.min(...data), mx = Math.max(...data), range = mx - mn || 1;
  c.strokeStyle = color; c.lineWidth = 2; c.beginPath();
  for(var i = 0; i < data.length; i++) c.lineTo((i/(data.length-1))*W, H - ((data[i]-mn)/range)*(H-40));
  c.stroke();
  if(statsIds && $(statsIds.min)) $(statsIds.min).textContent = mn.toFixed(1) + unit;
  if(statsIds && $(statsIds.max)) $(statsIds.max).textContent = mx.toFixed(1) + unit;
}

function fetchData() {
  fetch(`https://api.thingspeak.com/channels/${CHANNEL}/feeds.json?api_key=${READ_KEY}&results=100`)
    .then(res => res.json())
    .then(d => {
      if(!d.feeds || d.feeds.length === 0) return;
      var f = d.feeds[d.feeds.length - 1];
      if($('tv')) $('tv').innerHTML = parseFloat(f.field1).toFixed(1) + '°C';
      if($('hv')) $('hv').innerHTML = parseFloat(f.field2).toFixed(1) + '%';
      if($('pv')) $('pv').innerHTML = parseFloat(f.field3).toFixed(1) + ' hPa';
      processEntryLogs(d.feeds);
      updateOfficeLights(parseInt(f.field4) || 0);
      drawChart($('c1'), d.feeds.map(x => parseFloat(x.field1)), '#ff6b6b', '°C', {min:'tempMin', max:'tempMax'});
    });
}

fetchData(); 
setInterval(fetchData, UPDATE_INTERVAL);
