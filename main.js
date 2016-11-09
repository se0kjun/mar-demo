var video, canvas, context;
var pastResults = {};
var currId;

var MARParser = function(node) {
  var doc = document.createElement('html');
  doc.innerHTML = node;

  this.parseNode = $(doc);
  this.textNode = node;

  this.scene = this.parseNode.find('scene')[0];
  this.sensor = this.parseNode.find('sensor')[0];
  this.background = this.parseNode.find('background')[0];

  this.aobject = function() {
    return this.parseNode.find('aobject').map(function(idx, m) {
      return {
        aobject: m,
        aobject_reference: this.parseNode.find($(m).attr('placeholder-for'))
      }
    }.bind(this));
  };
  this.robject = function() {
    return this.parseNode.find('robject').map(function(idx, m) {
      return {
        robject: m,
        robject_reference: this.parseNode.find($(m).attr('placeholder')),
        referenece_transform: this.parseNode.find('Matrix' + this.parseNode.find($(m).attr('placeholder')).attr('transform'))[0]
      }
    }.bind(this));
  };

  this.MAREvent = function() {
    return this.parseNode.find('MAREvent').map(function(idx, m) {
      return {
        event: m,
        event_object: this.parseNode.find('aobject, robject').find($(m).attr('object')),
        event_callback: this.parseNode.find('MARBehavior[id="#' + $(m).attr('id') + '"]')
      }
    }.bind(this));
  };
  this.MARBehavior = function() {
    return this.parseNode.find('MARBehavior').map(function(idx, m) {
      return {
        callback: m,
        callback_handler: this.parseNode.find('MAREvent').find($(m).attr('event')),
        callback_target: this.parseNode.find('aobject, robject').find($(m).attr('object'))
      }
    }.bind(this));
  };
  this.matrix = function() {
    return this.parseNode.find('matrix').map(function(idx, m) {
      return {
        matrix: m
      }
    }.bind(this));
  };
  this.findEvent = function(elem) {
    //elem == robject
    return this.parseNode.find('MAREvent[object="#' + elem.robject.getAttribute('id') + '"]')[0];
  }
};

// I'm going to use a glMatrix-style matrix as an intermediary.
// So the first step is to create a function to convert a glMatrix matrix into a Three.js Matrix4.
THREE.Matrix4.prototype.setFromArray = function(m) {
  return this.set(
    m[0], m[4], m[8], m[12],
    m[1], m[5], m[9], m[13],
    m[2], m[6], m[10], m[14],
    m[3], m[7], m[11], m[15]
  );
};

        var light = new THREE.DirectionalLight( 0xffffff , 5);
        light.position.set( -10, -15, -1 ).normalize();
        glScene.add(light);
        

