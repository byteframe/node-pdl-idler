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
