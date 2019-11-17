import { env } from './environment/environment';
const WebSocket = require('ws');
const uuidv1 = require('uuid/v1');
const { Worker } = require('worker_threads');

const clientStates = new Map();

const worker = new Worker('./dnn-worker.js');

const wss = new WebSocket.Server({ 
	port: env.wsPort
});
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
	};
	console.log(
		'New client connected (' +
			clientState.ip +
			') UUID: ' +
			clientState.uuid
	);

	clientStates.set(ws, clientState);

	// Assegnazione UUID al client
	const uuidAssignMessage = {
		type: 'UUID_ASSIGN',
		payload: {
			uuid: uuid
		}
	};
	ws.send(JSON.stringify(uuidAssignMessage));

	ws.on('message', message => {
		console.log('Message received: ' + message);

		const messageObj = JSON.parse(message);

		switch (messageObj.type) {
			case 'START_STREAMING':
				console.log('Streaming started');
				console.log('Config = ' + JSON.stringify(messageObj.payload));
				clientStates.get(ws).state = 'STREAMING';

				startStreaming(ws, messageObj.payload);
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

function startStreaming(ws, payload) {
	const detectionMessage = {
		type: 'DETECTION',
		payload: {}
	};

	worker.removeAllListeners();
	worker.on('message', (msg) => {
		const clientState = clientStates.get(ws);

		if (clientState === undefined) {
			console.log('Client disconnected');
			return;
		}

		if (clientState.state == 'STREAMING') {
			setImmediate(() => {
				worker.postMessage({ action: 'get-detection' });
			});
		} else if (clientState.state == 'STOP') {
			worker.postMessage({ action: 'shutdown' });
		} else {
			clientState.state = 'IDLE';
			currentFrame = null;
			console.log('Streaming stopped');
		}

		ws.send(JSON.stringify(msg));
	});

	const clientState = clientStates.get(ws);
	
	// Esegue il thread
	worker.postMessage({ 
		action: 'run', 
		clientState: clientState, 
		detectionMessage: detectionMessage, 
		inputFile: payload.input,
		sendImages: payload.sendImages,
		compression: payload.compression
	});
}