function MAREngine(parseContext) {
  // 2. PREPARING
  this.parseContext = parseContext;
  this.setParseContext = function (context) {
    this.parseContext = context;
    switch (context.scene.getAttribute('type')) {
      case 'ar':
        {
          bgTexture = new THREE.Texture(canvas);
          bgTexture.minFilter = THREE.LinearFilter;
          glPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 0), new THREE.MeshBasicMaterial({
            map: bgTexture,
            depthTest: false,
            depthWrite: false
          }));

          bgScene = new THREE.Scene();
          bgCamera = new THREE.Camera();
          bgScene.add(glPlane);
          bgScene.add(bgCamera);

          break;
        }
      case 'avr':
        {
          bgCamera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 1, 1000);
          bgCamera.position.z = 400;
          bgScene = new THREE.Scene();

          var geometry = new THREE.PlaneGeometry(600, 400);
          var material = new THREE.MeshBasicMaterial({
            color: 0x555555
          });

          var plane = new THREE.Mesh(geometry, material);
          plane.rotation.x = -0.7;
          bgScene.add(plane);
          bgScene.remove(glPlane);
          
          break;
        }
    }    
  }

  var video = document.getElementById('video'),
    canvas = document.getElementById("test"),
    canvasContext = canvas.getContext("2d"),
    param, markerRoots = {}, meshList = {}, clock = new THREE.Clock();;

  var glRenderer, glScene, glCamera, glPlane;
  var bgCamera, bgScene, bgTexture;

  var __webrtc_init = (function() {
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (navigator.getUserMedia) {
      navigator.getUserMedia({
          video: true
        },
        function(stream) {
          if (window.webkitURL) {
            video.src = window.webkitURL.createObjectURL(stream);
          } else if (video.mozSrcObject !== undefined) {
            video.mozSrcObject = stream;
          } else {
            video.src = stream;
          }
        },
        function(error) {
          console.log(error);
        }
      );
    }
  })();

  var __threejs_init = (function() {
    glRenderer = new THREE.WebGLRenderer({
      antialias: true
    });
    glRenderer.setSize(canvas.width, canvas.height);
    document.getElementById("container").appendChild(glRenderer.domElement);

    // create the scene
    glScene = new THREE.Scene();

    // Create a camera and a marker root object for your Three.js scene.
    glCamera = new THREE.Camera();
    glScene.add(glCamera);
    glScene.add(new THREE.AmbientLight( 0xcccccc ));

    switch (this.parseContext.scene.getAttribute('type')) {
      case 'ar':
        {
          bgTexture = new THREE.Texture(canvas);
          bgTexture.minFilter = THREE.LinearFilter;
          glPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 0), new THREE.MeshBasicMaterial({
            map: bgTexture,
            depthTest: false,
            depthWrite: false
          }));

          bgScene = new THREE.Scene();
          bgCamera = new THREE.Camera();
          bgScene.add(glPlane);
          bgScene.add(bgCamera);

          break;
        }
      case 'avr':
        {
          bgCamera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 1, 1000);
          bgCamera.position.z = 400;
          bgScene = new THREE.Scene();

          var geometry = new THREE.PlaneGeometry(600, 400);
          var material = new THREE.MeshBasicMaterial({
            color: 0x555555
          });

          var plane = new THREE.Mesh(geometry, material);
          plane.rotation.x = -0.7;
          bgScene.add(plane);
          
          break;
        }
    }
    
    this.parseContext.aobject().each(function(idx, item) {
      if (item.aobject.getAttribute('object') == 'model') {
        var loader = new THREE.ColladaLoader();
        loader.load( item.aobject.getAttribute('model-data'), function(collada) { loadModel(collada, item.aobject.getAttribute('id')); });
      }
    });
  })();

  var copyMarkerMatrix = function(arMat, glMat) {
    glMat[0] = arMat.m00;
    glMat[1] = -arMat.m10;
    glMat[2] = arMat.m20;
    glMat[3] = 0;
    glMat[4] = arMat.m01;
    glMat[5] = -arMat.m11;
    glMat[6] = arMat.m21;
    glMat[7] = 0;
    glMat[8] = -arMat.m02;
    glMat[9] = arMat.m12;
    glMat[10] = -arMat.m22;
    glMat[11] = 0;
    glMat[12] = arMat.m03;
    glMat[13] = -arMat.m13;
    glMat[14] = arMat.m23;
    glMat[15] = 1;
  }

  var trackingMarker = function() {
    var raster = new NyARRgbRaster_Canvas2D(canvas);
    var param = new FLARParam(canvas.width, canvas.height);
    var detector = new FLARMultiIdMarkerDetector(param, 120);
    detector.setContinueMode(true);

    // glMatrix matrices are flat arrays.
    var tmp = new Float32Array(16);

    // Next we need to make the Three.js camera use the FLARParam matrix.
    param.copyCameraMatrix(tmp, 10, 10000);
    glCamera.projectionMatrix.setFromArray(tmp);

    // Create a NyARTransMatResult object for getting the marker translation matrices.
    var resultMat = new NyARTransMatResult();
    var markers = {};
    var emptyFloatArray = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    canvas.changed = true;
    
      // Update the video texture.
    switch (this.parseContext.scene.getAttribute('type')) {
      case 'ar':
        {
          bgTexture.needsUpdate = true;
          break;
        }
    }    

    //move all marker roots to origin so that they will disappear when not tracked
    Object.keys(markerRoots).forEach(function(key) {
      markerRoots[key].matrix.setFromArray(emptyFloatArray);
      markerRoots[key].matrixWorldNeedsUpdate = true;
    });

    var markerCount = detector.detectMarkerLite(raster, 120);

    // Go through the detected markers and get their IDs and transformation matrices.
    for (var i = 0; i < markerCount; i++) {

      // Get the ID marker data for the current marker.
      // ID markers are special kind of markers that encode a number.
      // The bytes for the number are in the ID marker data.
      var id = detector.getIdMarkerData(i);


      // Read bytes from the id packet.
      var currId = -1,
        currItem;
      // This code handles only 32-bit numbers or shorter.
      if (id.packetLength <= 4) {
        currId = 0;
        for (var j = 0; j < id.packetLength; j++) {
          currId = (currId << 8) | id.getPacketData(j);
        }
        
        this.parseContext.aobject().each(function(idx, item) {
            if (item.aobject.getAttribute('object') == 'model') {
                var loader = new THREE.JSONLoader();
                loader.load( item.aobject.getAttribute('model-data'), function(geo, mat) { loadJsonModel(geo, mat, item.aobject.getAttribute('id'));}, function(a) { console.log(a); });
            }
        });

        var event_item = this.parseContext.findEvent(currItem);
        //create a new Three.js object as marker root
        var markerRoot = augmentObject(currItem);

        if (event_item.getAttribute('value') == 'true') {
          // Add the marker root to your scene
          glScene.add(markerRoot);
        }
        markerRoots[currId] = markerRoot;
      }

      // Get the transformation matrix for the detected marker.
      detector.getTransformMatrix(i, resultMat);

      // Copy the marker matrix to the tmp matrix.
      copyMarkerMatrix(resultMat, tmp);

      // Copy the marker matrix over to your marker root object.
      markerRoots[currId].matrix.setFromArray(tmp);
      markerRoots[currId].matrixWorldNeedsUpdate = true;
    }

    return markerRoots;
  }

  var augmentObject = function(robject_class) {
    var markerRoot = new THREE.Object3D();
    markerRoot.matrixAutoUpdate = false;
    
    function loadJsonModel(geometry, materials, modelID) {
        materials.forEach(function (material) {
            material.skinning = true;
            material.opacity = 1.0;
            material.side = THREE.DoubleSide;
        });
        
        var object = new THREE.SkinnedMesh(
            geometry,
            new THREE.MeshFaceMaterial(materials)
        );
        
        object.scale.x = object.scale.y = object.scale.z = 100;
        object.rotation.y = 180;
        object.rotation.x = 0;
        object.rotation.z = 90;

        animMixer  = new THREE.AnimationMixer(object);
        meshList[modelID] = object;
        actionList[modelID] = animMixer.clipAction( geometry.animations[ 0 ] );
        console.log('loaded');
    }

    return markerRoot;
  }
  
  function loadModel(geometry, modelID) {
//    var material = new THREE.MeshFaceMaterial(materials);
    meshList[modelID] = geometry.scene;
    geometry.scene.traverse( function ( child ) {
      if ( child instanceof THREE.SkinnedMesh ) {
        var animation = new THREE.Animation( child, child.geometry.animation );
        animation.play();
      }
    });

    geometry.scene.scale.x = geometry.scene.scale.y = geometry.scene.scale.z = 0.2;
    geometry.scene.updateMatrix();      
  }

  function renderer(interval, update_context) {
    if (update_context !== undefined)
      this.parseContext = update_context;

    requestAnimFrame(renderer);
    canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
    trackingMarker();
    THREE.AnimationHandler.update( clock.getDelta() );
    // Render the scene.
    glRenderer.autoClear = false;
    glRenderer.clear();
    glRenderer.render(bgScene, bgCamera);
    glRenderer.render(glScene, glCamera);
  }

  window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function(callback, element) {
        window.setTimeout(callback, 1000 / 60);
      };
  })();

  return {
    'renderer': renderer,
    'engineContext': this
  };
}

