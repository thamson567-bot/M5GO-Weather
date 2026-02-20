var CHANNEL = '3260324';
var READ_KEY = 'RSDE9TXRGDX5HIL0';
var UPDATE_INTERVAL = 5000;

var fc = 0;
var currentPage = 'home';
var minTemp = 999, maxTemp = -999;

var historicalData = {
  pressure: [],
  temperature: [],
  humidity: [],
  timestamps: [],
  maxHistory: 720
};

var currentForecastCode = -1;
var firstForecastSent = false;

function sendForecastToThingSpeak(forecastCode) {
  var WRITE_KEY = 'W0R5AL9YS3DDDJHL';
  
  console.log('🌤️ Sending forecast code ' + forecastCode + ' to ThingSpeak Field 7...');
  
  var url = 'https://api.thingspeak.com/update?api_key=' + WRITE_KEY + '&field7=' + forecastCode;
  
  fetch(url)
    .then(res => res.text())
    .then(data => {
      if(data.trim() !== '0') {
        console.log('✅ Forecast code ' + forecastCode + ' sent successfully! Entry ID: ' + data);
      } else {
        console.error('❌ ThingSpeak returned 0 (rate limit or error)');
      }
    })
    .catch(err => {
      console.error('❌ Failed to send forecast:', err);
    });
}

function $(id){return document.getElementById(id)}

function showPage(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  $(page + '-page').classList.add('active');
  
  document.querySelectorAll('.nav-btn').forEach(b => {
    if(b.textContent.toLowerCase().includes(page) || 
       (page === 'home' && b.textContent.includes('Home'))) {
      b.classList.add('active');
    }
  });
}

