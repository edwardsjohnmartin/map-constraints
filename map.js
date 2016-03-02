"use strict";

var NORTH = "north";
var SOUTH = "south";
var EAST = "east";
var WEST = "west";
// <this> is <dir> of targetElement
var DirConstraint = function(dir) {
  this.dir = dir;
}

DirConstraint.prototype.getDesc = function() {
  return this.dir + " of";
}

DirConstraint.prototype.getOpposite = function() {
  switch (this.dir) {
  case NORTH:
    return new DirConstraint(SOUTH);
  case SOUTH:
    return new DirConstraint(NORTH);
  case EAST:
    return new DirConstraint(WEST);
  case WEST:
    return new DirConstraint(EAST);
  }
}

var CITY = "city";
var LAND = "land";
var RIVER = "river";
var Element = function(name, type, p) {
  this.name = name;
  this.type = type;
  this.p = p;
  this.constraints = [];
}

function addConstraint(srcName, targetName, constraint) {
  var src = 0, target = 0;
  for (var i = 0; i < elements.length; ++i) {
    if (elements[i].name == srcName) {
      src = elements[i];
    }
    if (elements[i].name == targetName) {
      target = elements[i];
    }
  }
  constraint.targetElement = target;
  src.constraints.push(constraint);
  var oconstraint = constraint.getOpposite();
  oconstraint.targetElement = src;
  target.constraints.push(oconstraint);
}

var elements = [];
elements.push(new Element("Zarahemla", CITY, vec3(0, 0, 0)));
elements.push(new Element("City of Nephi", CITY, vec3(0, -1, 0)));
elements.push(new Element("Ammonihah", CITY, vec3(-1, 1, 0)));
elements.push(new Element("Melek", CITY, vec3(-1, 0, 0)));

addConstraint("Zarahemla", "City of Nephi", new DirConstraint(NORTH));
addConstraint("Ammonihah", "Melek", new DirConstraint(NORTH));
addConstraint("Ammonihah", "Zarahemla", new DirConstraint(NORTH));

var selected = 0;

var frustumDim = 6;

var red = vec4(1, 0, 0, 1);
var green = vec4(0, 1, 0, 1);
var darkGreen = vec4(0, 0.7, 0.2, 1);
var blue = vec4(0, 0, 1, 1);
var cyan = vec4(0, 1, 1, 1);
var magenta = vec4(1, 0, 1, 1);
var darkMagenta = vec4(0.8, 0, 0.8, 1);
var yellow = vec4(1, 1, 0, 1);
var orange = vec4(0.8, 0.6, 0.0);
var burntOrange = vec4(0.81, 0.33, 0.0);
var gray = vec4(.5, .5, .5, 1);
var lightGray = vec4(0.8, 0.8, 0.8, 1);
var black = vec4(0, 0, 0, 1);
var white = vec4(1, 1, 1, 1);

var canvas;
var canvasWidth, canvasHeight;

// Frustum width and height
var fw, fh;
var gl;

var segment;
var circle;

var circleProgram;
var flatProgram;

var aspect = 1.0;

var mvMatrix, pMatrix, nMatrix;

// Interaction
var mouseDown = false;
var mouseDownPos;
var mousePos;
var button = 0;
var rotVec = vec3(1, 0, 0);
var rotAngle = 0;
var rotMatrix = mat4(1.0);
var zoom = 1;
var downZoom = 1;
var LEFT_BUTTON = 0;
var RIGHT_BUTTON = 2;

// What to render
var showCircles = true;

// Stack stuff
var matrixStack = new Array();
function pushMatrix() {
  matrixStack.push(mat4(mvMatrix));
}
function popMatrix() {
  mvMatrix = matrixStack.pop();
}

