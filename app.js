import { env } from './environment/environment';
const WebSocket = require('ws');
const fs = require('fs');
const cv = require('opencv4nodejs');
const { Darknet } = require('darknet'); 

function noop() {}

const wss = new WebSocket.Server({ port: env.wsPort });
console.log('WebSocket server started');

wss.on('connection', (ws, req) => {
	ws.alive = true;

	console.log('New client connected (' + req.connection.remoteAddress + ')');
	
	console.log('Streaming started');

	// Init
	let darknet = new Darknet({
		weights: './config/yolov3-tiny.weights',
		config: './config/yolov3-tiny.cfg',
		names: [ 'person' ]
	});

	const cap = new cv.VideoCapture('./data/leeds.mp4');
	
	let frame;
	do {
		frame = cap.read().cvtColor(cv.COLOR_BGR2RGB);
		ws.send(darknet.detect(frame));
		console.log(darknet.detect(frame));
	} while(!frame.empty && ws.alive);
	
	ws.on('message', function incoming(message) {});

	ws.on('close', () => {
		ws.alive = false;
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
