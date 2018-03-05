/*ƒ*
 * Copyright 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

require( 'dotenv' ).config( {silent: true} );

var express = require( 'express' );  // app server
var fs = require('fs');
var bodyParser = require( 'body-parser' );  // parser for post requests
var watson = require( 'watson-developer-cloud' );  // watson sdk
// var recognizeMic = require('watson-speech/speech-to-text/recognize-microphone');

//var TextToSpeechV1 = require('watson-developer-cloud/text-to-speech/v1');

const yelp = require('yelp-fusion');

const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js');

var player = require('play-sound')('afplay');
const mic = require('mic');


// The following requires are needed for logging purposes
var uuid = require( 'uuid' );
var vcapServices = require( 'vcap_services' );
var basicAuth = require( 'basic-auth-connect' );
var http = require( 'http' );

// The app owner may optionally configure a cloudand db to track user input.
// This cloudand db is not required, the app will operate without it.
// If logging is enabled the app must also enable basic auth to secure logging
// endpoints
var cloudantCredentials = vcapServices.getCredentials( 'cloudantNoSQLDB' );
var cloudantUrl = null;
if ( cloudantCredentials ) {
  cloudantUrl = cloudantCredentials.url;
}
cloudantUrl = cloudantUrl || process.env.CLOUDANT_URL; // || '<cloudant_url>';
var logs = null;
var app = express();

// Bootstrap application settings
app.use( express.static( './public' ) ); // load UI from public folder
app.use( bodyParser.json() );

// Create the service wrapper
var conversation = watson.conversation( {
  url: 'https://gateway.watsonplatform.net/conversation/api',
  username: process.env.CONVERSATION_USERNAME || '<username>',
  password: process.env.CONVERSATION_PASSWORD || '<password>',
  version_date: '2016-07-11',
  version: 'v1'
} );


const nlu = new NaturalLanguageUnderstandingV1({
  'username': process.env.NATURAL_LANGUAGE_UNDERSTANDING_USERNAME || '<username>',
  'password': process.env.NATURAL_LANGUAGE_UNDERSTANDING_PASSWORD || '<password>',
  version_date: NaturalLanguageUnderstandingV1.VERSION_DATE_2017_02_27
});

// const stt = new watson.SpeechToTextV1({
//   // if left undefined, username and password to fall back to the SPEECH_TO_TEXT_USERNAME and
//   // SPEECH_TO_TEXT_PASSWORD environment properties, and then to VCAP_SERVICES (on Bluemix)
//   // username: '',
//   // password: ''

const speechToText = watson.speech_to_text({
  url: "https://stream.watsonplatform.net/speech-to-text/api",
  username: process.env.SPEECH_TO_TEXT_USERNAME || '<username>',
  password: process.env.SPEECH_TO_TEXT_PASSWORD || '<password>',
  version: 'v1',
});

const textToSpeech = watson.text_to_speech({
  url: 'https://stream.watsonplatform.net/text-to-speech/api',
  username: process.env.TEXT_TO_SPEECH_USERNAME || '<username>',
  password: process.env.TEXT_TO_SPEECH_PASSWORD || '<password>',
  version: 'v1',
});


//// TEST SPEECH CODE
// speechToText.getToken({
//   url: 'https://stream.watsonplatform.net/speech-to-text/api'
// },
// function (err, token) {
//   if (!token) {
//     console.log('error:', err);
//   } else {
//     var stream = speechToText.recognizeMicrophone({
//         token: token,
//     });
//   }

// });
///////////////////////


var config = {
  text: 'Hello from IBM Watson',
  voice: 'en-US_MichaelVoice', // Optional voice
  accept: 'audio/mp3'
};

var features= {
    entities: {},
    categories: {},
    keywords: {}
};

const client = yelp.client(process.env.YELP_KEY);

const speakResponse = (text) => {
  const params = {
    text: text,
    voice: config.voice,
    accept: 'audio/mp3'
  };
  textToSpeech.synthesize(params)
  .pipe(fs.createWriteStream('output.mp3'))
  .on('close', () => {
      player.play('output.mp3');
    });
}

// app.get('/api/speechAuth', function(req,res) {
//   console.log(req);
//   console.log(res);
// });
// Endpoint to be call from the client side
app.post( '/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if ( !workspace || workspace === '<workspace-id>' ) {
    return res.json( {
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' +
        'Once a workspace has been defined the intents may be imported from ' +
        '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    } );
  }
  var payload = {
    workspace_id: workspace,
    context: {},
    input: {}
  };

  var params = null;
  if ( req.body ) {
    if ( req.body.input ) {
      payload.input = req.body.input;


      params = {text: req.body.input.text,features:features};
    }
    if ( req.body.context ) {
      // The client must maintain context/state
      payload.context = req.body.context;
      // console.log(req.body.context);


    }
  }

  if(params == null) {
   params = {text: "No request body input",features:features}
  }

  console.log(params);
  // console.log(payload);
  nlu.analyze(params, function(error, response) {
      // var destination;
     //  if(reponse.destination = undefined){
     //    destination = response.destination;
     //  }
     //  else{
     //    destination = entities.map(function(entry) {
     //      if(entry.type == "Location") {
     //        if(entry.disambiguation && entry.disambiguation.subtype && entry.disambiguation.subtype.indexOf("City") > -1) {
     //          return(entry.text);
     //        }
     //      }
     //    });
     //  }
     //
     //
     //
     //  destination = destination.filter(function(entry) {
    	// 	if(entry != null) {
    	// 	 return(entry);
    	// 	}
	   //  });
     //  // console.log("User destination:");
     //  // console.log(destination[0]);
     //
     //  if(destination.length > 0) {
  	 //   payload.context.destination = destination[0];
     // } else{
     //   payload.context.destination = null;
     // }
     //
     //  console.log('\n');
      console.log(response);
      if(response !== null){

        let keywords = response.keywords;
        payload.context.keywords = keywords;

        let categories = response.categories;
        payload.context.categories = categories;

        let entities = response.entities;
        payload.context.entities = entities;

        let destination = entities.map(function(entry){
          if(entry.type == "Location") {
                 if(entry.disambiguation && entry.disambiguation.subtype && entry.disambiguation.subtype.indexOf("City") > -1) {
                   return(entry.text);
                 }
               }
        });



        // var destination;
       //  if(reponse.destination = undefined){
       //    destination = response.destination;
       //  }
       //  else{
       //    destination = entities.map(function(entry) {
       //      if(entry.type == "Location") {
       //        if(entry.disambiguation && entry.disambiguation.subtype && entry.disambiguation.subtype.indexOf("City") > -1) {
       //          return(entry.text);
       //        }
       //      }
       //    });
       //  }
       //
       //
       //
       //  destination = destination.filter(function(entry) {
      	// 	if(entry != null) {
      	// 	 return(entry);
      	// 	}
  	   //  });
       //  // console.log("User destination:");
       //  // console.log(destination[0]);
       //
       //  if(destination.length > 0) {
    	 //   payload.context.destination = destination[0];
       // } else{
       //   payload.context.destination = null;
       // }
       //
       //  console.log('\n');
      }
    // Send the input to the conversation service
    conversation.message( payload, function(err, data) {
      if ( err ) {
        return res.status( err.code || 500 ).json( err );
      }
      updateMessage( res, payload, data );
    });
  });


} );

/**
 * Updates the response text using the intent confidence
 * @param  {Object} res The node.js http response object
 * @param  {Object} input The request to the Conversation service
 * @param  {Object} response The response from the Conversation service
 * @return {Object}          The response with the updated message
 */
