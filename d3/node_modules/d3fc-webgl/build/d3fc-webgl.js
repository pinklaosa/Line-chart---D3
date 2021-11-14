(function(g,f){typeof exports==='object'&&typeof module!=='undefined'?f(exports,require('d3-selection'),require('@d3fc/d3fc-chart'),require('@d3fc/d3fc-rebind'),require('d3-scale'),require('d3-color'),require('d3-shape'),require('d3-array'),require('@d3fc/d3fc-series')):typeof define==='function'&&define.amd?define(['exports','d3-selection','@d3fc/d3fc-chart','@d3fc/d3fc-rebind','d3-scale','d3-color','d3-shape','d3-array','@d3fc/d3fc-series'],f):(g=g||self,f(g.fcWebgl={},g.d3,g.fc,g.fc,g.d3,g.d3,g.d3,g.d3,g.fc));}(this,function(exports, d3Selection, d3fcChart, d3fcRebind, d3Scale, d3Color, d3Shape, d3Array, d3fcSeries){'use strict';var cartesian = (function (xScale, yScale) {
  var base = d3fcChart.chartCartesian(xScale, yScale);

  var chart = function chart(selection) {
    var result = base(selection);
    selection.select('d3fc-canvas.plot-area').on('draw', function (d, i, nodes) {
      var canvas = d3Selection.select(nodes[i]).select('canvas').node();
      var series = base.canvasPlotArea();
      series.context(canvas.getContext('webgl')).xScale(xScale).yScale(yScale);
      series(d);
    });
    return result;
  };

  d3fcRebind.rebindAll(chart, base);
  return chart;
});// Initialize a shader program, so WebGL knows how to draw our data
var initShaders = (function (gl, vsSource, fsSource) {
  var vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource); // Create the shader program

  var shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram); // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}); // creates a shader of the given type, uploads the source and compiles it.

function loadShader(gl, type, source) {
  var shader = gl.createShader(type); // Send the source to the shader object

  gl.shaderSource(shader, source); // Compile the shader program

  gl.compileShader(shader); // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}var buffer = (function (gl) {
  var glBuffer = gl.createBuffer();

  var buffer = function buffer(array) {
    // Select this buffer as the one to apply buffer operations to.
    gl.bindBuffer(gl.ARRAY_BUFFER, glBuffer); // Only create a copy if it's not already a Float32Array

    var srcArray = array.constructor === Float32Array ? array : new Float32Array(array);
    gl.bufferData(gl.ARRAY_BUFFER, srcArray, gl.STATIC_DRAW);
    return glBuffer;
  };

  buffer.addr = function () {
    return glBuffer;
  };

  return buffer;
});var baseShader = (function (gl, vsSource, fsSource) {
  var numComponents = 2;
  var positionBuffer = buffer(gl);
  var lastColor = [-1, -1, -1, -1];
  var shaderProgram = initShaders(gl, vsSource, fsSource);
  var vertexLocation = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
  var offsetLocation = gl.getUniformLocation(shaderProgram, 'uOffset');
  var scaleLocation = gl.getUniformLocation(shaderProgram, 'uScale');
  var seriesColorLocation = gl.getUniformLocation(shaderProgram, 'uSeriesColor');

  var draw = function draw(positions, color) {
    var mode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : gl.TRIANGLES;
    var offset = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
    var count = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : -1;
    var fColor = color || [0.0, 0.0, 0.0, 0.0];

    if (fColor.some(function (c, i) {
      return c !== lastColor[i];
    })) {
      setColor(fColor);
    }

    positionBuffer(positions);
    var vertexCount = count !== -1 ? count : positions.length / numComponents - offset;
    gl.drawArrays(mode, offset, vertexCount);
  };

  draw.activate = function () {
    setupProgram();
    lastColor = [-1, -1, -1, -1];
  };

  draw.setModelView = function (_ref) {
    var offset = _ref.offset,
        scale = _ref.scale;
    gl.uniform2fv(offsetLocation, offset);
    gl.uniform2fv(scaleLocation, scale);
  };

  draw.shaderProgram = function () {
    return shaderProgram;
  };

  draw.numComponents = function () {
    if (!arguments.length) {
      return numComponents;
    }

    numComponents = arguments.length <= 0 ? undefined : arguments[0];
    return draw;
  };

  function setupProgram() {
    // Tell WebGL to use our program when drawing
    gl.useProgram(shaderProgram); // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute.

    {
      var type = gl.FLOAT; // the data in the buffer is 32bit floats

      var normalize = false; // don't normalize

      var stride = 0; // how many bytes to get from one set of values to the next
      // 0 = use type and numComponents above

      var offset = 0; // how many bytes inside the buffer to start from

      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer.addr());
      gl.vertexAttribPointer(vertexLocation, numComponents, type, normalize, stride, offset);
      gl.enableVertexAttribArray(vertexLocation);
    }
  }

  function setColor(color) {
    gl.uniform4fv(seriesColorLocation, color);
  }

  return draw;
});// Vertex shader program

var vsSource = "\n  attribute vec4 aVertexPosition;\n\n  uniform vec2 uOffset;\n  uniform vec2 uScale;\n\n  void main() {\n    vec2 vertex = vec2(aVertexPosition[0], aVertexPosition[1]);\n    vec2 clipSpace = 2.0 * (vertex - uOffset) / uScale - 1.0;\n    gl_Position = vec4(clipSpace, 0.0, 1.0);\n  }\n";
var fsSource = "\n  precision mediump float;\n  uniform vec4 uSeriesColor;\n\n  void main() {\n    gl_FragColor = uSeriesColor;\n  }\n"; // Available modes:
// gl.TRIANGLES
// gl.TRIANGLE_STRIP
// gl.TRIANGLE_FAN
// gl.LINES
// gl.LINES_STRIP

var raw = (function (gl) {
  var base = baseShader(gl, vsSource, fsSource);

  var draw = function draw(positions, color) {
    var mode = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : gl.TRIANGLES;
    var offset = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
    var count = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : -1;
    base(positions, color, mode, offset, count);
  };

  d3fcRebind.rebindAll(draw, base);
  return draw;
});var pointsBase = (function (gl, vsSource, fsSource) {
  var base = baseShader(gl, vsSource, fsSource).numComponents(3);
  var lastWidth = -1;
  var lastStrokeColor = [-1, -1, -1, -1];
  var edgeColorLocation = gl.getUniformLocation(base.shaderProgram(), 'uEdgeColor');
  var lineWidthLocation = gl.getUniformLocation(base.shaderProgram(), 'uLineWidth');

  var draw = function draw(positions, color) {
    var lineWidth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var strokeColor = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
    var fColor = color || [0.0, 0.0, 0.0, 0.0];
    var sColor = strokeColor || fColor;

    if (lineWidth !== lastWidth || sColor.some(function (c, i) {
      return c !== lastStrokeColor[i];
    })) {
      setColor(lineWidth, sColor);
      lastWidth = lineWidth;
      lastStrokeColor = sColor;
    }

    base(positions, color, gl.POINTS);
  };

  draw.activate = function () {
    base.activate();
    lastStrokeColor = [-1, -1, -1, -1];
  };

  function setColor(lineWidth, strokeColor) {
    gl.uniform4fv(edgeColorLocation, strokeColor);
    gl.uniform1f(lineWidthLocation, lineWidth);
  }

  d3fcRebind.rebindAll(draw, base, d3fcRebind.exclude('activate'));
  return draw;
});// Vertex shader program

var vsSource$1 = "\nprecision lowp float;\nattribute vec4 aVertexPosition;\n\nuniform vec2 uOffset;\nuniform vec2 uScale;\nuniform float uLineWidth;\n\nvarying float vSize;\n\nvoid main() {\n    vec2 vertex = vec2(aVertexPosition[0], aVertexPosition[1]);\n    vec2 clipSpace = 2.0 * (vertex - uOffset) / uScale - 1.0;\n\n    vSize = sqrt(aVertexPosition[2]) + uLineWidth / 2.0;\n    gl_PointSize = vSize + 1.0;\n    gl_Position = vec4(clipSpace, 0.0, 1.0);\n}";
var fsSource$1 = "\nprecision lowp float;\n\nuniform float uLineWidth;\nuniform vec4 uEdgeColor;\nuniform vec4 uSeriesColor;\n\nvarying float vSize;\n\nvoid main() {\n    float dist = length(2.0 * gl_PointCoord - 1.0) * vSize;\n    float inner = vSize - 2.0 * uLineWidth - 1.0;\n\n    if (dist > vSize + 1.0) {\n        discard;\n    } else if (uEdgeColor[3] < 0.1) {\n        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n    } else if (dist < inner) {\n        gl_FragColor = uSeriesColor;\n    } else {\n        float rAlias = clamp((dist - vSize) / 2.0 + 0.5, 0.0, 1.0);\n        vec4 transparent = vec4(0.0);\n        vec4 edgeColor = rAlias * transparent + (1.0 - rAlias) * uEdgeColor;\n\n        float rEdge = clamp(dist - inner, 0.0, 1.0);\n        gl_FragColor = rEdge * edgeColor + (1.0 - rEdge) * uSeriesColor;\n    }\n}";
var circles = (function (gl) {
  var base = pointsBase(gl, vsSource$1, fsSource$1);

  var draw = function draw(positions, color) {
    var lineWidth = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
    var strokeColor = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;
    base(positions, color, lineWidth, strokeColor);
  };

  d3fcRebind.rebindAll(draw, base);
  return draw;
});// Vertex shader program

var vsSource$2 = "\nprecision lowp float;\nattribute vec4 aVertexPosition;\n\nuniform vec2 uOffset;\nuniform vec2 uScale;\nuniform float uLineWidth;\n\nvarying float vSize;\n\nvoid main() {\n    vec2 vertex = vec2(aVertexPosition[0], aVertexPosition[1]);\n    vec2 clipSpace = 2.0 * (vertex - uOffset) / uScale - 1.0;\n\n    vSize = sqrt(aVertexPosition[2]) * 2.0 + uLineWidth / 2.0;\n    gl_PointSize = vSize + 1.0;\n    gl_Position = vec4(clipSpace, 0.0, 1.0);\n}";
var fsSource$2 = "\nprecision lowp float;\n\nuniform float uLineWidth;\nuniform vec4 uEdgeColor;\nuniform vec4 uSeriesColor;\nuniform sampler2D uSampler;\n\nvarying float vSize;\n\nbool edge(vec2 coord) {\n    float w = uLineWidth / vSize;\n    vec4 tex1 = texture2D(uSampler, coord + vec2(0, w), -0.5);\n    vec4 tex2 = texture2D(uSampler, coord + vec2(0, -w), -0.5);\n    vec4 tex3 = texture2D(uSampler, coord + vec2(w, 0), -0.5);\n    vec4 tex4 = texture2D(uSampler, coord + vec2(-w, 0), -0.5);\n\n    return (tex1[3] + tex2[3] + tex3[3] + tex4[3]) < 3.8;\n}\n\nvoid main() {\n    vec4 edgeTex = texture2D(uSampler, gl_PointCoord, -0.5);\n\n    if (uEdgeColor[3] < 0.1) {\n        gl_FragColor = edgeTex;\n    } else if (uLineWidth < 0.1) {\n        gl_FragColor = uSeriesColor * edgeTex[3];\n    } else {\n        if (edge(gl_PointCoord)) {\n            gl_FragColor = uEdgeColor * edgeTex[3];\n        } else if (uSeriesColor[3] < 0.1) {\n            gl_FragColor = edgeTex;\n        } else {\n            gl_FragColor = uSeriesColor;\n        }\n    }\n}";
var pointTextures = (function (gl) {
  var base = pointsBase(gl, vsSource$2, fsSource$2);
  var texture = gl.createTexture();
  var samplerLocation = gl.getUniformLocation(base.shaderProgram(), 'uSampler');

  var draw = function draw(positions, image, color) {
    var lineWidth = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;
    var strokeColor = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : null;
    setupTexture(image);
    base(positions, color, lineWidth, strokeColor);
  };

  function setupTexture(image) {
    // Tell WebGL we want to affect texture unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image); // WebGL1 has different requirements for power of 2 images
    // vs non power of 2 images so check if the image is a
    // power of 2 in both dimensions.

    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
      // Yes, it's a power of 2. Generate mips.
      gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      // No, it's not a power of 2. Turn off mips and set
      // wrapping to clamp to edge
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    } // Tell the shader we bound the texture to texture unit 0


    gl.uniform1i(samplerLocation, 0);
  }
  d3fcRebind.rebindAll(draw, base);
  return draw;
});

