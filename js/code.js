$(function(){
	var settings = {
		numberOfKeys: 88,
		/*
		 * One step from a line to the next space.
		 *
		 * The staff artwork puts its lines 120 units apart in a 1066.201-unit
		 * box, and a step is half that spacing — so the step is exactly
		 * 120/1066.201 em, which is what markerTopEm() places lines, markings
		 * and ledger lines by.
		 *
		 * This was 0.113, that number rounded up. Harmless at the middle line
		 * and cumulative away from it, because a note's offset is the step
		 * times its shift: about 0.05px per step, so a fifth of a pixel at the
		 * bottom staff line but most of a pixel by the sixth ledger line. Since
		 * the lines snap to the device pixel grid and the noteheads do not, a
		 * low or high note visibly missed the line it was sitting on.
		 */
		shiftSize: 120 / 1066.201,
		newNoteInterval: 5000,
		animationStep: 70,
		animationInterval: 20,
		notesPerClef: 10,
		averageAlpha: 0.05
	};
	var symbolTypes = { note: 'note', clef: 'clef' };
	var symbols = {
			/* preserveAspectRatio="none" because callers set an explicit width on
			 * this SVG to size a ledger line. Under the default "meet" that width
			 * becomes the binding constraint, shrinking the whole artwork and
			 * re-centring it vertically — which moved the stroke 5.7px off the
			 * notehead at a 95px staff. The stroke keeps its 1px weight through a
			 * non-uniform scale because of vector-effect="non-scaling-stroke",
			 * and a horizontal rule has no shape to distort. */
			line: '<svg viewBox="0 -470 500 1066.201" preserveAspectRatio="none" shape-rendering="crispEdges">'
			  +'<line vector-effect="non-scaling-stroke" stroke="black" stroke-width="1" x1="0" x2="500" y1="0" y2="0" />'
			  +'</svg>',
			clefs: {
				treble: '<svg viewBox="-1447.331 -156.776 288.38 1066.201">'
					+'<path d="M-1158.951,433.38c0,25.182-6.497,47.303-19.485,66.385c-13.002,19.089-31.472,33.093-55.423,42.02'
					+'c0.81,4.473,5.072,23.954,12.791,58.466c5.27,23.952,7.917,43.851,7.917,59.687c0,23.949-8.433,43.545-25.276,58.768'
					+'c-16.851,15.228-37.254,22.84-61.205,22.84c-21.526,0-40.604-6.093-57.248-18.271c-17.871-12.998-26.797-29.841-26.797-50.549'
					+'c0-13.809,4.664-26.702,14.006-38.672c9.338-11.981,20.498-17.965,33.495-17.965c12.99,0,23.849,4.873,32.583,14.615'
					+'c8.726,9.744,13.096,21.105,13.096,34.103c0,13.801-4.472,24.365-13.397,31.671c-8.938,7.31-20.309,10.962-34.107,10.962'
					+'c7.707,12.18,20.708,18.271,38.977,18.271c22.323,0,39.483-6.909,51.462-20.703c11.973-13.812,17.966-32.08,17.966-54.812'
					+'c0-14.221-2.438-31.473-7.307-51.768c-4.064-17.053-8.128-33.904-12.18-50.549c-12.18,2.845-24.773,4.261-37.761,4.261'
					+'c-44.668,0-82.625-17.052-113.886-51.155c-31.269-34.107-46.894-73.484-46.894-118.152c0-36.939,14.006-75.106,42.02-114.493'
					+'c15.427-22.736,43.033-53.993,82.826-93.792c-10.152-36.13-15.223-70.234-15.223-102.313c0-25.979,3.655-51.16,10.961-75.52'
					+'c9.338-29.63,22.324-50.946,38.976-63.948c8.53-6.489,14.82-9.743,18.884-9.743c3.651,0,8.525,3.862,14.616,11.573'
					+'c23.543,32.884,35.322,73.901,35.322,123.021c0,73.492-25.38,133.785-76.127,180.876l16.442,79.782'
					+'c8.121-1.618,14.208-2.437,18.273-2.437c30.451,0,55.417,12.391,74.908,37.152C-1167.885,375.322-1158.951,402.123-1158.951,433.38'
					+'z M-1252.132,532.04l-31.059-157.734c-13.399,3.655-24.971,11.479-34.714,23.447c-9.743,11.981-14.617,24.876-14.617,38.67'
					+'c0,11.784,3.656,22.336,10.962,31.672c4.465,6.498,10.965,12.588,19.49,18.271c6.897,5.282,10.354,8.327,10.354,9.137'
					+'c0,1.218-1.627,2.035-4.874,2.438c-18.271-4.467-33.4-14.211-45.37-29.234c-11.981-15.017-17.965-32.071-17.965-51.161'
					+'c0-20.294,6.183-39.48,18.573-57.55c12.382-18.06,27.911-30.757,46.588-38.063l-13.398-71.258'
					+'c-71.056,58.467-106.575,115.715-106.575,171.746c0,32.486,12.581,60.094,37.758,82.825c23.952,22.333,52.375,33.495,85.263,33.495'
					+'C-1281.972,538.739-1268.784,536.514-1252.132,532.04z M-1237.516,30.82c0-24.76-7.715-37.151-23.14-37.151'
					+'c-18.273,0-33.298,15.835-45.069,47.505c-9.342,24.769-14.005,48.319-14.005,70.643c0,18.681,3.242,35.734,9.744,51.161'
					+'c17.053-10.553,33.392-30.146,49.024-58.772C-1245.338,75.583-1237.516,51.124-1237.516,30.82z M-1191.229,446.171'
					+'c0-19.892-7.822-37.151-23.447-51.768c-15.637-14.617-33.603-21.923-53.899-21.923l31.059,154.687'
					+'C-1206.663,514.592-1191.229,487.584-1191.229,446.171z"/>'
					+'</svg>',
				bass: '<svg viewBox="-1846.636 -156.776 359 1066.201">'
					+'<path d="M-1574.669,213.475c0,71.723-31.834,136.994-95.49,195.818c-50.767,47.14-109.599,81.195-176.477,102.14'
					+'c70.108-50.768,118.247-93.876,144.446-129.338c37.064-50.766,55.604-113.017,55.604-186.751c0-64.46-24.99-96.7-74.945-96.7'
					+'c-39.888,0-69.907,17.132-90.052,51.373c15.309-8.054,29.408-12.087,42.307-12.087c15.309,0,26.895,5.345,34.753,16.018'
					+'c7.857,10.676,11.784,24.079,11.784,40.187c0,16.526-5.439,29.22-16.317,38.077c-10.877,8.87-24.58,13.296-41.098,13.296'
					+'c-18.132,0-32.543-5.136-43.212-15.411c-10.681-10.275-16.017-24.674-16.017-43.212c0-36.658,13.693-64.264,41.097-82.798'
					+'c22.969-15.308,53.386-22.969,91.261-22.969c39.483,0,71.412,11.89,95.794,35.659'
					+'C-1586.862,140.556-1574.669,172.783-1574.669,213.475z M-1487.637,134.301c0,19.341-9.473,29.01-28.408,29.01'
					+'c-18.538,0-27.8-9.865-27.8-29.612c0-8.464,2.72-15.309,8.159-20.551c5.438-5.23,12.391-7.856,20.85-7.856'
					+'c7.648,0,14.1,2.823,19.342,8.463C-1490.264,119.402-1487.637,126.247-1487.637,134.301z M-1487.637,250.343'
					+'c0,19.338-9.066,29.01-27.199,29.01c-19.337,0-29.009-9.672-29.009-29.01c0-19.342,9.672-29.011,29.009-29.011'
					+'c7.256,0,13.599,2.927,19.038,8.764C-1490.357,235.94-1487.637,242.694-1487.637,250.343z"/>'
					+'</svg>',
				alto: '<svg viewBox="-2633.196 -156.776 321.431 1066.201">'
					+'<path fill-rule="evenodd" clip-rule="evenodd" d="M-2614.821,80.247c13.801,0,27.603,0,41.403,0'
					+'c1.907,0.431,4.282,0.092,5.145,1.959c1.051,2.276,0.49,11.324,0.49,13.965c0,34.331,0.245,70.368,0.245,102.652'
					+'c0,113.151,0,225.14,0,338.09c0,9.041,1.758,15.36-5.39,15.926c-12.375,0.977-31.301,0.561-45.323,0'
					+'c-5.5-0.22-12.154,0.611-13.965-1.471c-1.43-1.643-0.979-9.099-0.979-14.455c0-148.123,0-293.639,0-440.987'
					+'c0-6.022-1.001-14.016,1.959-15.19C-2626.331,80.006-2619.725,80.978-2614.821,80.247z"/>'
					+'<path fill-rule="evenodd" clip-rule="evenodd" d="M-2543.529,80.247c3.512,0,7.024,0,10.535,0c5.34-0.189,3.921,7.761,3.921,14.454'
					+'c0,69.755,0.477,143.055,0.734,211.674c0.987,0.251,1.468-0.935,1.959-1.47c18.15-19.746,33.507-44.965,36.75-80.357'
					+'c0.477-5.211-0.485-12.599,1.47-15.68c1.449-2.284,5.649-2.81,8.085-1.715c3.679,1.654,3.593,5.366,3.92,11.27'
					+'c0.748,13.512,4.821,26.091,9.799,35.034c7.356,13.214,15.716,22.465,32.094,27.684c17.668,5.63,37.292,0.192,46.549-9.063'
					+'c9.994-9.995,14.004-26.419,15.679-44.1c1.726-18.202,1.569-39.138,0-58.063c-3.089-37.269-13.261-66.069-45.568-73.988'
					+'c-16.712-4.096-38.174-4.016-42.385,12.495c-0.618,2.422-1.178,5.34-0.735,8.82c0.621,4.86,3.763,8.582,6.371,10.535'
					+'c2.682,2.008,6.384,2.526,9.31,4.409c4.01,2.583,6.799,7.063,7.594,12.74c2.225,15.867-8.291,29.121-19.6,34.79'
					+'c-5.368,2.691-14.038,5.118-23.028,3.43c-13.685-2.57-24.324-12.987-27.93-26.949c-1.846-7.149-0.906-16.706,0.979-24.5'
					+'c3.293-13.603,10.911-25.241,20.825-33.809c9.409-8.131,21.753-15.104,37.974-16.904c16.817-1.868,34.596-0.38,50.714,2.939'
					+'c46.521,9.582,73.732,35.583,82.806,81.583c2.992,15.163,4.13,34.272,0.981,50.468c-5.82,29.936-23.572,50.48-45.569,63.943'
					+'c-11.192,6.851-24.981,12.312-39.934,14.944c-8.411,1.481-17.485,2.618-24.989,1.471c-7.345-1.124-13.544-4.919-19.354-7.84'
					+'c-6.393-3.214-12.477-7.172-20.825-6.125c-7.865,0.987-12.5,5.692-15.189,12.25c-5.185,12.647-4.712,35.638,1.471,46.794'
					+'c4.424,7.982,14.314,12.151,25.969,7.35c4.449-1.833,8.596-4.041,12.74-6.125c4.179-2.102,8.547-4.652,13.229-5.635'
					+'c7.493-1.573,17.77-0.219,24.989,0.98c36.755,6.102,62.928,25.25,78.152,53.163c6.247,11.453,10.714,25.713,11.27,41.159'
					+'c0,2.205,0,4.41,0,6.614c-0.342,10.994-1.671,21.093-3.43,30.135c-8.886,45.71-37.477,71.537-83.542,80.603'
					+'c-16.803,3.306-42.166,5.633-60.023,0.49c-16.737-4.82-29.355-14.622-38.463-27.194c-8.066-11.135-16.45-33.186-8.82-51.203'
					+'c5.998-14.166,21.868-26.564,42.139-21.07c8.252,2.237,14.577,6.89,19.354,13.475c4.342,5.982,9.242,14.854,7.105,25.479'
					+'c-0.92,4.574-3.386,7.488-5.879,9.8c-2.88,2.668-6.82,3.32-10.29,5.635c-5.315,3.544-8.875,11.153-6.371,20.091'
					+'c2.177,7.764,9.1,12.152,15.68,13.719c7.552,1.795,19.301,0.231,26.459-1.472c15.855-3.771,26.624-13.137,33.564-25.479'
					+'c13.429-23.877,14.824-66.757,12.25-103.876c-1.873-27.017-9.078-49.999-32.339-56.104c-7.254-1.904-16.537-3.26-26.704-0.98'
					+'c-15.959,3.579-27.006,14.84-33.565,25.479c-5.773,9.367-9.5,20.127-11.024,33.074c-0.435,3.697,0.204,10.702-1.225,13.72'
					+'c-1.421,3.002-7.244,4.809-10.29,2.204c-2.883-2.464-2.079-10.294-2.45-14.944c-1.363-17.088-5.15-29.829-10.535-42.384'
					+'c-6.175-14.4-15.543-29.49-26.214-39.934c-0.656-0.643-1.512-2.048-1.959-0.979c-0.455,1.089,0.114,4.47,0,6.859'
					+'c-0.118,2.468-0.245,4.901-0.245,6.86c0,66.431,0.515,131.707-0.489,197.464c-0.071,4.587,0.538,11.593-0.981,13.229'
					+'c-1.752,1.889-6.388,1.508-9.064,1.47c-4.15-0.06-6.911-0.362-8.331-2.205c-1.328-1.727-0.979-9.326-0.979-14.454'
					+'c0-147.799,0.246-293.805,0.246-440.008C-2548.183,88.414-2549.718,80.022-2543.529,80.247z"/>'
					+'</svg>',
				tenor: '<svg viewBox="-2239.359 -156.776 321.594 1066.201">'
					+'<path fill-rule="evenodd" clip-rule="evenodd" d="M-2220.821-38.024c13.801,0,27.603,0,41.403,0'
					+'c1.907,0.431,4.282,0.092,5.145,1.959c1.051,2.276,0.49,11.324,0.49,13.965c0,34.331,0.245,70.368,0.245,102.652'
					+'c0,113.151,0,225.14,0,338.09c0,9.041,1.758,15.36-5.39,15.926c-12.375,0.977-31.301,0.561-45.323,0'
					+'c-5.5-0.22-12.154,0.611-13.965-1.471c-1.43-1.643-0.979-9.099-0.979-14.455c0-148.122,0-293.639,0-440.987'
					+'c0-6.022-1.001-14.016,1.959-15.19C-2232.331-38.266-2225.725-37.293-2220.821-38.024z"/>'
					+'<path fill-rule="evenodd" clip-rule="evenodd" d="M-2149.529-38.024c3.512,0,7.024,0,10.535,0c5.34-0.189,3.921,7.761,3.921,14.454'
					+'c0,69.755,0.477,143.055,0.734,211.674c0.987,0.251,1.468-0.935,1.959-1.47c18.15-19.746,33.507-44.965,36.75-80.357'
					+'c0.477-5.211-0.485-12.599,1.47-15.68c1.449-2.284,5.649-2.81,8.085-1.715c3.679,1.654,3.593,5.366,3.92,11.27'
					+'c0.748,13.512,4.821,26.091,9.799,35.034c7.356,13.214,15.716,22.465,32.094,27.684c17.668,5.63,37.292,0.192,46.549-9.063'
					+'c9.994-9.995,14.004-26.419,15.679-44.1c1.726-18.202,1.569-39.138,0-58.063c-3.089-37.269-13.261-66.069-45.568-73.988'
					+'c-16.712-4.096-38.174-4.016-42.385,12.495c-0.618,2.422-1.178,5.34-0.735,8.82c0.621,4.86,3.763,8.582,6.371,10.535'
					+'c2.682,2.008,6.384,2.526,9.31,4.409c4.01,2.583,6.799,7.063,7.594,12.74c2.225,15.867-8.291,29.121-19.6,34.79'
					+'c-5.368,2.691-14.038,5.118-23.028,3.43c-13.685-2.57-24.324-12.987-27.93-26.949c-1.846-7.149-0.906-16.706,0.979-24.5'
					+'c3.293-13.603,10.911-25.241,20.825-33.809c9.409-8.131,21.753-15.104,37.974-16.904c16.817-1.868,34.596-0.38,50.714,2.939'
					+'c46.521,9.582,73.732,35.583,82.806,81.583c2.992,15.163,4.13,34.272,0.981,50.468c-5.82,29.936-23.572,50.48-45.569,63.943'
					+'c-11.192,6.851-24.981,12.312-39.934,14.944c-8.411,1.481-17.485,2.618-24.989,1.471c-7.345-1.124-13.544-4.919-19.354-7.84'
					+'c-6.393-3.214-12.477-7.172-20.825-6.125c-7.865,0.987-12.5,5.692-15.189,12.25c-5.185,12.647-4.712,35.638,1.471,46.794'
					+'c4.424,7.982,14.314,12.151,25.969,7.35c4.449-1.833,8.596-4.041,12.74-6.125c4.179-2.102,8.547-4.652,13.229-5.635'
					+'c7.493-1.573,17.77-0.219,24.989,0.98c36.755,6.102,62.928,25.25,78.152,53.163c6.247,11.453,10.714,25.713,11.27,41.159'
					+'c0,2.205,0,4.41,0,6.614c-0.342,10.994-1.671,21.093-3.43,30.135c-8.886,45.71-37.477,71.537-83.542,80.603'
					+'c-16.803,3.306-42.166,5.633-60.023,0.49c-16.737-4.82-29.355-14.622-38.463-27.194c-8.066-11.135-16.45-33.186-8.82-51.203'
					+'c5.998-14.166,21.868-26.564,42.139-21.07c8.252,2.237,14.577,6.89,19.354,13.475c4.342,5.982,9.242,14.854,7.105,25.479'
					+'c-0.92,4.574-3.386,7.488-5.879,9.8c-2.88,2.668-6.82,3.32-10.29,5.635c-5.315,3.544-8.875,11.153-6.371,20.091'
					+'c2.177,7.764,9.1,12.152,15.68,13.719c7.552,1.795,19.301,0.231,26.459-1.472c15.855-3.771,26.624-13.137,33.564-25.479'
					+'c13.429-23.877,14.824-66.757,12.25-103.877c-1.873-27.016-9.078-49.998-32.339-56.103c-7.254-1.904-16.537-3.26-26.704-0.98'
					+'c-15.959,3.579-27.006,14.84-33.565,25.479c-5.773,9.366-9.5,20.127-11.024,33.074c-0.435,3.697,0.204,10.701-1.225,13.72'
					+'c-1.421,3.002-7.244,4.809-10.29,2.204c-2.883-2.464-2.079-10.295-2.45-14.944c-1.363-17.088-5.15-29.829-10.535-42.384'
					+'c-6.175-14.4-15.543-29.49-26.214-39.934c-0.656-0.643-1.512-2.048-1.959-0.979c-0.455,1.089,0.114,4.47,0,6.859'
					+'c-0.118,2.468-0.245,4.901-0.245,6.86c0,66.43,0.515,131.707-0.489,197.464c-0.071,4.587,0.538,11.593-0.981,13.229'
					+'c-1.752,1.889-6.388,1.508-9.064,1.47c-4.15-0.06-6.911-0.362-8.331-2.205c-1.328-1.727-0.979-9.326-0.979-14.454'
					+'c0-147.799,0.246-293.805,0.246-440.008C-2154.183-29.858-2155.718-38.25-2149.529-38.024z"/>'
					+'</svg>'
			},
			decorators: {
				sharp: '<svg viewBox="-710.378 -156.776 106.368 1066.201">'
					+'<path d="M-604.01,384.593l-23.099,5.473v88.736h-14.585v-85.092l-32.215,8.511v92.385h-13.979v-88.742l-22.489,5.474v-48.625'
					+'l22.489-6.687v-67.468l-22.489,6.081v-47.411l22.489-6.076v-92.385h13.979v88.737l32.215-7.902v-91.779h14.585v88.131l23.099-4.86'
					+'v46.191l-23.099,6.685v67.468l23.099-5.469V384.593z M-641.694,345.088v-68.074l-32.215,7.901v67.464L-641.694,345.088z"/>'
					+'</svg>',
				flat: '<svg viewBox="-430.184 -156.776 96.033 1066.201">'
					+'<path d="M-334.151,291.601c0,16.62-12.563,36.665-37.683,60.172c-19.453,15.803-38.898,31.806-58.35,48.017V121.416h13.981v145.871'
					+'c11.338-10.124,25.527-15.194,42.546-15.194c11.749,0,21.269,3.648,28.566,10.94C-337.8,270.329-334.151,279.854-334.151,291.601z'
					+'M-368.796,292.818c0-15.396-6.484-23.1-19.448-23.1c-12.567,0-21.883,6.29-27.958,18.841v79.625'
					+'C-384.599,342.247-368.796,317.129-368.796,292.818z"/>'
					+'</svg>'
			},
			notes: {
				none: '<svg viewBox="-890.286 -156.776 141.012 1066.201">'
					+'<path d="M-749.274,303.148c0,19.448-10.54,37.082-31.604,52.886c-19.452,14.979-39.313,22.483-59.568,22.483'
					+'c-17.835,0-30.598-4.048-38.294-12.152c-7.7-8.112-11.546-21.073-11.546-38.904c0-20.257,10.532-38.293,31.604-54.098'
					+'c19.452-14.172,39.708-21.271,60.784-21.271c17.828,0,30.392,4.055,37.685,12.16C-752.917,272.356-749.274,285.324-749.274,303.148'
					+'z M-763.861,280.056c0-6.479-4.663-9.729-13.979-9.729c-14.996,0-35.054,9.523-60.174,28.566'
					+'c-25.132,19.044-37.684,35.656-37.684,49.844c0,6.884,4.044,10.331,12.156,10.331c16.2,0,36.868-9.423,61.997-28.262'
					+'C-776.426,311.96-763.861,295.051-763.861,280.056z"/>'
					+'</svg>',
				natural: '<svg viewBox="-997.866 -156.776 248.592 1066.201">'
					+'<path d="M-997.866,415.594V114.729h14.587v117.912l79.018-20.665v302.082h-15.197V396.142L-997.866,415.594z M-983.279,286.132'
					+'v71.718l63.82-16.41v-71.721L-983.279,286.132z"/>'
					+'<path d="M-749.274,303.148c0,19.448-10.54,37.082-31.604,52.886c-19.452,14.979-39.313,22.483-59.568,22.483'
					+'c-17.835,0-30.598-4.048-38.294-12.152c-7.7-8.112-11.546-21.073-11.546-38.904c0-20.257,10.532-38.293,31.604-54.098'
					+'c19.452-14.172,39.708-21.271,60.784-21.271c17.828,0,30.392,4.055,37.685,12.16C-752.917,272.356-749.274,285.324-749.274,303.148'
					+'z M-763.861,280.056c0-6.479-4.663-9.729-13.979-9.729c-14.996,0-35.054,9.523-60.174,28.566'
					+'c-25.132,19.044-37.684,35.656-37.684,49.844c0,6.884,4.044,10.331,12.156,10.331c16.2,0,36.868-9.423,61.997-28.262'
					+'C-776.426,311.96-763.861,295.051-763.861,280.056z"/>'
					+'</svg>',
				sharp: '<svg viewBox="-710.378 -156.776 261.355 1066.201">'
					+'<path d="M-604.01,384.593l-23.099,5.473v88.736h-14.585v-85.092l-32.215,8.511v92.385h-13.979v-88.742l-22.489,5.474v-48.625'
					+'l22.489-6.687v-67.468l-22.489,6.081v-47.411l22.489-6.076v-92.385h13.979v88.737l32.215-7.902v-91.779h14.585v88.131l23.099-4.86'
					+'v46.191l-23.099,6.685v67.468l23.099-5.469V384.593z M-641.694,345.088v-68.074l-32.215,7.901v67.464L-641.694,345.088z"/>'
					+'<path d="M-449.022,303.148c0,19.447-10.54,37.081-31.604,52.885c-19.452,14.98-39.313,22.483-59.568,22.483'
					+'c-17.835,0-30.598-4.048-38.294-12.152c-7.7-8.112-11.546-21.073-11.546-38.904c0-20.257,10.532-38.294,31.604-54.098'
					+'c19.452-14.172,39.708-21.271,60.784-21.271c17.828,0,30.392,4.055,37.685,12.16C-452.666,272.355-449.022,285.324-449.022,303.148'
					+'z M-463.61,280.057c0-6.48-4.663-9.729-13.979-9.729c-14.996,0-35.054,9.522-60.174,28.566'
					+'c-25.132,19.044-37.684,35.656-37.684,49.844c0,6.884,4.044,10.33,12.156,10.33c16.2,0,36.868-9.423,61.997-28.262'
					+'C-476.174,311.961-463.61,295.051-463.61,280.057z"/>'
					+'</svg>',
				flat: '<svg viewBox="-430.184 -156.776 251.017 1066.201">'
					+'<path d="M-334.151,291.601c0,16.62-12.563,36.665-37.683,60.172c-19.453,15.803-38.898,31.806-58.35,48.017V121.416h13.981v145.871'
					+'c11.338-10.124,25.527-15.194,42.546-15.194c11.749,0,21.269,3.648,28.566,10.94C-337.8,270.329-334.151,279.854-334.151,291.601z'
					+'M-368.796,292.818c0-15.396-6.484-23.1-19.448-23.1c-12.567,0-21.883,6.29-27.958,18.841v79.625'
					+'C-384.599,342.247-368.796,317.129-368.796,292.818z"/>'
					+'<path d="M-179.167,303.148c0,19.447-10.54,37.081-31.604,52.885c-19.452,14.98-39.313,22.483-59.568,22.483'
					+'c-17.835,0-30.598-4.048-38.294-12.152c-7.7-8.112-11.546-21.073-11.546-38.904c0-20.257,10.532-38.294,31.604-54.098'
					+'c19.452-14.172,39.708-21.271,60.784-21.271c17.828,0,30.392,4.055,37.685,12.16C-182.811,272.355-179.167,285.324-179.167,303.148'
					+'z M-193.754,280.057c0-6.48-4.663-9.729-13.979-9.729c-14.996,0-35.054,9.522-60.174,28.566'
					+'c-25.132,19.044-37.684,35.656-37.684,49.844c0,6.884,4.044,10.33,12.156,10.33c16.2,0,36.868-9.423,61.997-28.262'
					+'C-206.319,311.961-193.754,295.051-193.754,280.057z"/>'
					+'</svg>'
			}
	};
	var decorators = { sharp: 'sharp', flat: 'flat', natural: 'natural', none: 'none' };
	var clefs = {
		treble: {
			id: 'treble',
			shift: 0,
			keys: {
				sharp: [
			        {shift: 1},
			        {shift: 2},
			        {shift: 3},
			        {shift: 4},
			        {shift: 5},
			        {shift: -1},
			        {}
				],
				flat: [
				    {shift: 1},
				    {shift: 2},
				    {shift: 3},
				    {},
				    {shift: -2},
				    {shift: -1},
				    {shift: 0}
				]
			}
		},
		bass: {
			id: 'bass',
			shift: 12,
			keys: {
				sharp: [
			        {shift: -1},
			        {shift: 0},
			        {shift: 1},
			        {shift: 2},
			        {shift: 3},
			        {shift: -3},
			        {}
				],
				flat: [
				    {shift: -1},
				    {shift: 0},
				    {shift: 1},
				    {},
				    {shift: -4},
				    {shift: -3},
				    {shift: -2}
				]
			}
		},
		alto: {
			id: 'alto',
			shift: 6,
			keys: {
				sharp: [
			        {shift: 0},
			        {shift: 1},
			        {shift: 2},
			        {shift: 3},
			        {shift: 4},
			        {shift: -2},
			        {}
				],
				flat: [
				    {shift: 0},
				    {shift: 1},
				    {shift: 2},
				    {},
				    {shift: -3},
				    {shift: -2},
				    {shift: -1}
				]
			}
		},
		tenor: {
			id: 'tenor',
			shift: 8,
			keys: {
				sharp: [
			        {shift: 2},
			        {shift: 3},
			        {shift: 4},
			        {shift: 5},
			        {shift: 6},
			        {shift: 0},
			        {}
				],
				flat: [
				    {shift: 2},
				    {shift: 3},
				    {shift: 4},
				    {},
				    {shift: -1},
				    {shift: 0},
				    {shift: 1}
				]
			}
		}
	};
	var keys = {
            C: {decorator: decorators.sharp, lines: []},
			G: {decorator: decorators.sharp, lines: [3]},
			D: {decorator: decorators.sharp, lines: [3, 0]},
			A: {decorator: decorators.sharp, lines: [3, 0, 4]},
			E: {decorator: decorators.sharp, lines: [3, 0, 4, 1]},
			B: {decorator: decorators.sharp, lines: [3, 0, 4, 1, 5]},
			Fsharp: {decorator: decorators.sharp, lines: [3, 0, 4, 1, 5, 2]},
			F: {decorator: decorators.flat, lines: [6]},
			Bflat: {decorator: decorators.flat, lines: [6, 2]},
			Eflat: {decorator: decorators.flat, lines: [6, 2, 5]},
			Aflat: {decorator: decorators.flat, lines: [6, 2, 5, 1]},
			Dflat: {decorator: decorators.flat, lines: [6, 2, 5, 1, 4]},
			Gflat: {decorator: decorators.flat, lines: [6, 2, 5, 1, 4, 0]}
	};
	var staffs = {
	    staff1: {id: 'staff1'},
	    staff2: {id: 'staff2'}
	};
	var clefSets = {
	    both: {staff1: 'treble', staff2: 'bass'},
	    treble: {staff1: 'treble', staff2: 'treble'},
	    bass: {staff1: 'bass', staff2: 'bass'},
	    alto: {staff1: 'alto'},
	    tenor: {staff1: 'tenor'}
	};
	var intervals = {
		unison: {shift: 0, offset: 0},
		minorSecond: {shift: 1, offset: 1},
		majorSecond: {shift: 1, offset: 2},
		minorThird: {shift: 2, offset: 3},
		majorThird: {shift: 2, offset: 4},
		fourth: {shift: 3, offset: 5},
		augmentedFourth: {shift: 3, offset: 6},
		diminishedFifth: {shift: 4, offset: 6},
		fifth: {shift: 4, offset: 7},
		minorSixth: {shift: 5, offset: 8},
		majorSixth: {shift: 5, offset: 9},
		minorSeventh: {shift: 6, offset: 10},
		majorSeventh: {shift: 6, offset: 11},
		octave: {shift: 7, offset: 12}
	};
	var	schemas = {
		intervals: {
			unison: {intervals: [intervals.unison]},
			minorSecond: {intervals: [intervals.unison, intervals.minorSecond]},
			majorSecond: {intervals: [intervals.unison, intervals.majorSecond]},
			minorThird: {intervals: [intervals.unison, intervals.minorThird]},
			majorThird: {intervals: [intervals.unison, intervals.majorThird]},
			fourth: {intervals: [intervals.unison, intervals.fourth]},
			augmentedFourth: {intervals: [intervals.unison, intervals.augmentedFourth]},
			diminishedFifth: {intervals: [intervals.unison, intervals.diminishedFifth]},
			fifth: {intervals: [intervals.unison, intervals.fifth]},
			minorSixth: {intervals: [intervals.unison, intervals.minorSixth]},
			majorSixth: {intervals: [intervals.unison, intervals.majorSixth]},
			minorSeventh: {intervals: [intervals.unison, intervals.minorSeventh]},
			majorSeventh: {intervals: [intervals.unison, intervals.majorSeventh]},
			octave: {intervals: [intervals.unison, intervals.octave]}
		},
		chords: {
			major:  {intervals: [intervals.unison, intervals.majorThird, intervals.fifth]},
			minor:  {intervals: [intervals.unison, intervals.minorThird, intervals.fifth]}
		}
	};
	var levels = {
		beginner1: {
			name: 'Beginner 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.treble],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: false
		},
		beginner2: {
			name: 'Beginner 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.treble],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: false, shiftsOdd: true
		},
		beginner3: {
			name: 'Beginner 3',
			staffs: [staffs.staff1],
			clefSets: [clefSets.treble],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: true
		},
		beginner4: {
			name: 'Beginner 4',
			staffs: [staffs.staff2],
			clefSets: [clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: false
		},
		beginner5: {
			name: 'Beginner 5',
			staffs: [staffs.staff2],
			clefSets: [clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: false, shiftsOdd: true
		},
		beginner6: {
			name: 'Beginner 6',
			staffs: [staffs.staff2],
			clefSets: [clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: true
		},
		beginner7: {
			name: 'Beginner 7',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: true
		},
		intermediate1: {
			name: 'Intermediate 1',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: true, shiftsOdd: false
		},
		intermediate2: {
			name: 'Intermediate 2',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: false, shiftsOdd: true
		},
		intermediate3: {
			name: 'Intermediate 3',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: true, shiftsOdd: true
		},
		intermediate4: {
			name: 'Intermediate 4',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: false
		},
		intermediate5: {
			name: 'Intermediate 5',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: false, shiftsOdd: true
		},
		intermediate6: {
			name: 'Intermediate 6',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced1: {
			name: 'Advanced 1',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced2: {
			name: 'Advanced 2',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced3: {
			name: 'Advanced 3',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced4: {
			name: 'Advanced 4',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced5: {
			name: 'Advanced 5',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced6: {
			name: 'Advanced 6',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		advanced7: {
			name: 'Advanced 7',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat, keys.Fsharp, keys.Gflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		intervals_beginner1: {
			name: 'Intervals Beginner 1 (beta)',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.minorSecond, schemas.intervals.majorSecond, schemas.intervals.minorThird,
			          schemas.intervals.majorThird],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: true
		},
		intervals_beginner2: {
			name: 'Intervals Beginner 2 (beta)',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.minorSecond, schemas.intervals.majorSecond, schemas.intervals.minorThird,
			          schemas.intervals.majorThird, schemas.intervals.fourth, schemas.intervals.augmentedFourth,
			          schemas.intervals.diminishedFifth, schemas.intervals.fifth],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: true, shiftsOdd: true
		},
		intervals_beginner3: {
			name: 'Intervals Beginner 3 (beta)',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.minorSecond, schemas.intervals.majorSecond, schemas.intervals.minorThird,
			          schemas.intervals.majorThird, schemas.intervals.fourth, schemas.intervals.augmentedFourth,
			          schemas.intervals.diminishedFifth, schemas.intervals.fifth, schemas.intervals.minorSixth,
			          schemas.intervals.majorSixth, schemas.intervals.minorSeventh, schemas.intervals.majorSeventh,
			          schemas.intervals.octave],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: true, shiftsOdd: true
		},
		intervals_intermediate1: {
			name: 'Intervals Intermediate 1 (beta)',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.minorSecond, schemas.intervals.majorSecond, schemas.intervals.minorThird,
			          schemas.intervals.majorThird, schemas.intervals.fourth, schemas.intervals.augmentedFourth,
			          schemas.intervals.diminishedFifth, schemas.intervals.fifth, schemas.intervals.minorSixth,
			          schemas.intervals.majorSixth, schemas.intervals.minorSeventh, schemas.intervals.majorSeventh,
			          schemas.intervals.octave],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		intervals_intermediate2: {
			name: 'Intervals Intermediate 2 (beta)',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.minorSecond, schemas.intervals.majorSecond, schemas.intervals.minorThird,
			          schemas.intervals.majorThird, schemas.intervals.fourth, schemas.intervals.augmentedFourth,
			          schemas.intervals.diminishedFifth, schemas.intervals.fifth, schemas.intervals.minorSixth,
			          schemas.intervals.majorSixth, schemas.intervals.minorSeventh, schemas.intervals.majorSeventh,
			          schemas.intervals.octave],
			keys: [keys.C],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		intervals_advanced: {
			name: 'Intervals Advanced (beta)',
			staffs: [staffs.staff1, staffs.staff2],
			clefSets: [clefSets.both, clefSets.treble, clefSets.bass],
			schemas: [schemas.intervals.minorSecond, schemas.intervals.majorSecond, schemas.intervals.minorThird,
			          schemas.intervals.majorThird, schemas.intervals.fourth, schemas.intervals.augmentedFourth,
			          schemas.intervals.diminishedFifth, schemas.intervals.fifth, schemas.intervals.minorSixth,
			          schemas.intervals.majorSixth, schemas.intervals.minorSeventh, schemas.intervals.majorSeventh,
			          schemas.intervals.octave],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat, keys.Fsharp, keys.Gflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_beginner1: {
			name: 'Alto Beginner 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: false
		},
		alto_beginner2: {
			name: 'Alto Beginner 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: false, shiftsOdd: true
		},
		alto_beginner3: {
			name: 'Alto Beginner 3',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: true
		},
		alto_intermediate1: {
			name: 'Alto Intermediate 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: true, shiftsOdd: true
		},
		alto_intermediate2: {
			name: 'Alto Intermediate 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced1: {
			name: 'Alto Advanced 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced2: {
			name: 'Alto Advanced 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced3: {
			name: 'Alto Advanced 3',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced4: {
			name: 'Alto Advanced 4',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced5: {
			name: 'Alto Advanced 5',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced6: {
			name: 'Alto Advanced 6',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		alto_advanced7: {
			name: 'Alto Advanced 7',
			staffs: [staffs.staff1],
			clefSets: [clefSets.alto],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat, keys.Fsharp, keys.Gflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_beginner1: {
			name: 'Tenor Beginner 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: false
		},
		tenor_beginner2: {
			name: 'Tenor Beginner 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: false, shiftsOdd: true
		},
		tenor_beginner3: {
			name: 'Tenor Beginner 3',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -4,	shiftTo: 4,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_intermediate1: {
			name: 'Tenor Intermediate 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -8,	shiftTo: 8,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_intermediate2: {
			name: 'Tenor Intermediate 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced1: {
			name: 'Tenor Advanced 1',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced2: {
			name: 'Tenor Advanced 2',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced3: {
			name: 'Tenor Advanced 3',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced4: {
			name: 'Tenor Advanced 4',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced5: {
			name: 'Tenor Advanced 5',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced6: {
			name: 'Tenor Advanced 6',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		},
		tenor_advanced7: {
			name: 'Tenor Advanced 7',
			staffs: [staffs.staff1],
			clefSets: [clefSets.tenor],
			schemas: [schemas.intervals.unison],
			keys: [keys.C, keys.G, keys.F, keys.D, keys.Bflat, keys.A, keys.Eflat, keys.E, keys.Aflat,
			       keys.B, keys.Dflat, keys.Fsharp, keys.Gflat],
			decorators: [decorators.natural, decorators.sharp, decorators.flat],
			shiftFrom: -12,	shiftTo: 12,
			shiftsEven: true, shiftsOdd: true
		}
	};
	var state = {
			level: levels.beginner1,
			noteIndex: 0,
			activeKey: null,
			activeClefSet: null,
			activeNotes: [],
			newNoteInterval: settings.newNoteInterval,
			newNoteHandler: null,
			midiMessages: []
	};
	var defaultStats = {
		averageTime: null,
		numberOfWrongAnswers: 0,
		numberOfCorrectAnswers: 0
	};
	var stats;
	var getShift = function(keyIndex){
		var base = keyIndex - 39;
		var octave = Math.floor(base / 12) * 7;
		var offset = base % 12;
		if (offset < 0)
			offset = offset + 12;
		// 0 - c -> -6
		// 1 - cis, des -> -6
		// 2 - d -> -5
		// 3 - dis, es -> -5
		// 4 - e -> -4
		// 5 - f -> -3
		// 6 - fis, ges -> -3
		// 7 - g -> -2
		// 8 - gis, aes -> -2
		// 9 - a -> -1
		// 10 - ais, bes -> -1 
		// 11 - b -> 0
		if (offset == 0 || offset == 1)
			return octave - 6;
		if (offset == 2 || offset == 3)
			return octave - 5;
		if (offset == 4)
			return octave - 4;
		if (offset == 5 || offset == 6)
			return octave - 3;
		if (offset == 7 || offset == 8)
			return octave - 2;
		if (offset == 9 || offset == 10)
			return octave - 1;
		
		return  octave;
	};
	var getSound = function(keyIndex){
		return keyIndex - 39 + 60;
	};
	var getDecorators = function(keyIndex){
		var octave = keyIndex - 39;
		var offset = octave % 12;
		if (offset < 0)
			offset = offset + 12;
		if (offset == 1 || offset == 3 || offset == 6 || offset == 8 || offset == 10)
			return [{decorator: decorators.sharp, shift: 0}, {decorator: decorators.flat, shift: 1}];
		if (offset == 5)
			return [{decorator: decorators.natural, shift: 0}, {decorator: decorators.sharp, shift: -1}];
		if (offset == 11)
			return [{decorator: decorators.natural, shift: 0}, {decorator: decorators.flat, shift: 1}];
		return [{decorator: decorators.natural, shift: 0}];
	};
	var getLine = function(keyIndex){
		var octave = keyIndex - 39;
		var offset = octave % 12;
		if (offset < 0)
			offset = offset + 12;
		
		if (offset == 0 || offset == 1)
			return 0;
		if (offset == 2 || offset == 3)
			return 1;
		if (offset == 4)
			return 2;
		if (offset == 5 || offset == 6)
			return 3;
		if (offset == 7 || offset == 8)
			return 4;
		if (offset == 9 || offset == 10)
			return 5;
		
		return  6;
	};
	var getName = function(keyIndex, decorator){
		var octave = keyIndex - 39;
		var offset = octave % 12;
		if (offset < 0)
			offset = offset + 12;
		
		if (offset == 0 && decorator == decorators.natural)
			return 'C';
		if (offset == 1)
		{
			if (decorator == decorators.sharp)
				return 'Cis';
			if (decorator == decorators.flat)
				return 'Des';
		}
		if (offset == 2  && decorator == decorators.natural)
			return 'D';
		if (offset == 3)
		{
			if (decorator == decorators.sharp)
				return 'Dis';
			if (decorator == decorators.flat)
				return 'Es';
		}
		if (offset == 4 && decorator == decorators.natural)
			return 'E';
		if (offset == 5 && decorator == decorators.natural)
			return 'F';
		if (offset == 6)
		{
			if (decorator == decorators.sharp)
				return 'Fis';
			if (decorator == decorators.flat)
				return 'Ges';
		}
		if (offset == 7 && decorator == decorators.natural)
			return 'G';
		if (offset == 8)
		{
			if (decorator == decorators.sharp)
				return 'Gis';
			if (decorator == decorators.flat)
				return 'Aes';
		}
		if (offset == 9 && decorator == decorators.natural)
			return 'A';
		if (offset == 10)
		{
			if (decorator == decorators.sharp)
				return 'Ais';
			if (decorator == decorators.flat)
				return 'Bes';
		}
		if (offset == 11 && decorator == decorators.natural)
			return 'B';
	}
	var getClefsForNote = function(noteShift){
		var availableClefs = {};
		Object.keys(clefs).forEach(function(c){
			availableClefs[c] = {shift: noteShift + clefs[c].shift};
		});
		return availableClefs;
	};
	var notes = [];
	for(var i = 0; i < settings.numberOfKeys; i++)
	{
		var shift = getShift(i);
		var sound = getSound(i);
		var decs = getDecorators(i);
		var line = getLine(i);
		decs.forEach(function(d){
			notes.push({index: i,
		    	decorator: d.decorator,
		    	sound: sound,
		    	line: line + d.shift,
		    	name: getName(i, d.decorator),
		    	clefs: getClefsForNote(shift + d.shift)});
		});
	}
	var getRandom = function(from, to){
		return Math.floor(Math.random() * (to - from + 1)) + from;
	};
	var getRandomArrayEl = function(arr){
		return arr[getRandom(0, arr.length - 1)];
	};
	var shuffleArray = function(array) {
	    for (var i = array.length - 1; i > 0; i--) {
	        var j = Math.floor(Math.random() * (i + 1));
	        var temp = array[i];
	        array[i] = array[j];
	        array[j] = temp;
	    }
	    return array;
	};
	/*
	 * Pick the notes for one prompt in one clef: a random schema of the level,
	 * rooted on a random note of the level's pool, spelled against the key.
	 *
	 * `level` and `key` default to the trainer's own, which is the only way it
	 * was ever called. Passing them lets a module ask the same question of the
	 * same level table without touching the trainer's state — the flash cards
	 * draw their prompts from exactly this.
	 */
	var getNotesForClef = function(clef, level, key){
		level = level || state.level;
		key = key || state.activeKey;
		var schema = getRandomArrayEl(level.schemas);
		var availableNotes = shuffleArray(notes.filter(function(n){
			var shift = n.clefs[clef].shift;
			if (shift < level.shiftFrom || shift > level.shiftTo)
				return false;
			var isEven = shift % 2 == 0;
			if ((isEven && !level.shiftsEven) || (!isEven && !level.shiftsOdd))
				return false;
			return level.decorators.includes(n.decorator);
		}));

		var selectedNotes = [];
		var i;
		for (i = 0; i < availableNotes.length; i++)
		{
			var note = availableNotes[i];
			selectedNotes = [];
			var j;
			for (j = 0; j < schema.intervals.length; j++)
			{
				var interval = schema.intervals[j];
				var foundNotes = availableNotes.filter(function(n){
					return n.sound == note.sound + interval.offset
						&& n.clefs[clef].shift == note.clefs[clef].shift + interval.shift;
				});
				if (!foundNotes.length)
					break;
				var n = Object.assign({}, foundNotes[0]);
				var exists = key.lines.includes(n.line);
				if ((exists && key.decorator == n.decorator)
					|| (!exists && n.decorator == decorators.natural))
				{
					n.decorator = decorators.none;
				}
				selectedNotes.push(n);
			}
			if (selectedNotes.length == schema.intervals.length)
				break;
		}
		return selectedNotes;
	};
	var removeSymbolsSet = function(index){
		state.activeNotes[index].symbol.remove();
		state.activeNotes.splice(index, 1);
	};
	var removeAllNotes = function(){
		if (typeof clearPlayedNotes === 'function')
			clearPlayedNotes();
		for (var i = state.activeNotes.length - 1; i >= 0; i--)
			removeSymbolsSet(i);
		state.noteIndex = 0;
		state.activeClefSet = null;
		state.activeKey = null;
		/* The clef itself stays: it is furniture, not one of the notes. */
		updateKeyHint();
	}
	/*
	 * Size a symbol's box to the glyphs it holds — the notehead and any
	 * accidental, but not the ledger lines, which span whatever width the box
	 * ends up with. The span is a difference of positions, so it is the same
	 * wherever the symbol happens to be; the original took the leftmost glyph
	 * as min(0, left), which only gave the right answer because every symbol
	 * was still parked off-screen at -5000px when it was measured.
	 *
	 * Measured from the rendered layout, so it must run with the symbol on
	 * screen: in a hidden pane every glyph reports a width of 0.
	 */
	var measureSymbol = function(note){
		var left = null;
		var right = null;
		$('svg', note.symbol).each(function(){
			if($(this).hasClass('line'))
				return;
			var l = $(this).position().left;
			var r = l + $(this).outerWidth(true);
			left = (left === null) ? l : Math.min(left, l);
			right = (right === null) ? r : Math.max(right, r);
		});
		var width = (left === null) ? 0 : Math.ceil(right - left);
		note.symbol.width(width);
		note.width = 100 * note.symbol.outerWidth();
	};
	/* Symbols appended but not yet measured and queued. */
	var pendingSymbols = 0;
	var addSymbol = function(staffEl, note){
		note.time = 0;
		staffEl.append(note.symbol);
		pendingSymbols++;
		setTimeout(function(){
			pendingSymbols--;
			measureSymbol(note);
			/* Drawn where it starts, now that it is measured. The animation
			 * loop leaves a parked clef alone, so a clef that begins at the
			 * left edge — one created while the staff had no width — would
			 * otherwise keep the stylesheet's off-screen parking position and
			 * never be seen at all. */
			note.symbol.css({left: Math.round(note.position / 100) + 'px'});
			state.activeNotes.push(note);
		}, 10);
	};
	/*
	 * The trainer runs only while its pane is on screen.
	 *
	 * Everything about a symbol is measured from the rendered layout — the
	 * staff's width decides where a note starts, and a glyph's width decides
	 * how wide its box is — and a hidden pane reports 0 for all of it. Left
	 * running behind another tab, the trainer parked clefs at the left edge
	 * without ever drawing them, sized notes to nothing, and missed every one
	 * of them; the invisible clef then surfaced later, sliding out from under
	 * the next clef to arrive. So while the pane is hidden nothing is created
	 * and nothing moves, and the exercise resumes exactly where it was.
	 *
	 * It starts paused: the first clef is created only once the pane is
	 * actually showing, which at page load is after js/htp-panes.js has run.
	 */
	var paused = true;
	var pauseTrainer = function(){
		paused = true;
		/* The hints are the trainer's while it is up; left behind they would
		 * follow you into the next tab and read as part of its exercise. */
		if (window.HTP && window.HTP.keyboard && window.HTP.keyboard.clearHints)
			window.HTP.keyboard.clearHints();
	};
	var resumeTrainer = function(){
		if (!paused)
			return;
		paused = false;
		/* The legend sits beside the parked clef, whose width was 0 while
		 * the pane was hidden. */
		measureClefs();
		applyLineMarkers();
		updateKeyHint();
		/* Nothing on the staff — the pane was hidden when the level was set
		 * up — so start it now rather than waiting out the note interval. */
		if (!state.activeNotes.length && !pendingSymbols)
		{
			clearTimeout(state.newNoteHandler);
			createNewNote();
		}
	};
	/* Optional: space the two staves by the true musical interval between their
	 * clefs instead of the wider gap sheet music conventionally engraves.
	 *
	 * For a given pitch, its staff position in clef c is noteShift + clefs[c].shift
	 * (see getClefsForNote). So two staves become one continuous pitch space when
	 * their boxes are offset by exactly (shiftB - shiftA) * shiftSize em. Each
	 * .staffContainer is one .staff tall (2em), so the correction is that offset
	 * minus 2em, applied as a negative margin on the lower container.
	 *
	 * Only meaningful when the two staves carry different clefs — two treble
	 * staves are independent lines, not a grand staff. */
	/* Landmark line markers, following the piano-roll project's design.
	 *
	 * C, F and G are the landmarks you navigate a staff by. Parity does the
	 * work: on any staff an even `shift` is a line and an odd one is a space,
	 * so each landmark is one or the other and the two can never collide.
	 *   - a landmark on a line  -> a dashed rule along it
	 *   - a landmark in a space -> a filled band covering that space
	 *
	 * Vertical geometry comes from the staff-line background SVG: its viewBox is
	 * "0 -470 10 1066.201" mapped onto the 2em tall .staff box, with staff lines
	 * at svg y = -60 * shift. So a given shift sits at
	 *     top = (940 - 120 * shift) / 1066.201  em
	 * which works out at settings.shiftSize per step, as everywhere else. */
	var MARKER_SHIFT_TOP = 7;      /* highest shift still inside the .staff box */
	var MARKER_SHIFT_BOTTOM = -9;  /* lowest  shift still inside the .staff box */
	
	/*
	 * The staff grid, snapped to whole device pixels.
	 *
	 * The ideal geometry above is fractional, and that is a problem once it is
	 * painted. A staff line is a 1px border and a ledger line is drawn with
	 * shape-rendering:crispEdges — both snap to the device pixel grid, each one
	 * rounding on its own. Ideal spacing of 21.383px came out as 42, 43, 43, 43
	 * device pixels: lines visibly unevenly spaced. A notehead, meanwhile, is an
	 * antialiased path that does NOT snap, so it landed up to half a device pixel
	 * off the line it was supposed to be sitting on.
	 *
	 * Rounding the STEP to a whole number of device pixels fixes both at once:
	 * lines, ledgers and noteheads then all land on the same integer grid, so
	 * spacing is exactly even and a note sits exactly on its line. The cost is a
	 * staff up to a pixel off the ideal height, which nobody can see, for
	 * evenness that everybody can.
	 *
	 * It depends on the staff's font size AND on devicePixelRatio, so it is
	 * recomputed whenever either changes: a resize, a browser zoom, or a move to
	 * a display with a different pixel ratio.
	 */
	var IDEAL_STEP_EM = 120 / 1066.201;    /* one line-to-space step */
	var IDEAL_ORIGIN_EM = 940 / 1066.201;  /* where shift 0 sits     */
	/* Where each artwork draws within its own 2em box: the line SVG puts its
	 * stroke here, the notehead SVG its painted centre. They differ, which is why
	 * a notehead needs a correction a line does not. */
	var LINE_CENTRE_EM = 470 / 1066.201 * 2;
	var NOTEHEAD_CENTRE_EM = (315.305 + 156.776) / 1066.201 * 2;
	
	var grid = { fontPx: 0, dpr: 0, stepEm: IDEAL_STEP_EM, originEm: IDEAL_ORIGIN_EM };
	
	var recomputeGrid = function(){
		var el = $('.staffsContainer')[0];
		var fontPx = el ? parseFloat(window.getComputedStyle(el).fontSize) : 0;
		var dpr = window.devicePixelRatio || 1;
		
		if (!fontPx || !isFinite(fontPx))
			return false;
		if (fontPx === grid.fontPx && dpr === grid.dpr)
			return false;
		
		var devicePxPerEm = fontPx * dpr;
		var stepDevicePx = Math.max(1, Math.round(IDEAL_STEP_EM * devicePxPerEm));
		
		grid = {
			fontPx: fontPx,
			dpr: dpr,
			stepEm: stepDevicePx / devicePxPerEm,
			originEm: Math.round(IDEAL_ORIGIN_EM * devicePxPerEm) / devicePxPerEm
		};
		return true;
	};
	
	/* Where a shift sits, in em from the top of the .staff box. Everything with a
	 * vertical position on a staff goes through this. */
	var markerTopEm = function(shift){
		return grid.originEm - shift * grid.stepEm;
	};
	/* Top offset for an <svg> that draws at `artworkCentreEm` within its own box,
	 * so that what it draws lands on `shift`. */
	var glyphTopEm = function(shift, artworkCentreEm){
		return markerTopEm(shift) - artworkCentreEm;
	};
	/*
	 * Place a glyph on the staff, remembering where it belongs.
	 *
	 * The shift is recorded on the element so the whole staff can be laid out
	 * again from scratch when the grid changes — a note already on screen when
	 * the window is resized moves with everything else instead of being stranded
	 * at a position computed against the old pixel grid.
	 */
	var placeGlyph = function(el, shift, artworkCentreEm){
		return $(el)
			.attr('data-htp-shift', shift)
			.attr('data-htp-artwork', artworkCentreEm)
			.css({top: glyphTopEm(shift, artworkCentreEm) + 'em'});
	};
	/* ----------------------------------------------------------- quarter notes
	 *
	 * The artwork draws a hollow head and no stem, which is a half note. A
	 * quarter note is that same head filled, with a stem. Both are drawn inside
	 * the glyph's own 2em box, in the artwork's own units: 1066.201 units to the
	 * box, 60 to a shift step, the head's painted centre at y 315.305.
	 *
	 * Each glyph carries its own box and is placed by its own shift, so a stem
	 * of a fixed length in artwork units is the same 3.5 spaces wherever the
	 * note sits, and can never be clipped by the box it is drawn in.
	 *
	 * The head is slanted, so its right-hand extremity sits 12.2 units ABOVE
	 * that centre and its left-hand one the same distance below — measured off
	 * the painted path with isPointInFill, not read off the coordinates. A stem
	 * run to the centre would show a stub of bare stem beyond the ink; it stops
	 * at the extremity it hangs from instead.
	 */
	var UNITS_PER_SHIFT = 60;
	var NOTEHEAD_CENTRE_UNITS = 315.305;
	var NOTEHEAD_WIDTH_UNITS = 141.012;
	var NOTEHEAD_TIP_UNITS = 12.2;
	var STEM_LENGTH_UNITS = 7 * UNITS_PER_SHIFT;   /* 3.5 staff spaces */
	var STEM_WIDTH_UNITS = 15;
	var SVG_NS = 'http://www.w3.org/2000/svg';
	
	var quarterNotesOn = function(){
		return !!(window.HTP && window.HTP.settings && window.HTP.settings.quarterNotes);
	};
	/*
	 * Draw one notehead as a quarter note, or put it back to the half note the
	 * artwork draws by default. `up` is the stem direction.
	 *
	 * The head is the LAST <path> of every note glyph — where there is an
	 * accidental it is an earlier path, drawn to the head's left — and it is two
	 * subpaths: the outer oval, and the counter that makes it hollow. Dropping
	 * the counter fills it. The hollow original is kept on the element, so
	 * turning the option off restores it rather than approximating it.
	 */
	var setQuarterNote = function(el, up){
		var svg = $(el);
		var head = svg.find('path').last();
		if (!head.length)
			return;
		
		var hollow = head.attr('data-htp-hollow') || head.attr('d');
		head.attr('data-htp-hollow', hollow);
		svg.find('.htp-stem').remove();
		
		if (!quarterNotesOn())
		{
			head.attr('d', hollow);
			return;
		}
		
		var counter = hollow.indexOf('M', 1);
		head.attr('d', counter > 0 ? hollow.slice(0, counter) : hollow);
		
		/* The head is flush with the right edge of every note glyph's viewBox,
		 * and every glyph is right-aligned within its symbol, so measuring the
		 * stem from that edge puts the stems of a chord on one x. */
		var box = (svg.attr('viewBox') || '').split(/[\s,]+/).map(parseFloat);
		var right = box[0] + box[2];
		var stem = document.createElementNS(SVG_NS, 'rect');
		stem.setAttribute('class', 'htp-stem');
		stem.setAttribute('x', up ? right - STEM_WIDTH_UNITS : right - NOTEHEAD_WIDTH_UNITS);
		stem.setAttribute('width', STEM_WIDTH_UNITS);
		stem.setAttribute('y', up ? NOTEHEAD_CENTRE_UNITS - STEM_LENGTH_UNITS
			: NOTEHEAD_CENTRE_UNITS + NOTEHEAD_TIP_UNITS);
		stem.setAttribute('height', STEM_LENGTH_UNITS - NOTEHEAD_TIP_UNITS);
		svg[0].appendChild(stem);
	};
	/*
	 * Notes struck together share one stem, so the direction belongs to the
	 * symbol rather than to each note: the note farthest from the middle line
	 * chooses it, and a tie — or the middle line itself — takes a stem down.
	 * Each head still draws its own stem, but they sit on one x and meet end to
	 * end, so a chord reads as the single stem it should be.
	 */
	var applyStems = function(glyphs){
		var els = $(glyphs);
		if (!els.length)
			return els;
		
		var shifts = els.map(function(){
			return parseFloat($(this).attr('data-htp-shift'));
		}).get().filter(isFinite);
		var up = shifts.length > 0
			&& (Math.max.apply(null, shifts) + Math.min.apply(null, shifts)) < 0;
		els.each(function(){ setQuarterNote(this, up); });
		return els;
	};
	/*
	 * Redraw the notes already on a staff, so the option takes effect on what is
	 * up now rather than only on the notes drawn after it. It reaches every
	 * staff on the page, a module's as well as the trainer's: a note is a note
	 * on both, and free practice has no reason to keep the old shape.
	 *
	 * A played ghost is not part of the chord it is drawn over, so it picks its
	 * own direction rather than joining the target's.
	 */
	var applyNoteShape = function(){
		$('.symbol.note').each(function(){
			var glyphs = $('svg', this).not('.line');
			applyStems(glyphs.not('.played'));
			glyphs.filter('.played').each(function(){ applyStems(this); });
		});
	};
	var repositionGlyphs = function(){
		$('[data-htp-shift]').each(function(){
			var el = $(this);
			el.css({top: glyphTopEm(parseFloat(el.attr('data-htp-shift')),
				parseFloat(el.attr('data-htp-artwork'))) + 'em'});
		});
	};
	/*
	 * Re-lay-out every staff for the current grid. Cheap enough to run on a
	 * resize: it is a handful of style writes, no DOM rebuilding beyond the
	 * staff lines themselves.
	 */
	var relayoutForGrid = function(){
		$('.staff').each(function(){ renderStaffLines($(this)); });
		repositionGlyphs();
		if (typeof applyStaffSpacing === 'function') applyStaffSpacing();
		/* A symbol's box was sized in px at the old staff size; the legend is
		 * placed from the parked clef's box, so it has to be current. */
		state.activeNotes.forEach(measureSymbol);
		if (state.level)
		{
			measureClefs();
			renderTrainerMarkers();
		}
		if (window.HTP && typeof window.HTP.notifyMarkersChanged === 'function')
			window.HTP.notifyMarkersChanged();
	};
	/*
	 * Watch for anything that changes the grid. A resize covers window changes
	 * and the staff-size control; devicePixelRatio changes on browser zoom and on
	 * a move between displays, and does NOT reliably fire a resize — the only
	 * dependable signal is a media query bound to the current ratio, rebound each
	 * time it trips.
	 */
	var watchGrid = function(){
		var apply = function(){
			if (recomputeGrid())
				relayoutForGrid();
		};
		
		window.addEventListener('resize', apply);
		window.addEventListener('orientationchange', apply);
		
		var query = null;
		var onRatioChange = function(){ apply(); bindRatio(); };
		var bindRatio = function(){
			if (query && query.removeEventListener)
				query.removeEventListener('change', onRatioChange);
			if (!window.matchMedia)
				return;
			query = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
			if (query.addEventListener)
				query.addEventListener('change', onRatioChange);
		};
		bindRatio();
		
		/* The staff size is set from js/htp-panes.js by writing a CSS variable,
		 * which fires no event of its own. */
		if (window.HTP && typeof window.HTP.onSettingChange === 'function')
			window.HTP.onSettingChange(function(key){
				if (key === 'staffSize') setTimeout(apply, 0);
			});
	};
	/*
	 * The legend: the letter of each staff line and space, printed small just
	 * to the right of the clef — E G B D F up the lines of a treble staff, F A
	 * C E up its spaces. Lines and spaces are switched separately, and with
	 * "Colour notes" on the landmark letters take their landmark colour, shaded
	 * by register exactly as the noteheads and the markings are.
	 */
	var STEP_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
	var LEGEND_GAP_EM = 0.05;      /* between the clef and the letters */
	/* One column for the lines and one for the spaces, side by side. A line's
	 * letter and the next space's are only one step apart, and the type is
	 * taller than a step — in a single column they overprint. */
	var LEGEND_COLUMN_EM = 0.24;
	var LEGEND_SHIFT_TOP = 4;      /* the top line; nothing above it   */
	var LEGEND_SHIFT_BOTTOM = -4;  /* the bottom line                  */
	/*
	 * Draw the landmark layer into one staff element for one clef: the rules
	 * and bands, and the legend. Shared by the trainer and by any module that
	 * renders its own staves.
	 *
	 * `clefEl` is the clef symbol the legend sits beside — the parked one, on a
	 * trainer staff. Left out, the staff's own first clef symbol is used; with
	 * no clef on the staff at all there is no legend. The rules and bands run
	 * the full width either way, across the clef as they always have.
	 *
	 * `opts` is for a musically continuous pair of staves, whose boxes overlap
	 * and would otherwise each mark the same positions twice:
	 *   gapBelow  — on the upper staff: how many positions the gap holds (three
	 *               under a treble staff: D4, middle C, B3). The legend and the
	 *               markings run down through the gap and stop there.
	 *   clipAbove — on the lower staff: draw nothing above the top line; the
	 *               gap is the upper staff's.
	 */
	var renderStaffMarkers = function(staffEl, clefId, clefEl, opts){
		$('> .htp-markers', staffEl).remove();

		var options = window.HTP && window.HTP.settings;
		if (!options || !clefId || !clefs[clefId])
			return;
		var markersOn = !!options.lineMarkers;
		var legendOn = !!(options.legendLines || options.legendSpaces);
		if (!markersOn && !legendOn)
			return;

		if (clefEl === undefined)
			clefEl = $('> .symbol.clef', staffEl).first();
		if (!clefEl || !clefEl.length)
			clefEl = null;

		/* Where the clef ends, in px from the staff's left edge. Measured
		 * rather than assumed: a key signature makes the symbol wider. */
		var fontPx = parseFloat(staffEl.css('font-size')) || 0;
		var clefRight = clefEl ? clefEl.position().left + clefEl.outerWidth() : 0;
		var legendLeft = clefRight + LEGEND_GAP_EM * fontPx;
		var legendWidthEm = LEGEND_COLUMN_EM * ((options.legendLines ? 1 : 0) + (options.legendSpaces ? 1 : 0));
		var legend = (legendOn && clefEl)
			? $('<div class="htp-legend"></div>').css({left: legendLeft + 'px', width: legendWidthEm + 'em'})
			: null;
		/* With both on, the lines' letters sit in the right-hand column and the
		 * spaces' in the left, so the eye can follow either set straight down. */
		var linesColumnEm = options.legendSpaces ? LEGEND_COLUMN_EM : 0;
		var gapBelow = (opts && opts.gapBelow > 0) ? opts.gapBelow : 0;
		var legendBottom = LEGEND_SHIFT_BOTTOM - gapBelow;
		var markerTop = (opts && opts.clipAbove) ? LEGEND_SHIFT_TOP : MARKER_SHIFT_TOP;
		var markerBottom = gapBelow ? legendBottom : MARKER_SHIFT_BOTTOM;

		var landmarks = window.HTP.landmarks;
		var clefShift = clefs[clefId].shift;
		var layer = $('<div class="htp-markers"></div>');

		for (var shift = markerBottom; shift <= markerTop; shift++)
		{
			/* Diatonic step and octave of this staff position. C4 is noteShift -6,
			 * and one octave is 7 diatonic steps. */
			var noteShift = shift - clefShift;
			var step = (((noteShift + 6) % 7) + 7) % 7;
			var octave = 4 + Math.floor((noteShift + 6) / 7);
			var onLine = shift % 2 == 0;

			var landmark = null;
			var landmarkName = null;
			Object.keys(landmarks).forEach(function(name){
				if (landmarks[name].step == step && window.HTP.landmarkEnabled(name))
				{
					landmark = landmarks[name];
					landmarkName = name;
				}
			});

			/* Same register shading as the keyboard: darker below middle C,
			 * brighter above it, palette colour in the middle octave. */
			var colour = landmark
				? window.HTP.shade(landmark.colour, window.HTP.octaveShade(octave))
				: null;

			if (legend && shift >= legendBottom && shift <= LEGEND_SHIFT_TOP
				&& (onLine ? options.legendLines : options.legendSpaces))
			{
				/* Two elements: the slot is placed in the staff's own em, the
				 * letter inside it is sized down. One element could not do both,
				 * since its em would be its own shrunken size. */
				var slot = $('<div class="htp-legend__slot"></div>')
					.attr('data-htp-marker-shift', shift)
					.css({top: markerTopEm(shift) + 'em', left: (onLine ? linesColumnEm : 0) + 'em'});
				var letter = $('<span class="htp-legend__letter"></span>').text(STEP_LETTERS[step]);
				if (landmark)
				{
					slot.attr('data-htp-landmark', landmarkName);
					if (options.colourNotes)
						letter.css('color', colour);
				}
				legend.append(slot.append(letter));
			}

			if (!markersOn || !landmark)
				continue;

			if (onLine)
			{
				/* On a line: a dashed rule along it. */
				$('<div class="htp-marker htp-marker--rule"></div>')
					.attr('data-htp-landmark', landmarkName)
					.attr('data-htp-marker-shift', shift)
					.css({top: markerTopEm(shift) + 'em', color: colour})
					.appendTo(layer);
			}
			else
			{
				/* In a space: a band filling it line to line. */
				$('<div class="htp-marker htp-marker--band"></div>')
					.attr('data-htp-landmark', landmarkName)
					.attr('data-htp-marker-shift', shift)
					.css({
						top: markerTopEm(shift + 1) + 'em',
						height: (markerTopEm(shift - 1) - markerTopEm(shift + 1)) + 'em',
						'background-color': colour
					})
					.appendTo(layer);
			}
		}

		if (legend)
			layer.append(legend);
		staffEl.prepend(layer);
	};
	/*
	 * The trainer's own staves follow the clef that is actually parked at the
	 * left, not the one the level has most recently chosen: a clef change
	 * starts with the new clef scrolling in from the right, and the letters
	 * beside the old clef must keep naming the old clef's lines until the new
	 * one has taken its place. Before any clef has parked — after a level
	 * change — the level's clef is all there is to go on.
	 */
	var shownClefOf = function(staff){
		if (staff.shownClefEl && staff.shownClefEl.closest('body').length)
			return {clef: staff.shownClef, el: staff.shownClefEl};
		return {clef: staff.clef, el: null};
	};
	/*
	 * Light up the key the exercise is waiting for, on the on-screen keyboard.
	 * Optional, and off by default: it turns reading into a lookup. What it is
	 * for is the other half of the skill — the note you see and the place your
	 * hand goes — which is hard to practise from a screen alone.
	 */
	var updateKeyHint = function(){
		if (!window.HTP || !window.HTP.keyboard || !window.HTP.keyboard.setHints)
			return;
		if (paused)
			return;
		if (!window.HTP.settings.showKeyHint)
		{
			window.HTP.keyboard.clearHints();
			return;
		}

		var index = findFirstNoteIndex();
		var target = index === null ? null : state.activeNotes[index];
		if (!target || !target.playable || !target.notes)
		{
			window.HTP.keyboard.clearHints();
			return;
		}

		var hints = {};
		target.notes.forEach(function(n){ hints[n.sound] = {target: true}; });
		window.HTP.keyboard.setHints(hints);
	};
	/* How many staff positions lie between two musically continuous staves —
	 * three for treble over bass: D4, C4, B3 — or 0 when the staves are not
	 * continuous. The bottom line of the upper staff is -4 and the top line of
	 * the lower one is +4, so the gap is the clef distance less those eight
	 * positions and the lower line itself. */
	var gapBetween = function(upperClefId, lowerClefId){
		if (!window.HTP || !window.HTP.settings || !window.HTP.settings.musicalClefDistance)
			return 0;
		if (!clefs[upperClefId] || !clefs[lowerClefId] || upperClefId == lowerClefId)
			return 0;
		return Math.max(0, clefs[lowerClefId].shift - clefs[upperClefId].shift - 9);
	};
	/* The options each staff of a pair needs from renderStaffMarkers(): the
	 * upper one owns the gap, the lower one keeps out of it. */
	var pairOptions = function(gap){
		return gap > 0 ? [{gapBelow: gap}, {clipAbove: true}] : [null, null];
	};
	var renderTrainerMarkers = function(){
		var shown = state.level.staffs.map(shownClefOf);
		var pair = pairOptions(shown.length > 1 ? gapBetween(shown[0].clef, shown[1].clef) : 0);
		state.level.staffs.forEach(function(staff, i){
			renderStaffMarkers($('#' + staff.id), shown[i].clef, shown[i].el, pair[i]);
		});
	};
	/*
	 * Draw the five staff lines as elements at the same computed positions the
	 * notes and the landmark markers use.
	 *
	 * The original stylesheet paints them as a tiled background SVG instead. That
	 * looks identical at one size, but the browser rounds a background tile's
	 * dimensions, so the painted lines drift away from the computed geometry as
	 * the staff is resized or the page zoomed — notes stop sitting on their lines
	 * and the landmark rules land slightly off. Drawing them from markerTopEm()
	 * like everything else makes that impossible: one formula, one result, at any
	 * size. css/htp.css turns the background off.
	 */
	var STAFF_LINE_SHIFTS = [4, 2, 0, -2, -4];
	var renderStaffLines = function(staffEl){
		var lines = $('> .lines', staffEl);
		if (!lines.length)
			return;
		
		lines.empty();
		STAFF_LINE_SHIFTS.forEach(function(shift){
			$('<div class="htp-staffline"></div>')
				.css({top: markerTopEm(shift) + 'em'})
				.appendTo(lines);
		});
	};
	var applyLineMarkers = function(){
		/* Every staff in the page, including one this level does not use — it is
		 * still drawn, so it still needs its lines. */
		$('.staff').each(function(){ renderStaffLines($(this)); });

		renderTrainerMarkers();
		/* Let modules that render their own staves redraw theirs too. */
		if (window.HTP && typeof window.HTP.notifyMarkersChanged === 'function')
			window.HTP.notifyMarkersChanged();
	};
	/*
	 * The trainer's own staff containers.
	 *
	 * Scoped deliberately: a module may render its own staves with these same
	 * classes — js/modules/free-practice.js does — and a bare $('.staffContainer')
	 * would reach into them and apply this level's padding and clef spacing to
	 * staves that have nothing to do with the exercise.
	 */
	var trainerStaffContainers = function(){
		return $('#staff1').closest('.staffsContainer').find('.staffContainer');
	};
	/*
	 * Show a staff only when this level uses it AND its clef is switched on.
	 *
	 * index.html always contains two staves, but a level like Beginner 1 lists
	 * one, so the other was drawn as an empty set of lines with no clef — which
	 * reads as a second stave you are somehow meant to use.
	 *
	 * Turning a clef off takes its whole staff with it, lines and all, rather
	 * than leaving a headless set of lines behind.
	 */
	var applyStaffVisibility = function(){
		var used = state.level.staffs.map(function(staff){ return staff.id; });
		trainerStaffContainers().each(function(){
			var id = $('.staff', this).attr('id');
			var inLevel = used.indexOf(id) !== -1;
			var clefOn = !staffs[id] || !window.HTP
				|| window.HTP.clefEnabled(staffs[id].clef);
			$(this).toggle(inLevel && clefOn);
		});
	};
	/* A staff container's padding on one side, in the staff's em. Ledger room
	 * is set as padding, and it sits between two staff boxes exactly as their
	 * margin does. */
	var containerPaddingEm = function(container, side){
		var el = $(container);
		if (!el.length)
			return 0;
		var fontPx = parseFloat(el.css('font-size')) || 0;
		return fontPx ? (parseFloat(el.css(side)) || 0) / fontPx : 0;
	};
	/*
	 * How far apart two staff boxes must sit to be musically continuous,
	 * expressed as the margin correction on the lower container.
	 *
	 * Two staves are one pitch space when their boxes are offset by exactly
	 * (shiftB - shiftA) steps. Each box is 2em tall, and whatever padding the
	 * containers carry for ledger lines — the upper one's below, the lower
	 * one's above — lies in the gap as well, so it comes off too. Left out, an
	 * Intermediate level's four steps of ledger room either side pushed the
	 * bass staff eight steps too low.
	 */
	var staffOffsetEm = function(upperClefId, lowerClefId, upperContainer, lowerContainer){
		if (!clefs[upperClefId] || !clefs[lowerClefId])
			return 0;
		return (clefs[lowerClefId].shift - clefs[upperClefId].shift) * grid.stepEm - 2
			- containerPaddingEm(upperContainer, 'padding-bottom')
			- containerPaddingEm(lowerContainer, 'padding-top');
	};
	var applyStaffSpacing = function(){
		var containers = trainerStaffContainers();
		containers.css('margin-top', '');
		/* Musically continuous staves overlap, and a clef's opaque backdrop
		 * — 100em tall, clipped only by its own container — then paints
		 * straight over the tail of the clef above it. The backdrop is there
		 * to mask notes scrolling in behind a parked clef; in this layout that
		 * costs less than losing half a clef, so css/htp.css drops it while
		 * the class is on. */
		containers.closest('.staffsContainer').removeClass('htp-continuous');

		if (!window.HTP || !window.HTP.settings || !window.HTP.settings.musicalClefDistance)
			return;
		if (state.level.staffs.length < 2)
			return;

		/* The clefs actually parked at the left, as the markings and the
		 * legend follow — not the level's latest pick, which is still off to
		 * the right scrolling in. Spaced from the pick, the staves jumped to
		 * their musical distance half a minute before the clefs arrived, and
		 * back again if the next pick differed before these had parked. */
		var upper = shownClefOf(state.level.staffs[0]).clef;
		var lower = shownClefOf(state.level.staffs[1]).clef;
		if (!upper || !lower || upper == lower)
			return;

		containers.eq(1).css('margin-top',
			staffOffsetEm(upper, lower, containers.eq(0), containers.eq(1)) + 'em');
		containers.closest('.staffsContainer').addClass('htp-continuous');
	};
	/*
	 * A clef symbol, with the key signature's accidentals beside it when a
	 * key is given. The trainer builds every clef this way; a module drawing
	 * its own staff can ask for the same, with or without the key.
	 */
	var buildClefSymbol = function(clefId, key){
		var clef = clefs[clefId];
		if (!clef)
			return null;
		var symbol = $('<div class="symbol clef ' + clef.id + '"></div>');
		symbol.append(symbols.clefs[clefId]);
		if (key && key.lines)
			key.lines.forEach(function(l){
				var shift = clef.keys[key.decorator][l].shift;
				symbol.append(placeGlyph($(symbols.decorators[key.decorator]), shift, NOTEHEAD_CENTRE_EM));
			});
		return symbol;
	};
	/*
	 * The clef is furniture, not traffic.
	 *
	 * Upstream sent each clef in from the right like a note and had it park at
	 * the left, with a hand-off protocol deciding which of them was current and
	 * an opaque white backdrop masking the outgoing one. That is a lot of
	 * machinery for something that ends up in the same place every time, and
	 * every bug in this area came out of it: two clefs on a staff at once, a
	 * clef drawn while the pane was hidden and surfacing later, the markings
	 * and the legend having to ask which clef was really in charge.
	 *
	 * So the clef is simply an element pinned to the left of the staff, and
	 * only the notes move. Because a static clef re-clefs everything on the
	 * staff the instant it changes, a change waits for the staff to drain —
	 * see createNewNote().
	 */
	var STATIC_CLEF_LEFT_EM = 0.2;
	/* Where the notes must stop: the right-hand edge of the parked clef, in
	 * hundredths of a pixel. Measured when the clef is drawn rather than every
	 * frame, so the animation loop reads a number instead of the layout. */
	var measureClef = function(staff){
		var el = staff.shownClefEl;
		staff.clefRight = (el && el.length) ? (el.position().left + el.outerWidth()) : 0;
	};
	var measureClefs = function(){
		state.level.staffs.forEach(measureClef);
	};
	var removeStaticClefs = function(){
		Object.keys(staffs).forEach(function(id){
			$('#' + id).children('.symbol.clef').remove();
			staffs[id].shownClef = null;
			staffs[id].shownClefEl = null;
			staffs[id].clefRight = 0;
		});
	};
	var setClefs = function(){
		var clefSet = getRandomArrayEl(state.level.clefSets);
		var key = getRandomArrayEl(state.level.keys);

		if (state.activeClefSet === clefSet && state.activeKey === key)
			return false;

		state.activeClefSet = clefSet;
		state.activeKey = key;

		state.level.staffs.forEach(function(staff){
			staff.clef = clefSet[staff.id];
			var staffEl = $('#' + staff.id);
			staffEl.children('.symbol.clef').remove();
			var symbol = buildClefSymbol(staff.clef, key)
				.addClass('htp-clef-static')
				.css({left: STATIC_CLEF_LEFT_EM + 'em'});
			staffEl.append(symbol);
			staff.shownClef = staff.clef;
			staff.shownClefEl = symbol;
		});

		applyStaffSpacing();
		applyStaffVisibility();
		measureClefs();
		applyLineMarkers();
		updateKeyHint();

		return true;
	};
	var getNumberOfAdditionalLines = function(shift){
		if (shift > 5)
			return Math.floor((shift - 4) / 2);
		if (shift < -5)
			return Math.ceil((shift + 4) / 2);
		return 0;
	};
	var addAdditionalLines = function(symbol, numberOfAdditionalLines){
		var sign = numberOfAdditionalLines > 0 ? 1 : -1;
		for (var i = Math.abs(numberOfAdditionalLines) + 2; i >= 3; i--)
			symbol.append(placeGlyph($(symbols.line).addClass('line'), sign * 2 * i, LINE_CENTRE_EM));
	};
	var createNewNote = function(){
		state.newNoteHandler = setTimeout(createNewNote, state.newNoteInterval);

		/* Hidden: keep the clock ticking, create nothing. */
		if (paused)
			return;
		if (state.activeNotes.length > 50)
			return;
		
		state.noteIndex--;
		if (state.noteIndex < 0)
			state.noteIndex = settings.notesPerClef;
		if (state.noteIndex == settings.notesPerClef)
			state.clefChangeDue = true;
		/*
		 * A static clef re-clefs the whole staff the instant it changes, so it
		 * waits until nothing is left that was read in the old clef. The clock
		 * keeps ticking, so the change lands as soon as the staff drains —
		 * usually the next note or two.
		 */
		if (state.clefChangeDue)
		{
			if (state.activeNotes.length || pendingSymbols)
				return;
			state.clefChangeDue = false;
			if (setClefs())
				return;
		}

		var staff = getRandomArrayEl(state.level.staffs);
		var clef = clefs[staff.clef];
		var notes = getNotesForClef(staff.clef);
		var staffEl = $('#' + staff.id);
		var startPosition = 100 * staffEl.width();
		if (state.activeNotes.length)
		{
			var lastSymbol = state.activeNotes[state.activeNotes.length - 1];
			var position = lastSymbol.position + lastSymbol.width;
			startPosition = Math.max(startPosition, position);
		}
		var symbol = $('<div class="symbol note"></div>')
		var activeNote = {type: symbolTypes.note, notes: [], symbol: symbol, position: startPosition, staff: staff.id}
		var numberOfAdditionalTopLines = 0;
		var numberOfAdditionalBottomLines = 0;
		notes.forEach(function(note){
			var shiftInClef = note.clefs[clef.id].shift;
			var numberOfAdditionalLines = getNumberOfAdditionalLines(shiftInClef);
			numberOfAdditionalTopLines = Math.max(numberOfAdditionalTopLines, numberOfAdditionalLines);
			numberOfAdditionalBottomLines = Math.min(numberOfAdditionalBottomLines, numberOfAdditionalLines);
			var noteGlyph = placeGlyph($(symbols.notes[note.decorator]), shiftInClef, NOTEHEAD_CENTRE_EM);
			var noteColour = landmarkColourForSound(note.sound);
			if (noteColour)
				noteGlyph.css('fill', noteColour);
			symbol.append(noteGlyph);
			activeNote.notes.push(note);
		});
		/* Stems once every head is in, so the direction is the chord's and not
		 * each note's. Ledger lines come after, so this sees noteheads only. */
		applyStems($('svg', symbol));
		addAdditionalLines(symbol, numberOfAdditionalTopLines);
		addAdditionalLines(symbol, numberOfAdditionalBottomLines);
		addSymbol(staffEl, activeNote);
	};
	/*
	 * How fast the notes travel, as a percentage of the original speed. The
	 * original's 70 hundredths of a pixel every 20ms is 35px/s, which is one
	 * pace for every player and every level; this is the Speed control in the
	 * options bar.
	 */
	var scrollStep = function(){
		var percent = (window.HTP && window.HTP.settings)
			? window.HTP.settings.scrollSpeed : 100;
		if (!percent || !isFinite(percent))
			percent = 100;
		return settings.animationStep * percent / 100;
	};
	setInterval(function() {
		if (paused)
			return;
		var staffWidth = 100 * $('#' + state.level.staffs[0].id).width();
		var step = scrollStep();
		var firstNote = false;
		for (var i = 0; i < state.activeNotes.length; i++)
		{
			var note = state.activeNotes[i];
			var symbol = note.symbol;
			note.time += settings.animationInterval;
			if (!firstNote)
			{
				firstNote = true;
				if (!note.isVisible && note.position + note.width <= staffWidth)
				{
					note.isVisible = true;
					note.playable = true;
					note.time = 0;
					note.symbol.addClass('visible');
					updateKeyHint();
				}
			}
			note.position -= step;
			symbol.css({left: Math.round(note.position / 100)+'px'});
			/* Reached the clef without being played: a miss. */
			var borderLine = 100 * (staffs[note.staff] ? staffs[note.staff].clefRight : 0);
			if (note.position < borderLine - note.width)
			{
				state.newNoteInterval = settings.newNoteInterval;
				removeAllNotes();
				return;
			}
		}
	}, settings.animationInterval);

	var updateResults = function(){
		if (stats.averageTime === null)
		{
			$('#reactionTime').html('--');
			$('#accuracy').html('--');
			return;
		}
		$('#reactionTime').html((stats.averageTime / 1000).toFixed(2)+'s');
		$('#accuracy').html((100 * stats.numberOfCorrectAnswers / (stats.numberOfCorrectAnswers + stats.numberOfWrongAnswers)).toFixed(2)+'%');
	};
	var findFirstNoteIndex = function(){
		for (var i = 0; i < state.activeNotes.length; i++)
		{
			if (state.activeNotes[i].type != symbolTypes.note)
				continue;
			
			return i;
		}
		
		return null;
	};
	var noteSetActive = function(symbol, note, isActive)
	{
		if (!symbol.notes || !symbol.notes.length)
			return;
		
		var found = false;
		symbol.notes.forEach(function(n){
			if (n.sound != note)
				return;
			
			n.isActive = isActive;
			found = true;
		});
		if (!found && isActive)
		{
			stats.numberOfWrongAnswers++;
			updateResults();
		}
		return found;
	};
	/* Draw the note that was actually played on top of the target note, so a
	 * wrong answer shows the interval you missed by instead of just vanishing.
	 * The ghost is appended to the target note's own symbol, so it travels with
	 * it, and is taken away again after a moment. */
	var playedGhosts = {};   /* midi note -> the elements drawn for it */
	var heldSounds = {};     /* midi note -> true while the key is down */
	var heldOrder = [];      /* the same notes, in the order they went down */
	/*
	 * The note you played, drawn at a fixed place in the middle of the staff
	 * rather than on top of the note you were asked for.
	 *
	 * It reads as a shot fired from one position at the notes coming towards
	 * you: your note appears where it belongs in pitch, the target keeps
	 * moving, and a hit takes the target away. Drawn over the target instead,
	 * the two noteheads sat on top of each other at whatever point the target
	 * had reached, which said the same thing far less clearly — and a target
	 * still at the right-hand edge put the feedback out at the edge with it.
	 *
	 * The interval you missed by is still there to read: both noteheads are on
	 * the same staff at the same moment, one yours and one the exercise's.
	 */
	var showPlayedNote = function(activeNote, sound, isCorrect){
		var staff = staffs[activeNote.staff];
		if (!staff || !staff.clef)
			return;

		var clef = clefs[staff.clef];
		var entry = spellingForSound(sound);
		if (!entry)
			return;

		var shiftInClef = entry.clefs[clef.id].shift;
		var symbol = $('<div class="symbol note visible htp-shot"></div>')
			.addClass(isCorrect ? 'correct' : 'wrong');
		var ghost = $(glyphForDecorator(entry.decorator))
			.addClass('played')
			.addClass(isCorrect ? 'correct' : 'wrong')
			.attr('data-htp-shift', shiftInClef).attr('data-htp-artwork', NOTEHEAD_CENTRE_EM)
			.css({top: glyphTopEm(shiftInClef, NOTEHEAD_CENTRE_EM) + 'em'});
		applyStems(ghost);
		symbol.append(ghost);

		/* Ledger lines, so a note just outside the staff is still readable. Capped,
		 * because a note several octaves off would otherwise fill the staff with
		 * lines and hide the target. */
		var extra = getNumberOfAdditionalLines(shiftInClef);
		if (extra > 3) extra = 3;
		if (extra < -3) extra = -3;
		if (extra)
		{
			var sign = extra > 0 ? 1 : -1;
			for (var i = Math.abs(extra) + 2; i >= 3; i--)
				symbol.append($(symbols.line)
					.addClass('line played')
					.addClass(isCorrect ? 'correct' : 'wrong')
					.attr('data-htp-shift', sign * 2 * i).attr('data-htp-artwork', LINE_CENTRE_EM)
					.css({top: glyphTopEm(sign * 2 * i, LINE_CENTRE_EM) + 'em'}));
		}

		$('#' + staff.id).append(symbol);

		/* The shot stays for exactly as long as the key is held —
		 * hidePlayedNote() takes it away on note-off. */
		hidePlayedNote(sound);
		playedGhosts[sound] = [symbol];
	};
	var hidePlayedNote = function(sound){
		if (!playedGhosts[sound])
			return;
		playedGhosts[sound].forEach(function(el){ el.remove(); });
		delete playedGhosts[sound];
	};
	var clearPlayedNotes = function(){
		Object.keys(playedGhosts).forEach(hidePlayedNote);
	};
	
	/* ---------------------------------------------------------------------
	 * Note / interval / chord readout
	 *
	 * With the "Show note names" option on, the staff is captioned with what is
	 * currently being asked for: a single note by name, two notes by the
	 * interval between them, three or more by the chord they spell. Playing a
	 * note also reports what you actually played.
	 * ------------------------------------------------------------------- */
	var INTERVAL_NAMES = ['unison', 'minor 2nd', 'major 2nd', 'minor 3rd',
		'major 3rd', 'fourth', 'tritone', 'fifth', 'minor 6th', 'major 6th',
		'minor 7th', 'major 7th', 'octave'];
	var CHORD_SHAPES = [
		{steps: [0, 4, 7],        name: 'major'},
		{steps: [0, 3, 7],        name: 'minor'},
		{steps: [0, 3, 6],        name: 'diminished'},
		{steps: [0, 4, 8],        name: 'augmented'},
		{steps: [0, 5, 7],        name: 'suspended 4th'},
		{steps: [0, 2, 7],        name: 'suspended 2nd'},
		{steps: [0, 4, 7, 9],     name: '6th'},
		{steps: [0, 3, 7, 9],     name: 'minor 6th'},
		{steps: [0, 4, 7, 10],    name: 'dominant 7th'},
		{steps: [0, 4, 7, 11],    name: 'major 7th'},
		{steps: [0, 3, 7, 10],    name: 'minor 7th'},
		{steps: [0, 3, 7, 11],    name: 'minor/major 7th'},
		{steps: [0, 3, 6, 10],    name: 'half-diminished 7th'},
		{steps: [0, 3, 6, 9],     name: 'diminished 7th'},
		{steps: [0, 2, 4, 7],     name: 'add9'},
		{steps: [0, 2, 3, 7],     name: 'minor add9'},
		{steps: [0, 2, 4, 7, 11], name: 'major 9th'},
		{steps: [0, 2, 4, 7, 10], name: 'dominant 9th'},
		{steps: [0, 2, 3, 7, 10], name: 'minor 9th'}
	];
	
	/* MIDI number -> scientific octave, matching getSound(). */
	var soundOctave = function(sound){
		return Math.floor(sound / 12) - 1;
	};
	/* Pick how to spell a pitch: follow the key signature where possible, but
	 * skip entries getName() has no name for — the note table carries enharmonic
	 * spellings such as F-as-Eis and B-as-Ces that it never names. */
	/*
	 * `preference` lets a caller ask for a spelling rather than inheriting the
	 * trainer's active key signature. A module drawing a scale needs this: the
	 * sixth degree of E-flat major is C, and its third is G, but its root has to
	 * be E-flat and never D-sharp — the trainer's key has nothing to do with it.
	 * Omitted, the behaviour is exactly as before.
	 */
	var spellingForSound = function(sound, preference){
		var preferred = preference
			|| (state.activeKey ? state.activeKey.decorator : decorators.sharp);
		var candidates = notes.filter(function(n){ return n.sound == sound; });
		if (!candidates.length)
			return null;
		
		var named = candidates.filter(function(n){ return n.decorator == preferred && n.name; })[0];
		if (named)
			return named;
		
		/*
		 * An explicit preference asks for a STAFF POSITION, not a word. C-flat
		 * and E-sharp are in the table with the right position, but getName() has
		 * no spelling for either, so the named filter above throws them away —
		 * which silently turned G-flat major's fourth degree into a second B,
		 * two noteheads on one line and a letter skipped.
		 *
		 * Only an explicit preference gets this: the readout still needs a name
		 * to print, and its path is unchanged.
		 */
		if (preference)
		{
			var asked = candidates.filter(function(n){ return n.decorator == preference; })[0];
			if (asked)
				return asked;
		}
		
		return candidates.filter(function(n){ return n.name; })[0]
			|| candidates[0];
	};
	/*
	 * How each pitch class is spelled, sharp side and flat side.
	 *
	 * The original getName() answers in Dutch/German — Cis, Dis, Ais, Bes — which
	 * is fine for the note table it feeds but not what most people read. The
	 * readout spells notes in English instead, with real accidental signs.
	 *
	 * Where the two columns differ the pitch is enharmonically ambiguous: the
	 * same key is A sharp or B flat depending on the music around it.
	 */
	var PITCH_SPELLINGS = [
		{sharp: 'C',  flat: 'C'},
		{sharp: 'C\u266f', flat: 'D\u266d'},
		{sharp: 'D',  flat: 'D'},
		{sharp: 'D\u266f', flat: 'E\u266d'},
		{sharp: 'E',  flat: 'E'},
		{sharp: 'F',  flat: 'F'},
		{sharp: 'F\u266f', flat: 'G\u266d'},
		{sharp: 'G',  flat: 'G'},
		{sharp: 'G\u266f', flat: 'A\u266d'},
		{sharp: 'A',  flat: 'A'},
		{sharp: 'A\u266f', flat: 'B\u266d'},
		{sharp: 'B',  flat: 'B'}
	];
	var pitchClassOf = function(sound){
		return (((sound % 12) + 12) % 12);
	};
	var isAmbiguousPitch = function(sound){
		var spelling = PITCH_SPELLINGS[pitchClassOf(sound)];
		return spelling.sharp !== spelling.flat;
	};
	var spellPitch = function(sound, preference){
		var spelling = PITCH_SPELLINGS[pitchClassOf(sound)];
		return preference === decorators.flat ? spelling.flat : spelling.sharp;
	};
	var showOctaves = function(){
		return !window.HTP || !window.HTP.settings
			|| window.HTP.settings.octaveNumbers !== false;
	};
	/* One definite spelling, for chord roots and anywhere a choice must be made. */
	var nameForSound = function(sound, preference){
		var name = spellPitch(sound, preference);
		return showOctaves() ? (name + soundOctave(sound)) : name;
	};
	/*
	 * How a pitch is shown in the readout. When nothing in the music settles
	 * which spelling is right, both are offered — "A♯/B♭" — rather than picking
	 * one and being wrong half the time. Both share an octave number, because
	 * every ambiguous pair in the table sits in the same octave.
	 */
	var displayNameForSound = function(sound, preference){
		if (preference || !isAmbiguousPitch(sound))
			return nameForSound(sound, preference);
		
		var spelling = PITCH_SPELLINGS[pitchClassOf(sound)];
		return spelling.sharp + '/' + spelling.flat + (showOctaves() ? soundOctave(sound) : '');
	};
	/*
	 * Which accidental the music calls for, or null when nothing settles it.
	 *
	 *   - a key signature with accidentals in it decides (the trainer always has
	 *     one; the key of C has none, so it decides nothing);
	 *   - otherwise a recognised chord decides by its root: F and the black-key
	 *     roots read flat, because B♭, E♭, A♭ and D♭ are the chords people
	 *     actually play, and every other natural root reads sharp;
	 *   - otherwise it is genuinely ambiguous.
	 */
	var spellingPreference = function(chord){
		if (state.activeKey && state.activeKey.lines && state.activeKey.lines.length)
			return state.activeKey.decorator;
		
		if (chord)
		{
			var rootClass = pitchClassOf(chord.root);
			if (rootClass === 5 || isAmbiguousPitch(chord.root))
				return decorators.flat;
			return decorators.sharp;
		}
		
		return null;
	};
	var intervalName = function(semitones){
		var span = Math.abs(semitones);
		if (span <= 12)
			return INTERVAL_NAMES[span];
		var octaves = Math.floor(span / 12);
		var rest = span % 12;
		if (!rest)
			return octaves + ' octaves';
		return INTERVAL_NAMES[rest] + ' + ' + octaves + (octaves > 1 ? ' octaves' : ' octave');
	};
	var chordFromRoot = function(sounds, root){
		var steps = sounds.map(function(s){
			return (((s - root) % 12) + 12) % 12;
		}).filter(function(v, i, arr){
			return arr.indexOf(v) === i;
		}).sort(function(a, b){ return a - b; });
		
		for (var c = 0; c < CHORD_SHAPES.length; c++)
		{
			var shape = CHORD_SHAPES[c];
			if (shape.steps.length != steps.length)
				continue;
			if (shape.steps.every(function(v, i){ return v === steps[i]; }))
				return {root: root, quality: shape.name};
		}
		return null;
	};
	/*
	 * Name a chord. The note played FIRST is taken to be the root, which is what
	 * lets a voicing keep its name: C-E-G spread across two hands, or with the
	 * third on top, is still C major as long as you struck the C first.
	 *
	 * Only if the first note yields no known shape do we fall back to trying the
	 * other notes as the root, so an unplanned voicing still gets named rather
	 * than silently showing nothing.
	 */
	var chordName = function(sounds, root){
		if (root !== undefined && root !== null)
		{
			var fromRoot = chordFromRoot(sounds, root);
			if (fromRoot)
				return fromRoot;
		}
		for (var r = 0; r < sounds.length; r++)
		{
			var named = chordFromRoot(sounds, sounds[r]);
			if (named)
				return named;
		}
		return null;
	};
	/*
	 * Describe a set of notes as two lines: the names themselves, large, and
	 * what they add up to underneath — the interval for a pair, the chord for
	 * three or more.
	 */
	var describeNotes = function(noteObjs, root){
		var sounds = noteObjs.map(function(n){ return n.sound; })
			.sort(function(a, b){ return a - b; });
		
		/* Work out the chord first: what it is decides how to spell the notes. */
		var chord = sounds.length > 2 ? chordName(sounds, root) : null;
		var preference = spellingPreference(chord);
		var names = sounds.map(function(s){ return displayNameForSound(s, preference); });
		
		if (sounds.length <= 1)
			return {primary: names.join(''), secondary: ''};
		
		if (sounds.length === 2)
			return {primary: names.join('  '), secondary: intervalName(sounds[1] - sounds[0])};
		
		return {
			primary: names.join('  '),
			secondary: chord ? (spellPitch(chord.root, preference) + ' ' + chord.quality) : ''
		};
	};
	
	/*
	 * Build a notehead for one pitch in one clef, ready to drop into a .staff.
	 * Returns null for a pitch the note table cannot spell.
	 */
	/* A natural sign only earns its place when it cancels a key signature. On a
	 * played-note readout it is noise, so a natural draws as a bare notehead —
	 * sharps and flats keep their accidental, which is what tells them apart. */
	var glyphForDecorator = function(decorator){
		return decorator == decorators.natural ? symbols.notes.none : symbols.notes[decorator];
	};
	/*
	 * The landmark colour a notehead should be drawn in, or null for plain black.
	 * Returns null when the option is off, when the pitch is not a landmark, or
	 * when that landmark has been switched off — the same rules the staff
	 * markings and the keyboard follow, so all three always agree.
	 *
	 * `fill` is an inherited SVG property, so setting it on the <svg> reaches the
	 * <path> elements inside, which carry no fill of their own.
	 */
	var landmarkColourForSound = function(sound){
		if (!window.HTP || !window.HTP.settings || !window.HTP.settings.colourNotes)
			return null;
		var landmark = window.HTP.landmarkForPitchClass(pitchClassOf(sound), soundOctave(sound));
		return landmark ? landmark.colour : null;
	};
	/* Recolour the notes already on the staff, so toggling the option takes
	 * effect immediately instead of only on the notes drawn after it. */
	var applyNoteColours = function(){
		state.activeNotes.forEach(function(item){
			if (item.type != symbolTypes.note || !item.notes)
				return;
			
			var glyphs = $('svg', item.symbol).filter(function(){
				return !$(this).hasClass('line') && !$(this).hasClass('played');
			});
			item.notes.forEach(function(n, i){
				glyphs.eq(i).css('fill', landmarkColourForSound(n.sound) || '');
			});
		});
	};
	/*
	 * How much room a staff container needs above and below, in em, to show notes
	 * at these extreme shifts without clipping them.
	 *
	 * A staff container is only as tall as the staff and clips to its padding
	 * box, while a note symbol is absolutely positioned and takes no layout space
	 * — so a note far above or below is drawn correctly and then cut off, which
	 * looks exactly like the note failing to register. The trainer settles this
	 * once from the level's fixed shift range; a module whose range is whatever
	 * you just played has to ask per note.
	 *
	 * The amount comes from markerTopEm(), the same function that places the
	 * staff lines, the landmark markings and the noteheads themselves, so the
	 * room returned is exactly the room needed and a note that already fits asks
	 * for nothing. STAFF_TOP_OFFSET_EM is div.staff's own `top: 0.1em`, which
	 * shifts the staff down without moving the container it is clipped by.
	 */
	var NOTEHEAD_HALF_EM = 0.14;
	var STAFF_TOP_OFFSET_EM = 0.1;
	var roomForShiftsEm = function(highestShift, lowestShift){
		var above = 0;
		var below = 0;
		
		if (highestShift !== null && highestShift !== undefined)
			above = Math.max(0, -(markerTopEm(highestShift)
				- NOTEHEAD_HALF_EM + STAFF_TOP_OFFSET_EM));
		if (lowestShift !== null && lowestShift !== undefined)
			below = Math.max(0, (markerTopEm(lowestShift)
				+ NOTEHEAD_HALF_EM + STAFF_TOP_OFFSET_EM) - 2);
		
		return {above: above, below: below};
	};
	var buildNoteGlyph = function(clefId, sound, preference){
		var entry = spellingForSound(sound, preference);
		if (!entry || !clefs[clefId])
			return null;
		return buildGlyphForEntry(clefId, entry, glyphForDecorator(entry.decorator));
	};
	/*
	 * A notehead for an entry the trainer's own picker returned — see
	 * getNotesForClef(). Drawn exactly as the trainer draws it: the entry's
	 * decorator is already the accidental the key signature leaves to print,
	 * so a natural is a natural sign here, not a bare head.
	 */
	var buildEntryGlyph = function(clefId, entry){
		if (!entry || !entry.clefs || !entry.clefs[clefId] || !clefs[clefId])
			return null;
		return buildGlyphForEntry(clefId, entry, symbols.notes[entry.decorator] || symbols.notes.none);
	};
	var buildGlyphForEntry = function(clefId, entry, markup){
		var shiftInClef = entry.clefs[clefId].shift;
		var glyph = placeGlyph($(markup), shiftInClef, NOTEHEAD_CENTRE_EM);

		var colour = landmarkColourForSound(entry.sound);
		if (colour)
			glyph.css('fill', colour);

		/* One note, so it stems on its own. A module drawing several as one
		 * chord calls HTP.notation.applyStems over the group afterwards. */
		applyStems(glyph);

		return {glyph: glyph, shift: shiftInClef, entry: entry};
	};
	
	var updateReadout = function(){
		var el = $('#htpReadout');
		if (!el.length)
			return;
		
		if (!window.HTP || !window.HTP.settings || !window.HTP.settings.showNoteNames)
		{
			el.empty();
			return;
		}
		
		/* This names what YOU are playing, never the note you are being asked for —
		 * naming the target would give the exercise away. It stays on screen for
		 * exactly as long as the keys are held. */
		var held = Object.keys(heldSounds).map(Number).sort(function(a, b){ return a - b; });
		if (!held.length)
		{
			el.empty();
			return;
		}
		
		/* heldOrder[0] is the note struck first, which names the chord. */
		var described = describeNotes(held.map(function(s){ return {sound: s}; }), heldOrder[0]);
		
		var parts = ['<div class="htp-readout__primary">' + described.primary + '</div>'];
		if (described.secondary)
			parts.push('<div class="htp-readout__secondary">' + described.secondary + '</div>');
		el.html(parts.join(''));
	};
	setInterval(updateReadout, 120);
	
	/* A note-on whose note-off never arrives — a lost MIDI message, or focus
	 * leaving mid-chord — would otherwise stay held forever. */
	$(window).on('blur', function(){
		heldSounds = {};
		heldOrder = [];
		clearPlayedNotes();
		updateReadout();
	});
	var noteEvent = function(note, isOn){
		var activeNoteIndex = findFirstNoteIndex();
		if (activeNoteIndex === null)
			return;
		
		var activeNote = state.activeNotes[activeNoteIndex];
		if (!activeNote.playable)
			return;
		
		var matched = noteSetActive(activeNote, note, isOn);
		if (isOn)
		{
			showPlayedNote(activeNote, note, matched);

			var notActiveNotes = activeNote.notes.filter(function(n){
				return !n.isActive;
			});
			if (notActiveNotes.length)
				return;
			
			state.newNoteInterval = (1 - settings.averageAlpha) * state.newNoteInterval + settings.averageAlpha * activeNote.time;
			if (stats.averageTime === null)
				stats.averageTime = activeNote.time;
			else
				stats.averageTime = (1 - settings.averageAlpha) * stats.averageTime + settings.averageAlpha * activeNote.time;
			stats.numberOfCorrectAnswers++;
			updateResults();

			removeSymbolsSet(activeNoteIndex);
			/* The target is gone, so the hint belongs to whatever is next. */
			updateKeyHint();
		}
	};
	var onMIDIFailure = function(e){
	    console.log('No access to MIDI devices or your browser doesn\'t support WebMIDI API. Please use WebMIDIAPIShim ' + e);
	    
		ga('send', {
			nonInteraction: true,
			hitType: 'event',
			eventCategory: 'MIDISupport',
			eventAction: 'no'
		});
	};
	var onMIDIMessage = function(event){
	    var data = event.data;
	    var cmd = data[0] >> 4;
	    var channel = data[0] & 0xf;
	    var type = data[0] & 0xf0;
	    var note = data[1];
	    var velocity = data[2];
	    
	    if (type == 240)
	    	return;
	    
		ga('send', {
			nonInteraction: true,
			hitType: 'event',
			eventCategory: 'MIDIMessageType',
			eventAction: type
		});
	    
	    /* Track what is held here rather than in noteEvent(), which returns early
	     * when there is no playable note to answer. The readout and the staff
	     * ghosts need every key-up, exercise or not. */
	    if (type == 144 && velocity > 0)
	    {
	    	if (!heldSounds[note])
	    		heldOrder.push(note);
	    	heldSounds[note] = true;
	    	noteEvent(note, true);
	    }
	    else if (type == 128 || type == 144)
	    {
	    	delete heldSounds[note];
	    	var at = heldOrder.indexOf(note);
	    	if (at !== -1)
	    		heldOrder.splice(at, 1);
	    	hidePlayedNote(note);
	    	noteEvent(note, false);
	    }
	};
	var onMIDISuccess = function(midiAccess){
		ga('send', {
			nonInteraction: true,
			hitType: 'event',
			eventCategory: 'MIDISupport',
			eventAction: 'yes'
		});
		
		for (var entry of midiAccess.inputs) {
			var input = entry[1];
			console.log( "Input port [type:'" + input.type + "'] id:'" + input.id +
		      "' manufacturer:'" + input.manufacturer + "' name:'" + input.name +
		      "' version:'" + input.version + "'" );
			
			entry[1].onmidimessage = onMIDIMessage;
			
			ga('send', {
				nonInteraction: true,
				hitType: 'event',
				eventCategory: 'MIDIDevice',
				eventAction: input.manufacturer + ' ' + input.name
			});
		}

		/* The loop above only ever sees the devices that existed at load. A
		 * Bluetooth piano connects later, so htp-core hands us each port as it
		 * arrives and we wire the same handler to it. */
		if (typeof midiAccess.htpOnPortAdded === 'function')
			midiAccess.htpOnPortAdded(function (input) {
				console.log("Input port added id:'" + input.id + "' name:'" + input.name + "'");
				input.onmidimessage = onMIDIMessage;
			});

		for (var entry of midiAccess.outputs) {
			var output = entry[1];
		    console.log( "Output port [type:'" + output.type + "'] id:'" + output.id +
		      "' manufacturer:'" + output.manufacturer + "' name:'" + output.name +
		      "' version:'" + output.version + "'" );
		}
		
		/*var output = midiAccess.outputs.get('output-1');
		setInterval(function(){
			for (var i = 0; i < state.midiMessages.length; i++)
			{
				var message = state.midiMessages[i];
				output.send(message.command, window.performance.now() + (message.timeOffset||0));
			}
			state.midiMessages = [];
		}, 100);*/
	};
	if (navigator.requestMIDIAccess)
	{
	    navigator.requestMIDIAccess({
	        sysex: false 
	    }).then(onMIDISuccess, onMIDIFailure);
	}
	else
	{
		console.log('No MIDI support in your browser');
		
		ga('send', {
			nonInteraction: true,
			hitType: 'event',
			eventCategory: 'MIDISupport',
			eventAction: 'no'
		});
	}

	var setup = function(level){
		if (state.newNoteHandler)
		{
			clearTimeout(state.newNoteHandler);
			state.newNoteHandler = null;
		}
		
		state.level = levels[level];
		state.newNoteInterval = settings.newNoteInterval;
		stats = Object.assign({}, defaultStats);
		var paddingTop = Math.max(0, state.level.shiftTo - 4) * grid.stepEm;
		var paddingBottom = Math.max(0, -state.level.shiftFrom - 4) * grid.stepEm;
		
		trainerStaffContainers().css({'padding-top': paddingTop+'em', 'padding-bottom': paddingBottom+'em'});
		applyStaffVisibility();

		/* The clef belongs to the level that chose it: its key signature, and
		 * possibly its staff, are about to be wrong. createNewNote() draws the
		 * new one as its first act. */
		removeStaticClefs();
		state.clefChangeDue = true;
		removeAllNotes();
		updateResults();
		createNewNote();
		
		ga('send', {
			nonInteraction: true,
			hitType: 'event',
			eventCategory: 'DifficultyLevel',
			eventAction: level
		});
	};

	/* Let the module shell re-apply staff spacing when its checkbox changes. */
	if (window.HTP)
	{
		window.HTP.applyStaffSpacing = applyStaffSpacing;
		window.HTP.applyLineMarkers = applyLineMarkers;
		window.HTP.applyNoteColours = applyNoteColours;
		window.HTP.applyNoteShape = applyNoteShape;
		window.HTP.applyStaffVisibility = applyStaffVisibility;
		window.HTP.relayoutForGrid = relayoutForGrid;
		/* The trainer only runs while its pane is showing; the module's
		 * onShow / onHide hooks in js/modules/note-trainer.js drive these. */
		window.HTP.pauseTrainer = pauseTrainer;
		window.HTP.resumeTrainer = resumeTrainer;
		/*
		 * A read-only look at the trainer's state, which is otherwise sealed
		 * inside this closure. Everything here is measured rather than
		 * guessed, and a stalled exercise has several possible causes that
		 * look identical from the outside — paused, waiting for the staff to
		 * drain, or a spawn interval that has run away.
		 */
		window.HTP.trainerDiagnostics = function(){
			return {
				paused: paused,
				clefChangeDue: !!state.clefChangeDue,
				activeNotes: state.activeNotes.length,
				pendingSymbols: pendingSymbols,
				noteIndex: state.noteIndex,
				newNoteInterval: state.newNoteInterval,
				scrollStep: scrollStep(),
				activeKey: state.activeKey ? state.activeKey.decorator : null,
				staffs: state.level.staffs.map(function(staff){
					return {id: staff.id, clef: staff.clef, shownClef: staff.shownClef,
						clefRight: staff.clefRight, width: $('#' + staff.id).width()};
				})
			};
		};
		/* The key hint follows a setting that any pane may turn on. */
		window.HTP.onSettingChange(function(key){
			if (key === 'showKeyHint')
				updateKeyHint();
		});
		
		/*
		 * Notation primitives for modules that draw their own staves — see
		 * js/modules/free-practice.js. Everything here is read-only apart from
		 * the render helpers, which only touch the element you hand them.
		 */
		window.HTP.notation = {
			get shiftSize(){ return grid.stepEm; },
			renderStaffLines: renderStaffLines,
			/* Where a given shift sits, in em from the top of the staff box. The
			 * staff lines, the landmark markings and the noteheads are all placed
			 * by this, so anything that needs to know whether a note will fit can
			 * ask the same question they did. */
			markerTopEm: markerTopEm,
			staffHeightEm: 2,
			clefs: clefs,
			symbols: symbols,
			/* How far apart two staff boxes must sit to be musically continuous,
			 * expressed as the margin correction on the lower one. */
			/* Pass the two .staffContainer elements as well: any ledger room they
			 * carry as padding lies in the gap and is taken off. */
			staffOffsetEm: staffOffsetEm,
			buildNoteGlyph: buildNoteGlyph,
			/* A notehead for an entry pickNotes() returned, drawn as the trainer
			 * would draw it. */
			buildEntryGlyph: buildEntryGlyph,
			/* Spelling preferences a caller may pass to buildNoteGlyph. */
			decorators: decorators,
			roomForShiftsEm: roomForShiftsEm,
			/* Give a set of noteheads one shared stem direction. Hand it every
			 * head of a chord at once; a lone note can stem itself. */
			applyStems: applyStems,
			/* The clef, and with a key the key signature beside it. */
			buildClefSymbol: buildClefSymbol,
			/*
			 * The trainer's difficulty levels, keyed as the level menu is, in
			 * menu order. Each names its staves, its clef sets and keys, its
			 * note range and which accidentals it allows. Read-only.
			 */
			levels: levels,
			/* Staff positions between two musically continuous staves, 0 when
			 * they are not continuous — and the renderStaffMarkers() options
			 * for each staff of the pair, [upper, lower], for that gap. */
			gapBetween: gapBetween,
			pairOptions: pairOptions,
			/* The notes for one prompt of a level in one clef, spelled against
			 * a key of that level — the trainer's own picker, for a module that
			 * asks the same questions on its own terms. */
			pickNotes: function(level, clefId, key){
				if (!level || !clefs[clefId] || !key)
					return [];
				return getNotesForClef(clefId, level, key);
			},
			addLedgerLines: addAdditionalLines,
			ledgerLineCount: getNumberOfAdditionalLines,
			renderStaffMarkers: renderStaffMarkers,
			nameForSound: nameForSound,
			/* `root` is the note struck first; it decides the chord name, so a
			 * voicing keeps its identity. Omit it to search every rotation. */
			describeSounds: function(sounds, root){
				return describeNotes(sounds.map(function(s){ return {sound: s}; }), root);
			},
			/* Which of a pair of clefs should carry this pitch: the one whose
			 * staff position is closest to the middle line. */
			bestClef: function(sound, clefIds){
				var entry = spellingForSound(sound);
				if (!entry)
					return clefIds[0];
				var best = clefIds[0];
				var bestDistance = Infinity;
				clefIds.forEach(function(id){
					if (!entry.clefs[id])
						return;
					var distance = Math.abs(entry.clefs[id].shift);
					if (distance < bestDistance)
					{
						bestDistance = distance;
						best = id;
					}
				});
				return best;
			}
		};
	}
	
	recomputeGrid();
	watchGrid();
	$('.staff').each(function(){ renderStaffLines($(this)); });
	
	Object.keys(levels).forEach(function(l){
		$('#level').append('<option value="' + l + '">' + levels[l].name + '</option>');
	});
	$('#level').change(function() {
		setup($(this).val());
	});
	setup(Object.keys(levels)[0]);
});