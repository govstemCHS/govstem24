// src/App.jsx
import React, { useState, useEffect } from 'react';
import './App.css';

export default function App() {
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [showDeviceList, setShowDeviceList] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [error, setError] = useState('');
    const [userData, setUserData] = useState({
        age: '',
        sex: 'M',
        height: '',
        weight: '',
        fitness: 3,
    });
    const [restingHR, setRestingHR] = useState(null);
    const [measuring, setMeasuring] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(60);

    // Mocked list of available Bluetooth devices
    const devices = [
        { id: 'xiao', name: 'Seeed Studio XIAO nRF52840 Sense' },
        { id: 'demo1', name: 'Airpod Pros' },
        { id: 'demo2', name: 'AB SHUTTER 3' }
    ];

    // Clean up any timer on unmount
    useEffect(() => {
        return () => clearInterval(window.hrInterval);
    }, []);

    // “Connect” shows the list of devices
    const connectToDevice = () => {
        setError('');
        setShowDeviceList(true);
    };

    // User selects a device, then start fake connecting sequence
    const selectDevice = device => {
        setSelectedDevice(device);
        setShowDeviceList(false);
        setConnecting(true);
        // simulate a brief connection handshake
        setTimeout(() => {
            setConnecting(false);
            setConnected(true);
        }, 1000); // 1s delay
    };

    // Start a fake 60s HR test, with a countdown and random final HR
    const startRestingHRTest = () => {
        setError('');
        setMeasuring(true);
        setSecondsLeft(60);

        window.hrInterval = setInterval(() => {
            setSecondsLeft(prev => {
                if (prev <= 1) {
                    clearInterval(window.hrInterval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        setTimeout(() => {
            clearInterval(window.hrInterval);
            setMeasuring(false);
            const simulatedHR = Math.floor(Math.random() * 20) + 60;
            setRestingHR(simulatedHR);
        }, 60000);
    };

    // “Send” just shows an alert with the JSON profile
    const sendUserData = () => {
        setError('');
        alert('Profile sent:\n' + JSON.stringify(userData, null, 2));
    };

    // SVG timer math
    const radius = 60,
        stroke = 8;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const progress = measuring ? secondsLeft / 60 : 0;
    const dashOffset = circumference - progress * circumference;

    return (
        <div className="container">
            <div className="card">
                <h1 className="title">Health Profile</h1>
                {error && <p className="error">{error}</p>}

                {/* Connect / Device Selection / Status */}
                {!connected && !connecting && !showDeviceList && (
                    <button onClick={connectToDevice} className="button button-blue">
                        Connect to Device
                    </button>
                )}

                {showDeviceList && (
                    <div className="device-list">
                        <p className="label">Select a device:</p>
                        {devices.map(device => (
                            <button
                                key={device.id}
                                onClick={() => selectDevice(device)}
                                className="button button-blue"
                                style={{ marginBottom: '0.5rem' }}
                            >
                                {device.name}
                            </button>
                        ))}
                    </div>
                )}

                {connecting && selectedDevice && (
                    <p className="status">🔌 Connecting to {selectedDevice.name}...</p>
                )}

                {connected && selectedDevice && (
                    <p className="status">✅ Connected to {selectedDevice.name}</p>
                )}

                {/* Profile Form */}
                <label className="label">Age</label>
                <input
                    type="number"
                    className="input"
                    value={userData.age}
                    onChange={e =>
                        setUserData({ ...userData, age: e.target.value })
                    }
                />

                <label className="label">Sex</label>
                <select
                    className="input"
                    value={userData.sex}
                    onChange={e =>
                        setUserData({ ...userData, sex: e.target.value })
                    }
                >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                </select>

                <label className="label">Height (cm)</label>
                <input
                    type="number"
                    className="input"
                    value={userData.height}
                    onChange={e =>
                        setUserData({ ...userData, height: e.target.value })
                    }
                />

                <label className="label">Weight (kg)</label>
                <input
                    type="number"
                    className="input"
                    value={userData.weight}
                    onChange={e =>
                        setUserData({ ...userData, weight: e.target.value })
                    }
                />

                <label className="label">Fitness Level (1–5)</label>
                <input
                    type="range"
                    className="input"
                    min="1"
                    max="5"
                    value={userData.fitness}
                    onChange={e =>
                        setUserData({ ...userData, fitness: +e.target.value })
                    }
                />

                {/* Resting HR Test */}
                <label className="label">Resting HR Test</label>
                <button
                    onClick={startRestingHRTest}
                    className="button button-green"
                >
                    {measuring ? 'Measuring...' : 'Start 60s Test'}
                </button>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {measuring ? (
                        <svg height={radius * 2} width={radius * 2}>
                            <circle
                                stroke="#e5e7eb"
                                fill="transparent"
                                strokeWidth={stroke}
                                r={normalizedRadius}
                                cx={radius}
                                cy={radius}
                            />
                            <circle
                                stroke="#3b82f6"
                                fill="transparent"
                                strokeWidth={stroke}
                                strokeDasharray={`${circumference} ${circumference}`}
                                strokeDashoffset={dashOffset}
                                r={normalizedRadius}
                                cx={radius}
                                cy={radius}
                                transform={`rotate(-90 ${radius} ${radius})`}
                            />
                            <text
                                x="50%"
                                y="50%"
                                dominantBaseline="middle"
                                textAnchor="middle"
                                className="title"
                            >
                                {secondsLeft}
                            </text>
                        </svg>
                    ) : restingHR != null ? (
                        <p className="status">Resting HR: {restingHR} bpm</p>
                    ) : null}
                </div>

                {/* Save & Send */}
                <button
                    onClick={sendUserData}
                    className="button button-indigo"
                >
                    Save &amp; Send
                </button>
            </div>
        </div>
    );
}
