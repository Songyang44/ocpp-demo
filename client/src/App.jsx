import { useRef, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";

function genMsgId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function App() {
  const socketRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [cpId, setCpId] = useState("CP_1");
  const [connected, setConnected] = useState(false);
  const [charging, setCharging] = useState(false);
  const [powerData, setPowerData] = useState([]);
  const [serverPowerData, setServerPowerData] = useState([]);
  const chargeTimerRef = useRef(null);

  const log = (s) => setLogs((l) => [...l, `${new Date().toLocaleTimeString()} ${s}`]);

  const connect = () => {
    const url = `ws://localhost:9000/${cpId}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      log(`Connected to central system at ${url}`);
    };

    ws.onmessage = (evt) => {
      log(`RECV: ${evt.data}`);
      try {
        const data = JSON.parse(evt.data);
        if (Array.isArray(data) && data[0] === 3) {
          const payload = data[2] || {};
          if (payload.serverReceivedPower !== undefined) {
            // t 用 powerData 长度保证时间轴对齐
            const t = powerData.length;
            setServerPowerData((prev) => [...prev, { time: t, power: payload.serverReceivedPower }]);
          }
        }
      } catch (e) { /* empty */ }
    };

    ws.onclose = () => {
      setConnected(false);
      log("Connection closed");
      stopCharging();
    };
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setConnected(false);
      stopCharging();
      log("Disconnected by user");
    }
  };

  function sendRaw(obj) {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      log("Socket not open");
      return;
    }
    const text = JSON.stringify(obj);
    socketRef.current.send(text);
    log(`SEND: ${text}`);
  }

  const sendBootNotification = () => {
    sendRaw([2, genMsgId(), "BootNotification", { chargePointVendor: "DemoVendor", chargePointModel: "SimModel-1" }]);
  };

  const startCharging = () => {
    if (!connected) return;
    sendRaw([2, genMsgId(), "StartTransaction", { connectorId: 1, idTag: "TEST_ID_001", meterStart: 0, timestamp: new Date().toISOString() }]);

    setCharging(true);
    setPowerData([]);
    setServerPowerData([]);
    let t = 0;

    chargeTimerRef.current = setInterval(() => {
      let power;
      if (t < 30) power = t * 0.5 + Math.random();
      else if (t < 120) power = 15 + Math.random();
      else power = Math.max(0, 15 - (t - 120) * 0.2 + Math.random());

      const newPoint = { time: t, power: parseFloat(power.toFixed(2)) };
      setPowerData((prev) => [...prev, newPoint]);

      sendRaw([2, genMsgId(), "MeterValues", {
        connectorId: 1,
        meterValue: [{ timestamp: new Date().toISOString(), sampledValue: [{ value: newPoint.power, unit: "kW" }] }]
      }]);

      t++;
    }, 1000);
  };

  const stopCharging = () => {
    if (chargeTimerRef.current) {
      clearInterval(chargeTimerRef.current);
      chargeTimerRef.current = null;
    }
    if (charging) {
      sendRaw([2, genMsgId(), "StopTransaction", { connectorId: 1, meterStop: Math.floor(Math.random() * 10000), timestamp: new Date().toISOString() }]);
      setCharging(false);
    }
  };

  // 合并数据绘图
  const mergedData = powerData.map((p, idx) => ({
    time: p.time,
    simPower: p.power,
    serverPower: serverPowerData[idx]?.power ?? null
  }));

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h1>EV Charger Simulator</h1>
      <div style={{ marginBottom: 8 }}>
        <label>ChargePoint ID: </label>
        <input value={cpId} onChange={(e) => setCpId(e.target.value)} />
        <button onClick={connect} disabled={connected} style={{ marginLeft: 8 }}>Connect</button>
        <button onClick={disconnect} disabled={!connected} style={{ marginLeft: 8 }}>Disconnect</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button onClick={sendBootNotification} disabled={!connected}>BootNotification</button>
        <button onClick={startCharging} disabled={!connected || charging} style={{ marginLeft: 8 }}>Start Charging</button>
        <button onClick={stopCharging} disabled={!connected || !charging} style={{ marginLeft: 8 }}>Stop Charging</button>
      </div>

      <h2>Power Curve</h2>
      <div style={{ height: 300, background: "#fff", padding: 8, border: "1px solid #ddd" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mergedData}>
            <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
            <XAxis dataKey="time" label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
            <YAxis label={{ value: "Power (kW)", angle: -90, position: "insideLeft" }} />
            <Tooltip />
            <Line type="monotone" dataKey="simPower" stroke="#007BFF" name="Simulated Power" dot={false} />
            <Line type="monotone" dataKey="serverPower" stroke="#FF4500" name="Server Received" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <h2>Logs</h2>
      <div style={{ border: "1px solid #ddd", height: 200, overflow: "auto", padding: 8, background: "#fafafa" }}>
        {logs.map((l, i) => <div key={i} style={{ fontSize: 12 }}>{l}</div>)}
      </div>
    </div>
  );
}
