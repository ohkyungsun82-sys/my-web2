const http = require('http');
const fs = require('fs');
const path = require('path');

let rooms = {};
let users = [];

const maps = [
    [
        [1,1,1,1,1,1,1,1],
        [1,3,0,0,0,0,2,1],
        [1,1,1,1,1,1,1,1]
    ],
    [
        [1,1,1,1,1,1,1,1],
        [1,3,0,0,1,0,2,1],
        [1,1,1,0,0,0,1,1],
        [1,1,1,1,1,1,1,1]
    ],
    [
        [1,1,1,1,1,1,1,1],
        [1,3,0,0,1,0,0,1],
        [1,0,1,0,0,0,1,1],
        [1,0,0,0,1,0,2,1],
        [1,1,1,1,1,1,1,1]
    ]
];

function setupStage(room) {
    const currentMap = maps[room.stage];
    room.mapData = currentMap;
    for (let y = 0; y < currentMap.length; y++) {
        for (let x = 0; x < currentMap[y].length; x++) {
            if (currentMap[y][x] === 3) {
                room.pos = { x, y };
            }
        }
    }
    room.gameState = 'playing';
}

const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
        let data = {};
        try { if (body) data = JSON.parse(body); } catch(e) {}

        res.setHeader('Content-Type', 'application/json');

        if (req.method === 'GET' && req.url === '/') {
            res.setHeader('Content-Type', 'text/html');
            res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
            return;
        }

        if (req.method === 'POST' && req.url === '/api') {
            const { type, username, password, nickname, roomId, maxPlayers, key } = data;

            if (type === 'register') {
                if (users.find(u => u.username === username)) {
                    res.end(JSON.stringify({ type: 'error', message: '이미 존재하는 아이디입니다.' }));
                } else {
                    users.push({ username, password, nickname });
                    res.end(JSON.stringify({ type: 'success', message: '회원가입 성공!' }));
                }
            } else if (type === 'login') {
                const user = users.find(u => u.username === username && u.password === password);
                if (user) {
                    res.end(JSON.stringify({ type: 'loginSuccess', user }));
                } else {
                    res.end(JSON.stringify({ type: 'error', message: '로그인 실패' }));
                }
            } else if (type === 'createRoom') {
                const newId = Math.random().toString(36).substring(2, 7);
                rooms[newId] = {
                    roomId: newId,
                    password: password || '없음',
                    maxPlayers: parseInt(maxPlayers),
                    stage: 0,
                    gameState: 'waiting',
                    players: [{ username, nickname, keys: [] }],
                    assignedKeys: [],
                    pos: { x: 0, y: 0 },
                    mapData: []
                };
                res.end(JSON.stringify({ type: 'roomCreated', roomId: newId }));
            } else if (type === 'joinRoom') {
                const room = rooms[roomId];
                if (!room) {
                    res.end(JSON.stringify({ type: 'error', message: '방이 없습니다.' }));
                } else if (room.password !== '없음' && room.password !== password) {
                    res.end(JSON.stringify({ type: 'error', message: '비밀번호가 틀립니다.' }));
                } else if (room.players.length >= room.maxPlayers) {
                    res.end(JSON.stringify({ type: 'error', message: '방이 꽉 찼습니다.' }));
                } else if (room.players.some(p => p.username === username)) {
                    res.end(JSON.stringify({ type: 'roomJoined', room }));
                } else {
                    room.players.push({ username, nickname, keys: [] });
                    res.end(JSON.stringify({ type: 'roomJoined', room }));
                }
            } else if (type === 'leaveRoom') {
                const room = rooms[roomId];
                if (room) {
                    room.players = room.players.filter(p => p.username !== username);
                    if (room.players.length === 0) {
                        delete rooms[roomId];
                    } else {
                        room.assignedKeys = [];
                        room.players.forEach(p => p.keys = []);
                        room.gameState = 'waiting';
                    }
                }
                res.end(JSON.stringify({ type: 'success' }));
            } else if (type === 'selectKey') {
                const room = rooms[roomId];
                if (room) {
                    const player = room.players.find(p => p.username === username);
                    const limit = 4 / room.maxPlayers;
                    if (player && !room.assignedKeys.includes(key) && player.keys.length < limit) {
                        player.keys.push(key);
                        room.assignedKeys.push(key);
                        if (room.assignedKeys.length === 4) {
                            setupStage(room);
                        }
                        res.end(JSON.stringify({ type: 'success' }));
                    } else {
                        res.end(JSON.stringify({ type: 'error' }));
                    }
                }
            } else if (type === 'move') {
                const room = rooms[roomId];
                if (room && room.gameState === 'playing') {
                    const player = room.players.find(p => p.username === username);
                    if (player && player.keys.includes(key)) {
                        let dx = 0, dy = 0;
                        if (key === 'W') dy = -1;
                        if (key === 'S') dy = 1;
                        if (key === 'A') dx = -1;
                        if (key === 'D') dx = 1;

                        while (true) {
                            let nx = room.pos.x + dx;
                            let ny = room.pos.y + dy;
                            if (room.mapData[ny][nx] === 1) break;
                            room.pos.x = nx;
                            room.pos.y = ny;
                            if (room.mapData[ny][nx] === 2) {
                                room.gameState = 'clear';
                                setTimeout(() => {
                                    room.stage++;
                                    if (room.stage >= maps.length) {
                                        room.gameState = 'allClear';
                                    } else {
                                        setupStage(room);
                                    }
                                }, 2000);
                                break;
                            }
                        }
                    }
                }
                res.end(JSON.stringify({ type: 'success' }));
            } else if (type === 'poll') {
                const room = rooms[roomId];
                if (room) {
                    res.end(JSON.stringify({ type: 'pollData', room }));
                } else {
                    res.end(JSON.stringify({ type: 'error' }));
                }
            } else {
                res.end(JSON.stringify({ type: 'error' }));
            }
        }
    });
});

const port = process.env.PORT || 8080;
server.listen(port);