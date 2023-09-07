var wavData = [];

var numTaps = 50;
var coeffs = getLowPassFIRCoeffs(11025, 1200, numTaps);
// console.log(coeffs);
var filter = new FIRFilter(coeffs);

var signalMean;
var normalizedData;

// var imageCanvas = document.getElementById("output");
// var imageCTX = imageCanvas.getContext("2d");

var lastViewOption = "AB";

window.onload = function() {

	document.getElementById('spinner').style.visibility = 'hidden';
	document.getElementById('alert').style.visibility = 'hidden';

	try {
		FileReader = FileReader;
	} catch (e) {
		console.log('你的浏览器不支持文件 API');
	}


	// LOAD THE FILE
	var fileInput = document.getElementById('fileInput');

	fileInput.addEventListener('change', function(e) {
		file = fileInput.files[0];
		reset();
	});
}

function start() {

	try {

		document.getElementById('fileName').value = file.name;

	} catch (error) {

		popup("请选择一个 WAV 文件从你的设备");

		return;

	}

	document.getElementById('spinner').style.visibility = 'visible';
	document.getElementById('alert').style.visibility = 'hidden';

	wavFile = new wav(file);
	wavFile.onloadend = function() {

		console.log("loaded");

		if (wavFile.sampleRate != 11025) {

			document.getElementById('alert').innerHTML = "文件必须使用 11025Hz 采样率，请参阅<a href='https://leshamilton.co.uk/ssguide.htm'>本指南</a>以获取更详细的说明.";
			document.getElementById('alert').style.visibility = 'visible';
			document.getElementById('spinner').style.visibility = 'hidden';

			console.log("sample rate is currently " + wavFile.sampleRate);


			// experimenting...

			console.log(wavFile.dataSamples);
			wavData = wavToArray(wavFile);
			var downSampledData = changeSampleRate(wavData, 48000, 11025);

			var filtered = filterSamples(downSampledData);
			// console.log(filtered);

			// normalize
			normalizedData = new Float32Array(wavData.length);
			var normalized_mean = normalizeData(filtered);
			normalizedData = normalized_mean[0];
			signalMean = normalized_mean[1];



		} else {

			var demod_mode = document.querySelector('input[name="demod_mode"]:checked').value;

			switch (demod_mode) {
				case "abs":
					wavData = demodAbs(wavFile);
					break;

				case "cos":
					wavData = demodCos(wavFile);
					break;

				case "hilbertfft":

					// console.log(wavFile.dataSamples.length);
					var paddedWavFile = padArrayFFT(wavFile.dataSamples);
					// console.log(paddedWavFile.length);

					var IQdata = HilbertFFT(paddedWavFile);
					IQdata.length = wavFile.dataSamples.length * 2;

					wavData = envelopeDetection(IQdata);

					break;
			}


			// coeffs = getLowPassFIRCoeffs(11025, 1200, numTaps);



			// console.log("rectified");
			// console.log(wavData);

			// filter
			var filtered = filterSamples(wavData);
			// console.log(filtered);

			// normalize
			normalizedData = new Float32Array(wavData.length);
			var normalized_mean = normalizeData(filtered);
			normalizedData = normalized_mean[0];
			signalMean = normalized_mean[1];

			// console.log(normalizedData);


			// chartArray(normalizedData, 10);

			viewAB();

		}
	};
}


function popup(text) {
	$(".error_outer").fadeIn();
	$(".error_inner .text").html(text);
}


// experimenting...
function wavToArray(input) {

	console.log(input);

	var data = [];

	for (var i = 0; i < input.dataSamples.length; i++) {
		data[i] = input.dataSamples[i];
	}

	return data;

}



function changeSampleRate(input, input_rate, output_rate) {

	var data = [];

	// ex: 11025 / 48000 = 0.2296875

	// given the existing file at the current rate
	// figure out the desired length of the new array
	var ratio = output_rate / input_rate;
	var newLength = Math.floor(input.dataSamples.length * ratio);

	for (var i = 0; i < newLength; i++) {

		var x = Math.floor(map(i, 0, newLength, 0, input.dataSamples.length));

		data.push(input[x]);
	}

	return data;
}




