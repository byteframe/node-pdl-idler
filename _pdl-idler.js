// pdl-idler.js (0.100)
// Copyright (c) 2011-2018 byteframe@primarydataloop
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>

// print output message with timestamp
pad = (i) => ((i < 10) ? "0" + i : "" + i);
tprint = (line, newline = true, date = new Date()) =>
  ((line) => newline ? console.log(line) : process.stdout.write(line)
  )(('[' + pad(date.getHours()) + ':' + pad(date.getMinutes()) + ':' +
    pad(date.getSeconds()) + '] ').gray.dim + line);

// generic true/false output callback
output = (account, err, left, right, body = '', to_proceed = true) => {
  if (err === null && body !== '' && JSON.parse(body).success === false) {
    err = true;
  }
  if (account === null) {
    account = { name: "<" + os.hostname() + ">"};
  }
  var right_new = ''
    , status;
  if (!err) {
    status = 'SUCCESS'.green;
  } else if (!isNaN(err) && err == 11) {
    status = 'COMPLETE'.yellow;
  } else if (!isNaN(err) && err == 2) {
    status = 'NOTICE'.blue;
  } else {
    status = 'FAILURE'.red;
  }
  right = right.magenta.split(/[=,]/);
  for (var i = 0; i < right.length; i+=2) {
    right_new += right[i].underline.magenta.reset + '='.magenta;
    if (i != right.length-1) {
      right_new += right[i+1].bold.magenta.reset + ','.magenta;
    }
  }
  tprint(account.name.cyan + "| " + left.bold + " " + status + ": ".reset
    + right_new.magenta.substring(0, right_new.length-1).reset);
  if (to_proceed) {
    proceed();
  }
  return err;
};

// shuffle contents of an array/string
shuffle_array = (array) => {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random()*(i + 1));
    var t = array[i];
    array[i] = array[j];
    array[j] = t;
  }
  return array;
};
String.prototype.shuffle = function() {
  var a = this.split(""), n = a.length;
  for(var i = n - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1)), tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.join("");
}

// convert base64 to utf8 string
base64toUTF8 = (str) => new Buffer(str, 'base64').toString('utf8');

// request array of gmail messages;
var fs = require('fs');
const {google} = require('googleapis');
get_gmail = (email, callback, maxResults = 10, q = 'from:noreply@steampowered.com') => {
  var auth = emails[email];
  const googleAPIsGmail = google.gmail({ version: 'v1', auth });
  googleAPIsGmail.users.messages.list({
    auth: emails['pdlidler'], userId: 'me', maxResults: maxResults, q: q
  },(err, response, gmails = []) =>
    (err) ?
      console.dir(err)
    :(read_message = (m = 0) =>
      (m == response.data.messages.length) ?
        callback(false, gmails)
      : googleAPIsGmail.users.messages.get({
        auth: emails[email], userId: 'me', id: response.data.messages[m].id
      }, (err, response, body = '') => (
        response.data.payload.parts.forEach((part) => body += base64toUTF8(part.body.data)),
        gmails.push(body),
        read_message(m+1)))
    )())};

// search gmail messages for first instance of start/end string
search_gmail = (gmails, start, end) => {
  for (var i = 0; i < gmails.length; i++) {
    var start_index = gmails[i].indexOf(start);
    if (start_index > -1) {
      return gmails[i].slice(start_index, gmails[i].indexOf(end, start_index));
    }
  }
  return false;
};
// voteup/votedown/favorite/unfavorite/delete FILES | 1,2,3+4,5,6-votedown+7,8,9-favorite
global.file_queue = (callback, targets, arg) =>
  arg.split('+').forEach((arg) =>
    ((arg, actions = []) =>
      (!/[0-9][0-9]*/.test(arg[0]) || !/(subscribe|voteup|votedown|favorite|unfavorite|delete)/.test(arg[1])) ?
        tprint("ERROR! invalid file: " + arg[0])
      : (arg[0].split(',').forEach((file) =>
          targets.forEach((target, index) =>
            actions.push([target, 'file', [file, arg[1]]]))),
        callback(actions))
    )((arg + "-voteup").split('-')));
global.file = (account, arg) =>
  login(account, "", () =>
    account.community.httpRequestPost({
      "uri": 'https://steamcommunity.com/sharedfiles/' + arg[1],
      "form": { "sessionid": account.community.sessionID, "id": arg[0], "appid": ( arg[1] == 'subscribe' ? 250820 : 0) },
      "json": true,
    }, (err, response, body = '', result = (body === '' ? true : body.success)) =>
      output(account, (!err || result ? false : true), arg[1],
        SteamUser.EResult[result] + "=" + arg[0])));// XXX accepts all offers. should check by no items lost
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
          if (!fs.existsSync('share/' + email + '_token.json')) {
            return output(account, false, 'offer', 'pending=' + offer.id);
          }
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
  });var TF2Language = require('C:\\Users\\byteframe\\AppData\\Roaming\\npm\\node_modules\\tf2\\language.js');

// wait until game coordinator sends/sent backpack, then (down)load schema
var schema_url = '', schema_url_time = 0, schema = [];
coordinate = (account, arg, callback) =>
  play(account, "440", (date = Math.floor(new Date().getTime()/1000)) =>
    (schema_url != "" && date-schema_url_time < 600) ?
      callback()
    : account.community.httpRequestGet({
      "uri": 'https://api.steampowered.com/IEconItems_440/GetSchemaURL/v1/'
        + '?language=en&key=' + idler.apikey,
      "json": true,
    },(err, response, body) => {
      schema_url_time = date;
      schema_url = body.result.items_game_url;
      if (fs.existsSync('share/schema.json') && fs.existsSync('share/schema.url')
      && schema_url == fs.readFileSync('share/schema.url')) {
        if (!schema.length) {
          output(null, false, 'schema', 'saved=' + schema_url_time, '', false);
          schema = JSON.parse(fs.readFileSync('share/schema.json'));
        }
        return callback();
      }
      account.community.httpRequestGet({
        "uri": 'https://api.steampowered.com/IEconItems_440/GetSchemaItems/v0001/'
          + '?language=en&key=' + idler.apikey,
        "json": true,
      },(err, response, body) => (
        output(null, false, 'schema', 'download=' + schema_url_time, '', false),
        body.result.items.forEach((item) => schema[item.defindex] = item),
        fs.writeFileSync('share/schema.json', JSON.stringify(schema)),
        fs.writeFileSync('share/schema.url', schema_url),
        callback()
      ), "api.steampowered.com");
    }, "api.steampowered.com"));

// send professor speks via steamid64
global.thank_queue = (callback, targets, arg) =>
  (!/765611[0-9]*/i.test(arg)) ?
    tprint("INVALID? thank steamid: " + arg)
  : callback(targets.map((target) => [ target, 'thank', arg ]));
global.thank = (account, arg) =>
  coordinate(account, "", () =>
    (account.tf2.canSendProfessorSpeks) ? (
      account.tf2.sendProfessorSpeks(arg),
      output(account, false, 'thank', arg))
    : output(account, true, 'thank', "no specs"));

// sort item backpack by age/id TODO sort types and return buffer compare new and old backpakcs?
global.sort_queue = (callback, targets, arg = 0) =>
  (!/[0-5]/i.test(arg)) ?
    tprint("INVALID? sort type: " + arg)
  : callback(targets.map((target) => [ target, 'sort', +arg ]));
global.sort = (account, arg) =>
  coordinate(account, "sort", () => {
    account.tf2._handlers[TF2Language.BackpackSortFinished] = (body) => {
      account.tf2._handlers[TF2Language.BackpackSortFinished] = null;
      output(account, body.readByte(), 'sort', 'type=' + arg);
    };
    account.tf2.sortBackpack(arg);
  });

// consume item(s) via defindex XXX name tag consumption? paint can?
const packages = [ "5718", "5886", "5050" ];
const gifts = [ "5085" ];
global.use_queue = (callback, targets, arg = '') =>
  (arg !== '' && !/[0-9,]*/i.test(arg)) ?
    tprint("INVALID? use defindex: " + arg)
  : callback(targets.map((target) =>
    [ target, 'use', (arg === '' ? packages.concat(gifts) : arg.split(',')) ]));
