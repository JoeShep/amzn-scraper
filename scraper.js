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
    // look for a-disabled class on next
    //if !disabled, grab url of next page and scrape it, too
// deploy

// Amazon Wishlist web scraper
// The below is an unholy marriage of
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
      pageURL = 'http://www.amazon.com/gp/registry/wishlist/1TPFUIJULM8B1',
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
          priceCollection = $('div[id^="itemMain"]');
          // console.log("priceCollection", priceCollection);

    priceCollection.toArray().forEach( (item) => {
      const $item = $(item),
            itemName = $item.find('a[id^="itemName"]').html().trim(),
            itemUrl = $item.find('a[id^="itemName"]').attr('href'),
            itemPrice = $item.find('span[id^="itemPrice"]').html().trim(),
            itemId = item.attribs.id.replace('itemMain_', '');

      // if item exists in the db already, send its price to be compared to saved version
      // Otherwise, store it in the db
      storedItem = store.get(itemId);
      if (!storedItem) {
        origPrice = itemPrice
        store.put(itemId, {itemName, itemUrl, itemPrice});
      } else {
        origPrice = storedItem;
      }
      console.log("new item stored?", store.get(itemId));
      resolve(itemPrice)
    })
  });
}

function comparePrice(currentPrice) {
  return new Promise( (resolve, reject) => {
    currentPrice < origPrice ? sendText(currentPrice, origPrice) : process.exit();
  })
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

