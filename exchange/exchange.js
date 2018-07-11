/**
 * See README in this directory for explanations
 */
const redis = require('redis');
let crypto = require('crypto');

//global settings
const ROUND_INTERVAL = 10000;
const ALLOW_RE_REGISTERING = true;
const REGISTRATION_TOPIC = "exchange.registry";
const MARKET_TOPIC = "exchange.market";
const BIDS_TOPIC = "exchange.bids";
const BALANCES_TOPIC = "exchange.balances";
const LOGS_TOPIC = "exchange.logs";

//redis convenience methods, functional style
let clients = []; //client registry
const redisHost = '127.0.0.1';
const registerConnection = (c) => { clients.push(c); return c; };
const createRedisClient = () => registerConnection(redis.createClient(6379, redisHost));
const pubClient = createRedisClient();
const publish = (topic, message) => pubClient.publish(topic, JSON.stringify(message));
const subscribe = (topic, listener) => {
    let client = createRedisClient();
    client.subscribe(topic, (arg, channel) => console.log(`X subscribed to [${channel}]`));
    client.on("message", (topic, msg) => {
        try {
            listener(JSON.parse(msg))
        } catch (e) {
            console.log("Error processing ",msg, e)
        }
    });
};

class Exchange {
    constructor() {
        this.tickers = [];
        this.market = {
            units: 0,
            price: 100
        }; //market data
        this.companies = {}; //registered companies
        this.bids = {}; //current round's bids per slot
        this.users = {}; //actual playes receiving dividends
        this.initTopics();
        this.launchMarketplace();
    }

    initTopics() {
        subscribe(REGISTRATION_TOPIC, (entry) => this.processRegistration(entry));
        subscribe(BIDS_TOPIC, (bid) => this.processBid(bid));
    }

    launchMarketplace() {
        this.bidInterval = setInterval(() => {
            //determine winners and update balances
            this.completeRound();
            //distribute new balances
            for(let ticker of this.tickers) {
                let reg = this.companies[ticker];
                publish(BALANCES_TOPIC+"."+ticker, {
                    slot: ticker,
                    units: reg.units,
                    bought: reg.lastSold,
                    price: reg.lastPrice,
                    balance: this.companies[ticker].balance
                });
            }
            //publish new market conditions
            publish(MARKET_TOPIC, this.generateMarketPricing());
        }, ROUND_INTERVAL);
    }

    completeRound() {
        this.runAuction();
        this.sellInventories();
        this.payDividends();
    }

    runAuction() {
        let sortedBids = [];
        for (let ticker of this.tickers) {
            if (this.bids[ticker])
                sortedBids.push(this.bids[ticker]);
        }
        sortedBids.sort((a,b) => b.price - a.price); //descending order
        //process all bids and sell units to companies
        let remainingUnits = this.market.units;
        for (let bid of sortedBids) {
            let bought = Math.max(bid.qty, remainingUnits);
            let company =  this.companies[bid.slot];
            if (company.balance < bought * bid.price) {
                this.audit(bid.slot, "Not enough balance to buy "+bought+" for $"+bid.price);
                continue;
            }
            remainingUnits -= bought;
            company.balance -= bought * bid.price;
            company.units += bought;
            company.lastPrice = bid.price;
            company.lastSold = bought;
        }
        //cleanup bids
        this.bids = {};
    }

    sellInventories() {
        //simplification: for all companies, sell inventory and make profits. Alternative would be to emulate
        //market place for inventory similar to materials marketplace
        let sellingPrice = Math.floor(Math.random() * 50) + 90;
        const MAX_SELL = 50; //untis
        for (let ticker of this.tickers) {
            let company =  this.companies[ticker];
            let sold = Math.min(company.units, MAX_SELL);
            if (sold > 0) {
                company.balance += sold*sellingPrice;
                company.units -= sold;
                this.audit(ticker,"Sold "+sold+" units at "+sellingPrice);
            }
        }
    }

    payDividends() {
        //usually, dividends are paid $0.20 per share per quarter or similar
        //let's assume invested amount represents shares
        //company distributes in dividends 10% of everything it owns
        //proportionally to invested amounts with each turn
        //so, for each company we create

        //for each company, calculate distribution per user for each investment, pay dividends
        Object.values(this.companies).forEach(company => {
            if (company.balance <= 10000) return; //do not pay dividends if not a good balance
            let payments = [];
            let totalInvested = 0;
            let toDistribute = Math.floor(company.balance*0.1);
            if (toDistribute === 0) return;
            Object.values(this.users).forEach(user => {
                Object.values(user.investments).forEach(inv => {
                    if (inv.slot === company.slot && inv.amount > 0) {
                        payments.push({user: user, amount:inv.amount});
                        totalInvested += inv.amount;
                    }
                })
            });
            if (payments.length > 0) {
                company.balance -= toDistribute;
            }
            for (let p of payments) {
                p.user.cash += p.amount * toDistribute / totalInvested;
            }
        });
    }