global.use = (account, arg) =>
  coordinate(account, "", () => {
    var items = account.tf2.backpack.filter((item) => arg.indexOf(""+item.defIndex) != -1)
      , item_index = -1
      , item_count = 0;
    if (items.length === 0) {
      return output(account, 11, 'use', "consumed=none");
    }
    account.tf2.on('itemAcquired', (item) => {
      output(account, 2, 'item', 'tf2=' + schema[item.defIndex].name
        + " (" + items[item_index].defIndex + ")", '', false);
      if (item.defIndex == 5050) {
        items.push(item);
      }
      if (!--item_count) {
        _use();
      }
    });
    account.tf2.on('accountUpdate', (oldData) => {
      output(account, false, "expander", "sizes="
        + oldData.backpackSlots + ">" + account.tf2.backpackSlots, '', false);
      _use();
    });
    (_use = () => {
      if (++item_index == items.length) {
        account.tf2.removeAllListeners('itemAcquired');
        account.tf2.removeAllListeners('accountUpdate');
        return output(account, false, 'use', 'count=' + items.length);
      }
      if (items[item_index].defIndex == 5085) {
        item_count = 1;
        return account.tf2.unwrapGift(items[item_index].id);
      }
      item_count = 8;
      account.tf2.useItem(items[item_index].id);
    })();
  });

// delete items via defindex from player backpack
const crates = [ "5734","5735","5742","5752","5781","5802","5803","5849","5859","5875","5871","5888" ];
const events = [ "673","655","5083",'notrade' ];
global.waste_queue = (callback, targets, arg = '') =>
  (arg !== '' && !/[0-9,]*/i.test(arg)) ?
    tprint("INVALID? waste defindex: " + arg)
  : callback(targets.map((target) =>
    [ target, 'waste', (arg === '' ? crates.concat(events) : arg.split(',')) ]));
select_weapon_items = (item) =>
  schema[item.defIndex] &&
  schema[item.defIndex].craft_material_type == 'weapon' &&
  schema[item.defIndex].name.indexOf('TF_WEAPON_') == -1 &&
  schema[item.defIndex].name.indexOf('Festive') == -1 &&
  schema[item.defIndex].name.indexOf('Botkiller') == -1 &&
  schema[item.defIndex].item_class != 'saxxy' && item.quality == 6;
select_tradeable_items = (item) =>
  item.attribute.findIndex((attribute) => attribute.defIndex == 153) == -1;
global.waste = (account, arg) =>
  coordinate(account, "waste", () => {
    var items = account.tf2.backpack.filter((item) => arg.indexOf(""+item.defIndex) != -1);
    if (arg.indexOf('notrade') > -1) {
      items = items.concat(account.tf2.backpack.filter((item) =>
        select_weapon_items(item) && !(select_tradeable_items(item))));
    }
    if (items.length === 0) {
      return output(account, 11, 'waste', "deleted=none");
    }
    var item_count = items.length;
    account.tf2.on('itemRemoved', (itemdata) => {
      if (!--item_count) {
        account.tf2.removeAllListeners('itemRemoved');
        output(account, false, 'waste', "deleted=" + items.length);
      }
    });
    items.forEach((item, index) =>
      setTimeout(() => account.tf2.deleteItem(item.id), 250*index++));
  });

// create metal with optional comma-seperated weapon defindex negations
const negations = [ '266','433','452','466','572','574','587','638','727','850','851','863','933','947' ];
global.craft_queue = (callback, targets, arg = '') =>
  (arg !== '' && !/[0-9,]*/i.test(arg)) ?
    tprint("INVALID? craft defindex: " + arg)
  : callback(targets.map((target) =>
    [ target, 'craft', (arg == '' ? negations : arg.split(',')) ]));
select_craftable_items = (item) =>
  item.attribute.findIndex(attribute => attribute.defIndex == 449) == -1;
global.craft = (account, arg) =>
  coordinate(account, "craft", () => {
    account.tf2.on('craftingComplete', () => --craft_count || _craft());
    var craft_mode = -1;
    (_craft = () => {
      if (++craft_mode > 2) {
        account.tf2.removeAllListeners('craftingComplete');
        var detail = (typeof craft_count === 'undefined')
          ? 'changed=none' : "bp=" + account.tf2.backpack.length
        return output(account, (typeof craft_count === 'undefined' ? 11 : false),
          'craft', detail);
      }
      if (craft_mode == 0) {
        var items = account.tf2.backpack.filter((item) =>
          arg.indexOf(item.defIndex) == -1 && select_weapon_items(item)
          && select_tradeable_items(item) && select_craftable_items(item));
        var craft_available = items.length
          , craft_total = account.tf2.backpack.filter((item) =>
            schema[item.defIndex] &&
            schema[item.defIndex].craft_material_type == 'weapon').length;
      } else {
        var items = account.tf2.backpack.filter((item) => {
          if (craft_mode == 1) {
            return item.defIndex == 5000 && select_tradeable_items(item);
          }
          return item.defIndex == 5001 && select_tradeable_items(item);
        })
        var craft_total = items.length;
      }
      var crafts = [];
      while (true) {
        if ((craft_mode == 0 && items.length < 2)
        || ((craft_mode > 0 && items.length < 3))) {
          break;
        }
        if (craft_mode == 0) {
          var first = items.shift()
            , classes = schema[first.defIndex].used_by_classes || []
            , choices = items.filter((item) => classes.filter((n) =>
              schema[item.defIndex].used_by_classes.indexOf(n) != -1).length);
          if (!choices.length) {
            continue;
          }
          crafts.push(
            [first.id, items.splice(items.indexOf(choices.shift()), 1)[0].id]);
        } else {
          crafts.push([items.shift().id, items.shift().id, items.shift().id]);
        }
      }
      if (crafts.length) {
        craft_count = crafts.length;
        if (craft_mode == 0) {
          output(account, false, 'smelting', "weapons=" + craft_count*2 + '/'
            + craft_available + '/' + craft_total, '', false);
        } else if (craft_mode == 1) {
          output(account, false, 'combining', "scrap=" + craft_count*3 + '/'
            + craft_total, '', false);
        } else {
          output(account, false, 'joining', "reclaimed=" + craft_count*3 + '/'
            + craft_total, '', false);
        }
        crafts.forEach((craft, index) =>
          setTimeout(() => account.tf2.craft(craft), 200*index++));
      } else {
        if (typeof craft_count !== 'undefined') {
          craft_count = -1;
        }
        _craft();
      }
    })();
  });

// combined use, waste, craft, then sort | crates+negations+sortType
global.deterge_queue = (callback, targets, arg = '') =>
  (_deterge_queue = (arg, actions = [], q = 0) =>
    use_queue((actions_u) =>
      waste_queue((actions_w) =>
        craft_queue((actions_c) =>
          sort_queue((actions_s) => {
            actions = actions.concat(
              actions_u).concat(actions_w).concat(actions_c).concat(actions_s);
            (q < targets.length-1) ?
              _deterge_queue(arg, actions, q+1)
            : callback(actions, true);
          }, [ targets[q] ], arg[3])
        , [ targets[q] ], arg[2])
      , [ targets[q] ], arg[1])
    , [ targets[q] ], arg[0])
  )(arg.split('+'));

// adjust profile privacy settings | 3-3-3-3-3-0-1
var privacy_time = -1
  , privacy_interval = 9000;
global.privacy_queue = (callback, targets, arg) =>
  (!/[1-3][-][1-3][-][1-3][-][1-3][-][1-3]/.test(arg)) ?
    tprint("ERROR! invalid privacy: " + arg)
  : callback(targets.map((target) => [ target, 'privacy', arg ]));
global.privacy = (account, arg) =>
  login(account, "", () =>
    setTimeout(() => (
      privacy_time = new Date().getTime()+privacy_interval,
      account.community.profileSettings({
        profile: arg.substr(0, 1),
        comments: arg.substr(2, 1),
        inventory: arg.substr(4, 1),
        friendsList: arg.substr(4, 1),
        gameDetails: arg.substr(8, 1),
        playtime: (arg.substr(12, 1) == '1'),
        inventoryGifts: (arg.substr(14, 1) == '1')
      }, (err) =>
        output(account, err, 'privacy', arg))
    ), privacy_time-new Date().getTime()));

