/*eslint-env node */
"use strict";

var request = require('request');
var fs = require('fs')
var tracing = require(__dirname+'/../../../tools/traces/trace.js');
var reload = require('require-reload')(require),
    configFile = reload(__dirname+'/../../../configurations/configuration.js'),
    participants = reload(__dirname+'/../participants_info.js');

var counter = 0;

var registerUser = function(req, res) {

	tracing.create('ENTER', 'POST blockchain/participants', req.body)
	
    
    var numberAff = "0000"
    
    switch(req.body.affiliation)
	{
		case "Regulator":
			numberAff = "0001";
			break;
		case "Manufacturer":
			numberAff = "0002";
			break;
		case "Dealership":
			numberAff = "0003";
			break;
		case "Lease Company":
			numberAff = "0004";
			break;
		case "Leasee":
			numberAff = "0003";
			break;
		case "Scrap Merchant":
			numberAff = "0005";
			break;
	}

    //TEMPORARY, REMOVE WHEN USING NODE SDK
    var secret = ""
    loginUser(req, res,secret);
}

function loginUser(req, res, secret)
{
	
	configFile = reload(__dirname+'/../../../configurations/configuration.js');
	var credentials = {
						  "enrollId": req.body.company,
						  "enrollSecret": secret
						}
	
	var options = 	{
						url: configFile.config.api_ip+':'+configFile.config.api_port_external+'/registrar',
						method: "POST", 
						body: credentials,
						json: true
					}
					
	request(options, function(error, response, body){
		if (!body.hasOwnProperty("Error") && response.statusCode == 200)
		{
			counter = 0;
			tracing.create('INFO', 'POST blockchain/participants', 'Login successful')
			writeUserToFile(req, res, secret)
		}
		else
		{
			if(counter >= 5){
        		counter = 0;
        		res.status(400)
				var error = {}
				error.message = 'Unable to register user with peer'
				error.error = true
				tracing.create('ERROR', 'POST blockchain/participants', error)
				res.send(error)
        	}
			else{
	            counter++
	            tracing.create('INFO', 'POST blockchain/participants', 'Trying to log in again')
	            setTimeout(function(){loginUser(req, res, secret);},2000)	            
        	}
			
		}
	});
}

function writeUserToFile(req, res, secret)
{
	participants = reload(__dirname+'/../participants_info.js');
	
	var userType = "";
	var userNumber = "";
	
	for(var k in participants.participants_info)
	{
		if (participants.participants_info.hasOwnProperty(k)) 
		{
			
           var data = participants.participants_info[k];
           for(var i = 0; i < data.length; i++)
           {
           		
           		if(data[i].identity == req.body.company)
           		{
           			userType = k;
           			userNumber = i;
           			break;
           		}
           }
        }
	}
	
	var newData = participants.participants_info;
	if(userType == "")
	{
		switch(req.body.affiliation)
		{
			case "Regulator":
				userType="regulators";
				break;
			case "Manufacturer":
				userType="manufacturers";
				break;
			case "Dealership":
				userType="dealerships";
				break;
			case "Lease Company":
				userType="lease_companies";
				break;
			case "Leasee":
				userType="leasees";
				break;
			case "Scrap Merchant":
				userType="scrap_merchants";
				break;
		}
		userNumber = newData[userType].length;
		newData[userType].push({})
		newData[userType][userNumber].name = add_slashes(req.body.company);
		newData[userType][userNumber].identity = add_slashes(req.body.company);
		newData[userType][userNumber].address_line_1 = add_slashes(req.body.street_name);
		newData[userType][userNumber].address_line_2 = add_slashes(req.body.city);
		newData[userType][userNumber].postcode = req.body.postcode;
		
		var configData = "config.participants.users."+userType+"["+userNumber+"] = {}\n";
		configData += "config.participants.users."+userType+"["+userNumber+"].company = '"+escape_quote(add_slashes(req.body.company))+"'\n";
		configData += "config.participants.users."+userType+"["+userNumber+"].type = '"+req.body.affiliation+"'\n";
		configData += "config.participants.users."+userType+"["+userNumber+"].user = '"+escape_quote(add_slashes(req.body.username))+"'\n";
		fs.appendFileSync(__dirname+'/../../../../Client_Side/JavaScript/config/config.js', configData);
			
	}
	newData[userType][userNumber].password = secret;
	
	var updatedFile = '/*eslint-env node*/\n\nvar user_info = JSON.parse(process.env.VCAP_SERVICES)["ibm-blockchain-5-prod"][0]["credentials"]["users"];\n\nvar participants_info = '+JSON.stringify(newData)+'\n\nexports.participants_info = participants_info;';
	
	fs.writeFileSync(__dirname+'/../participants_info.js', updatedFile);
	var result = {}
	result.message = 'User creation successful'
	result.id = req.body.company
	result.secret = secret
	tracing.create('EXIT', 'POST blockchain/participants', result)
	res.send(result)
}

exports.create = registerUser;

function add_slashes(string) {
    return string.replace(/\\/g, '\\\\').
        replace(/\u0008/g, '\\b').
        replace(/\t/g, '\\t').
        replace(/\n/g, '\\n').
        replace(/\f/g, '\\f').
        replace(/\r/g, '\\r').
        replace(/"/g, '\\"');
}

function escape_quote(string) {
	return string.replace(/'/g, "\\'");
}
