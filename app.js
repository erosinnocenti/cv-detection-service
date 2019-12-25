import { env } from './environment/environment';
import { start } from 'repl';
const WebSocket = require('ws');
const uuidv1 = require('uuid/v1');
const { Worker } = require('worker_threads');

const clientStates = new Map();

const dnnWorker = new Worker('./dnn-worker.js');
const cvWorker = new Worker('./cv-worker.js');

const wss = new WebSocket.Server({ 
	port: env.wsPort
});
console.log('WebSocket server started');

let lastResult = null;

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
		totalFrameCount: 0,
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
	const inputStream = payload.input;

	const detectionMessage = {
		type: 'DETECTION',
		payload: {}
	};

	const clientState = clientStates.get(ws);
	clientState.frameCount = 0;
	clientState.frameTime = 0;
	clientState.totalFrameCount = 0;
	clientState.fps = 0;
	clientState.lastFrameTime = null;

	// Thread separato per OpenCV
	cvWorker.removeAllListeners('message');
	cvWorker.on('message', (msg) => {
		if(msg.status == 'done') {
			const frame = msg.frame;

			lastResult = {
				size: {
					h: frame.h,
					w: frame.w
				},
				dataUrl: msg.dataUrl
			}

			if(frame != null && !frame.empty) {
				dnnWorker.postMessage({ action: 'detect', frame: frame });
			} else {
				dnnWorker.postMessage({ action: 'shutdown' });
			}
		}
	});

	// Thread separato per YOLO
	dnnWorker.removeAllListeners('message');
	dnnWorker.on('message', (msg) => {
		if(msg.status = 'done') {
			if (clientState.state == 'STREAMING') {
				msg.result.payload.image = lastResult.dataUrl;

				// Aggiunta dimensione canvas
				msg.result.payload.size = lastResult.size;

				ws.send(JSON.stringify(msg.result));

				cvWorker.postMessage({ action: 'get-frame', withImage: payload.sendImages, compression: payload.compression, maxSize: payload.maxSize });
			} else {
				clientState.state = 'IDLE';
				console.log('Streaming stopped');
		
				cvWorker.postMessage({ action: 'shutdown' });
			}
		}
	});
	
	// Inizializza il thread OpenCV
	cvWorker.postMessage( { action: 'initialize', stream: inputStream });
	
	// Inizializza il thread DNN
	dnnWorker.postMessage({ action: 'initialize', clientState: clientState, detectionMessage: detectionMessage, minProb: payload.minProb });

	// Richiede il primo frame
	cvWorker.postMessage({ action: 'get-frame', withImage: payload.sendImages, compression: payload.compression, maxSize: payload.maxSize });
}