// upload avatar image $URL
var avatar_time = -1
  , avatar_interval = 12000;
global.avatar_queue = (callback, targets, arg = 'https://steamcdn-a.akamaihd.net/steamcommunity/public/images/avatars/fe/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg') =>
  callback(targets.map((target) => [ target, 'avatar', arg ]));
global.avatar = (account, args) =>
  setTimeout(() => (
    avatar_time = new Date().getTime()+avatar_interval,
    login(account, "", () =>
      account.community.uploadAvatar(args, null, (err, url) =>
        output(account, err, 'avatar', (err ? 'error' : url.substr(-10)))))
  ), avatar_time-new Date().getTime());

// set persona state
global.persona_queue = (callback, targets, arg) =>
  callback(targets.map((target) => [ target, 'persona', +arg ]));
global.persona = (account, arg) =>
  login(account, "", () => (
    account.user.setPersona(arg),
    output(account, false, 'persona', arg)));

// set player name XXX arg
global.rename_queue = (callback, targets, arg) =>
  callback(targets.map((target) => [ target, 'rename', arg ]));
global.rename = (account, arg) =>
  login(account, "", () =>
    account.user.getAliases(account.user.steamID, (err, results) => (
      account.user.setPersona(SteamUser.EPersonaState.Offline, arg),
      output(account, false, 'rename', "now=" + arg))));

// #############################################################################
// ANOTHER USER?
// WIKIPEDIA PAGE?
/*global.profile = (account, args) {
  //
  for (var prop in account.user.myFriends) {
    if (`${account.user.myFriends[prop]}` == 2) {
      console.log('http://steamcommunity.com/profiles/' + `${prop}`)
      account.user.removeFriend(`${prop}`);
    }
  }
  account.community.httpRequestGet({
    "uri": 'https://en.wikipedinput.match(/(?:[^\s"]+|"[^"]*")+/g)ia.org/wiki/' + args[a],
  }, (err, response, body) {
    //output(account, err, 'rate', args[a][0]+args[a][1]);
    //console.log($('h1').children().first().text());
    //console.log($('p').children().first().text());
    var $ = Cheerio.load(body);
    console.log($('h1')[0].children[0].data);
    console.log($('p').eq(0).text());
   // console.log($('p')[0].data);
  }, "wikipedia.org");
};*/

// #############################################################################
// https://gist.github.com/Ne3tCode/7ac3dbf68707a7f262b1db83bdae97ae
// XXX complete some of the community badge objectives
// http://steamcommunity.com/profiles/76561198178392694/badges/2
// 1-96,201-232,101-104,133,165 vote discover
// 1-96,201-232,101-104,133,165 play=badge
//https://paste.ee/p/9jw5U
// MISC CARDS done on 201-232 rest remain
// CURRENTLY doing 1-64,101-104,133,165
/*global.socialize_queue = (targets) => {
  targets.forEach((target, index) => {
    action_queue.push([target, 'socialize', '']);
  });
  // XXX enqueue actions seperately? for  code readability,indents?
  // dont in th end prolly need seperat eactions seeing its other stuff
  // some kind of list thing. array of funcutions?
  //socialize could enqueue actions  seperately
  // use request to check the badge? will it work on privates? no 
};
global.socialize = (account, arg) => {
  login(account, '', () => {
    account.community.httpRequestGet({
      "uri": "http://steamcommunity.com/my/badges/2",
    }, (err, response, body) => {
      [ [ 'ViewBroadcast', [ 'watch', 0 ], ],
        [ 'UseDiscoveryQueue', [ 'discover', 1 ], ],
        [ 'AddItemToWishlist', [ 'profile???', 1 ], ],
        [ 'AddFriendToFriendsList', [ 'profile???', 1 ], ],
        [ 'PlayGame', [ 'XXX', 1 ], ],
        [ 'RecommendGame', [ 'profile???', 1 ], ],
        [ 'PostScreenshot', [ 'profile???', 1 ], ],
        [ 'RateWorkshopItem', [ 'profile???', 1 ], ],
        [ 'SubscribeToWorkshopItem', [ 'profile???', 1 ], ],
        // ++setavatar
        [ 'SetupCommunityRealName', [ 'profile???', 1 ], ],
        // SetAprofileBackground
        [ 'JoinGroup', [ 'XXX', 1 ], ],
        [ 'PostCommentOnFriendsPage', [ 'profile???', 1 ], ],
        // [ 'RATEACTIVITYITEM', [ 'profile???', 1 ], ],
        [ 'PostStatusToFriends', [ 'profile???', 1 ], ],
        [ 'PostCommentOnFriendsScreenshot', [ 'profile???', 1 ], ],
        // FeatureABadgeOnAProfile
        // [ 'SearchSteamDiscussions', [ 'profile???', 1 ], ],
      ].forEach((badge_task) {
        if (body.indexOf(badge_task[0] + "_off")) {
          action_queue.unshift(account, badge_task[1][0], badge_task[1][1]);
        }
      });
      proceed();
    }, "steamcommunity.com");
  });
};
 25-7=EUseEmoticonInChat BCraftGameBadge TTrade AFacebook OInOverlay MOnMarket YPostVideo
global.watch = (account, arg) {
login???      // watch a broadcast
  account.community.httpRequestGet({
    "uri": 'http://steamcommunity.com/apps/allcontenthome?appHubSubSection=13',
  }, (err, response, body) {
    var match = body.match(/watch\/(\d+)/);
    if (!match) {
      return output(account, err, 'socialize', 'broadcast=no_match')
    }
    account.community.httpRequestGet({
      "uri": 'http://steamcommunity.com/broadcast/getbroadcastmpd/?steamid='
        + match[1] + '&broadcastid=0&viewertoken=0',
      "json": true
    }, (err, response, body) {
      output(account, err, 'socialize', 'broadcast=' + body.broadcastid)
    }, "steamcommunity.com");
  }, "steamcommunity.com");
};*/

// join OR leave/enter/exit a $GROUP | 103582791432062115-enter
global.group_queue = (callback, targets, arg) =>
  (arg =>
    !/(join|leave|enter|exit)/.test(arg[1]) ?
      output(null, true, 'input', 'group=' + arg[1], '', false)
    : callback(targets.map(target => [ target, 'group', arg ]))
  )((arg + '-join').split('-', 2));
global.group = (account, arg) =>
  login(account, "", () =>
    account.community.getSteamGroup(arg[0], (err, group, chat = account.user.chats[group.steamID.getSteamID64()]) =>
      (err) ?
        output(account, err, "getGroup", arg[0])
      : (arg[1] == 'exit') ?
        (typeof chat == 'undefined') ?
          output(account, true, 'enter', 'not entered')
        : (account.user.leaveChat(group.steamID.getSteamID64()),
          output(account, false, 'exit', arg[0]))
      : (arg[1] == 'enter') ?
        (typeof chat !== 'undefined') ?
          output(account, true, 'enter', 'already joined')
        : account.user.joinChat(group.steamID, (result) =>
          output(account, (result != SteamUser.EResult.OK), 'enter',
            'gid= ' + group.steamID.accountID + ', status=' + SteamUser.EResult[result]))
      : account.community.getSteamUser(account.user.steamID, (err, user) =>
        (err) ?
          output(account, err, "getUser", arg[0])
        : (joined =>
          (arg[1] == 'join') ?
            (joined > -1) ?
              output(account, true, 'join', 'already joined')
            : account.community.joinGroup(group.steamID, (err) => 
              output(account, err, 'join', arg[0]))
          : (joined == -1) ?
            output(account, true, 'leave', 'not joined')
          : account.community.leaveGroup(group.steamID, (err) =>
            output(account, err, 'leave', arg[0]))
        )(user.groups == null ? -1 : user.groups.find(g => g.accountID == group.steamID.accountID)))));

// test and consume a steam game key for one account | redeem=12345-ABCDEF-98765
global.redeem_queue = (callback, targets, arg) =>
  (!/[0-9a-z]{5}[-][0-9a-z]{5}[-][0-9a-z]{5}/i.test(arg)) ?
    tprint("INVALID? steam key: " + arg)
  : (targets.length > 1) ?
    tprint("INVALID? multiple targets: " + arg)
  : callback([[targets[0], 'redeem', arg]]);