function renderConnection(p, q) {
  if (!flatProgram.initialized) return false;
  gl.useProgram(flatProgram.program);

  gl.enableVertexAttribArray(flatProgram.vertexLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, segment.vertexBuffer);
  gl.vertexAttribPointer(flatProgram.vertexLoc, 4, gl.FLOAT, false, 0, 0);

  gl.uniform4fv(flatProgram.colorLoc, flatten(red));

  pushMatrix();
  mvMatrix = mult(mvMatrix, translate(q));
  var v = subtract(p, q);
  var theta = degrees(Math.atan2(v[1], v[0]));
  mvMatrix = mult(mvMatrix, rotateZ(theta));
  mvMatrix = mult(mvMatrix, scalem(length(v), length(v), 1));

  gl.uniformMatrix4fv(flatProgram.mvMatrixLoc, false, flatten(mvMatrix));
  gl.uniformMatrix4fv(flatProgram.pMatrixLoc, false, flatten(pMatrix));

  popMatrix();

  gl.drawArrays(gl.LINES, 0, segment.numPoints);

  return true;
};

function renderCircle(selected) {
  if (!circleProgram.initialized) return;
  gl.useProgram(circleProgram.program);

  gl.enableVertexAttribArray(circleProgram.vertexLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, circle.vertexBuffer);
  gl.vertexAttribPointer(circleProgram.vertexLoc, 4, gl.FLOAT, false, 0, 0);

  nMatrix = normalMatrix(mvMatrix, false);

  gl.uniformMatrix4fv(circleProgram.mvMatrixLoc, false, flatten(mvMatrix));
  gl.uniformMatrix4fv(circleProgram.pMatrixLoc, false, flatten(pMatrix));
  gl.uniformMatrix4fv(circleProgram.nMatrixLoc, false, flatten(nMatrix));

  // Circle
  if (selected) {
    var color = vec4(1, 0, 0, 1);
    gl.uniform4fv(circleProgram.colorLoc, flatten(color));
  } else {
    gl.uniform4fv(circleProgram.colorLoc, flatten(vec4(1.0, 1.0, 1.0, 1.0)));
  }
  gl.drawArrays(gl.TRIANGLE_FAN, 0, circle.numCirclePoints);

  return true;
};

function renderCircles() {
  pushMatrix();
  var s = 1/10;
  var success = true;
  for (var i = 0; i < elements.length; i++) { 
    pushMatrix();
    mvMatrix = mult(mvMatrix, translate(elements[i].p));
    mvMatrix = mult(mvMatrix, scalem(s, s, s));
    success = success && renderCircle(i == selected);
    popMatrix();
  }
  popMatrix();

  return success;
}

function render() {
  resize(canvas);
  aspect = canvas.width/canvas.height;

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var at = vec3(0.0, 0.0, 0.0);
  var up = vec3(0.0, 1.0, 0.0);
  var eye = vec3(0, 0, 1);

  if (canvas.width > canvas.height) {
    fh = frustumDim;
    fw = (fh*canvas.width)/canvas.height;
  } else {
    fw = frustumDim;
    fh = (fw*canvas.height)/canvas.width;
  }
  fw *= zoom;
  fh *= zoom;
  pMatrix = ortho(0-fw/2, fw/2, 0-fh/2, fh/2, 0, 2);

  mvMatrix = lookAt(eye, at , up);  
  if (rotAngle != 0) {
    mvMatrix = mult(mvMatrix, rotate(rotAngle*180.0/Math.PI, rotVec));
  }
  mvMatrix = mult(mvMatrix, rotMatrix);

  gl.disable(gl.DEPTH_TEST);

  var success = true;

  var element = elements[selected];
  for (var i = 0; i < element.constraints.length; ++i) {
    renderConnection(element.p, element.constraints[i].targetElement.p);
  }
  // renderConnection(elements[0].p, elements[1].p);
  success = success && renderCircles();

  if (!success) {
    requestAnimFrame(render);
  }
}

function zoomIn() {
  zoom = zoom * 0.9;
  render();
}

function zoomOut() {
  zoom = zoom * 1.1;
  render();
}

function keyDown(e) {
  if (e.target != document.body) {
    if (e.target.type != "button") {
      return;
    }
    // switch(e.keyCode) {
    //   case " ".charCodeAt(0):
    //   return;
    // }
  }

  switch (e.keyCode) {
  case 37:
    // left arrow
    break;
  case 38:
    // up arrow
    break;
  case 39:
    // right arrow
    break;
  case 40:
    // down arrow
    break;
  case 189:
    // -
    zoomOut();
    break;
  case 187:
    // +
    zoomIn();
    break;
  case "C".charCodeAt(0):
    showCircles = !showCircles;
    render();
    break;
  // default:
  //   console.log("Unrecognized key press: " + e.keyCode);
  //   break;
  }

  // requestAnimFrame(render);
}

