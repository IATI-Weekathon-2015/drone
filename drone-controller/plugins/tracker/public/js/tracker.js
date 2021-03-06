(function(window, document) {
  'use strict';

  var Tracker = function Tracker(cockpit) {
    var tracker = this;
    //console.log('Loading Tracker plugin');
    this.cockpit = cockpit;

    this.frameWidth = 640;
    this.frameHeight = 360;

    this.newPyramid = new jsfeat.pyramid_t(3);
    this.oldPyramid = new jsfeat.pyramid_t(3);
    this.point_status = new Uint8Array(1);
    this.oldXY = new Float32Array(2);
    this.newXY = new Float32Array(2);
    this.oldRoundedX = 0;
    this.oldRoundedY = 0;

    this.canvas = document.querySelector('#dronestream canvas');
    if (!this.canvas) {
      console.error('Did not find required dronestream canvas');
      return;
    }
    //console.log('found canvas, width/height:', this.canvas.clientWidth, this.canvas.clientHeight);

    // add click-handler
    $('#cockpit').append('<div id="tracker"></div>');
    this.div = $('#tracker').get(0);
    this.div.addEventListener('click', function(event) {
      tracker.setTrackingCoords(event.offsetX, event.offsetY);
    });


    //BEN - setup for detection
    this.canvas2 = document.createElement('canvas');
    this.canvas2.width = 640;
    this.canvas2.height = 360;
    this.ctx2 = this.canvas2.getContext('2d');
    //$("body")[0].appendChild(this.canvas2);
    this.raster = new NyARRgbRaster_Canvas2D(this.canvas2);
    //console.log(this.raster);
    this.param = new FLARParam(640, 360); //320,240

    this.resultMat = new NyARTransMatResult();

    this.detector = new FLARMultiIdMarkerDetector(this.param, 120);
    this.detector.setContinueMode(true);

    this.enabled = false;
    this.observers = {};
    this.locked = false;

    $('#cockpit').append('<img id="tracker-crosshairs" src="/plugin/tracker/img/sniper.png">');
    this.crosshairs = $('#tracker-crosshairs').get(0);
    this.crosshairs.style.display = 'none';

    var latestUpdate;
    this.on('points', function(data) {
      //console.log("POINTS: ", data[0].x, data[0].y, data[0].z);
      latestUpdate = data[0];
    });

    function updatePilot() {
      if (latestUpdate) {
        //console.log('sending updates to the server:', latestUpdate);
        window.cockpit.socket.emit("/tracker/update", latestUpdate);
      }
      //console.log('nothing change');
      setTimeout(updatePilot, 200);
    }

    updatePilot();

    this.on('locked', function() {
      //console.log('target acquired');
    });

    this.on('lost', function() {
      //console.log('target lost');
      tracker.crosshairs.style.display = 'none';
      tracker.disable();

      window.cockpit.socket.emit("/tracker/lost", {
        action: 'lost'
      });
    });

    this.enable();
  };

  Tracker.prototype.prepareTrackingBuffer = function() {
    this.newPyramid.allocate(
      this.frameWidth,
      this.frameHeight,
      jsfeat.U8_t | jsfeat.C1_t
    );
    this.oldPyramid.allocate(
      this.frameWidth,
      this.frameHeight,
      jsfeat.U8_t | jsfeat.C1_t
    );
  };

  Tracker.prototype.update = function(frameBuffer) {
    var outThis = this;

    // only send the update when we can actually get a frame into the canvas
    window.requestAnimationFrame(function() {
      outThis.ctx2.drawImage(outThis.canvas, 0, 0, 640, 360);
      outThis.canvas2.changed = true;
      var detected = outThis.detector.detectMarkerLite(outThis.raster, 128);
      for (var idx = 0; idx < detected; idx++) {
        var id = outThis.detector.getIdMarkerData(idx);
        outThis.detector.getTransformMatrix(idx, outThis.resultMat);
        //console.log("resultMat", outThis.resultMat.m03, outThis.resultMat.m13, outThis.resultMat.m23);
        outThis.emit('points', [{
          x: Math.round(outThis.resultMat.m03),
          y: Math.round(outThis.resultMat.m13),
          z: Math.round(outThis.resultMat.m23)
        }]);
      }
      outThis.emit('done'); // request to bind to the next frame
    });
  };

  Tracker.prototype.setTrackingCoords = function(x, y) {
    this.locked = false;

    // translate from (stretched) canvas to framebuffer dimensions:
    this.newXY[0] = x * this.frameWidth / this.canvas.clientWidth;
    this.newXY[1] = y * this.frameHeight / this.canvas.clientHeight;
    //console.log('New tracking coords:', [x, y], this.newXY);
    this.enable();
  };

  Tracker.prototype.trackFlow = function(frameBuffer) {
    this.newPyramid.data[0].data.set(frameBuffer);

    jsfeat.imgproc.equalize_histogram(
      this.newPyramid.data[0].data,
      this.newPyramid.data[0].data
    );

    this.newPyramid.build(this.newPyramid.data[0], true);

    jsfeat.optical_flow_lk.track(
      this.oldPyramid, this.newPyramid,
      this.oldXY, this.newXY,
      1,
      50,                // win_size
      30,                // max_iterations
      this.point_status,
      0.01,              // epsilon,
      0.001              // min_eigen
    );
  };

  Tracker.prototype.enable = function() {
    var tracker = this;
    if (this.enabled) {
      return;
    }
    this.enabled = true;

    if (!this.cockpit.videostream) {
      console.error('The Tracker plugin depends on plugin video-stream');
      return;
    }
    this.prepareTrackingBuffer();

    this.hookNextFrame();
    this.on('done', this.hookNextFrame.bind(this));
  };

  Tracker.prototype.disable = function() {
    this.enabled = false;
  };

  Tracker.prototype.on = function(event, callback) {
    var i = 0, handler;
    if (!this.observers[event]) {
      this.observers[event] = [];
    }
    this.observers[event].push(callback);
  };

  Tracker.prototype.emit = function(event, data) {
    var i = 0, handler;
    if (this.observers[event]) {
      for (i = 0; handler = this.observers[event][i]; ++i) {
        handler(data);
      }
    }
  };

  Tracker.prototype.hookNextFrame = function() {
    this.cockpit.videostream.onNextFrame(this.update.bind(this));

  };

  window.Cockpit.plugins.push(Tracker);

}(window, document));
