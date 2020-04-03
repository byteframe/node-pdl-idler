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

