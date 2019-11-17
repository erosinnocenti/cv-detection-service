const { parentPort } = require('worker_threads')
const { Darknet } = require('darknet');

darknet = new Darknet({
	weights: './config/yolov3.weights',
	config: './config/yolov3-eros.cfg',
	names: ['person']
});

// Variabili input
let detectionMessage = null;
let clientState = null;

parentPort.on('message', (msg) => {
	let frame = null;

	if(msg.action == 'initialize') {
		detectionMessage = msg.detectionMessage;
		clientState = msg.clientState;
		minProb = msg.minProb;

		console.log('DNN worker initialized for client ' + clientState.uuid);
		
		return;
	} else if(msg.action == 'shutdown') {
		console.log('Shutting down DNN worker for client ' + clientState.uuid);

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
	const dets = darknet.detect(frame);
	const filteredDets = [];

	for(let d of dets) {
		if(d.prob > minProb) {
			filteredDets.push(d);
		}
	}

	detectionMessage.payload = {
		fps: clientState.fps,
		detections: filteredDets
	};

	// Creazione e invio messaggio a client
	const message = detectionMessage;
	
	const result = {
		status: 'done',
		result: message
	}

	parentPort.postMessage(result);
});