function demodAbs(input) {
	var data = [];

	for (var i = 0; i < input.dataSamples.length; i++) {
		data[i] = Math.abs(input.dataSamples[i]);
	}

	return data;
}


function demodCos(input) {
	var data = [];

	console.log(" x " + input.dataSamples.length);

	// 2400 is the frequency of the carrier
	var trigArg = Math.PI * 2 * 2400.0 / 11025;
	var cos2 = 2.0 * Math.cos(trigArg);
	var sinArg = Math.sin(trigArg);
	var maxVal = 0.0;
	var minVal = 100;
	for (var c = 1; c < input.dataSamples.length; c++) {
		var temp = Math.sqrt(Math.pow(input.dataSamples[c - 1], 2) + Math.pow(input.dataSamples[c], 2) - input.dataSamples[c - 1] * input.dataSamples[c] * cos2);
		data[c] = temp / sinArg;
	}

	data[0] = data[1];

	return data;
}


function demodHilbert(input) {
	var data = [];

	for (var i = 0; i < input.dataSamples.length; i++) {
		data[i] = Math.abs(input.dataSamples[i]);
	}

	return data;
}




function HilbertFFT(data) {
	// computes the IQ valies for the real data input
	// returns the IQ values in an array with even number
	// elements being the I value and the odd number elements
	// being the Q value.
	// for example out[0] = 1st I value
	//             out[1] = 2nd Q value
	// this uses the fft code from
	//  https://github.com/indutny/fft.js/
	//const FFT = require('/Users/williamliles/fftjs/lib/fft.js');
	// note that data lenght must be equal to a power of 2
	// an erro check should be put here
	len = data.length;
	const f = new FFT(len);
	const input = new Array(len);
	out = f.createComplexArray();
	cpxData = f.createComplexArray();
	f.realTransform(out, data);
	// set negative frequencies to zero
	// stNegFreq is where the negative freqs start in out
	// recall that out and cpxData are arrays of twice the input
	// data array since the values are now complex
	// the 0 Hz complex freqa are in out[0] and out[1]
	// the positive freqs are from out[2] and out[3] up to and
	// including out[len-2] and out[len-1]
	// skip over out[len] and out[len+1]
	// the negative frequeices start at out[len+2] and oit[len+3)
	// and end at out[2*len-2] and out[2*len-1]
	// these negative frequcies are set to zero
	var stNegFreq = len + 2;
	for (ii = stNegFreq; ii < len * 2; ++ii) {
		out[ii] = 0;
	}
	// double magnitude of real frequency values
	// since the negative freqs wer set to zero we must recover the
	// energy in them by doubling the magnitude of the positive
	// frequency values
	for (ii = 2; ii < len; ++ii) {
		out[ii] *= 2.0;
	}
	// compute inverse fft
	f.inverseTransform(cpxData, out);
	return cpxData;

}

function envelopeDetection(data) {

	var amp = [];

	for (var ii = 0; ii < Math.floor(data.length / 2); ii++) {
		amp[ii] = Math.sqrt(data[2 * ii] ** 2 + data[2 * ii + 1] ** 2);
	}

	console.log("amp length is " + amp.length);

	return amp;

}

// HilbertFFT needs an array of size that is a power of 2
// so add some zeroes
function padArrayFFT(data) {

	var newData = [...data];

	// console.log("newData length is " + newData.length);

	var newLength = nearestUpperPow2(newData.length);

	console.log("nearest pow2 is " + newLength);

	var diff = newLength - newData.length;

	// console.log("diff is " + diff);

	for (var i = 0; i < diff; i++) {
		newData.push(0);
	}

	return newData;
}

function nearestUpperPow2(v) {
	v--;
	v |= v >> 1;
	v |= v >> 2;
	v |= v >> 4;
	v |= v >> 8;
	v |= v >> 16;
	return ++v;
}






