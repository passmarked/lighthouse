const lighthouse      = require('lighthouse');
const chromeLauncher  = require('chrome-launcher');
const _               = require('underscore');
const S               = require('string');

/**
* Util function that launches Chrome and runs the lighthouse tests
**/
function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
  
  // launch our chrome instance
  return chromeLauncher.launch({

    chromeFlags: ['--headless', '--disable-gpu', '--no-sandbox']

  }).then(chrome => {
    
    flags.port = chrome.port;
    return lighthouse(url, flags, config).then(results =>
      chrome.kill().then(() => results));

  });

}

/**
* Expose the actual worker function
**/
module.exports = exports = function(payload, fn) {

  // get the data
  var data = payload.getData();

  // the flags we will send one
  const flags = {};

  // Usage:
  launchChromeAndRunLighthouse(data.proxy || data.url, flags).then(results => {

    // get the audits
    var audits  =  results['audits'] || {};

    // get the keys
    var keys    = _.keys(audits);

    // loop all the keys
    for(var i = 0; i < keys.length; i++) {

      // skip manual audits
      if(audits[keys[i]].manual === true) continue;

      // check if this was affected?
      if(audits[keys[i]].scoringMode  == 'binary' && 
          (

              audits[keys[i]].score === true || 
                audits[keys[i]].score >= 100

            )) 
            continue;

      // check if this was affected?
      if(audits[keys[i]].scoringMode  == 'numeric' && 
          ( 
              audits[keys[i]].score >= 100 || 
                audits[keys[i]].score === true

          )) continue;

      // get the key
      var key = audits[keys[i]].name || keys[i];

      // check if given
      if(!audits[keys[i]].details) continue;

      // get the items
      var items   = audits[keys[i]].details.items || [];
      var headers = audits[keys[i]].details.itemHeaders || [];

      // loop and add them
      for(var a = 0; a < items.length; a++) {

        // get the message
        var occurrenceItem = {

          message:      [],
          identifiers:  [],
          display:      'text'

        };

        // check if array
        if(items[a].length) {

          // get the item parts
          for(var y = 0; y < (items[a] || []).length; y++) {

            // check if url
            if(items[a][y].type == 'url' && 
                items[a][y].text) {

              // set the url
              occurrenceItem.display  = 'url';
              occurrenceItem.url      = items[a][y].text;

            }

            // check if found
            if(!headers[y].text || 
                !items[a][y].text) 
                  continue;

            // set to url
            occurrenceItem.message.push(headers[y].text + ': $');
            occurrenceItem.identifiers.push(items[a][y].text)

          }

        }

        // clean up the message
        occurrenceItem.message = occurrenceItem.message.join(', ');

        // add the occurrences
        payload.addRule({
          
          helpText:   items[a].helpText || '',
          type:       'warning',
          key:        S(audits[keys[i]].name || keys[i]).slugify().s,
          message:    S((audits[keys[i]].description || '').split('[Learn more]')[0] || '').trim().s

        }, occurrenceItem)

      }

    }

    // done
    fn(null);

  })
  .catch((err) => {

    console.dir(err)

    // something went wrong
    fn(err);

  });

};