function isPowerOf2(value) {
  return (value & value - 1) === 0;
}var drawFunctions = {
  raw: raw,
  circles: circles,
  pointTextures: pointTextures
};
var PRIVATE = '__d3fcAPI';
var helper = (function (gl) {
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  if (gl[PRIVATE]) return gl[PRIVATE];
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  var drawModules = {};
  var modelView = null; // Helper API functions

  var api = {};
  var activated;
  Object.keys(drawFunctions).forEach(function (key) {
    api[key] = function () {
      if (!drawModules[key]) {
        // Lazy-load the shaders when used
        drawModules[key] = drawFunctions[key](gl);
      } // Activate the shader if not already activate


      if (activated !== key) drawModules[key].activate();
      activated = key;
      drawModules[key].setModelView(modelView);
      return drawModules[key].apply(drawModules, arguments);
    };
  });

  api.applyScales = function (xScale, yScale) {
    var x = convertScale(xScale, gl.canvas.width, false);
    var y = convertScale(yScale, gl.canvas.height, true);
    modelView = {
      offset: [x.offset, y.offset],
      scale: [x.scaleFactor, y.scaleFactor]
    };
    return {
      pixel: {
        x: x.pixelSize,
        y: y.pixelSize
      },
      xScale: x.scale,
      yScale: y.scale
    };
  };

  var isLinear = function isLinear(scale) {
    if (scale.domain && scale.range && scale.clamp && !scale.exponent && !scale.base) {
      return !scale.clamp();
    }

    return false;
  };

  var convertScale = function convertScale(scale, screenSize) {
    var invert = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var range = scale.range();
    var domain = scale.domain();
    var invertConst = invert ? -1 : 1; // screen: (0 -> screenSize), scale: (range[0] -> range[1])

    if (isLinear(scale)) {
      var asDate = domain[0] instanceof Date;
      var numDomain = asDate ? domain.map(function (d) {
        return d.valueOf();
      }) : domain;
      var scaleFn = asDate ? function (d) {
        return d.valueOf();
      } : function (d) {
        return d;
      }; // Calculate the screen-space domain for the projection

      var domainSize = (numDomain[1] - numDomain[0]) * screenSize / (range[1] - range[0]); // numDomain[0] = screenDomainStart + range[0] * domainSize / screenSize;

      var screenDomainStart = numDomain[0] - domainSize * range[0] / screenSize;
      var screenDomain = [screenDomainStart, screenDomainStart + domainSize];
      return {
        pixelSize: Math.abs((screenDomain[1] - screenDomain[0]) / screenSize),
        offset: screenDomain[invert ? 1 : 0],
        scaleFactor: invertConst * (screenDomain[1] - screenDomain[0]),
        scale: scaleFn
      };
    } else {
      var screenRange = range.map(function (r) {
        return 2 * r / screenSize - 1;
      });
      var factor = (screenRange[1] - screenRange[0]) / (range[1] - range[0]);

      var _scaleFn = function _scaleFn(d) {
        return (scale(d) - range[0]) * factor + screenRange[0];
      };

      return {
        pixelSize: Math.abs(2 / screenSize),
        offset: invert ? 1 : -1,
        scaleFactor: invertConst * 2,
        scale: _scaleFn
      };
    }
  };

  gl[PRIVATE] = api;
  return api;
});var functor = (function (d) {
  return typeof d === 'function' ? d : function () {
    return d;
  };
});// Checks that passes properties are 'defined', meaning that calling them with (d, i) returns non null values
function defined() {
  var outerArguments = arguments;
  return function (d, i) {
    for (var c = 0, j = outerArguments.length; c < j; c++) {
      if (outerArguments[c](d, i) == null) {
        return false;
      }
    }

    return true;
  };
}// determines the offset required along the cross scale based
// on the series alignment
var alignOffset = (function (align, width) {
  switch (align) {
    case 'left':
      return width / 2;

    case 'right':
      return -width / 2;

    default:
      return 0;
  }
});var createBase = (function (initialValues) {
  var env = Object.assign({}, initialValues);

  var base = function base() {};

  Object.keys(env).forEach(function (key) {
    base[key] = function () {
      if (!arguments.length) {
        return env[key];
      }

      env[key] = arguments.length <= 0 ? undefined : arguments[0];
      return base;
    };
  });
  return base;
});var xyBase = (function () {
  var baseValue = function baseValue() {
    return 0;
  };

  var crossValue = function crossValue(d) {
    return d.x;
  };

  var mainValue = function mainValue(d) {
    return d.y;
  };

  var align = 'center';

  var bandwidth = function bandwidth() {
    return 5;
  };

  var orient = 'vertical';
  var base = createBase({
    decorate: function decorate() {},
    defined: function defined$1(d, i) {
      return defined(baseValue, crossValue, mainValue)(d, i);
    },
    xScale: d3Scale.scaleIdentity(),
    yScale: d3Scale.scaleIdentity()
  });

  base.values = function (d, i) {
    var width = bandwidth(d, i);
    var offset = alignOffset(align, width);
    var xScale = base.xScale();
    var yScale = base.yScale();

    if (orient === 'vertical') {
      var y = yScale(mainValue(d, i), i);
      var y0 = yScale(baseValue(d, i), i);
      var x = xScale(crossValue(d, i), i) + offset;
      return {
        d: d,
        x: x,
        y: y,
        y0: y0,
        width: width,
        height: y - y0,
        origin: [x, y],
        baseOrigin: [x, y0],
        transposedX: x,
        transposedY: y
      };
    } else {
      var _y = xScale(mainValue(d, i), i);

      var _y2 = xScale(baseValue(d, i), i);

      var _x = yScale(crossValue(d, i), i) + offset;

      return {
        d: d,
        x: _x,
        y: _y,
        y0: _y2,
        width: width,
        height: _y - _y2,
        origin: [_y, _x],
        baseOrigin: [_y2, _x],
        transposedX: _y,
        transposedY: _x
      };
    }
  };

  base.baseValue = function () {
    if (!arguments.length) {
      return baseValue;
    }

    baseValue = functor(arguments.length <= 0 ? undefined : arguments[0]);
    return base;
  };

  base.crossValue = function () {
    if (!arguments.length) {
      return crossValue;
    }

    crossValue = functor(arguments.length <= 0 ? undefined : arguments[0]);
    return base;
  };

  base.mainValue = function () {
    if (!arguments.length) {
      return mainValue;
    }

    mainValue = functor(arguments.length <= 0 ? undefined : arguments[0]);
    return base;
  };

  base.bandwidth = function () {
    if (!arguments.length) {
      return bandwidth;
    }

    bandwidth = functor(arguments.length <= 0 ? undefined : arguments[0]);
    return base;
  };

  base.align = function () {
    if (!arguments.length) {
      return align;
    }

    align = arguments.length <= 0 ? undefined : arguments[0];
    return base;
  };

  base.orient = function () {
    if (!arguments.length) {
      return orient;
    }

    orient = arguments.length <= 0 ? undefined : arguments[0];
    return base;
  };

  return base;
});var glBase = (function () {
  var base = xyBase();
  var context = null;
  var cacheEnabled = false;
  var glAPI = null;
  var cached = null;

  var glBase = function glBase(data, helperAPI) {
    glAPI = helperAPI || helper(context);
  };

  glBase.context = function () {
    if (!arguments.length) {
      return context;
    }

    context = arguments.length <= 0 ? undefined : arguments[0];
    return glBase;
  };

  glBase.cacheEnabled = function () {
    if (!arguments.length) {
      return cacheEnabled;
    }

    cacheEnabled = arguments.length <= 0 ? undefined : arguments[0];
    cached = null;
    return glBase;
  };

  glBase.cached = function () {
    if (!arguments.length) {
      return cached;
    }

    cached = cacheEnabled ? arguments.length <= 0 ? undefined : arguments[0] : null;
    return glBase;
  };

  glBase.glAPI = function () {
    return glAPI;
  };

  d3fcRebind.rebindAll(glBase, base);
  return glBase;
});var red = '#c60';
var green = '#6c0';
var black = '#000';
var gray = '#ddd';
var darkGray = '#999';
var colors = {
  red: red,
  green: green,
  black: black,
  gray: gray,
  darkGray: darkGray
};var toGl = function toGl(v) {
  return v / 255;
};

