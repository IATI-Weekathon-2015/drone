var autonomy = require('ardrone-autonomy');
var replayCoords = require('../../replay-coords');

function tracker(name, deps) {
  var controller = autonomy.control(deps.client);

  // 1400x / 3m = 466x/m
  // 900y / 1.5m = 600y/m
  var DESIRED_DISTANCE = 1000;
  var HORIZONTAL_FACTOR = 700;

  var commands = replayCoords.coords.map(function(coord) {
    return function() {
      controller.go({
        y: -(coord.x / 1300), // horizontal
        z: -(coord.y / 600), // vertical
        x: (coord.z - 3000) / 1000 // distance
      });
    }
  });

  var isFirst = true;
  var isSecond = true;

  function replay() {
    if (isFirst) {
      deps.client.takeoff();
      isFirst = false;

      return setTimeout(replay, 5000);
    } else if (isSecond) {
      controller.altitude(2);
      setTimeout(function() {
        controller.zero();
      }, 1000);
      isSecond = false;

      return setTimeout(replay, 2500);
    }
    //console.log('replay');
    for (var i = 0; i < 7; i++) {
      commands.shift();
    }
    var nextCommand = commands.shift();

    if (typeof nextCommand === 'function') {
      nextCommand();
      setTimeout(replay, 300);
    } else {
      deps.client.land();
    }
  }

  //setTimeout(replay, 5000);

  deps.io.sockets.on('connection', function(socket) {
    socket.on('/tracker/update', function(data) {
      //console.log('received tracker/update:', data);
      updateDronePosition(data);
    });
  });

  var latestData = {};

  function updateDronePosition(data) {
    if (data.x === latestData.x &&
      data.y === latestData.y &&
      data.z === latestData.z
    ) {
      return;
    }

    latestData = data;

    //console.log('updating drone position:', data);
    if (!data) return;

    if (isFirst) {
      //controller.zero();
      isFirst = false;
    }

    // calculate angle fix
    var root = Math.sqrt(Math.pow(data.x, 2) + Math.pow(data.z, 2));
    var sinAngle = data.x / root;

    var state = controller.state();

    var newY = data.x / HORIZONTAL_FACTOR; // horizontal
    var newX = (data.z - DESIRED_DISTANCE) / 1000; // distance
    var newYaw = state.yaw.toDeg() + Math.asin(sinAngle).toDeg(); // angle

    // Remap our target position in the world coordinates
    var gx = state.x + Math.cos(state.yaw) * newX;
    var gy = state.y + Math.sin(state.yaw) * newX;

    //console.log('newY:', newY);
    //console.log('newX:', newX);
    //console.log('newYaw:', newYaw);

    controller.go({
      y: gy,
      z: state.z, // vertical
      x: gx,
      yaw: newYaw
    });
  }
}

module.exports = tracker;