global.redeem = (account, arg) =>
  login(account, "", () =>
    account.user.redeemKey(arg, (result, details, packages) =>
      output(account, (result != SteamUser.EResult.OK), 'redeem', arg+packages)));

// simulate gameplay for appid(s)="440,570,4000" XXX deniedRelogin?
global.play_queue = (callback, targets, arg = '') =>
  (arg !== '' && arg !== 'badge' && !/[0-9,]+/.test(arg)) ?
    tprint("INVALID? appid(s): " + arg)
      : callback(targets.map((target) => [ target, 'play', arg ]));
global.play = (account, arg, callback = (err) => proceed()) =>
  login(account, "", () => {
    var check_badges = (p = 1, callback, games =[]) =>
      account.community.httpRequestGet({
        "uri": 'https://steamcommunity.com/profiles/' +
          account.user.steamID.getSteamID64() + '/badges/?p=' + p,
      }, (err, response, body) => {
        if (body.indexOf('Access Denied') != -1) {
          return output(account, true, "badge", "DENIED");
        }
        var $ = Cheerio.load(body)
          , links = $('a.btn_green_white_innerfade');
        for (var i = 0; i < links.length; i++) {
          games.push(+links[i].attribs['href'].substr(12));
        }
        if (body.indexOf('?p=' + (p+1)) != -1) {
          return check_badges(p+1, callback);
        }
        if (!games.length) {
          output(account, 11, "play", "apps=no_badge", '', false);
        }
        callback(games);
      }, "steamcommunity.com");
    arg = arg.split(',');
    account.badging = false;
    _play = (games) => {
      var unowned_games = false, gamesPlaying = [], coordinating = false, unowned_assume = false;
      (games_for_each = (i = 0) => {
        var appid = games[i];
        if (i != games.length) {
          if (!account.user.ownsApp(+appid) && unowned_assume == false) {
            return account.user.requestFreeLicense(+appid, (err, packages, apps) => {
              output(account, err, 'claim', `app=${appid},pax=${packages}`, '', false);
              if (err) {
                unowned_games = true;
                return games_for_each(i+1);
              }
              unowned_assume = true;
              games_for_each(i);
            });
          } else if (account.gamesPlaying.indexOf(+appid) == -1
          && gamesPlaying.indexOf(+appid) == -1) {
            unowned_assume = false;
            gamesPlaying.push(+appid);
            if (+appid == 440) {
              coordinating = true;
              account.tf2.once('connectedToGC', (version) =>
                output(account, false, 'coordinate', 'ver=' + version, "", false));
              account.tf2.once('backpackLoaded', () => (
                output(account, false, 'backpack', 'size='
                  + account.tf2.backpack.length + "/" + account.tf2.backpackSlots, "", false), // XXX wait until all are done or something account
                callback()));
              account.tf2.once('accountLoaded', () =>
                output(account, false, 'account', 'prem='
                  + account.tf2.premium + ",spek="
                  + account.tf2.canSendProfessorSpeks, "", false));
            }
          }
          games_for_each(i+1);
        } else {
          if (gamesPlaying.length) {
            account.new_items_interval = setInterval(() => {
              account.user.gamesPlayed([]);
              account.user.once('playingState', () =>
                (account.badging ? check_badges(1, (games) => account.user.gamesPlayed(games))
                  : account.user.gamesPlayed(account.gamesPlaying)));
            }, 300000);
            account.gamesPlaying = account.gamesPlaying.concat(gamesPlaying);
            account.user.gamesPlayed(account.gamesPlaying);
            account.user.once('playingState', () => {
              output(account, false, 'play', "apps=" + account.gamesPlaying.join('-'), '', false);
            });
          } else if (unowned_games) {
            output(account, true, 'play', "unowned=["+games+"]", '', false);
          }
          if (!coordinating) {
            callback();
          }
        }
      })();
    };
    if (arg[0] == 'badge') {
      account.badging = true;
      return check_badges(1, (games) => (games.length ? _play(games) : callback()));
    } else if (arg[0] === '') {
      if (account.gamesPlaying.length) {
        output(account, false, 'play', "clear="+account.gamesPlaying.length, '', false);
      }
      account.gamesPlaying = [];
      account.user.gamesPlayed([]);
      clearInterval(account.new_items_interval);
      return callback();
    } else {
      _play(arg);
    }
  });
// claim unowned free license(s) via appid | 440,24240,63380
global.claim_queue = (callback, targets, arg) =>
  (!/[0-9,]+/.test(arg)) ?
    tprint("INVALID? appid: " + arg)
  //: callback(arg.split(',').map((appid) => [target, 'claim', appid])); // XXX TODO FIXME fuccked it up
  : callback(targets.map((target) => [ target, 'claim', arg ]));
global.claim = (account, arg) =>
  login(account, "", () => {
    if (account.user.ownsApp(arg)) {
      return output(account, true, 'claim', 'alreadyOwned(' + arg + ')');
    }
    account.community.httpRequestGet({
      "uri": 'https://store.steampowered.com/app/' + arg,
    }, (err, response, body) => {
      var $ = Cheerio.load(body)
        , addto = $('div.btn_addtocart span')[0].children[0].data.trim()
        , price = $('div.game_purchase_price')[0];
      if ($('div.game_area_comingsoon').length) {
        price = 'Coming Soon';
      } else if (/(Install|Play).*/.test(addto)) {
        price = "Free " + addto.replace(' Game', '');
      } else if (typeof price == 'undefined') {
        price = 'Unknown=' + addto;
      } else {
        price = price.children[0].data.trim();
      }
      if (price.indexOf('Free') > -1) {
        var subid = $('div.btn_addtocart a')[0].attribs.href.match(/\d+/)[0];
        if (typeof subid !== 'undefined') {
          return account.community.httpRequestPost({
            "uri": 'https://store.steampowered.com/checkout/addfreelicense/' + subid,
            "form": { "ajax": true, "sessionid": account.community.sessionID }
          }, (err, response, body) =>
            output(account, err, 'claim', `app:${arg},sub:${subid}`)
          , "store.steampowered.com");
        }
        return account.user.requestFreeLicense(+arg, (err, packages, apps) =>
          output(account, err, 'claim', `app=${arg},pax=${packages}`));
      }
      output(account, true, 'claim', arg + ', prc=' + price);
    }, "store.steampowered.com");
  });

// complete store app discovery queue cycles | 4
global.discover_queue = (callback, targets, arg = 4) =>
  (!/[0-9]/.test(arg)) ?
    tprint("INVALID? discovery cycle count: " + arg)
  : callback(targets.map((target) => [ target, 'discover', arg ]));
global.discover = (account, arg, errors = '') =>
  login(account, "", (total = arg*12) =>
    (_discover = () =>
      account.community.httpRequestPost({
        "uri": 'https://store.steampowered.com/explore/generatenewdiscoveryqueue',
        "form": { "sessionid": account.community.sessionID, "queuetype": 0 },
        "json": true
      }, (err, response, body) => {
        if (err) {
          output(account, err, "generate",
            "result="+(typeof body === 'undefined' ? 'undefined' : SteamUser.EResult[body]), '', false);
          errors += '+';
          return setTimeout(_discover, 1000);
        }
        var queue = body.queue
          , complete = queue.length;
        queue.forEach((appid, index) =>
          account.community.httpRequestPost({
            "uri": 'https://store.steampowered.com/app/10',
            "form": { "sessionid": account.community.sessionID,
              "appid_to_clear_from_queue": appid, }
          }, (err, response, body) => {
            if (err) {
              errors += '-';
              output(account, err, "mark", 'total=' + total + ",appid=" + appid, '', false);
            } else {
              --total;
            }
            if (--complete == 0) {
              output(account, false, "cycle", 'total=' + total + ',length=' + queue.length, '', false);
              if (total < 1) {
                output(account, false, 'discover', "errors="+(errors.length ? errors : 'none'));
              } else {
                _discover();
              }
            }
          }));
      }))());