function select(p) {
  var curDist = 1000000;
  var cur = 0;
  p = vec3(p[0], p[1], 0);
  for (var i = 0; i < elements.length; ++i) {
    var d = dist(p, elements[i].p);
    if (d < curDist) {
      curDist = d;
      cur = i;
    }
  }
  selected = cur;

  updateProperties();
}

//------------------------------------------------------------
// Mouse handlers
//------------------------------------------------------------
function onMouseClick(e) {
  var p = win2obj(vec2(e.clientX, e.clientY));
  if (length(subtract(p, mouseDownPos)) < 0.01) {
    if (e.shiftKey) {
      // shift key down
    } else {
      select(p);
      // movePoint(p, 1);
    }
  }
}

function removeFocus() {
  document.activeElement.blur();
}

var zooming;
function onMouseDown(e) {
  mouseDown = true;
  mouseDownPos = win2obj(vec2(e.clientX, e.clientY));
  button = e.button;
  // if (button == RIGHT_BUTTON) {
  // zooming = false;
  // if (e.shiftKey) {
  //   zooming = true;
  //   downZoom = zoom;
  // }

  if (e.shiftKey) {
    // shift key down
  } else {
    select(mouseDownPos);
    movePoint(mouseDownPos, 1);
  }
}

function onMouseUp() {
  if (mouseDown) {
    mouseDown = false;
    if (!zooming) {
      rotMatrix = mult(rotate(rotAngle*180.0/Math.PI, rotVec), rotMatrix);
      rotAngle = 0;
    }
  }
}

function onMouseMove(e) {
  mousePos = win2obj(vec2(e.clientX, e.clientY));

  if (mouseDown && mouseDownPos != mousePos) {
    if (e.shiftKey) {
      // shift key is down
    } else {
      movePoint(mousePos, 1);
    }

    // arcball - will use when we start using elevation
    // if (!zooming) {
    //   var down_v = mapMouse(mouseDownPos);
    //   var v = mapMouse(mousePos);
    //   rotVec = normalize(cross(down_v, v));
    //   rotAngle = Math.acos(dot(down_v, v) / length(v));
    // } else {
    //   var factor = 2;
    //   zoom = downZoom * Math.pow(factor, mousePos[1] - mouseDownPos[1]);
    // }
    // render();
  }
}

function mapMouse(p) {
  var x = p[0];
  var y = p[1];
  if (x*x + y*y > 1) {
    var len = Math.sqrt(x*x + y*y);
    x = x/len;
    y = y/len;
  }
  var z = Math.sqrt(Math.max(0.0, 1 - x*x - y*y));
  return vec3(x, y, z);
}

function win2obj(p) {
  var x = fw * p[0] / canvasWidth;
  var y = fh * (canvasHeight-p[1]) / canvasHeight;
  x = x - fw/2;
  y = y - fh/2;
  return vec2(x, y);
}

function obj2win(p) {
  var x = (p[0]+fw/2) * canvasWidth / fw;
  var y = -((p[1]+fh/2) * canvasHeight / fh - canvasHeight);
  // var x = fw * p[0] / canvasWidth;
  // var y = fh * (canvasHeight-p[1]) / canvasHeight;
  // x = x - fw/2;
  // y = y - fh/2;
  return vec2(x, y);
}

function movePoint(p, i) {
  elements[selected].p = vec3(p[0], p[1], 0);
  render();
  updateLabels();
}

function addPoint(p) {
  render();
  updateLabels();
}

