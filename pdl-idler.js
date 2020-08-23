
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
    //account.tf2 = new TF2(account.user);

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
    /*account.user.on('licenses', (licenses) => (
      account.user.licenses = licenses,
      account.user.setOption("enablePicsCache", true)));*/
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
      //(account.appOwnershipCached >= 2) &&
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
  , idler = JSON.parse(fs.readFileSync('G:\\AAA_MAFILES\\pdl-idler.json', 'utf8'));
//##if (!fs.existsSync('share')) {
//##  fs.mkdirSync('share');
//##}

// check and/or authenticate gmail oauth2 secrets
var emails = new Object();
//##var files = fs.readdirSync("share/");
var files = fs.readdirSync("G:\\AAA_MAFILES/");
(check_files = (f = 0) => {
  if (f != files.length) {
    if (!/.*_secret.json/.test(files[f])) {
      return check_files(f+1);
    }
    var secret = JSON.parse(fs.readFileSync('G:\\AAA_MAFILES/' + files[f])).installed
      , email = files[f].slice(0,-12)
      , file = 'G:\\AAA_MAFILES/' + email + '_token.json';
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

