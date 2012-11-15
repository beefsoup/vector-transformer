Template.tweener.rendered = function () {
	var shapes = ["onion","strawberry","artichoke"],	
	  width = 800,
	  height = 600,
	  svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height);
  //It is strange to define a router in a view, but this is a one page view with no meteor level re-rendering.
	var router = Backbone.Router.extend({
		routes: {
			""	: "noshape",
			"*notFound"   : "shape",
		},
		noshape: function() {
			renderNewShape("circle.svg",svg)
		},
		shape: function(shape) {
			var shape = _.find(shapes, function(o){return shape == o}) || "circle";
			renderNewShape( shape + ".svg",svg)
		}
	});

	//make sure links work internally and externally.
	$(window).on("click", "a", function(event) {
		if (!$(this).hasClass("no-link")) {
			Router.navigate($(this).attr('href'), true);
			return false;
		}
	});

	//start the application
	var Router = new router;
	Backbone.history.start({pushState: true});    

	function mapOneToOne(inputs, outputs)
	{
		for(var i = 0; i< inputs.length; i++)
    {
    	d3.select(inputs[i]).call(transition, {path : $(outputs[i]).attr("d")} );
    }
	}

	function renderNewShape ( file, svg ) {
    d3.xml(file, "image/svg+xml", function(xml) {
    	var drawnPaths = d3.selectAll("path")[0],
    	  newPaths = $(xml.documentElement).children("path");
    	if(drawnPaths.length == 0)//there is nothing there, render for the first time
    	{
    		svg.selectAll("path")
    			.data(newPaths)
    			.enter().append("path")
    			.attr("d", function(d){ return $(d).attr("d") } );
    	}
    	else if(drawnPaths.length < newPaths.length)
    		transToMore(drawnPaths,newPaths,svg)
    	else if(drawnPaths.length == newPaths.length)
    		mapOneToOne(drawnPaths,newPaths);
    	else
    		transToLess(drawnPaths,newPaths,svg);
    });
  }

	//THE BULK OF THIS FUNCTION WAS WRITTEN BY MBOSTOCK. I added "finalCondition"
	function pathTween(d1, precision, finalCondition) {
    return function() {
      var path0 = this,
          path1 = path0.cloneNode(),
          n0 = path0.getTotalLength(),
          n1 = (path1.setAttribute("d", d1), path1).getTotalLength();
      // Uniform sampling of distance based on specified precision.
      var distances = [0], 
        i = 0, 
        dt = precision / Math.max(n0, n1);
      while ((i += dt) < 1) distances.push(i);
      distances.push(1);
      // Compute point-interpolators at each distance.
      var points = distances.map(function(t) {
        var p0 = path0.getPointAtLength(t * n0),
            p1 = path1.getPointAtLength(t * n1);
        return d3.interpolate([p0.x, p0.y], [p1.x, p1.y]);
      });
      return function(t) {
        return t < 1 ? "M" + points.map(function(p) { return p(t); }).join("L") : (finalCondition? finalCondition : d1);
      };
    };
  };

  function transition (path, target) {    
	  var t = path.transition()
	    .duration(2000)
	    .attrTween("d", pathTween(target.path, 4, target.finalCondition))
	  if(target.doRemove)
	    t.remove();
	}

	//this function gets a list of paths that are composed of little segments (for tweening)
	function getSubdividedLines(numberToDivide,line)
	{
		var length = line.getTotalLength(),
	  	lengthOfSegment = length/numberToDivide,
	  	resolution = Math.max(2,lengthOfSegment/20),
	  	points, i,
	  	segments = [],
	  	currentLength;//TODO - make this less arbitrary
	  for(i = 0; i < numberToDivide; i++)
	  {
	  	currentLength = i*lengthOfSegment;
	  	points = [ line.getPointAtLength(currentLength ) ];
	  	while(currentLength <= (i+1)*lengthOfSegment)
	  	{
	  		currentLength += resolution;
	  		points.push( line.getPointAtLength(currentLength ) );
	  	}
	  	segments.push({ path : "M" + _.map(points, function(p){ return p.x+","+p.y }).join("L")   } )
	  }	
	  return segments;
	}

	function chopInputPath(node, targetSegments, svg) {
		var segmentedPaths = getSubdividedLines(targetSegments.length,node);
		for(var i = 0; i < segmentedPaths.length; i++)
		{
			 var l = svg.append("path").attr("d", segmentedPaths[i].path);
			l.call(transition,  {path : $(targetSegments[i]).attr("d")} );
		}
		d3.select(node).remove()
    return;
  }

  function getOutputChoppedGrouping (list, numberSegmentsPer)
  {
  	var lines = [];
  	_.each(list, function (l){
  		subdividedLines = getSubdividedLines(numberSegmentsPer, l);  		
  		_.first(subdividedLines).finalCondition = $(l).attr("d") 
  		_.each(_.rest(subdividedLines), function(o) { o.doRemove = true })
  		lines = lines.concat( subdividedLines );
  	});
  	return lines;
  }

  function transToLess (inputs, targets, svg) { //the targets are chopped to match the current. the first path going to the first of the chopped list is transformed into the big one afterwards. the remaining are removed
    inputs = _.sortBy(inputs, function(i) { return i.getTotalLength() }); 
    targets = _.sortBy(targets, function(t) { return -t.getTotalLength(); });
    var numberExtra = inputs.length - targets.length, 
      numberSegmentsPer = Math.floor( inputs.length/targets.length ),
      numberWithOneExtra = inputs.length - targets.length*numberSegmentsPer,
      subdividedLines,
      littleSegments = getOutputChoppedGrouping( _.first(targets,numberWithOneExtra),numberSegmentsPer + 1 ); //these for sure have to be subdivided
    if(numberSegmentsPer > 1) //these might have to be subdivided
    	littleSegments = littleSegments.concat( getOutputChoppedGrouping( _.rest(targets,numberWithOneExtra),numberSegmentsPer ) );
    else //just add the rest
    	littleSegments =  littleSegments.concat( _.map(_.rest(targets,numberWithOneExtra),function (o){ return {path : $(o).attr("d")} }));
    for(i = 0; i<inputs.length; i++)
    {
    	d3.select(inputs[i]).call(transition, littleSegments[i]);
    }
  }

  function transToMore (inputs, targets, svg) { //TODO - make the transition more efficient by calculating distance and location. sort both of them by arc length
    var numberSegmentsPer = Math.floor(targets.length/inputs.length),
      numberWithOneExtraDivision = targets.length - numberSegmentsPer*inputs.length,
      targetIndex = 0, targetsPer = [], targetStop
    for(var i =0; i < numberWithOneExtraDivision; i++)
    {
      targetsPer = [];
      targetStop = targetIndex + numberSegmentsPer + 1;
      for(targetIndex; targetIndex < targetStop; targetIndex++)
      {
        targetsPer.push( targets[targetIndex] );
      }
      chopInputPath( inputs[i],targetsPer,svg);
    }
    for(i = numberWithOneExtraDivision; i < inputs.length; i++)
    {
      targetsPer = [];
      targetStop = targetIndex + numberSegmentsPer;
      for(targetIndex; targetIndex <  targetStop; targetIndex++)
      {
        targetsPer.push( targets[targetIndex] );
      }
      chopInputPath( inputs[i],targetsPer,svg);
    }
  }
}