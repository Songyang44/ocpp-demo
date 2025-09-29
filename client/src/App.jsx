// client/src/App.jsx
import { useRef, useState, useEffect } from "react";

function genMsgId() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export default function App() {
  const socketRef = useRef(null);
  const [logs, setLogs] = useState([]);
  const [cpId, setCpId] = useState("CP_1");
  const [connected, setConnected] = useState(false);
  const [autoHeartbeat, setAutoHeartbeat] = useState(false);
  const hbTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  const log = (s) => setLogs((l) => [...l, `${new Date().toLocaleTimeString()} ${s}`]);

  const connect = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      log("Already connected");
      return;
    }
    const url = `ws://localhost:9000/${cpId}`;
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      log(`Connected to central system at ${url}`);
    };

    ws.onmessage = (evt) => {
      log(`RECV: ${evt.data}`);
    };

    ws.onclose = () => {
      setConnected(false);
      log("Connection closed");
    };

    ws.onerror = (err) => {
      log("WebSocket error");
      console.error(err);
    };
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setConnected(false);
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
    const msg = [2, genMsgId(), "BootNotification", { chargePointVendor: "DemoVendor", chargePointModel: "SimModel-1" }];
    sendRaw(msg);
  };

  const sendHeartbeat = () => {
    const msg = [2, genMsgId(), "Heartbeat", {}];
    sendRaw(msg);
  };

  const sendStartTransaction = () => {
    const msg = [
      2,
      genMsgId(),
      "StartTransaction",
      {
        connectorId: 1,
        idTag: "TEST_ID_001",
        meterStart: 0,
        timestamp: new Date().toISOString()
      }
    ];
    sendRaw(msg);
  };

  const sendStopTransaction = () => {
    const msg = [
      2,
      genMsgId(),
      "StopTransaction",
      {
        connectorId: 1,
        meterStop: Math.floor(Math.random() * 10000),
        timestamp: new Date().toISOString()
      }
    ];
    sendRaw(msg);
  };

  const sendMeterValues = () => {
    const msg = [
      2,
      genMsgId(),
      "MeterValues",
      {
        connectorId: 1,
        transactionId: null,
        meterValue: [
          {
            timestamp: new Date().toISOString(),
            sampledValue: [{ value: (Math.random() * 20).toFixed(2), unit: "kW" }]
          }
        ]
      }
    ];
    sendRaw(msg);
  };

  const sendBadJson = () => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      log("Socket not open");
      return;
    }
    socketRef.current.send("THIS IS NOT JSON");
    log("SEND: THIS IS NOT JSON");
  };

  // autohb toggle
  useEffect(() => {
    if (autoHeartbeat) {
      sendHeartbeat();
      hbTimerRef.current = setInterval(sendHeartbeat, 10000);
    } else {
      if (hbTimerRef.current) {
        clearInterval(hbTimerRef.current);
        hbTimerRef.current = null;
      }
    }
    return () => {
      if (hbTimerRef.current) clearInterval(hbTimerRef.current);
    };
  }, [autoHeartbeat]);

  return (
    <div style={{ padding: 16, fontFamily: "Arial, sans-serif" }}>
      <h1>EV Charger Simulator (Browser)</h1>

      <div style={{ marginBottom: 8 }}>
        <label>ChargePoint ID: </label>
        <input value={cpId} onChange={(e) => setCpId(e.target.value)} />
        <button onClick={connect} disabled={connected} style={{ marginLeft: 8 }}>Connect</button>
        <button onClick={disconnect} disabled={!connected} style={{ marginLeft: 8 }}>Disconnect</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <button onClick={sendBootNotification} disabled={!connected}>BootNotification</button>
        <button onClick={sendHeartbeat} disabled={!connected} style={{ marginLeft: 8 }}>Heartbeat</button>
        <button onClick={sendStartTransaction} disabled={!connected} style={{ marginLeft: 8 }}>StartTransaction</button>
        <button onClick={sendStopTransaction} disabled={!connected} style={{ marginLeft: 8 }}>StopTransaction</button>
        <button onClick={sendMeterValues} disabled={!connected} style={{ marginLeft: 8 }}>MeterValues</button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>
          <input type="checkbox" checked={autoHeartbeat} onChange={(e) => setAutoHeartbeat(e.target.checked)} />
          Auto Heartbeat (every 10s)
        </label>

        <button onClick={sendBadJson} style={{ marginLeft: 16 }}>Send Bad JSON</button>
      </div>

      <div style={{
        border: "1px solid #ddd",
        height: 360,
        overflow: "auto",
        padding: 8,
        background: "#fafafa"
      }}>
        {logs.map((l, i) => <div key={i} style={{ fontSize: 12 }}>{l}</div>)}
      </div>
    </div>
  );
}