function updateMessage(res, input, response) {


  if(response.intents[0] != null){
    console.log("Intent: ");
    console.log(response.intents[0].intent);
  }else{
    console.log("No Intent specified");
  }

  if ( !response.output ) {
    response.output = {};
  }
  else if ( checkWeather( response ) ) {
    var path = getLocationURL( response.context.long, response.context.lat );

    var options = {
      host: 'api.wunderground.com',
      path: path
    };

    http.get( options, function(resp) {
      var chunkText = '';
      resp.on( 'data', function(chunk) {
        chunkText += chunk.toString( 'utf8' );
      } );
      resp.on( 'end', function() {
        var chunkJSON = JSON.parse( chunkText );
        var params = [];
        if ( chunkJSON.location ) {
          params.push( chunkJSON.location.city );
          var date = new Date(response.entities[0].value).getUTCDate();
          var now = new Date().getUTCDate();
          var when = date - now;
          //day after tomorrow
          params.push(chunkJSON.forecast.txt_forecast.forecastday[when * 2].fcttext);

          response.output.text = replaceParams( response.output.text, params );
        }
        log( input, response );
        return res.json( response );
      } );
    } ).on( 'error', function(e) {
      console.log( 'failure!' );
      console.log( e );
    } );
  }
  else if( checkWantTo(response)){

    // if(typeof response.context.entities[0] === 'undefined'){
    //   response.output.text = "Can you make that more specific?"
    // }
    // else{
    //   response.output.text = "Ok, you want to travel to " + response.context.entities[0].text+". Got it! Where are you traveling from?"
    //   response.context.destination = response.context.entities[0].text;
    // }
    //
    // speakResponse(response.output.text);
    // return res.json(response);
    // console.log(response.context.categories);
    let keywords = response.context.keywords;
    let categories = response.context.categories;
    let entities = response.context.entities;


    let destination = entities.map(function(entry){
      if(entry.type == "Location") {
             if(entry.disambiguation && entry.disambiguation.subtype && entry.disambiguation.subtype.indexOf("City") > -1) {
               return(entry.text);
             }
           }
    });


    if((typeof(destination[0]) !== 'undefined') ){
      response.output.text = "Ok, I understand you want to travel to " + destination[0] + ". Got it! Where are you traveling from?"

      response.context.destination = destination[0];
      return res.json(response);

    }
    if (checkYelpOption(response.input.text, response)) {
      console.log('YOU MENTIONED A YELP PLACE');
        let newResponse = updateYelpPlacesToVisit(response.input.text, response);
        res.json(response);
    }
    else{

      const promises = Array.from(Array(keywords.length).keys()).map((x) => {
       return yelpQuery(keywords[x].text, response); });
      Promise.all(promises)
      .then((yelpOptions) => {
        let merged = [].concat.apply([], yelpOptions);
        let responseText =("\n" + "Here are some businesses that match your query powered by Yelp. Anything catch your eye??");
        merged.push(responseText);
        response.output.text = merged;
        speakResponse(responseText);
        return res.json(response);
      })
      .catch((error) => {
        console.log(error);
      })
      // response.context.text = [];
      // for(let i = 0; i < keywords.length; i++){
      //   // let tempCards = yelpQuery(keywords[i].text, response, responseCards);
      //   // responseCards.push.apply(responseCards, tempCards);
      //   // console.log('CURRENT CARDS: ', responseCards);
      //   yelpQuery(keywords[i].text, response);
      //   console.log('current response text: ', response.output.text);
      //
      // }
      // console.log('final response cards: ', response.output.text);

    }

    // speakResponse(response.output.text);

  }
  else if( checkOriginLocation(response)){

    if(typeof response.context.entities[0] === 'undefined'){
      response.output.text = "Can you make that more specific?"
    }
    else{
      response.context.originLocation = response.context.entities[0].text;
      response.output.text = "Ok, you are traveling from "+response.context.originLocation+" to "+response.context.destination+ ", correct?"
    }

    speakResponse(response.output.text);
    return res.json(response);
  }

  else if ( checkYelp( response ) ) {
    // res.json(getYelpInfo(response));


    let keyTerm = response.context.searchTerm;
    let location = response.context.destination;
    let priceRange = response.context.priceRange;
    let yelpBusinessOptions = response.context.yelpBusinessOptions;

    client.search({
      term: keyTerm,
      location: location
    }).then(yelpResponse => {
      let responseCards = [];
      for (let key in yelpResponse.jsonBody.businesses) {
        if (yelpResponse.jsonBody.businesses[key]) {
          console.log(yelpResponse.jsonBody.businesses[key]);
          responseCards.push(
  `          <div class="card">
              <div class="card-image waves-effect waves-block waves-light">
               <img class="activator" src="${yelpResponse.jsonBody.businesses[key].image_url}">
              </div>
             <div class="card-content">
               <span class="card-title activator grey-text text-darken-4">${yelpResponse.jsonBody.businesses[key].name}<i class="material-icons right">more_vert</i></span>
               <p><a href="${yelpResponse.jsonBody.businesses[key].url}">Link to Page on Yelp</a></p>
             </div>
             <div class="card-reveal">
               <span class="card-title grey-text text-darken-4">${yelpResponse.jsonBody.businesses[key].name}<i class="material-icons right">close</i></span>
              <p><b>Phone: </b>${yelpResponse.jsonBody.businesses[key].phone}</p>
               <p><b>Distance: </b>${yelpResponse.jsonBody.businesses[key].distance}</p>
              <p><b>Rating: </b>${yelpResponse.jsonBody.businesses[key].rating}</p>
               <p><b>Price: </b>${yelpResponse.jsonBody.businesses[key].price}</p>
             </div>
            </div>`
          );
          yelpBusinessOptions[yelpResponse.jsonBody.businesses[key].url] = yelpResponse.jsonBody.businesses[key].name;
        }
      }
      let responseText =("\n" + "Here are some businesses that match your query powered by Yelp. Anything catch your eye??");
      responseCards.push(responseText);
      speakResponse(responseText);
      console.log(response.output);
      response.context.yelpBusinessOptions = yelpBusinessOptions;
      response.output.text = responseCards;
      return res.json(response);
    }).catch(e => {
      console.log(e);
      return res.json(response);
    });
  }

  else if ( checkRome2Rio( response ) ) {
      var logistics = getRome2Rio( response.context.originLocation, response.context.destination );
      console.log("reaching Rome2Rio");
      console.log(logistics);
  }
  //  else if ( checkRome2Rio( response ) ) {
	// console.log("reaching Rome2Rio");
	// response.output.text = getRome2Rio( response.context.originLocation, response.context.destination );
  //     return.json(response);
  // }

  else if ( response.output && response.output.text ) {
    // response.context.yelpTrue = true;
    // response.context.searchTerm = 'scuba diving';
    // response.context.destination = 'Los Angeles';
    // response.context.priceRange = "$$";
    response.context.yelpBusinessOptions = {};
    response.context.destination = response.context.destination !== null ? response.context.destination : null ;
    response.context.originLocation = response.context.originLocation !== null ? response.context.originLocation : null ;
    speakResponse(response.output.text[0]);
      // response.output.text = (`
      //   <div class="card small">
      //     <div class="card-image">
      //       <img src="https://i.ytimg.com/vi/rX-YiYHahoo/maxresdefault.jpg">
      //       <span class="card-title">Card Title</span>
      //     </div>
      //     <div class="card-content">
      //       <p>Test information</p>
      //     </div>
      //   </div>`);
      return res.json( response );
  }
}

