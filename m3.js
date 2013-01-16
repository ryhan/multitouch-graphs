/*
 * MultiTouch Multiline Models
 * Authored by Ryhan Hassan
 * rhassan@andrew.cmu.edu
 */

/*******************************************************************
 * CONFIGURATION OPTIONS
 * These options must be set before m3 is intitalized,
 * or specifically passed to the m3.Graph constructor.
 *******************************************************************/

// Flag for debugging mode.
var DEVELOPMENT = true;

/**
 * Default configuration options for graphs.
 * You can supply your own when constructing a new Graph().
 */
var DEFAULT_CONFIG = {

	// Contains the entire graph
	container : { width: 650, height: 260 },

	// Region containing graph SVG. Excludes all text.
	gestureR : { width: 570, height: 260 },

	// Areas reserved for axis labels
	xAxis : { width: 900, height: 50},
	yAxis : {width: 80, height: 260 },
	
	// SVG settings
	SVG : {
		ns : "http://www.w3.org/2000/svg",
		xlinkns : "http://www.w3.org/1999/xlink",
		
		fill: 'steelblue',
		stroke: 'steelblue',
		weight: 2,
		
		width: 900,
		height: 260
	}
};

/*******************************************************************
 * DEBUGGING HELPER FUNCTIONS
 * Only in effect if DEVELOPMENT flag is set to true.
 * When in effect, logs warnings and errors in the console.
 *******************************************************************/

// By default, these functions do nothing
var warnIf = function(){},
	assert = function(){},
	typecheck = function(){};

// Override functions when Development flag is raised.
if (DEVELOPMENT){

	/**
	 * @param {Boolean} bool Warning condition.
	 * @param {String} warning Warning message.
	 * Log warning if condition is true.
	 */
	warnIf = function(bool, warning){
			var console = (console || {});
			if (bool){ console.warn(warning); }
		};

	/**
	 * @param {Boolean} bool Assertion condition.
	 * @param {String} message Error message.
	 * Throw error if condition fails.
	 */
	assert = function(bool, message){
			if (!bool){ throw new Error(message);}
		};

	/**
	 * @param v Variable to typecheck.
	 * @param {String} type Type to match against.
	 * @param {String} varName Variable text description for logs.
	 * Throw error if typeof v does not match expected type.
	 */
	typecheck = function(v, type, varName){
			assert((typeof v === type),
				'Expected '+ varName + ' to be ' + type);
		};
}


