/**
  * Handle arguments
  **/
var processArguments = {
	"name": "",
	"type": "",
	"config": {}
};

var processArguments = {
	"name": "tradfrihub",
	"type": "tradfriHub",
	"config": {
		"ip": "192.168.2.160",
		"password": "TBvAXOcaYzrMth9a"
	}
};

if (process.argv[2]) {
	try {
		var data = JSON.parse(process.argv[2]);
		
		for (var i in processArguments) {
			if (data[i]) {
				processArguments[i] = data[i];
			}
		}
		
		for (var i in data) {
			if (!processArguments[i]) {
				console.log("undefined key: " + i);
			}
		}
		
	}
	catch (e) {
		throw "expected argument to be JSON";
	}
}

if (processArguments.name === "" || processArguments.config.ip === undefined || processArguments.config.password === undefined) {
	throw "expected JSON to contain a name and config.ip";
	return false;
}

if (!processArguments.config.interval) {
	processArguments.config.interval = 1000;
}

/**
  * DEFAULT API FUNCTION
  **/
   
var homeUiApi = require("../../frontend/mainApi.js");


/**
  * LOGIC
  **/
var nodeTradfriClient = require("node-tradfri-client");
var tradfriClient = nodeTradfriClient.TradfriClient;
var tradfriAccessoryTypes = nodeTradfriClient.AccessoryTypes;


var tradfri = new tradfriClient(processArguments.config.ip);

tradfri.authenticate(processArguments.config.password).then(function (res) {
	tradfri.connect(res.identity, res.psk).then(function () {
		var bulbs = {};
		var bulbHomeUiId = {};
		
		var bulbCurState = {};
		var bulbGoingToState = {};
		
		
		
		function onDeviceChange (device) {
			if (device.type === tradfriAccessoryTypes.lightbulb) {
				if (bulbs[device.instanceId] === undefined) {
					homeUiApi.requestApi("device", "POST", {
						name: processArguments.name + "-" + device.instanceId,
						type: "dimmer"
					}, function (err, id) { 
						if (err || id === false) {
							throw "Error requesting the api";
						}

						bulbHomeUiId[device.instanceId] = id;
						
						homeUiApi.onDeviceChange(id, function (deviceData, tstamp) {
							var newValue = parseInt(deviceData.value);
							
							if (bulbCurState[device.instanceId] !== newValue &&
								bulbGoingToState[device.instanceId] !== newValue) {
								console.log("Set state", device.instanceId, parseInt(deviceData.value));
								
								bulbGoingToState[device.instanceId] = newValue;
								
								if (parseInt(deviceData.value) > 0) {
									bulbs[device.instanceId].lightList[0].turnOn();
									bulbs[device.instanceId].lightList[0].setBrightness(bulbGoingToState[device.instanceId]);
								}
								else {
									bulbs[device.instanceId].lightList[0].turnOff();
								}
							}
						});
						
						onDeviceChange(bulbs[device.instanceId]);
					});
				}
				else if (bulbHomeUiId[device.instanceId]) {
					var curDimValue = parseInt(device.lightList[0].onOff? device.lightList[0].dimmer : 0);
					
					if (bulbCurState[device.instanceId] !== curDimValue) {
						bulbCurState[device.instanceId] = curDimValue;
						
						if (bulbGoingToState[device.instanceId] && curDimValue === bulbGoingToState[device.instanceId]) {
							delete bulbGoingToState[device.instanceId];
						}
						else if (!bulbGoingToState[device.instanceId]) {
							console.log("New state", device.instanceId, curDimValue);
							
							homeUiApi.requestApi("deviceValue", "POST", {
								id: bulbHomeUiId[device.instanceId],
								value: curDimValue
							}, function () {});
						}
					}
				}
				
				bulbs[device.instanceId] = device;
			}
		};
		
		tradfri.on("device updated", onDeviceChange);
		
		tradfri.on("device removed", function (instanceId) {
			 
		});
		
		tradfri.observeDevices();
		
	}).catch(function (e) {
		console.log(e);
	});
	
	
}).catch(function (e) {
	console.log(e);
});

  