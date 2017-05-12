// TODO:
// Record price if no price has been saved
// Compare current price if old price has been saved
// Setup small db to save prices
//   item name
//   item Amazon id
//   timestamp
//   price
// If new price is lower, send text, save new price
// If price is higher, also send text, save new price as "higher". Still compare to original price in scrape
// Setup cron job (look at npm module)
// Scrape all items in wishlist
// deploy

// An unholy marriage of 
// http://marulanda.me/amazon-price-tracker-pushbullet/
// and
// https://github.com/Rob--W/cors-anywhere/#documentation
// and
// https://www.twilio.com/blog/2016/04/send-text-in-javascript-node-in-30-seconds.html
// and
// https://www.npmjs.com/package/node-storage

require('dotenv').config();
console.log("process.env.TWILIO_ACCOUNT_SID", process.env.TWILIO_ACCOUNT_SID);
const fs = require('fs'),
      request = require('request'),
      cheerio = require('cheerio'),
      pageURL = 'http://www.amazon.com/gp/registry/wishlist/1TPFUIJULM8B1/ref=cm_wl_list_o_0?',
      host = process.env.PORT ? '0.0.0.0' : '127.0.0.1';
      port = process.env.PORT || 8080,
      cors_proxy = require('cors-anywhere'),
      twilio = require('twilio'),
      client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN),
      Storage = require('node-storage'),
      store = new Storage(__dirname + "/data/priceData"),
      origPrice = null;
 
cors_proxy.createServer({
  originWhitelist: [], // Allow all origins 
  removeHeaders: ['cookie', 'cookie2']
}).listen(port, host, function() {
  console.log('Running CORS Anywhere on ' + host + ':' + port);
});

function scrapePage() {
  return new Promise( (resolve, reject) => {
    //make an HTTP request for the page to be scraped
    request(`http://localhost:${port}/${pageURL}`, (error, response, responseHtml) => {        
      if (error) { console.log("error", error); reject(); };
      //write the entire scraped page to the local file system
      fs.writeFile(__dirname + '/html/wishlist.html', responseHtml, (err) => {
          if (err) console.log("error in write file", err);
          console.log('entire-page.html successfully written to HTML folder');
          resolve(responseHtml)
      })
    })
  })
}

function parseItems(resHtml) {
  return new Promise( (resolve, reject) => {
    const $ = cheerio.load(resHtml),
          //create a reference to the wish list
          currentPrice = $('span[id="itemPrice_I3HPIU69V64NLY"]').html().replace('$', '').trim(),
          // TODO: replace hard-coded item id
          itemId = 'item_I3HPIU69V64NLY'.replace('item_', ''),
          item = store.get(itemId);
          console.log("currentPrice", currentPrice );

    // if item exists in the db already, send its price to be compared to saved version
    // Otherwise, store it in the db
    if (!item) {
      origPrice = currentPrice
      store.put(itemId, currentPrice);
    } else {
      origPrice = 50.00; //item
    }
    resolve({currentPrice})
  })
}

function comparePrice(currentPrice) {
  currentPrice < origPrice ? sendText(currentPrice, origPrice) : process.exit();
}

function sendText(newPrice, oldPrice) {
  console.log("sendText called");
  client.messages.create({
    to: process.env.PHONE_NO,
    from: process.env.TWILIO_NO,
    body: `The price of your game has dropped from $${oldPrice} to $${newPrice}`
  })
  .then( (message) => {
    console.log(message.sid);
    process.exit();
  })
  .catch( (err) => console.log("err", err))
};

//scrape the page
scrapePage()
.then( (resHtml) => {
  return parseItems(resHtml)
})
.then( ({currentPrice}) => {
  comparePrice(currentPrice)
})
.catch( (err) => {
  console.log("error", err );
});