document.addEventListener("DOMContentLoaded", function() {
    var editor = ace.edit("editor");
    editor.setTheme("ace/theme/tomorrow");
    editor.session.setMode("ace/mode/html");
    editor.setAutoScrollEditorIntoView(true);
    editor.setOption("maxLines", 100);
    editor.setOption("fontSize", "20px");
    editor.setValue('\
<scene id="wld" type="ar"></scene>\n\
<sensor id="cam_1" calibration="default"></sensor>\n\
<background id="cam_based" sensor="cam_1" placeholer="default"></background>\n\
<viewpoint id="arview" parent="default"></viewpoint>\n\
<calibration id="cal_1"></calibration>\n\n\
<Matrix id="forAobj1" x="0" y="0" z="-80"></Matrix>\n\
<Matrix id="forAobj2" x="50" y="0" z="0"></Matrix>\n\n\
<robject id="robj1" type="marker" marker-id="64" object="marker64" placeholder="#aobj4"></robject>\n\
<robject id="robj2" type="marker" marker-id="88" object="marker88" placeholder="#aobj3"></robject>\n\
<aobject id="aobj1" object="sphere" placeholder-for="#robj1" transform="#forAobj1" onclick ="default"></aobject>\n\
<aobject id="aobj2" object="cube" placeholder-for="#robj2" transform="#forAobj2" onclick ="default"></aobject>\n\
<aobject id="aobj3" object="model" placeholder-for="#robj2" model-data="./model/sj.json" transform="#forAobj2" onclick ="default"></aobject>\n\
<aobject id="aobj4" object="model" placeholder-for="#robj1" model-data="./model/miku.min.json" transform="#forAobj2" onclick ="default"></aobject>\n\n\
<MAREvent id="evt1" event="object_presence" object="#robj1" value="false"></MAREvent>\n\
<MAREvent id="evt2" event="object_presence" object="#robj2" value="true"></MAREvent>\n\
<MARBehavior id="bhv1" behavior="show" event="evt1.value" object="#aobj1"></MARBehavior>\n\
<MARBehavior id="bhv2" behavior="show" event="evt2.value" object="#aobj2"></MARBehavior>');

    // 1. PARSING
    var app = new MARParser(editor.getValue());

  // 2. EXECUTING
  var engine = MAREngine(app);
  console.log(engine);
  engine.renderer();  

  $('#eee').click(function() {
    app = new MARParser(editor.getValue());
    engine.engineContext.setParseContext(app);
  });
});
