import { env } from './environment/environment';
const WebSocket = require('ws');
const cv = require('opencv4nodejs');
const uuidv1 = require('uuid/v1');
const { Worker } = require('worker_threads');

const clientStates = new Map();

let inputFile = './data/venezia.mp4';
// const inputFile = 'rtsp://admin:password@192.168.91.227:554/ch01.264?ptype=udp';
// const inputFile = './data/person_001.jpg';

let cap = null;
let currentFrame = null;
let workingFrame = null;

const worker = new Worker('./dnn-worker.js');

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
	inputFile = payload.input;

	cap = new cv.VideoCapture(inputFile);
	
	const detectionMessage = {
		type: 'DETECTION',
		payload: {}
	};

	const clientState = clientStates.get(ws);
	clientState.frameCount = 0;
	clientState.frameTime = 0;
	clientState.fps = 0;
	clientState.lastFrameTime = null;

	// Thread separato per YOLO
	worker.removeAllListeners('message');
	worker.on('message', (msg) => {
		if(msg.status = 'done') {
			// Invio immagine
			if (payload.sendImages == true) {
				// Frame ridimensionato e compresso
				workingFrame.resize(workingFrame.rows / 2, workingFrame.cols / 2);

				const b64 = cv.imencode('.jpg', workingFrame, [cv.IMWRITE_JPEG_QUALITY, payload.compression]).toString('base64');
				msg.result.payload.image = 'data:image/jpg;base64,' + b64;
			}

			// Aggiunta dimensione canvas
			msg.result.payload.size = {
				h: workingFrame.rows,
				w: workingFrame.cols
			}

			ws.send(JSON.stringify(msg.result));

			// Elabora il prossimo frame
			sendFrameToWorker(worker);
		}
	});
	
	frameLoop(ws, detectionMessage, payload);
	
	// Inizializza il thread
	worker.postMessage({ action: 'initialize', clientState: clientState, detectionMessage: detectionMessage });

	// Elabora il primo frame
	sendFrameToWorker(worker);
}

function sendFrameToWorker(worker) {
	const tempFile = '/tmp/frame.jpg';

	if(currentFrame != null && !currentFrame.empty) {
		workingFrame = currentFrame.copy();
		cv.imwrite(tempFile, workingFrame);
		worker.postMessage({ action: 'detect', file: tempFile });
	} else {
		worker.postMessage({ action: 'shutdown' });
	}
}

function frameLoop(ws, detectionMessage, payload) {
	const clientState = clientStates.get(ws);

	if (clientState === undefined) {
		console.log('Client disconnected');
		cap.release();
		return;
	}

	// Estrazione frame con OpenCV
	currentFrame = cap.read();

	if (clientState.state == 'STREAMING') {
		setImmediate(() => {
			frameLoop(ws, detectionMessage, payload);
		});
	} else {
		clientState.state = 'IDLE';
		currentFrame = null;
		console.log('Streaming stopped');

		cap.release();
	}
}
