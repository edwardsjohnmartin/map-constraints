attribute vec4 vPosition;
attribute vec4 vColor;
varying vec4 fColor;
    
uniform mat4 mvMatrix;
uniform mat4 pMatrix;
    
void main() {
  gl_Position = pMatrix*mvMatrix*vPosition;
  fColor = vColor;
} 
