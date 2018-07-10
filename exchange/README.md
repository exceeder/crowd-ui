 This is a toy Market Exchange emulator.
 It is meant be used via Redis pub-sub for learning purposes.
 Note, that whenever you see 'superhero' in examples, replace it with one of the slot names in app.js
 
1. Each player or observer could optionally subscribe to `exchange.logs` to receive logs of what is happening, 
especially errors
2. Requires each player to register and obtain a key via
    1) sending to registry `{ slot: 'superhero', name: 'Big Corp Ltd.', reqId:1234 }` 
       and 
    2) receiving on `exchange.registry.1234` e.g. `{ slot: 'superhero', balance: 10000, units:0, key: 'abc123def456' }` 
    where `reqId` (here "1234" for example) should be unique
3. Subscribe to market updates `exchange.market` and receive offers `{ offerId: 'xyz1dfk', units: 20, price: 23 }` 
every 10 seconds
4. Placing bids by sending to `exchange.bids` with content like
 `{ slot: 'superhero', qty: 5, price: 30, signed: '123abcdef' }` will be
  evaluated at the end of each round, highest bids win, the rest of the units discarded, 
  signature is `md5(offerid+':'+key)`, key from (2ii);
  only one bid is accepted, if multiple bids arrive from the same corp for the same offer, latest wins.
5. Subscribe to `exchange.balances.superhero` to receive your balances after each round, 
in form `{ slot: 'superhero', units:0, bought: 5, price: 40, balance: 10050 }`
6. When players login, they can invest. Usually, and dividends are paid e.g. $0.20 per share per quarter. Here,
game assumes invested amount represents shares, and registered company distributes in dividends 10% of everything 
it owns, proportionally to invested amounts, with each turn.
                                                