// vote during the sale period
global.vote_queue = (callback, targets) =>
  request('https://store.steampowered.com/SteamAwards', (err, response, body) => {
    var $ = Cheerio.load(body)
      , appids = $('div.vote_nomination');
    callback(targets.map((target) => {
      return [target, 'vote', [ appids[0].parent.attribs['data-voteid'],
        appids[Math.floor(Math.random()*appids.length)].attribs['data-vote-appid']]];
    }));
  });
global.vote = (account, arg) =>
  login(account, "", () =>
    account.community.httpRequestPost({
      "uri": 'https://store.steampowered.com/salevote',
      "form": { "sessionid": account.community.sessionID,
        "voteid": arg[0], "appid": arg[1], }
    }, (err, response, body, cnt = body.match(/\d+/)) =>
      (err || !cnt) ? (
        output(account, true, 'vote', 'id=' + arg.join(',app='), '', false),
        setTimeout(vote, 3000, account, arg)
      ):output(account, err, 'vote', 'id=' + arg.join(',ap=') + ',cnt=' + cnt[0])));

// wishlist appid(s)="476600,513710+addto|removefrom"
global.wishlist_queue = (callback, targets, arg) => {
  arg = arg.split('+', 2);
  if (arg.length < 2) {
    arg.push('addto');
  }
  if (!/[0-9,]*/.test(arg)) {
    return tprint("INVALID? appid: " + arg);
  }
  arg.split(',').forEach((appid) =>
    targets.forEach((target) => actions.push([target, 'wishlist', [appid, arg[1]]])));
  callback(actions);
};
global.wishlist = (account, arg) =>
  login(account, "", () =>
    account.community.httpRequestPost({
      "uri": 'https://store.steampowered.com/api/' + arg[1] + 'wishlist',
      "form": { "sessionid": account.community.sessionID, "appid": arg[0] }
    }, (err, response, body) =>
      output(account, err, 'wishlist', arg, body)));

// rate review(s)="reviewid1,reviewid2+rateup|ratedown+true|false|skip" XXX remove tag?
global.review_queue = (callback, targets, arg) => {
  arg = arg.split('+', 3);
  if (arg.length < 2) {
    arg.push('rateup');
  }
  if (arg.length < 3) {
    arg.push('skip');
  }
  if (!/[0-9]{7}[0-9]*/.test(arg[0]) || !/(rateup|ratedown)/.test(arg[1]) ||
  !/(true|false)/.test(arg[2])) {
    return tprint("INVALID? review: " + arg[0]);
  }
  arg.split(',').forEach((appid) =>
    targets.forEach((target) => actions.push([target, 'review', [appid, arg[1], arg[2]]])));
  callback(actions);
};
global.review = (account, arg) =>
  login(account, "", () =>
    account.community.httpRequestPost({
      "uri": 'https://steamcommunity.com/userreviews/rate/' + arg[0],
      "form": { "rateup": (arg[1] == 'rateup' ? true : false),
        "sessionid": account.community.sessionID, }
    }, (err, response, body) => {
      if (arg.length == 3 && arg[2] !== 'skip') {
        account.community.httpRequestPost({
          "uri": 'https://steamcommunity.com/userreviews/votetag/' + arg[0],
          "form": { "tagid": 1, "rateup": arg[2],
            "sessionid": account.community.sessionID }
        }, (err, response, body) => output(account, err, "review+"+arg[1], arg)
        , "steamcommunity.com");
      } else {
        output(account, err, "review+"+arg[1], arg);
      }
    }, "steamcommunity.com"));

// follow a curator on the store
global.follow_queue = (callback, targets, arg = '2751860') =>
  callback(targets.map((target) => [ target, 'follow', arg ]));
global.follow = (account, arg) =>
  login(account, "", () =>
    account.community.httpRequestPost({
      "uri": 'https://store.steampowered.com/curators/ajaxfollow',
      "form": { 'clanid': arg, 'sessionid': account.community.sessionID }
    }, (err, response, body) =>
      output(account, err, "follow", arg)));

// complete game idling activities for the summer cleaning event
global.spring_queue = (callback, targets, arg = '') =>
  callback(targets.map((target) => [ target, 'spring', arg ]));
global.spring = (account, arg) =>
  login(account, "", () =>
    account.community.httpRequestGet({
      "uri": 'https://store.steampowered.com/springcleaning'
    }, (err, response, body) => {
      var links = Cheerio.load(body)('a').filter((index, link) => link.attribs.href.indexOf('/task/') > -1)
        , appids = [];
      (for_each_link = (i = 0) => {
        if (i == links.length) {
          if (!appids.length) {
            return output(account, false, "spring", 'length=0', '');
          }
          return play(account, appids.join(','), (err) => {
            setTimeout(() => {
              play(account, '', (err) => {
                proceed();
              });
            }, 5000);
          });
        }
        account.community.httpRequestGet({
          "uri": links[i].attribs.href
        }, (err, response, body) => {
          body = Cheerio.load(body);
          if (body('div.spring_task_shelf_text').text().indexOf('Completed May') == -1
          && body('span.spring_game a').length) {
            appids.push(body('span.spring_game a')[0].attribs.href.toString().match(/\d+/)[0]);
          }
          for_each_link(i+1);
        });
      })();
    }));

// find and open community event items
global.mystery_queue = (callback, targets, arg = '866860-Mystery Item') =>
  callback(targets.map((target) => [ target, 'mystery', arg ]));
global.mystery = (account, arg) =>
  login(account, "", (found = false, proceeded = false) =>
    account.community.getUserInventoryContents(account.user.steamID, 753, 6, false, 'english', (err, inventory, currencies, count) => {
      inventory.some((item) => {
        if (item.market_hash_name == arg) {
          found = true;
          return account.community.httpRequestPost({
            "uri": "https://steamcommunity.com/" + getProfileURL(account) + "/ajaxactivateconsumable/",
            "form": {
              "sessionid": account.community.sessionID,
              "appid": item.market_fee_app,
              "item_type": 6,
              "activate": 1,
              "assetid": item.assetid,
              "actionparams": "{\"action\":\"unpack_2018mystery\"}"
            }
          }, (err, response, body) => {
            output(account, err, "mystery", item.market_fee_app + '=' + item.assetid);
          }, "steamcommunity.com");
        } else if (item.market_fee_app == 866860) {
          found = true;
//##############################################################################
          var form = {
            "sessionid": account.community.sessionID,
            "appid": item.market_fee_app,
            "assetid": item.assetid,
            "contextid": item.contextid
          };
          /*return account.community.httpRequestGet({
            "uri": "https://steamcommunity.com/" + getProfileURL(account) + "/ajaxgetgoovalue/",
            "form": form,
            "json": true
          }, (err, response, body) => {*/
            form.goo_value_expected = 10;// XXX body.goo_value;
console.log(form);
            account.community.httpRequestPost({
              "uri": "https://steamcommunity.com/" + getProfileURL(account) + "/ajaxgrindintogoo/",
              "form": form,
              "json": true
            }, (err, response, body) => {
console.dir(body);
if (!proceeded) {
  proceeded = true;
              output(account, err, "mystery", item.market_fee_app + '=' + item.assetid);
}
            }, "steamcommunity.com");
          //}, "steamcommunity.com");
//##############################################################################
        }
      });
      if (!found) {
        output(account, 11, "mystery", 'unfound=' + arg);
      }
    }));

// login and get access token for alien game
global.alien_queue = (callback, targets, arg = 1) =>
  callback(targets.map((target) => [ target, 'alien', arg ]));
