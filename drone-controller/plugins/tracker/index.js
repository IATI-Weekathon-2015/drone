var autonomy = require('ardrone-autonomy');
var replayCoords = require('../../replay-coords');

function tracker(name, deps) {
  var controller = autonomy.control(deps.client);

  //7000x / 3000sm = 25x/sm
  //3000y / 1500sm = 2y/sm

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
    console.log('replay');
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

  setTimeout(replay, 5000);

  var INTERVAL = 300;

  var isActive = false;
  var intervalHandler;

  var verticalFix, horizontalFix;

  deps.io.sockets.on('connection', function(socket) {

    socket.on('/tracker/vertical-fix', function(cmd) {
      if (!isActive) startTracking();
      verticalFix = cmd.data;
    });

    socket.on('/tracker/horizontal-fix', function(cmd) {
      if (!isActive) startTracking();
      horizontalFix = cmd.data;
    });

    socket.on('/tracker/lost', function() {
      horizontalFix = verticalFix = 0;
      stopTracking();
    });
  });

  function updatePosition() {
    if (!updateHorizontalPosition() && !updateVerticalPosition()) {
      stopTracking();
    }
  }

  function updateVerticalPosition() {
    if (verticalFix > 40) {
      //deps.client.up(0.05);
      controller.up(Math.abs(verticalFix / 1000));
      return true;
    } else if (verticalFix < -40) {
      //deps.client.down(0.05);
      controller.down(Math.abs(verticalFix / 1000));
      return true;
    }

    return false;
  }

  function updateHorizontalPosition() {
    if (horizontalFix > 50) {
      //deps.client.left(0.05);
      controller.left(Math.abs(horizontalFix / 600));
      return true;
    } else if (horizontalFix < -50) {
      //deps.client.right(0.05);
      controller.right(Math.abs(horizontalFix / 600));
      return true;
    }

    return false;
  }

  function stopTracking() {
    console.log('stop');
    deps.client.stop();
    //clearInterval(intervalHandler);
    //isActive = false;
  }

  function startTracking() {
    intervalHandler = setInterval(updatePosition, INTERVAL);
    isActive = true;
  }
}

module.exports = tracker;
