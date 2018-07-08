 This is a toy Market Exchange emulator.
 It is meant be used via Redis pub-sub for learning purposes.
 
1. Each player or observer could optionally subscribe to `exchange.logs` to receive logs of what is happening, 
especially errors
2. Requires each player to register and obtain a key via
    1) sending to registry `{ slot: 'escal', name: 'Big Corp Ltd.', reqId:1234 }` 
       and 
    2) receiving on `exchange.registry.1234` e.g. `{ slot: 'escal', balance: 10000, units:0, key: 'abc123def456' }` 
    where `reqId` (here "1234" for example) should be unique
3. Subscribe to market updates `exchange.market` and receive offers `{ offerId: 'xyz1dfk', units: 20, price: 23 }` 
every 10 seconds
4. Placing bids by sending to `exchange.bids` with content like
 `{ slot: 'escal', qty: 5, price: 30, signed: '123abcdef' }` will be
  evaluated at the end of each round, highest bids win, the rest of the units discarded, 
  signature is `md5(offerid+':'+key)`, key from (2ii);
  only one bid is accepted, if multiple bids arrive from the same corp for the same offer, latest wins.
5. Subscribe to `exchange.balances.escal` to receive your balances after each round, 
in form `{ slot: 'escal', units:0, bought: 5, price: 40, balance: 10050 }`