function log(input, output) {
  if ( logs ) {
    // If the logs db is set, then we want to record all input and responses
    var id = uuid.v4();
    logs.insert( {'_id': id, 'request': input, 'response': output, 'time': new Date()} );
  }
}

if ( cloudantUrl ) {
  // If logging has been enabled (as signalled by the presence of the cloudantUrl) then the
  // app developer must also specify a LOG_USER and LOG_PASS env vars.
  if ( !process.env.LOG_USER || !process.env.LOG_PASS ) {
    throw new Error( 'LOG_USER OR LOG_PASS not defined, both required to enable logging!' );
  }
  // add basic auth to the endpoints to retrieve the logs!
  var auth = basicAuth( process.env.LOG_USER, process.env.LOG_PASS );
  // If the cloudantUrl has been configured then we will want to set up a nano client
  var nano = require( 'nano' )( cloudantUrl );
  // add a new API which allows us to retrieve the logs (note this is not secure)
  nano.db.get( 'car_logs', function(err) {
    if ( err ) {
      console.error( err );
      nano.db.create( 'car_logs', function(errCreate) {
        console.error( errCreate );
        logs = nano.db.use( 'car_logs' );
      } );
    } else {
      logs = nano.db.use( 'car_logs' );
    }
  } );

  // Endpoint which allows deletion of db
  app.post( '/clearDb', auth, function(req, res) {
    nano.db.destroy( 'car_logs', function() {
      nano.db.create( 'car_logs', function() {
        logs = nano.db.use( 'car_logs' );
      } );
    } );
    return res.json( {'message': 'Clearing db'} );
  } );

  // Endpoint which allows conversation logs to be fetched
  app.get( '/chats', auth, function(req, res) {
    logs.list( {include_docs: true, 'descending': true}, function(err, body) {
      console.error( err );
      // download as CSV
      var csv = [];
      csv.push( ['Question', 'Intent', 'Confidence', 'Entity', 'Output', 'Time'] );
      body.rows.sort( function(a, b) {
        if ( a && b && a.doc && b.doc ) {
          var date1 = new Date( a.doc.time );
          var date2 = new Date( b.doc.time );
          var t1 = date1.getTime();
          var t2 = date2.getTime();
          var aGreaterThanB = t1 > t2;
          var equal = t1 === t2;
          if ( aGreaterThanB ) {
            return 1;
          }
          return equal ? 0 : -1;
        }
      } );
      body.rows.forEach( function(row) {
        var question = '';
        var intent = '';
        var confidence = 0;
        var time = '';
        var entity = '';
        var outputText = '';
        if ( row.doc ) {
          var doc = row.doc;
          if ( doc.request && doc.request.input ) {
            question = doc.request.input.text;
          }
          if ( doc.response ) {
            intent = '<no intent>';
            if ( doc.response.intents && doc.response.intents.length > 0 ) {
              intent = doc.response.intents[0].intent;
              confidence = doc.response.intents[0].confidence;
            }
            entity = '<no entity>';
            if ( doc.response.entities && doc.response.entities.length > 0 ) {
              entity = doc.response.entities[0].entity + ' : ' + doc.response.entities[0].value;
            }
            outputText = '<no dialog>';
            if ( doc.response.output && doc.response.output.text ) {
              outputText = doc.response.output.text.join( ' ' );
            }
          }
          time = new Date( doc.time ).toLocaleString();
        }
        csv.push( [question, intent, confidence, entity, outputText, time] );
      } );
      res.csv( csv );
    } );
  } );
}

