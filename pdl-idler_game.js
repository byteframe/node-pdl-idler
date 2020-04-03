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