global.alien = (account, arg) =>
  login(account, "", (found = false) => {
    if (account.alien_active) {
      return output(account, 11, "alien", 'active');
    }

    // request player info
    request_info = () => {
      account.community.httpRequestPost({
        "uri": account.alien_token.webapi_host_secure + 'ITerritoryControlMinigameService/GetPlayerInfo/v0001',
        "json": true,
        "form": { "access_token": account.alien_token.token }
      }, (err, response, body_info) => {
        if (err) {
          output(account, err, "info", err, '', false);
          return setTimeout(request_info, 3000);
        }
        if (!body_info.response.active_planet) {
          return request_planets();
        }

        // quit game
        (request_quit = () => {
          account.community.httpRequestPost({
            "uri": account.alien_token.webapi_host_secure
              + 'IMiniGameService/LeaveGame/v0001',
            "json": true,
            "form": { "gameid": body_info.response.active_planet,
              "access_token": account.alien_token.token }
          }, (err, response, body) => {
            output(account, err, "quit", 'gameid=' + body_info.response.active_planet, '', false);
            if (err) {
              return setTimeout(request_quit, 3000);
            }

            // represent clan
            (request_represent = () => {
              account.community.httpRequestPost({
                "uri": account.alien_token.webapi_host_secure
                  + 'ITerritoryControlMinigameService/RepresentClan/v0001',
                "json": true,
                "form": { "clanid": Object.keys(account.user.myGroups)[0], "access_token": account.alien_token.token }
              }, (err, response, body) => {
                if (err) {
                  output(account, err, "represent=", arg, '', false);
                  return setTimeout(request_represent, 3000);
                }
                request_planets();
              });
            })();
          });
        })();
      });
    };

    // request planets
    request_planets = () => {
      account.community.httpRequestGet({
        "uri": account.alien_token.webapi_host_secure
          + 'ITerritoryControlMinigameService/GetPlanets/v0001?active_only=1&language=english',
        "json": true
      }, (err, response, body) => {
        if (err) {
          output(account, err, "planets", '?', '', false);
          return request_planets();
        }
        shuffle_array(body.response.planets).some((planet) => {
          if (!planet.state.captured) {

            // request planet
            (request_planet = () => {
              account.community.httpRequestGet({
                "uri": account.alien_token.webapi_host_secure
                  + 'ITerritoryControlMinigameService/GetPlanet/v0001?id=' + planet.id + '&language=english',
                "json": true
              }, (err, response, body) => {
                if (err) {
                  output(account, err, "planet=", planet.id, '', false);
                  return request_planet();
                }
                shuffle_array(body.response.planets[0].zones).some((zone) => {
                  if (!zone.captured) {
                    request_join(planet, zone);
                    return true;
                  }
                });
              });
            })();
            return true;
          }
        });
      });
    };

    // join planet
    request_join = (planet, zone) => {
      account.community.httpRequestPost({
        "uri": account.alien_token.webapi_host_secure + 'ITerritoryControlMinigameService/JoinPlanet/v0001',
        "form": { "id": planet.id, "access_token": account.alien_token.token }
      }, (err, response, body) => {
        if (err) {
          output(account, err, "join", 'planet=' + planet.id, '', false);
          return request_join(planet.id, zoneid);
        }

        // enter zone
        (request_join_zone = () => {
          account.community.httpRequestPost({
            "uri": account.alien_token.webapi_host_secure
              + 'ITerritoryControlMinigameService/JoinZone/v0001',
            "form": { "zone_position": zone.zone_position, "access_token": account.alien_token.token }
          }, (err, response, body) => {
            output(account, err, "join", 'planet=' + planet.id + ",zone=" + zone.zone_position, '', false);
            if (err) {
              return request_join_zone();
            }
            account.alien_active = true;
            proceed();

            // report score
            setTimeout(() => {
              (report_score = () => {
                account.community.httpRequestPost({
                  "uri": account.alien_token.webapi_host_secure
                    + 'ITerritoryControlMinigameService/ReportScore/v0001',
                  "json": true,
                  "form": {
                    "access_token": account.alien_token.token,
                    "language": 'english',
                    "score": (() => {
                      switch (zone.difficulty) {
                        case 2: return score = 10 * 120;
                        case 3: return score = 20 * 120;
                        default: return score = 5 * 120;
                      }
                    })
                  }
                }, (err, response, body) => {
                  if (!body || !body.response) {
                    return setTimeout(report_score, 1000);
                  }
                  account.alien_active = false;
                  output(account, err, "alien", 'old=' + body.response.old_score + ",new=" + body.response.new_score, '', false);
                  if (--arg != 0) {
                    alien(account, arg);
                  }
                });
              })();
            }, 110*1000);
          });
        })();
      });
    };

    // get alien token if needed
    if (account.alien_token) {
      return request_info();
    }
    (request_token = () => {
      account.community.httpRequestGet({
        "uri": 'https://steamcommunity.com/saliengame/gettoken',
        "json": true
      }, (err, response, body) => {
        account.alien_token = body;
        request_info();
      });
    })();
  });
// comment on profiles $USERS | 1-4 comment="" XXX dashes,spaces,plusses
var comment_time = -1;
global.comment_queue = (callback, targets, arg) =>
  (arg =>
    (arg.length < 2) ?
      tprint("ERROR! no comment: " + arg)
    :(recipients =>
      recipients.every(recipient =>
        (recipient.indexOf('file$') == 66600 /*&& !test_file(recipient.substr(5))*/) ?
          output(null, true, 'file', 'invalid' + recipient, '', false) : true) &&
        recipients.forEach(recipient =>
          callback(targets.map(target => [ target, 'comment', [recipient, arg[1]] ])))
    )(arg[0].split(','))
  )(arg.split('-', 2));
global.comment = (account, arg) =>
  login(account, "", () =>
    setTimeout((file = arg[0].substr(5)) => (
      comment_time = new Date().getTime()+12000,
      (arg[0].indexOf('file$') != 0) ?
        account.community.getSteamUser(arg[0], (err, user) =>
          (err) ?
            output(account, err, "comment", "getUser=" + arg[0])
          : user.comment(arg[1].replace(/\\n/g, '\n'), (err) =>
            output(account, err, 'comment', (err) ? err.substr(0,10) : 'OK=' + arg[0] + ",len=" + arg[1].length)))
      : account.user.getPublishedFileDetails(file, (err, results, result = results[''+file]) =>
        (err || result.result != 1) ?
          output(account, true, "comment", SteamUser.EResult[result.result] + "-" + file)
        : account.community.httpRequestPost({
          "uri": 'https://steamcommunity.com/comment/PublishedFile_Public/post/'
            + result.creator.getSteamID64() + "/" + file,
          "form": { "sessionid": account.community.sessionID, "count": 6, "comment": getChinese(), },
          "json": true,
        }, (err, response, body) =>
          output(account, err, 'comment', (err) ? body.error.substr(0,10) : 'OK=$' + file + ",len=" + arg[1].length)))
    ), comment_time-new Date().getTime()));

// add OR remove/(un)block/(un)follow a $USER | 76561198050000229-remove
isId64 = (steamid) => /765611[0-9]*/.test(steamid);
global.friend_queue = (callback, targets, arg) =>
  (arg =>
    (!/(add|remove|block|unblock|follow|unfollow)/.test(arg[1])) ?
      tprint("ERROR! invalid friend: " + arg[1])
    : callback(targets.map((target) =>
      [ target, 'friend', [(isId64(arg[0]) ? new SteamID(arg[0]) : arg[0]), arg[1]]]))
  )((arg + "-add").split('-', 2));
global.friend = (account, arg) =>
  login(account, "", () =>
    account.community.getSteamUser(arg[0], (err, user) =>
      (err) ?
        output(account, err, "getUser", arg[0])
      : (arg[1] == 'remove') ?
        user.removeFriend((err) => output(account, err, arg[1], arg[0]))
      : (arg[1] == 'block') ?
        user.blockCommunication((err) => output(account, err, arg[1], arg[0]))
      : (arg[1] == 'unblock') ?
        user.unblockCommunication((err) => output(account, err, arg[1], arg[0]))
      : (arg[1] == 'add') ?
        user.addFriend((err, name) =>
          output(account, err, arg[1], "result=" + ((err) ? SteamUser.EResult[err.eresult] : '"' + name + '"')))
      : account.community.httpRequestPost({
          "uri": 'http://steamcommunity.com/' + (user.customURL === '' ?
            'profiles/' + user.steamID.getSteamID64() :
            'id/' + user.customURL) + "/" + arg[1] + "user/",
          "form": { "sessionid": account.community.sessionID },
          "json": true,
        }, (err, response, body) =>
          output(account, (body.success == 2 ? 11 : false), arg[1],
            "result=" + (body.success == 1 ? '' : 'is ') + arg[1] + "ing " + arg[0]))));


