const fs = require('fs');
const cv = require('opencv4nodejs');
const { Darknet } = require('darknet');

// Init
let darknet = new Darknet({
	weights: './config/yolov3.weights',
	config: './config/yolov3-320.cfg',
	names: ['person']
});

const cap = new cv.VideoCapture('./data/left.mp4');
const green = new cv.Vec3(0, 255, 0);
const blue = new cv.Vec3(255, 0, 0);
const red = new cv.Vec3(0, 0, 255);
const magenta = new cv.Vec3(255, 0, 255);

// Florida
// const lineP1 = new cv.Point(0, 90);
// const lineP2 = new cv.Point(703, 720);

// Zebra Crossing
// const lineP1 = new cv.Point(0, 387);
// const lineP2 = new cv.Point(589, 260);

// Multiple Directions
const lineP1 = new cv.Point(315, 480);
const lineP2 = new cv.Point(315, 0);
const minDistance = 0;

let grabEvery = 10;

let frame;
let frameCount = 0;
let grabbedFrameCount = 0;

function grabFrame() {
	lastFrameTime = Date.now();

	frame = cap.read();

	if(frame.empty) {
		return;
	}

	if(frameCount % grabEvery == 0) {
		grabbedFrameCount = grabbedFrameCount + 1;

		console.log('Elaborazione frame ' + frameCount);
		
		results = darknet.detect(frame);

		frame.drawLine(lineP1, lineP2, blue, 2);
		
		for(let person of results) {
			// Conversione punti ricevuti, Yolo usa come x, y il centro del box
        	// mentre risulta più comodo avere l'angolo superiore sx per il canvas html5
        	person.box.x = person.box.x - (person.box.w / 2);
			person.box.y = person.box.y - (person.box.h / 2);

			// Calcolo punto di riferimento (centrale alla linea inferiore del box)
			const middleLowerPoint = new cv.Point( 
				person.box.x + (person.box.w / 2),
				person.box.y + person.box.h
			);

			person.refPoint = middleLowerPoint;

			let prob = person.prob;

			// Calcolo punto piu vicino della linea di riferimento
			person.lineClosestPoint = closestPointToSegment(person.refPoint, lineP1, lineP2);

			// Calcolo la distanza dalla linea
			person.lineDistance = distance(person.refPoint, person.lineClosestPoint);

			if(person.refPoint.x - minDistance < person.lineClosestPoint.x) {
				person.alarm = true;
			} else {
				person.alarm = false;
			}
			
			frame.drawRectangle(
				new cv.Point(person.box.x, person.box.y), 
				new cv.Point(person.box.x + person.box.w, person.box.y + person.box.h), 
				(person.alarm == true ? red : green), 
				2);
			frame.drawCircle(middleLowerPoint, 2, red, 2);

			frame.putText(String(prob.toFixed(2)), new cv.Point(person.box.x, person.box.y - 5), cv.FONT_HERSHEY_COMPLEX, 0.4, magenta, 1, 1);
		}
		
		cv.imwrite('test/frame' + String(grabbedFrameCount).padStart(2, '0') + '.png', frame);
	}

	frameCount++;

	setTimeout(grabFrame);
}

function closestPointToSegment(p, a, b) {
	const a_to_p = new cv.Point(p.x - a.x, p.y - a.y);
	const a_to_b = new cv.Point(b.x - a.x, b.y - a.y);

	const atb2 = a_to_b.x * a_to_b.x + a_to_b.y * a_to_b.y;

	// Prodotto di a_to_p e a_to_b
	const atp_dot_atb = a_to_p.x * a_to_b.x + a_to_p.y * a_to_b.y;
	
	// Distanza normalizzata da A al punto piu vicino
	const t = atp_dot_atb / atb2;

	return new cv.Point(a.x + a_to_b.x * t, a.y + a_to_b.y * t);
}

function distance(p1, p2) {
	const a = p1.x - p2.x;
	const b = p1.y - p2.y;

	const result = Math.sqrt(a * a + b * b);

	return result;
}

grabFrame();
