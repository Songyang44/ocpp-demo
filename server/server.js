// server/server.js
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 9000 });
console.log("OCPP Central System listening on ws://localhost:9000");

let txCounter = 1000;

// 用于存储每个 CP 的功率数据
const meterDataStore = {}; // { cpId: [{ timestamp, power }] }

function sendCallResult(ws, messageId, payload) {
  ws.send(JSON.stringify([3, messageId, payload]));
}

wss.on("connection", (ws, req) => {
  const cpId = (req.url || "/").slice(1) || "unknown";
  console.log(`Charge point connected: ${cpId}`);
  ws.cpId = cpId;

  // 初始化数据存储
  if (!meterDataStore[cpId]) meterDataStore[cpId] = [];

  ws.on("message", (msg) => {
    let data;
    try { data = JSON.parse(msg); } 
    catch (e) { console.log("Invalid JSON"); return; }

    if (!Array.isArray(data) || data.length < 2) return;

    const messageType = data[0];
    if (messageType !== 2) return; // 只处理 CALL

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

      case "StartTransaction":
        txCounter += 1;
        const transactionId = txCounter;
        sendCallResult(ws, messageId, { transactionId, idTagInfo: { status: "Accepted" } });
        break;

      case "StopTransaction":
        sendCallResult(ws, messageId, { idTagInfo: { status: "Accepted" } });
        break;

      case "MeterValues":
        // 从 payload 里获取功率值
        if (payload.meterValue && payload.meterValue.length > 0) {
          const sampled = payload.meterValue[0].sampledValue[0];
          const value = parseFloat(sampled.value);
          const timestamp = payload.meterValue[0].timestamp;
          meterDataStore[cpId].push({ timestamp, power: value });

          // 同时返回最新的功率给前端显示对照
          sendCallResult(ws, messageId, { serverReceivedPower: value });
        } else {
          sendCallResult(ws, messageId, {});
        }
        break;

      default:
        sendCallResult(ws, messageId, { info: `Action ${action} not specifically handled` });
        break;
    }
  });

  ws.on("close", () => {
    console.log(`Connection closed: ${cpId}`);
  });
});