// detail account information
global.status_queue = (callback, targets, arg) =>
  callback(targets.map((target) => [ target, 'status', arg ]));
global.status = (account, arg) => (
  console.log(account),
  proceed());

// disconnect and logoff
global.disconnect_queue = (callback, targets, arg = '') =>
  callback(targets.map((target) => [ target, 'disconnect', arg ]));
global.disconnect = (account, arg, callback = () => { proceed(); }) => {
  if (typeof account.user !== 'undefined' && account.user.client.connected) {
    // XXX if (account.user.playingState.appid != 0 && arg === '') {
    if (account.user.playingState.appid != 0) {
    //if (account.gamesPlaying.length != 0 && arg === '') {
      return output(account, 11, 'disconnect', 'blocked=PlayingGame');
    }
    account.appOwnershipCached = 0;
    delete account['logged_in'];
    account.tradeOfferManager.shutdown();
    account.user.logOff();
  }
  callback();
};

/*##############################################################################
// XXX validate email address | TODO and click on it?
global.validate_queue = (targets, arg) =>
  callback(targets.map((target) => [ target, 'validate', arg ]));
global.validate = (account, arg) => {
  if (!validated) {
    account.user.requestValidationEmail((result) => {
      tprint(account.name + "| requested validation email: " + address);
    });
  }
};
// XXX change email address
global.address_queue = (targets, arg) =>
  callback(targets.map((target) => [ target, 'address', arg ]));
global.address = (account, arg) => {
  ;
};

// XXX change password | needs integer counter?
global.password_queue = (targets, arg) => {
  // needs functiing GMAIL or supplied code to arg
  arg = arg.split('$');
  targets.forEach((target, index) => {
    if (target.hasGmail!?!?!) {
      action_queue.push([target, '', arg]);
    }
  });
};
global.password = (account, arg) => {
  requestPasswordChangeEmail(account.pass, (err) => {
    if (err) {
      return;
    }
    get_mail(, (gmails) => {
      var code = search_gmail(gmails, XXXX, YYY);
      
    }
  });
};*/
//##############################################################################

// instantiate account and/or login | <null>
getProfileURL = (account) =>
  (account.user.vanityURL ? 'id/' + account.user.vanityURL : 'profiles/' + account.user.steamID.toString());
var input_guard = '';
global.login_queue = (callback, targets, arg) =>
  callback(targets.map(target => [ target, 'login', arg ]));
global.login = (account, arg, callback = () => { proceed(); }) => {
  if (typeof account.user === 'undefined') {
    //##if (!fs.existsSync('share/' + account.name)) {
    //##  fs.mkdirSync('share/' + account.name);
    //##}
    account.user = new SteamUser();
    account.user.setOption("dataDirectory", null);
    account.user.setOption("autoRelogin", false);
    account.user.setOption("promptSteamGuardCode", false);
    account.community = new SteamCommunity();
    account.tradeOfferManager = new SteamTradeOfferManager({
      "steam": account.user,
      "community": account.community,
      "dataDirectory": null,
      "domain": "primarydataloop",
      "language": "en"
    });
    account.tf2 = new TF2(account.user);

    // watch connection events
    account.user.client.on('error', (err) =>
      (err.message == "Disconnected") ?
        output(account, false, 'disconnect', 'result=done', '', false)
      : output(account, true, 'disconnect', 'result=' + err.message, "", false));
// #############################################################################
    // XXX no password with generalized input quetion blocker and shit
      // create account if it doesnt exist
      /*if (response.eresult == EResult.AccountNotFound) {
        send(account.client, Emsg.ClientCreateAccountProto, new Client.CMsgClientCreateAccount({
          "account_name": account.name,
          "password": account.pass,
          "email": account.mail,
          "launcher": 0
        }), (body) => {
          ; // presumably get some result and have to login again XXX
        });
      } else if (response.eresult != EResult.OK) {
        console.error('FAILLOGON_' + response.eresult);
        return 1;
      }
      global.create()
        login (anonymoouserly ) {
          createAccount(accountName, password, email, () => {
            ;
          });
        });
      ]);*/
// ############################################################################# XXX
    account.user.on('error', (err) => {
      if (err.message != 'InvalidPassword') {
        return output(account, true, 'logon', 'error=' + err.message, "", false);
      }
      if (fs.existsSync('share/' + account.name + '/key')) {
        fs.unlinkSync('share/' + account.name + '/key');
        //relogin? only if password is suppliaed
        output(account, 11, 'login', 'result=expiredKey', '', false);
        if (typeof account.pass !== 'undefined' && account.pass.length) {
          // relogin
        }
      } else {
        ;// else password is wrong, || password is unspllied\
        ;// no key file, deleted and tried again
        ; // no key file, 
      }
    });
// how to accept guard and password
// #############################################################################

    // account credential events
    account.user.on('steamGuard', (domain, callback, lastCodeWrong) => (
      tprint(account.name + "| INPUT guard: ", false),
      input_guard = ' ',
      (check_guard_code = () =>
        (input_guard.length == 5) ? (
          callback(input_guard),
          input_guard = '')
        : setTimeout(check_guard_code, 1000)
      )()));
    account.user.on('sentry', (sentry) =>
      fs.writeFileSync('share/' + account.name + '/ssfn', sentry));
    account.user.on('loginKey', (key) =>
      fs.writeFileSync('share/' + account.name + '/key', key, 'utf8'));
    account.user.on('emailInfo', (address, validated) => (
      (address != account.mail) &&
        output(account, 11, "email", "mismatch=" + address, '', false),
      (!validated) &&
        output(account, 11, "email", "unvalidated=" + address, '', false)));

    // account item events
    account.new_items = -1;
    account.new_items_timer = -1;
    account.user.on('newItems', (count) => (
      clearTimeout(account.new_items_timer),
      account.new_items = count,
      account.new_items_timer = setTimeout((announce) => (
        (announce) &&
          output(account, 2, 'item', 'steam=' + account.new_items, '', false),
        (account.new_items !== 0) &&
          account.community.httpRequestGet({ "uri" : 'https://steamcommunity.com/' + getProfileURL(account) + '/inventory'}))
      , 3000, (account.new_items == -1 || count == 0 ? false : true))));

    // proceed after successful login, and waiting for some events
    account.user.on('loggedOn', (details, parental) =>
      output(account, false, 'authenticate',
        "id64=" + account.user.steamID.getSteamID64(), '', false));
    account.user.on('nicknameList', () =>
      output(account, false, 'friends',
        "list=" + Object.keys(account.user.myFriends).length +
        ",nicks=" + Object.keys(account.user.myNicknames).length +
        ",url=" + account.user.vanityURL, "", false, "", false));
    account.user.on('licenses', (licenses) => (
      account.user.licenses = licenses,
      account.user.setOption("enablePicsCache", true)));
    account.appOwnershipCached = 0;
    account.gamesPlaying = [];
    account.user.on('appOwnershipCached', () => {
      if (++account.appOwnershipCached == 2) {
        output(account, false, "appcache", "app=" +
          Object.keys(account.user.picsCache.apps).length + ",pak=" +
          Object.keys(account.user.picsCache.packages).length + ",lic=" +
          account.user.licenses.length, '', false);
        if (typeof account.community.sessionID !== 'undefined') {
          finish_login();
        }
      }
    });
    account.user.on('webSession', (sessionID, cookies) => (
      cookies.push('birthtime=-729000000'),
      cookies.push('mature_content=1'),
      account.tradeOfferManager.sessionID = sessionID,
      account.tradeOfferManager.setCookies(cookies),
      account.community.sessionID = sessionID,
      account.community.setCookies(cookies),
      output(account, false, "websession", "id=" + sessionID, '', false),
      (account.appOwnershipCached >= 2) &&
        finish_login()));
    finish_login = () =>
      (typeof account.logged_in === 'undefined') && (
        output(account, false, "login", "flags=#"
          + account.user.accountInfo.flags + ",machines="
          + account.user.accountInfo.authedMachines + ",items="
          + (""+account.new_items).replace('-1', 'none'), '', false),
        account.logged_in = true,
        account.new_items = (account.new_items == -1 ? 0 : account.new_items),
        callback());
  }

  // connect if not logged on
  if (account.user.client.loggedOn) {
    return callback();
  }
  var ssfn = (fs.existsSync('D:\\Work\\node-byteframe\\share/' + account.name + '-ssfn')
    ? 'D:\\Work\\node-byteframe\\share/' + account.name + '-ssfn' : 'share/ssfn');
  if (fs.existsSync(ssfn)) {
    account.user.setSentry(Crypto.createHash('sha1').update(
      fs.readFileSync(ssfn)).digest());
  }
  var logon_settings = { rememberPassword: false, accountName: account.name, };
  if (fs.existsSync('share/' + account.name + '/key')) {
    logon_settings.loginKey = fs.readFileSync('share/' + account.name + '/key', 'utf8');
  } else {
    logon_settings.password = account.pass;
  }
  account.user.logOn(logon_settings);
};

