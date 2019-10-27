const fs = require('fs');
const cv = require('opencv4nodejs');
const { Darknet } = require('darknet'); 

// Init
let darknet = new Darknet({
    weights: './config/yolov3-tiny.weights',
    config: './config/yolov3-tiny.cfg',
    names: [ 'person' ]
});

const cap = new cv.VideoCapture('./data/leeds.mp4');
 
let frame;
let index = 0;
do {
  frame = cap.read().cvtColor(cv.COLOR_BGR2RGB);
  console.log(darknet.detect(frame));
} while(!frame.empty);
 