function checkWeather(data) {
  //return data.intents && data.intents.length > 0 && data.intents[0].intent === 'weather'
    return data.entities && data.entities.length > 0 && data.entities[0].entity === 'sys-date';
}
function checkYelp(data) {
  return ((data.intents && data.intents.length > 0 && data.intents[0].intent === 'Yelp') && (data.context.destination) && (data.context.searchTerm));

}

function checkWantTo(data) {
  return ((data.intents && data.intents.length > 0 && data.intents[0].intent === 'WantTo'));

}

function checkOriginLocation(data) {
  return ((data.intents && data.intents.length > 0 && data.intents[0].intent === 'OriginLocation') && (data.context.destination));

}


/*
Function to update context variable of yelp locations the user wants to visit or make note of.
Inputs
------
input: String of user input to Watson response
data: Response object to input
*/
function updateYelpPlacesToVisit(input, data) {
  let businesses = data.context.yelpSelections ? data.context.yelpSelections : [];
  for (let key in data.context.yelpBusinessOptions) {
    if (data.context.yelpBusinessOptions.hasOwnProperty(key)) {
      let business = data.context.yelpBusinessOptions[key];
      if (input.toLowerCase().includes(business.toLowerCase())) {
        speakResponse(`Ok! We're adding ${business} to your list of places to check out`);
        businesses.push(business)
      }
        // do stuff
    }
  }

  if (businesses.length > 0) {
    let uniqueBusiness = [...new Set(businesses)];
    data.context.yelpSelections = uniqueBusiness;

  }
  return data;
}

