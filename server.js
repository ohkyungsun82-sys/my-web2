const WebSocket = require('ws');
const port = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port });

let users = {};
let rooms = {};

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'register') {
            if (users[data.username]) {
                ws.send(JSON.stringify({ type: 'error', message: '이미 존재하는 계정입니다.' }));
            } else {
                users[data.username] = { password: data.password, nickname: data.nickname };
                ws.send(JSON.stringify({ type: 'success', message: '회원가입 완료! 로그인해주세요.' }));
            }
        }

        else if (data.type === 'login') {
            const user = users[data.username];
            if (!user || user.password !== data.password) {
                ws.send(JSON.stringify({ type: 'error', message: '아이디나 비밀번호가 틀렸습니다.' }));
            } else {
                ws.user = { username: data.username, nickname: user.nickname };
                ws.send(JSON.stringify({ type: 'loginSuccess', user: ws.user }));
            }
        }

        else if (data.type === 'createRoom') {
            if (!ws.user) return;
            const roomId = Math.random().toString(36).substring(2, 7);
            rooms[roomId] = {
                password: data.password,
                maxPlayers: parseInt(data.maxPlayers),
                players: [{ ws, username: ws.user.username, nickname: ws.user.nickname, key: null }],
                gameState: 'waiting',
                pos: { x: 1, y: 1 },
                assignedKeys: []
            };
            ws.roomId = roomId;
            ws.send(JSON.stringify({ type: 'roomCreated', roomId }));
        }

        else if (data.type === 'joinRoom') {
            if (!ws.user) return;
            const room = rooms[data.roomId];
            if (!room) return ws.send(JSON.stringify({ type: 'error', message: '방이 없습니다.' }));
            if (room.password !== data.password) return ws.send(JSON.stringify({ type: 'error', message: '비밀번호가 틀립니다.' }));
            if (room.players.length >= room.maxPlayers) return ws.send(JSON.stringify({ type: 'error', message: '방이 꽉 찼습니다.' }));
            if (room.players.some(p => p.username === ws.user.username)) {
                return ws.send(JSON.stringify({ type: 'error', message: '이미 입장해 있는 계정입니다.' }));
            }

            room.players.push({ ws, username: ws.user.username, nickname: ws.user.nickname, key: null });
            ws.roomId = data.roomId;
            ws.send(JSON.stringify({ type: 'roomJoined', roomId: data.roomId }));
            broadcastRoom(room);
        }

        else if (data.type === 'selectKey') {
            const room = rooms[ws.roomId];
            if (!room) return;
            const player = room.players.find(p => p.ws === ws);
            if (player && !room.assignedKeys.includes(data.key)) {
                player.key = data.key;
                room.assignedKeys.push(data.key);
                if (room.players.every(p => p.key !== null)) room.gameState = 'playing';
                broadcastRoom(room);
            }
        }

        else if (data.type === 'move') {
            const room = rooms[ws.roomId];
            if (!room || room.gameState !== 'playing') return;
            const player = room.players.find(p => p.ws === ws);
            if (player && player.key === data.key) {
                if (data.key === 'W') room.pos.y -= 1;
                if (data.key === 'S') room.pos.y += 1;
                if (data.key === 'A') room.pos.x -= 1;
                if (data.key === 'D') room.pos.x += 1;
                broadcastRoom(room);
            }
        }
    });

    ws.on('close', () => {
        if (ws.roomId && rooms[ws.roomId]) {
            rooms[ws.roomId].players = rooms[ws.roomId].players.filter(p => p.ws !== ws);
            if (rooms[ws.roomId].players.length === 0) delete rooms[ws.roomId];
            else broadcastRoom(rooms[ws.roomId]);
        }
    });
});

function broadcastRoom(room) {
    const data = JSON.stringify({ type: 'update', room });
    room.players.forEach(p => {
        if (p.ws.readyState === WebSocket.OPEN) p.ws.send(data);
    });
}