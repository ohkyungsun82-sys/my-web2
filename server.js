const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });
let score = 0;

wss.on('connection', (ws) => {
    ws.send(score.toString());

    ws.on('message', () => {
        score++;
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(score.toString());
            }
        });
    });
});