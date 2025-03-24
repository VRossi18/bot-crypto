const axios = require('axios');
const crypto = require('crypto');

const SYMBOL = 'BTCUSDT';
const PERIOD = 14;
const INTERVAL = '15m';
const LIMIT = '100';
const QUANTITY = 0.0001;
//https://testnet.binance.vision / https://api.binance.com
const API_URL = process.env.API_URL;
const API_KEY = process.env.API_KEY;
const SECRET_KEY = process.env.SECRET_KEY;

let isOpened = false;

//RSI > 70 -> comprando demais
//RSI < 30 -> vendendo demais
function averages(prices, period, startIndex) {
   let gains = 0,
      losses = 0;

   for (let i = 0; i < period && i + startIndex < prices.length; i++) {
      const diff = prices[i + startIndex] - prices[i + startIndex - 1];

      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
   }

   let avgGains = gains / period;
   let avgLosses = losses / period;
   return { avgGains, avgLosses };
}

function RSI(prices, period) {
   let avgGains = 0,
      avgLosses = 0;

   for (let i = 1; i < prices.length; i++) {
      let newAverages = averages(prices, period, i);

      if (i === 1) {
         avgGains = newAverages.avgGains;
         avgLosses = newAverages.avgLosses;
         continue;
      }

      avgGains = (avgGains * (period - 1) + newAverages.avgGains) / period;
      avgLosses = (avgLosses * (period - 1) + newAverages.avgLosses) / period;
   }

   return 100 - 100 / (1 + avgGains / avgLosses);
}

async function newOrder(symbol, quantity, side) {
   const order = { symbol, quantity, side };
   order.type = 'MARKET';
   order.recvWindow = 60000;
   order.timestamp = Date.now();
   const signature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(new URLSearchParams(order).toString())
      .digest('hex');

   order.signature = signature;

   console.log(new URLSearchParams(order).toString());
   try {
      const { data } = await axios.post(
         API_URL + '/api/v3/order',
         new URLSearchParams(order).toString(),
         {
            headers: { 'X-MBX-APIKEY': API_KEY },
         },
      );

      console.log(data);
   } catch (e) {
      console.error(e.response.data);
   }
}

async function start() {
   const { data } = await axios.get(
      API_URL + `/api/v3/klines?limit=${LIMIT}&interval=${INTERVAL}&symbol=${SYMBOL}`,
   );
   const candle = data[data.length - 1];
   const lastPrice = parseFloat(candle[4]);

   console.clear();
   console.log('Price: ' + lastPrice);

   const prices = data.map((k) => parseFloat(k[4]));
   const rsi = RSI(prices, PERIOD);
   console.log('RSI: ' + rsi);
   console.log('Já comprei? ' + isOpened);

   if (rsi < 30 && !isOpened) {
      console.log('comprar');
      isOpened = true;
      newOrder(SYMBOL, QUANTITY, 'BUY');
   } else if (rsi > 70 && isOpened) {
      console.log('vender');
      isOpened = false;
      newOrder(SYMBOL, QUANTITY, 'SELL');
   } else console.log('aguardar');
}

setInterval(start, 3000);
