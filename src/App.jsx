// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// -------------------------------------------------------------------------
// UUID CONFIGURATION (MUST MATCH C++ FIRMWARE)
// -------------------------------------------------------------------------
const HEART_RATE_SERVICE_UUID = 0x180D;
const HR_MEASUREMENT_CHARACTERISTIC = 0x2A37;
const USER_DATA_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const USER_DATA_WRITE_CHARACTERISTIC = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function App() {
    // --- STATE MANAGEMENT ---
    const [userId, setUserId] = useState('');
    const [authenticated, setAuthenticated] = useState(false);
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState('');
    
    // Data State 
    const [userData, setUserData] = useState({
        age: '', 
        sex: 'M', 
        height: '', 
        weight: '', 
        fitness: 3,
    });
    
    const [liveHR, setLiveHR] = useState(0); 
    const [restingHR, setRestingHR] = useState(null); 
    
    // Timer State
    const [measuring, setMeasuring] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(60);
    const hrReadingsRef = useRef([]); 

    // Bluetooth References
    const deviceRef = useRef(null);
    const writeCharacteristicRef = useRef(null);

    // --- CLEANUP ---
    useEffect(() => {
        return () => {
            if (deviceRef.current && deviceRef.current.gatt.connected) {
                deviceRef.current.gatt.disconnect();
            }
            clearInterval(window.timerInterval);
        };
    }, []);

    // --- 1. AUTHENTICATION ---
    const handleLogin = () => {
        if (userId === '001') {
            setError('');
            setAuthenticated(true);
        } else {
            setError('Invalid User ID');
        }
    };

    // --- 2. BLUETOOTH CONNECTION ---
    const connectToDevice = async () => {
        setError('');
        setConnecting(true);
        try {
            console.log("Requesting Bluetooth Device...");
            
            // 1. Open Chrome Bluetooth Picker
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: [HEART_RATE_SERVICE_UUID] }],
                optionalServices: [USER_DATA_SERVICE_UUID]
            });

            deviceRef.current = device;
            device.addEventListener('gattserverdisconnected', onDisconnected);

            // 2. Connect to the GATT Server
            const server = await device.gatt.connect();

            // 3. Connect to Heart Rate Service & Listen
            const hrService = await server.getPrimaryService(HEART_RATE_SERVICE_UUID);
            const hrChar = await hrService.getCharacteristic(HR_MEASUREMENT_CHARACTERISTIC);
            await hrChar.startNotifications();
            hrChar.addEventListener('characteristicvaluechanged', handleHRUpdate);

            // 4. Connect to Custom User Data Service (for writing)
            try {
                const userService = await server.getPrimaryService(USER_DATA_SERVICE_UUID);
                writeCharacteristicRef.current = await userService.getCharacteristic(USER_DATA_WRITE_CHARACTERISTIC);
            } catch (err) {
                console.warn("Could not bind write characteristic", err);
            }

            setConnected(true);
        } catch (err) {
            console.error(err);
            setError("Connection failed. Ensure device is on and nearby.");
        } finally {
            setConnecting(false);
        }
    };

    const onDisconnected = () => {
        setConnected(false);
        setLiveHR(0);
        alert('Device disconnected');
    };

    // --- 3. DATA HANDLING ---
    const handleHRUpdate = (event) => {
        const value = event.target.value;
        // Parse Standard BLE Heart Rate (first byte is flags, second is value)
        const flags = value.getUint8(0);
        // If bit 0 is 0, it's UINT8. If 1, it's UINT16.
        const bpm = (flags & 1) ? value.getUint16(1, true) : value.getUint8(1);
        
        setLiveHR(bpm);

        // If test is running, save data
        if (hrReadingsRef.current) {
            hrReadingsRef.current.push(bpm);
        }
    };

    const sendUserData = async () => {
        if (!writeCharacteristicRef.current) return;
        try {
            const jsonString = JSON.stringify(userData);
            const encoder = new TextEncoder();
            await writeCharacteristicRef.current.writeValue(encoder.encode(jsonString));
            alert('Profile sent to hardware successfully!');
        } catch (err) {
            setError(`Upload failed: ${err.message}`);
        }
    };

    // --- 4. TEST LOGIC ---
    const startRestingHRTest = () => {
        if (!connected) return setError("Connect device first!");
        
        setMeasuring(true);
        setSecondsLeft(60);
        hrReadingsRef.current = []; // Reset storage

        window.timerInterval = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(window.timerInterval);
                    finishTest();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const finishTest = () => {
        setMeasuring(false);
        const readings = hrReadingsRef.current;
        if (readings && readings.length > 0) {
            const avg = Math.floor(readings.reduce((a, b) => a + b, 0) / readings.length);
            setRestingHR(avg);
        } else {
            setError("No data received during test.");
        }
    };

    // --- VISUALIZATION HELPERS ---
    const radius = 60;
    const stroke = 8;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (measuring ? secondsLeft / 60 : 0) * circumference;

    // --- RENDER ---
    if (!authenticated) {
        return (
            <div className="container">
                <div className="card">
                    <h1 className="title">HotWatch Login</h1>
                    {error && <p className="error">{error}</p>}
                    <input type="password" className="input" placeholder="Product Key" 
                           value={userId} onChange={e => setUserId(e.target.value)} />
                    <button onClick={handleLogin} className="button button-blue">Enter</button>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="card">
                <h1 className="title">HotWatch Monitor</h1>
                {error && <p className="error">{error}</p>}

                {/* CONNECTION STATUS */}
                {!connected ? (
                    <button onClick={connectToDevice} className="button button-blue">
                        {connecting ? 'Connecting...' : 'Pair Device'}
                    </button>
                ) : (
                    <div className="status-box">
                        <p className="status-live">Connected</p>
                        <p className="hr-large">{liveHR} <span>BPM</span></p>
                    </div>
                )}

                {/* FULL PROFILE FORM */}
                <div className="form-grid">
                    <div className="form-group">
                        <label className="label">Age</label>
                        <input type="number" className="input" value={userData.age} 
                               onChange={e => setUserData({...userData, age: e.target.value})} />
                    </div>

                    <div className="form-group">
                        <label className="label">Sex</label>
                        <select className="input" value={userData.sex} 
                                onChange={e => setUserData({ ...userData, sex: e.target.value })}>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">Height (cm)</label>
                        <input type="number" className="input" value={userData.height} 
                               onChange={e => setUserData({ ...userData, height: e.target.value })} />
                    </div>

                    <div className="form-group">
                        <label className="label">Weight (kg)</label>
                        <input type="number" className="input" value={userData.weight} 
                               onChange={e => setUserData({...userData, weight: e.target.value})} />
                    </div>

                    <div className="form-group full-width">
                        <label className="label">Fitness Level (1-5)</label>
                        <input type="range" className="input" min="1" max="5" 
                               value={userData.fitness} 
                               onChange={e => setUserData({ ...userData, fitness: +e.target.value })} />
                        <div style={{textAlign: 'center', fontSize: '0.9rem'}}>{userData.fitness}</div>
                    </div>
                </div>

                {/* TEST UI */}
                <div className="test-section">
                    <button onClick={startRestingHRTest} disabled={measuring || !connected} 
                            className={`button ${measuring ? 'button-disabled' : 'button-green'}`}>
                        {measuring ? 'Measuring...' : 'Start 60s Analysis'}
                    </button>
                    
                    <div className="circle-container" style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
                        {measuring ? (
                            <svg height={radius * 2} width={radius * 2}>
                                <circle stroke="#e5e7eb" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                                <circle stroke="#3b82f6" fill="transparent" strokeWidth={stroke} 
                                        strokeDasharray={`${circumference} ${circumference}`} 
                                        style={{ strokeDashoffset, transition: 'stroke-dashoffset 1s linear' }} 
                                        r={normalizedRadius} cx={radius} cy={radius} 
                                        transform={`rotate(-90 ${radius} ${radius})`} />
                                <text x="50%" y="50%" dy=".3em" textAnchor="middle" className="timer-text" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{secondsLeft}</text>
                            </svg>
                        ) : restingHR && (
                            <div className="result-box" style={{ textAlign: 'center' }}>
                                <p style={{ margin: 0, color: '#6b7280' }}>Resting HR</p>
                                <h2 style={{ margin: 0, fontSize: '2rem', color: '#111827' }}>{restingHR}</h2>
                            </div>
                        )}
                    </div>
                </div>

                <button onClick={sendUserData} disabled={!connected} className="button button-indigo" style={{ marginTop: '20px' }}>
                    Sync Profile to Device
                </button>
            </div>
        </div>
    );
}
