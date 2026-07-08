const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 8080;

// ===== 数据结构 =====
const clients = new Map();       // ws -> { id, name, hero, roomId, ready }
const rooms = new Map();         // roomId -> { host, players: [ws, ...] }

let idCounter = 0;

function wsSend(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data));
}

// ===== 我熛管理 =====
function createRoom(ws) {
  const client = clients.get(ws);
  if (!client) return;
  if (client.roomId) return wsSend(ws, { type: "error", message: "已在我熛中" });

  const roomId = "room_" + Date.now().toString(36);
  const room = { host: ws, players: [ws] };
  rooms.set(roomId, room);
  client.roomId = roomId;
  wsSend(ws, { type: "room_created", roomId, players: getRoomPlayers(room) });
  broadcastRooms();
}

function joinRoom(ws, roomId) {
  const client = clients.get(ws);
  if (!client) return;
  if (client.roomId) return wsSend(ws, { type: "error", message: "已在我的我中" });
  const room = rooms.get(roomId);
  if (!room) return wsSend(ws, { type: "error", message: "我间不导出" });
  if (room.players.length >= 2) return wsSend(ws, { type: "error", message: "我皇中改" });

  room.players.push(ws);
  client.roomId = roomId;
  // 這韸我的写最了拓
  for (const p of room.players) {
    wsSend(p, { type: "room_joined", roomId, players: getRoomPlayers(room) });
  }
  broadcastRooms();
}

function leaveRoom(ws) {
  const client = clients.get(ws);
  if (!client || !client.roomId) return;
  const roomId = client.roomId;
  const room = rooms.get(roomId);
  if (!room) { client.roomId = null; return; }

  room.players = room.players.filter(p => p !== ws);
  client.roomId = null;
  client.ready = false;

  if (room.players.length === 0) {
    rooms.delete(roomId);
  } else {
    if (room.host === ws) room.host = room.players[0];
    for (const p of room.players) {
      wsSend(p, { type: "room_update", players: getRoomPlayers(room) });
    }
  }
  broadcastRooms();
  wsSend(ws, { type: "left_room" });
}

function toggleReady(ws) {
  const client = clients.get(ws);
  if (!client || !client.roomId) return;
  client.ready = !client.ready;
  const room = rooms.get(client.roomId);
  if (!room) return;
  for (const p of room.players) {
    wsSend(p, { type: "room_update", players: getRoomPlayers(room) });
  }
}

function startGame(ws) {
  const client = clients.get(ws);
  if (!client || !client.roomId) return;
  const room = rooms.get(client.roomId);
  if (!room) return;
  if (room.host !== ws) return wsSend(ws, { type: "error", message: "只有股主发弃始錄" });
  if (room.players.length < 2) return wsSend(ws, { type: "error", message: "需覆2名现宋" });
  const allReady = room.players.every(p => clients.get(p)?.ready);
  if (room.players.length === 2 && !allReady) return wsSend(ws, { type: "error", message: "等待对或净备" });

  const p1 = clients.get(room.players[0]);
  const p2 = clients.get(room.players[1]);
  // 随机倛出免蛋完確（0 = 户台等名个环壳，1 = 第二个）
  const firstPlayerIdx = Math.random() < 0.5 ? 0 : 1;
  const firstPlayerWs = room.players[firstPlayerIdx];
  // 在我業上记单当型归属
  room.currentTurn = firstPlayerWs;
  room.turnCount = 1;
  for (const p of room.players) {
    const isMyTurn = p === firstPlayerWs;
    wsSend(p, {
      type: "game_start",
      firstTurn: isMyTurn,
      turnCount: 1,
      players: [
        { id: room.players[0] === p ? "me" : "opponent", name: p1?.name, hero: p1?.hero },
        { id: room.players[1] === p ? "me" : "opponent", name: p2?.name, hero: p2?.hero },
      ]
    });
  }
}

function getRoomPlayers(room) {
  return room.players.map(p => {
    const c = clients.get(p);
    return { id: c?.id, name: c?.name || "??", hero: c?.hero, ready: !!c?.ready, isHost: room.host === p };
  });
}

function broadcastRooms() {
  const list = [];
  for (const [id, room] of rooms) {
    list.push({ roomId: id, playerCount: room.players.length, hostName: clients.get(room.host)?.name || "??" });
  }
  for (const ws of clients.keys()) {
    wsSend(ws, { type: "room_list", rooms: list });
  }
}

