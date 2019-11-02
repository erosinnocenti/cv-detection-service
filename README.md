# CV Detection Service

CV Detection Service relies on [YOLOv3](https://pjreddie.com/darknet/yolo) DNN to detect people in live video streams.
The server is written in JavaScript and it uses [OpenCV](https://opencv.org) to grab frames from a variety of video sources (eg. webcams, web streams, rtsp).

The detections are then returned in JSON format to the [CV Detection Client](https://github.com/erosinnocenti/cv-detection-client), through WebSockets.
