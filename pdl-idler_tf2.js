var TF2Language = require('tf2/language.js');

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

