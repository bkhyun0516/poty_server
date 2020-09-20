var express = require('express');
var bodyParser =require('body-parser');
var http=require('http')
var https=require('https');
var querystring = require("querystring");
var mongoose = require('mongoose');
var cors = require('cors');
var axios = require('axios')
var fs =require('fs')
var ak=require('./lib/key.js');
const path = require('path');
var errD={};
var app = express();

mongoose.connect('mongodb://localhost:27017/local', { useNewUrlParser: true, useUnifiedTopology: true});
var db = mongoose.connection;
var co_data= mongoose.Schema({
	videoId: String,
	lastUpdate: String,
	highlights: [{
		rank: Number,
		totalLikeCount: Number,
		totalReplyComment:Number, 
		timestamp: String,
		comments: [{
			userId: String,
			likeCount: Number,
			replyComment: Number,
			commentText: String
		}] 
	}]
});
var CO_data = mongoose.model('schema',co_data);

var get_comment_D = function (videoid,ApiKey, callback) {
	var maxresult = 100;
	var querystrings = querystring.stringify({
		key: `${ApiKey}`,
		textFormat: `plainText`,
		part: 'snippet',
		order: `relevance`,
		videoId: `${videoid}`,
		maxResults: maxresult
	});
	var options = {
		headers: {'Content-Type': 'application/json; charset=utf-8'},
		host: `www.googleapis.com`,
		path: `/youtube/v3/commentThreads?${querystrings}`,
	}
	var req = https.get(options, function (res) {
		var resData = '';
		res.on('data', function (chunk) {
			resData += chunk;
		});
		res.on('end', function () {
			callback(resData);
		});
	});
	req.on('error', function (err) {
		callback(errD);
	});
};

var proc_D = function (jdata, callback) {
	const jsonString = JSON.stringify(jdata);
	axios.post("http://localhost:3000/post", jsonString)
	.then((e)=> callback(e.data))
	.catch(error => {
		callback(errD);
	});
}

var reduce_queryD=function(qdata, callback){
	delete qdata._id;
	delete qdata.__v;
	for(var i in qdata.highlights){
		delete qdata.highlights[i]._id;
		for(var j in qdata.highlights[i].comments){
			delete qdata.highlights[i].comments[j]._id;
		}
	}
	callback(qdata);
}
function EmptyJSON(j) {
	return Object.keys(j).length === 0 && j.constructor === Object;
}

app.use(cors());
app.use("/highlight/:VideoId",function(req,res){
	videoid = req.params.VideoId;
	console.log(videoid);
	CO_data.findOne({videoId: `${videoid}`}).lean().exec(function(error,Co_data){
		if(error){
			console.log("error");
			res.json(errD);
		}
		else{
			if(!Co_data){
				console.log("new data");
				var apikey;
				var R = Math.floor(Math.random()*3);
				if (R == 0){
					apikey = ak.ApiKey;
				} else if(R == 1){
					apikey = ak.ApiKey2;
				} else{
					apikey = ak.ApiKey3;
				}
				get_comment_D(videoid, apikey, function(yres){
					if(!EmptyJSON(yres)){					
						proc_D(yres,function(pres){
							console.log("pres: ",pres);
							console.log(typeof pres);
							if(!EmptyJSON(pres)){
								console.log("save!");
								var nd = new CO_data(pres);
								nd.save();
							}
							//res.writeHead(200, {'Content-Type':'text/plain; charset=utf-8'}); 
							res.json(pres);
						});
					}
					else{
						res.json(errD);
					}
				}) 
			}
			else{
				console.log("already exist");
				reduce_queryD(Co_data,function(rdata){
					console.log(rdata);
					res.json(rdata);
				});
			}
		}
	});
});
app.listen(8080);