function broadcastLobby(ws) {
  // 发送大家点提交
  const lobbyPlayers = [];
  for (const [cws, c] of clients) {
    if (!c.roomId) lobbyPlayers.push({ id: c.id, name: c.name, hero: c.hero });
  }
  wsSend(ws, { type: "lobby_players", players: lobbyPlayers });
}

function broadcastLobbyAll() {
  const lobbyPlayers = [];
  for (const [cws, c] of clients) {
    if (!c.roomId) lobbyPlayers.push({ id: c.id, name: c.name, hero: c.hero });
  }
  const msg = { type: "lobby_players", players: lobbyPlayers };
  for (const ws of clients.keys()) {
    wsSend(ws, msg);
  }
}

// ===== WebSocket 服务器 =====
const wss = new WebSocketServer({ port: PORT });

wss.on("listening", () => {
  console.log(`WebSocket 服务器已启加、ws://localhost:${PORT}`);
});

wss.on("connection", (ws, req) => {
  idCounter++;
  const clientIP = req.socket.remoteAddress;
  clients.set(ws, { id: idCounter, name: `现家${idCounter}`, hero: "INTJ", roomId: null, ready: false });

  console.log(`[+] ${clientIP} 连接 (ID: ${idCounter})`);

  wsSend(ws, { type: "welcome", id: idCounter, message: "已连接到游戏服务器 });
  broadcastLobbyAll();
  broadcastRooms();

  ws.on("message", (raw) => {
    const client = clients.get(ws);
    if (!client) return;

    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case "join":
        client.name = msg.name || client.name;
        client.hero = msg.hero || client.hero;
        wsSend(ws, { type: "joined", name: client.name, hero: client.hero });
        broadcastLobbyAll();
        break;
      case "chat":
        if (client.roomId) {
          const room = rooms.get(client.roomId);
          if (room) for (const p of room.players) wsSend(p, { type: "chat", name: client.name, text: msg.text.substring(0,200) });
        } else {
          for (const [cws, c] of clients) {
            if (!c.roomId) wsSend(cws, { type: "chat", name: client.name, text: msg.text.substring(0,200) });
          }
        }
        break;
      case "create_room":  createRoom(ws); break;
      case "join_room":    joinRoom(ws, msg.roomId); break;
      case "leave_room":   leaveRoom(ws); break;
      case "ready":       toggleReady(ws); break;
      case "start_game":   startGame(ws); break;
      case "game_action":
        if (client.roomId) {
          const room = rooms.get(client.roomId);
          if (room) {
            if (msg.action === "end_turn") {
              // 切换回合归属，广播 turn_update
              const otherPlayer = room.players.find(p => p !== ws);
              if (otherPlayer && room.currentTurn) {
                room.currentTurn = otherPlayer;
                room.turnCount = (room.turnCount || 0) + 1;
                for (const p of room.players) {
                  const isMyTurnNow = p === otherPlayer;
                  wsSend(p, { type: "turn_update", isMyTurn: isMyTurnNow, turnCount: room.turnCount });
                }
              }
            } else {
              // 其他加载直接转发
              for (const p of room.players) {
                if (p !== ws) wsSend(p, { type: "game_action", action: msg.action, data: msg.data, from: client.name });
              }
            }
          }
        }
        break;
      case "game_over":
        if (client.roomId) {
          const room = rooms.get(client.roomId);
          if (room) {
            for (const p of room.players) {
              if (p !== ws) wsSend(p, { type: "game_over", winner: msg.winner, reason: msg.reason });
            }
            for (const p of room.players) { const c = clients.get(p); if (c) { c.roomId = null; c.pvpReady = false; } }
            rooms.delete(client.roomId);
            broadcastRooms();
          }
        }
        break;
    }
  });

  ws.on("close", () => {
    const client = clients.get(ws);
    console.log(`[-] ${client?.name || "??"} 敺开(`));
    if (client?.roomId) leaveRoom(ws);
    clients.delete(ws);
    broadcastLobbyAll();
    broadcastRooms();
  });

  ws.on("error", () => {});
});

console.log("正在启加 WebSocket 清戏服务器...");
