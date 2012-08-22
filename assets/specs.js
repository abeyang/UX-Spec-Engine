/*
	Spec Engine
	v.0.4.1 - md => dom optimization halfway complete

*/

$(function() {
	// FIRST, need to find the right directory
	// url needs to be in the format of: index.html?DIRECTORYNAME#category -- we're only interested in DIRECTORYNAME
	var dirname = window.location.href.split('?');
	// if there's an error, show it
	if (dirname.length <= 1) {
		msg('Need to include directory name in the form of: index.html?DIRECTORYNAME');
		return;
	}
	dirname = dirname[1].split('#');
	dirname = '../' + dirname[0] + '/Specs/';
	
	// Init MOCKUPS
	MOCKUPS = {};
	PROJECT = {
		title: '',
		version: '',
		desc: '',
		dirname: dirname
	};
	CATEGORIES = [];
	
	// Init Showdown (Markdown parser)
	var converter = new Showdown.converter();


	// Load SPEC.md
	$('#readfile').load(PROJECT.dirname + "SPEC.md", function(response, status, xhr) {
		// convert spec into HTML
 		response = converter.makeHtml(response); 
		$('#readfile').html(response);
		
		// convert HTML into javascript array
		raw_array = $.makeArray($('#readfile').children());
		
		// grab global variables first (from the end of the file)
		// types of format inside each <li> element:
		// 		@base: base.jpg {770, 1020}
		//		@popover-on: popover-on.png {370, 494} (370, 55)
		
		if ($(raw_array[raw_array.length-2]).is('hr')) {
			raw_obj = raw_array.pop();	// pops off last object from array (<ul>)
			
			$(raw_obj.children).each(function() {
				// remove whitespace first:
				// http://stackoverflow.com/questions/6163169/removing-whitespace-from-string-in-javascript
				var match = $(this).text().replace(/\s+/g, '');

				// extraction:
				// http://stackoverflow.com/questions/6376790/regex-extract-text-between-pattern
				// http://www.rubular.com/r/6pxqOhJNIg
				// 
				// will result in:
				//	[0] @popover-on:popover-on.png{370,494}(370,55)
				//	[1] popover-on
				//	[2] popover-on.png
				//	[3] 370
				//	[4] 494
				//	[5] (370,55) <or undefined>
				match = match.match(/@([^:]+):([^{|^(]+)\{(\d+)\,(\d+)\}(\(\d+\,\d+\))?/);
				
				// set MOCKUPS
				MOCKUPS[match[1]] = {
					file: match[2],
					width: match[3],
					height: match[4]
				};

				// set position, and write out css class accordlingly				
				if (match[5]) {
					setPosition(MOCKUPS[match[1]], match[5]);
				}				
				
			});
						
			raw_array.pop(); // need to pop off/remove 'hr' element
		}

		// set project title		
		raw_obj = raw_array.shift();
		if ($(raw_obj).is('h1')) {
			var title = $(raw_obj).text();
			PROJECT.title = title;			
		}
		else msg('Need to include # Title in the first line');
		
		// set project version and description, if they exist
		raw_obj = raw_array.shift()
		while (!$(raw_obj).is('h2')) {				
			if ($($(raw_obj).html()).is('em')) {
				var version = $(raw_obj).text();
				PROJECT.version = version;
			}
			else {
				PROJECT.desc += $(raw_obj).html();
			}
			raw_obj = raw_array.shift();
		}
		
		// set categories
		// order of operation:
		// 	<h2>
		// 	<p> (optional, and maybe many)
		// 	<h3>
		// 	<p> (optional, and maybe many)
		//	<h4> Layers
		//	<ul>
		//	<h4> Notes (optional)
		//	<ul> (optional)

		while (raw_obj) {
			var cat = {
				title: '',
				hash: '',
				desc: '',
				mockups: []
			};
			
			var mock = {};

			// category title: must be an h2
			if ($(raw_obj).is('h2')) {
				var title = $(raw_obj).text();
				var hash = title.toLowerCase().replace(/\s+/g, '-');	// The Most Exciting Title => the-most-exciting-title
				cat.title = title;
				cat.hash = hash;
								
			}
			else msg('Need to include ## Category Title');
			
			raw_obj = raw_array.shift();
			
			while (!$(raw_obj).is('h3')) {
				cat.desc += $(raw_obj).html();
				raw_obj = raw_array.shift();
			}
			
			// DOM manipulation -- NOT COMPLETE: NEED TO ADD DESCRIPTION
			var template = _.template($('#template-category').html());
			$('#main').append(template(cat));

			
			// noteindex: keeps count of all the notes across multiple mockups within the same category
			noteindex = 1;

			// begin CATEGORY>MOCKUP while-loop
			while (raw_obj && !$(raw_obj).is('h2')) {
				// TODO: this is not bullet-proof:
				//	* doesn't check if there's a title (h3)

				// mockup title: <h3>
				if ($(raw_obj).is('h3')) {
					// if mock isn't empty, we need to store it in the category
					if (!_.isEmpty(mock)) {
						insertMockupstoCategory(cat, mock, baselayer_node, sidebar_node);
					}
					
					// initialize new mock
					mock = {
						title: $(raw_obj).text(),
						desc: '',
						layers: [],
						notes: []
					};
					// initialize new html string and baselayer/sidebar nodes
					// (for layer and notes below)
					html_str = '';
					baselayer_node = '';
					sidebar_node = '';
				
				}
				
				// mockup description: <p>
				else if ($(raw_obj).is('p')) {
					mock.desc += $(raw_obj).html();
				}
				
				// layers or notes: <h4>
				// should always followup with an <ul>
				else if ($(raw_obj).is('h4')) {
					var str = $(raw_obj).text();
					raw_obj = raw_array.shift();	// grab the next object
					
					// if "lay" (as in, "layers")
					if (/lay/i.test(str)) {
						
						$(raw_obj).find('li').each(function(index) {
							var layer_name = $(this).text().substring(1); // remove the '@'
							mock.layers.push(layer_name);	
							
							// DOM manipulation, essentially:
							// <!-- layer[0] = baselayer -->
							// <div class="layer[0]"> 
							//		<div class="layer[n+1]">&nbsp;</div>
							//		<div class="layer[n]">&nbsp;</div>
							//		<div class="layer[3]">&nbsp;</div>
							//		<div class="layer[2]">&nbsp;</div>
							//		<div class="layer[1]">&nbsp;</div>
							// </div>
							var div = '<div class="' + layer_name + '"></div>';
							if (!index) baselayer_node = $(div).addClass('baselayer');
							else html_str = div + html_str;	// each successive layer builds "on top" of the other
						});
						
						baselayer_node.append(html_str);
						
					}
					
					// else, assume it's "notes"
					else {
					
						// create notation node (for mockup layer) and sidebar node
						notes_node = $('<div class="notes" />');
						sidebar_node = $('<div class="sidebar" />'); 
					
						$(raw_obj).find('li').each(function() {
							// split coordinates from sentence:
							// http://www.rubular.com/r/lFBjcaB465
							//
							// will result in:
							//	[0] (10, 30) This is a sentence
							//	[1] (10, 30)
							//	[2] This is a sentence
							var match = $(this).html().match(/(\(\d+\,\s+?\d+\))\s+(.+)/);
							var notation = {
								index: noteindex++,
								content: match[2]
							};
							var pos = match[1].replace(/\s+/g, ''); // remove whitespace
							
							setPosition(notation, pos);
							
							mock.notes.push(notation);
							
							// append to notation node (for baselayer_node later)
							var template = _.template($('#template-dot').text());
							notes_node.append(template(notation));
							
							// append to sidebar node
							template = _.template($('#template-dot-sidebar').html());
							sidebar_node.append(template(notation));
							
						});
						
						// prepend notes_node to baselayer_node
						baselayer_node.prepend(notes_node.children());
					}
					
				}
				
				else msg('Parser broken at this line: ' + $(raw_obj).text());
				
				raw_obj = raw_array.shift();

			} // end CATEGORY>MOCKUP while-loop
			
			// if mock isn't empty, we need to store it in the category
			if (!_.isEmpty(mock)) {
				insertMockupstoCategory(cat, mock, baselayer_node, sidebar_node);
			}
			
			CATEGORIES.push(cat);
		}
		
		// === Insert into DOM via traversing global variables ---
		
		// Insert Mockup CSS into <head>
		var css = '';

		_.each(MOCKUPS, function(obj, key) {
		
			css += '.' + key + ' { background-image: url(' + PROJECT.dirname + obj.file + '); width: ' + obj.width + 'px; height: ' + obj.height + 'px; ';
			
			if (obj.top) {
				// if top/left are defined...
				// TODO: need a case if top/left are NOT defined (0,0)
				css += 'top: ' + obj.top + 'px; left: ' + obj.left + 'px; ';
			}
			
			css += '}';				
			
		});
		
		// write out css to DOM
		$('<style>' + css + '</style>').appendTo('head');

		// Set Title + Version
		$('title').html(PROJECT.title);
		$('#project-title').html(PROJECT.title);
		$('#version').text(PROJECT.version);
		
		// Set Dropdown
		var cat_dropdown = '';
		
		_.each(CATEGORIES, function(obj) { 
			cat_dropdown += '<li><a href="#' + obj.hash + '">' + obj.title + '</a></li>';
		});
		
		$('#cat-dropdown .dropdown-menu').html(cat_dropdown);
		$('.dropdown-toggle').dropdown();	// activate dropdown js
		
		// give category dropdown some functionality
		
		$('.dropdown-menu a').click(function() {
			var hash = $(this).attr('href');			// #string
			hash = hash.substring(1);					// string
			showCategory(hash);			
		});

		
		// Show the correct category
		var hash = '';
		if (window.location.hash.length > 2) 
			hash = window.location.hash.substring(1);
			
		showCategory(hash);
		
		// Apply cross-illumination of dots
		$('.dot').hover(
			function() { // on hover
				var id = $(this).attr('data-id');
				var cat = getCategory();
				$('#' + cat + ' .mock-' + id).addClass('gradientHot');
				$('#' + cat + ' .side-' + id).addClass('gradientHot');
			},
			function () { // out hover
				var cat = getCategory();
				$('#' + cat + ' .dot').removeClass('gradientHot');	
			}
		);
		
	});

});

// assumes that there is a position (x,y), sets obj with the literal {left: x, top: y}
// http://www.rubular.com/r/RTbix6pQg6
function setPosition(obj, position) {
    var match = position.match(/\((\d+)\,(\d+)\)/);
    obj.left = match[1];
    obj.top = match[2];
}

// str: <h1>abcd</h1>
// tag: h1
// result: abcd
// http://www.rubular.com/r/7qSbfWn6SA
function removeBoundingTags(str, tag) {
	var pattern = '/<' + tag + '>(\w+)<\/' + tag + '>';
    var match = str.match(pattern);
    return match[1];
}

// assumes mockup is fully populated and ready to be inserted to category object
// also inserts elements to the DOM, like layer_node (layers of mockups and notations)
function insertMockupstoCategory(category, mockup, layer_node, sidebar_node) {
	category.mockups.push(mockup);
	
	// DOM manipulation
	var template = _.template($('#template-mockup').html());
	var mock_node = $('<div class="mockup" />');

	// Insert title + description, as well as sidebar notations
	mock_node.append(template(mockup));
	if (sidebar_node) mock_node.find('.mockupinfo').append(sidebar_node.children());
	
	// Insert layers + notations (layer_node)
	mock_node.append(layer_node);
	
	// Insert to category div
	$('#' + category.hash).append(mock_node);

}

// returns current category
function getCategory() {
	var current_cat = (PROJECT.current_cat) ? PROJECT.current_cat : $('#cat-dropdown').attr('data-content');

	// could still be empty (ie, coming to the page for the first time)
	// pull first category from the list
	if (!current_cat) {
		current_cat = $('.dropdown-menu a').first().attr('href');
		current_cat = current_cat.substring(1);
	}
	return current_cat;
}

// logic for showing the right category + hiding the others
function showCategory(show_id) {
	if (!show_id) show_id = getCategory();
	$('.category').hide();
	$('#' + show_id).show();
	
	// set category in array
	PROJECT.current_cat = show_id;
	
	// set category in dropdown 
	// this is for good measure, as entry point may not have been through the dropdown (eg, through a direct url link)
	var name = $('.dropdown-menu a[href*="#' + show_id + '"]');		// returns array
	if (name.length) {
		name = name[0];
		name = $(name).text();
	}
	$('#cat-name').text(name);
	
}

// assumes it's an error message (future use: might include other types of messages)
function msg(content) {
	$('#msg').addClass('alert-error').show().html(content);
}