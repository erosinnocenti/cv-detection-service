const { parentPort } = require('worker_threads')
const { Darknet } = require('darknet');
const cv = require('opencv4nodejs');

darknet = new Darknet({
	weights: './config/yolov3-tiny.weights',
	config: './config/yolov3-tiny.cfg',
	names: ['person']
});

// Variabili per l'esecuzione
let cap = null;
let stopped = true;
let frame = null;
let firstFrame = false;

// Variabili input
let detectionMessage = null;
let clientState = null;
let inputFile = null;
let sendImages = null;
let compression = null;

parentPort.on('message', (msg) => {
	let frame = null;

	if(msg.action == 'initialize') {
		detectionMessage = msg.detectionMessage;
		clientState = msg.clientState;
		inputFile = msg.inputFile;
		sendImages = msg.sendImages;
		compression = msg.compression;
		
		console.log('DNN worker initialized for client ' + clientState.uuid);
		
		return;
	} else if(msg.action == 'shutdown') {
		console.log('Shutting down DNN worker for client ' + clientState.uuid);

	if(frame == null || frame.empty) {
		stopped = true;
		return;
	} else if(msg.action = 'detect') {
		frame = msg.frame;

		// Conversione da UInt8Array a Buffer
		frame.b = Buffer.from(frame.b);
	}

	// Aggiornamento tempo ultimo frame e calcolo FPS
	if (clientState.lastFrameTime != null) {
		const delta = (Date.now() - clientState.lastFrameTime) / 1000;
		clientState.frameCount = clientState.frameCount + 1;
		clientState.frameTime = clientState.frameTime + delta;

		if (clientState.frameCount % 30 == 0) {
			let fps = 0;
			if (clientState.frameTime > 0 && clientState.frameCount > 0) {
				fps = 1 / (clientState.frameTime / clientState.frameCount);
			}

			clientState.frameCount = 0;
			clientState.frameTime = 0;
			clientState.fps = fps;

			console.log(
				'Client ' +
					clientState.uuid +
					' (' +
					clientState.ip +
					') is running at ' +
					fps.toFixed(2) +
					' fps'
			);
		}
	}

	clientState.lastFrameTime = Date.now();

	// Detect con Yolo
	detectionMessage.payload = {
		fps: clientState.fps,
		detections: darknet.detect(frame)
	};

	if(firstFrame) {
		sendLastDetection();
		firstFrame = false;
	}
	
	// Prossimo frame
	if(!stopped) {
		setImmediate(detectOnFrame);
	}
}
