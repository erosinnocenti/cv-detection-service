const { parentPort } = require('worker_threads')
const cv = require('opencv4nodejs');

currentFrame = null;
running = false;

const fps = 30;

parentPort.on('message', (msg) => {
    if(msg.action == 'initialize') {
		stream = msg.stream;
		
		console.log('OpenCV Worker initialized for stream ' + stream);
        
        cap = new cv.VideoCapture(stream);
        
        running = true;
        readFrame();

        parentPort.postMessage({ status: 'initialized' });
	} else if(msg.action == 'get-frame') {
        if(!currentFrame.empty) {
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
        } else {
            const result = {
                status: 'done',
                frame: {
                    empty: true
                }
            }

            parentPort.postMessage(result);
        }
    } else if(msg.action == 'shutdown') {
        console.log('Shutting down OpenCV Thread');
        
        running = false;

        cap.release();
        cap = null;
        currentFrame = null;
    }
});

function readFrame() {
    if(!running) {
        return;
    }
    
    if(currentFrame == null) {
        currentFrame = cap.read();
    }

    cap.readAsync((err, frame) => {
        currentFrame = frame;
    });

    if(currentFrame != null && !currentFrame.empty) {
        setTimeout(readFrame, 1000 / fps);
    }
}
