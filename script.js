var CHANNEL = '3260324';
var READ_KEY = 'RSDE9TXRGDX5HIL0';
var UPDATE_INTERVAL = 5000;

var fc = 0;
var currentPage = 'home';
var minTemp = 999, maxTemp = -999;

// GLOBAL VARIABLE: This remembers the light level even when M5GO skips sending it
var globalLastLight = 0; 

var historicalData = {
  pressure: [],
  temperature: [],
  humidity: [],
  timestamps: [],
  maxHistory: 720
};

var currentForecastCode = -1;
var firstForecastSent = false;

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

function sendForecastToThingSpeak(forecastCode) {
  var WRITE_KEY = 'W0R5AL9YS3DDDJHL';
  var url = 'https://api.thingspeak.com/update?api_key=' + WRITE_KEY + '&field7=' + forecastCode;
  fetch(url).catch(err => console.error(err));
}

function $(id){return document.getElementById(id)}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  $(page + '-page').classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => {
    if(b.textContent.toLowerCase().includes(page) || (page === 'home' && b.textContent.includes('Home'))) {
      b.classList.add('active');
    }
  });
}

function updateClock(){
  var n = new Date();
  var h = n.getHours(), m = n.getMinutes(), s = n.getSeconds();
  $('clockHeader').textContent = (h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}
setInterval(updateClock, 1000);
updateClock();

function updateOfficeLights(lightValue) {
  var icon1 = $('bulb2'); // M5Stack Room
  var icon2 = $('bulb4'); // Arduino Room
  var room1bg = $('room2bg');
  var room2bg = $('room4bg');
  var status1 = $('status2');
  var status2 = $('status4');
  var levelText = $('lightLevelText');
  var statusText = $('lightStatus');
  
  // Reset
  if(icon1) { icon1.classList.remove('on'); icon1.style.boxShadow = 'none'; icon1.style.borderColor = '#555'; }
  if(icon2) { icon2.classList.remove('on'); icon2.style.boxShadow = 'none'; icon2.style.borderColor = '#555'; }
  room1bg.style.background = '#2a2a3e';
  room2bg.style.background = '#2a2a3e';
  status1.textContent = 'OFF'; status1.className = 'room-status off';
  status2.textContent = 'OFF'; status2.className = 'room-status off';
  
  var activeRooms = [];
  
  if(lightValue > 0) {
    var intensity = Math.min(Math.max(lightValue, 0), 100); 
    var opacity = intensity / 100;
    var color = intensity <= 25 ? '#ffff99' : intensity <= 50 ? '#ffffaa' : intensity <= 75 ? '#99ffff' : '#ffffff';
    var glowStyle = '0 0 ' + (intensity) + 'px rgba(255, 255, 153, ' + opacity + ')';
    var roomBgStyle = 'rgba(255, 255, 153, ' + (opacity * 0.25) + ')';
    
    if(icon1) {
      icon1.classList.add('on');
      icon1.style.boxShadow = glowStyle;
      icon1.style.borderColor = color;
    }
    room1bg.style.background = roomBgStyle;
    status1.textContent = intensity + '%';
    status1.className = 'room-status lit';
    activeRooms.push('Room 1 (M5)');
    
    if(icon2) {
      icon2.classList.add('on');
      icon2.style.boxShadow = glowStyle;
      icon2.style.borderColor = color;
    }
    room2bg.style.background = roomBgStyle;
    status2.textContent = intensity + '%';
    status2.className = 'room-status lit';
    activeRooms.push('Room 2 (Arduino)');
  }
  
  if(lightValue === 0) {
    levelText.textContent = 'OFF (0%)';
    levelText.style.color = '#888';
    statusText.textContent = 'All lights are OFF';
  } else {
    var lMode = lightValue <= 25 ? 'ECO' : lightValue <= 50 ? 'NORMAL' : lightValue <= 75 ? 'BRIGHT' : 'MAX';
    levelText.textContent = lMode + ' (' + lightValue + '%)';
    levelText.style.color = lightValue <= 25 ? '#ffd93d' : lightValue <= 50 ? '#4ecdc4' : '#ff6b6b';
    statusText.textContent = activeRooms.join(' & ') + ' active';
  }
}

function drawChart(canvas, data, color, unit, statsIds) {
  if(!canvas || data.length === 0) return;
  var c = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var W = canvas.clientWidth, H = canvas.clientHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  c.scale(dpr, dpr);
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
    $(statsIds.min).innerHTML = mn.toFixed(1) + unit; $(statsIds.max).innerHTML = mx.toFixed(1) + unit;
    $(statsIds.avg).innerHTML = avg.toFixed(1) + unit; if(statsIds.count) $(statsIds.count).textContent = data.length;
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
  document.querySelectorAll('.current-badge').forEach(badge => badge.remove());
  
  var conditionMap = { 'Heavy Rain Soon': 'heavy-rain', 'Clear Skies Ahead': 'clear-skies', 'Fair & Stable': 'fair-stable', 'Partly Cloudy': 'partly-cloudy' };
  var conditionKey = conditionMap[forecastText];
  
  if(conditionKey) {
    var activeCard = document.querySelector('.condition-card[data-condition="' + conditionKey + '"]');
    if(activeCard) {
      activeCard.classList.add('active');
      var badge = document.createElement('span'); badge.className = 'current-badge'; badge.textContent = 'CURRENT';
      activeCard.querySelector('.condition-name').appendChild(badge);
    }
  }
}

function fetchData() {
  // Increased results to 100 to catch older light data if it hasn't updated recently
  var url = 'https://api.thingspeak.com/channels/' + CHANNEL + '/feeds.json?api_key=' + READ_KEY + '&results=100';
  
  fetch(url)
    .then(res => res.json())
    .then(d => {
      if(!d.feeds || d.feeds.length === 0) throw new Error('No data');
      fc++;
      var f = d.feeds[d.feeds.length - 1];
      
      var temp = parseFloat(f.field1) || 0;
      var hum = parseFloat(f.field2) || 0;
      var pres = parseFloat(f.field3) || 0;

      historicalData.pressure.push(pres); historicalData.temperature.push(temp); historicalData.humidity.push(hum);
      if(historicalData.pressure.length > historicalData.maxHistory) {
        historicalData.pressure.shift(); historicalData.temperature.shift(); historicalData.humidity.shift();
      }

      $('tv').innerHTML = temp.toFixed(1) + '<span class="un">°C</span>';
      $('hv').innerHTML = hum.toFixed(1) + '<span class="un">%</span>';
      $('pv').innerHTML = pres.toFixed(1) + '<span class="un">hPa</span>';
      
      $('weatherTemp').textContent = temp.toFixed(1);
      if(temp < minTemp) minTemp = temp; if(temp > maxTemp) maxTemp = temp;
      $('weatherHi').textContent = maxTemp.toFixed(1); $('weatherLo').textContent = minTemp.toFixed(1);
      
      var advancedForecast = getAdvancedForecast(temp, hum, pres);
      $('forecast').innerHTML = advancedForecast.icon + ' ' + advancedForecast.text;
      if(advancedForecast.code !== currentForecastCode) currentForecastCode = advancedForecast.code;
      highlightCurrentCondition(advancedForecast.text);
      $('homeTemp').innerHTML = temp.toFixed(1) + '°C';
      $('hp').style.left = Math.max(0, Math.min(100, hum)) + '%';

      var tempData = [], humData = [], presData = [], lightData = [];
      
      // Loop forward to catch the newest data and populate charts
      for(var i = 0; i < d.feeds.length; i++) {
        tempData.push(parseFloat(d.feeds[i].field1) || 0);
        humData.push(parseFloat(d.feeds[i].field2) || 0);
        presData.push(parseFloat(d.feeds[i].field3) || 0);
        
        // If field4 is NOT empty, update our global memory
        if (d.feeds[i].field4 !== null && d.feeds[i].field4 !== "") {
          globalLastLight = parseInt(d.feeds[i].field4) || 0;
        }
        lightData.push(globalLastLight);
      }

      // Update UI with the global memory
      updateOfficeLights(globalLastLight);

      const chartConfigs = [
        { canvas: 'c1', data: tempData, color: '#ff6b6b', unit: '°C', stats: {min:'tempMin', max:'tempMax', avg:'tempAvg', count:'tempCount'} },
        { canvas: 'c2', data: humData, color: '#4ecdc4', unit: '%', stats: {min:'humMin', max:'humMax', avg:'humAvg', count:'humCount'} },
        { canvas: 'c3', data: presData, color: '#ffd93d', unit: 'hPa', stats: {min:'presMin', max:'presMax', avg:'presAvg', count:null} },
        { canvas: 'c4', data: lightData, color: '#ffd93d', unit: '%', stats: {min:'lightMin', max:'lightMax', avg:'lightAvg', count:null} }
      ];
      chartConfigs.forEach(cfg => drawChart($(cfg.canvas), cfg.data, cfg.color, cfg.unit, cfg.stats));
      
      $('lightMode').textContent = globalLastLight === 0 ? 'OFF' : globalLastLight <= 50 ? 'ECO' : 'MAX';
      $('st').className = $('st2').className = $('st3').className = $('st4').className = 'sd ok';
      $('su').textContent = 'Live · Updated ' + fc + ' times';
      $('homeStatus').textContent = 'LIVE';
    })
    .catch(err => {
      console.error(err);
      $('st').className = $('st2').className = $('st3').className = $('st4').className = 'sd er';
      $('su').textContent = 'Error: ' + err.message;
    });
}

for(let i = 1; i <= 2; i++) {
  $('colorPicker' + i).addEventListener('input', function() {
    $('colorInput' + i).value = this.value.toUpperCase(); $('ledPreview' + i).style.backgroundColor = this.value;
  });
  $('colorInput' + i).addEventListener('input', function() {
    var val = this.value;
    if(val.startsWith('#') && (val.length === 7 || val.length === 4)) {
      $('colorPicker' + i).value = val; $('ledPreview' + i).style.backgroundColor = val;
    }
  });
}

function applyColor(room) { alert('✅ Applied to Room ' + room); }
fetchData(); setInterval(fetchData, UPDATE_INTERVAL);
