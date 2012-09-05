/*
	Spec Engine
	v.0.9.1
*/

$(function() {
	// FIRST, need to find the right directory
	// url needs to be in the format of: index.html?DIRECTORYNAME#category -- we're only interested in DIRECTORYNAME
	
	// split into an array: before '?' and after
	var dirname = window.location.href.split('?');
	// if there's an error, show it
	if (dirname.length <= 1) {
		toc();
		return;
	}
	
	// split into an array: before '#' and after
	dirname = dirname[1].split('#');
	
	if (dirname[0].length < 2) {
		toc();
		return;
	}
	
	// set to correct directory
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
	SCALE = 0.34;		// for bird's eye view
	
	// Init Showdown (Markdown parser)
	var converter = new Showdown.converter();


	// Load SPEC.md
	$('#readfile').load(PROJECT.dirname + "SPEC.md", function(response, status, xhr) {
		if (status == 'error') {
			msg('An error occurred whilst loading the file:' + xhr.status + " " + xhr.statusText);
			return;
		}
		
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
				mockups: [],
				num_notes: 0
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
						cat.mockups.push(mock);
					}
					
					// initialize new mock
					mock = {
						title: $(raw_obj).text(),
						desc: '',
						layers: [],
						notes: []
					};
				
				}
				
				// mockup description: <p>
				else if ($(raw_obj).is('p')) {
					mock.desc += '<p>' + $(raw_obj).html() + '</p>';
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

						});
						
					}
					
					// else, assume it's "notes"
					else {
										
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
						});
						
					}
					
				}
				
				else msg('Parser broken at this line: ' + $(raw_obj).text());
				
				raw_obj = raw_array.shift();

			} // end CATEGORY>MOCKUP while-loop
			
			// if mock isn't empty, we need to store it in the category
			if (!_.isEmpty(mock)) {
				cat.mockups.push(mock);
			}
			
			cat.num_notes = noteindex-1;
			CATEGORIES.push(cat);
		}
		
		// === Insert into DOM via traversing global variables ---
		
		// Insert Mockup CSS into <head>
		var css = '';
		var overview_css = '';	// helper string

		_.each(MOCKUPS, function(obj, key) {
		
			// css for regular mockups
			css += '.' + key + ' { background-image: url(' + PROJECT.dirname + obj.file + '); width: ' + obj.width + 'px; height: ' + obj.height + 'px; ';

			// css for #overview
			overview_css = '#overview .' + key + ' { background-image: url(' + PROJECT.dirname + obj.file + '); width: ' + obj.width * SCALE + 'px; height: ' + obj.height * SCALE + 'px; ';
			
			// if top/left are defined...
			if (obj.top) {
				css += 'top: ' + obj.top + 'px; left: ' + obj.left + 'px; ';							// regular
				overview_css += 'top: ' + obj.top * SCALE + 'px; left: ' + obj.left * SCALE + 'px; ';	// #overview
			}
			
			css += '}' + overview_css + '}';
			
		});
		
		// write out css to DOM
		$('<style>' + css + '</style>').appendTo('head');

		// Set Title, Description, and Version
		$('title').html(PROJECT.title);
		$('#project-title').html(PROJECT.title);
		$('#project-description').html(PROJECT.desc);
		$('#version').text(PROJECT.version);
		
		// Cycle through CATEGORIES
		// Default dropdown: include #overview
		var cat_dropdown = '<li><a href="#overview"><span class="title">Overview</span></a></li><li class="divider"></li>';
		_.each(CATEGORIES, function(cat) { 

			// Initialize information about the current category:
			// title, hash, # of mockups, # of notes 
			var overview_info = { 
				title: cat.title,
				hash: cat.hash,
				mockups: cat.mockups.length,
				notes: cat.num_notes
			};

			// Set Dropdown + number of mockups
			var dropdownitem = _.template($('#template-dropdown-item').html());
			cat_dropdown += dropdownitem(overview_info);
			
			// Set Category info into main body
			var template = _.template($('#template-category').html());
			$('#main').append(template(cat));
			
			// Create category div for #overview
			var overview_cat = _.template($('#template-overview-category').html());
			overview_cat = overview_cat(overview_info);

			// Cycle through this category's mockups
			_.each(cat.mockups, function(mock) {
			
				// Set up mockup node -- everything will go inside of this node
				var mock_node = $('<div class="mockup" />');
				var template_mockinfo = _.template($('#template-mockup').html());
				
				// Insert title + description
				mock_node.append(template_mockinfo(mock));
				
				// Cycle through this mockup's layers
				var layers_str = '';
				var baselayer_node;
				_.each(mock.layers, function(layer, index) {
					var div = '<div class="' + layer + '"></div>';
					if (!index) baselayer_node = $(div).addClass('baselayer');
					else layers_str = div + layers_str;	// each successive layer builds "on top" of the other
				}); // end .each(mock.layers)
				
				// Cycle through this mockup's notes
				// Need to accomplish 2 things: (1) fill in sidebar info, and (2) add dot notations to spec

				var notes_node = $('<div class="notes" />');
				var sidebar_node = $('<div class="sidebar" />'); 

				_.each(mock.notes, function(note) {
					
					// append to notation node (for baselayer_node later)
					var template = _.template($('#template-dot').text());
					notes_node.append(template(note));
					
					// append to sidebar node
					template = _.template($('#template-dot-sidebar').html());
					sidebar_node.append(template(note));

				}); // end .each(mock.notes)
				
				// #overview: only care about baselayer + layers
				var overview_baselayer_node = baselayer_node.clone();
				overview_baselayer_node.append(layers_str);
				overview_cat = $(overview_cat).append(overview_baselayer_node);
				
				// regular: add sidebar_node, then add notes, then add layers
				if (sidebar_node) mock_node.find('.mockupinfo').append(sidebar_node.children());
				baselayer_node.append(notes_node.children()).append(layers_str);
				
				// append baselayer to mock_node
				mock_node.append(baselayer_node);
				
				// add mock_node to DOM
				$('#' + cat.hash).append(mock_node);
				
			}); // end .each(cat.mockups)
			
			// add category to #overview dom
			$('#overview').append(overview_cat);
			
		}); // end ._each(CATEGORIES)
		
		$('#cat-dropdown .dropdown-menu').html(cat_dropdown);
		$('.dropdown-toggle').dropdown();	// activate dropdown js
		
		
		/// === Add functionality to Spec elements ===
		
		// Grant functionality to #hidenotes
		$('#hidenotes').click(function(event) {
			event.preventDefault();
			
			// if notes are already hidden
			if ($(this).parent().hasClass('active')) {
				$('.baselayer').removeClass('hidenotes');
				$(this).parent().removeClass('active');
			}
			else {
				$('.baselayer').addClass('hidenotes');
				$(this).parent().addClass('active');
			}
		});
		
		// Grant functionality to category dropdown
		$('.dropdown-menu a').click(function(event) {
			event.preventDefault();
			var hash = $(this).attr('href');			// #somestring
			hash = hash.substring(1);					// somestring
			showCategory(hash);			
		});
		
		// Grant functionality to #overview's category view
		$('.overview-category').click(function() {
			var hash = $(this).attr('data-content');
			showCategory(hash);
		});

		// On load: show the correct category
		var hash = '';
		if (window.location.hash.length > 2) 
			hash = window.location.hash.substring(1);
			
		showCategory(hash);
		
		// Apply cross-illumination of dots
		$('.dot').hover(
			function() { // on hover
				var id = $(this).attr('data-id');
				var cat = getCategory();
				$('#' + cat + ' .mock-' + id).addClass('blue').removeClass('red');
				$('#' + cat + ' .side-' + id).addClass('blue').removeClass('red');
			},
			function () { // out hover
				var cat = getCategory();
				$('#' + cat + ' .dot').removeClass('blue').addClass('red');	
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

// returns current category
function getCategory() {
	var current_cat = PROJECT.current_cat;

	// could still be empty (ie, coming to the page for the first time)
	// pull first category from the list
	// TODO: if empty, should just go to Overview
	if (!current_cat) {
		current_cat = 'overview';
	}
	return current_cat;
}

// logic for showing the right category + hiding the others
function showCategory(show_id) {

	if (!show_id) show_id = getCategory();
	window.location.hash = show_id;
	
	// overview or not?
	if (show_id == 'overview') {
		$('#overview').show();
		$('#main').hide();
	}
	else {
		$('#overview').hide();
		$('#main').show();
		
		$('.category').hide();
		$('#' + show_id).show();		
	}
	
	$('body').scrollTop(0);
	
	// set category in array
	PROJECT.current_cat = show_id;
	
	// set category in dropdown 
	// this is for good measure, as entry point may not have been through the dropdown (eg, through a direct url link)
	var name = $('.dropdown-menu a[href*="#' + show_id + '"]');		// returns array
	if (name.length) {
		name = name[0];
		name = $(name).find('.title').text();
	}
	$('#cat-name').text(name);
	
	// hackish way to close dropdown (wouldn't close on click otherwise)
	$('#cat-dropdown').removeClass('open');	
	
}

// assumes it's an error message (future use: might include other types of messages)
function msg(content) {
	$('#msg').addClass('alert-error').html(content);
	$('title').text('Oops!');
	showOnly('#msg');
}

function toc() {
	// load TOC
	$('#readfile').load('TOC.md', function(response, status, xhr) {
		if (status == 'error') {
			msg('Need to include directory name in the form of: index.html?DIRECTORYNAME (or include a TOC.md file)');
			return;
		}
		
		// Init Showdown (Markdown parser)
		var converter = new Showdown.converter();
		
		// convert spec into HTML, and put it into #toc's <ul>
 		response = converter.makeHtml(response); 
		$('#readfile').html(response);
		
		$('#toc ul').html($('#readfile ul').html());
		$('#toc ul li a').prepend('<i class="icon-chevron-right"></i>');
		
		$('title').text('Projects');
		showOnly('#toc');
	});
}

function showOnly(node) {
	$(node).show();
	$('#overview').hide();
	$('.navbar').hide();
}