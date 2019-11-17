const fs = require('fs');
const cv = require('opencv4nodejs');
const { Darknet } = require('darknet'); 

// Init
let darknet = new Darknet({
    weights: './config/yolov3-tiny.weights',
    config: './config/yolov3-tiny.cfg',
    names: [ 'person' ]
});

const cap = new cv.VideoCapture('./data/florida.mp4');
 
let frame;
let index = 0;

let lastFrameTime = null;
let frameCount = 0;
let frameTime = 0;

do {
  if (lastFrameTime != null) {
		const delta = (Date.now() - lastFrameTime) / 1000;
		frameCount = frameCount + 1;
		frameTime = frameTime + delta;

		if (frameCount % 30 == 0) {
			let fps = 0;
			if (frameTime > 0 && frameCount > 0) {
				fps = 1 / (frameTime / frameCount);
			}

			frameCount = 0;
			frameTime = 0;
			
			console.log(
				'Running at ' +	fps.toFixed(2) + ' fps'
			);
		}
  }
  
  lastFrameTime = Date.now();

  frame = cap.read();

  workingFrame = frame.copy();

  const buffer = workingFrame.getData();
  const image =  {
	w: workingFrame.cols,
	h: workingFrame.rows,
	c: workingFrame.channels,
	b: Buffer.from(buffer.buffer)
  }

  darknet.detect(image);

  // console.log(darknet.detect(frame));
} while(!frame.empty);

