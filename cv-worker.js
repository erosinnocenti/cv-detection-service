const { parentPort } = require('worker_threads')
const cv = require('opencv4nodejs');

currentFrame = null;

parentPort.on('message', (msg) => {
    if(msg.action == 'initialize') {
		stream = msg.stream;
		
		console.log('OpenCV Worker initialized for stream ' + stream);
        
        cap = new cv.VideoCapture(stream);
        cap.set(cv.CAP_PROP_FPS, 100);

        readFrame();
	} else if(msg.action == 'get-frame') {
        const buffer = currentFrame.getData();
		const image = {
			w: currentFrame.cols,
			h: currentFrame.rows,
			c: currentFrame.channels,
			b: buffer.buffer
        }

        const result = {
            status: 'done',
            frame: image
        }

        if(msg.withImage == true) {
            if(msg.maxSize !== undefined) {
                currentFrame = currentFrame.resizeToMax(msg.maxSize);
            }

            const encoded = cv.imencode('.jpg', currentFrame, [cv.IMWRITE_JPEG_QUALITY, msg.compression]).toString('base64');
            result.dataUrl = 'data:image/jpg;base64,' + encoded;
        }

        parentPort.postMessage(result);
    }
});

function readFrame() {
    if(currentFrame == null) {
        currentFrame = cap.read();
    }

    cap.readAsync((err, frame) => {
        currentFrame = frame;

        if(!currentFrame.empty) {
            setImmediate(readFrame);
        }
    });
}