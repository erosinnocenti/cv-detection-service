import { env } from './environment/environment';
const WebSocket = require('ws');
const fs = require('fs');
const cv = require('opencv4nodejs');
const { Darknet } = require('darknet');
const uuidv1 = require('uuid/v1');

const clientStates = new Map();

var darknet = null;
var cap = null;

const wss = new WebSocket.Server({ port: env.wsPort });
console.log('WebSocket server started');

wss.on('connection', (ws, req) => {
	// Generazione nuovo UUID
	const uuid = uuidv1();
	// Impostazione stato client
	const clientState = {
		ip: req.connection.remoteAddress,
		state: 'IDLE',
		uuid: uuid,
		lastFrameTime: null,
		frameTime: 0,
		frameCount: 0,
		fps: 0
	}
	console.log('New client connected (' + clientState.ip + ') UUID: ' + clientState.uuid);
	
	clientStates.set(ws, clientState);

	// Assegnazione UUID al client
	const uuidAssignMessage = {
		type: 'UUID_ASSIGN',
		payload: {
			'uuid': uuid
		}
	};
	ws.send(JSON.stringify(uuidAssignMessage));

	ws.on('message', (message) => {
		console.log('Message received: ' + message);

		const messageObj = JSON.parse(message);

		switch(messageObj.type) {
			case 'START_STREAMING':
				console.log('Streaming started');
				clientStates.get(ws).state = 'STREAMING';

				startStreaming(ws);
			break;
			case 'STOP_STREAMING':
				console.log('Stopping streaming');

				clientStates.get(ws).state = 'STOP';
			break;
		}
	});

	ws.on('close', () => {
		clientStates.delete(ws);
		
		console.log('Client disconnected');
	});
});

function startStreaming(ws) {
	// Init
	darknet = new Darknet({
		weights: './config/yolov3-tiny.weights',
		config: './config/yolov3-tiny.cfg',
		names: [ 'person' ]
	});

	cap = new cv.VideoCapture('./data/leeds.mp4');

	const detectionMessage = {
		type: 'DETECTION',
		payload: {}
	}

	const clientState = clientStates.get(ws);
	clientState.frameCount = 0;
	clientState.frameTime = 0;
	clientState.fps = 0;
	clientState.lastFrameTime = null;
	
	sendFrame(ws, detectionMessage);
}

function sendFrame(ws, detectionMessage) {
	const clientState = clientStates.get(ws);
	
	// Aggiornamento tempo ultimo frame e calcolo FPS
	if(clientState.lastFrameTime != null) {
		const delta = (Date.now() - clientState.lastFrameTime)/1000;
		clientState.frameCount = clientState.frameCount + 1;
		clientState.frameTime = clientState.frameTime + delta;

		if(clientState.frameCount % 30 == 0) {
			let fps = 0;
			if(clientState.frameTime > 0 && clientState.frameCount > 0) {
				fps = 1 / (clientState.frameTime / clientState.frameCount)
			}

			clientState.frameCount = 0;
			clientState.frameTime = 0;
			clientState.fps = fps;
	
			console.log('Client ' + clientState.uuid + ' (' + clientState.ip + ') is running at ' + fps.toFixed(2) + " fps");
		}	
	}
	
	clientState.lastFrameTime = Date.now();

	// Estrazione frame con OpenCV
	let frame = cap.read().cvtColor(cv.COLOR_BGR2RGB);
	
	// Detect con Yolo
	detectionMessage.payload = {
		fps: clientState.fps,
		size: {
			h: frame.rows,
			w: frame.cols
		},
		detections: darknet.detect(frame)
	};

	// Creazione e invio messaggio a client
	const message = JSON.stringify(detectionMessage);
	ws.send(message);

	if(clientState.state == 'STREAMING') {
		setImmediate(() => {
			sendFrame(ws, detectionMessage);
		});
	} else {
		clientState.state = 'IDLE';
		console.log('Streaming stopped');

		cap.release();

	}
}