var glColor = (function (value) {
  if (!value) return null;
  var c = d3Color.color(value);
  return [toGl(c.r), toGl(c.g), toGl(c.b), Math.sqrt(c.opacity)];
});var bar = (function () {
  var base = glBase();

  var bar = function bar(data, helperAPI) {
    base(data, helperAPI);
    var context = base.context();
    var glAPI = base.glAPI();
    var scales = glAPI.applyScales(base.xScale(), base.yScale());
    context.fillStyle = colors.darkGray;
    context.strokeStyle = 'transparent';
    base.decorate()(context, data, 0);
    var fillColor = glColor(context.fillStyle);
    var withLines = context.strokeStyle !== 'transparent';
    var filteredData = data.filter(base.defined());
    var projected = getProjectedData(filteredData, withLines, scales);
    glAPI.raw(projected.triangles, fillColor, context.TRIANGLES);

    if (projected.lines) {
      var strokeColor = withLines ? glColor(context.strokeStyle) : null;
      glAPI.raw(projected.lines, strokeColor, context.LINES);
    }
  };

  var getProjectedData = function getProjectedData(data, withLines, scales) {
    var pixel = scales.pixel;
    var cachedProjected = base.cached();

    if (cachedProjected && cachedProjected.pixel.x === pixel.x && (!withLines || cachedProjected.lines)) {
      return cachedProjected;
    }

    var crossFn = base.crossValue();
    var mainFn = base.mainValue();
    var baseFn = base.baseValue();
    var vertical = base.orient() === 'vertical'; // 2 triangles per bar, with 3 x/y vertices per triangle

    var triangles = new Float32Array(data.length * 12);
    var triangleIndex = 0;

    var insertTriangle = function insertTriangle(x1, y1, x2, y2, x3, y3) {
      triangles[triangleIndex++] = x1;
      triangles[triangleIndex++] = y1;
      triangles[triangleIndex++] = x2;
      triangles[triangleIndex++] = y2;
      triangles[triangleIndex++] = x3;
      triangles[triangleIndex++] = y3;
    }; // 3 lines per bar, with 2 x/y vertices per line


    var lines = withLines ? new Float32Array(data.length * 12) : null;
    var lineIndex = 0;

    var insertLine = function insertLine(x1, y1, x2, y2) {
      lines[lineIndex++] = x1;
      lines[lineIndex++] = y1;
      lines[lineIndex++] = x2;
      lines[lineIndex++] = y2;
    };

    var insertBar = function insertBar(x1, y1, x2, y2, x3, y3, x4, y4) {
      insertTriangle(x1, y1, x2, y2, x3, y3);
      insertTriangle(x3, y3, x4, y4, x1, y1);

      if (withLines) {
        insertLine(x1, y1, x2, y2);
        insertLine(x2, y2, x3, y3);
        insertLine(x3, y3, x4, y4);
      }
    };

    data.forEach(function (d, i) {
      var width = bar.bandwidth()(d, i);
      var offset = alignOffset(bar.align(), width) - width / 2;

      if (vertical) {
        var y = scales.yScale(mainFn(d, i), i);
        var y0 = scales.yScale(baseFn(d, i), i);
        var xl = scales.xScale(crossFn(d, i), i) + offset * pixel.x;
        var xr = xl + width * pixel.x;
        insertBar(xl, y0, xl, y, xr, y, xr, y0);
      } else {
        var x = scales.xScale(mainFn(d, i), i);
        var x0 = scales.xScale(baseFn(d, i), i);
        var yu = scales.yScale(crossFn(d, i), i) + offset * pixel.y;
        var yd = yu + width * pixel.y;
        insertBar(x0, yu, x, yu, x, yd, x0, yd);
      }
    });
    var projectedData = {
      triangles: triangles,
      lines: lines,
      pixel: pixel
    };
    base.cached(projectedData);
    return projectedData;
  };

  d3fcRebind.rebindAll(bar, base, d3fcRebind.exclude('glAPI', 'cached'));
  return bar;
});var line = (function () {
  var base = glBase();

  var line = function line(data, helperAPI) {
    base(data, helperAPI);
    var context = base.context();
    var glAPI = base.glAPI();
    var scales = glAPI.applyScales(base.xScale(), base.yScale());
    context.strokeStyle = colors.black;
    context.lineWidth = 1;
    base.decorate()(context, data, 0); // Get triangle strip representing the projected data

    var lineWidth = parseInt(context.lineWidth);
    var strokeColor = glColor(context.strokeStyle);
    var projected = data.constructor === Float32Array ? rawFloat32Data(data) : getProjectedData(data, scales);

    if (lineWidth < 1.1) {
      // Draw straight to WebGL as line strips
      projected.batches.forEach(function (batch) {
        glAPI.raw(projected.points, strokeColor, context.LINE_STRIP, batch.offset, batch.count);
      });
    } else {
      // Convert to a triangle strip
      projected.batches.forEach(function (batch) {
        var projectedTriangles = getProjectedTriangles(projected.points, batch.offset, batch.count, scales, lineWidth);
        glAPI.raw(projectedTriangles, strokeColor, context.TRIANGLE_STRIP);
      });
    }
  };

  var rawFloat32Data = function rawFloat32Data(data) {
    return {
      points: data,
      batches: [{
        offset: 0,
        count: data.length / 2
      }]
    };
  };

  var getBatches = function getBatches(data) {
    if (data.constructor === Float32Array) {
      return [{
        offset: 0,
        count: data.length / 2
      }];
    } // Check the `defined` function for missing entries, and
    // break the line into segments for drawing


    var batches = [];
    var offset = 0;

    var pushBatch = function pushBatch(index) {
      if (index > offset) {
        batches.push({
          offset: offset,
          count: index - offset
        });
      }

      offset = index + 1;
    };

    data.forEach(function (d, i) {
      if (!line.defined()(d, i)) {
        pushBatch(i);
      }
    });
    pushBatch(data.length);
    return batches;
  };

  var getProjectedData = function getProjectedData(data, scales) {
    var cachedProjected = base.cached();

    if (cachedProjected) {
      return cachedProjected;
    }

    var crossFn = base.crossValue();
    var mainFn = base.mainValue();
    var vertical = base.orient() === 'vertical';
    var points = new Float32Array(data.length * 2);
    var index = 0;

    if (vertical) {
      data.forEach(function (d, i) {
        points[index++] = scales.xScale(crossFn(d, i), i);
        points[index++] = scales.yScale(mainFn(d, i), i);
      });
    } else {
      data.forEach(function (d, i) {
        points[index++] = scales.xScale(mainFn(d, i), i);
        points[index++] = scales.yScale(crossFn(d, i), i);
      });
    }

    var batches = getBatches(data);
    var projected = {
      points: points,
      batches: batches
    };
    base.cached(projected);
    return projected;
  };

  var getProjectedTriangles = function getProjectedTriangles(points, offset, count, scales, lineWidth) {
    // Two vertices for each data point
    var pixel = scales.pixel;
    var result = new Float32Array(count * 4); // Split points based on normals

    var target = 0;
    var factor = 0.5 * lineWidth;
    var start = offset * 2;
    var end = start + count * 2;

    for (var index = start; index < end; index += 2) {
      var normal = getNormal(points, start, end, index, pixel);
      var normalPixels = [normal[0] * pixel.x * factor, normal[1] * pixel.y * factor]; // Apply to the pair of points

      result[target++] = points[index] + normalPixels[0];
      result[target++] = points[index + 1] + normalPixels[1];
      result[target++] = points[index] - normalPixels[0];
      result[target++] = points[index + 1] - normalPixels[1];
    }

    return result;
  };

  var normaliseVector = function normaliseVector(vector) {
    var length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
    return [vector[0] / length, vector[1] / length];
  };

  var lineNormal = function lineNormal(p1, p2) {
    return normaliseVector([p2[1] - p1[1], -(p2[0] - p1[0])]);
  };

  var getNormal = function getNormal(points, start, end, index, pixel) {
    var lastPoint = index > start && [points[index - 2] / pixel.x, points[index - 1] / pixel.y];
    var thisPoint = [points[index] / pixel.x, points[index + 1] / pixel.y];
    var nextPoint = index < end - 2 && [points[index + 2] / pixel.x, points[index + 3] / pixel.y];

    if (!lastPoint) {
      // Beginning of line
      return lineNormal(thisPoint, nextPoint);
    } else if (!nextPoint) {
      // End of line
      return lineNormal(lastPoint, thisPoint);
    } // Calculate the miter join


    var l1 = normaliseVector([thisPoint[0] - lastPoint[0], thisPoint[1] - lastPoint[1]]);
    var l2 = normaliseVector([nextPoint[0] - thisPoint[0], nextPoint[1] - thisPoint[1]]);
    var tangent = normaliseVector([l1[0] + l2[0], l1[1] + l2[1]]);
    var miter = [-tangent[1], tangent[0]]; // Get length using dot product of the miter with one of the normals

    var normal1 = lineNormal(lastPoint, thisPoint);
    var length = 1 / (miter[0] * normal1[0] + miter[1] * normal1[1]);
    return [miter[0] * length, miter[1] * length];
  };

  d3fcRebind.rebindAll(line, base, d3fcRebind.exclude('glAPI', 'cached', 'baseValue', 'bandwidth', 'align'));
  return line;
});var area = (function () {
  var base = glBase();

  var area = function area(data, helperAPI) {
    base(data, helperAPI);
    var context = base.context();
    var glAPI = base.glAPI();
    var scales = glAPI.applyScales(base.xScale(), base.yScale());
    context.fillStyle = colors.gray;
    context.strokeStyle = 'transparent';
    base.decorate()(context, data, 0);
    var fillColor = glColor(context.fillStyle);
    var withLines = context.strokeStyle !== 'transparent';
    var projected = getProjectedData(data, withLines, scales);
    projected.batches.area.forEach(function (batch) {
      glAPI.raw(projected.triangles, fillColor, context.TRIANGLE_STRIP, batch.offset, batch.count);
    });

    if (projected.lines) {
      var strokeColor = withLines ? glColor(context.strokeStyle) : null;
      projected.batches.line.forEach(function (batch) {
        glAPI.raw(projected.lines, strokeColor, context.LINE_STRIP, batch.offset, batch.count);
      });
    }
  };

  var getProjectedData = function getProjectedData(data, withLines, scales) {
    var cachedProjected = base.cached();

    if (cachedProjected && (!withLines || cachedProjected.lines)) {
      return cachedProjected;
    }

    var crossFn = base.crossValue();
    var mainFn = base.mainValue();
    var baseFn = base.baseValue();
    var vertical = base.orient() === 'vertical'; // 2 triangles per data point, but as a triangle-strip,
    // so only 2 vertices per data point

    var dataPoints = new Float32Array(data.length * 4);
    var index = 0;
    var lines = withLines ? new Float32Array(data.length * 2) : null;
    var lineIndex = 0;
    var crossoverCount = 0;
    var areaBatches = {
      offset: 0,
      batches: []
    };
    var lineBatches = {
      offset: 0,
      batches: []
    }; // "Batches" keep track of where we have to not-render points because
    // the are not "defined"

    var pushBatch = function pushBatch(batchSet, index) {
      if (index > batchSet.offset) {
        batchSet.batches.push({
          offset: batchSet.offset,
          count: index - batchSet.offset
        });
      }

      batchSet.offset = index;
    };

    var pushBatches = function pushBatches() {
      pushBatch(areaBatches, index / 2 + crossoverCount * 2);
      pushBatch(lineBatches, lineIndex / 2);
    };

    var lastPositive;
    data.forEach(function (d, i) {
      if (area.defined()(d, i)) {
        var p;

        if (vertical) {
          p = {
            x: scales.xScale(crossFn(d, i), i),
            y: scales.yScale(mainFn(d, i), i),
            y0: scales.yScale(baseFn(d, i), i)
          };
          p.x0 = p.x;
          p.positive = p.y - p.y0 && p.y - p.y0 > 0;
        } else {
          p = {
            x: scales.xScale(mainFn(d, i), i),
            y: scales.yScale(crossFn(d, i), i),
            x0: scales.xScale(baseFn(d, i), i)
          };
          p.y0 = p.y;
          p.positive = p.x - p.x0 !== 0 && p.x - p.x0 > 0;
        }

        dataPoints[index++] = p.x;
        dataPoints[index++] = p.y;
        dataPoints[index++] = p.x0;
        dataPoints[index++] = p.y0;

        if (withLines) {
          lines[lineIndex++] = p.x;
          lines[lineIndex++] = p.y;
        }

        if (lastPositive !== undefined && p.positive !== undefined && p.positive !== lastPositive) {
          // If we swapped from positive to negative (or vice versa), we need to
          // add a cross-over points (unless one of them was not "defined")
          crossoverCount++;
        }

        lastPositive = p.positive;
      } else {
        pushBatches();
        lastPositive = undefined;
      }
    });
    pushBatches(); // If we have any cross-over points to add, insert them now

    var triangles = crossoverCount > 0 ? insertCrossovers(data, dataPoints, crossoverCount) : dataPoints;
    var batches = {
      area: areaBatches.batches,
      line: lineBatches.batches
    };
    var projectedData = {
      triangles: triangles,
      lines: lines,
      batches: batches
    };
    base.cached(projectedData);
    return projectedData;
  };

  var insertCrossovers = function insertCrossovers(data, dataPoints, crossoverCount) {
    // We need to insert two extra vertices for each crossover
    var triangles = new Float32Array(dataPoints.length + crossoverCount * 4);
    var index = 0;
    var triangleIndex = 0;
    var vertical = base.orient() === 'vertical';
    var last = null;
    data.forEach(function (d, i) {
      if (area.defined()(d, i)) {
        var x = dataPoints[index++];
        var y = dataPoints[index++];
        var x0 = dataPoints[index++];
        var y0 = dataPoints[index++];
        var positive = vertical ? y - y0 > 0 : x - x0 > 0;

        if (last && positive !== last.positive) {
          // Insert the extra one at the crossover
          var r;

          if (vertical) {
            r = Math.abs(last.y - last.y0) / (Math.abs(y - y0) + Math.abs(last.y - last.y0));
          } else {
            r = Math.abs(last.x - last.x0) / (Math.abs(x - x0) + Math.abs(last.x - last.x0));
          }

          var midx = last.x + r * (x - last.x);
          var midy = last.y + r * (y - last.y); // Add the same point twice to skip rendering an unwanted triangle

          triangles[triangleIndex++] = midx;
          triangles[triangleIndex++] = midy;
          triangles[triangleIndex++] = midx;
          triangles[triangleIndex++] = midy;
        }

        last = {
          positive: positive,
          x: x,
          y: y,
          x0: x0,
          y0: y0
        };
        triangles[triangleIndex++] = x;
        triangles[triangleIndex++] = y;
        triangles[triangleIndex++] = x0;
        triangles[triangleIndex++] = y0;
      } else {
        last = null;
      }
    });
    return triangles;
  };

  d3fcRebind.rebindAll(area, base, d3fcRebind.exclude('glAPI', 'cached', 'bandwidth', 'align'));
  return area;
});var point = (function () {
  var base = glBase();
  var size = 70;
  var type = d3Shape.symbolCircle;
  var imagePromise = null;

  var point = function point(data, helperAPI) {
    base(data, helperAPI);
    var context = base.context();
    var glAPI = base.glAPI();
    var scales = glAPI.applyScales(base.xScale(), base.yScale());
    context.strokeStyle = type ? colors.black : undefined;
    context.fillStyle = type ? colors.gray : undefined;
    context.lineWidth = 1;
    base.decorate()(context, data, 0);
    var projectedData = data.constructor === Float32Array ? data : getProjectedData(data, scales);
    var fillColor = glColor(context.fillStyle);
    var lineWidth = context.strokeStyle !== 'transparent' ? parseInt(context.lineWidth) : 0;
    var strokeColor = lineWidth > 0 ? glColor(context.strokeStyle) : null;

    if (type === d3Shape.symbolCircle) {
      glAPI.circles(projectedData, fillColor, lineWidth, strokeColor);
    } else {
      imagePromise.then(function (image) {
        glAPI.pointTextures(projectedData, image, fillColor, lineWidth, strokeColor);
      });
    }
  };

  var getProjectedData = function getProjectedData(data, scales) {
    var cachedProjected = base.cached();

    if (cachedProjected) {
      return cachedProjected;
    }

    var filteredData = data.filter(base.defined());
    var crossFn = base.crossValue();
    var mainFn = base.mainValue();
    var sizeFn = typeof size === 'function' ? size : function () {
      return size;
    };
    var vertical = base.orient() === 'vertical';
    var result = new Float32Array(data.length * 3);
    var index = 0;

    if (vertical) {
      filteredData.forEach(function (d, i) {
        result[index++] = scales.xScale(crossFn(d, i), i);
        result[index++] = scales.yScale(mainFn(d, i), i);
        result[index++] = sizeFn(d);
      });
    } else {
      filteredData.forEach(function (d, i) {
        result[index++] = scales.xScale(mainFn(d, i), i);
        result[index++] = scales.yScale(crossFn(d, i), i);
        result[index++] = sizeFn(d);
      });
    }

    base.cached(result);
    return result;
  };

  point.size = function () {
    if (!arguments.length) {
      return size;
    }

    size = arguments.length <= 0 ? undefined : arguments[0];
    return point;
  };

  point.type = function () {
    if (!arguments.length) {
      return type;
    }

    type = arguments.length <= 0 ? undefined : arguments[0];

    if (type !== d3Shape.symbolCircle) {
      imagePromise = getSymbolImage(type);
    } else {
      imagePromise = null;
    }

    return point;
  };

  point.image = function (img) {
    type = null;
    imagePromise = new Promise(function (resolve) {
      if (img.complete) {
        resolve(img);
      } else {
        img.onload = function () {
          resolve(img);
        };
      }
    });
    return point;
  };

  d3fcRebind.rebindAll(point, base, d3fcRebind.exclude('glAPI', 'cached', 'baseValue', 'bandwidth', 'align'));
  return point;
});
var textureSize = 256;