function filterSamples(input) {

	// convert to Float32s

	var f32samples = new Float32Array(input.length);

	for (var i = 0; i < input.length; i++) {
		f32samples[i] = input[i] / 32768;
	}

	filter.loadSamples(f32samples);
	var filteredData = new Float32Array(f32samples.length);

	for (var i = 0; i < f32samples.length; i++) {
		filteredData[i] = filter.get(i);
	}

	console.log("filtered");
	// console.log(filteredData);
	$(".view_buttons_label").css('display','inline-block');
	$(".view_buttons").show();
	$("#spinner").hide();

	//uncomment if using the chart
	// chartArray();

	return filteredData;

}


function normalizeData(input) {

	var normalized = [];
	var mean = 0;

	var maxVal = 0;
	var minVal = 1;

	for (var i = 0; i < input.length; i++) {
		if (input[i] > maxVal) {
			maxVal = input[i];
		}
		if (input[i] < minVal) {
			minVal = input[i];
		}
	}
	for (var i = 0; i < input.length; i++) {
		normalized[i] = (input[i] - minVal) / (maxVal - minVal);
		mean += normalized[i]; // COULD BE WRONG
	}

	mean = mean / input.length;

	return [normalized, mean];

}


// simple chart drawing function, resolution simply skips that number
// of entries in the array
function chartArray(input, resolution) {

	var canvas = document.getElementById("myChart");

	var canvasWidth = canvas.width;
	var canvasHeight = canvas.height;

	var scale = canvasHeight;

	var ctx = canvas.getContext("2d");

	ctx.fillStyle = "#697ab2";

	var numSlices = input.length / resolution;

	for (var i = 0; i < input.length; i += resolution) {

		var x = map(i, 0, input.length, 0, numSlices);

		var y = input[i] * scale;

		ctx.fillRect(x, canvasHeight, 1, -y);

	}

}




function createImage(startingIndex, pixelStart, imgWidth) {

	resetEqualizationButtons();

	// reveal controls for saving image etc
	$(".image_buttons").show();

	lineCount = Math.floor(normalizedData.length / 5513);

	// we can also adjust the lineCount to account for the syncStart offset
	// to get rid of the blank/black pixel section at the bottom of the image that results
	lineCount -= Math.floor(syncStart / 5513);

	// canvas stuff. it's important it has the right number of pixels in the actual canvas
	// but then adjust the style as necessary
	var canvas = document.getElementById("output");
	canvas.width = imgWidth;
	canvas.height = lineCount;
	// canvas.style.width = "100%";
	// var r = lineCount/imgWidth;
	// var h = r * canvas.style.width;
	// canvas.style.height = h;

	var imageCanvas = document.getElementById("output");
	var imageCTX = imageCanvas.getContext("2d");

	var image = imageCTX.createImageData(imgWidth, lineCount);


	var lineStartIndex = startingIndex;

	var downSampler = new Downsampler(11025, 4160, coeffs);
	var thisLineData;

	//each line
	for (var line = 0; line < lineCount; line++) {
		//each column, currently only Channel A

		thisLineData = downSampler.downsample(normalizedData.slice(lineStartIndex + 20, lineStartIndex + 5533));

		for (var column = 0; column < imgWidth; column++) {
			var value = thisLineData[pixelStart + column] * 255;
			//R=G=B for grayscale
			image.data[line * imgWidth * 4 + column * 4] = value;
			image.data[line * imgWidth * 4 + column * 4 + 1] = value;
			image.data[line * imgWidth * 4 + column * 4 + 2] = value;
			//alpha = 255
			image.data[line * imgWidth * 4 + column * 4 + 3] = 255;
		}

		// updating lineStartIndex to equal the start of the next
		// line helps straighten the image
		var conv = convolveWithSync(lineStartIndex + (5512) - 40, 80);
		// if the convolution actually found something, use that
		// maybe adjust this
		if (conv.score > 5) {
			lineStartIndex = conv.index;
		} else { // otherwise, just guess the next line
			lineStartIndex += 5512;
		}
	}
	imageCTX.putImageData(image, 0, 0);

}