function updateClock(){
  var n = new Date();
  var h = n.getHours(), m = n.getMinutes(), s = n.getSeconds();
  $('clockHeader').textContent = 
    (h<10?'0':'')+h+':'+(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}
setInterval(updateClock, 1000);
updateClock();

function updateOfficeLights(lightValue) {
  // Map to the new visual layout
  var bulb1 = $('bulb2'); // Visual bottom-right
  var bulb2 = $('bulb4'); // Visual top-left
  var bulb3 = $('bulb3'); // Old top-right
  
  var room1bg = $('room2bg');
  var room2bg = $('room4bg');
  var room3bg = $('room3bg');
  var oldRoom1 = $('room1bg'); // Bottom-left
  
  var status1 = $('status2');
  var status2 = $('status4');
  var status3 = $('status3');
  
  var levelText = $('lightLevelText');
  var statusText = $('lightStatus');
  
  // Reset all
  bulb1.classList.remove('on'); bulb1.style.background = '#333';
  bulb2.classList.remove('on'); bulb2.style.background = '#333';
  bulb3.classList.remove('on'); bulb3.style.background = '#333';
  
  room1bg.style.background = '#2a2a3e';
  room2bg.style.background = '#2a2a3e';
  room3bg.style.background = '#2a2a3e';
  oldRoom1.style.background = '#2a2a3e';
  
  status1.textContent = 'OFF'; status1.className = 'room-status off';
  status2.textContent = 'OFF'; status2.className = 'room-status off';
  status3.textContent = 'OFF'; status3.className = 'room-status off';
  
  room3bg.style.display = 'none'; 
  
  var activeRooms = [];
  
  if(lightValue > 0) {
    var color = lightValue <= 25 ? '#ffff99' : lightValue <= 50 ? '#ffffaa' : 
                lightValue <= 75 ? '#99ffff' : '#ffffff';
    var radial = 'radial-gradient(circle, ' + color + ', #888800)';
    var bgStyle = 'rgba(255, 255, 153, ' + (lightValue/200) + ')';
    
    // Apply to new Room 1 (Bottom Right)
    bulb1.classList.add('on');
    bulb1.style.background = radial;
    room1bg.style.background = bgStyle;
    status1.textContent = lightValue + '%';
    status1.className = 'room-status lit';
    activeRooms.push('Room 1');
    
    // Apply to new Room 2 (Top Left)
    bulb2.classList.add('on');
    bulb2.style.background = radial;
    room2bg.style.background = bgStyle;
    status2.textContent = lightValue + '%';
    status2.className = 'room-status lit';
    activeRooms.push('Room 2');
  }
  
  // Update Overall Status UI
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
  var W = canvas.clientWidth;
  var H = canvas.clientHeight;
  
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  c.scale(dpr, dpr);
  
  c.clearRect(0, 0, W, H);
  
  var mn = Math.min(...data);
  var mx = Math.max(...data);
  var range = mx - mn || 1;
  var sum = data.reduce((a,b) => a+b, 0);
  var avg = sum / data.length;
  
  var pts = [];
  for(var i = 0; i < data.length; i++) {
    var x = (i / (data.length - 1)) * W;
    var y = H - ((data[i] - mn) / range) * (H - 40);
    pts.push([x, y]);
  }
  
  var gradient = c.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(1, color + '00');
  c.fillStyle = gradient;
  c.beginPath();
  c.moveTo(pts[0][0], H);
  for(var i = 0; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.lineTo(pts[pts.length-1][0], H);
  c.closePath();
  c.fill();

  c.strokeStyle = color;
  c.lineWidth = 3 * dpr;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  for(var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.stroke();

  for(var i = 0; i < pts.length; i++) {
    c.fillStyle = color;
    c.beginPath();
    c.arc(pts[i][0], pts[i][1], 4*dpr, 0, Math.PI*2);
    c.fill();
    c.strokeStyle = '#1a1a2e';
    c.lineWidth = 2*dpr;
    c.stroke();
  }

  c.fillStyle = 'rgba(255,255,255,.7)';
  c.font = (12*dpr) + 'px sans-serif';
  c.textAlign = 'left';
  c.fillText(mn.toFixed(1) + unit, 8, H - 8);
  c.textAlign = 'right';
  c.fillText(mx.toFixed(1) + unit, W - 8, 20*dpr);
  
  if(statsIds) {
    $(statsIds.min).innerHTML = mn.toFixed(1) + unit;
    $(statsIds.max).innerHTML = mx.toFixed(1) + unit;
    $(statsIds.avg).innerHTML = avg.toFixed(1) + unit;
    if(statsIds.count) $(statsIds.count).textContent = data.length;
  }
}

function getAdvancedForecast(currentTemp, currentHum, currentPres) {
  var forecast = {
    icon: '⛅',
    text: 'Loading...',
    confidence: 'low',
    details: '',
    code: 0
  };
  
  if(historicalData.pressure.length < 12) {
    forecast.text = 'Collecting Data...';
    var remainingSeconds = (12 - historicalData.pressure.length) * 5;
    forecast.details = 'Need ' + remainingSeconds + ' more seconds';
    forecast.code = 0;
    return forecast;
  }
  
  var len = historicalData.pressure.length;
  var pressure15min = len > 36 ? historicalData.pressure[len - 36] : historicalData.pressure[0];
  var pressure30min = len > 72 ? historicalData.pressure[len - 72] : historicalData.pressure[0];
  var temp15min = len > 36 ? historicalData.temperature[len - 36] : historicalData.temperature[0];
  var hum15min = len > 36 ? historicalData.humidity[len - 36] : historicalData.humidity[0];
  
  var trend15 = currentPres - pressure15min;
  var trend30 = currentPres - pressure30min;
  var tempChange = currentTemp - temp15min;
  var humChange = currentHum - hum15min;
  var pressureRate = trend15 * 4;
  
  if(trend15 < -1 && pressureRate < -3 && humChange > 5) {
    forecast.icon = '🌧️';
    forecast.text = 'Heavy Rain Soon';
    forecast.confidence = 'high';
    forecast.details = 'Pressure dropping fast (' + pressureRate.toFixed(1) + ' hPa/hr), humidity rising';
    forecast.code = 1;
  }
  else if(trend30 < -2 && currentHum > 75) {
    forecast.icon = '🌦️';
    forecast.text = 'Rain Likely';
    forecast.confidence = 'high';
    forecast.details = 'Pressure falling (' + trend30.toFixed(1) + ' hPa/30min), high humidity';
    forecast.code = 2;
  }
  else if(trend15 < -0.5 && currentPres < 1010) {
    forecast.icon = '☁️';
    forecast.text = 'Cloudy Weather';
    forecast.confidence = 'medium';
    forecast.details = 'Low pressure (' + currentPres.toFixed(0) + ' hPa), pressure declining';
    forecast.code = 3;
  }
  else if(trend15 > 1 && pressureRate > 3) {
    forecast.icon = '☀️';
    forecast.text = 'Clear Skies Ahead';
    forecast.confidence = 'high';
    forecast.details = 'Pressure rising rapidly (' + pressureRate.toFixed(1) + ' hPa/hr)';
    forecast.code = 4;
  }
  else if(trend30 > 1.5) {
    forecast.icon = '🌤️';
    forecast.text = 'Weather Improving';
    forecast.confidence = 'medium';
    forecast.details = 'Pressure steadily rising';
    forecast.code = 5;
  }
  else if(currentPres > 1013 && currentHum < 60 && Math.abs(trend15) < 0.3) {
    forecast.icon = '☀️';
    forecast.text = 'Fair & Stable';
    forecast.confidence = 'high';
    forecast.details = 'High pressure (' + currentPres.toFixed(0) + ' hPa), low humidity';
    forecast.code = 6;
  }
  else if(currentPres < 1010 && currentHum > 70) {
    forecast.icon = '🌧️';
    forecast.text = 'Unsettled Weather';
    forecast.confidence = 'medium';
    forecast.details = 'Low pressure, high humidity (' + currentHum.toFixed(0) + '%)';
    forecast.code = 7;
  }
  else if(tempChange < -3 && trend15 < -0.5) {
    forecast.icon = '❄️';
    forecast.text = 'Cold Front Moving In';
    forecast.confidence = 'high';
    forecast.details = 'Temperature dropped ' + Math.abs(tempChange).toFixed(1) + '°C';
    forecast.code = 8;
  }
  else if(tempChange > 3 && trend15 > 0.5) {
    forecast.icon = '🌡️';
    forecast.text = 'Warm Front Approaching';
    forecast.confidence = 'high';
    forecast.details = 'Temperature rose ' + tempChange.toFixed(1) + '°C, pressure rising';
    forecast.code = 9;
  }
  else if(Math.abs(trend30) < 0.5 && Math.abs(humChange) < 3) {
    forecast.icon = '🌤️';
    forecast.text = 'Stable Conditions';
    forecast.confidence = 'high';
    forecast.details = 'No significant changes recently';
    forecast.code = 10;
  }
  else {
    forecast.icon = '⛅';
    forecast.text = 'Partly Cloudy';
    forecast.confidence = 'low';
    forecast.details = 'Conditions unclear, monitoring trends';
    forecast.code = 11;
  }
  
  return forecast;
}

function highlightCurrentCondition(forecastText) {
  document.querySelectorAll('.condition-card').forEach(card => {
    card.classList.remove('active');
  });
  
  document.querySelectorAll('.current-badge').forEach(badge => {
    badge.remove();
  });
  
  var conditionMap = {
    'Heavy Rain Soon': 'heavy-rain',
    'Rain Likely': 'rain-likely',
    'Cloudy Weather': 'cloudy',
    'Clear Skies Ahead': 'clear-skies',
    'Weather Improving': 'improving',
    'Fair & Stable': 'fair-stable',
    'Unsettled Weather': 'unsettled',
    'Cold Front Moving In': 'cold-front',
    'Warm Front Approaching': 'warm-front',
    'Stable Conditions': 'stable',
    'Partly Cloudy': 'partly-cloudy'
  };
  
  var conditionKey = conditionMap[forecastText];
  if(conditionKey) {
    var activeCard = document.querySelector('.condition-card[data-condition="' + conditionKey + '"]');
    if(activeCard) {
      activeCard.classList.add('active');
      
      var nameEl = activeCard.querySelector('.condition-name');
      var badge = document.createElement('span');
      badge.className = 'current-badge';
      badge.textContent = 'CURRENT';
      nameEl.appendChild(badge);
      
      if(window.innerWidth < 768) {
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
}

function fetchData() {
  var url = 'https://api.thingspeak.com/channels/' + CHANNEL + 
            '/feeds.json?api_key=' + READ_KEY + '&results=30';
  
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error('HTTP error! status: ' + res.status);
      return res.json();
    })
    .then(d => {
      if(!d.feeds || d.feeds.length === 0) throw new Error('No data feeds available');
      
      fc++;
      var f = d.feeds[d.feeds.length - 1];
      
      var temp = parseFloat(f.field1) || 0;
      var hum = parseFloat(f.field2) || 0;
      var pres = parseFloat(f.field3) || 0;
      
      var lightIntensity = parseInt(f.field4) || 0;

      historicalData.pressure.push(pres);
      historicalData.temperature.push(temp);
      historicalData.humidity.push(hum);
      historicalData.timestamps.push(new Date().getTime());
      
      if(historicalData.pressure.length > historicalData.maxHistory) {
        historicalData.pressure.shift();
        historicalData.temperature.shift();
        historicalData.humidity.shift();
        historicalData.timestamps.shift();
      }

      $('tv').innerHTML = temp.toFixed(1) + '<span class="un">°C</span>';
      $('hv').innerHTML = hum.toFixed(1) + '<span class="un">%</span>';
      $('pv').innerHTML = pres.toFixed(1) + '<span class="un">hPa</span>';
      
      $('weatherTemp').textContent = temp.toFixed(1);
      if(temp < minTemp) minTemp = temp;
      if(temp > maxTemp) maxTemp = temp;
      $('weatherHi').textContent = maxTemp.toFixed(1);
      $('weatherLo').textContent = minTemp.toFixed(1);
      
      var icon = '🌤️', desc = 'Pleasant';
      if(temp < 10) { icon = '❄️'; desc = 'Very Cold'; }
      else if(temp < 18) { icon = '🌥️'; desc = 'Cold'; }
      else if(temp < 25) { icon = '🌤️'; desc = 'Comfortable'; }
      else if(temp < 30) { icon = '🌞'; desc = 'Warm'; }
      else { icon = '🔥'; desc = 'Hot'; }
      
      $('weatherIcon').textContent = icon;
      $('weatherDesc').textContent = desc;
      
      var advancedForecast = getAdvancedForecast(temp, hum, pres);
      $('forecast').innerHTML = advancedForecast.icon + ' ' + advancedForecast.text;
      
      if(advancedForecast.code !== currentForecastCode) {
        console.log('🔄 Forecast changed from', currentForecastCode, 'to', advancedForecast.code);
      }
      currentForecastCode = advancedForecast.code;
      
      if(!firstForecastSent && currentForecastCode >= 0) {
        firstForecastSent = true;
        sendForecastToThingSpeak(currentForecastCode);
      }
      
      highlightCurrentCondition(advancedForecast.text);
      
      var forecastCard = $('forecast').closest('.cd');
      if(forecastCard) {
        var subtitle = forecastCard.querySelector('.su');
        if(subtitle) {
          subtitle.textContent = advancedForecast.details;
        }
      }
      
      $('homeTemp').innerHTML = temp.toFixed(1) + '°C';
      $('hp').style.left = Math.max(0, Math.min(100, hum)) + '%';
      
      updateOfficeLights(lightIntensity);

      var tempData = [], humData = [], presData = [], lightData = [];
      for(var i = 0; i < d.feeds.length; i++) {
        tempData.push(parseFloat(d.feeds[i].field1) || 0);
        humData.push(parseFloat(d.feeds[i].field2) || 0);
        presData.push(parseFloat(d.feeds[i].field3) || 0);
        var currentLight = parseInt(d.feeds[i].field4) || 0;
        lightData.push(currentLight);
      }

      drawChart($('c1'), tempData, '#ff6b6b', '°C', 
                {min:'tempMin', max:'tempMax', avg:'tempAvg', count:'tempCount'});
      drawChart($('c2'), humData, '#4ecdc4', '%', 
                {min:'humMin', max:'humMax', avg:'humAvg', count:'humCount'});
      drawChart($('c3'), presData, '#ffd93d', 'hPa', 
                {min:'presMin', max:'presMax', avg:'presAvg', count:null});
      drawChart($('c4'), lightData, '#ffd93d', '%', 
                {min:'lightMin', max:'lightMax', avg:'lightAvg', count:null});
      
      var presTrend = presData.length > 1 ? presData[presData.length-1] - presData[0] : 0;
      $('presTrend').textContent = presTrend > 0 ? '📈 Rising' : presTrend < 0 ? '📉 Falling' : '➡️ Stable';
      
      var maxLight = lightIntensity;
      var lMode = maxLight === 0 ? 'OFF' : maxLight <= 25 ? 'ECO' : 
                  maxLight <= 50 ? 'NORMAL' : maxLight <= 75 ? 'BRIGHT' : 'MAX';
      $('lightMode').textContent = lMode;

      $('st').className = 'sd ok';
      $('st2').className = 'sd ok';
      $('st3').className = 'sd ok';
      $('st4').className = 'sd ok';
      $('su').textContent = 'Live · Updated ' + fc + ' times';
      $('homeStatus').textContent = 'LIVE';
    })
    .catch(err => {
      console.error('Fetch Error:', err);
      $('st').className = 'sd er';
      $('st2').className = 'sd er';
      $('st3').className = 'sd er';
      $('st4').className = 'sd er';
      $('su').textContent = 'Error: ' + err.message;
      $('homeStatus').textContent = 'ERROR';
    });
}

for(let i = 1; i <= 2; i++) {
  $('colorPicker' + i).addEventListener('input', function() {
    $('colorInput' + i).value = this.value.toUpperCase();
    $('ledPreview' + i).style.backgroundColor = this.value;
  });
  
  $('colorInput' + i).addEventListener('input', function() {
    var val = this.value;
    if(val.startsWith('#') && (val.length === 7 || val.length === 4)) {
      $('colorPicker' + i).value = val;
      $('ledPreview' + i).style.backgroundColor = val;
    }
  });
}

function applyColor(room) {
  var color = $('colorInput' + room).value.replace('#', '');
  
  if(!/^[0-9A-F]{6}$/i.test(color)) {
    alert('Invalid HEX color! Use format: #RRGGBB');
    return;
  }
  
  console.log('Sending to Arduino: Room ' + room + ' = #' + color);
  alert('✅ Color #' + color + ' applied to Room ' + room);
}

fetchData();
setInterval(fetchData, UPDATE_INTERVAL);
$('homeEntries').textContent = '12';
$('todayCount').textContent = '12';

console.log('✅ Weather forecast system initialized. Forecast codes will be sent to Field 7 every 2.5 minutes.');

setInterval(function() {
  if(currentForecastCode >= 0) {
    sendForecastToThingSpeak(currentForecastCode);
  }
}, 150000);

console.log('📡 Continuous forecast sending active: Every 150 seconds (2.5 minutes)');
