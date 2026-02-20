// --- LED STATE (Room 1 = Arduino, Room 2 = M5Stack) ---
var lastUpdateTime = 0;
var deviceState = {
    room1: { r: 255, g: 255, b: 255 }, // Arduino
    room2: { r: 255, g: 255, b: 255 }  // M5Stack
};

function updateLocalState(room) {
    const picker = $(`colorPicker${room}`), input = $(`colorInput${room}`), preview = $(`ledPreview${room}`);
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
    const diff = (now - lastUpdateTime) / 1000;

    if (diff < 15) {
        const rem = Math.ceil(15 - diff);
        const oldText = btn.textContent;
        btn.textContent = `⏳ Cool down (${rem}s)`;
        setTimeout(() => { btn.textContent = oldText; }, 2000);
        return; 
    }

    const s = deviceState;
    // Format: R1,G1,B1 (Arduino) , R2,G2,B2 (M5GO)
    const combinedData = `${s.room1.r},${s.room1.g},${s.room1.b},${s.room2.r},${s.room2.g},${s.room2.b}`;
    
    btn.textContent = "🚀 Sending...";
    btn.disabled = true;

    fetch(`https://api.thingspeak.com/update?api_key=${WRITE_KEY}&field8=${combinedData}&_=${Date.now()}`)
        .then(res => res.text()).then(data => {
            if (data !== "0") {
                lastUpdateTime = Date.now();
                btn.textContent = "✅ Synced Both";
            } else {
                btn.textContent = "❌ Busy";
            }
            setTimeout(() => { 
                btn.disabled = false; 
                btn.textContent = room === 1 ? "Apply to Arduino" : "Apply to M5Stack"; 
            }, 3000);
        });
}