function resize(canvas) {
  // Lookup the size the browser is displaying the canvas.
  var displayWidth  = canvas.clientWidth;
  var displayHeight = canvas.clientHeight;
 
  // Check if the canvas is not the same size.
  if (canvas.width  != displayWidth ||
      canvas.height != displayHeight) {
 
    // Make the canvas the same size
    canvas.width  = displayWidth;
    canvas.height = displayHeight;
  }

  canvasWidth = canvas.width;
  canvasHeight = canvas.height;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

function updateProperties() {
  // Shouldn't repeat this code (is already in render)
  if (canvas.width > canvas.height) {
    fh = frustumDim;
    fw = (fh*canvas.width)/canvas.height;
  } else {
    fw = frustumDim;
    fh = (fw*canvas.height)/canvas.width;
  }
  fw *= zoom;
  fh *= zoom;

  var element = elements[selected];

  var table = document.createElement("table");

  // name
  {
    var row = table.insertRow(table.rows.length);
    var name = row.insertCell(0);
    name.tableSpan = 2;
    name.innerHTML = element.name;
  }

  // type
  {
    var row = table.insertRow(table.rows.length);
    var name = row.insertCell(0);
    name.tableSpan = 2;
    name.innerHTML = element.type;
  }

  // coordinates
  {
    var row = table.insertRow(table.rows.length);
    var label = row.insertCell(0);
    label.innerHTML = "(x,y):";
    var value = row.insertCell(1);
    // var btn = document.createElement("button");
    // var t = document.createTextNode("click");
    // btn.appendChild(t);
    var x = document.createElement("input");
    x.setAttribute("type", "text");
    x.value = element.p[0].toFixed(1);
    x.size = 6;
    x.readOnly = true;
    value.appendChild(x);
    value.appendChild(document.createTextNode(","));
    var y = document.createElement("input");
    y.setAttribute("type", "text");
    y.value = element.p[1].toFixed(1);
    y.size = 6;
    y.readOnly = true;
    value.appendChild(y);
  }

  // Constraints label
  {
    var row = table.insertRow(table.rows.length);
    var label = row.insertCell(0);
    label.innerHTML = "Constraints:";
  }
  
  // Constraints
  for (var i = 0; i < element.constraints.length; ++i) {
    var constraint = element.constraints[i];
    var row = table.insertRow(table.rows.length);
    var desc = row.insertCell(0);
    desc.align = "right";
    desc.innerHTML = constraint.getDesc() + "&nbsp;";
    var value = row.insertCell(1);
    value.innerHTML = constraint.targetElement.name;
  }
  
  // Add properties to properties element
  var properties = document.getElementById("properties");
  while (properties.hasChildNodes()) {
    properties.removeChild(properties.childNodes[0]);
  }

  properties.appendChild(table);
}

function updateLabels() {
  // Labels
  var labels = document.getElementById("labels");
  while (labels.hasChildNodes()) {
    labels.removeChild(labels.childNodes[0]);
  }

  for (var i = 0; i < elements.length; ++i) {
    var winp = obj2win(elements[i].p);
    var e = document.createElement("div");
    var t = document.createTextNode(elements[i].name);
    e.appendChild(t);
    e.className = "label";
    // e.style.left="300px";
    e.style.left=winp[0].toFixed(0) + "px";
    e.style.top=winp[1].toFixed(0) + "px";
    // console.log(winp[0].toFixed(0) + "px");
    // console.log(e.style.left);
    labels.appendChild(e);
    // document.body.appendChild(e);
    // document.getElementsByTagName("BODY")[0].appendChild(e);
  }
}

window.onload = function init() {
  canvas = document.getElementById("gl-canvas");

  document.onkeydown = keyDown;
  canvas.onclick = onMouseClick;
  canvas.onmousedown = onMouseDown;
  canvas.onmouseup = onMouseUp;
  canvas.onmousemove = onMouseMove;

  canvasWidth = canvas.width;
  canvasHeight = canvas.height;

  gl = WebGLUtils.setupWebGL(canvas);
  if (!gl) { alert("WebGL isn't available"); }

  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);

  gl.enable(gl.DEPTH_TEST);

  //  Load shaders and initialize attribute buffers
  circleProgram = new CircleProgram();
  flatProgram = new FlatProgram();

  segment = new Segment();
  circle = new Circle();

  updateProperties();

  render();
  updateLabels();
}
