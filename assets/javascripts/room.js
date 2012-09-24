$(function () {
  var opts = {
    paper:undefined,
    tool:undefined,
    selectedTool:undefined,
    historytools:[],
    tooltype:'line',
    historyCounter:undefined,
    color:'#000',
    defaultWidth:3,
    currentScale:1,
    opacity:1
  };

  var room = {
    init:function (canvas, opt) {
      opts = $.extend({}, opts, opt);

      $("#toolSelect > li, #panTool, #selectTool").on("click", function () {
        window.room.setTooltype($(this).data("tooltype"));
      });

      $('.color').click(function () {
        $('.color').removeClass('activen');
        opts.color = $(this).attr('data-color');
        $(this).addClass('activen');
      });

      window.room.helper.initUploader();

      return false;
    },

    // *** Mouse events handling ***

    onMouseMove:function (canvas, event) {
      event.point = event.point.transform(new Matrix(1 / opts.currentScale, 0, 0, 1 / opts.currentScale, 0, 0));

      $(canvas).css({cursor:"default"});

      if (opts.selectedTool && opts.selectedTool.selectionRect) {
        if (opts.selectedTool.selectionRect.bottomRightRect.bounds.contains(event.point)) {
          $(canvas).css({cursor:"se-resize"});
        } else if (opts.selectedTool.selectionRect.topLeftRect.bounds.contains(event.point)) {
          $(canvas).css({cursor:"nw-resize"});
        }
      }
    },

    onMouseDown:function (canvas, event) {
      event.point = event.point.transform(new Matrix(1 / opts.currentScale, 0, 0, 1 / opts.currentScale, 0, 0));

      $("#removeSelected").addClass("disabled");
      if (opts.selectedTool && opts.selectedTool.selectionRect) {
        opts.selectedTool.selectionRect.remove();
      }

      if (opts.tooltype == 'line') {
        this.createTool(new opts.paper.Path());
      } else if (opts.tooltype == 'highligher') {
        this.createTool(new opts.paper.Path(), {color:opts.color, width:15, opacity:0.7});
      } else if (opts.tooltype == 'straightline') {
        this.createTool(new opts.paper.Path());
        if (opts.tool.segments.length == 0) {
          opts.tool.add(event.point);
        }
        opts.tool.add(event.point);
      } else if (opts.tooltype == 'arrow') {
        var arrow = new opts.paper.Path();
        arrow.arrow = arrow;
        this.createTool(arrow);
        if (opts.tool.segments.length == 0) {
          opts.tool.add(event.point);
        }
        opts.tool.add(event.point);
        opts.tool.lineStart = event.point
      } else if (opts.tooltype == "select") {
        var selectedSomething = false;
        $(window.room.getHistoryTools()).each(function () {
          if (this.bounds.contains(event.point)) {
            opts.selectedTool = this;
            selectedSomething = true;
          }
        });

        if (opts.selectedTool && opts.selectedTool.selectionRect &&
          opts.selectedTool.selectionRect.bounds.contains(event.point)) {
          selectedSomething = true;
        }

        if (!selectedSomething) {
          opts.selectedTool = null;
        }

        if (opts.selectedTool) {
          opts.selectedTool.selectionRect = window.room.helper.createSelectionRectangle(opts.selectedTool);
          $("#removeSelected").removeClass("disabled");

          if (opts.selectedTool.selectionRect.topLeftRect.bounds.contains(event.point)) {
            opts.selectedTool.scalersSelected = "topLeft"
          } else if (opts.selectedTool.selectionRect.bottomRightRect.bounds.contains(event.point)) {
            opts.selectedTool.scalersSelected = "bottomRight"
          } else {
            opts.selectedTool.scalersSelected = false;
          }

          if (opts.selectedTool.selectionRect.removeButton.bounds.contains(event.point)) {
            window.room.removeSelected();
          }
        }
      }

      /* this should be */
      if (opts.tooltype == 'line' || opts.tooltype == 'highligher') {
        this.addHistoryTool();
      }
    },

    onMouseDrag:function (canvas, event) {
      event.point = event.point.transform(new Matrix(1 / opts.currentScale, 0, 0, 1 / opts.currentScale, 0, 0));

      if (opts.tooltype == 'line') {
        opts.tool.add(event.point);
        opts.tool.smooth();
      } else if (opts.tooltype == 'highligher') {
        opts.tool.add(event.point);
        opts.tool.smooth();
      } else if (opts.tooltype == 'circle') {
        var sizes = event.downPoint - event.point;
        var rectangle = new opts.paper.Rectangle(event.point.x, event.point.y, sizes.x, sizes.y);
        this.createTool(new Path.Oval(rectangle));
        opts.tool.removeOnDrag();
      } else if (opts.tooltype == 'rectangle') {
        var sizes = event.downPoint - event.point;
        var rectangle = new opts.paper.Rectangle(event.point.x, event.point.y, sizes.x, sizes.y);
        this.createTool(new opts.paper.Path.Rectangle(rectangle));
        opts.tool.removeOnDrag();
      } else if (opts.tooltype == 'straightline') {
        opts.tool.lastSegment.point = event.point;
      } else if (opts.tooltype == 'arrow') {
        var arrow = opts.tool.arrow;
        arrow.lastSegment.point = event.point;

        var vector = event.point - arrow.lineStart;
        vector = vector.normalize(10);
        var triangle = new opts.paper.Path([
          event.point + vector.rotate(135),
          event.point,
          event.point + vector.rotate(-135)
        ]);
        this.createTool(triangle);

        var arrowGroup = new Group([triangle, arrow]);
        arrowGroup.arrow = arrow;
        opts.tool = arrowGroup;

        triangle.removeOnDrag();
      } else if (opts.tooltype == 'pan') {
        $(opts.paper.project.activeLayer.children).each(function () {
          if (this.translate) {
            this.translate(event.delta);
          }
        })
      } else if (opts.tooltype == 'select') {
        if (opts.selectedTool) {
          if (opts.selectedTool.scalersSelected) {
            var tool = opts.selectedTool;
            var boundingBox = opts.selectedTool.selectionRect;

            // get scale percentages
            var h = tool.bounds.height;
            var w = opts.selectedTool.bounds.width;
            var sx = (w + 2 * event.delta.x) / w;
            var sy = (h + 2 * event.delta.y) / h;

            // scale tool & bounding box
            tool.scale(sx, sy);
            boundingBox.theRect.scale(sx, sy);

            var bx = boundingBox.theRect.bounds.x;
            var by = boundingBox.theRect.bounds.y;
            var bw = boundingBox.theRect.bounds.width;
            var bh = boundingBox.theRect.bounds.height;

            // move bounding box controls
            boundingBox.topLeftRect.position = new Point(bx + bw, by + bh);
            boundingBox.bottomRightRect.position = new Point(bx, by);
            boundingBox.removeButton.position = new Point(bx + bw, by);
          } else {
            opts.selectedTool.translate(event.delta);

            if (opts.selectedTool.selectionRect) {
              opts.selectedTool.selectionRect.translate(event.delta);
            }
          }
        }
      }
    },

    onMouseUp:function (canvas, event) {
      event.point = event.point.transform(new Matrix(1 / opts.currentScale, 0, 0, 1 / opts.currentScale, 0, 0));

      if (opts.tooltype == 'line') {
        opts.tool.add(event.point);
        opts.tool.simplify(10);
      } else if (opts.tooltype == 'highligher') {
        opts.tool.add(event.point);
        opts.tool.simplify(10);
      }

      if (opts.tooltype == 'straightline' || opts.tooltype == 'arrow' ||
        opts.tooltype == 'circle' || opts.tooltype == 'rectangle') {
        this.addHistoryTool();
      }
    },

    // *** Item manipulation ***

    createTool:function (tool, settings) {
      if (!settings) {
        settings = {};
      }

      opts.tool = tool;
      opts.tool.strokeColor = settings.color ? settings.color : opts.color;
      opts.tool.strokeWidth = settings.width ? settings.width : opts.defaultWidth;
      opts.tool.opacity = settings.opacity ? settings.opacity : opts.opacity;
      opts.tool.dashArray = settings.dashArray ? settings.dashArray : undefined;
    },

    setTooltype:function (tooltype) {
      opts.tooltype = tooltype;
    },

    addImg:function (img) {
      window.room.createTool(new opts.paper.Raster(img));
      opts.tool.position = opts.paper.view.center;

      this.addHistoryTool();
    },

    clearCanvas:function () {
      window.room.helper.setOpacityElems(opts.historytools, 0);
      window.room.addHistoryTool(null, "clear");
      this.unselect();

      this.redraw();
    },

    removeSelected:function () {
      if (opts.selectedTool) {
        // add new 'remove' item into history and link it to removed item.
        window.room.addHistoryTool(opts.selectedTool, "remove");
        opts.selectedTool.opacity = 0;

        this.unselect();

        this.redraw();
      }
    },

    unselect:function () {
      if (opts.selectedTool.selectionRect) {
        opts.selectedTool.selectionRect.remove();
      }
      opts.selectedTool = null;
    },

    setCanvasScale:function (scale) {
      var finalScale = scale / opts.currentScale;
      opts.currentScale = scale;

      var transformMatrix = new Matrix(finalScale, 0, 0, finalScale, 0, 0);
      opts.paper.project.activeLayer.transform(transformMatrix);

      this.redraw();
    },

    addCanvasScale:function () {
      var scale = opts.currentScale + 0.1;
      this.setCanvasScale(scale);
    },

    subtractCanvasScale:function () {
      var scale = opts.currentScale - 0.1;
      this.setCanvasScale(scale);
    },

    // *** History, undo & redo ***

    prevhistory:function () {
      if (opts.historyCounter == 0) {
        return;
      }

      $("#redoLink").removeClass("disabled");

      opts.historyCounter = opts.historyCounter - 1;
      var item = opts.historytools[opts.historyCounter];
      if (typeof(item) != 'undefined') {
        executePrevHistory(item);
        this.redraw();
      }

      if (opts.historyCounter == 0) {
        $("#undoLink").addClass("disabled");
      }

      function executePrevHistory(item) {
        if (item.type == "remove") {
          window.room.helper.reverseOpacity(item.tool);
        } else if (item.type == "clear") {
          window.room.helper.setOpacityElems(opts.historytools, 1);
        } else {
          window.room.helper.reverseOpacity(item);
        }
      }
    },

    nexthistory:function () {
      if (opts.historyCounter == opts.historytools.length) {
        return;
      }

      $("#undoLink").removeClass("disabled");

      var item = opts.historytools[opts.historyCounter];
      if (typeof(item) != 'undefined') {
        executeNextHistory(item);

        opts.historyCounter = opts.historyCounter + 1;
        this.redraw();
      }

      if (opts.historyCounter == opts.historytools.length) {
        $("#redoLink").addClass("disabled");
      }

      function executeNextHistory(item) {
        if (item.type == "remove") {
          window.room.helper.reverseOpacity(item.tool);
        } else if (item.type == "clear") {
          window.room.helper.setOpacityElems(opts.historytools, 0);
        } else {
          window.room.helper.reverseOpacity(item);
        }
      }
    },

    getHistoryTools:function () {
      var visibleHistoryTools = new Array();
      $(opts.historytools).each(function () {
        if (!this.type && this.opacity != 0) {
          visibleHistoryTools.push(this);
        }
      });
      return visibleHistoryTools;
    },

    addHistoryTool:function (tool, type) {
      var tool = tool ? tool : opts.tool;
      if (opts.historyCounter != opts.historytools.length) { // rewrite history
        opts.historytools = opts.historytools.slice(0, opts.historyCounter)
      }

      if (type == "remove") {
        opts.historytools.push({tool:tool, type:type});
      } else if (type == "clear") {
        opts.historytools.push({type:type});
      } else {
        opts.historytools.push(tool);
      }

      opts.historyCounter = opts.historytools.length;

      $("#undoLink").removeClass("disabled");
      $("#redoLink").addClass("disabled");
    },

    // *** Misc methods ***

    redraw:function () {
      opts.paper.view.draw()
    }

  };

  var helper = {

    createSelectionRectangle:function (selectedTool) {
      var bounds = selectedTool.bounds;
      var additionalBound = parseInt(selectedTool.strokeWidth / 2);

      var selectionRect = new Path.Rectangle(bounds.x - additionalBound, bounds.y - additionalBound,
        bounds.width + (additionalBound * 2), bounds.height + (additionalBound * 2));

      var selectRectWidth = 8;
      var selectRectHalfWidth = selectRectWidth / 2;
      var topLeftRect = new Path.Rectangle(bounds.x - additionalBound - selectRectHalfWidth,
        bounds.y - additionalBound - selectRectHalfWidth, selectRectWidth, selectRectWidth);
      var bottomRightRect = new Path.Rectangle(bounds.x + bounds.width + additionalBound - selectRectHalfWidth,
        bounds.y + bounds.height + additionalBound - selectRectHalfWidth, selectRectWidth, selectRectWidth);

      var removeButton = new Raster("removeButton");
      removeButton.position = new Point(selectionRect.bounds.x + selectionRect.bounds.width, selectionRect.bounds.y);

      var selectionRectGroup = new Group([selectionRect, topLeftRect, bottomRightRect, removeButton]);

      selectionRectGroup.theRect = selectionRect;
      selectionRectGroup.topLeftRect = topLeftRect;
      selectionRectGroup.bottomRightRect = bottomRightRect;
      selectionRectGroup.removeButton = removeButton;

      window.room.createTool(selectionRect, {color:"skyblue", width:1, opacity:1, dashArray:[3, 3]});
      window.room.createTool(topLeftRect, {color:"blue", width:1, opacity:1});
      window.room.createTool(bottomRightRect, {color:"blue", width:1, opacity:1});
      window.room.createTool(removeButton);

      return selectionRectGroup;
    },

    reverseOpacity:function (elem) {
      if (elem.opacity == 0) {
        elem.opacity = 1;
      } else {
        elem.opacity = 0;
      }
    },

    setOpacityElems:function (elems, opacity) {
      $(elems).each(function () {
        if (this.type == "remove") {
          this.tool.opacity = 0;
        } else if (!this.type) {
          this.opacity = opacity;
        }
      });
    },

    initUploader:function () {
      var uploader = new qq.FileUploader({
        element:$('#file-uploader')[0],
        action:'/file/upload',
        title_uploader:'Upload',
        failed:'Failed',
        multiple:true,
        cancel:'Cancel',
        debug:false,
        params:{'entity':3},
        onSubmit:function (id, fileName) {
          $(uploader._listElement).css('dispaly', '');
        },
        onComplete:function (id, fileName, responseJSON) {
          $(uploader._listElement).css('dispaly', 'none');
          if (responseJSON.fileName) {
            var img = $("<img src=\"/public/images/avatar.png\" width='100' height='100'>");
            $('#curavatardiv').prepend(img);

            window.room.addImg(img[0]);
          }
        }
      });
    }

  };

  window.room = room;
  window.room.helper = helper;
});

$(document).ready(function () {
  window.room.init($("#myCanvas"), {paper:paper});

  // disable canvas text selection for cursor change
  var canvas = $("#myCanvas")[0];
  canvas.onselectstart = function () {
    return false;
  };

  canvas.onmousedown = function () {
    return false;
  };
});

function onMouseDown(event) {
  window.room.onMouseDown($("#myCanvas"), event);
}

function onMouseDrag(event) {
  window.room.onMouseDrag($("#myCanvas"), event);
}

function onMouseUp(event) {
  window.room.onMouseUp($("#myCanvas"), event);
}

function onMouseMove(event) {
  window.room.onMouseMove($("#myCanvas"), event);
}