function convolveWithSync(start, range) {
	// the seven white/black lines in the image are the sync lines
	//var sync = [-1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1];

	// newer, longer sync
	var sync = [-1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];


	var maxVal = 0;
	var maxIndex = 0;

	for (var i = start; i < start + range; i++) {
		sum = 0;
		for (var c = 0; c < sync.length; c++) {
			sum += (normalizedData[i + c] - signalMean) * sync[c];
		}
		if (sum > maxVal) {
			maxVal = sum;
			maxIndex = i;
		}
	}

	return {
		"index": maxIndex,
		"score": maxVal
	};
}

function histogramEqualization() {

	let imgElement = document.getElementById("output");
	let src = cv.imread(imgElement);
	let dst = new cv.Mat();
	let hsvPlanes = new cv.MatVector();
	let mergedPlanes = new cv.MatVector();
	cv.cvtColor(src, src, cv.COLOR_RGB2HSV, 0);
	cv.split(src, hsvPlanes);
	let H = hsvPlanes.get(0);
	let S = hsvPlanes.get(1);
	let V = hsvPlanes.get(2);
	cv.equalizeHist(V, V);
	mergedPlanes.push_back(H);
	mergedPlanes.push_back(S);
	mergedPlanes.push_back(V);
	cv.merge(mergedPlanes, src);
	cv.cvtColor(src, dst, cv.COLOR_HSV2RGB, 0);
	cv.imshow("output", dst);
	src.delete();
	dst.delete();
	hsvPlanes.delete();
	mergedPlanes.delete();

	$("#equalize_button").addClass("selected");
	$("#remove_equalize_button").removeClass("selected");

}

function removeEqualization() {

	renderAgain();
	$("#equalize_button").removeClass("selected");
	$("#remove_equalize_button").addClass("selected");

	// resetEqualizationButtons();

}

function resetEqualizationButtons() {
	$("#equalize_button").removeClass("selected");
	$("#remove_equalize_button").addClass("selected");
	// $("#remove_equalize_button").attr("disabled", true);
	// $("#equalize_button").attr("disabled", false);
}

function reset() {

	$(".output_container").hide();
	resetEqualizationButtons();
	$(".view_buttons_label").css('display','none');
	$(".view_buttons").hide();
	$(".image_buttons").hide();
	$("#sync_after").val(2);

	console.log("resetting");
}







function hildemod(data, size) {
	// the data is real
	// size must be a power of two the following test that.
	// a binary number that is a power of two only has one bit on
	// an integer x and x -1 has one less bit on than x
	// therefore if x is a power of 2, x and x-1 has no bits on and is equal to z
	if (((size & (size - 1)) != 0) || (size <= 0)) {
		console.log(" size for Hilbert is not a power of two. Size is " + size);
	}

	var dataLen = data.length;

	var dataDemod = new Float32Array(dataLen);

	var thisSet;
	var thisSetDM;
	var demod = new Float32Array(dataLen);

	if (size >= dataLen) {
		console.log(" size for Hilbert FFT is greater that then size of the data file");
		console.log(" Hilbert FFT size is " + size);
		console.log(" Data files size is " + dataLen);
	}

	var num_hils = dataLen / size;
	for (var ii = 0; ii < num_hils; ii++) {
		var ptr = ii * size;

		thisSet = data.slic(ptr, ptr + size);
		// thisSet = subset(data, ptr, size);

		var hil = hilbert(thisSet);
		//println("hil");
		thisSetDM = abs_cpx(hil);

		for (var jj = 0; jj < size; jj++) {
			demod[jj + ptr] = thisSetDM[jj];
		}
	}

	return demod;

}