    processRegistration(entry) {  //{ slot: 'superhero', name: 'Big Corp Ltd.', reqId:10 }
        //validate entry
        if (!entry || !entry.slot || !entry.reqId) {
            console.log("Invalid registration",entry);
            this.audit(null,"Invalid registration received.");
            return;
        }
        if (this.companies[entry.slot] && !ALLOW_RE_REGISTERING) {
            console.log("Corporation already registered: "+entry.slot);
            this.audit(entry.slot, "Corporation already registered.");
            return;
        }
        //process entry
        let reg = {
          slot: entry.slot,
          name: entry.name || entry.slot,
          balance: 10000,
          units: 0,
          lastSold: 0,
          lastPrice: 0,
          key: Math.random().toString(36).substr(2,8)
        };
        this.companies[entry.slot] = reg;
        this.tickers.push(entry.slot);
        //publish success
        setTimeout(() => {
            publish(REGISTRATION_TOPIC + "." + entry.reqId, reg);
            this.audit(entry.slot, "Registered " + entry.slot + " as " + reg.name);
            console.log("Registered:", entry.reqId, reg);
        }, 100);
    }

    generateMarketPricing() {
        let offer = {
            offerId: Math.random().toString(36).substr(2,8),
            units: Math.floor(Math.random() * (50.0 * this.tickers.length)) + 10, //10..100 units
            price: Math.floor(Math.random() * 50) + 50  //50..100 prince //todo improve distribution
        };
        this.market = offer;
        return offer;
    }

    md5(str) {
        let md5sum = crypto.createHash('md5');
        md5sum.update(str);
        return md5sum.digest('hex');
    }

    processBid(bid) { //{ offerId: 'xyz123', slot: 'superhero', qty: 5, price: 30, signed: '123abcdef' }
        //validate bid
        if (!bid || !bid.slot) {
            console.log("Invalid bid",bid);
            this.audit(null,"Invalid bid, "+JSON.stringify(bid));
            return;
        }
        if (!bid.qty || !bid.price || !bid.signed || !bid.offerId) {
            this.audit(bid.slot, "Invalid bid, needs qty, price, offerId and signed");
            return;
        }
        if (bid.offerId !== this.market.offerId) {
            this.audit(bid.slot, "Invalid bid, placed too late or invalid offerId");
            return;
        }
        //validate bid signature
        if (!this.companies[bid.slot]) {
            this.audit(bid.slot, "You are not registered, please, re-register");
            return;
        }
        let goodSignature = this.md5(this.market.offerId+":"+this.companies[bid.slot].key);
        if (goodSignature !== bid.signed) {
            this.audit(bid.slot, "Invalid bid, bad signature");
        }
        //register bid
        this.bids[bid.slot] = {
            offerId: bid.offerId,
            slot: bid.slot,
            qty: bid.qty,
            price: bid.price
        };
        this.audit(bid.slot, "Offer accepted");
    }

    audit(ticker, msg) {
        let topic = ticker ? LOGS_TOPIC + "." + ticker : LOGS_TOPIC;
        publish(topic, {message: msg});
    }

    shutdown() {
        if (this.bidInterval) clearInterval(this.bidInterval);
        for(let c of clients) c.quit();
    }

    //allows players to invest
    invest(user, slot, amount) {
        try {
            if (this.users[user] && this.users[user].cash > amount) {
                let u = this.users[user];
                u.cash -= amount;
                //ensure investment is registered with user
                let inv = u.investments[slot];
                if (!inv) {
                    inv = { slot: slot, amount: 0 };
                    u.investments[slot] = inv;
                }
                //increase invesment amount for the slot
                inv.amount += amount;
                //give the money to the company
                this.companies[slot].balance += amount;
            }
            return true;
        } catch (e) { console.log("Investment failed:",e); }
        return false;
    }

    //ensure player registered
    ensureUser(login) {
        if (!this.users[login]) {
            this.users[login] = {
                balance()  {
                    let invested = Object.values(this.investments).map(i => i.amount).reduce((a, b) => a+b,0);
                    return {total:this.cash + invested, cash: this.cash, invested: invested};
                },
                cash: 10000,
                investments: {}, // { slot: 'superhero', amount: 100 }
                created: new Date()
            }
        }
    }

    getUserBalance(login) {
        return this.users[login].balance();
    }
}

module.exports = Exchange;