// quit and signal handling
quit = () => (
  stop(),
  idler.accounts.shift(),
  idler.accounts.forEach((account, index) => disconnect(account, "force")),
  setTimeout(process.exit, 1000, 0));
process.on('SIGINT', quit);
process.on('SIGTERM', quit);

// action ordering
global.action_queue = [];
stop = () =>
  (action_queue.length) && (
    tprint('removed ' + action_queue.length + ' jobs'),
    action_queue = []);
proceed = (remove = true) => (
  (remove) &&
    action_queue.shift(),
  (action_queue.length > 0 && action_queue[0][1] != 'block') &&
    global[action_queue[0][1]](
      idler.accounts[action_queue[0][0]], action_queue[0][2]));

// source script file
script = (file = '') =>
  (!fs.existsSync(file)) ?
    output(null, true, 'script', 'file=' + file, '', false)
  : eval(fs.readFileSync(file));

// load modules and config file then take command line as first input
global._mckay_statistics_opt_out = true;
var version = "0.001"
  , os = require('os')
  , colors = require('colors')
  , Crypto = require('crypto')
  , Cheerio = require('cheerio')
  , request = require('request')
  , readline = require('readline').createInterface({
      input: process.stdin, output: process.stdout })
  , SteamID = require('steamid')
  , SteamUser = require('steam-user')
  , SteamCommunity = require('steamcommunity')
  , SteamTradeOfferManager = require('steam-tradeoffer-manager')
  , TF2 = require('tf2')
  , idler = JSON.parse(fs.readFileSync('E:\\AAA_MAFILES\\pdl-idler.json', 'utf8'));
//##if (!fs.existsSync('share')) {
//##  fs.mkdirSync('share');
//##}

// check and/or authenticate gmail oauth2 secrets
var emails = new Object();
//##var files = fs.readdirSync("share/");
var files = fs.readdirSync("D:\\Work\\node-byteframe\\share/");
(check_files = (f = 0) => {
  if (f != files.length) {
    if (!/.*_secret.json/.test(files[f])) {
      return check_files(f+1);
    }
    var secret = JSON.parse(fs.readFileSync('D:\\Work\\node-byteframe\\share/' + files[f])).installed
      , email = files[f].slice(0,-12)
      , file = 'share/' + email + '_token.json';
    emails[email] = new google.auth.OAuth2(secret.client_id,
      secret.client_secret, secret.redirect_uris[0]);
    if (fs.existsSync(file)) {
      emails[email].setCredentials(JSON.parse(fs.readFileSync(file)));
      return check_files(f+1);
    }
    var url = emails[email].generateAuthUrl({ access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'] });
    readline.question('GET CODE FROM: ' + url, (code) =>
      emails[email].getToken(code, (err, token) =>
        (err) ? (
          tprint('ERROR!, getToken failure: ' + err),
          process.exit(1))
        :(emails[email].credentials = token,
          fs.writeFile(file, JSON.stringify(token)),
          check_files(f+1))));
  }

  // catch all further errors and print init message
  process.on('uncaughtException', (err) => console.log(err));
  output(null, false, 'initialization', 'ver=' + version + ',acct=' + 
    idler.accounts.length + ',mail=' + Object.keys(emails).length, '', false);
  idler.accounts.unshift({});

  // command console and command line reads input splitting on argument spaces
  readline.on('line', (input) => {
    if (input.length) {
      if (input_guard.length) {
        return input_guard = input;
      }
      handle_input(input.match(/(?:[^\s"]+|"[^"]*")+/g).map(
        (action) => action.replace('="', '=').replace(/\"$/, '')));
    }
  });
  (handle_input = (input) => {
    if (!input.length) {
      return true;
    } else if (!/^[$]*[0-9,-]+/.test(input[0])) {
      return eval(input.join(' '));
    }
    if (input.length == 1) {
      input.push("status");
    }
    var start = (action_queue.length === 0 ? true : false)
      , order = (input[0][0] == '$' ? true : false)
      , index = 0
      , targets = []
      , actions = []
      , actions_new = [];
    input[0].replace(/[$]/, '').split(',').forEach((target, index) => {
      var _target = target.split(/[*|%|-]/)
      if (_target.length == 1) {
        _target.push(_target[0]);
      }
      if (+_target[0] > +_target[1]) {
        return output(null, true, 'input', 'target=' + action, '', false);
      }
      for (var i = +_target[0]; i <= +_target[1]; i++) {
        targets.push(i);
      }
      if (target.indexOf('*') > -1) {
        shuffle_array(targets);
      } else if (target.indexOf('%') > -1) {
        targets.reverse();
      }
    });
    (queue = (q = 1) => {
      action = input[q].split('=', 2);
      if (typeof global[action[0] + "_queue"] !== "function") {
        return output(null, true, 'input', 'action=' + action, '', false);
      }
      global[action[0] + "_queue"]((_actions, sequential = false) => {
        actions.push({ actions: _actions, sequential: sequential});
        if (q+1 != input.length) {
          return queue(q+1);
        }
        while (actions.length) {
          index = (index == actions.length) ? 0 : index;
          actions_new = actions_new.concat(actions[index].actions.splice(0, 1));
          if (!actions[index].actions.length) {
            actions.splice(index, 1);
          } else if (order && (!actions[index].sequential
          || actions[index].actions[0][0] != actions_new[actions_new.length-1][0])) {
            index++;
          }
        }
        action_queue = action_queue.concat(actions_new);
        if (start) {
          proceed(false);
        }
      }, targets, action[1]);
    })();
  })(process.argv.slice(2));
})();

/* pdl-idler README.md

INSTALLATION:

  1| make a directory for pdl-idler
  2| change to that directory and install npm modules:
     npm-install colors steam-user steamcommunity steam-tradeoffermanager tf2
  3| create 'pdl-idler.json' configuration file (this sample defines 2 accounts)
     {
       "apikey": "put-webapi-key-here",
       "accounts": [
         { "name": "account1", "pass": "password1", "mail": "joeidler+account1@gmail.com" },
         { "name": "account2", "pass": "password2", "mail": "joeidler+account2@gmail.com" }
       ]
     }
  4| existing ssfn files can be stored in `./share/${account}/ssfn`, with a
     fallback singular './share/ssfn' file. any ssfn files creations will be
     stored per-account.

GMAIL INTEGRATION:
  XXX see byteframe?
those modules!

USAGE:
  XXX see byteframe!




201-232
pdl-idler.bat $121-196 file=1956639944-subscribe file=1956639944-favorite file=1966815885-subscribe file=1966815885-favorite file=1970279083-subscribe file=1970279083-favorite file=1987345945-subscribe file=1987345945-favorite disconnect

pdl-idler.bat $201-232 file=1896396076-subscribe file=1896396076-favorite file=1897850524-subscribe file=1897850524-favorite file=1908349515-subscribe file=1908349515-favorite file=1915514460-subscribe file=1915514460-favorite file=1918846789-subscribe file=1918846789-favorite file=1927046134-subscribe file=1927046134-favorite file=1949863963-subscribe file=1949863963-favorite file=1956639944-subscribe file=1956639944-favorite file=1966815885-subscribe file=1966815885-favorite file=1970279083-subscribe file=1970279083-favorite file=1987345945-subscribe file=1987345945-favorite disconnect

*/