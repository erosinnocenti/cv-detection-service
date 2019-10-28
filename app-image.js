import { Darknet } from 'darknet';
 
// Init
let darknet = new Darknet({
    weights: './config/yolov3-tiny.weights',
    config: './config/yolov3-tiny.cfg',
    names: [ 'person' ]
});
 
// Detect
console.log(darknet.detect('./data/person.jpg'));
