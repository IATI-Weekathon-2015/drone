/**
 * Created by Adir on 23/03/2015.
 */
var fs = require('fs');

var coordsFromFile = fs.readFileSync('coordinates.txt').toString();
var structuredCoords = coordsFromFile.split("\n")
  .filter(function(row) { return row !== ''; })
  .map(function(row) {
    var splitedRow = row.split('  ');
    return {
      x: splitedRow[0],
      y: splitedRow[1],
      z: splitedRow[2]
    };
  });

var maxX = Math.max.apply(null, structuredCoords.map(function(coord) { return Number(coord.x); }));
var minX = Math.min.apply(null, structuredCoords.map(function(coord) { return Number(coord.x); }));
var maxY = Math.max.apply(null, structuredCoords.map(function(coord) { return Number(coord.y); }));
var minY = Math.min.apply(null, structuredCoords.map(function(coord) { return Number(coord.y); }));

module.exports = {
  coords: structuredCoords,
  maxX: maxX,
  minX: minX,
  maxY: maxY,
  minY: minY
};