/*
Function to check if string contains any yelp selections that were in queries to yelp made by the user so far
Inputs
------
input: String of user input to Watson response
data: Response object to input
*/
function checkYelpOption(input, data) {
  console.log(input, data);
  for (let key in data.context.yelpBusinessOptions) {
    if (data.context.yelpBusinessOptions.hasOwnProperty(key)) {
      let business = data.context.yelpBusinessOptions[key];
      console.log(input.toLowerCase());
      console.log(business.toLowerCase());
      if (input.toLowerCase().includes(business.toLowerCase())) {
        return true;
      }
        // do stuff
    }
  }
  return false;

}
function yelpQuery(keyword, response) {
  console.log('keyword');
  return new Promise((fulfill, reject) => {
    let responseCards = response.output.text;
    console.log('keyword: ' + keyword);
    let location = response.context.destination;
    console.log('location: ' + location);
    let priceRange = response.context.priceRange;
    let yelpBusinessOptions = response.context.yelpBusinessOptions;

    client.search({
      term: keyword,
      location: location
    }).then(yelpResponse => {
      for (let key in yelpResponse.jsonBody.businesses) {
        if (yelpResponse.jsonBody.businesses[key]) {
          console.log('PUSHING A CARD');
          responseCards.push(
  `          <div class="card">
              <div class="card-image waves-effect waves-block waves-light">
               <img class="activator" src="${yelpResponse.jsonBody.businesses[key].image_url}">
              </div>
             <div class="card-content">
               <span class="card-title activator grey-text text-darken-4">${yelpResponse.jsonBody.businesses[key].name}<i class="material-icons right">more_vert</i></span>
               <p><a href="${yelpResponse.jsonBody.businesses[key].url}">Link to Page on Yelp</a></p>
             </div>
             <div class="card-reveal">
               <span class="card-title grey-text text-darken-4">${yelpResponse.jsonBody.businesses[key].name}<i class="material-icons right">close</i></span>
              <p><b>Phone: </b>${yelpResponse.jsonBody.businesses[key].phone}</p>
               <p><b>Distance: </b>${yelpResponse.jsonBody.businesses[key].distance}</p>
              <p><b>Rating: </b>${yelpResponse.jsonBody.businesses[key].rating}</p>
               <p><b>Price: </b>${yelpResponse.jsonBody.businesses[key].price}</p>
             </div>
            </div>`
          );
          yelpBusinessOptions[yelpResponse.jsonBody.businesses[key].url] = yelpResponse.jsonBody.businesses[key].name;
        }
      }
      // let responseText =("\n" + "Here are some businesses that match your query powered by Yelp. Anything catch your eye??");
      // responseCards.push(responseText);
      // speakResponse(responseText);

      response.context.yelpBusinessOptions = yelpBusinessOptions;
      // response.output.text = responseCards;
      fulfill(responseCards);
    }).catch(e => {
      reject(e);
    });
  });

}

