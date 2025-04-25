import React, { useState, useEffect } from 'react';

// Replace these UUIDs with your own
const SERVICE_UUID     = '19b10000-e8f2-537e-4f6c-d104768a1214';
const DATA_CHAR_UUID   = '19b10001-e8f2-537e-4f6c-d104768a1214';
const HR_CONTROL_UUID  = '19b10002-e8f2-537e-4f6c-d104768a1214';
const HR_NOTIFY_UUID   = '19b10003-e8f2-537e-4f6c-d104768a1214';

export default function App() {
  const [device, setDevice] = useState(null);
  const [server, setServer] = useState(null);
  const [connected, setConnected] = useState(false);
  const [dataChar, setDataChar] = useState(null);
  const [hrControlChar, setHrControlChar] = useState(null);
  const [hrNotifyChar, setHrNotifyChar] = useState(null);
  const [error, setError] = useState('');

  const [userData, setUserData] = useState({ age: '', sex: 'M', height: '', weight: '', fitness: 3 });
  const [restingHR, setRestingHR] = useState(null);
  const [measuring, setMeasuring] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    return () => clearInterval(window.hrInterval);
  }, []);

  const connectToDevice = async () => {
    setError('');
    try {
      const dev = await navigator.bluetooth.requestDevice({ filters: [{ services: [SERVICE_UUID] }] });
      setDevice(dev);
      const srv = await dev.gatt.connect();
      setServer(srv);
      const service = await srv.getPrimaryService(SERVICE_UUID);
      setDataChar(await service.getCharacteristic(DATA_CHAR_UUID));
      setHrControlChar(await service.getCharacteristic(HR_CONTROL_UUID));
      const notify = await service.getCharacteristic(HR_NOTIFY_UUID);
      setHrNotifyChar(notify);

      await notify.startNotifications();
      notify.addEventListener('characteristicvaluechanged', evt => {
        const hr = evt.target.value.getUint8(0);
        setRestingHR(hr);
      });

      setConnected(true);
    } catch (err) {
      setError('Failed to connect to device');
      console.error(err);
      setConnected(false);
    }
  };

  const startRestingHRTest = async () => {
    if (!connected || !hrControlChar) {
      setError('Device not connected');
      return;
    }
    setError('');
    setMeasuring(true);
    setSecondsLeft(60);

    try {
      await hrControlChar.writeValue(new TextEncoder().encode('start'));
    } catch (err) {
      setError('Failed to start HR test');
      console.error(err);
      setMeasuring(false);
      return;
    }

    window.hrInterval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(window.hrInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    setTimeout(async () => {
      clearInterval(window.hrInterval);
      setMeasuring(false);
      try {
        await hrControlChar.writeValue(new TextEncoder().encode('stop'));
      } catch (err) {
        setError('Failed to stop HR test');
        console.error(err);
      }
    }, 60000);
  };

  const sendUserData = async () => {
    if (!connected || !dataChar) {
      setError('Device not connected');
      return;
    }
    setError('');
    try {
      const json = JSON.stringify(userData);
      await dataChar.writeValue(new TextEncoder().encode(json));
      alert('Profile sent!');
    } catch (err) {
      setError('Failed to send profile');
      console.error(err);
    }
  };

  // SVG timer ring calculations
  const radius = 60;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const progress = measuring ? secondsLeft / 60 : 0;
  const dashOffset = circumference - progress * circumference;

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">Health Profile</h1>

        {error && <p className="text-red-600 mb-2">{error}</p>}

        {!connected ? (
          <button onClick={connectToDevice}
            className="w-full py-2 mb-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            Connect to Device
          </button>
        ) : (
          <p className="text-green-600 font-medium mb-4">Connected to {device.name || device.id}</p>
        )}

        <div className="space-y-4">
          {/* Form fields omitted for brevity; same as before */}

          <div>
            <label className="block text-sm font-medium mb-1">Resting HR Test</label>
            <button onClick={startRestingHRTest}
              disabled={!connected || measuring}
              className={`w-full py-2 mb-2 ${!connected ? 'bg-gray-300' : measuring ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg`}>
              {measuring ? 'Measuring...' : 'Start 60s Test'}
            </button>
            <div className="flex justify-center">
              {measuring ? (
                <svg height={radius * 2} width={radius * 2}>
                  <circle stroke="#E5E7EB" fill="transparent" strokeWidth={stroke}
                    r={normalizedRadius} cx={radius} cy={radius} />
                  <circle stroke="#3B82F6" fill="transparent" strokeWidth={stroke}
                    strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset}
                    r={normalizedRadius} cx={radius} cy={radius}
                    transform={`rotate(-90 ${radius} ${radius})`} />
                  <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
                    className="text-xl font-semibold fill-current">{secondsLeft}</text>
                </svg>
              ) : restingHR != null ? (
                <p className="mt-2 text-center text-lg">Resting HR: {restingHR} bpm</p>
              ) : null}
            </div>
          </div>

          <button onClick={sendUserData}
            disabled={!connected}
            className={`w-full py-2 ${!connected ? 'bg-gray-300' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg`}>
            Save &amp; Send
          </button>
        </div>
      </div>
    </div>
  );
}
