import { env } from './environment/environment';
const WebSocket = require('ws');

function noop() {}

const wss = new WebSocket.Server({ port: env.wsPort });
console.log('WebSocket server started');

wss.on('connection', (ws, req) => {
	ws.alive = true;

	console.log('New client connected (' + req.connection.remoteAddress + ')');

	ws.on('message', function incoming(message) {});

	ws.on('close', () => {
		console.log('Client disconnected');
	});
});

setInterval(function ping() {
	wss.clients.forEach(function each(ws) {
		if (ws.alive === false) return ws.terminate();
		ws.alive = false;
		ws.ping(noop);
	});
}, env.pingInterval);