function checkRome2Rio(data) {
	console.log("we hit checkRome2Rio");
  return ((data.intents && data.intents.length > 0 && data.intents[0].intent === 'Rome2Rio') && (data.context.destination) && (data.context.originLocation));

}
// function checkRome2Rio(data) {
// 	console.log("we hit checkRome2Rio");
//   return ((data.intents && data.intents.length > 0 && data.intents[0].intent === 'Rome2Rio') && (data.context.destination) && (data.context.originLocation));
//
// }

////

function getYelpInfo(response) {
  let keyTerm = response.context.searchTerm;
  let location = response.context.destination;
  let priceRange = response.context.priceRange;

  client.search({
    term: keyTerm,
    location: location
  }).then(response => {
    let responseCards = [];
    for (let key in response.jsonBody.businesses) {
      if (response.jsonBody.businesses[key]) {
        responseCards.push(
`          <div class="card">
            <div class="card-image waves-effect waves-block waves-light">
             <img class="activator" src="${response.jsonBody.businesses[key].image_url}">
            </div>
           <div class="card-content">
             <span class="card-title activator grey-text text-darken-4">${response.jsonBody.businesses[key].name}<i class="material-icons right">more_vert</i></span>
             <p><a href="${response.jsonBody.businesses[key].url}">Link to Page on Yelp</a></p>
           </div>
           <div class="card-reveal">
             <span class="card-title grey-text text-darken-4">${response.jsonBody.businesses[key].name}<i class="material-icons right">close</i></span>
            <p><b>P:<hone Number/b>${response.jsonBody.businesses[key].phone}</p>
             <p><b>Distance:</b>${response.jsonBody.businesses[key].distance}</p>
            <p><b>Rating:</b>${response.jsonBody.businesses[key].rating}</p>
             <p><b>Price:</b>${response.jsonBody.businesses[key].price}</p>
           </div>
          </div>`
        );
      }
    }
    let responseText =("\n" + "Here are some businesses that match your query powered by Yelp. Anything catch your eye??");
    responseCards.push(responseText);
    speakResponse(responseText);
    console.log(response);
    response.output.text = responseCards;
    return response;
  }).catch(e => {
    console.log(e);
    return e;
  });
}

function replaceParams(original, args) {
  if ( original && args ) {
    var text = original.join( ' ' ).replace( /{(\d+)}/g, function(match, number) {
      return typeof args[number] !== 'undefined'
        ? args[number]
        : match
        ;
    } );
    return [text];
  }
  return original;
}

function getLocationURL(lat, long) {
  if ( lat !== null && long !== null ) {
    return '/api/' + process.env.WEATHER_KEY + '/geolookup/forecast10day/q/' + long + ',' + lat + '.json';
  }
}

function getRome2Rio(place1, place2) {
  // These code snippets use an open-source library. http://unirest.io/nodejs
  if ( place1 && place2 ) {
    unirest.get("https://rome2rio12.p.mashape.com/Search?dName="+ place1 + "&oName=" + place2)
    .header("X-Mashape-Key", "4cDxPeYcsGmsh1D3R4bFk2rKcng7p1y1xMgjsnTMywjbXOvDXC")
    .header("Accept", "application/json")
    .end(function (result) {
     console.log(result.status, result.headers, result.body);
	    return result.status + result.headers + result.body;
    });
  }
}

module.exports = app;
