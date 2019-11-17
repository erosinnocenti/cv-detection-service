const { parentPort } = require('worker_threads')
const cv = require('opencv4nodejs');

currentFrame = null;

parentPort.on('message', (msg) => {
    if(msg.action == 'initialize') {
		stream = msg.stream;
		
		console.log('OpenCV Worker initialized for stream ' + stream);
        
        cap = new cv.VideoCapture(stream);

        readFrame();

		return;
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
            result.dataUrl = 'data:image/jpg;base64,' + cv.imencode('.jpg', currentFrame, [cv.IMWRITE_JPEG_QUALITY, msg.compression]).toString('base64');
        }

        parentPort.postMessage(result);
    }
});

function readFrame() {
    currentFrame = cap.read();

    if(!currentFrame.empty) {
        setImmediate(readFrame);
    }
}