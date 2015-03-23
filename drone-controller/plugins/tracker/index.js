function tracker(name, deps) {

  var INTERVAL = 300;

  var verticalFix, horizontalFix;

  deps.io.sockets.on('connection', function(socket) {

    socket.on('/tracker/vertical-fix', function(cmd) {
      verticalFix = cmd.data;
    });

    socket.on('/tracker/horizontal-fix', function(cmd) {
      horizontalFix = cmd.data;
    });

    socket.on('/tracker/stop', function() {
      stopTracking();
    });
  });

  function updatePosition() {
    updateHorizontalPosition();
    //updateVerticalPosition();
  }

  function updateVerticalPosition() {
    if (verticalFix > 20) {
      deps.client.up(0.05);
    } else if (verticalFix < -20) {
      deps.client.down(0.05);
    } else {
      deps.client.stop();
    }
  }

  function updateHorizontalPosition() {
    if (horizontalFix > 50) {
      deps.client.left(0.05);
    } else if (horizontalFix < -50) {
      deps.client.right(0.05);
    } else {
      deps.client.stop();
    }
  }

  function stopTracking() {
    console.log('stop');
    deps.client.stop();
  }

  setInterval(updatePosition, INTERVAL);
}

module.exports = tracker;