// Scope to m3 namespace
var m3 = (function () {

/*******************************************************************
 * CONSTRUCTORS
 * Point, Series, and Graph are the core types of objects m3 handles.
 * Graphs are the primary way to interact with m3, and
 * carry detailed configuration objects which are inherited by
 * their child Series and Points.
 *******************************************************************/

/**
 * @constructor
 * @param {Number} x Value along horizontal axis.
 * @param {Number} y Value along vertical axis.
 */
var Point = function( x, y ){
	this.x = (x || 0);
	this.y = (y || 0);

	typecheck(this.x, 'number', 'x');
	typecheck(this.y, 'number', 'y');
	warnIf((x%1 !== 0), 'Expects x to be time - integer ms since epoch');
};

/**
 * @constructor
 * @param {String} name Description of series.
 * @param {Array} points Array of Point objects.
 */
var Series = function( name , points){
	this.name = (name || '');
	this.data = (points || []);

	// Check for common problems
	warnIf((this.data.length === 0), 'Series contains no data points.');
	warnIf((this.data.length === 1), 'Series contains only one data point.');

	// Basic type checks
	typecheck(this.name, 'string', 'name');
	typecheck(this.data, 'object', 'points');
};

/**
 * @constructor
 * @param {String} name Description of graph.
 * @param {Array} seriesSet Array of Series objects.
 * @param {Object} config Configuration object.
 */
var Graph = function( name , seriesSet, config){
	this.name = (name || '');
	this.data = (seriesSet || []);
	this.config = (config || DEFAULT_CONFIG);

	// Checks
	typecheck(this.name, 'string', 'name');
	typecheck(this.data, 'object', 'seriesSet');
	typecheck(this.config, 'object', 'config');
};

 /*******************************************************************
 * RANGE EVALUATION
 * Defines how Point, Series, and Graph evaluate .range(),
 * which should return an object with xMin, xMax, yMin, and yMax.
 * In practice, the results of .range() should be cached.
 *******************************************************************/

/**
 * Base Case
 * @returns {Object} Definitions for xMin, xMax, yMin, yMax.
 */
Point.prototype.range = function(){
	return {
		xMin: this.x, xMax: this.x,
		yMin: this.y, yMax: this.y
	};
};

/**
 * Recursive Case
 * @returns {Object} Definitions for xMin, xMax, yMin, yMax.
 *
 * Instead of rewriting range functions for both Series and Graph,
 * this recursiveRange function calculates range by referring .data,
 * which contains all children. From there, we can recursively call
 * .range() on children and merge the results.
 */
var recursiveRange = function(){
	typecheck(this.data, 'object', 'Object data');
	warnIf((this.data.length === 0), 'Calling .range() on empty data.');

	// Collect the ranges of contained objects
	var ranges = [];
	_.map(this.data, function(d){
		ranges.push(d.range());
	});

	var xMin = _.min(_.pluck(ranges, 'xMin')),
		xMax = _.max(_.pluck(ranges, 'xMax')),
		yMin = _.min(_.pluck(ranges, 'yMin')),
		yMax = _.max(_.pluck(ranges, 'yMax'));

	// Checks
	typecheck(xMin, 'number', 'xmin');
	typecheck(xMax, 'number', 'xmax');
	typecheck(yMin, 'number', 'ymin');
	typecheck(yMax, 'number', 'ymax');

	// Guarantee that the x-axis is always showing.
	yMin = (yMin > 0) ? 0 : yMin;
	yMax = (yMax < 0) ? 0 : yMax;

	// Before returning a range, make sure that it is sensible.
	assert((xMin <= xMax), '(x) Minimum should not exceed maximum.');
	assert((yMin <= yMax), '(y) Minimum should not exceed maximum.');
	
	return {
		xMin: xMin, xMax: xMax,
		yMin: yMin, yMax: yMax
	};
};

Series.prototype.range = recursiveRange;
Graph.prototype.range = recursiveRange;

/*******************************************************************
* SCALE for Graphs
* 2D transformation functions for normalization and scaling.
*******************************************************************/

/**
 * @returns {Object} x and y that scales values to [0, 1]
 * Normalizing functions along x and y axes to [0,1].
 */
Graph.prototype.normalize = function(){
	var r = this.range();

	/**
	 * @param {String} v Variable name
	 * @param {Number} min Minimum bound
	 * @param {Number} max Maximum bound
	 * @returns Normalization function with important checks.
	 */
	var generateNormFunction = function(v, min, max){
		warnIf((min >= max), 'Unexpected normalization bounds.');

		// Checks
		typecheck(min, 'number', 'min');
		typecheck(max, 'number', 'max');

		// k represents some variable passed to a normalization function.
		// v represents the string representation of the variable name.
		return function(k){
			typecheck(k, 'number', v);

			k = (k - min)/(max - min);
			
			// Check if the variable we are testing is within our
			// expected range. If this fails, it is likely that new
			// data is being introduced into the system without rescaling.
			warnIf((0 > k || k > 1), v + ' outside of expected bounds.');
			return k;
		};
	};

	// Construct normalization functions for x and y.
	return {
		x: generateNormFunction('x', r.xMin, r.xMax),
		y: generateNormFunction('y', r.yMin, r.yMax)
	};
};

/**
 * @param {Object} SVG SVG configuration object.
 * @returns {Object} x and y that scales values to SVG height and width.
 * Scaling functions along x and y axes to height and width.
 */
var two_dimensional_scale = function(SVG){
	var norm = this.normalize();
	return {
		x: function(x){ return norm.x(x) * SVG.width;},
		y: function(y){ return SVG.height - (norm.y(y) * SVG.height);}
	};
};

Graph.prototype.scale = two_dimensional_scale;


/*******************************************************************
 * TO STRING
 * Return String representations of Point and Series
 *******************************************************************/

/**
 * @param {Object} scale Scaling transformation object.
 * @returns {String} space delimited x,y string.
 * Return the string representing the x, y coordinate of the point.
 */
Point.prototype.toStr = function(scale){
	typecheck(scale, 'object', 'Scale');
	return scale.x(this.x) + ' ' + scale.y(this.y) + ' ';
};

/**
 * @param {Object} scale Scaling transformation object.
 * @returns {String} Path d attribute string for series.
 * Generate the SVG path d attribute string for a series.
 */
Series.prototype.toStr = function(scale){
	warnIf((this.data.length === 0), 'Calling .toStr() on empty data.');
	warnIf((this.data.length === 1), 'Calling .toStr() on single data point.');
	typecheck(scale, 'object', 'Scale');

	// Sort the series points by date
	var points = _.sortBy(this.data, function(p){return p.x;});
	
	// Set the first component of the substring to be 'M x y '
	var path = ['M ' + points[0].toStr(scale)];
	
	// Add the remaining path moveto substrings.
	_.map(points, function(point){
		path.push('L ' + point.toStr(scale));
	});

	// Concatenate the array with its reverse.
	path = path.concat(path.slice(0).reverse());
	return path.join(' ') + ' Z';
};

/*******************************************************************
* RENDER
* Generate an SVG based on a graph.
*******************************************************************/

/**
 * @param {Object} SVG SVG configuration settings.
 * @param {Object} scale Scaling transformation object.
 * @returns Path element complete with d attribute.
 * Render the SVG path for a series.
 */
Series.prototype.render = function(SVG, scale){
	typecheck(scale, 'object', 'Scale');
	typecheck(SVG, 'object', 'SVG');

	// Create a path element
	var path = document.createElementNS(SVG.ns, "path");

	// Set the path attributes
	path.setAttribute('d', this.toStr(scale));
	path.setAttribute('fill', SVG.fill);
	path.setAttribute('stroke', SVG.stroke);
	path.setAttribute('stroke-width', SVG.weight);

	typecheck(path, 'object', 'path');
	return path;
};

/*
 * @returns SVG element with containing path elements.
 * Generates an SVG element for a graph.
 */
Graph.prototype.render = function(){
	typecheck(this.config.SVG, 'object', 'config.SVG');

	// Create SVG Element.
	var SVG = document.createElementNS(this.config.SVG.ns, "svg");
	SVG.setAttribute('xmlns', this.config.SVG.ns);
	SVG.ns = this.config.SVG.ns;
	SVG.xlinkns = this.config.SVG.xlinkns;
	SVG.style.height = this.config.SVG.height + 'px';
	SVG.style.width = this.config.SVG.width + 'px';

	// Construct scaling transformation functions.
	var scale = this.scale(this.config.SVG);
	var svgConfig = this.config.SVG;
	
	// Generate and append paths.
	_.map(this.data, function(currentSeries){

		// Copy the SVG's default configuration.
		var currentSeriesConfig = svgConfig;

		// Changes to the series-specific Config object
		// should be made here to currentSeriesConfig{}.

		// Render the current path.
		var path = currentSeries.render(currentSeriesConfig, scale);
		SVG.appendChild(path);
	});
	
	typecheck(SVG, 'object', 'SVG');
	return SVG;
};

/*******************************************************************
* LABELS
* Pick the set of text labels based on the graph dimensions.
*******************************************************************/

/**
 * @constructor
 * @param {String} text Label text.
 * @param {Number} x pixel value along horizontal axis.
 * @param {Number} y pixel value along vertical axis.
 */
var Label = function( text, x, y ){
	this.text = text;
	this.x = (x || 0);
	this.y = (y || 0);
};

/**
 * Axis-agnostic label fitting algorithmn with
 * variable bias towards larger/smaller values.
 * BiasLarge=true leads labels to lean towards
 * values further along the axis.
 *
 * @param {Number} blocksize px label size.
 * @param {Number} distance px axis size.
 * @param {Number} unitConversion px length of local meaningful unit.
 * @param {Boolean} biasLarge True sets bias towards larger values.
 * @returns Array of label locations
 */
var labelFit = function(blocksize, distance, unitConversion, biasLarge){
	warnIf((blocksize > distance), 'Axis is too small for blockg.time.');

};

/**
 * Identify a meaningful unit for the y-axis
 * as well as time based on the current graph scale.
 * Handles milliseconds to decades.
 */
Graph.prototype.units = function(){

	// Returns the sum of an array. Handles boolean->integer arithmetic.
	var sum = function(a){return _.reduce(a, function(b,c){return b+c;},0);};
	
	// Calculate the total time elasped in the graph.
	var range = this.range(),
		yRange = range.yMax - range.yMin,
		xRange = range.xMax - range.xMin;

	// Fetch the full pixel width representing the total time.
	var xAxisLength = this.config.xAxis.width,
		yAxisLength = this.config.yAxis.height;

	// The number on ms represented per hundred pixels.
	// As this ratio increases, the unit size should increase.
	var timePerHundredPixels = xRange/xAxisLength * 100;
	var yPerTenPixels = Math.ceil(yRange/yAxisLength *10);

	// An array of unit objects which can be mapped.
	// 'factor' represents number of milliseconds in the unit.
	// 'unit' represents the human-readable representation of the unit.
	var xUnitMap = [
		{factor: 1, unit: 'millisecond'},
		{factr: 1000, unit: 'second'},
		{factor: 60000, unit: 'minute'},
		{factor: 3600000, unit: 'hour'},
		{factor: 86400000, unit: 'day'},
		{factor: 604800000, unit: 'week'},
		{factor: 2592000000, unit: 'month'},	// Assumes 30 days.
		{factor: 31536000000, unit: 'year'},	// Assumes 365 days.
		{factor: 315360000000, unit: 'decade'}	// Assumes 3650 days.
	];

	var yUnitMap =  [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

	// Checks if the unit fits within the axis/pixel ratio.
	var xFits = function(unit){return (timePerHundredPixels>unit.factor);};
	var yFits = function(unit){return (yPerTenPixels>unit);};

	// Finds an appropriate index in unitMap and returns a unit object.
	var xUnit = xUnitMap[sum(_.map(xUnitMap, xFits))];
	var yIndex = sum(_.map(yUnitMap, yFits));
	var yUnit = {
		factor: (yIndex < yUnitMap.length)?yUnitMap[yIndex]:yPerTenPixels,
		unit: ''
	};

	return {x: xUnit, y: yUnit};

};

/**
 * Generates arrays of label objects for the x and y axis.
 */
Graph.prototype.labels = function(){

	var units = this.units();

	var xCoor = labelFit(100,this.config.xAxis.width, units.x.factor, true);
	var yCoor = labelFit(50, this.config.yAxis.height,units.y.factor, false);

	

	return {
		x: xLabels,
		y: yLabels
	};
};

/*******************************************************************
* DOM
* Generate the HTML for a graph.
*******************************************************************/

/**
 * @param {String} myClass
 * @param {Object} config Object with height and width
 * @returns HTML div element with assigned classes, height, and width.
 */
var generateDiv = function(myClass, config){
	var div =  document.createElement('div');
		div.setAttribute('class', myClass);
		div.style.height = config.height + 'px';
		div.style.width = config.width + 'px';
	return div;
};

/**
 * @returns Graph element
 * Generate the html for a graph.
 */
Graph.prototype.constructHTML = function(){

	// Construct our primary Div elements
	var container = generateDiv('m3 m3Container', this.config.container),
		gestureRegion = generateDiv('m3 m3GestureRegion', this.config.gestureR),
		xAxis = generateDiv('m3 m3Axis m3xAxis', this.config.xAxis),
		yAxis = generateDiv('m3 m3Axis m3yAxis', this.config.yAxis);

	// Create a sample label
	function addLabel(text, location){
		var labelA = generateDiv('m3 m3TextLabel', {height: 30, width: 40});
		labelA.innerHTML = text;
		labelA.style.left = location + 'px';
		xAxis.appendChild(labelA);

	}

	addLabel('December', 100);
	addLabel('January', 300);
	addLabel('February', 500);
	addLabel('March', 700);

	function newLabel(text, location){
		var labelA = generateDiv('m3 m3TextLabel', {height: 20, width: 30});
		labelA.innerHTML = text;
		labelA.style.top = location + 'px';
		yAxis.appendChild(labelA);
	}

	newLabel('40', 30);
	newLabel('30', 70);
	newLabel('20', 110);
	newLabel('10', 150)
	newLabel('0',  190);

	/*
	var labelA = generateDiv('m3 m3TextLabel', {height: 80, width: 40});
		labelA.innerHTML = "December 2012";
		labelA.style.left = '200px';
	
	xAxis.appendChild(labelA);
	*/
	gestureRegion.appendChild(this.render());
	gestureRegion.appendChild(xAxis);
	container.appendChild(gestureRegion);
	container.appendChild(yAxis);

	//$(xAxis)[0].innerHTML = 'hi';

	return container;
};


/*******************************************************************
* Public exposed variables, functions, and constructors
*******************************************************************/
	return {

		// Constructors
		Point: Point,
		Series: Series,
		Graph: Graph

	};

})();




// Test
var seriesA = new m3.Series('A',
	[new m3.Point(3,4), new m3.Point(2,8), new m3.Point(5, 10)]);
var seriesB = new m3.Series('B',
	[new m3.Point(1,100), new m3.Point(4,2), new m3.Point(5, 8)]);
	
var g = new m3.Graph('tmp', [seriesA, seriesB]);
	g.constructHTML();

