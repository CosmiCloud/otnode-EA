const { Requester, Validator } = require('@chainlink/external-adapter')
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const fs = require('fs');
require('dotenv').config();
// Define custom error scenarios for the API.
// Return true for the adapter to retry.
const customError = (data) => {
  if (data.Response === 'Error') return true
  return false
}

// Define custom parameters to be used by the adapter.
// Extra parameters can be stated in the extra object,
// with a Boolean value indicating whether or not they
// should be required.
const customParams = {
  action: ['action'], //resolve or search only
  assertion_id: false,
  handler_id: false,
  type: false,
  search_term: false,
  asset_id: false,
  issuers: false,
  prefix: false,
  framingCriteria: false,
  limit: false,
  load: false
}

  const createRequest = (input, callback) => {
  // The Validator helps you validate the Chainlink request data
  const validator = new Validator(callback, input, customParams)
  const jobRunID = validator.validated.id
  const action = validator.validated.data.action;
  var endpoint;

  console.log(validator.validated.data.action);
  console.log(validator.validated.data.assertion_id);
  console.log(validator.validated.data.handler_id);
  console.log(validator.validated.data.type);
  console.log(validator.validated.data.search_term);

  if(validator.validated.data.action == 'resolve' && validator.validated.data.assertion_id){
    endpoint = `resolve?ids=${validator.validated.data.assertion_id}`
  }

  if(validator.validated.data.action == 'resolve' && validator.validated.data.handler_id){
    endpoint = `resolve/result/${validator.validated.data.handler_id}`
  }

  if(validator.validated.data.action == 'search' && validator.validated.data.handler_id){
    endpoint = `${validator.validated.data.type}:search/result/${validator.validated.data.handler_id}`
  }

  if(validator.validated.data.action == 'search' && validator.validated.data.search_term && validator.validated.data.type){
    endpoint = `${validator.validated.data.type}:search?query=${validator.validated.data.search_term}`

    if(validator.validated.data.asset_id){
      endpoint = `${endpoint}&asset_id=${validator.validated.data.asset_id}`
    }

    if(validator.validated.data.issuers){
      endpoint = `${endpoint}&issuers=${validator.validated.data.issuers}`
    }

    if(validator.validated.data.types){
      endpoint = `${endpoint}&types=${validator.validated.data.types}`
    }

    if(validator.validated.data.prefix){
      endpoint = `${endpoint}&prefix=${validator.validated.data.prefix}`
    }

    if(validator.validated.data.framingCriteria){
      endpoint = `${endpoint}&framingCriteria=${validator.validated.data.framingCriteria}`
    }

    if(validator.validated.data.limit){
      endpoint = `${endpoint}&limit=${validator.validated.data.limit}`
    }

    if(validator.validated.data.load){
      endpoint = `${endpoint}&load=${validator.validated.data.load}`
    }
  }

  console.log('ENDPOINT:'+endpoint)

  x = 'http'
  if(process.env.SSL_ENABLED == 'YES'){
    x = 'https'
  }

  const url = `${x}://${process.env.OTHOSTNAME}:${process.env.OTPORT}/${endpoint}`
  console.log(url)

  const params = {
    //
  }

  // This is where you would add method and headers
  // you can add method like GET or POST and add it to the config
  // The default is GET requests
  // method = 'get'
  // headers = 'headers.....'
  const config = {
    url,
    params
  }

  // The Requester allows API calls be retry in case of timeout
  // or connection failure
  Requester.request(config, customError)
    .then(response => {
      // It's common practice to store the desired value at the top-level
      // result key. This allows different adapters to be compatible with
      // one another.
      if(validator.validated.data.action == 'resolve' && validator.validated.data.assertion_id){
        response.data.result = Requester.getResult(response.data, ['handler_id'])
      }

      if(validator.validated.data.action == 'resolve' && validator.validated.data.handler_id){
        response.data.result = Requester.getResult(response.data, ['data'])
      }

      if(validator.validated.data.action == 'search' && validator.validated.data.searchterm){
        response.data.result = Requester.getResult(response.data, ['handler_id'])
      }

      if(validator.validated.data.action == 'search' && validator.validated.data.handler_id){
        response.data.result = Requester.getResult(response.data, ['data'])
      }

      callback(response.status, Requester.success(jobRunID, response))
    })
    .catch(error => {
      callback(500, Requester.errored(jobRunID, error))
    })
}

// This is a wrapper to allow the function to work with
// GCP Functions
exports.gcpservice = (req, res) => {
  createRequest(req.body, (statusCode, data) => {
    res.status(statusCode).send(data)
  })
}

// This is a wrapper to allow the function to work with
// AWS Lambda
exports.handler = (event, context, callback) => {
  createRequest(event, (statusCode, data) => {
    callback(null, data)
  })
}

// This is a wrapper to allow the function to work with
// newer AWS Lambda implementations
exports.handlerv2 = (event, context, callback) => {
  createRequest(JSON.parse(event.body), (statusCode, data) => {
    callback(null, {
      statusCode: statusCode,
      body: JSON.stringify(data),
      isBase64Encoded: false
    })
  })
}

// This allows the function to be exported for testing
// or for running in express
module.exports.createRequest = createRequest
