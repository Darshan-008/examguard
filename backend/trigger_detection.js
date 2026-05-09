async function triggerDetection() {
  try {
    const res = await fetch('http://localhost:5000/api/detection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'ESP32-A101',
        macAddress: 'AA:BB:CC:DD:EE:FF',
        rssi: -55,
        deviceName: 'Test Phone'
      })
    });
    const data = await res.json();
    console.log('Detection Triggered:', data);
  } catch (err) {
    console.error('Trigger Failed:', err.message);
  }
}

triggerDetection();
