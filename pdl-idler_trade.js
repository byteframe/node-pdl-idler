// XXX accepts all offers. should check by no items lost
global.receive_queue = (callback,targets,arg) =>
  callback(targets.map((target) => [ target, 'receive', arg ]));
global.receive = (account, arg) =>
  login(account, "", () =>
    account.tradeOfferManager.getOffers(3, null, (err, sent, received) =>
      received[0].accept(false, (err, status) =>
        output(account, err, 'accept', status + "=" + received[0].id))));

// send/accept trade offer via account index trade url | 752001&token=JICW9lTq TODO=getURL,item,truncate
global.offer_queue = (callback, targets, arg = "752001&token=JICW9lTq") => {
  if (isNaN(arg)) {
    return _offer_queue([arg, 0]);
  }
  login(idler.accounts[arg], "", () =>
    idler.accounts[arg].community.getTradeURL(
      (err, url, token) => _offer_queue([url.substr(51), arg])));
  _offer_queue = (arg) =>
    (!/[0-9]*\&token=.*/i.test(arg[0])) ?
      tprint("INVALID? tradeoffer: " + arg)
    : callback(targets.map((target) => [ target, 'offer', arg ]));
};
global.offer = (account, arg) =>
  login(account, "", () => {
    var inventories = [ [ "753", "6" ],[ "753", "7" ],[ "440", "2" ] ];
    (load_inventory = (i = 0) => {
      if (i != inventories.length) {
        return account.tradeOfferManager.getInventoryContents(
        inventories[i][0], inventories[i][1], true, (err, inventory) => {
          if (err) {
            return output(account, err, 'offer',
              inventories[i][0] + '_' + inventories[i][0] + ' inventory_fail');
          }
////////////////////////////////////////////////////////////////////////////////
          if (inventories[i][0] == '753') {
            inventory = inventory.filter((item) => {
              var send = true;
              item.tags.forEach((tag) =>
                (tag.name == 'Profile Background' || tag.name == 'Emoticon') && (
                  send = false));
              return send;
            });
          }
////////////////////////////////////////////////////////////////////////////////
          inventories[i] = inventory;
          load_inventory(i+1);
        });
      } else if (!inventories[0].length && !inventories[1].length) {
        return output(account, 1, 'offer', 'inventory_empty');
      }
      output(account, false, "inventory", "items=" +
        inventories[0].length + "+" + inventories[1].length, '', false);
      var offer = account.tradeOfferManager.createOffer(
        "https://steamcommunity.com/tradeoffer/new/?partner=" + arg[0]);
      inventories.forEach((inventory) => inventory.length && offer.addMyItems(inventory));
      offer.send((err, status) => {
        if (err) {
          return output(account, err, 'offer', "error=" + err.cause);
        } else if (status != 'pending') {
          return output(account, false, 'offer', 'complete=' + status);
        }
        output(account, false, "send", "state=" + status, '', false);
        account.community.acceptConfirmationForObject("identitySecret", offer.id, (err) => {
          var email = account.mail.replace(/[+].*/, '');
          //if (!fs.existsSync('share/' + email + '_token.json')) {
          //  return output(account, false, 'offer', 'pending=' + offer.id);
          //}
          ( get_gmail_confirmation = (attempt = 0) => {
            get_gmail(email, (err, gmails) => {
              var link = search_gmail(gmails, "https://steamcommunity.com/tradeoffer/"
                + offer.id + "/confirm?accountid", '"');
              if (!link) {
                if (attempt == 8) {
                  return output(account, true, 'offer', 'noLink=' + offer.id);
                }
                return setTimeout(() => get_gmail_confirmation(attempt+1), 1000);
              }
              output(account, false, "gmail", "tries=" + attempt
                + ",link=@" + link.substr(119,20), '', false);
              account.community.httpRequestGet({ "uri": link.replace(/&amp;/g, '&') }, (err, response, body) => {
                var result = body.indexOf('has been confirmed');
                if (!result || arg[1] == 0) {
                  return output(account, result, 'offer', 'confirm=' + offer.id);
                }
                output(account, false, "confirm", "id=#" + offer.id, '', false);
                idler.accounts[arg[1]].tradeOfferManager.getOffer(offer.id, (err, offer) =>
                  (err) ?
                    output(account, err, 'offer', 'getOffer=' + offer.id)
                  : offer.getUserDetails((err, me, them) =>
                    offer.accept(false, (err, status) =>
                      output(account, err, 'accept', status + "="
                        + me.escrowDays + "/" + them.escrowDays + "_days"))));
              }, "steamcommunity.com");
            });
          })();
        });
      });
    })();
  });