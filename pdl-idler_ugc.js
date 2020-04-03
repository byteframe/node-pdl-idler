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
        SteamUser.EResult[result] + "=" + arg[0])));