var getSymbolImage = function getSymbolImage(type) {
  return new Promise(function (resolve) {
    var canvas = document.createElement('canvas');
    canvas.width = textureSize;
    canvas.height = textureSize;
    var context = canvas.getContext('2d');
    context.fillStyle = '#000';
    var halfSize = textureSize / 2;
    context.translate(halfSize, halfSize);
    context.beginPath();
    d3Shape.symbol().type(type).size(halfSize * halfSize).context(context)();
    context.closePath();
    context.fill();
    var image = new window.Image();
    image.src = canvas.toDataURL();

    image.onload = function () {
      resolve(image);
    };
  });
};var groupedBase = (function (series) {
  var bandwidth = function bandwidth() {
    return 50;
  };

  var align = 'center'; // the offset scale is used to offset each of the series within a group

  var offsetScale = d3Scale.scaleBand();
  var grouped = createBase({
    decorate: function decorate() {},
    xScale: d3Scale.scaleLinear(),
    yScale: d3Scale.scaleLinear()
  }); // the bandwidth for the grouped series can be a function of datum / index. As a result
  // the offset scale required to cluster the 'sub' series is also dependent on datum / index.
  // This function computes the offset scale for a specific datum / index of the grouped series

  grouped.offsetScaleForDatum = function (data, d, i) {
    var width = bandwidth(d, i);
    var offset = alignOffset(align, width);
    var halfWidth = width / 2;
    return offsetScale.domain(d3Array.range(0, data.length)).range([-halfWidth + offset, halfWidth + offset]);
  };

  grouped.bandwidth = function () {
    if (!arguments.length) {
      return bandwidth;
    }

    bandwidth = functor(arguments.length <= 0 ? undefined : arguments[0]);
    return grouped;
  };

  grouped.align = function () {
    if (!arguments.length) {
      return align;
    }

    align = arguments.length <= 0 ? undefined : arguments[0];
    return grouped;
  };

  d3fcRebind.rebindAll(grouped, offsetScale, d3fcRebind.includeMap({
    'paddingInner': 'paddingOuter'
  }));
  return grouped;
});function grouped (series) {
  var base = groupedBase(series);

  var grouped = function grouped(data) {
    data.forEach(function (seriesData, index) {
      // create a composite scale that applies the required offset
      var isVertical = series.orient() !== 'horizontal';
      var baseScale = isVertical ? base.xScale() : base.yScale();

      var compositeScale = function compositeScale(d, i) {
        var offset = base.offsetScaleForDatum(data, d, i);
        return baseScale(d) + offset(index) + offset.bandwidth() / 2;
      };

      d3fcRebind.rebindAll(compositeScale, baseScale, d3fcRebind.exclude('clamp', 'copy'));

      if (isVertical) {
        series.xScale(compositeScale);
        series.yScale(base.yScale());
      } else {
        series.yScale(compositeScale);
        series.xScale(base.xScale());
      } // if the sub-series has a bandwidth, set this from the offset scale


      if (series.bandwidth) {
        series.bandwidth(function (d, i) {
          return base.offsetScaleForDatum(data, d, i).bandwidth();
        });
      } // adapt the decorate function to give each series the correct index


      series.decorate(function (c, d) {
        return base.decorate()(c, d, index);
      });
      series(seriesData);
    });
  };

  d3fcRebind.rebindAll(grouped, series, d3fcRebind.exclude('decorate', 'xScale', 'yScale'));
  d3fcRebind.rebindAll(grouped, base, d3fcRebind.exclude('offsetScaleForDatum'));
  return grouped;
}Object.defineProperty(exports,'seriesWebglMulti',{enumerable:true,get:function(){return d3fcSeries.seriesCanvasMulti;}});Object.defineProperty(exports,'seriesWebglRepeat',{enumerable:true,get:function(){return d3fcSeries.seriesCanvasRepeat;}});exports.cartesian=cartesian;exports.seriesWebglArea=area;exports.seriesWebglBar=bar;exports.seriesWebglGrouped=grouped;exports.seriesWebglLine=line;exports.seriesWebglPoint=point;Object.defineProperty(exports,'__esModule',{value:true});}));//# sourceMappingURL=d3fc-webgl.js.map
