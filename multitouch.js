/*
 * Multitouch.js
 * 
 * Written by Ryhan Hassan, rthprog@gmail.com
 * Multitouch grpah manipulation tool
 */

/**
 * @constructor
 * @param {Array} data single dimensional numerical data
 * @param {String} axisTitle description of data
 */
var axisDataGroup = function( data, axisTitle)
{
	this.title = axisTitle;
	this.data = data;
	this.min = _.min(data);
	this.max = _.max(data);

	// construct a normalization function, and normalize data
	var min = this.min,
		diff = this.max - this.min;
	this.normalize = function(v){ return (v - min)/diff; };
	this.normalizedData = _.map( data, this.normalize );
};

/**
 * @constructor
 * @param {Array} dataPoints Array of [x,y] coordinates.
 * @param {String} title description of data point group.
 * @param {String} xAxisTitle description of horizontal axis.
 * @param {String} yAxisTitle description of vertical axis.
 */
var dataPointGroup = function( dataPoints , title, xAxisTitle, yAxisTitle )
{
	// sort the data by the xAxis
	dataPoints = _.sortBy(dataPoints, _.first);

	this.dataPoints = dataPoints;
	this.title = title;
	this.xAxis = new axisDataGroup( _.map(dataPoints, _.first) , xAxisTitle);
	this.yAxis = new axisDataGroup( _.map(dataPoints, _.last ) , yAxisTitle);
};

/**
 * @constructor
 * @param {Array} dataPointGroups Array of dataPointGroup objects.
 * @param {String} title description of chart
 */
var chart = function( dataPointGroups , title)
{
	this.data = dataPointGroups;

	var xAxisGroups = _.pluck(dataPointGroups, 'xAxis');
	this.xAxis = new axisDataGroup( _.flatten(_.pluck(xAxisGroups, 'data')) , xAxisGroups[0].title );

	var yAxisGroups = _.pluck(dataPointGroups, 'yAxis');
	this.yAxis = new axisDataGroup(  _.flatten(_.pluck(yAxisGroups, 'data')) , yAxisGroups[0].title );
};


/**
 * @constructor
 * @param {Array} dataPointGroups Array of dataPointGroup objects.
 * @param {String} title description of chart
 */
var timeSeries = function( dataPointGroups , title)
{
	var height = 200;
	var width = 2000;

	var c = new chart( dataPointGroups, title);

	var scaleX = function(v){ return width *  c.xAxis.normalize(v);};
	var scaleY = function(v){ return height - height * c.yAxis.normalize(v);};

	var organizedData = _.map( dataPointGroups, function(d)
	{
		var normX = _.map(d.xAxis.data, scaleX);
		var normY = _.map(d.yAxis.data, scaleY);
		return {
			title : d.title,
			coor: _.zip(normX, normY)
		}
	});

	this.elems = _.map( organizedData, function(v)
	{
		// Evaluate the d path attribute
		var moveTo = function(a){ return ["L", a[0], a[1]].join(' ');};
		var lineArray = _.map(v.coor, moveTo);
		lineArray = lineArray.concat(_.clone(lineArray).reverse());
		var d = [ 'M', _.first(v.coor)[0], _.first(v.coor)[1], lineArray.join(' '), 'Z'].join(' ');

		return {
			title : v.title,
			d : d
		}
	});
};

function draw( dArray, attr)
{
	// Raw supplied data
	this.dArray = dArray;
	this.attr = attr;

	// Returns true if a value is defined
	var defined = function(v){ return (v!=undefined && v!='');};

	// Define SVG attributes
	this.SVG = {};
	this.SVG.ns 	 = "http://www.w3.org/2000/svg";
	this.SVG.xlinkns = "http://www.w3.org/1999/xlink";
	this.SVG.height  = (defined(attr.height))?  attr.height: 200;
	this.SVG.width   = (defined(attr.width))?   attr.width:  2000;
	this.SVG.bgcolor = (defined(attr.bgcolor))? attr.bgcolor: '#F0F0F0'; 
	this.SVG.fill 	 = 'white';
	this.SVG.stroke  = '#2E61FF';
	this.SVG.strokes =  ['#AAA', '#2059DE', '#0089FF', '#1C34BF'];
	//['#AAA', '#1D76EB','#EB461D', '#EBA61D'];
	//['#222', '#F64D17', '#2E61FF', '#666666', '#EBC51D'];
	this.SVG.weight  = 1;

	// Construct the SVG
	var svg = document.createElementNS(SVG.ns, "svg");
	//svg.style.backgroundColor = this.SVG.bgcolor;
	svg.style.height = this.SVG.height + 'px';
	svg.style.width = this.SVG.width + 'px';

	// Construct the paths
	for(var i=0; i < dArray.length; i++){
		var path = document.createElementNS(SVG.ns, "path");
		path.setAttribute('d', dArray[i]);
		path.setAttribute('fill', this.SVG.fill);
		path.setAttribute('stroke', this.SVG.strokes[i%(this.SVG.strokes.length)]);
		path.setAttribute('stroke-width', this.SVG.weight);
		svg.appendChild(path);
	}

	return svg;
};

function pinchGesture(selector){

	var el = $(selector);
	var startScale = 1;

	return{
		gestureChange: function(e){
			e.preventDefault();
			el.css('-webkit-transform','scale(' + e.scale * startScale + ', 1)');
		},
		gestureEnd: function(e){
			e.preventDefault();
			el.css('-webkit-transform','scale(' + e.scale * startScale + ', 1)');
			startScale *= e.scale;
		}
	}

}

/*
function gestureChange(selector) {

    

    var el = $(selector);

    var startScale = 1;

    return function(e){
    	e.preventDefault();

    }
    var startScale = el[0].getAttribute('data-scale');
    startScale = (startScale != undefined) ? startScale : 1;
    startScale = parseInt(100*startScale * e.scale)/100;
    el.css('-webkit-transform','scale(' + (startScale) + ', 1)');
*/

    /*
    var scale = 
    $('#chart1 svg').css('-webkit-transform','scale(' + e.scale + ', 1)');
    e.target.style.webkitTransform =
        'scale(' + e.scale    + ')';*/
        /*
}

function gestureEnd(e){
	
    var el = $('#chart1 svg');
    var startScale = el[0].getAttribute('data-scale');
    startScale = (startScale != undefined) ? scale : 1;
    startScale = parseInt(100*startScale * e.scale)/100;
    el[0].setAttribute('data-scale', startScale);
    el.css('-webkit-transform','scale(' + startScale + ', 1)');

}
*/