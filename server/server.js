// server/server.js
// Minimal OCPP-like Central System using "ws"
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 9000 });
console.log("OCPP Central System listening on ws://localhost:9000");

let txCounter = 1000;

function sendCallResult(ws, messageId, payload) {
  ws.send(JSON.stringify([3, messageId, payload]));
}

function sendCallError(ws, messageId, errorName, errorDescription = "", details = {}) {
  ws.send(JSON.stringify([4, messageId, errorName, errorDescription, details]));
}

wss.on("connection", (ws, req) => {
  const cpId = (req.url || "/").slice(1) || "unknown";
  console.log(`Charge point connected: ${cpId}`);

  // optional: store connection info
  ws.cpId = cpId;

  ws.on("message", (msg) => {
    console.log(`<< [${cpId}] ${msg}`);
    let data;
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.log("Invalid JSON received");
      return;
    }

    // OCPP JSON structure (simplified):
    // CALL  : [2, "<messageId>", "<action>", {payload}]
    // CALLRESULT: [3, "<messageId>", {payload}]
    // CALLERROR : [4, "<messageId>", "<errorName>", "<errorDescription>", {details}]

    if (!Array.isArray(data) || data.length < 2) return;

    const messageType = data[0];

    if (messageType === 2) { // CALL from Charge Point
      const messageId = data[1];
      const action = data[2];
      const payload = data[3] || {};

      switch (action) {
        case "BootNotification":
          sendCallResult(ws, messageId, {
            status: "Accepted",
            currentTime: new Date().toISOString(),
            heartbeatInterval: 10
          });
          break;

        case "Heartbeat":
          sendCallResult(ws, messageId, { currentTime: new Date().toISOString() });
          break;

        case "StartTransaction":
          // Simulate accept and assign transactionId
          txCounter += 1;
          const transactionId = txCounter;
          sendCallResult(ws, messageId, { transactionId, idTagInfo: { status: "Accepted" } });

          // OPTIONALLY: simulate periodic MeterValues by asking CP to send them - for demo, we just log
          console.log(`[Central] Started transaction ${transactionId} for CP ${cpId}`);
          break;

        case "StopTransaction":
          // Accept stop
          sendCallResult(ws, messageId, { idTagInfo: { status: "Accepted" } });
          console.log(`[Central] Stopped transaction (call id ${messageId}) for CP ${cpId}`);
          break;

        case "MeterValues":
          // log meter values
          console.log(`[MeterValues] from ${cpId}:`, payload);
          sendCallResult(ws, messageId, {});
          break;

        default:
          // Not supported action -> send CALLERROR
          sendCallError(ws, messageId, "NotSupported", `Action ${action} not supported`, {});
          break;
      }
    } else {
      console.log("Ignoring non-CALL message:", data);
    }
  });

  ws.on("close", () => {
    console.log(`Connection closed: ${cpId}`);
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});