function hilbert(data) {
	var num = data.length;
	fft = new FFT(num, 10);

	// compute the FFT of the real array xr
	fft.forward(data);

	var fftr = new Float32Array(num);

	fftr = fft.getSpectrumReal();

	var ffti = new Float32Array(num);
	ffti = fft.getSpectrumImaginary();


	//println("fft before mult ");
	//print_cvec(fftr, ffti, 20);
	//println("end fft before mult");
	// remove negative components
	var lower = 1 + num / 2;
	var upper = num;

	for (var ii = lower; ii < upper; ii++) {
		fftr[ii] = 0;
		ffti[ii] = 0;
	}
	for (var ii = 1; ii < num / 2; ii++) {
		fftr[ii] = 2 * fftr[ii];
		ffti[ii] = 2 * ffti[ii];
	}
	//println("fft after mult");
	//for (int ii = 0; ii < 20; ii++) {
	//  println(fftr[ii], "  ", ffti[ii]);
	//}
	//print("end fft after mult");

	var hil = ifft_cpx(fftr, ffti);

	//println("hil");
	//for (int ii = 0; ii < m; ii++) {
	//  println(hil[ii][0], "  ", hil[ii][1]);
	//}

	return hil;
}



/** computes inverse fft give comples inputs

  */
function ifft_cpx(xr, xi) {

	var num = xr.length;

	var Xc = fft_cpx(xr, xi);

	for (var ii = 0; ii < num; ii++) {
		Xc[ii][0] = Xc[ii][0] / num;
		Xc[ii][1] = Xc[ii][1] / num;
	}

	var xres;
	xres[0][0] = Xc[0][0];
	xres[0][1] = Xc[0][1];

	for (var ii = num - 1; ii > 0; ii--) {
		xres[num - ii][0] = Xc[ii][0];
		xres[num - ii][1] = Xc[ii][1];
	}

	return xres;

}




$('#sync_after').on('input', function() {
	// do something
	renderAgain();
});

function renderAgain() {
	switch (lastViewOption) {
		case "A":
			viewA();
			break;
		case "B":
			viewB();
			break;
		case "AB":
			viewAB();
			break;
	}
}

function calcSyncStart() {
	var secs = $("#sync_after").val();

	// what does that mean in bits of info received?
	// each bit is 0.00024 seconds so multi by 4166.67... i think
	var words = secs * 4166;

	return words;
}



var syncStart = 0;

function viewA() {
	var pixelStart = 0;
	syncStart = calcSyncStart();
	createImage(convolveWithSync(syncStart, 22050).index, pixelStart, 1040);

	lastViewOption = "A";

	$(".view_buttons.selected").removeClass("selected");
	$("#viewA").addClass("selected");

	$(".output_container").show();
}

function viewB() {
	var pixelStart = 1040;
	syncStart = calcSyncStart();
	createImage(convolveWithSync(syncStart, 22050).index, pixelStart, 1040);

	lastViewOption = "B";

	$(".view_buttons.selected").removeClass("selected");
	$("#viewB").addClass("selected");

	$(".output_container").show();
}

function viewAB() {
	var pixelStart = 0;
	syncStart = calcSyncStart();
	createImage(convolveWithSync(syncStart, 22050).index, 0, 2080);

	lastViewOption = "AB";

	$(".view_buttons.selected").removeClass("selected");
	$("#viewAB").addClass("selected");

	$(".output_container").show();
}


function map(inputNum, inputMin, inputMax, outputMin, outputMax) {
	return outputMin + (inputNum - inputMin) * (outputMax - outputMin) / (inputMax - inputMin);
}




function colorChange() {
	//var randomColor = "#" + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
	// console.log(randomColor);

	// HSL
	const hue = Math.floor(Math.random() * 360);
	const saturation = Math.floor(Math.random() * (100 + 1)) + "%";
	const lightness = Math.floor(Math.random() * 45) + "%";
	var hslCol = "hsl(" + hue + ", " + saturation + ", " + lightness + ")";

	$("body").get(0).style.setProperty("--main", hslCol);
}
