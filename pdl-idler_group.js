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

